import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, LinearProgress, Paper, Stack, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import UploadIcon from '@mui/icons-material/FileUploadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import {
  listComplianceDocs, fetchComplianceDownloadUrl, uploadComplianceDoc, deleteComplianceDoc,
  listComplianceActivity,
} from '../../api/complianceDocs.js';
import { listDocumentReviews, reviewStatusOf } from '../../api/documentReviews.js';
import { reviewMetaFor } from '../../components/documents/reviewStatus.jsx';
import { ReviewDialog } from '../../components/documents/ReviewDialog.jsx';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { canDelete, canManageReview } from '../../auth/roles.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { tokens, fonts } from '../../theme/theme.js';

// Compliance documents are PDF-only — the upload accepts nothing else, matching the
// server-side content-type guard.
const PDF_MIME = 'application/pdf';

/**
 * The three Documents modules — shared config for routes and page rendering. `id` is the
 * module-registry id, which doubles as the review key (document_review.module_key).
 */
export const DOCUMENT_MODULES = [
  { id: 'risk-assessment',      category: 'RISK_ASSESSMENT',      title: 'Risk Assessment',      path: '/documents/risk-assessment' },
  { id: 'compliance-programme', category: 'COMPLIANCE_PROGRAMME', title: 'Compliance Programme', path: '/documents/compliance-programme' },
  { id: 'annual-report',        category: 'ANNUAL_REPORT',        title: 'Annual Report',        path: '/documents/annual-report' },
];

