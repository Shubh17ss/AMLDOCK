import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, LinearProgress, Paper, Stack, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import UploadIcon from '@mui/icons-material/FileUploadOutlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  listComplianceDocs, fetchComplianceDownloadUrl, uploadComplianceDoc,
} from '../../api/complianceDocs.js';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { tokens, fonts } from '../../theme/theme.js';

/** The three Documents modules — shared config for routes and page rendering. */
export const DOCUMENT_MODULES = [
  { category: 'RISK_ASSESSMENT',      title: 'Risk Assessment',      path: '/documents/risk-assessment' },
  { category: 'COMPLIANCE_PROGRAMME', title: 'Compliance Programme', path: '/documents/compliance-programme' },
  { category: 'ANNUAL_REPORT',        title: 'Annual Report',        path: '/documents/annual-report' },
];

const dateFmt = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/**
 * A versioned compliance-document register: upload revisions, download any past
 * version, and see who uploaded what and when. Used by all three Documents modules.
 */
export function DocumentModulePage({ category, title }) {
  const { showToast } = useToast();
  const { firm, branch } = useDashboardScope();
  const [tab, setTab] = useState('versions');
  const [uploadOpen, setUploadOpen] = useState(false);

  // Scope-aware: the firm/branch selected in the sidebar drives which register loads.
  const docsQ = useQuery({
    queryKey: ['complianceDocs', category, firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listComplianceDocs(category, { firmId: firm?.id, branchId: branch?.id }),
  });
  const docs = docsQ.data ?? [];
  const latest = docs[0] ?? null;

  const download = async (doc) => {
    try {
      const { downloadUrl } = await fetchComplianceDownloadUrl(doc.id);
      window.open(downloadUrl, '_blank', 'noopener');
    } catch {
      showToast({ severity: 'error', message: 'Could not get a download link. Try again.' });
    }
  };

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow={[
          `${docs.length} ${docs.length === 1 ? 'version' : 'versions'} on record`,
          firm?.name,
          branch?.name,
        ].filter(Boolean).join(' · ')}
        title={title}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 40 }}>
          <Tab label="Version history" value="versions" />
          <Tab label="Activity log" value="activity" />
        </Tabs>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            disabled={!latest}
            onClick={() => latest && download(latest)}
          >
            Download latest version
          </Button>
          <Button variant="contained" startIcon={<UploadIcon />} onClick={() => setUploadOpen(true)}>
            Upload new version
          </Button>
        </Stack>
      </Box>

      {docsQ.isError && <Alert severity="error">Failed to load documents. Refresh to try again.</Alert>}

      {tab === 'versions' && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell align="right">Files</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {docs.map((d) => (
                <TableRow key={d.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" color="primary" label={`v${d.versionNo}`}
                            sx={{ fontFamily: fonts.mono, minWidth: 40 }} />
                      <Typography sx={{ fontSize: '0.875rem', color: tokens.ink }}>{d.name}</Typography>
                      {d.branchName && <Chip size="small" label={d.branchName} />}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{dateFmt(d.createdAt)}</TableCell>
                  <TableCell sx={{ color: tokens.muted }}>{d.changeNotes ?? '—'}</TableCell>
                  <TableCell align="right">
                    <Tooltip title={`Download ${d.originalFilename}`}>
                      <IconButton size="small" onClick={() => download(d)}>
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {!docsQ.isLoading && docs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    No versions yet — upload the first {title.toLowerCase()} to start the register.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 'activity' && (
        <Paper sx={{ p: 2.5 }}>
          <Stack spacing={0}>
            {docs.map((d) => (
              <Box key={d.id} sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25,
                borderBottom: `1px solid ${tokens.hairline}`, '&:last-child': { borderBottom: 'none' },
              }}>
                <CheckCircleRoundedIcon sx={{ fontSize: 18, color: tokens.approved }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: '0.875rem', color: tokens.ink }}>
                    <Box component="span" sx={{ fontFamily: fonts.mono, fontWeight: 700 }}>v{d.versionNo}</Box>
                    {' '}uploaded{d.uploadedByEmail ? ` by ${d.uploadedByEmail}` : ''}
                  </Typography>
                  <Typography noWrap sx={{ fontSize: '0.78rem', color: tokens.muted }}>{d.name}</Typography>
                </Box>
                <Typography sx={{ flexShrink: 0, fontSize: '0.78rem', color: tokens.muted }}>
                  {dateFmt(d.createdAt)}
                </Typography>
              </Box>
            ))}
            {!docsQ.isLoading && docs.length === 0 && (
              <Typography sx={{ py: 3, textAlign: 'center', color: tokens.muted, fontSize: '0.85rem' }}>
                No activity yet.
              </Typography>
            )}
          </Stack>
        </Paper>
      )}

      <UploadRevisionDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        category={category}
        title={title}
      />
    </Stack>
  );
}

/** "Upload {module} revision" — name, optional change notes, drag-and-drop file. */
function UploadRevisionDialog({ open, onClose, category, title }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { firm, branch } = useDashboardScope();
  const fileInputRef = useRef(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  const reset = () => {
    setName(''); setNotes(''); setFile(null); setProgress(null); setError(null);
  };

  const mut = useMutation({
    // The revision lands in the register currently selected in the sidebar:
    // a selected branch tags it branch-specific, otherwise it's firm-wide.
    mutationFn: () => uploadComplianceDoc({
      category, name, changeNotes: notes, file,
      realEstateFirmId: firm?.id, firmBranchId: branch?.id,
      onProgress: setProgress,
    }),
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: ['complianceDocs', category] });
      showToast({ severity: 'success', message: `Uploaded ${doc.name} (v${doc.versionNo})` });
      reset();
      onClose();
    },
    onError: (e) => {
      setProgress(null);
      setError(e.response?.data?.message || 'Upload failed. Try again.');
    },
  });

  const pickFile = (f) => {
    if (!f) return;
    setFile(f);
    if (!name.trim()) setName(f.name.replace(/\.[^.]+$/, ''));
  };

  const close = () => { if (!mut.isPending) { reset(); onClose(); } };

  const submit = (e) => { e.preventDefault(); if (file && name.trim()) mut.mutate(); };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>Upload {title} revision</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Change notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              minRows={3}
              fullWidth
            />

            {/* Dropzone */}
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
                onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }}
              />
              <UploadFileIcon sx={{ fontSize: 34, color: file ? tokens.approved : tokens.muted }} />
              <Typography sx={{ mt: 1, fontWeight: 600, fontSize: '0.9rem', color: tokens.ink }}>
                {file ? file.name : 'Drag and drop a file here or click to browse'}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: tokens.muted, mt: 0.5 }}>
                {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'PDF, Word, or any document up to 25 MB'}
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
                  {progress.phase === 'upload' ? `Uploading… ${progress.percent}%` : 'Preparing…'}
                </Typography>
              </Box>
            )}

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={mut.isPending}>Cancel</Button>
          <Button type="submit" variant="contained" startIcon={<UploadIcon />}
                  disabled={mut.isPending || !file || !name.trim()}>
            {mut.isPending ? 'Uploading…' : 'Upload'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
