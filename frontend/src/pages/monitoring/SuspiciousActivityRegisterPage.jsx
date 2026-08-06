import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
  Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import TableViewIcon from '@mui/icons-material/TableViewOutlined';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import PaymentsIcon from '@mui/icons-material/PaymentsOutlined';
import {
  listSuspiciousActivities, fetchSuspiciousActivityDownloadUrl, deleteSuspiciousActivity,
} from '../../api/suspiciousActivities.js';
import { AddSuspiciousActivityDialog } from './AddSuspiciousActivityDialog.jsx';
import { redFlagLabel } from '../../data/redFlags.js';
import { buildCsv } from '../../utils/csv.js';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { useCurrency } from '../../dashboard/useCurrency.js';
import { useToast } from '../../components/ToastProvider.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { canDelete } from '../../auth/roles.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { tokens, fonts } from '../../theme/theme.js';

const dateFmt = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const amountFmt = (v) =>
  v == null ? '—' : Number(v).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TYPE_META = {
  ACTIVITY:    { label: 'Activity',    color: tokens.blue,   Icon: VisibilityIcon },
  TRANSACTION: { label: 'Transaction', color: tokens.review, Icon: PaymentsIcon },
};

// CSV export columns. Dates stay ISO and amounts plain 2dp so the file drops straight into a
// spreadsheet; the red flag is exported as both the stored code and its label.
//
// The amount column names the entity's own currency, so a downloaded file is unambiguous once
// it's away from the screen that produced it.
const csvHeaders = (currencyCode) => [
  'Type', 'Name', 'Date of suspicion', 'Red flag code', 'Red flag', `Amount ${currencyCode}`,
  'Reference', 'Description', 'Action taken', 'Branch', 'Attachment', 'Recorded by', 'Recorded at',
];

const csvRowFor = (sa) => [
  TYPE_META[sa.suspicionType]?.label ?? sa.suspicionType ?? '',
  sa.name ?? '',
  sa.dateOfSuspicion ?? '',
  sa.redFlag ?? '',
  redFlagLabel(sa.redFlag),
  sa.amount == null ? '' : Number(sa.amount).toFixed(2),
  sa.reference ?? '',
  sa.description ?? '',
  sa.actionTaken ?? '',
  sa.branchName?.trim() ?? '',
  sa.hasDocument ? sa.originalFilename ?? '' : '',
  sa.createdByEmail ?? '',
  sa.createdAt ?? '',
];

/** Slug for the filename, e.g. 'Demo Realty' -> 'demo-realty'. */
const slug = (s) =>
  String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** One-line cell for free text that can run long — the full value sits in the tooltip. */