const dateFmt = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const dateTimeFmt = (iso) =>
  iso ? new Date(iso).toLocaleString('en-NZ', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : '—';

// Per-action icon + accent for the activity feed. Keyed by AuditAction name.
const ACTIVITY_STYLE = {
  DOCUMENT_UPLOADED:         { icon: UploadIcon,          color: tokens.approved },
  DOCUMENT_DOWNLOADED:       { icon: DownloadIcon,        color: tokens.blue },
  DOCUMENT_DELETED:          { icon: DeleteOutlineIcon,   color: tokens.rejected },
  DOCUMENT_REVIEW_SET:       { icon: EventAvailableIcon,  color: tokens.blue },
  DOCUMENT_REVIEW_COMPLETED: { icon: CheckCircleRoundedIcon, color: tokens.approved },
  default:                   { icon: CheckCircleRoundedIcon, color: tokens.muted },
};

/**
 * A versioned compliance-document register: upload revisions, download any past
 * version, and see who uploaded what and when. Used by all three Documents modules.
 */
export function DocumentModulePage({ category, title, moduleKey }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { firm, branch } = useDashboardScope();
  const [tab, setTab] = useState('versions');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const mayDelete = canDelete(user?.role);
  const mayReview = canManageReview(user?.role);

  // Review schedule for this module in the current scope (one row per module + scope).
  const reviewsQ = useQuery({
    queryKey: ['documentReviews', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listDocumentReviews({ firmId: firm?.id, branchId: branch?.id }),
  });
  const review = (reviewsQ.data ?? []).find((r) => r.moduleKey === moduleKey) ?? null;
  const reviewMeta = reviewMetaFor(reviewStatusOf(review));
  const ReviewIcon = reviewMeta.Icon;

  // Scope-aware: the firm/branch selected in the sidebar drives which register loads.
  const docsQ = useQuery({
    queryKey: ['complianceDocs', category, firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listComplianceDocs(category, { firmId: firm?.id, branchId: branch?.id }),
  });
  const docs = docsQ.data ?? [];
  const latest = docs[0] ?? null;

  // Full activity trail — uploads, downloads and deletions (incl. of now-deleted versions).
  const activityQ = useQuery({
    queryKey: ['complianceActivity', category, firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listComplianceActivity(category, { firmId: firm?.id, branchId: branch?.id }),
    enabled: tab === 'activity',
  });
  const activity = activityQ.data ?? [];

  const download = async (doc) => {
    try {
      const { downloadUrl } = await fetchComplianceDownloadUrl(doc.id);
      window.open(downloadUrl, '_blank', 'noopener');
    } catch {
      showToast({ severity: 'error', message: 'Could not get a download link. Try again.' });
    }
  };

  const deleteMut = useMutation({
    mutationFn: (doc) => deleteComplianceDoc(doc.id),
    onSuccess: (_data, doc) => {
      qc.invalidateQueries({ queryKey: ['complianceDocs', category] });
      qc.invalidateQueries({ queryKey: ['complianceActivity', category] });
      showToast({ severity: 'success', message: `Deleted ${doc.name} (v${doc.versionNo})` });
      setToDelete(null);
    },
    onError: (e) => {
      showToast({ severity: 'error', message: e.response?.data?.message || 'Delete failed. Try again.' });
    },
  });

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
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Version history" value="versions" />
          <Tab label="Activity log" value="activity" />
        </Tabs>

        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          {mayReview && (
            <Button
              variant="contained"
              startIcon={<ReviewIcon />}
              onClick={() => setReviewOpen(true)}
              sx={{
                backgroundColor: reviewMeta.color,
                color: '#fff',
                '&:hover': { backgroundColor: reviewMeta.color, filter: 'brightness(0.94)' },
              }}
            >
              Review
            </Button>
          )}
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
                    {mayDelete && (
                      <Tooltip title="Delete this version">
                        <IconButton size="small" onClick={() => setToDelete(d)}>
                          <DeleteOutlineIcon fontSize="small" sx={{ color: tokens.rejected }} />
                        </IconButton>
                      </Tooltip>
                    )}
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
          {activityQ.isError && <Alert severity="error" sx={{ mb: 1.5 }}>Failed to load activity. Refresh to try again.</Alert>}
          <Stack spacing={0}>
            {activity.map((a) => {
              const { icon: ActivityIcon, color } = ACTIVITY_STYLE[a.action] ?? ACTIVITY_STYLE.default;
              return (
                <Box key={a.id} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25,
                  borderBottom: `1px solid ${tokens.hairline}`, '&:last-child': { borderBottom: 'none' },
                }}>
                  <ActivityIcon sx={{ fontSize: 18, color }} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: '0.875rem', color: tokens.ink }}>
                      {a.summary}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: '0.78rem', color: tokens.muted }}>
                      {a.actorEmail ?? 'System'}
                    </Typography>
                  </Box>
                  <Typography sx={{ flexShrink: 0, fontSize: '0.78rem', color: tokens.muted }}>
                    {dateTimeFmt(a.createdAt)}
                  </Typography>
                </Box>
              );
            })}
            {!activityQ.isLoading && activity.length === 0 && (
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

      <ReviewDialog
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        moduleKey={moduleKey}
        title={title}
        review={review}
      />

      <Dialog open={Boolean(toDelete)} onClose={() => !deleteMut.isPending && setToDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete this version?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.9rem', color: tokens.ink }}>
            {toDelete && (
              <>Delete <Box component="span" sx={{ fontWeight: 700 }}>{toDelete.name}</Box>{' '}
              (v{toDelete.versionNo})? This removes the file and is recorded in the activity log. It can’t be undone.</>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)} disabled={deleteMut.isPending}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            startIcon={<DeleteOutlineIcon />}
            disabled={deleteMut.isPending}
            onClick={() => deleteMut.mutate(toDelete)}
          >
            {deleteMut.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
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
      qc.invalidateQueries({ queryKey: ['complianceActivity', category] });
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
    const isPdf = f.type === PDF_MIME || /\.pdf$/i.test(f.name);
    if (!isPdf) {
      setError('Only PDF files can be uploaded.');
      return;
    }
    setError(null);
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
                accept="application/pdf,.pdf"
                onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }}
              />
              <UploadFileIcon sx={{ fontSize: 34, color: file ? tokens.approved : tokens.muted }} />
              <Typography sx={{ mt: 1, fontWeight: 600, fontSize: '0.9rem', color: tokens.ink }}>
                {file ? file.name : 'Drag and drop a PDF here or click to browse'}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: tokens.muted, mt: 0.5 }}>
                {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'PDF only, up to 25 MB'}
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
