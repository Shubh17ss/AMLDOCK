import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl,
  IconButton, InputLabel, LinearProgress, ListItemIcon, ListItemText, Menu, MenuItem, Paper,
  InputAdornment, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from '@mui/material';
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
import { ACCEPTED_DOCUMENT_TYPES } from '../api/ownership.js';
import { getDeal } from '../api/deals.js';
import { formatPropertyAddressShort } from '../data/addressFinderMeta.js';
import { useToast } from './ToastProvider.jsx';
import { EmptyState } from './EmptyState.jsx';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
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

  // The property is named by its address, as the app bar names it. The deal page already holds
  // this query, so it comes from cache.
  const dealQ = useQuery({
    queryKey: ['deals', dealId],
    queryFn: () => getDeal(dealId),
    enabled: canMoveToProperty && Boolean(dealId),
  });
  const propertyLabel = formatPropertyAddressShort(dealQ.data?.property) || 'Property';

  // Every place this document could go. Not narrowed by its current type: the move dialog asks
  // for the type after the place, from what that place takes, and the server checks the new type
  // — so a passport can still reach the property, refiled as something the property holds.
  //
  // Each target carries a string key, because a Select cannot hold null: 'property' for the deal,
  // otherwise the node id. `acceptedTypes` undefined means no restriction.
  const targetsFor = () => {
    const owners = (moveTargets ?? []).map((n) => ({
      key: String(n.id), nodeId: n.id, label: n.displayName,
      acceptedTypes: ACCEPTED_DOCUMENT_TYPES[n.nodeType],
    }));
    const property = canMoveToProperty
      ? [{ key: 'property', nodeId: null, label: propertyLabel, acceptedTypes: DEAL_DOCUMENT_TYPES }]
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
    <Stack spacing={5}>

      {/* Type and Upload on one line: the type is what the file is filed as, so it is chosen
          right beside the button that files it. */}
      {mayUpload && (
        <Stack direction="row" spacing={1.5} alignItems="center">
          {/* Two equal halves. */}
          <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
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
            sx={{ flex: 1, minWidth: 0, height: 40 }}
          >
            {uploadMut.isPending ? 'Uploading…' : 'Upload'}
          </Button>
          <input ref={inputRef} type="file" hidden onChange={handleFile} />
        </Stack>
      )}

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

      {/* With no upload row (a verified or closed deal, a version, a read-only viewer) an empty
          list would otherwise leave the tab blank. Waits for the list, so it never flashes. */}
      {!mayUpload && rows.length === 0 && (frozenDocuments || listQ.isSuccess) && (
        <Alert severity="info">No documents attached</Alert>)}
        {rows.length > 0 && (
        <Stack spacing={1}>
          <Typography variant="subtitle2" sx={{ color: tokens.ink }}>Attached documents</Typography>
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
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      )}

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

/** Splits a filename into the part a person edits and the extension that stays. */
const splitExtension = (filename = '') => {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? [filename.slice(0, dot), filename.slice(dot)] : [filename, ''];
};

/**
 * Moves one document to one other place on the deal, and may refile it as another type and rename
 * it on the way. The type is asked after the place, from what that place takes.
 */
function MoveDocumentDialog({ doc, targets, onClose, onMoved }) {
  const { showToast } = useToast();
  const [stem, extension] = splitExtension(doc.originalFilename);
  const [targetKey, setTargetKey] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [name, setName] = useState(stem);
  const [error, setError] = useState(null);
  const target = targets.find((t) => t.key === targetKey) ?? null;

  // A voice note stays a voice note and a file stays a file — the server holds the same line.
  const isAudio = AUDIO_DOCUMENT_TYPES.includes(doc.documentType);
  const typesFor = (t) => DOCUMENT_TYPES.filter((o) =>
    (!t?.acceptedTypes || t.acceptedTypes.includes(o.value))
    && AUDIO_DOCUMENT_TYPES.includes(o.value) === isAudio);
  const typeOptions = target ? typesFor(target) : [];

  const chooseTarget = (key) => {
    setTargetKey(key);
    setError(null);
    // Keep the type while the new place still takes it; otherwise make the person choose.
    const next = targets.find((t) => t.key === key);
    const valid = typesFor(next).map((o) => o.value);
    const keep = valid.includes(documentType) ? documentType : '';
    setDocumentType(keep || (valid.includes(doc.documentType) ? doc.documentType : ''));
  };

  const trimmed = name.trim();
  const filename = trimmed + extension;
  const typeChanged = documentType && documentType !== doc.documentType;
  const renamed = trimmed && filename !== doc.originalFilename;

  const mut = useMutation({
    mutationFn: () => moveDocument(doc.id, target.nodeId, {
      documentType: typeChanged ? documentType : undefined,
      filename: renamed ? filename : undefined,
    }),
    onSuccess: () => {
      showToast({
        severity: 'success',
        message: `Moved to ${target.label}${typeChanged ? ` as ${documentTypeLabel(documentType)}` : ''}`,
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
          {doc.originalFilename} · {documentTypeLabel(doc.documentType)}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel id="move-target-label">Move to</InputLabel>
            <Select
              labelId="move-target-label"
              label="Move to"
              value={targetKey}
              onChange={(e) => chooseTarget(e.target.value)}
            >
              {targets.map((t) => (
                <MenuItem key={t.key} value={t.key}>
                  {t.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {target && (
            <FormControl fullWidth>
              <InputLabel id="move-type-label">Document type</InputLabel>
              <Select
                labelId="move-type-label"
                label="Document type"
                value={documentType}
                onChange={(e) => { setDocumentType(e.target.value); setError(null); }}
              >
                {typeOptions.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
          )}
          <TextField
            fullWidth
            label="File name"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            error={!trimmed}
            helperText={!trimmed ? 'Give the document a name' : undefined}
            slotProps={extension
              ? { input: { endAdornment: <InputAdornment position="end">{extension}</InputAdornment> } }
              : undefined}
          />
        </Stack>
        <Typography variant="caption" sx={{ display: 'block', color: tokens.muted, mt: 1.5 }}>
          Only the types the chosen place can hold are listed.
          Moving it clears the verification on any owner involved, if they&apos;re verified.
        </Typography>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={mut.isPending}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!target || !documentType || !trimmed || mut.isPending}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? 'Moving…' : 'Move'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
