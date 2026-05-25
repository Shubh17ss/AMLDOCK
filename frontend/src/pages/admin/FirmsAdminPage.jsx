import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip,
  Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Paper, Stack,
  Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import {
  createBranch, createFirm, deactivateBranch, listBranches, listFirms,
  updateBranch, updateFirm,
} from '../../api/firms.js';

export function FirmsAdminPage() {
  const qc = useQueryClient();
  const firmsQ = useQuery({ queryKey: ['firms'], queryFn: listFirms });
  const [createOpen, setCreateOpen] = useState(false);

  const toggleActive = useMutation({
    mutationFn: ({ id, active }) => updateFirm(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firms'] }),
  });

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4">Real-estate firms</Typography>
        <Button variant="contained" onClick={() => setCreateOpen(true)}>New firm</Button>
      </Stack>

      {firmsQ.isError && <Alert severity="error">Failed to load firms.</Alert>}

      {firmsQ.data?.length === 0 && (
        <Alert severity="info">No firms yet — create one to start onboarding deals.</Alert>
      )}

      <Stack spacing={1}>
        {firmsQ.data?.map((firm) => (
          <Accordion key={firm.id} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                <Typography variant="h6">{firm.name}</Typography>
                {firm.tradingName && (
                  <Typography variant="body2" color="text.secondary">({firm.tradingName})</Typography>
                )}
                {firm.nzbn && <Chip size="small" label={`NZBN ${firm.nzbn}`} />}
                <Box sx={{ flexGrow: 1 }} />
                <Stack direction="row" spacing={1} alignItems="center" onClick={(e) => e.stopPropagation()}>
                  <Typography variant="body2">Active</Typography>
                  <Switch
                    checked={firm.active}
                    onChange={(e) => toggleActive.mutate({ id: firm.id, active: e.target.checked })}
                  />
                </Stack>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <FirmBranchesPanel firm={firm} />
            </AccordionDetails>
          </Accordion>
        ))}
      </Stack>

      <CreateFirmDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </Stack>
  );
}

