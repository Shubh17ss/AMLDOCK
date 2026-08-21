import { useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, FormControl, IconButton, InputLabel,
  LinearProgress, MenuItem, Select, Stack, Typography,
} from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import BadgeIcon from '@mui/icons-material/Badge';
import { CameraCaptureDialog } from '../../../components/CameraCaptureDialog.jsx';
import { IdExtractionSummary } from './IdExtractionSummary.jsx';
import {
  ID_DOCUMENT_TYPES, TYPES_WITH_BACK, documentTypeLabel, uploadToS3, deleteDocument,
} from '../../../api/documents.js';
import { tokens, fonts } from '../../../theme/theme.js';

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * The client's identity documents — one card per individual.
 *
 * <p>An identity document is a front and an optional back, and counts as <strong>one person</strong>.
 * Adding a back attaches to the individual already there; anything else starts a new one. Two IDs
 * therefore mean two individuals even when they name the same human — the app records documents,
 * and deciding two of them describe one person is a judgement made later, not by OCR.
 *
 * <p>Each image uploads the moment it is captured, because by this point in the form a dealId
 * exists to attach it to, and the individual appears as soon as the first image lands — before
 * Textract has read anything, and whether or not it ever succeeds.
 *
 * Props:
 *   dealId    — required; the uploads have nowhere to go without it
 *   documents — already-uploaded ID documents for this deal (from listDealDocuments)
 *   onUploaded(doc) / onRemoved(id) — so the parent can refresh its list
 */
export function IdScanList({ dealId, documents = [], onUploaded, onRemoved }) {
  const [idType, setIdType] = useState(ID_DOCUMENT_TYPES[0].value);
  // { ownerId, side } for an image being added to an existing person, or null for a new one.
  const [target, setTarget] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [progress, setProgress] = useState(null); // { percent, phase }
  const [error, setError] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const fileRef = useRef(null);

  // One entry per individual. Documents uploaded before V32 carry no owner, so they are grouped
  // under their own id and simply render as a lone front.
  const people = useMemo(() => {
    const byOwner = new Map();
    for (const d of documents) {
      const key = d.beneficialOwnerId ?? `doc-${d.id}`;
      if (!byOwner.has(key)) {
        byOwner.set(key, { key, ownerId: d.beneficialOwnerId ?? null, documentType: d.documentType });
      }
      byOwner.get(key)[d.idSide === 'BACK' ? 'back' : 'front'] = d;
    }
    return [...byOwner.values()];
  }, [documents]);

  const upload = async (file) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(`"${file.name}" is larger than 25 MB.`);
      return;
    }
    try {
      const doc = await uploadToS3({
        file,
        // Adding to an existing person keeps that person's document type; only a new individual
        // takes the type from the selector.
        documentType: target?.documentType ?? idType,
        dealId,
        beneficialOwnerId: target?.ownerId ?? null,
        idSide: target?.side ?? 'FRONT',
        onProgress: ({ percent, phase }) => setProgress({ percent, phase }),
      });
      onUploaded?.(doc);
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Upload failed');
    } finally {
      setProgress(null);
      setTarget(null);
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

  /** Opens the camera for a specific slot; null target means "start a new individual". */
  const capture = (next) => { setTarget(next); setCameraOpen(true); };
  const browse = (next) => { setTarget(next); fileRef.current?.click(); };

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
            onClick={() => capture(null)}
            disabled={!dealId || busy}
            sx={{ flex: { xs: 1, sm: 'unset' } }}
          >
            Scan
          </Button>
          <Button
            variant="outlined"
            startIcon={<FolderOpenIcon />}
            onClick={() => browse(null)}
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
        One card per person — add its back if it has one. A different ID is a different individual.
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

      {people.length === 0 ? (
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
          {people.map((person, i) => (
            <PersonCard
              key={person.key}
              index={i + 1}
              person={person}
              busy={busy}
              removingId={removingId}
              onRemove={handleRemove}
              onCapture={capture}
              onBrowse={browse}
            />
          ))}
        </Stack>
      )}

      <CameraCaptureDialog
        open={cameraOpen}
        onClose={() => { setCameraOpen(false); setTarget(null); }}
        onCapture={upload}
        suggestedName={`${(target?.documentType ?? idType).toLowerCase()}-${(target?.side ?? 'front').toLowerCase()}`}
      />
    </Stack>
  );
}

/** One individual: their card's two sides and whatever has been read off them. */
function PersonCard({ index, person, busy, removingId, onRemove, onCapture, onBrowse }) {
  const { ownerId, documentType, front, back } = person;
  // Non-blocking: a licence back carries the card version number that electronic verification
  // wants later, but a broker holding only the front must still be able to move on. Passports
  // are excluded because their photo page is the whole document.
  const suggestBack = TYPES_WITH_BACK.has(documentType) && front && !back;

  return (
    <Stack
      spacing={1}
      sx={{
        px: 1.5, py: 1.25, borderRadius: 2,
        border: `1px solid ${tokens.hairline}`, backgroundColor: tokens.tileRaised,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Chip
          size="small"
          label={documentTypeLabel(documentType)}
          sx={{ fontFamily: fonts.mono, fontSize: '0.66rem' }}
        />
        <Typography variant="body2" sx={{ flex: 1, color: tokens.muted }}>
          Individual {index}
        </Typography>
      </Stack>

      <SideRow
        label="Front"
        doc={front}
        busy={busy}
        removingId={removingId}
        onRemove={onRemove}
        onCapture={() => onCapture({ ownerId, side: 'FRONT', documentType })}
        onBrowse={() => onBrowse({ ownerId, side: 'FRONT', documentType })}
      />
      <SideRow
        label="Back"
        doc={back}
        busy={busy}
        removingId={removingId}
        onRemove={onRemove}
        onCapture={() => onCapture({ ownerId, side: 'BACK', documentType })}
        onBrowse={() => onBrowse({ ownerId, side: 'BACK', documentType })}
        optional
      />

      {suggestBack && (
        <Typography variant="caption" sx={{ color: tokens.muted }}>
          This card has a back — adding it now saves asking the client again later.
        </Typography>
      )}

      {/* What the server read off this person's card. Renders nothing until extraction starts. */}
      <IdExtractionSummary document={front ?? back} />
    </Stack>
  );
}

/** One slot: the captured image, or the two ways to fill it. */
function SideRow({ label, doc, busy, removingId, onRemove, onCapture, onBrowse, optional = false }) {
  if (doc) {
    return (
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Typography variant="caption" sx={{ color: tokens.muted, width: 44 }}>{label}</Typography>
        <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
          {doc.originalFilename}
        </Typography>
        {removingId === doc.id ? (
          <CircularProgress size={18} />
        ) : (
          <IconButton
            size="small"
            aria-label={`Remove ${doc.originalFilename}`}
            onClick={() => onRemove(doc.id)}
            sx={{ color: tokens.muted, '&:hover': { color: tokens.rejected } }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
    );
  }

  return (
    <Stack direction="row" alignItems="center" spacing={1.5}>
      <Typography variant="caption" sx={{ color: tokens.muted, width: 44 }}>{label}</Typography>
      <Button size="small" startIcon={<CameraAltIcon />} onClick={onCapture} disabled={busy}>
        Scan
      </Button>
      <Button size="small" startIcon={<FolderOpenIcon />} onClick={onBrowse} disabled={busy}>
        Upload
      </Button>
      {optional && (
        <Typography variant="caption" sx={{ color: tokens.muted }}>optional</Typography>
      )}
    </Stack>
  );
}
