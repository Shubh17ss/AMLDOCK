import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl,
  IconButton, InputLabel, LinearProgress, ListItemIcon, ListItemText, Menu, MenuItem, Paper,
  Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip,
  Typography,
} from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined';
import {
  AUDIO_DOCUMENT_TYPES, DEAL_DOCUMENT_TYPES, DOCUMENT_TYPES, deleteDocument, documentTypeLabel, fetchDownloadUrl,
  listDealDocuments, listNodeDocuments, moveDocument, uploadToS3,
} from '../api/documents.js';
import { ACCEPTED_DOCUMENT_TYPES, nodeTypeLabel } from '../api/ownership.js';
import { useToast } from './ToastProvider.jsx';
import { CameraCaptureDialog } from './CameraCaptureDialog.jsx';
import { tokens } from '../theme/theme.js';
import { formatBytes, formatDateTime } from '../utils/formatters.js';

const MAX_BYTES = 25 * 1024 * 1024;

export function DocumentUploader({
  dealId,
  ownershipNodeId = null,
  /**
   * Document type values this node will accept, or undefined for no restriction. Narrows the
   * picker only — the server enforces the same list in presignUpload, because a restriction
   * that lives in a dropdown is a suggestion.
   */
  allowedTypes = undefined,
  /**
   * Lay out for a narrow container. MUI's breakpoints watch the viewport, so inside a 480px
   * drawer on a 1500px screen every `sm:` rule still fires and the table runs off the edge.
   * This is the container query the component cannot ask for itself.
   */
  compact = false,
  canUpload = true,
  /**
   * Show only the deal's own files — those with no ownership node behind them. The server's
   * deal-scoped list returns everything filed against the deal, party evidence included
   * (DocumentService.listForDeal), which is the right answer for a document index and the wrong
   * one for a panel that is meant to be the deal's counterpart to a node's own list. Filtered
   * here rather than through a new endpoint so the ['documents', dealId] cache and every
   * invalidation of it keep working.
   *
   * Ignored when the uploader is node-scoped, where the question does not arise.
   */
  dealOnly = false,
  title = 'Documents',
  /** Receives the whole document row, ready to hand to DocumentViewerDialog. */
  onViewDocument = null,
  hideVoiceNotes = false,
  scrollTable = false,
  /**
   * The documents a past version was signed off with, already filtered to this scope. Supplying
   * it turns off the live query and every way of adding to the list: a version is a record of a
   * moment, and a file uploaded into it now was not part of that moment.
   */
  frozenDocuments = null,
  /**
   * The other owners on the deal, `[{ id, displayName, nodeType }]`, that a document filed here
   * may be moved to. Null turns Move off — the deal-level panel has no owner to move from.
   */
  moveTargets = null,
  /** Offer the property (the deal's own documents) as a place to move to — set on owner tabs. */
  canMoveToProperty = false,
}) {
  const qc = useQueryClient();
  const inputRef = useRef(null);
  const [documentType, setDocumentType] = useState('OTHER');
  const typeOptions = allowedTypes
    ? DOCUMENT_TYPES.filter((t) => allowedTypes.includes(t.value))
    : DOCUMENT_TYPES;
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null); // { name, phase, percent }
  const [cameraOpen, setCameraOpen] = useState(false);
  const [moving, setMoving] = useState(null); // the document row being moved

  const isNodeScoped = ownershipNodeId != null;
  const listKey = isNodeScoped ? ['documents', 'node', ownershipNodeId] : ['documents', dealId];
  const listQ = useQuery({
    queryKey: listKey,
    queryFn: () => (isNodeScoped ? listNodeDocuments(ownershipNodeId) : listDealDocuments(dealId)),
    enabled: Boolean(isNodeScoped ? ownershipNodeId : dealId) && !frozenDocuments,
  });
  const source = frozenDocuments ?? listQ.data;
  const mayUpload = canUpload && !frozenDocuments;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: listKey });
    // Always invalidate the deal-level list so the PDF viewer dropdown updates.
    if (dealId) qc.invalidateQueries({ queryKey: ['documents', dealId] });
    // Adding or removing an owner's evidence withdraws their verification on the server, so the
    // tree, the registers and the verification trail all need re-reading.
    if (dealId) qc.invalidateQueries({ queryKey: ['ownership', dealId] });
    qc.invalidateQueries({ queryKey: ['individuals'] });
    qc.invalidateQueries({ queryKey: ['verificationTrail'] });
  };

  const uploadMut = useMutation({
    mutationFn: async (file) => {
      setProgress({ name: file.name, phase: 'presign', percent: 0 });
      return uploadToS3({
        file, documentType, dealId, ownershipNodeId,
        onProgress: ({ phase, percent }) => setProgress({ name: file.name, phase, percent }),
      });
    },
    onSuccess: () => {
      setError(null);
      setProgress(null);
      invalidate();
      if (inputRef.current) inputRef.current.value = '';
    },
    onError: (e) => {
      setProgress(null);
      setError(e.response?.data?.message || e.message || 'Upload failed');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => deleteDocument(id),
    onSuccess: invalidate,
    onError: (e) => setError(e.response?.data?.message || 'Delete failed'),
  });

  const validateAndUpload = (file) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(`File exceeds ${formatBytes(MAX_BYTES)} limit`);
      return;
    }
    uploadMut.mutate(file);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    validateAndUpload(file);
    if (file && file.size > MAX_BYTES) e.target.value = '';
  };

  const handleCameraCapture = (file) => {
    validateAndUpload(file);
  };

  // Optionally drop voice notes — some screens surface them separately (e.g. a Broker
  // notes card) and don't want them repeated in the document table.
  const rows = (source ?? [])
    .filter((d) => !(hideVoiceNotes && AUDIO_DOCUMENT_TYPES.includes(d.documentType)))
    // Applies to a frozen list as well as a live one: a version's deal panel should show the
    // deal's own files as they were signed off, not the whole snapshot.
    .filter((d) => !dealOnly || isNodeScoped || d.ownershipNodeId == null);

  /**
   * A node's list also carries the ID scans of the person behind it, which live on the person
   * rather than on the node. Those are not deletable from here: removing the last one takes the
   * person — and the node being edited — with it, which is not what a delete icon on a document
   * row looks like it will do. The broker's ID list is where that action reads as what it is.
   */
  const isDeletableHere = (d) =>
    !isNodeScoped || d.ownershipNodeId === ownershipNodeId;

  // Owners this document could go to: the node's type has to take that document, the same rule
  // the server applies on upload and on a move.
  //
  // Each target carries a string key, because a Select cannot hold null: 'property' for the deal,
  // otherwise the node id.
  const targetsFor = (d) => {
    const owners = (moveTargets ?? [])
      .filter((n) => {
        const accepted = ACCEPTED_DOCUMENT_TYPES[n.nodeType];
        return !accepted || accepted.includes(d.documentType);
      })
      .map((n) => ({ key: String(n.id), nodeId: n.id, label: n.displayName, sub: nodeTypeLabel(n.nodeType) }));
    const property = canMoveToProperty && DEAL_DOCUMENT_TYPES.includes(d.documentType)
      ? [{ key: 'property', nodeId: null, label: 'Property — deal documents', sub: 'The deal itself' }]
      : [];
    return [...property, ...owners];
  };

  // What may move from this list: a document filed on this owner, or — on the deal's own list —
  // a property document. ID scans hang off the person and stay where they are.
  const isMovableHere = (d) => (isNodeScoped
    ? d.ownershipNodeId === ownershipNodeId
    : d.ownershipNodeId == null && d.beneficialOwnerId == null);

  const handleDownload = async (id) => {
    try {
      const { downloadUrl } = await fetchDownloadUrl(id);
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e.response?.data?.message || 'Could not get download link');
    }
  };

  return (
    <Stack spacing={2}>
      <Stack
        direction={compact ? 'column' : { xs: 'column', sm: 'row' }}
        justifyContent={compact ? undefined : { sm: 'space-between' }}
        alignItems={compact ? 'stretch' : { sm: 'center' }}
        spacing={compact ? 1.5 : { xs: 1.5, sm: 0 }}
      >
        <Typography variant="subtitle1">{title}</Typography>
        {mayUpload && (
          <Stack
            direction={compact ? 'column' : { xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={compact ? 'stretch' : { sm: 'center' }}
            sx={{ width: compact ? '100%' : { xs: '100%', sm: 'auto' } }}
          >
            <FormControl size="small"
                         sx={{ minWidth: compact ? 0 : { sm: 200 },
                               width: compact ? '100%' : { xs: '100%', sm: 'auto' } }}>
              <InputLabel id="doc-type-label">Document type</InputLabel>
              <Select labelId="doc-type-label" label="Document type"
                      value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
                {typeOptions.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={<CloudUploadIcon />}
              onClick={() => inputRef.current?.click()}
              disabled={uploadMut.isPending || !dealId}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              {uploadMut.isPending ? 'Uploading…' : 'Upload'}
            </Button>
            <Tooltip title="Capture with camera">
              <span style={{ width: 'inherit' }}>
                <Button
                  variant="outlined"
                  startIcon={<CameraAltIcon />}
                  onClick={() => setCameraOpen(true)}
                  disabled={uploadMut.isPending || !dealId}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Camera
                </Button>
              </span>
            </Tooltip>
            <input ref={inputRef} type="file" hidden onChange={handleFile} />
          </Stack>
        )}
      </Stack>

      {!dealId && (
        <Alert severity="info">Save the deal as a draft before uploading documents.</Alert>
      )}

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {progress && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2"><strong>{progress.name}</strong></Typography>
              <Typography variant="body2" sx={{ color: tokens.muted }}>
                {progress.phase === 'presign' && 'Preparing…'}
                {progress.phase === 'upload' && `Uploading ${progress.percent}%`}
                {progress.phase === 'confirm' && 'Confirming…'}
                {progress.phase === 'done' && 'Done'}
              </Typography>
            </Stack>
            <LinearProgress
              variant={progress.phase === 'upload' ? 'determinate' : 'indeterminate'}
              value={progress.percent}
            />
          </Stack>
        </Paper>
      )}

      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{
          ...(scrollTable ? { maxHeight: 420 } : null),
          // Wide content scrolls inside its own box; the panel around it never does.
          overflowX: 'auto',
        }}
      >
        {/* One line per document. A narrow drawer scrolls the table sideways rather than
            folding a filename or a date onto three lines. */}
        <Table size="small" stickyHeader={scrollTable}
               sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
          <TableHead>
            <TableRow>
              <TableCell>File</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Uploaded by</TableCell>
              <TableCell>Uploaded</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Tooltip title={d.originalFilename}>
                      <Box component="span" sx={{
                        display: 'inline-block', maxWidth: 220, verticalAlign: 'bottom',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {d.originalFilename}
                      </Box>
                    </Tooltip>
                    {d.idSide && (
                      <Chip size="small" variant="outlined"
                            label={d.idSide === 'BACK' ? 'back' : 'front'} />
                    )}
                  </Stack>
                </TableCell>
                <TableCell><Chip size="small" label={documentTypeLabel(d.documentType)} /></TableCell>
                <TableCell>{formatBytes(d.sizeBytes)}</TableCell>
                <TableCell>{d.uploadedByName || d.uploadedByEmail || '—'}</TableCell>
                <TableCell>{formatDateTime(d.createdAt) ?? '—'}</TableCell>
                <TableCell align="right">
                  <DocumentRowMenu
                    doc={d}
                    onView={onViewDocument ? () => onViewDocument(d) : null}
                    onDownload={() => handleDownload(d.id)}
                    onMove={mayUpload && isMovableHere(d) && targetsFor(d).length > 0
                      ? () => setMoving(d) : null}
                    onDelete={mayUpload && isDeletableHere(d) ? () => deleteMut.mutate(d.id) : null}
                    deleteBlocked={mayUpload && !isDeletableHere(d)}
                    deleting={deleteMut.isPending}
                  />
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3, color: tokens.muted }}>
                  No documents yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {moving && (
        <MoveDocumentDialog
          doc={moving}
          targets={targetsFor(moving)}
          onClose={() => setMoving(null)}
          onMoved={(target) => {
            invalidate();
            if (target.nodeId != null) {
              qc.invalidateQueries({ queryKey: ['documents', 'node', target.nodeId] });
            }
            setMoving(null);
          }}
        />
      )}

      <CameraCaptureDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
        suggestedName={documentType?.toLowerCase()}
      />
    </Stack>
  );
}

