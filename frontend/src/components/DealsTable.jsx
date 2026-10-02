import { useState } from 'react';
import {
  Box, IconButton, Menu, MenuItem, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { DealStatusChip } from './DealStatusChip.jsx';
import { opensDealForm, transitionsFrom } from '../data/dealStatus.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { canDeleteDeal, canOverride, canWrite, isDealReviewer } from '../auth/roles.js';
import { DealStatusDialog } from '../features/deal/DealStatusDialog.jsx';
import { CloseDealDialog } from '../features/deal/CloseDealDialog.jsx';
import { DeleteDealDialog } from '../features/deal/DeleteDealDialog.jsx';
import { useDealStatusAction } from '../features/deal/useDealStatusAction.js';
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
/**
 * Everything a row can do, behind one button.
 *
 * <p>It replaced a View button, which was the only thing a row could do — changing a status
 * meant opening the deal, changing it and coming back, and deleting one was not possible from a
 * list at all.
 *
 * <p>The anchor is per row rather than one for the table: a single shared anchor would open the
 * last row's menu from the first row's button.
 *
 * <p>Each item is hidden rather than disabled when it does not apply, so the menu says what you
 * can do rather than what you cannot. The server remains the authority on all three.
 */
function DealRowMenu({ deal, openPath, user }) {
  const [anchor, setAnchor] = useState(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // The same hook the deal page uses, so the two cannot answer a verb differently. No onDone
  // navigation: this menu is already on the list the review screen would send you back to.
  const statusMut = useDealStatusAction(deal.id, {
    onDone: () => { setStatusOpen(false); setCloseOpen(false); },
  });

  const mayUpdateStatus = isDealReviewer(user?.role) && canWrite(user?.role)
    && (transitionsFrom(deal.status).length > 0 || canOverride(user?.role));
  const mayDelete = canDeleteDeal(user, deal);

  const close = () => setAnchor(null);

  return (
    <>
      <Tooltip title="Actions">
        <IconButton
          size="small"
          aria-label={`Actions for ${deal.propertyAddress ?? deal.reference ?? `deal ${deal.id}`}`}
          onClick={(e) => setAnchor(e.currentTarget)}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Menu open={Boolean(anchor)} anchorEl={anchor} onClose={close}>
        {/* A real link, so middle-click and the keyboard still work — and so a broker with an
            unfinished deal of their own lands on the form rather than the read-only page. */}
        <MenuItem component={RouterLink} to={openPath} onClick={close}>
          <VisibilityOutlinedIcon fontSize="small" sx={{ mr: 1 }} /> View
        </MenuItem>

        {mayUpdateStatus && (
          <MenuItem onClick={() => { close(); setStatusOpen(true); }}>
            <SwapHorizIcon fontSize="small" sx={{ mr: 1 }} /> Update status
          </MenuItem>
        )}

        {mayDelete && (
          <MenuItem
            sx={{ color: 'error.main' }}
            onClick={() => { close(); setDeleteOpen(true); }}
          >
            <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} /> Delete
          </MenuItem>
        )}
      </Menu>

      <DealStatusDialog
        open={statusOpen}
        deal={deal}
        canOverride={canOverride(user?.role)}
        onClose={() => setStatusOpen(false)}
        submitting={statusMut.isPending}
        onSubmit={(transition, reason) => {
          // Closing records an outcome as well as a position, so it hands over to the dialog
          // that asks for it — exactly as the deal page does.
          if (transition.action === 'close') {
            setStatusOpen(false);
            setCloseOpen(true);
            return Promise.resolve();
          }
          return statusMut.mutateAsync({ transition, reason });
        }}
      />

      <CloseDealDialog
        open={closeOpen}
        dealId={deal.id}
        // Straight off the row: DealListItemDto carries the property type so the register can
        // ask a development for a price per unit without fetching the whole deal first.
        isDevelopment={deal.propertyType === 'DEVELOPMENT'}
        onClose={() => setCloseOpen(false)}
        submitting={statusMut.isPending}
        onSubmit={(sale) => statusMut.mutateAsync({
          transition: { action: 'close', to: 'CLOSED', sale },
          reason: null,
        })}
      />

      <DeleteDealDialog
        open={deleteOpen}
        deal={deal}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => setDeleteOpen(false)}
      />
    </>
  );
}

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
                <DealRowMenu deal={d} openPath={openPathFor(d)} user={user} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