function FirmBranchesPanel({ firm }) {
  const qc = useQueryClient();
  const branchesQ = useQuery({
    queryKey: ['firms', firm.id, 'branches'],
    queryFn: () => listBranches(firm.id),
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const toggleActive = useMutation({
    mutationFn: ({ id, active }) => updateBranch(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firms', firm.id, 'branches'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => deactivateBranch(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['firms', firm.id, 'branches'] }),
  });

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1">Branches</Typography>
        <Button size="small" variant="outlined" onClick={() => setCreateOpen(true)}>Add branch</Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>City</TableCell>
              <TableCell>Manager</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {branchesQ.data?.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{b.name}</TableCell>
                <TableCell>{b.city ?? '—'}</TableCell>
                <TableCell>{b.managerName ?? '—'}</TableCell>
                <TableCell>{b.phone ?? '—'}</TableCell>
                <TableCell>
                  <Switch
                    size="small"
                    checked={b.active}
                    onChange={(e) => toggleActive.mutate({ id: b.id, active: e.target.checked })}
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => setEditTarget(b)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Deactivate">
                    <IconButton size="small" onClick={() => deleteMut.mutate(b.id)} disabled={!b.active}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {branchesQ.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  No branches yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <CreateBranchDialog firmId={firm.id} open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditBranchDialog branch={editTarget} firmId={firm.id} onClose={() => setEditTarget(null)} />
    </Stack>
  );
}

const EMPTY_FIRM = {
  name: '', tradingName: '', nzbn: '', headOfficeAddress: '', contactEmail: '', contactPhone: '',
};

function CreateFirmDialog({ open, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_FIRM);
  const [error, setError] = useState(null);
  const mut = useMutation({
    mutationFn: () => createFirm({ ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firms'] });
      setForm(EMPTY_FIRM);
      setError(null);
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create firm'),
  });
  const submit = (e) => { e.preventDefault(); mut.mutate(); };
  const ch = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>New real-estate firm</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={form.name} onChange={ch('name')} required />
            <TextField label="Trading name" value={form.tradingName} onChange={ch('tradingName')} />
            <TextField label="NZBN" value={form.nzbn} onChange={ch('nzbn')} />
            <TextField label="Head office address" value={form.headOfficeAddress}
                       onChange={ch('headOfficeAddress')} multiline minRows={2} />
            <TextField label="Contact email" type="email" value={form.contactEmail} onChange={ch('contactEmail')} />
            <TextField label="Contact phone" value={form.contactPhone} onChange={ch('contactPhone')} />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={mut.isPending}>
            {mut.isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

const EMPTY_BRANCH = {
  name: '', addressLine1: '', addressLine2: '', suburb: '', city: '', postcode: '',
  phone: '', email: '', managerName: '', managerEmail: '',
};

function CreateBranchDialog({ firmId, open, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_BRANCH);
  const [error, setError] = useState(null);
  const mut = useMutation({
    mutationFn: () => createBranch(firmId, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firms', firmId, 'branches'] });
      setForm(EMPTY_BRANCH);
      setError(null);
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create branch'),
  });
  const submit = (e) => { e.preventDefault(); mut.mutate(); };
  const ch = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>New branch</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Branch name" value={form.name} onChange={ch('name')} required />
            <TextField label="Address line 1" value={form.addressLine1} onChange={ch('addressLine1')} />
            <TextField label="Address line 2" value={form.addressLine2} onChange={ch('addressLine2')} />
            <Stack direction="row" spacing={2}>
              <TextField label="Suburb" value={form.suburb} onChange={ch('suburb')} fullWidth />
              <TextField label="City" value={form.city} onChange={ch('city')} fullWidth />
              <TextField label="Postcode" value={form.postcode} onChange={ch('postcode')} sx={{ width: 140 }} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="Phone" value={form.phone} onChange={ch('phone')} fullWidth />
              <TextField label="Email" type="email" value={form.email} onChange={ch('email')} fullWidth />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="Manager name" value={form.managerName} onChange={ch('managerName')} fullWidth />
              <TextField label="Manager email" type="email" value={form.managerEmail}
                         onChange={ch('managerEmail')} fullWidth />
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={mut.isPending}>
            {mut.isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function EditBranchDialog({ branch, firmId, onClose }) {
  const qc = useQueryClient();
  const open = Boolean(branch);
  const [form, setForm] = useState(EMPTY_BRANCH);
  const [error, setError] = useState(null);

  // hydrate form when target changes
  useEffect(() => {
    if (branch) setForm({ ...EMPTY_BRANCH, ...branch });
  }, [branch?.id]);

  const mut = useMutation({
    mutationFn: () => updateBranch(branch.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firms', firmId, 'branches'] });
      setError(null);
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to update branch'),
  });
  const submit = (e) => { e.preventDefault(); mut.mutate(); };
  const ch = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>Edit branch</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Branch name" value={form.name ?? ''} onChange={ch('name')} required />
            <TextField label="Address line 1" value={form.addressLine1 ?? ''} onChange={ch('addressLine1')} />
            <TextField label="Address line 2" value={form.addressLine2 ?? ''} onChange={ch('addressLine2')} />
            <Stack direction="row" spacing={2}>
              <TextField label="Suburb" value={form.suburb ?? ''} onChange={ch('suburb')} fullWidth />
              <TextField label="City" value={form.city ?? ''} onChange={ch('city')} fullWidth />
              <TextField label="Postcode" value={form.postcode ?? ''} onChange={ch('postcode')} sx={{ width: 140 }} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="Phone" value={form.phone ?? ''} onChange={ch('phone')} fullWidth />
              <TextField label="Email" type="email" value={form.email ?? ''} onChange={ch('email')} fullWidth />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="Manager name" value={form.managerName ?? ''} onChange={ch('managerName')} fullWidth />
              <TextField label="Manager email" type="email" value={form.managerEmail ?? ''}
                         onChange={ch('managerEmail')} fullWidth />
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={mut.isPending}>
            {mut.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