/**
 * A document row's actions behind one button, like the registers' row menus. Items that do not
 * apply are hidden; the one exception is Delete on an ID scan, kept and disabled with the reason,
 * because a missing Delete would read as a bug.
 */
function DocumentRowMenu({ doc, onView, onDownload, onMove, onDelete, deleteBlocked, deleting }) {
  const [anchor, setAnchor] = useState(null);
  const close = () => setAnchor(null);
  const run = (fn) => () => { close(); fn(); };

  return (
    <>
      <Tooltip title="Actions">
        <IconButton size="small" aria-label={`Actions for ${doc.originalFilename}`}
                    onClick={(e) => setAnchor(e.currentTarget)}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu open={Boolean(anchor)} anchorEl={anchor} onClose={close}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        {onView && (
          <MenuItem onClick={run(onView)}>
            <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>
            <ListItemText>View</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={run(onDownload)}>
          <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Download</ListItemText>
        </MenuItem>
        {onMove && (
          <MenuItem onClick={run(onMove)}>
            <ListItemIcon><DriveFileMoveOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Move document…</ListItemText>
          </MenuItem>
        )}
        {onDelete && (
          <MenuItem onClick={run(onDelete)} disabled={deleting} sx={{ color: tokens.rejected }}>
            <ListItemIcon><DeleteOutlineIcon fontSize="small" sx={{ color: tokens.rejected }} /></ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        )}
        {deleteBlocked && (
          <MenuItem disabled sx={{ whiteSpace: 'normal', maxWidth: 280 }}>
            <ListItemIcon><DeleteOutlineIcon fontSize="small" /></ListItemIcon>
            <ListItemText
              primary="Delete"
              secondary="An ID scan from the deal form. Remove it there — deleting the last one removes the person."
            />
          </MenuItem>
        )}
      </Menu>
    </>
  );
}

/** Moves one document to one other owner on the deal. */
function MoveDocumentDialog({ doc, targets, onClose, onMoved }) {
  const { showToast } = useToast();
  const [targetKey, setTargetKey] = useState('');
  const [error, setError] = useState(null);
  const target = targets.find((t) => t.key === targetKey) ?? null;

  const mut = useMutation({
    mutationFn: () => moveDocument(doc.id, target.nodeId),
    onSuccess: () => {
      showToast({
        severity: 'success',
        message: `Moved to ${target.nodeId == null ? 'the property' : target.label}`,
      });
      onMoved(target);
    },
    onError: (e) => setError(e.response?.data?.message || 'That didn’t go through. Try again.'),
  });

  return (
    <Dialog open onClose={mut.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle component="div" sx={{ pb: 1 }}>
        <Typography variant="h6" component="h2">Move document</Typography>
        <Typography sx={{ fontSize: '0.85rem', color: tokens.muted, mt: 0.5, overflowWrap: 'anywhere' }}>
          {doc.originalFilename}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 1 }}>
          <InputLabel id="move-target-label">Move to</InputLabel>
          <Select
            labelId="move-target-label"
            label="Move to"
            value={targetKey}
            onChange={(e) => { setTargetKey(e.target.value); setError(null); }}
          >
            {targets.map((t) => (
              <MenuItem key={t.key} value={t.key}>
                <ListItemText primary={t.label} secondary={t.sub} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="caption" sx={{ display: 'block', color: tokens.muted, mt: 1.5 }}>
          Only places that can hold a {documentTypeLabel(doc.documentType).toLowerCase()} are listed.
          Moving it clears the verification on any owner involved, if they&apos;re verified.
        </Typography>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={mut.isPending}>Cancel</Button>
        <Button variant="contained" disabled={!target || mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? 'Moving…' : 'Move'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
