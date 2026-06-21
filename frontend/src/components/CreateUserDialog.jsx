import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, Link, MenuItem, Paper, Select, Stack, Tab, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import { bulkCreateUsers, createUser } from '../api/users.js';
import { listBranches, listFirms } from '../api/firms.js';
import { creatableRoles, requiresFirm, requiresBranch, roleLabel } from '../auth/roles.js';
import { buildCsv, parseUsersCsv } from '../utils/csv.js';
import { useToast } from './ToastProvider.jsx';

/**
 * Add-user dialog with two modes:
 *   - "Manual"     → the single-user form, scoped to the importer's privileges.
 *   - "Upload CSV" → bulk import (only when a firm context exists, i.e. lockedFirmId is set).
 * Same props/usage as before, so the call sites are unchanged.
 */
export function CreateUserDialog({ open, onClose, currentUser, lockedFirmId }) {
  const csvAvailable = lockedFirmId != null;
  const [mode, setMode] = useState('manual');

  useEffect(() => { if (open) setMode('manual'); }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: csvAvailable ? 1 : 2 }}>New user</DialogTitle>
      {csvAvailable && (
        <Tabs value={mode} onChange={(_, v) => setMode(v)} sx={{ px: 3 }}>
          <Tab label="Manual" value="manual" />
          <Tab label="Upload CSV" value="csv" />
        </Tabs>
      )}
      {mode === 'manual'
        ? <ManualUserForm open={open} onClose={onClose} currentUser={currentUser} lockedFirmId={lockedFirmId} />
        : <CsvUserImport onClose={onClose} currentUser={currentUser} firmId={lockedFirmId} />}
    </Dialog>
  );
}

/**
 * Single-user form scoped to the logged-in user's privileges:
 *   - role options = roles they may create (strictly lower rank)
 *   - ROOT picks the firm; firm-level creators are pinned to their own firm
 *   - branch picker appears for branch roles; a sales manager's new users inherit their branch
 */
