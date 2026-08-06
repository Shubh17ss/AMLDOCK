import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Badge, Box, Button, Collapse, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, LinearProgress, MenuItem, Select, Slide, Stack, Tab, Tabs,
  TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { createSuspiciousActivityWithDocument } from '../../api/suspiciousActivities.js';
import { RED_FLAGS } from '../../data/redFlags.js';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { useCurrency } from '../../dashboard/useCurrency.js';
import { useToast } from '../../components/ToastProvider.jsx';
import { tokens } from '../../theme/theme.js';

// The supporting document is PDF-only, matching the server-side content-type guard.
const PDF_MIME = 'application/pdf';

const emptyForm = () => ({
  suspicionType: 'ACTIVITY',
  amount: '',
  name: '',
  dateOfSuspicion: '',
  redFlag: '',
  reference: '',
  description: '',
  actionTaken: '',
});

/**
 * The panel that isn't showing is taken out of the layout but stays mounted, so switching tabs
 * never loses what's already been typed.
 */
const panelSx = (active) => (active
  ? { position: 'relative' }
  : { position: 'absolute', top: 0, left: 0, right: 0 });

/**
 * "Potential Suspicion" — logs one entry into the Suspicious Activity Register in the
 * firm/branch scope currently selected in the sidebar. The form is split across two sliding
 * tabs: Details, and the optional supporting PDF on Documents. The entry saves first and the
 * file is attached afterwards.
 */
