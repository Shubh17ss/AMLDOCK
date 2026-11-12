import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, CardContent, Divider,
  Stack, TextField, Typography,
} from '@mui/material';
import { updateFirm } from '../../api/firms.js';
import { FirmCountrySelect } from '../../components/FirmCountrySelect.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { canWrite } from '../../auth/roles.js';
import { tokens } from '../../theme/theme.js';
import { useToast } from '../../components/ToastProvider.jsx';
import { emailFieldProps, isBadEmail } from '../../utils/email.js';

/**
 * Reporting entity details form. `editableIdentity` (ROOT) unlocks the name, NZBN/ABN, country
 * and branch count; otherwise those are read-only and only the liaison and compliance
 * officer blocks are editable. The server refuses a branch count from anyone but ROOT.
 */
export function FirmDetailsCard({ firm, editableIdentity = false }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const mayWrite = canWrite(user?.role);
  const [form, setForm] = useState(firm);
  const { showToast } = useToast();
  const [error, setError] = useState(null);

  useEffect(() => { setForm(firm); }, [firm]);

  const mut = useMutation({
    mutationFn: () => {
      const payload = {
        liaisonName: form.liaisonName,
        liaisonEmail: form.liaisonEmail,
        liaisonContactNumber: form.liaisonContactNumber,
        complianceOfficerName: form.complianceOfficerName,
        complianceOfficerEmail: form.complianceOfficerEmail,
        complianceOfficerContactNumber: form.complianceOfficerContactNumber,
      };
      if (editableIdentity) {
        payload.numberOfBranches = form.numberOfBranches === '' || form.numberOfBranches == null
          ? null : Number(form.numberOfBranches);
        payload.name = form.name;
        payload.nzbn = form.nzbn;
        payload.country = form.country;
      }
      return updateFirm(firm.publicId, payload);
    },
    onSuccess: (data) => {
      qc.setQueryData(['firm', firm.publicId], data);
      qc.invalidateQueries({ queryKey: ['firms'] });
      setError(null);
      showToast({ severity: 'success', message: 'Reporting entity updated' });
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to save'),
  });

  const ch = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e) => { e.preventDefault(); mut.mutate(); };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Reporting Entity details</Typography>
        <Divider sx={{ mb: 2 }} />
        <Box component="form" onSubmit={submit}>
          <Stack spacing={2} sx={{ maxWidth: 520 }}>
            <TextField label="Firm name" value={form.name ?? ''} onChange={ch('name')}
                       InputProps={{ readOnly: !editableIdentity }} disabled={!editableIdentity}
                       helperText={editableIdentity ? undefined : "Reporting entity name can't be changed."} />
            <FirmCountrySelect
              value={form.country ?? ''}
              onChange={(code) => setForm((f) => ({ ...f, country: code }))}
              disabled={!editableIdentity}
              helperText={editableIdentity ? undefined : "Country can't be changed."}
            />
            <TextField label="NZBN/ABN" value={form.nzbn ?? ''} onChange={ch('nzbn')}
                       InputProps={{ readOnly: !editableIdentity }} disabled={!editableIdentity}
                       helperText={editableIdentity ? undefined : "NZBN/ABN can't be changed."} />

            <Typography variant="subtitle2" sx={{ color: tokens.muted }}>Liaison</Typography>
            <TextField label="Liaison name" value={form.liaisonName ?? ''} onChange={ch('liaisonName')} />
            <TextField label="Liaison email" type="email" value={form.liaisonEmail ?? ''} onChange={ch('liaisonEmail')}
                       {...emailFieldProps(form.liaisonEmail)} />
            <TextField label="Liaison contact number" value={form.liaisonContactNumber ?? ''} onChange={ch('liaisonContactNumber')} />

            <Typography variant="subtitle2" sx={{ color: tokens.muted }}>Compliance officer</Typography>
            <TextField label="Compliance officer name" value={form.complianceOfficerName ?? ''} onChange={ch('complianceOfficerName')} />
            <TextField label="Compliance officer email" type="email" value={form.complianceOfficerEmail ?? ''} onChange={ch('complianceOfficerEmail')}
                       {...emailFieldProps(form.complianceOfficerEmail)} />
            <TextField label="Compliance officer contact number" value={form.complianceOfficerContactNumber ?? ''} onChange={ch('complianceOfficerContactNumber')} />

            <TextField label="Number of branches" type="number" value={form.numberOfBranches ?? ''}
                       onChange={ch('numberOfBranches')} inputProps={{ min: 0, max: 100 }}
                       InputProps={{ readOnly: !editableIdentity }} disabled={!editableIdentity}
                       helperText={editableIdentity ? undefined : ''} />

            {error && <Alert severity="error">{error}</Alert>}
            <Box>
              <Button type="submit" variant="contained"
                      disabled={mut.isPending || !mayWrite
                        || isBadEmail(form.liaisonEmail) || isBadEmail(form.complianceOfficerEmail)}>
                {mut.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </Box>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
