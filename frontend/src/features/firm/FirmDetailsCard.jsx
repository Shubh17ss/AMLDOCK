import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, CardContent, Divider, FormControlLabel,
  Stack, Switch, TextField, Typography,
} from '@mui/material';
import { updateFirm } from '../../api/firms.js';

/**
 * Firm metadata form. `editableIdentity` (ROOT) unlocks firm name, NZBN/ABN and the active flag;
 * otherwise those are read-only and only the contact blocks + branch count are editable.
 */
export function FirmDetailsCard({ firm, editableIdentity = false }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(firm);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setForm(firm); }, [firm]);

  const mut = useMutation({
    mutationFn: () => {
      const payload = {
        liaisonName: form.liaisonName,
        liaisonEmail: form.liaisonEmail,
        liaisonContactNumber: form.liaisonContactNumber,
        seniorManagerName: form.seniorManagerName,
        seniorManagerEmail: form.seniorManagerEmail,
        seniorManagerContactNumber: form.seniorManagerContactNumber,
        numberOfBranches: form.numberOfBranches === '' || form.numberOfBranches == null
          ? null : Number(form.numberOfBranches),
      };
      if (editableIdentity) {
        payload.name = form.name;
        payload.nzbn = form.nzbn;
        payload.active = form.active;
      }
      return updateFirm(firm.id, payload);
    },
    onSuccess: (data) => {
      qc.setQueryData(['firm', firm.id], data);
      qc.invalidateQueries({ queryKey: ['firms'] });
      setError(null);
      setSaved(true);
    },
    onError: (err) => { setSaved(false); setError(err.response?.data?.message || 'Failed to save'); },
  });

  const ch = (k) => (e) => { setSaved(false); setForm((f) => ({ ...f, [k]: e.target.value })); };
  const submit = (e) => { e.preventDefault(); mut.mutate(); };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Firm details</Typography>
        <Divider sx={{ mb: 2 }} />
        <Box component="form" onSubmit={submit}>
          <Stack spacing={2} sx={{ maxWidth: 520 }}>
            <TextField label="Firm name" value={form.name ?? ''} onChange={ch('name')}
                       InputProps={{ readOnly: !editableIdentity }} disabled={!editableIdentity}
                       helperText={editableIdentity ? undefined : "Firm name can't be changed."} />
            <TextField label="NZBN/ABN" value={form.nzbn ?? ''} onChange={ch('nzbn')}
                       InputProps={{ readOnly: !editableIdentity }} disabled={!editableIdentity}
                       helperText={editableIdentity ? undefined : "NZBN/ABN can't be changed."} />
            {editableIdentity && (
              <FormControlLabel
                control={<Switch checked={Boolean(form.active)}
                                 onChange={(e) => { setSaved(false); setForm((f) => ({ ...f, active: e.target.checked })); }} />}
                label="Active"
              />
            )}

            <Typography variant="subtitle2" color="text.secondary">Liaison</Typography>
            <TextField label="Liaison name" value={form.liaisonName ?? ''} onChange={ch('liaisonName')} />
            <TextField label="Liaison email" type="email" value={form.liaisonEmail ?? ''} onChange={ch('liaisonEmail')} />
            <TextField label="Liaison contact number" value={form.liaisonContactNumber ?? ''} onChange={ch('liaisonContactNumber')} />

            <Typography variant="subtitle2" color="text.secondary">Senior manager</Typography>
            <TextField label="Senior manager name" value={form.seniorManagerName ?? ''} onChange={ch('seniorManagerName')} />
            <TextField label="Senior manager email" type="email" value={form.seniorManagerEmail ?? ''} onChange={ch('seniorManagerEmail')} />
            <TextField label="Senior manager contact number" value={form.seniorManagerContactNumber ?? ''} onChange={ch('seniorManagerContactNumber')} />

            <TextField label="Number of branches" type="number" value={form.numberOfBranches ?? ''}
                       onChange={ch('numberOfBranches')} inputProps={{ min: 0, max: 100 }} />

            {error && <Alert severity="error">{error}</Alert>}
            {saved && <Alert severity="success">Saved.</Alert>}
            <Box>
              <Button type="submit" variant="contained" disabled={mut.isPending}>
                {mut.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </Box>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
