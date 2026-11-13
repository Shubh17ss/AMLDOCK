import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material';
import { createFirm, listFirms } from '../../api/firms.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ActiveStatusChip } from '../../features/firm/ActiveStatusChip.jsx';
import { canWrite } from '../../auth/roles.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { FirmCountrySelect } from '../../components/FirmCountrySelect.jsx';
import { flagClass } from '../../data/countries.js';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import { tokens } from '../../theme/theme.js';
import { emailFieldProps, isBadEmail } from '../../utils/email.js';

export function FirmsAdminPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  // The API returns every entity to ROOT and only their own to firm-level staff, so the table
  // needs no filtering here — but creating entities stays platform-only. AUDIT reaches this screen
  // to read the register; only ROOT creates entities. Status is read-only here: deactivating is
  // done from the entity's own page.
  const isRoot = currentUser?.role === 'ROOT';
  const mayWrite = canWrite(currentUser?.role);
  const firmsQ = useQuery({ queryKey: ['firms'], queryFn: listFirms });
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow={isRoot
          ? `${firmsQ.data?.length ?? 0} reporting entities · ${(firmsQ.data ?? []).filter((f) => f.active).length} active`
          : 'Your reporting entity'}
        title="Reporting entities"
        actions={isRoot && mayWrite && (
          <Button variant="contained" startIcon={<AddBusinessIcon />} onClick={() => setCreateOpen(true)}>
            New reporting entity
          </Button>
        )}
      />

      {firmsQ.isError && <Alert severity="error">Failed to load reporting entities.</Alert>}
      {firmsQ.data?.length === 0 && (
        <Alert severity="info">No reporting entities yet — create one to start onboarding deals.</Alert>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Entity name</TableCell>
              <TableCell>NZBN/ABN</TableCell>
              <TableCell>Compliance officer</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {firmsQ.data?.map((firm) => (
              <TableRow key={firm.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box component="span" className={flagClass(firm.country)}
                         title={firm.country}
                         sx={{ fontSize: '1.05rem', borderRadius: '2px', flexShrink: 0 }} />
                    <span>{firm.name}</span>
                  </Box>
                </TableCell>
                <TableCell>{firm.nzbn ? <Chip size="small" label={firm.nzbn} /> : '—'}</TableCell>
                <TableCell>{firm.complianceOfficerEmail ?? '—'}</TableCell>
                <TableCell>
                  <ActiveStatusChip active={firm.active} />
                  {!firm.active && firm.deactivatedAt && (
                    <Typography variant="caption" display="block" sx={{ color: tokens.muted, mt: 0.5 }}>
                      since {new Date(firm.deactivatedAt).toLocaleDateString(undefined,
                        { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Button size="small" variant="outlined"
                          onClick={() => navigate(`/settings/reporting-entities/${firm.publicId}`)}>
                    Manage
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <CreateFirmDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </Stack>
  );
}

const EMPTY_FIRM = {
  // Most entities are New Zealand ones, so that's the default rather than an empty select.
  name: '', nzbn: '', country: 'NZ',
  liaisonName: '', liaisonEmail: '', liaisonContactNumber: '',
  complianceOfficerName: '', complianceOfficerEmail: '', complianceOfficerContactNumber: '',
  numberOfBranches: '',
};

function CreateFirmDialog({ open, onClose }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [form, setForm] = useState(EMPTY_FIRM);
  const [error, setError] = useState(null);
  // NZBN/ABN is unique within a country. Checked here against the register already on screen so
  // the clash shows while typing; the server holds the same rule (FirmService.create).
  const firmsQ = useQuery({ queryKey: ['firms'], queryFn: listFirms, enabled: open });
  const nzbnTaken = Boolean(form.nzbn.trim()) && (firmsQ.data ?? []).some((f) =>
    f.country === form.country && f.nzbn?.trim().toLowerCase() === form.nzbn.trim().toLowerCase());
  const nzbnLabel = form.country === 'AU' ? 'ABN' : 'NZBN';
  const mut = useMutation({
    mutationFn: () => createFirm({
      ...form,
      numberOfBranches: form.numberOfBranches === '' ? null : Number(form.numberOfBranches),
    }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['firms'] });
      showToast({ severity: 'success', message: `Reporting entity ${created?.name ?? form.name} created` });
      setForm(EMPTY_FIRM);
      setError(null);
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create reporting entity'),
  });
  const submit = (e) => { e.preventDefault(); mut.mutate(); };
  const ch = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submittable = form.name && form.country && form.liaisonEmail && form.complianceOfficerEmail
    && !nzbnTaken && !isBadEmail(form.liaisonEmail) && !isBadEmail(form.complianceOfficerEmail);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>New reporting entity</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Entity name" value={form.name} onChange={ch('name')} required />
            <FirmCountrySelect
              value={form.country}
              onChange={(code) => setForm((f) => ({ ...f, country: code }))}
              required
            />
            <TextField label="NZBN/ABN" value={form.nzbn} onChange={ch('nzbn')}
                       error={nzbnTaken}
                       helperText={nzbnTaken
                         ? `Another ${form.country} reporting entity already uses this ${nzbnLabel}.`
                         : 'Must be unique among reporting entities in the same country.'} />

            <Typography variant="subtitle2" sx={{ color: tokens.muted, mt: 1 }}>Liaison</Typography>
            <TextField label="Liaison name" value={form.liaisonName} onChange={ch('liaisonName')} />
            <TextField label="Liaison email" type="email" value={form.liaisonEmail}
                       onChange={ch('liaisonEmail')} required {...emailFieldProps(form.liaisonEmail)} />
            <TextField label="Liaison contact number" value={form.liaisonContactNumber}
                       onChange={ch('liaisonContactNumber')} />

            <Typography variant="subtitle2" sx={{ color: tokens.muted, mt: 1 }}>Compliance officer</Typography>
            <TextField label="Compliance officer name" value={form.complianceOfficerName}
                       onChange={ch('complianceOfficerName')} />
            <TextField label="Compliance officer email" type="email" value={form.complianceOfficerEmail}
                       onChange={ch('complianceOfficerEmail')} required
                       {...emailFieldProps(form.complianceOfficerEmail,
                         'A passwordless AML Compliance Officer login is created with this email.')} />
            <TextField label="Compliance officer contact number" value={form.complianceOfficerContactNumber}
                       onChange={ch('complianceOfficerContactNumber')} />

            <TextField label="Number of branches" type="number" value={form.numberOfBranches}
                       onChange={ch('numberOfBranches')} inputProps={{ min: 0, max: 100 }}
                       helperText="Creates this many placeholder branches (Branch 1…N) to rename later." />

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
    </Dialog>
  );
}
