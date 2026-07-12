import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, CardContent, Divider, FormControl, InputLabel, MenuItem,
  Select, Stack, Step, StepLabel, Stepper, TextField, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { listFirms, listBranches } from '../api/firms.js';
import { createDeal, submitDeal, updateDeal } from '../api/deals.js';
import { uploadToS3 } from '../api/documents.js';
import { AddressCascadingFields } from '../components/AddressCascadingFields.jsx';
import { DocumentUploader } from '../components/DocumentUploader.jsx';
import { VoiceRecorderField } from '../components/VoiceRecorderField.jsx';
import { LoadingOverlay } from '../components/LoadingOverlay.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { isDealAuthor } from '../auth/roles.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { tokens } from '../theme/theme.js';

// Deal-status notifications sit top-centre so they read as a prominent, page-level result
// rather than an incidental corner toast.
const TOP_CENTER = { vertical: 'top', horizontal: 'center' };

const NEU_ACCENT = tokens.blue;
const NEU_MUTED  = tokens.muted;
const INSET_SM   = 'inset 0 1px 2px rgba(16,24,40,0.06)';

const STEPS = ['Entity + branch', 'Property', 'Client', 'Documents', 'Review'];

const EMPTY_FORM = {
  firmId: '',
  firmBranchId: '',
  transactionType: 'PURCHASE',
  transactionValueNzd: '',
  pocName: '',
  pocRole: '',
  pocPhone: '',
  pocEmail: '',
  notes: '',
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
  const { user } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [overlay, setOverlay] = useState(null); // { title, subText } | null — full-page blur
  const [savedDeal, setSavedDeal] = useState(null);
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [voiceUploaded, setVoiceUploaded] = useState(false);

  const brokerLocked = isDealAuthor(user?.role) && Boolean(user.firmBranchId);

  const firmsQ = useQuery({ queryKey: ['firms'], queryFn: listFirms });
  const activeFirms = useMemo(() => (firmsQ.data ?? []).filter((f) => f.active), [firmsQ.data]);

  const branchesQ = useQuery({
    queryKey: ['firms', form.firmId, 'branches'],
    queryFn: () => listBranches(form.firmId),
    enabled: Boolean(form.firmId),
  });
  const activeBranches = useMemo(() => (branchesQ.data ?? []).filter((b) => b.active), [branchesQ.data]);

  // Each step change returns the user to the top of the form (the whole page scrolls via the
  // window in AppShell) so they start reading a fresh step from its heading.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  useEffect(() => {
    if (!brokerLocked) return;
    if (form.firmId || form.firmBranchId) return;
    setForm((f) => ({
      ...f,
      firmId: user.realEstateFirmId,
      firmBranchId: user.firmBranchId,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brokerLocked]);

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
    if (step === 0) return form.firmId && form.firmBranchId && form.transactionType;
    if (step === 1) return form.property.addressLine1 && form.property.region && form.property.district;
    if (step === 2) return form.client.displayName && form.client.clientType;
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
    notes: form.notes || null,
    property: {
      ...form.property,
      landAreaSqm: form.property.landAreaSqm ? Number(form.property.landAreaSqm) : null,
    },
    client: { ...form.client },
  });

  const uploadVoiceIfPresent = async (dealId) => {
    if (!voiceBlob || voiceUploaded) return;
    const ext = (voiceBlob.type && voiceBlob.type.includes('webm')) ? 'webm' : 'audio';
    const filename = `voice-note-${Date.now()}.${ext}`;
    const file = new File([voiceBlob], filename, { type: voiceBlob.type || 'audio/webm' });
    try {
      await uploadToS3({ file, documentType: 'VOICE_NOTE', dealId });
      setVoiceUploaded(true);
      setVoiceBlob(null);
    } catch (e) {
      setError(`Deal saved but voice note upload failed: ${e.response?.data?.message || e.message}`);
    }
  };

  const persistDraft = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (savedDeal) {
        const updated = await updateDeal(savedDeal.id, { notes: form.notes || null });
        setSavedDeal(updated);
        return updated;
      }
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

  const handleNext = async () => {
    if (step === 2 && !savedDeal) {
      const created = await persistDraft();
      if (!created) return;
    }
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    setOverlay({
      title: 'Submitting deal',
      subText: 'Saving details, uploading attachments and sending the deal for review…',
    });
    try {
      const created = await persistDraft();
      if (!created) {
        showToast({ severity: 'error', message: error || 'Failed to submit', anchorOrigin: TOP_CENTER });
        return;
      }
      await uploadVoiceIfPresent(created.id);
      await submitDeal(created.id);
      showToast({ severity: 'success', message: 'Deal submitted for review', anchorOrigin: TOP_CENTER });
      navigate(`/deals/${created.id}`);
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to submit';
      setError(msg);
      showToast({ severity: 'error', message: msg, anchorOrigin: TOP_CENTER });
    } finally {
      setOverlay(null);
    }
  };

  return (
    <Stack spacing={3}>
      <LoadingOverlay open={Boolean(overlay)} title={overlay?.title} subText={overlay?.subText} />
      <PageHeader eyebrow={`step ${step + 1} of ${STEPS.length}`} title="New deal" />

      {/* Desktop: full MUI Stepper */}
      <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
        <Stepper activeStep={step} alternativeLabel>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel
                sx={{
                  '& .MuiStepLabel-label': { fontSize: '0.72rem', fontWeight: 600, mt: 0.5 },
                }}
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* Mobile: compact progress indicator */}
      <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
        <MobileStepIndicator step={step} total={STEPS.length} label={STEPS[step]} />
      </Box>

      <Card>
        <CardContent>
          {step === 0 && (
            <Stack spacing={2}>
              <Typography variant="h6">Firm, branch & point of contact</Typography>
              <Divider />
              {brokerLocked && (
                <Alert severity="info" sx={{ py: 0.5 }}>
                  You're scoped to a single reporting entity and branch — they're pre-filled and locked.
                  Ask an administrator if you need to be moved.
                </Alert>
              )}
              <FormControl fullWidth required disabled={brokerLocked}>
                <InputLabel id="firm-label">Reporting entity</InputLabel>
                <Select labelId="firm-label" label="Reporting entity"
                        value={form.firmId}
                        onChange={(e) => setForm((f) => ({ ...f, firmId: e.target.value, firmBranchId: '' }))}>
                  {activeFirms.map((f) => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth required disabled={brokerLocked || !form.firmId}>
                <InputLabel id="branch-label">Branch</InputLabel>
                <Select labelId="branch-label" label="Branch"
                        value={form.firmBranchId}
                        onChange={(e) => setForm((f) => ({ ...f, firmBranchId: e.target.value }))}>
                  {activeBranches.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                </Select>
              </FormControl>

              {/* Transaction type + value — column on mobile */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl fullWidth required>
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

              {/* POC name + role — column on mobile */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField label="POC name" value={form.pocName} onChange={setField('pocName')} fullWidth />
                <TextField label="POC role" value={form.pocRole} onChange={setField('pocRole')} fullWidth />
              </Stack>

              {/* POC phone + email — column on mobile */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
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

              {/* Title ref + land area — column on mobile */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField label="Title reference (LINZ)" value={form.property.titleReference}
                           onChange={setNested('property', 'titleReference')} fullWidth />
                <TextField label="Land area (m²)" type="number" value={form.property.landAreaSqm}
                           onChange={setNested('property', 'landAreaSqm')}
                           sx={{ width: { xs: '100%', sm: 180 } }} />
              </Stack>
              <TextField label="Legal description" value={form.property.legalDescription}
                         onChange={setNested('property', 'legalDescription')} multiline minRows={2} />
            </Stack>
          )}

          {step === 2 && (
            <Stack spacing={2}>
              <Typography variant="h6">Client</Typography>
              <Divider />

              {/* Display name + client type — column on mobile */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField label="Display name" value={form.client.displayName}
                           onChange={setNested('client', 'displayName')} fullWidth required />
                <FormControl fullWidth required>
                  <InputLabel id="client-type-label">Client type</InputLabel>
                  <Select labelId="client-type-label" label="Client type"
                          value={form.client.clientType} onChange={setNested('client', 'clientType')}>
                    <MenuItem value="INDIVIDUAL">Individual</MenuItem>
                    <MenuItem value="ENTITY">Entity</MenuItem>
                  </Select>
                </FormControl>
              </Stack>

              {/* Email + phone — column on mobile */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
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
              <ReviewBlock title="Entity & branch">
                <ReviewRow label="Reporting entity" value={activeFirms.find((f) => f.id === form.firmId)?.name} />
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

              <Divider />
              <Typography variant="h6">Notes & voice message</Typography>
              <Typography variant="caption" color="text.secondary">
                Anything compliance should know before reviewing — a quick context line, a flag,
                or a short voice memo. Voice notes stay local until you Save Draft or Submit.
              </Typography>
              <TextField
                label="Notes for compliance"
                value={form.notes}
                onChange={setField('notes')}
                multiline
                minRows={4}
                placeholder="e.g. Buyer's representative will follow up with the trust deed amendment by Friday."
              />
              <VoiceRecorderField
                value={voiceBlob}
                onChange={(blob) => { setVoiceBlob(blob); setVoiceUploaded(false); }}
                label="Voice message (optional)"
              />
              {voiceUploaded && <Alert severity="success">Voice note uploaded.</Alert>}

              <Alert severity="info">
                Submitting this deal will move it to <strong>SUBMITTED</strong>, locking it from further broker edits.
                Your progress is already saved as a draft, so you can leave and finish it later from <strong>My deals</strong>.
              </Alert>
            </Stack>
          )}

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </CardContent>
      </Card>

      {/* Action buttons — wrap on mobile */}
      <Stack
        direction={{ xs: 'column-reverse', sm: 'row' }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        {/* Wrapped in a Box using padding-top for the mobile gap: the parent Stack's
            `spacing` sets a margin on each direct child, which overrode the button's own `mt`.
            Padding isn't touched by Stack spacing, so it reliably adds space above. */}
        <Box sx={{ width: { xs: '100%', sm: 'auto' }, pt: { xs: 5, sm: 0 } }}>
          <Button
            onClick={() => navigate('/my-deals')}
            disabled={submitting}
            startIcon={<DeleteOutlineIcon />}
            sx={{
              width: { xs: '100%', sm: 'auto' },
              color: tokens.rejected,
              '&:hover': { backgroundColor: '#FCEAEA', color: tokens.rejected },
            }}
          >
            Discard
          </Button>
        </Box>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" justifyContent={{ xs: 'stretch', sm: 'flex-end' }}>
          <Button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || submitting}
            sx={{ flex: { xs: 1, sm: 'unset' } }}
          >
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={!stepValid() || submitting}
              sx={{ flex: { xs: 1, sm: 'unset' } }}
            >
              {submitting && step === 2 ? 'Saving draft…' : 'Next'}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting}
              sx={{ flex: { xs: 1, sm: 'unset' } }}
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </Button>
          )}
        </Stack>
      </Stack>
    </Stack>
  );
}

function MobileStepIndicator({ step, total, label }) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
        <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: NEU_MUTED, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Step {step + 1} of {total}
        </Typography>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: NEU_ACCENT }}>
          {label}
        </Typography>
      </Box>
      <Box sx={{ height: 6, borderRadius: 999, boxShadow: INSET_SM, overflow: 'hidden' }}>
        <Box sx={{
          height: '100%',
          width: `${((step + 1) / total) * 100}%`,
          backgroundColor: NEU_ACCENT,
          borderRadius: 999,
          transition: 'width 0.4s cubic-bezier(0.34, 1.2, 0.64, 1)',
        }} />
      </Box>
    </Box>
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
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0, sm: 1 }} sx={{ py: 0.3 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110, fontWeight: 600 }}>{label}</Typography>
      <Typography variant="body2">{value || '—'}</Typography>
    </Stack>
  );
}
