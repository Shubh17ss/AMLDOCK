import { useRef, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, IconButton, InputAdornment, LinearProgress,
  Stack, TextField, Typography,
} from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { CameraCaptureDialog } from '../../../components/CameraCaptureDialog.jsx';
import { uploadToS3, deleteDocument } from '../../../api/documents.js';
import { tokens } from '../../../theme/theme.js';

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * One end of the broker's valuation range: the figure, plus an image backing it up (a CMA,
 * an appraisal, an RV screenshot).
 *
 * The evidence is a document like any other — which end it supports is carried by its
 * documentType (VALUATION_MIN_EVIDENCE / VALUATION_MAX_EVIDENCE) rather than by a separate
 * field, so every read surface can tell them apart with the discriminator it already filters on.
 *
 * Props:
 *   value / onChange  — the amount, as a string (the form keeps money as text until submit)
 *   documentType      — VALUATION_MIN_EVIDENCE | VALUATION_MAX_EVIDENCE
 *   evidence          — the already-uploaded evidence image for this end, if any
 *   currencyLabel     — e.g. "NZD $", from useCurrency
 */
export function ValuationField({
  label, value, onChange, documentType, dealId, evidence, onUploaded, onRemoved,
  currencyLabel = '$', helperText,
}) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(false);
  const fileRef = useRef(null);

  const upload = async (file) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(`"${file.name}" is larger than 25 MB.`);
      return;
    }
    try {
      const doc = await uploadToS3({
        file,
        documentType,
        dealId,
        onProgress: ({ percent, phase }) => setProgress({ percent, phase }),
      });
      onUploaded?.(doc);
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Upload failed');
    } finally {
      setProgress(null);
    }
  };

  const handlePick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) upload(file);
  };

  const handleRemove = async () => {
    if (!evidence) return;
    setRemoving(true);
    setError(null);
    try {
      await deleteDocument(evidence.id);
      onRemoved?.(evidence.id);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not remove that image');
    } finally {
      setRemoving(false);
    }
  };

  const busy = Boolean(progress);

  return (
    <Stack spacing={1.25}>
      <TextField
        label={label}
        type="number"
        inputMode="decimal"
        value={value}
        onChange={onChange}
        fullWidth
        helperText={helperText}
        InputProps={{
          startAdornment: <InputAdornment position="start">{currencyLabel}</InputAdornment>,
        }}
      />

      {evidence ? (
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{
            px: 1.5, py: 1, borderRadius: 2,
            border: `1px solid ${tokens.hairline}`, backgroundColor: tokens.tileRaised,
          }}
        >
          <ImageOutlinedIcon sx={{ color: tokens.muted, fontSize: '1.1rem' }} />
          <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
            {evidence.originalFilename}
          </Typography>
          {removing ? (
            <CircularProgress size={18} />
          ) : (
            <IconButton
              size="small"
              aria-label={`Remove evidence for ${label}`}
              onClick={handleRemove}
              sx={{ color: tokens.muted, '&:hover': { color: tokens.rejected } }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
      ) : (
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<CameraAltIcon />}
            onClick={() => setCameraOpen(true)}
            disabled={!dealId || busy}
            sx={{ flex: { xs: 1, sm: 'unset' } }}
          >
            Photograph evidence
          </Button>
          <Button
            size="small"
            startIcon={<FolderOpenIcon />}
            onClick={() => fileRef.current?.click()}
            disabled={!dealId || busy}
            sx={{ flex: { xs: 1, sm: 'unset' } }}
          >
            Upload
          </Button>
          <input ref={fileRef} type="file" hidden accept="image/*" onChange={handlePick} />
        </Stack>
      )}

      {busy && (
        <Box>
          <LinearProgress variant="determinate" value={progress.percent ?? 0} />
          <Typography variant="caption" sx={{ color: tokens.muted }}>
            {progress.phase === 'upload' ? `Uploading ${progress.percent}%` : 'Working…'}
          </Typography>
        </Box>
      )}

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <CameraCaptureDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={upload}
        suggestedName={documentType.toLowerCase()}
      />
    </Stack>
  );
}