export function AddSuspiciousActivityDialog({ open, onClose }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { firm, branch } = useDashboardScope();
  const money = useCurrency();
  const fileInputRef = useRef(null);
  const slideRef = useRef(null);
  const [tab, setTab] = useState('details');
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  // Start clean every time the dialog opens.
  useEffect(() => {
    if (open) {
      setTab('details');
      setForm(emptyForm());
      setFile(null);
      setProgress(null);
      setError(null);
    }
  }, [open]);

  const ch = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const isTransaction = form.suspicionType === 'TRANSACTION';

  const mut = useMutation({
    // The entry lands in the register currently selected in the sidebar: a selected branch
    // tags it branch-specific, otherwise it's firm-wide.
    mutationFn: () => createSuspiciousActivityWithDocument({
      suspicionType: form.suspicionType,
      amount: isTransaction ? form.amount : null,
      name: form.name.trim(),
      dateOfSuspicion: form.dateOfSuspicion,
      redFlag: form.redFlag,
      reference: form.reference.trim(),
      description: form.description.trim(),
      actionTaken: form.actionTaken.trim(),
      realEstateFirmId: firm?.id,
      firmBranchId: branch?.id,
      file,
      onProgress: setProgress,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suspiciousActivities'] });
      showToast({ severity: 'success', message: 'Suspicion recorded' });
      onClose();
    },
    onError: (e) => {
      setProgress(null);
      setError(e.response?.data?.message || 'Could not save the entry. Try again.');
      setTab('details');
    },
  });

  const pickFile = (f) => {
    if (!f) return;
    const isPdf = f.type === PDF_MIME || /\.pdf$/i.test(f.name);
    if (!isPdf) {
      setError('Only PDF files can be uploaded.');
      return;
    }
    setError(null);
    setFile(f);
  };

  const close = () => { if (!mut.isPending) onClose(); };

  const submittable = form.name.trim()
    && form.dateOfSuspicion
    && form.redFlag
    && form.description.trim()
    && (!isTransaction || (form.amount !== '' && Number(form.amount) >= 0));

  const submit = (e) => {
    e.preventDefault();
    if (submittable) {
      mut.mutate();
    } else {
      // Everything that can be missing lives on the Details tab — show it rather than
      // leaving the user staring at an inert button on Documents.
      setTab('details');
    }
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      {/* noValidate: the inactive panel stays mounted, and the browser refuses to submit a form
          containing a hidden required control. The `submittable` guard is the real gate. */}
      <Box component="form" noValidate onSubmit={submit}>
        <DialogTitle sx={{ pb: 1 }}>Potential Suspicion</DialogTitle>

        <Box sx={{ px: 3 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label="Details" value="details" />
            <Tab
              value="documents"
              label={(
                <Badge
                  color="primary"
                  badgeContent={file ? 1 : 0}
                  sx={{ '& .MuiBadge-badge': { right: -12, top: 2 } }}
                >
                  Documents
                </Badge>
              )}
            />
          </Tabs>
        </Box>

        <DialogContent sx={{ overflowX: 'hidden' }}>
          <Box ref={slideRef} sx={{ position: 'relative', minHeight: 300 }}>
            {/* Details slides back in from the left; Documents comes in from the right. */}
            <Slide
              direction="right"
              in={tab === 'details'}
              appear={false}
              container={slideRef.current}
            >
              <Box sx={panelSx(tab === 'details')}>
                <Stack spacing={2} sx={{ mt: 1 }}>
                  <FormControl fullWidth required>
                    <InputLabel id="suspicion-type-label">Type</InputLabel>
                    <Select
                      labelId="suspicion-type-label"
                      label="Type"
                      value={form.suspicionType}
                      onChange={ch('suspicionType')}
                    >
                      <MenuItem value="ACTIVITY">Activity</MenuItem>
                      <MenuItem value="TRANSACTION">Transaction</MenuItem>
                    </Select>
                  </FormControl>

                  {/* An amount only makes sense for a transaction. */}
                  <Collapse in={isTransaction} unmountOnExit>
                    <TextField
                      label={`Amount (${money.label})`}
                      type="number"
                      value={form.amount}
                      onChange={ch('amount')}
                      inputProps={{ min: 0, step: '0.01' }}
                      required
                      fullWidth
                    />
                  </Collapse>

                  <TextField
                    label="Name"
                    value={form.name}
                    onChange={ch('name')}
                    placeholder="Person or entity the suspicion concerns"
                    required
                    fullWidth
                  />

                  <TextField
                    label="Date of suspicion"
                    type="date"
                    value={form.dateOfSuspicion}
                    onChange={ch('dateOfSuspicion')}
                    InputLabelProps={{ shrink: true }}
                    required
                    fullWidth
                  />

                  <FormControl fullWidth required>
                    <InputLabel id="red-flag-label">Red flag</InputLabel>
                    <Select
                      labelId="red-flag-label"
                      label="Red flag"
                      value={form.redFlag}
                      onChange={ch('redFlag')}
                    >
                      {RED_FLAGS.map((f) => (
                        <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    label="Reference"
                    value={form.reference}
                    onChange={ch('reference')}
                    placeholder="Submission Reference Number"
                    fullWidth
                  />

                  <TextField
                    label="Description"
                    value={form.description}
                    onChange={ch('description')}
                    multiline
                    minRows={3}
                    required
                    fullWidth
                  />

                  <TextField
                    label="Action taken"
                    value={form.actionTaken}
                    onChange={ch('actionTaken')}
                    multiline
                    minRows={3}
                    fullWidth
                  />
                </Stack>
              </Box>
            </Slide>

            <Slide
              direction="left"
              in={tab === 'documents'}
              appear={false}
              container={slideRef.current}
            >
              <Box sx={panelSx(tab === 'documents')}>
                <Stack spacing={2} sx={{ mt: 1 }}>
                  <Typography sx={{ fontSize: '0.85rem', color: tokens.muted }}>
                    Attach the supporting document for this suspicion. Optional — the entry is
                    recorded either way, and a file can replace an earlier one at any time.
                  </Typography>

                  {/* Dropzone — optional supporting PDF */}
                  <Box
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      pickFile(e.dataTransfer.files?.[0]);
                    }}
                    sx={{
                      border: `1.5px dashed ${dragOver ? tokens.blue : tokens.hairline2}`,
                      borderRadius: '14px',
                      backgroundColor: dragOver ? tokens.blueWash : tokens.tileRaised,
                      p: 4, textAlign: 'center', cursor: 'pointer',
                      transition: 'border-color 0.15s ease, background-color 0.15s ease',
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      hidden
                      accept="application/pdf,.pdf"
                      onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }}
                    />
                    <UploadFileIcon sx={{ fontSize: 34, color: file ? tokens.approved : tokens.muted }} />
                    <Typography sx={{ mt: 1, fontWeight: 600, fontSize: '0.9rem', color: tokens.ink }}>
                      {file ? file.name : 'Drag and drop a PDF here or click to browse'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: tokens.muted, mt: 0.5 }}>
                      {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Optional — PDF only, up to 25 MB'}
                    </Typography>
                    <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1.5 }}>
                      <Button
                        size="small"
                        variant={file ? 'outlined' : 'contained'}
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      >
                        {file ? 'Replace file' : 'Select file'}
                      </Button>
                      {file && (
                        <Button
                          size="small"
                          color="error"
                          onClick={(e) => { e.stopPropagation(); setFile(null); }}
                        >
                          Remove
                        </Button>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </Box>
            </Slide>
          </Box>

          {progress && mut.isPending && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress
                variant={progress.phase === 'upload' ? 'determinate' : 'indeterminate'}
                value={progress.percent}
                sx={{ borderRadius: 999, height: 6 }}
              />
              <Typography sx={{ mt: 0.5, fontSize: '0.72rem', color: tokens.muted }}>
                {progress.phase === 'upload' ? `Uploading PDF… ${progress.percent}%` : 'Saving…'}
              </Typography>
            </Box>
          )}

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>

        <DialogActions>
          <Button onClick={close} disabled={mut.isPending}>Cancel</Button>
          <Button type="submit" variant="contained" startIcon={<AddIcon />}
                  disabled={mut.isPending || !submittable}>
            {mut.isPending ? 'Saving…' : 'Record suspicion'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
