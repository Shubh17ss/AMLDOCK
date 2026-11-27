import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { ledgerSx, Footnote } from './ReportSection.jsx';
import { percent, propertyTypeLabel } from './reportPalette.js';

/**
 * Deals by property type, laid out like the reference report: what happened in the window, where
 * the book stands all time, and what closed deals sold for, each under its own band.
 */
export function PropertyTypeTable({ data, money, windowShort }) {
  const rows = [...data.rows, { ...data.total, propertyType: null }];
  const price = (v) => (v == null ? '—' : money.format(v));

  return (
    <>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={ledgerSx} aria-label="Deals by property type">
          <TableHead>
            <TableRow className="band">
              <TableCell />
              <TableCell colSpan={4} className="grouped">{windowShort}</TableCell>
              <TableCell colSpan={2} className="grouped">All time</TableCell>
              <TableCell colSpan={2} className="grouped">Sale prices, closed in window ({money.code})</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Property type</TableCell>
              <TableCell align="right" className="groupStart">Created</TableCell>
              <TableCell align="right">Share</TableCell>
              <TableCell align="right">Verified</TableCell>
              <TableCell align="right">Closed</TableCell>
              <TableCell align="right" className="groupStart">Verified</TableCell>
              <TableCell align="right">Unverified</TableCell>
              <TableCell align="right" className="groupStart">Average</TableCell>
              <TableCell align="right">Highest</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => {
              const total = r.propertyType === null;
              return (
                <TableRow key={r.propertyType ?? 'total'} className={total ? 'total' : undefined}>
                  <TableCell component="th" scope="row">{total ? 'Total' : propertyTypeLabel(r.propertyType)}</TableCell>
                  <TableCell align="right" className="groupStart">{r.created.toLocaleString('en-NZ')}</TableCell>
                  <TableCell align="right">{percent(r.createdPercent)}</TableCell>
                  <TableCell align="right">{r.verified.toLocaleString('en-NZ')}</TableCell>
                  <TableCell align="right">{r.closed.toLocaleString('en-NZ')}</TableCell>
                  <TableCell align="right" className="groupStart">{r.verifiedAllTime.toLocaleString('en-NZ')}</TableCell>
                  <TableCell align="right">{r.unverifiedAllTime.toLocaleString('en-NZ')}</TableCell>
                  <TableCell align="right" className="groupStart">{price(r.averageSalePrice)}</TableCell>
                  <TableCell align="right">{price(r.maxSalePrice)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Footnote>
        Created and share count deals created in the window. Verified and closed count deals signed
        off or closed in the window, whenever they were created, if they still stand that way. A
        development's sale price is the total of its units.
      </Footnote>
    </>
  );
}
