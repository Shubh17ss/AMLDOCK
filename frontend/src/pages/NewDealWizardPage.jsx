import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, CardContent, Divider, FormControl, InputLabel, MenuItem,
  Select, Stack, Step, StepLabel, Stepper, TextField, Typography,
} from '@mui/material';
import { listFirms, listBranches } from '../api/firms.js';
import { createDeal, submitDeal } from '../api/deals.js';
import { AddressCascadingFields } from '../components/AddressCascadingFields.jsx';
import { DocumentUploader } from '../components/DocumentUploader.jsx';

const STEPS = ['Firm + branch + POC', 'Property', 'Client', 'Documents', 'Review & submit'];

const EMPTY_FORM = {
  firmId: '',
  firmBranchId: '',
  transactionType: 'PURCHASE',
  transactionValueNzd: '',
  pocName: '',
  pocRole: '',
  pocPhone: '',
  pocEmail: '',
  property: {
    addressLine1: '', addressLine2: '', suburb: '', district: '', region: '',
    country: 'NZ', postcode: '', titleReference: '', legalDescription: '', landAreaSqm: '',
  },
  client: {
    displayName: '', clientType: 'INDIVIDUAL', email: '', phone: '',
  },
};

export function NewDealWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedDeal, setSavedDeal] = useState(null); // populated after first save

  const firmsQ = useQuery({ queryKey: ['firms'], queryFn: listFirms });
  const activeFirms = useMemo(() => (firmsQ.data ?? []).filter((f) => f.active), [firmsQ.data]);

  const branchesQ = useQuery({
    queryKey: ['firms', form.firmId, 'branches'],
    queryFn: () => listBranches(form.firmId),
    enabled: Boolean(form.firmId),
  });
  const activeBranches = useMemo(() => (branchesQ.data ?? []).filter((b) => b.active), [branchesQ.data]);

  // When the user picks a branch, default the POC fields from that branch (if blank).
  useEffect(() => {
    const branch = activeBranches.find((b) => b.id === form.firmBranchId);
    if (!branch) return;
    setForm((f) => ({
      ...f,
      pocName: f.pocName || branch.managerName || '',
      pocPhone: f.pocPhone || branch.phone || '',
      pocEmail: f.pocEmail || branch.email || '',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.firmBranchId]);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setNested = (group, key) => (e) =>
    setForm((f) => ({ ...f, [group]: { ...f[group], [key]: e.target.value } }));

  const stepValid = () => {
    if (step === 0) {
      return form.firmId && form.firmBranchId && form.transactionType;
    }
    if (step === 1) {
      return form.property.addressLine1 && form.property.region && form.property.district;
    }
    if (step === 2) {
      return form.client.displayName && form.client.clientType;
    }
    return true;
  };

  const buildPayload = () => ({
    firmBranchId: form.firmBranchId,
    transactionType: form.transactionType,
    transactionValueNzd: form.transactionValueNzd ? Number(form.transactionValueNzd) : null,
    pocName: form.pocName || null,
    pocRole: form.pocRole || null,
    pocPhone: form.pocPhone || null,
    pocEmail: form.pocEmail || null,
    property: {
      ...form.property,
      landAreaSqm: form.property.landAreaSqm ? Number(form.property.landAreaSqm) : null,
    },
    client: { ...form.client },
  });

  const persistDraft = async () => {
    if (savedDeal) return savedDeal; // already persisted; new wizard run for now
    setError(null);
    setSubmitting(true);
    try {
      const created = await createDeal(buildPayload());
      setSavedDeal(created);
      return created;
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save draft');
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-persist when entering the Documents step so the uploader has a deal id.
  const handleNext = async () => {
    if (step === 2 && !savedDeal) {
      const created = await persistDraft();
      if (!created) return;
    }
    setStep((s) => s + 1);
  };

  const handleSaveDraft = async () => {
    const created = await persistDraft();
    if (created) navigate(`/deals/${created.id}`);
  };

  const handleSubmit = async () => {
    const created = await persistDraft();
    if (!created) return;
    setSubmitting(true);
    try {
      await submitDeal(created.id);
      navigate(`/deals/${created.id}`);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h4">New deal</Typography>

      <Stepper activeStep={step}>
        {STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
      </Stepper>

      <Card>
        <CardContent>
          {step === 0 && (
            <Stack spacing={2}>
              <Typography variant="h6">Firm, branch, point of contact</Typography>
              <Divider />
              <FormControl required>
                <InputLabel id="firm-label">Real-estate firm</InputLabel>
                <Select labelId="firm-label" label="Real-estate firm"
                        value={form.firmId}
                        onChange={(e) => setForm((f) => ({ ...f, firmId: e.target.value, firmBranchId: '' }))}>
                  {activeFirms.map((f) => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl required disabled={!form.firmId}>
                <InputLabel id="branch-label">Branch</InputLabel>
                <Select labelId="branch-label" label="Branch"
                        value={form.firmBranchId}
                        onChange={(e) => setForm((f) => ({ ...f, firmBranchId: e.target.value }))}>
                  {activeBranches.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                </Select>
              </FormControl>
              <Stack direction="row" spacing={2}>
                <FormControl required sx={{ minWidth: 200 }}>
                  <InputLabel id="txn-label">Transaction type</InputLabel>
                  <Select labelId="txn-label" label="Transaction type"
                          value={form.transactionType} onChange={setField('transactionType')}>
                    <MenuItem value="PURCHASE">Purchase</MenuItem>
                    <MenuItem value="SALE">Sale</MenuItem>
                  </Select>
                </FormControl>
                <TextField label="Transaction value (NZD)" type="number"
                           value={form.transactionValueNzd} onChange={setField('transactionValueNzd')} fullWidth />
              </Stack>

              <Typography variant="subtitle1" sx={{ mt: 1 }}>Point of contact</Typography>
              <Divider />
              <Stack direction="row" spacing={2}>
                <TextField label="POC name" value={form.pocName} onChange={setField('pocName')} fullWidth />
                <TextField label="POC role" value={form.pocRole} onChange={setField('pocRole')} fullWidth />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField label="POC phone" value={form.pocPhone} onChange={setField('pocPhone')} fullWidth />
                <TextField label="POC email" type="email" value={form.pocEmail}
                           onChange={setField('pocEmail')} fullWidth />
              </Stack>
            </Stack>
          )}

          {step === 1 && (
            <Stack spacing={2}>
              <Typography variant="h6">Property</Typography>
              <Divider />
              <AddressCascadingFields
                value={form.property}
                onChange={(next) => setForm((f) => ({ ...f, property: { ...f.property, ...next } }))}
                required={{ region: true, district: true }}
              />
              <Stack direction="row" spacing={2}>
                <TextField label="Title reference (LINZ)" value={form.property.titleReference}
                           onChange={setNested('property', 'titleReference')} fullWidth />
                <TextField label="Land area (m²)" type="number" value={form.property.landAreaSqm}
                           onChange={setNested('property', 'landAreaSqm')} sx={{ width: 180 }} />
              </Stack>
              <TextField label="Legal description" value={form.property.legalDescription}
                         onChange={setNested('property', 'legalDescription')} multiline minRows={2} />
            </Stack>
          )}

          {step === 2 && (
            <Stack spacing={2}>
              <Typography variant="h6">Client</Typography>
              <Divider />
              <Stack direction="row" spacing={2}>
                <TextField label="Display name" value={form.client.displayName}
                           onChange={setNested('client', 'displayName')} fullWidth required />
                <FormControl sx={{ minWidth: 200 }} required>
                  <InputLabel id="client-type-label">Client type</InputLabel>
                  <Select labelId="client-type-label" label="Client type"
                          value={form.client.clientType} onChange={setNested('client', 'clientType')}>
                    <MenuItem value="INDIVIDUAL">Individual</MenuItem>
                    <MenuItem value="ENTITY">Entity</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField label="Email" type="email" value={form.client.email}
                           onChange={setNested('client', 'email')} fullWidth />
                <TextField label="Phone" value={form.client.phone}
                           onChange={setNested('client', 'phone')} fullWidth />
              </Stack>
            </Stack>
          )}

          {step === 3 && (
            <Stack spacing={2}>
              <Typography variant="h6">Documents</Typography>
              <Divider />
              {savedDeal ? (
                <Alert severity="success">
                  Draft saved as <strong>{savedDeal.reference ?? `#${savedDeal.id}`}</strong>.
                  Attach driver licences, passports, sale agreements, or other supporting documents below.
                </Alert>
              ) : (
                <Alert severity="info">Saving the draft so you can attach documents…</Alert>
              )}
              <DocumentUploader dealId={savedDeal?.id} canUpload={Boolean(savedDeal)} title="Deal documents" />
            </Stack>
          )}

          {step === 4 && (
            <Stack spacing={2}>
              <Typography variant="h6">Review</Typography>
              <Divider />
              <ReviewBlock title="Firm & branch">
                <ReviewRow label="Firm" value={activeFirms.find((f) => f.id === form.firmId)?.name} />
                <ReviewRow label="Branch" value={activeBranches.find((b) => b.id === form.firmBranchId)?.name} />
                <ReviewRow label="Transaction" value={`${form.transactionType}${form.transactionValueNzd ? ` · NZD ${form.transactionValueNzd}` : ''}`} />
                <ReviewRow label="POC" value={[form.pocName, form.pocRole, form.pocEmail].filter(Boolean).join(' · ')} />
              </ReviewBlock>
              <ReviewBlock title="Property">
                <ReviewRow label="Address" value={[form.property.addressLine1, form.property.suburb, form.property.district, form.property.region, form.property.postcode].filter(Boolean).join(', ')} />
                <ReviewRow label="Country" value={form.property.country} />
                <ReviewRow label="Title ref" value={form.property.titleReference} />
                <ReviewRow label="Land area" value={form.property.landAreaSqm && `${form.property.landAreaSqm} m²`} />
              </ReviewBlock>
              <ReviewBlock title="Client">
                <ReviewRow label="Name" value={form.client.displayName} />
                <ReviewRow label="Type" value={form.client.clientType} />
                <ReviewRow label="Contact" value={[form.client.email, form.client.phone].filter(Boolean).join(' · ')} />
              </ReviewBlock>
              <Alert severity="info">
                Submitting this deal will move it to <strong>SUBMITTED</strong>, locking it from further broker edits.
                You can also save it as a draft and submit later.
              </Alert>
            </Stack>
          )}

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </CardContent>
      </Card>

      <Stack direction="row" spacing={2} justifyContent="space-between">
        <Button onClick={() => navigate('/my-deals')} disabled={submitting}>Cancel</Button>
        <Stack direction="row" spacing={2}>
          <Button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || submitting}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="contained" onClick={handleNext} disabled={!stepValid() || submitting}>
              {submitting && step === 2 ? 'Saving draft…' : 'Next'}
            </Button>
          ) : (
            <>
              <Button variant="outlined" onClick={handleSaveDraft} disabled={submitting}>
                {savedDeal ? 'Open draft' : 'Save as draft'}
              </Button>
              <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit'}
              </Button>
            </>
          )}
        </Stack>
      </Stack>
    </Stack>
  );
}

function ReviewBlock({ title, children }) {
  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary">{title}</Typography>
      <Stack sx={{ mt: 0.5 }}>{children}</Stack>
    </Box>
  );
}

function ReviewRow({ label, value }) {
  return (
    <Stack direction="row" spacing={1} sx={{ py: 0.3 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110 }}>{label}</Typography>
      <Typography variant="body2">{value || '—'}</Typography>
    </Stack>
  );
}
