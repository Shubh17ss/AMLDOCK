import { Box, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { DealStatusChip } from './DealStatusChip.jsx';
import { opensDealForm } from '../data/dealStatus.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { formatDate } from '../utils/formatters.js';
import { tokens } from '../theme/theme.js';

/**
 * The deal list, shared by the Listing Register (/cdd/deals) and the firm-wide list
 * (/firm/deals). One component rather than two: the two pages used to render their own tables
 * and had drifted into different columns, different date formats and different ways in.
 *
 * <p>Six columns. The property is what anyone is actually scanning for, so it leads, in bold,
 * and it is the link — the reference, risk, type, value and client that used to sit around it
 * are all on the deal itself, one click away. Status stays: the tabs filter by it, but on the
 * All tab there would otherwise be no way to tell a new deal from an approved one.
 *
 * <p>`emptyState` takes a first-run screen where one is worth showing; `emptyMessage` is the
 * plain line for "nothing matches this filter", which is a different thing and wants no call
 * to action.
 */
export function DealsTable({ deals = [], emptyMessage = 'No deals yet.', emptyState = null }) {
  const { user } = useAuth();

  // Only the broker who owns an unfinished deal wants the form: finishing it is the one thing to
  // do with their own half-written deal, and it opens at the first unanswered section. Everyone
  // else — reviewers included — wants the deal page, where the ownership structure is.
  //
  // One predicate, read by both the property link and the View button, so the two cannot drift.
  const openPathFor = (d) => (opensDealForm(d, user) ? `/deals/${d.id}/edit` : `/deals/${d.id}`);

  // An address is null when every part of it is blank, and a row whose only label is an em dash
  // would be a dead end now that the reference column is gone.
  const propertyLabel = (d) => d.propertyAddress ?? d.reference ?? `#${d.id}`;

  if (deals.length === 0) {
    return emptyState ?? (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography sx={{ color: tokens.muted }}>{emptyMessage}</Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Property</TableCell>
            <TableCell>Users</TableCell>
            <TableCell>Created</TableCell>
            <TableCell>Updated</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {deals.map((d) => (
            <TableRow key={d.id} hover>
              {/* A real anchor rather than a row-level onClick: it opens in a new tab on a
                  middle-click, it is reachable from the keyboard, and it says where it goes. */}
              <TableCell>
                <Box
                  component={RouterLink}
                  to={openPathFor(d)}
                  sx={{
                    fontWeight: 700,
                    color: tokens.ink,
                    textDecoration: 'none',
                    '&:hover': { color: tokens.blue, textDecoration: 'underline' },
                  }}
                >
                  {propertyLabel(d)}
                </Box>
              </TableCell>
              {/* Who filed it. The name, falling back to the email for a user row since removed. */}
              <TableCell>{d.createdByName ?? d.createdByEmail ?? '—'}</TableCell>
              <TableCell sx={{ color: tokens.muted }}>{formatDate(d.createdAt)}</TableCell>
              <TableCell sx={{ color: tokens.muted }}>{formatDate(d.updatedAt)}</TableCell>
              <TableCell><DealStatusChip status={d.status} /></TableCell>
              <TableCell align="right">
                {/* `secondary` is the theme's ink-on-canvas button — black here, and it inverts
                    with the rest of the surface in dark mode. */}
                <Button
                  size="small"
                  variant="contained"
                  color="secondary"
                  component={RouterLink}
                  to={openPathFor(d)}
                >
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
