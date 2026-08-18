import { useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, FormControl, IconButton, InputLabel,
  LinearProgress, MenuItem, Select, Stack, Typography,
} from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import BadgeIcon from '@mui/icons-material/Badge';
import { CameraCaptureDialog } from '../../../components/CameraCaptureDialog.jsx';
import { ID_DOCUMENT_TYPES, uploadToS3, deleteDocument } from '../../../api/documents.js';
import { tokens, fonts } from '../../../theme/theme.js';

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * The client's identity documents — one row per scan, each tagged with its ID type.
 *
 * These are documents of natural persons. The entity that actually owns the property is
 * established later, during the ownership-structure review; nothing here tries to infer it.
 *
 * Each scan uploads the moment it is captured, because by this point in the form a dealId
 * exists to attach it to. DRIVER_LICENCE and PASSPORT are the OCR-eligible types, so the
 * backend queues each confirmed upload for extraction.
 *
 * Props:
 *   dealId    — required; the uploads have nowhere to go without it
 *   documents — already-uploaded ID documents for this deal (from listDealDocuments)
 *   onUploaded(doc) / onRemoved(id) — so the parent can refresh its list
 */
export function IdScanList({ dealId, documents = [], onUploaded, onRemoved }) {
  const [idType, setIdType] = useState('DRIVER_LICENCE');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [progress, setProgress] = useState(null); // { percent, phase }
  const [error, setError] = useState(null);
  const [removingId, setRemovingId] = useState(null);
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
        documentType: idType,
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
    e.target.value = ''; // so picking the same file twice still fires onChange
    if (file) upload(file);
  };

  const handleRemove = async (id) => {
    setRemovingId(id);
    setError(null);
    try {
      await deleteDocument(id);
      onRemoved?.(id);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not remove that scan');
    } finally {
      setRemovingId(null);
    }
  };

  const busy = Boolean(progress);

  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
        <FormControl sx={{ minWidth: { sm: 200 } }} size="small">
          <InputLabel id="id-type-label">ID type</InputLabel>
          <Select
            labelId="id-type-label"
            label="ID type"
            value={idType}
            onChange={(e) => setIdType(e.target.value)}
            disabled={busy}
          >
            {ID_DOCUMENT_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Stack direction="row" spacing={1} sx={{ flex: 1 }}>
          <Button
            variant="contained"
            startIcon={<CameraAltIcon />}
            onClick={() => setCameraOpen(true)}
            disabled={!dealId || busy}
            sx={{ flex: { xs: 1, sm: 'unset' } }}
          >
            Scan
          </Button>
          <Button
            variant="outlined"
            startIcon={<FolderOpenIcon />}
            onClick={() => fileRef.current?.click()}
            disabled={!dealId || busy}
            sx={{ flex: { xs: 1, sm: 'unset' } }}
          >
            Upload
          </Button>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept="image/*,application/pdf"
            onChange={handlePick}
          />
        </Stack>
      </Stack>

      <Typography variant="caption" sx={{ color: tokens.muted }}>
        Add one scan per identity document — a client with two forms of ID gets two rows.
        Set the ID type before each scan.
      </Typography>

      {busy && (
        <Box>
          <LinearProgress variant="determinate" value={progress.percent ?? 0} />
          <Typography variant="caption" sx={{ color: tokens.muted }}>
            {progress.phase === 'presign' && 'Preparing…'}
            {progress.phase === 'upload' && `Uploading ${progress.percent}%`}
            {progress.phase === 'confirm' && 'Finishing…'}
            {progress.phase === 'done' && 'Done'}
          </Typography>
        </Box>
      )}

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {documents.length === 0 ? (
        <Box
          sx={{
            border: `1px dashed ${tokens.hairline2}`, borderRadius: 2, p: 2,
            textAlign: 'center', color: tokens.muted,
          }}
        >
          <BadgeIcon sx={{ fontSize: '1.6rem', opacity: 0.5 }} />
          <Typography variant="body2">No ID scans yet</Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {documents.map((d) => (
            <Stack
              key={d.id}
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{
                px: 1.5, py: 1, borderRadius: 2,
                border: `1px solid ${tokens.hairline}`, backgroundColor: tokens.tileRaised,
              }}
            >
              <Chip
                size="small"
                label={d.documentType === 'PASSPORT' ? 'Passport' : 'Driver licence'}
                sx={{ fontFamily: fonts.mono, fontSize: '0.66rem' }}
              />
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                {d.originalFilename}
              </Typography>
              {removingId === d.id ? (
                <CircularProgress size={18} />
              ) : (
                <IconButton
                  size="small"
                  aria-label={`Remove ${d.originalFilename}`}
                  onClick={() => handleRemove(d.id)}
                  sx={{ color: tokens.muted, '&:hover': { color: tokens.rejected } }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
          ))}
        </Stack>
      )}

      <CameraCaptureDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={upload}
        suggestedName={idType.toLowerCase()}
      />
    </Stack>
  );
}
