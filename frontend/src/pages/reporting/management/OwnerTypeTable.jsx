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
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.ownerType}>
                <TableCell component="th" scope="row">{ownerTypeLabel(r.ownerType)}</TableCell>
                <TableCell align="right">{n(r.owners)}</TableCell>
                <TableCell align="right">{n(r.overseas)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="total">
              <TableCell component="th" scope="row">Total</TableCell>
              <TableCell align="right">{n(data.total.owners)}</TableCell>
              <TableCell align="right">{n(data.total.overseas)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      <Footnote>
        Each owner is counted once, however many deals it is on. Owners added from another deal with
        the owner picker are recognised as the same owner; owners typed in separately are not.
        Companies and trusts are counted as well as people, on both sides of a deal. Whether an owner
        is an overseas resident follows the most recent deal it appears on.
      </Footnote>
    </>
  );
}
