import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, FormControl, IconButton, InputLabel, LinearProgress,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  DOCUMENT_TYPES, deleteDocument, fetchDownloadUrl, listDealDocuments, uploadToS3,
} from '../api/documents.js';

const MAX_BYTES = 25 * 1024 * 1024;

const formatBytes = (n) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

export function DocumentUploader({ dealId, canUpload = true, title = 'Documents' }) {
  const qc = useQueryClient();
  const inputRef = useRef(null);
  const [documentType, setDocumentType] = useState('OTHER');
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null); // { name, phase, percent }

  const listQ = useQuery({
    queryKey: ['documents', dealId],
    queryFn: () => listDealDocuments(dealId),
    enabled: Boolean(dealId),
  });

  const uploadMut = useMutation({
    mutationFn: async (file) => {
      setProgress({ name: file.name, phase: 'presign', percent: 0 });
      return uploadToS3({
        file, documentType, dealId,
        onProgress: ({ phase, percent }) => setProgress({ name: file.name, phase, percent }),
      });
    },
    onSuccess: () => {
      setError(null);
      setProgress(null);
      qc.invalidateQueries({ queryKey: ['documents', dealId] });
      if (inputRef.current) inputRef.current.value = '';
    },
    onError: (e) => {
      setProgress(null);
      setError(e.response?.data?.message || e.message || 'Upload failed');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => deleteDocument(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents', dealId] }),
    onError: (e) => setError(e.response?.data?.message || 'Delete failed'),
  });

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(`File exceeds ${formatBytes(MAX_BYTES)} limit`);
      e.target.value = '';
      return;
    }
    uploadMut.mutate(file);
  };

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
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1">{title}</Typography>
        {canUpload && (
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="doc-type-label">Document type</InputLabel>
              <Select labelId="doc-type-label" label="Document type"
                      value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
                {DOCUMENT_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
            <Button variant="contained" startIcon={<CloudUploadIcon />}
                    onClick={() => inputRef.current?.click()}
                    disabled={uploadMut.isPending || !dealId}>
              {uploadMut.isPending ? 'Uploading…' : 'Upload'}
            </Button>
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
              <Typography variant="body2" color="text.secondary">
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

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
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
            {(listQ.data ?? []).map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.originalFilename}</TableCell>
                <TableCell><Chip size="small" label={d.documentType} /></TableCell>
                <TableCell>{formatBytes(d.sizeBytes)}</TableCell>
                <TableCell>{d.uploadedByEmail ?? '—'}</TableCell>
                <TableCell>{new Date(d.createdAt).toLocaleString()}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Download">
                    <IconButton size="small" onClick={() => handleDownload(d.id)}>
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {canUpload && (
                    <Tooltip title="Delete">
                      <IconButton size="small"
                                  onClick={() => deleteMut.mutate(d.id)}
                                  disabled={deleteMut.isPending}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!listQ.data || listQ.data.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  No documents yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