function TruncatedCell({ text, width = 240 }) {
  if (!text) return <Typography component="span" sx={{ fontSize: '0.85rem', color: tokens.muted }}>—</Typography>;
  return (
    <Tooltip title={text}>
      <Typography
        sx={{
          fontSize: '0.85rem', color: tokens.ink, maxWidth: width,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {text}
      </Typography>
    </Tooltip>
  );
}

/** A labelled block of free text in the row-detail dialog; newlines are preserved. */
function DetailBlock({ label, text }) {
  return (
    <Box>
      <Typography
        sx={{
          fontFamily: fonts.mono, fontSize: '0.68rem', letterSpacing: '0.08em',
          textTransform: 'uppercase', color: tokens.muted, mb: 0.75,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: '0.9rem', color: text ? tokens.ink : tokens.muted,
          whiteSpace: 'pre-wrap', lineHeight: 1.6,
        }}
      >
        {text || 'Not recorded'}
      </Typography>
    </Box>
  );
}

/**
 * Monitoring › Suspicious Activity Register — the log of potential suspicions raised by staff.
 * Scope-aware: the firm/branch selected in the sidebar drives which register loads and which
 * register new entries land in.
 */
export function SuspiciousActivityRegisterPage() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { firm, branch } = useDashboardScope();
  const money = useCurrency();
  const [addOpen, setAddOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [detail, setDetail] = useState(null);

  const mayDelete = canDelete(user?.role);
  // The delete action gets its own column at the far right so it never sits under "File".
  const colCount = mayDelete ? 8 : 7;

  const saQ = useQuery({
    queryKey: ['suspiciousActivities', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listSuspiciousActivities({ firmId: firm?.id, branchId: branch?.id }),
  });
  const rows = saQ.data ?? [];

  const download = async (sa) => {
    try {
      const { downloadUrl } = await fetchSuspiciousActivityDownloadUrl(sa.id);
      window.open(downloadUrl, '_blank', 'noopener');
    } catch {
      showToast({ severity: 'error', message: 'Could not get a download link. Try again.' });
    }
  };

  /**
   * Export the register as it stands on screen — the same scope-filtered, date-sorted rows,
   * so what you download is what you see. Built client-side from the loaded query data.
   */
  const exportCsv = () => {
    const csv = buildCsv(csvHeaders(money.code), rows.map(csvRowFor));
    const name = ['suspicious-activities', slug(firm?.name), slug(branch?.name),
      new Date().toISOString().slice(0, 10)].filter(Boolean).join('-');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${name}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast({
      severity: 'success',
      message: `Exported ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`,
    });
  };

  const deleteMut = useMutation({
    mutationFn: (sa) => deleteSuspiciousActivity(sa.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suspiciousActivities'] });
      showToast({ severity: 'success', message: 'Entry deleted' });
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
          `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} on record`,
          firm?.name,
          branch?.name,
        ].filter(Boolean).join(' · ')}
        title="Suspicious Activity Register"
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<TableViewIcon />}
              disabled={rows.length === 0}
              onClick={exportCsv}
            >
              Download CSV
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
              Potential Suspicion
            </Button>
          </>
        }
      />

      {saQ.isError && <Alert severity="error">Failed to load the register. Refresh to try again.</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Red flag</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell align="right">Amount ({money.code}&nbsp;$)</TableCell>
              <TableCell align="right">File</TableCell>
              {mayDelete && <TableCell align="right" />}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((sa) => {
              const type = TYPE_META[sa.suspicionType] ?? TYPE_META.ACTIVITY;
              const TypeIcon = type.Icon;
              return (
                <TableRow
                  key={sa.id}
                  hover
                  onClick={() => setDetail(sa)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Chip
                      size="small"
                      icon={<TypeIcon sx={{ fontSize: 14, color: `${type.color} !important` }} />}
                      label={type.label}
                      sx={{
                        color: type.color,
                        backgroundColor: `${type.color}14`,
                        fontWeight: 600,
                        fontSize: '0.72rem',
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography sx={{ fontSize: '0.875rem', color: tokens.ink }}>{sa.name}</Typography>
                      {sa.branchName && <Chip size="small" label={sa.branchName} />}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{dateFmt(sa.dateOfSuspicion)}</TableCell>
                  <TableCell><TruncatedCell text={redFlagLabel(sa.redFlag)} width={200} /></TableCell>
                  <TableCell sx={{ fontFamily: fonts.mono, fontSize: '0.78rem', color: tokens.muted }}>
                    {sa.reference || '—'}
                  </TableCell>
                      <TableCell align="right"
                             sx={{ fontFamily: fonts.mono, whiteSpace: 'nowrap', color: tokens.ink }}>
                    {amountFmt(sa.amount)}
                  </TableCell>
                  {/* Nothing at all when there's no attachment — an empty cell reads cleaner
                      than a dash once the row itself is clickable. */}
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {sa.hasDocument && (
                      <Tooltip title={`Download ${sa.originalFilename}`}>
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); download(sa); }}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                  {mayDelete && (
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', width: 56 }}>
                      <Tooltip title="Delete this entry">
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); setToDelete(sa); }}
                        >
                          <DeleteOutlineIcon fontSize="small" sx={{ color: tokens.rejected }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {!saQ.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={colCount} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  No entries yet — record the first potential suspicion to start the register.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <AddSuspiciousActivityDialog open={addOpen} onClose={() => setAddOpen(false)} />

      {/* The long-form text lives here rather than in the table, which stays scannable. */}
      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} maxWidth="sm" fullWidth>
        {detail && (
          <>
            <DialogTitle sx={{ pb: 1 }}>{detail.name}</DialogTitle>
            <DialogContent>
              <Stack spacing={2.5} sx={{ mt: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    label={TYPE_META[detail.suspicionType]?.label ?? detail.suspicionType}
                    sx={{
                      color: (TYPE_META[detail.suspicionType] ?? TYPE_META.ACTIVITY).color,
                      backgroundColor: `${(TYPE_META[detail.suspicionType] ?? TYPE_META.ACTIVITY).color}14`,
                      fontWeight: 600,
                      fontSize: '0.72rem',
                    }}
                  />
                  <Typography sx={{ fontSize: '0.8rem', color: tokens.muted }}>
                    {[
                      dateFmt(detail.dateOfSuspicion),
                      redFlagLabel(detail.redFlag),
                      detail.amount == null ? null : `${money.code} $${amountFmt(detail.amount)}`,
                      detail.reference || null,
                    ].filter(Boolean).join(' · ')}
                  </Typography>
                </Stack>

                <DetailBlock label="Description" text={detail.description} />
                <DetailBlock label="Action taken" text={detail.actionTaken} />
              </Stack>
            </DialogContent>
            <DialogActions>
              {detail.hasDocument && (
                <Button
                  startIcon={<DownloadIcon />}
                  onClick={() => download(detail)}
                  sx={{ mr: 'auto' }}
                >
                  {detail.originalFilename}
                </Button>
              )}
              <Button onClick={() => setDetail(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog open={Boolean(toDelete)} onClose={() => !deleteMut.isPending && setToDelete(null)}
              maxWidth="xs" fullWidth>
        <DialogTitle>Delete this entry?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.9rem', color: tokens.ink }}>
            {toDelete && (
              <>Delete the suspicious {TYPE_META[toDelete.suspicionType]?.label.toLowerCase()} recorded
              for <Box component="span" sx={{ fontWeight: 700 }}>{toDelete.name}</Box>? This also removes
              any attached PDF and is recorded in the audit log. It can’t be undone.</>
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
