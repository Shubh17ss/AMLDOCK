import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { countryName, flagClass } from '../../data/countries.js';
import { tokens, fonts } from '../../theme/theme.js';

const dateFmt = new Intl.DateTimeFormat('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' });

/** A date of birth nobody has recorded, said as a gap rather than rendered as a blank. */
export function formatDob(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

/** ISO alpha-2 with its flag, or an em dash. Shared so both registers spell "unanswered" alike. */
export function CountryCell({ code }) {
  if (!code) return <Typography component="span" sx={{ color: tokens.muted }}>—</Typography>;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
      <span className={flagClass(code)} />
      <span>{countryName(code) ?? code}</span>
    </Box>
  );
}

/**
 * The rows both CDD people-registers show.
 *
 * <p>The same person on two deals is two rows on purpose. These registers answer "who has this
 * branch done diligence on, and against which file" — the file is half the answer, and collapsing
 * the duplicates would hide the more interesting fact, that someone turned up twice.
 */
export function IndividualsTable({ rows, loading, emptyMessage }) {
  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Date of birth</TableCell>
            <TableCell>Country of residence</TableCell>
            <TableCell>Property</TableCell>
            <TableCell>Deal</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.nodeId} hover>
              <TableCell>{r.displayName}</TableCell>
              <TableCell sx={{ fontFamily: fonts.mono, fontSize: '0.8rem' }}>
                {formatDob(r.dateOfBirth)}
              </TableCell>
              <TableCell><CountryCell code={r.countryOfResidence} /></TableCell>
              <TableCell>
                <Tooltip title={r.propertyAddress ?? ''}>
                  <Box sx={{ maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.propertyAddress ?? '—'}
                  </Box>
                </Tooltip>
              </TableCell>
              <TableCell>
                {/* Straight to the deal the person stands on — the register is a way in, not a
                    dead end. */}
                <Box component={RouterLink} to={`/deals/${r.dealId}`}
                     sx={{ fontFamily: fonts.mono, fontSize: '0.8rem', color: tokens.blue }}>
                  {r.dealReference}
                </Box>
              </TableCell>
            </TableRow>
          ))}
          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} align="center" sx={{ py: 5, color: tokens.muted }}>
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
