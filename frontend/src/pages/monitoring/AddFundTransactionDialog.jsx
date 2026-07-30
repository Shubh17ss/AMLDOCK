import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl,
  InputLabel, LinearProgress, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { createFundTransactionWithDocument } from '../../api/fundTransactions.js';
import { CountrySelect } from '../../components/CountrySelect.jsx';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { tokens } from '../../theme/theme.js';

// The supporting document is PDF-only, matching the server-side content-type guard.
const PDF_MIME = 'application/pdf';

const emptyForm = () => ({
  dealReference: '',
  listingAddress: '',
  transactionFlow: 'INWARDS',
  transactionDate: '',
  amountNzd: '',
  overseasJurisdiction: null,
  submissionReference: '',
});

/**
 * "Add International Fund Transaction" — logs one transfer into the register in the firm/branch
 * scope currently selected in the sidebar. The PDF is optional: the entry saves first and the
 * file is attached afterwards.
 */
export function AddFundTransactionDialog({ open, onClose }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { firm, branch } = useDashboardScope();
  const fileInputRef = useRef(null);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  // Start clean every time the dialog opens.
  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setFile(null);
      setProgress(null);
      setError(null);
    }
  }, [open]);

  const ch = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const mut = useMutation({
    // The entry lands in the register currently selected in the sidebar: a selected branch
    // tags it branch-specific, otherwise it's firm-wide.
    mutationFn: () => createFundTransactionWithDocument({
      dealReference: form.dealReference.trim(),
      listingAddress: form.listingAddress.trim(),
      transactionFlow: form.transactionFlow,
      transactionDate: form.transactionDate,
      amountNzd: form.amountNzd,
      overseasJurisdiction: form.overseasJurisdiction,
      submissionReference: form.submissionReference.trim(),
      realEstateFirmId: firm?.id,
      firmBranchId: branch?.id,
      file,
      onProgress: setProgress,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fundTransactions'] });
      showToast({ severity: 'success', message: 'International fund transaction recorded' });
      onClose();
    },
    onError: (e) => {
      setProgress(null);
      setError(e.response?.data?.message || 'Could not save the transaction. Try again.');
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

  const submittable = form.listingAddress.trim()
    && form.transactionDate
    && form.amountNzd !== ''
    && Number(form.amountNzd) >= 0
    && form.overseasJurisdiction;

  const submit = (e) => { e.preventDefault(); if (submittable) mut.mutate(); };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>Add International Fund Transaction</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Deal"
              value={form.dealReference}
              onChange={ch('dealReference')}
              placeholder="Deal name or reference"
              fullWidth
            />
            <TextField
              label="Listing address"
              value={form.listingAddress}
              onChange={ch('listingAddress')}
              required
              fullWidth
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth required>
                <InputLabel id="flow-label">Transaction flow</InputLabel>
                <Select
                  labelId="flow-label"
                  label="Transaction flow"
                  value={form.transactionFlow}
                  onChange={ch('transactionFlow')}
                >
                  <MenuItem value="INWARDS">Inwards</MenuItem>
                  <MenuItem value="OUTWARDS">Outwards</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Date"
                type="date"
                value={form.transactionDate}
                onChange={ch('transactionDate')}
                InputLabelProps={{ shrink: true }}
                required
                fullWidth
              />
            </Stack>

            <TextField
              label="Amount (NZD $)"
              type="number"
              value={form.amountNzd}
              onChange={ch('amountNzd')}
              inputProps={{ min: 0, step: '0.01' }}
              required
              fullWidth
            />

            <CountrySelect
              label="Overseas jurisdiction"
              value={form.overseasJurisdiction}
              onChange={(code) => setForm((f) => ({ ...f, overseasJurisdiction: code }))}
              required
            />

            <TextField
              label="Submission reference number"
              value={form.submissionReference}
              onChange={ch('submissionReference')}
              fullWidth
            />

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
                backgroundColor: dragOver ? tokens.blueWash : '#FBFCFE',
                p: 3, textAlign: 'center', cursor: 'pointer',
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
              {!file && (
                <Button size="small" variant="contained" sx={{ mt: 1.5 }}
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                  Select file
                </Button>
              )}
            </Box>

            {progress && mut.isPending && (
              <Box>
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

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={mut.isPending}>Cancel</Button>
          <Button type="submit" variant="contained" startIcon={<AddIcon />}
                  disabled={mut.isPending || !submittable}>
            {mut.isPending ? 'Saving…' : 'Add transaction'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
