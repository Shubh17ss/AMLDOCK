import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { tokens } from '../../../theme/theme.js';
import { ledgerSx, Footnote } from './ReportSection.jsx';
import { ownerTypeLabel } from './reportPalette.js';

/**
 * Owners on the window's deals, by type. Types with nobody in them are left out, so the table
 * stays as long as the firm's actual mix rather than all twelve types.
 */
export function OwnerTypeTable({ data }) {
  const rows = data.rows.filter((r) => r.owners > 0);
  if (rows.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: tokens.muted, py: 3 }}>
        No owners have been recorded on deals created in this window yet.
      </Typography>
    );
  }
  const n = (v) => v.toLocaleString('en-NZ');

  return (
    <>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={ledgerSx} aria-label="Owners by type">
          <TableHead>
            <TableRow>
              <TableCell>Owner type</TableCell>
              <TableCell align="right">Owners</TableCell>
              <TableCell align="right">Overseas residents</TableCell>
              <TableCell align="right">Re-used on other deals</TableCell>
              <TableCell align="right">Exceptions granted</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.ownerType}>
                <TableCell component="th" scope="row">{ownerTypeLabel(r.ownerType)}</TableCell>
                <TableCell align="right">{n(r.owners)}</TableCell>
                <TableCell align="right">{n(r.overseas)}</TableCell>
                <TableCell align="right">{n(r.reused)}</TableCell>
                <TableCell align="right">{n(r.exceptions)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="total">
              <TableCell component="th" scope="row">Total</TableCell>
              <TableCell align="right">{n(data.total.owners)}</TableCell>
              <TableCell align="right">{n(data.total.overseas)}</TableCell>
              <TableCell align="right">{n(data.total.reused)}</TableCell>
              <TableCell align="right">{n(data.total.exceptions)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      <Footnote>
        Every owner on both sides of a deal is counted, companies and trusts included, as on the CDD
        registers. Overseas residents and exceptions match the Overseas Residents Register and CDD
        Exceptions. Re-used counts owners who also appear on another of the firm's deals; only owners
        added with the owner picker are linked, so the true figure may be higher.
      </Footnote>
    </>
  );
}
