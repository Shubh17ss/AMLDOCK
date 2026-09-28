import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, CircularProgress, Divider, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { getDealSale } from '../../../api/deals.js';
import { useCurrency } from '../../../dashboard/useCurrency.js';
import { tokens, fonts } from '../../../theme/theme.js';

/**
 * What the deal finished as.
 *
 * <p>Fed by its own endpoint rather than the deal payload, the way the Risk tab is — the unit
 * list is a per-deal query, and hanging it off every deal fetch would make the dashboards pay
 * for a tab almost nobody has open.
 *
 * <p>Deliberately separate from the value shown in the header. That one is the valuation range
 * the broker estimated; this is what the property actually changed hands for, and folding the
 * second into the first would leave a firm unable to tell an estimate from a result.
 */
export function TransactionMonitoringPanel({ dealId }) {
  const money = useCurrency();

  const q = useQuery({
    queryKey: ['dealSale', dealId],
    queryFn: () => getDealSale(dealId),
    enabled: dealId != null,
  });

  if (q.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
    );
  }
  if (q.isError) {
    return <Alert severity="error">Could not load the transaction detail. Refresh to try again.</Alert>;
  }

  const sale = q.data;

  // Null rather than false: nobody has been asked yet, which reads differently from a recorded No
  // and must not be shown as one.
  if (sale?.propertySold == null) {
    return (
      <Empty>
        Recorded when the deal is closed. Closing asks whether the property sold and for how
        much, and the answers appear here.
      </Empty>
    );
  }

  if (!sale.propertySold) {
    return (
      <Section>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <RemoveCircleOutlineIcon sx={{ fontSize: '1.3rem', color: tokens.muted }} />
          <Box>
            <Typography sx={{ fontSize: '1rem', color: tokens.ink }}>Property not sold</Typography>
            <Typography variant="caption" sx={{ color: tokens.muted }}>
              The file was closed without a sale.
            </Typography>
          </Box>
        </Stack>
      </Section>
    );
  }

  const units = sale.units ?? [];

  return (
    <Section>
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <CheckCircleIcon sx={{ fontSize: '1.3rem', color: tokens.approved, mt: 0.25 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: tokens.muted, display: 'block' }}>
            {units.length > 0 ? 'Total transaction value' : 'Transaction value'}
          </Typography>
          <Typography sx={{ fontFamily: fonts.display, fontSize: '1.6rem', color: tokens.ink }}>
            {money.formatWithCode(sale.total)}
          </Typography>
          {units.length > 0 && (
            <Typography variant="caption" sx={{ color: tokens.muted }}>
              Across {units.length} {units.length === 1 ? 'unit' : 'units'}
            </Typography>
          )}
        </Box>
      </Stack>

      {units.length > 0 && (
        <>
          <Divider sx={{ my: 2.5 }} />
          {/* A development is sold unit by unit, so the breakdown is the record — the total above
              is summed from exactly these rows. */}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Unit</TableCell>
                <TableCell align="right">Transaction value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {units.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.unitName}</TableCell>
                  <TableCell align="right" sx={{ fontFamily: fonts.mono, fontSize: '0.82rem' }}>
                    {money.format(u.salePrice)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Section>
  );
}

function Section({ children }) {
  return (
    <Box
      sx={{
        border: `1px solid ${tokens.hairline}`,
        borderRadius: 3,
        backgroundColor: tokens.tile,
        p: 3,
      }}
    >
      {children}
    </Box>
  );
}

/** Nothing recorded yet — which is a stage of the deal, not a missing feature. */
function Empty({ children }) {
  return (
    <Box
      sx={{
        border: `1px dashed ${tokens.hairline2}`,
        borderRadius: 3,
        px: 3,
        py: 5,
        textAlign: 'center',
        backgroundColor: tokens.tile,
      }}
    >
      <Stack spacing={1} alignItems="center">
        <Typography sx={{ fontFamily: fonts.display, fontSize: '1.05rem', color: tokens.ink }}>
          Nothing recorded yet
        </Typography>
        <Typography variant="body2" sx={{ color: tokens.muted, maxWidth: 460 }}>
          {children}
        </Typography>
      </Stack>
    </Box>
  );
}
