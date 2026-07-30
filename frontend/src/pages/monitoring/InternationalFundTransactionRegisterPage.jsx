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
import SouthWestIcon from '@mui/icons-material/SouthWest';
import NorthEastIcon from '@mui/icons-material/NorthEast';
import {
  listFundTransactions, fetchFundTransactionDownloadUrl, deleteFundTransaction,
} from '../../api/fundTransactions.js';
import { AddFundTransactionDialog } from './AddFundTransactionDialog.jsx';
import { countryName, flagClass } from '../../data/countries.js';
import { buildCsv } from '../../utils/csv.js';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { canDelete } from '../../auth/roles.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { tokens, fonts } from '../../theme/theme.js';

const dateFmt = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const amountFmt = (v) =>
  v == null ? '—' : Number(v).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FLOW_META = {
  INWARDS:  { label: 'Inwards',  color: tokens.blue,  Icon: SouthWestIcon },
  OUTWARDS: { label: 'Outwards', color: tokens.review, Icon: NorthEastIcon },
};

// CSV export columns. Amounts and dates stay machine-readable (plain 2dp decimal, ISO date) so
// the file drops straight into a spreadsheet; the jurisdiction is split into code + name.
const CSV_HEADERS = [
  'Deal', 'Listing address', 'Transaction flow', 'Date', 'Amount NZD',
  'Overseas jurisdiction code', 'Overseas jurisdiction', 'Submission reference',
  'Branch', 'Attachment', 'Recorded by', 'Recorded at',
];

const csvRowFor = (tx) => [
  tx.dealReference ?? '',
  tx.listingAddress ?? '',
  FLOW_META[tx.transactionFlow]?.label ?? tx.transactionFlow ?? '',
  tx.transactionDate ?? '',
  // Fixed 2dp, no thousands separator — reads as currency but still parses as a number.
  tx.amountNzd == null ? '' : Number(tx.amountNzd).toFixed(2),
  tx.overseasJurisdiction ?? '',
  countryName(tx.overseasJurisdiction),
  tx.submissionReference ?? '',
  tx.branchName?.trim() ?? '',
  tx.hasDocument ? tx.originalFilename ?? '' : '',
  tx.createdByEmail ?? '',
  tx.createdAt ?? '',
];

/** Slug for the filename, e.g. 'Demo Realty' -> 'demo-realty'. */
const slug = (s) =>
  String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Monitoring › International Fund Transaction Register — the log of international transfers
 * tied to a listing. Scope-aware: the firm/branch selected in the sidebar drives which
 * register loads and which register new entries land in.
 */
export function InternationalFundTransactionRegisterPage() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { firm, branch } = useDashboardScope();
  const [addOpen, setAddOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const mayDelete = canDelete(user?.role);

  const txQ = useQuery({
    queryKey: ['fundTransactions', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listFundTransactions({ firmId: firm?.id, branchId: branch?.id }),
  });
  const rows = txQ.data ?? [];

  const download = async (tx) => {
    try {
      const { downloadUrl } = await fetchFundTransactionDownloadUrl(tx.id);
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
    const csv = buildCsv(CSV_HEADERS, rows.map(csvRowFor));
    const name = ['international-fund-transactions', slug(firm?.name), slug(branch?.name),
      new Date().toISOString().slice(0, 10)].filter(Boolean).join('-');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${name}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast({
      severity: 'success',
      message: `Exported ${rows.length} ${rows.length === 1 ? 'transaction' : 'transactions'}`,
    });
  };

  const deleteMut = useMutation({
    mutationFn: (tx) => deleteFundTransaction(tx.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fundTransactions'] });
      showToast({ severity: 'success', message: 'Transaction deleted' });
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
          `${rows.length} ${rows.length === 1 ? 'transaction' : 'transactions'} on record`,
          firm?.name,
          branch?.name,
        ].filter(Boolean).join(' · ')}
        title="International Fund Transaction Register"
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
              International Fund Transaction
            </Button>
          </>
        }
      />

      {txQ.isError && <Alert severity="error">Failed to load the register. Refresh to try again.</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Deal</TableCell>
              <TableCell>Listing address</TableCell>
              <TableCell>Flow</TableCell>
              <TableCell>Date</TableCell>
              <TableCell align="right">Amount (NZD&nbsp;$)</TableCell>
              <TableCell>Overseas jurisdiction</TableCell>
              <TableCell>Submission ref.</TableCell>
              <TableCell align="right">File</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((tx) => {
              const flow = FLOW_META[tx.transactionFlow] ?? FLOW_META.INWARDS;
              const FlowIcon = flow.Icon;
              return (
                <TableRow key={tx.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography sx={{ fontSize: '0.875rem', color: tokens.ink }}>
                        {tx.dealReference || '—'}
                      </Typography>
                      {tx.branchName && <Chip size="small" label={tx.branchName} />}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ color: tokens.ink }}>{tx.listingAddress}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      icon={<FlowIcon sx={{ fontSize: 14, color: `${flow.color} !important` }} />}
                      label={flow.label}
                      sx={{
                        color: flow.color,
                        backgroundColor: `${flow.color}14`,
                        fontWeight: 600,
                        fontSize: '0.72rem',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{dateFmt(tx.transactionDate)}</TableCell>
                  <TableCell align="right"
                             sx={{ fontFamily: fonts.mono, whiteSpace: 'nowrap', color: tokens.ink }}>
                    {amountFmt(tx.amountNzd)}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box component="span" className={flagClass(tx.overseasJurisdiction)}
                           sx={{ fontSize: '1.05rem', borderRadius: '2px', flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.875rem', color: tokens.ink }}>
                        {countryName(tx.overseasJurisdiction)}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ fontFamily: fonts.mono, fontSize: '0.78rem', color: tokens.muted }}>
                    {tx.submissionReference || '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {tx.hasDocument ? (
                      <Tooltip title={`Download ${tx.originalFilename}`}>
                        <IconButton size="small" onClick={() => download(tx)}>
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Typography component="span" sx={{ fontSize: '0.78rem', color: tokens.muted }}>
                        —
                      </Typography>
                    )}
                    {mayDelete && (
                      <Tooltip title="Delete this entry">
                        <IconButton size="small" onClick={() => setToDelete(tx)}>
                          <DeleteOutlineIcon fontSize="small" sx={{ color: tokens.rejected }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {!txQ.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  No transactions yet — add the first international fund transaction to start the register.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <AddFundTransactionDialog open={addOpen} onClose={() => setAddOpen(false)} />

      <Dialog open={Boolean(toDelete)} onClose={() => !deleteMut.isPending && setToDelete(null)}
              maxWidth="xs" fullWidth>
        <DialogTitle>Delete this transaction?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.9rem', color: tokens.ink }}>
            {toDelete && (
              <>Delete the {FLOW_META[toDelete.transactionFlow]?.label.toLowerCase()} transfer of{' '}
              <Box component="span" sx={{ fontWeight: 700 }}>NZD ${amountFmt(toDelete.amountNzd)}</Box>{' '}
              for {toDelete.listingAddress}? This also removes any attached PDF and is recorded in the
              audit log. It can’t be undone.</>
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
