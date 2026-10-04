import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tooltip, Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { getTransactionMonitoring } from '../../api/deals.js';
import { SkeletonTable } from '../../components/SkeletonTable.jsx';
import { useCurrency } from '../../dashboard/useCurrency.js';
import { dealStatusDot, dealStatusLabel } from '../../data/dealStatus.js';
import { tokens, fonts } from '../../theme/theme.js';
import { formatDateTimeNumeric } from '../../utils/formatters.js';

const VARIANCE = {
  WITHIN: { label: 'Within value', color: 'success' },
  BEYOND: { label: 'Beyond value', color: 'error' },
};

/**
 * The deal's transaction history: every move between Verified and Closed, newest first.
 *
 * <p>Driven by the moves, not the versions. A deal closed, unclosed to correct the sale and closed
 * again is three rows here and one version, and the version list could never say what each close
 * was worth. Each row carries the figures as they were at that moment — the server copies them
 * when the move is made — so a later re-close cannot rewrite an earlier one.
 *
 * <p>Both ends of a move open the version the deal stood on, which is where its evidence lives.
 *
 * <p>Rendered in place of the deal page's tabs, at `?view=transactions`, rather than over them: it
 * is a view of the deal in its own right, and having it in the URL lets the browser's Back return
 * to the deal details.
 *
 * Props: dealId, onOpenVersion(versionNo)
 */
export function TransactionMonitoringView({ dealId, onOpenVersion }) {
  const money = useCurrency();
  const q = useQuery({
    // Under ['deals', id] so the invalidations a close or unclose already makes refresh it.
    queryKey: ['deals', dealId, 'transaction-monitoring'],
    queryFn: () => getTransactionMonitoring(dealId),
    enabled: Boolean(dealId),
  });
  const rows = q.data ?? [];

  return (
    <Stack spacing={2}>
      <Box>
        <Typography sx={{ fontFamily: fonts.display, fontSize: '1.3rem', color: tokens.ink }}>
          Transaction monitoring
        </Typography>
        <Typography sx={{ fontSize: '0.88rem', color: tokens.muted, mt: 0.25 }}>
          Every move between Verified and Closed, newest first. Select a status to open the version
          the deal stood on.
        </Typography>
      </Box>

      <Box>
        {q.isError && <Alert severity="error">Couldn’t load the history. Try again.</Alert>}
        {q.isLoading && <SkeletonTable rows={3} columns={5} />}
        {q.isSuccess && rows.length === 0 && (
          <Paper variant="outlined" sx={{ py: 6, textAlign: 'center', color: tokens.muted }}>
            This deal hasn’t been closed yet.
          </Paper>
        )}
        {q.isSuccess && rows.length > 0 && (
          // Scrolls sideways on a phone rather than squeezing five columns into one.
          <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 820 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Movement</TableCell>
                  <TableCell>Appraised value</TableCell>
                  <TableCell>Closing value</TableCell>
                  <TableCell>Variance</TableCell>
                  <TableCell>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <TableRow key={`${r.occurredAt}-${i}`} sx={{ verticalAlign: 'top' }}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Stack direction="row" spacing={1.25} alignItems="flex-start">
                        <StatusStamp status={r.fromStatus} at={r.fromAt} versionNo={r.versionNo} onOpen={onOpenVersion} />
                        <ArrowForwardIcon sx={{ fontSize: '1rem', color: tokens.muted, mt: 0.25 }} />
                        <StatusStamp status={r.toStatus} at={r.occurredAt} versionNo={r.versionNo} onOpen={onOpenVersion} />
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {r.valuationMin != null || r.valuationMax != null
                        ? money.dealRange({ valuationMin: r.valuationMin, valuationMax: r.valuationMax })
                        : '—'}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <ClosingValue row={r} format={money.format} />
                    </TableCell>
                    <TableCell>
                      {VARIANCE[r.variance]
                        ? <Chip size="small" label={VARIANCE[r.variance].label} color={VARIANCE[r.variance].color} />
                        : <Typography component="span" sx={{ color: tokens.muted }}>—</Typography>}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 320 }}>
                      <Notes text={r.note} by={r.actorName} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Stack>
  );
}

/**
 * A status label and the moment the deal reached it. The label opens the version, styled like the
 * register's links: ink at rest, the status colour and an underline on hover.
 */
function StatusStamp({ status, at, versionNo, onOpen }) {
  const clickable = versionNo != null && onOpen;
  return (
    <Box>
      <Stack direction="row" spacing={0.75} alignItems="center">
        <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: dealStatusDot(status) }} />
        <Box
          component={clickable ? 'button' : 'span'}
          type={clickable ? 'button' : undefined}
          onClick={clickable ? () => onOpen(versionNo) : undefined}
          title={clickable ? `Open v${versionNo}` : undefined}
          sx={{
            p: 0, border: 0, background: 'none', font: 'inherit',
            fontWeight: 700, fontSize: '0.88rem', color: tokens.ink,
            cursor: clickable ? 'pointer' : 'default',
            '&:hover': clickable ? { color: tokens.blue, textDecoration: 'underline' } : {},
            '&:focus-visible': { outline: `2px solid ${tokens.blue}`, outlineOffset: 2 },
          }}
        >
          {dealStatusLabel(status)}
        </Box>
      </Stack>
      <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.74rem', color: tokens.muted, mt: 0.25, pl: 1.75 }}>
        {formatDateTimeNumeric(at) ?? '—'}
      </Typography>
    </Box>
  );
}

function ClosingValue({ row, format }) {
  if (row.kind !== 'CLOSE') return <Typography component="span" sx={{ color: tokens.muted }}>—</Typography>;
  if (row.propertySold === false) {
    return <Typography component="span" sx={{ color: tokens.muted }}>Not sold</Typography>;
  }
  // A close forced by override records no outcome at all.
  if (row.saleTotal == null) return <Typography component="span" sx={{ color: tokens.muted }}>—</Typography>;
  return <Typography component="span" sx={{ fontWeight: 600 }}>{format(row.saleTotal)}</Typography>;
}

/** Two lines at most in the row; the whole note on hover. */
function Notes({ text, by }) {
  if (!text) return <Typography component="span" sx={{ color: tokens.muted }}>—</Typography>;
  return (
    <Tooltip title={<Box sx={{ whiteSpace: 'pre-wrap' }}>{text}</Box>}>
      <Box>
        <Typography
          sx={{
            fontSize: '0.85rem', color: tokens.ink, overflowWrap: 'anywhere',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {text}
        </Typography>
        {by && <Typography variant="caption" sx={{ color: tokens.muted }}>{by}</Typography>}
      </Box>
    </Tooltip>
  );
}