function ManualUserForm({ open, onClose, currentUser, lockedFirmId }) {
  const qc = useQueryClient();
  const creatorRole = currentUser?.role;
  const allowedRoles = creatableRoles(creatorRole);
  const isRoot = creatorRole === 'ROOT';
  const isSalesManager = creatorRole === 'SALES_MANAGER';
  // When a firm is locked (e.g. ROOT managing a specific firm) we don't show the firm picker.
  const firmPinned = lockedFirmId != null;
  const showFirmPicker = isRoot && !firmPinned;

  const emptyForm = () => ({
    email: '', fullName: '', role: allowedRoles[0] ?? '',
    realEstateFirmId: '', firmBranchId: '',
  });
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) { setForm(emptyForm()); setError(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const needsFirm = requiresFirm(form.role);
  const needsBranch = requiresBranch(form.role);

  const firmId = firmPinned ? lockedFirmId : (isRoot ? form.realEstateFirmId : currentUser?.realEstateFirmId);

  const firmsQ = useQuery({ queryKey: ['firms'], queryFn: listFirms, enabled: showFirmPicker });
  const activeFirms = (firmsQ.data ?? []).filter((f) => f.active);

  const showBranchPicker = needsBranch && !isSalesManager;
  const branchesQ = useQuery({
    queryKey: ['firms', firmId, 'branches'],
    queryFn: () => listBranches(firmId),
    enabled: showBranchPicker && Boolean(firmId),
  });
  const activeBranches = (branchesQ.data ?? []).filter((b) => b.active);

  useEffect(() => {
    setForm((f) => ({ ...f, firmBranchId: '' }));
  }, [form.realEstateFirmId, form.role]);

  const resolvedBranchId = () => {
    if (!needsBranch) return null;
    if (isSalesManager) return currentUser?.firmBranchId ?? null;
    return form.firmBranchId ? Number(form.firmBranchId) : null;
  };

  const mut = useMutation({
    mutationFn: () => createUser({
      email: form.email,
      fullName: form.fullName,
      role: form.role,
      realEstateFirmId: needsFirm && firmId ? Number(firmId) : null,
      firmBranchId: resolvedBranchId(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setForm(emptyForm());
      setError(null);
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create user'),
  });

  const submit = (e) => { e.preventDefault(); mut.mutate(); };
  const ch = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submittable =
    form.email && form.fullName && form.role &&
    (!needsFirm || firmId) &&
    (!needsBranch || isSalesManager || form.firmBranchId);

  return (
    <Box component="form" onSubmit={submit}>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            New users sign in with their email and a one-time code — no password is set.
          </Typography>
          <TextField label="Full name" value={form.fullName} onChange={ch('fullName')} required />
          <TextField label="Email" type="email" value={form.email} onChange={ch('email')} required />
          <FormControl fullWidth required>
            <InputLabel id="role-label">Role</InputLabel>
            <Select labelId="role-label" label="Role" value={form.role} onChange={ch('role')}>
              {allowedRoles.map((r) => <MenuItem key={r} value={r}>{roleLabel(r)}</MenuItem>)}
            </Select>
          </FormControl>

          {showFirmPicker && needsFirm && (
            <FormControl fullWidth required>
              <InputLabel id="firm-label">Real-estate firm</InputLabel>
              <Select labelId="firm-label" label="Real-estate firm"
                      value={form.realEstateFirmId}
                      onChange={ch('realEstateFirmId')}
                      disabled={activeFirms.length === 0}>
                {activeFirms.map((f) => (
                  <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
                ))}
              </Select>
              {activeFirms.length === 0 && (
                <Typography variant="caption" color="warning.main" sx={{ mt: 0.5 }}>
                  No active firms — create one under <strong>Firms</strong> first.
                </Typography>
              )}
            </FormControl>
          )}

          {showBranchPicker && (
            <FormControl fullWidth required disabled={!firmId}>
              <InputLabel id="branch-label">Branch</InputLabel>
              <Select labelId="branch-label" label="Branch"
                      value={form.firmBranchId}
                      onChange={ch('firmBranchId')}>
                {activeBranches.map((b) => (
                  <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                ))}
              </Select>
              {firmId && activeBranches.length === 0 && !branchesQ.isLoading && (
                <Typography variant="caption" color="warning.main" sx={{ mt: 0.5 }}>
                  This firm has no active branches — add one under <strong>Firms</strong> first.
                </Typography>
              )}
            </FormControl>
          )}

          {needsBranch && isSalesManager && (
            <Typography variant="caption" color="text.secondary">
              This user will be created in your branch.
            </Typography>
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={mut.isPending || !submittable}>
          {mut.isPending ? 'Creating…' : 'Create'}
        </Button>
      </DialogActions>
    </Box>
  );
}

/**
 * Bulk import users from a CSV (fullName, email, role, branch). The firm comes from the screen's
 * firm context; the backend validates every row against the same rules as the manual form and
 * creates all-or-nothing — on any failure nothing is created and each reason is shown.
 */
function CsvUserImport({ onClose, currentUser, firmId }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const creatorRole = currentUser?.role;
  const allowedRoles = creatableRoles(creatorRole);
  const isSalesManager = creatorRole === 'SALES_MANAGER';

  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState(null);
  const [rows, setRows] = useState([]);
  const [parseError, setParseError] = useState(null);
  const [error, setError] = useState(null);
  const [rowErrors, setRowErrors] = useState([]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setParseError(null); setError(null); setRowErrors([]);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseUsersCsv(String(reader.result ?? ''));
        if (parsed.length === 0) {
          setRows([]); setFileName(null);
          setParseError('No data rows found in the file.');
          return;
        }
        setRows(parsed);
        setFileName(file.name);
      } catch {
        setRows([]); setFileName(null);
        setParseError('Could not read this file as CSV.');
      }
    };
    reader.onerror = () => setParseError('Could not read the file.');
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const example = [['Jane Doe', 'jane@example.com', allowedRoles[0] ?? 'AGENT',
      isSalesManager ? '' : 'Main branch']];
    const csv = buildCsv(['fullName', 'email', 'role', 'branch'], example);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'users-template.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const mut = useMutation({
    mutationFn: () => bulkCreateUsers({
      realEstateFirmId: firmId != null ? Number(firmId) : null,
      rows: rows.map((r) => ({ fullName: r.fullName, email: r.email, role: r.role, branchName: r.branch })),
    }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      showToast({ message: `Imported ${created.length} user${created.length === 1 ? '' : 's'}`, severity: 'success' });
      onClose();
    },
    onError: (err) => {
      const data = err.response?.data;
      setRowErrors(data?.fieldErrors ?? []);
      setError(data?.message || 'Import failed');
    },
  });

  // Informational client-side flags only — the backend is authoritative.
  const allowedSet = new Set(allowedRoles);
  const normRole = (r) => (r ?? '').trim().toUpperCase().replace(/[ -]/g, '_');
  const rowFlag = (r) => {
    if (!r.fullName || !r.email) return 'Missing name/email';
    if (!allowedSet.has(normRole(r.role))) return 'Role not allowed';
    return null;
  };

  const submit = (e) => { e.preventDefault(); mut.mutate(); };

  return (
    <Box component="form" onSubmit={submit}>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Columns: <strong>fullName, email, role, branch</strong>. Allowed roles:{' '}
            {allowedRoles.map(roleLabel).join(', ')}.
            {isSalesManager
              ? ' The branch column is ignored — users are added to your branch.'
              : ' Branch is the branch name within this firm (leave blank for firm-level roles).'}
          </Typography>

          <Box>
            <Link component="button" type="button" onClick={downloadTemplate}>
              Download CSV template
            </Link>
          </Box>

          <input ref={fileInputRef} type="file" accept=".csv,text/csv" hidden onChange={handleFile} />
          <Button variant="outlined" onClick={() => fileInputRef.current?.click()}>
            {fileName ? `Selected: ${fileName}` : 'Choose CSV file'}
          </Button>

          {parseError && <Alert severity="error">{parseError}</Alert>}

          {rows.length > 0 && (
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 280 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Full name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    {!isSalesManager && <TableCell>Branch</TableCell>}
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r, i) => {
                    const flag = rowFlag(r);
                    return (
                      <TableRow key={i}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{r.fullName || '—'}</TableCell>
                        <TableCell>{r.email || '—'}</TableCell>
                        <TableCell>{r.role || '—'}</TableCell>
                        {!isSalesManager && <TableCell>{r.branch || '—'}</TableCell>}
                        <TableCell>
                          {flag
                            ? <Typography variant="caption" color="warning.main">{flag}</Typography>
                            : <Typography variant="caption" color="success.main">OK</Typography>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {error && (
            <Alert severity="error">
              {error}
              {rowErrors.length > 0 && (
                <Box component="ul" sx={{ m: 0, mt: 1, pl: 2 }}>
                  {rowErrors.map((fe, idx) => (
                    <li key={idx}><strong>{fe.field}</strong> — {fe.message}</li>
                  ))}
                </Box>
              )}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={mut.isPending || rows.length === 0}>
          {mut.isPending ? 'Importing…' : `Import ${rows.length || ''} user${rows.length === 1 ? '' : 's'}`.replace(/\s+/g, ' ').trim()}
        </Button>
      </DialogActions>
    </Box>
  );
}
