import { Box, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';
import { DealStatusChip } from './DealStatusChip.jsx';
import { RiskRatingChip } from './RiskRatingChip.jsx';
import { isEditable } from '../data/dealStatus.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { isDealAuthor, isDealReviewer } from '../auth/roles.js';
import { fonts } from '../theme/theme.js';
import { timeAgo } from '../utils/formatters.js';
import { useCurrency } from '../dashboard/useCurrency.js';
import { tokens } from '../theme/theme.js';

const mono = { fontFamily: fonts.mono, fontSize: '0.8rem' };

export function DealsTable({ deals = [], showFirm = false, emptyMessage = 'No deals yet.' }) {
  const navigate = useNavigate();
  const money = useCurrency();
  const { user } = useAuth();

  // A NEW deal is unfinished, and finishing it is the only thing to do with one — so for anyone
  // who may edit it, opening a NEW deal lands on the form (at the first unanswered section)
  // rather than on a read-only page with an Edit button on it.
  const mayEdit = isDealAuthor(user?.role) || isDealReviewer(user?.role);
  const openPathFor = (d) =>
    (mayEdit && isEditable(d.status) ? `/deals/${d.id}/edit` : `/deals/${d.id}`);

  if (deals.length === 0) {
    return (
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
            <TableCell>Reference</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Risk</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Value ({money.code})</TableCell>
            {showFirm && <TableCell>Reporting entity</TableCell>}
            <TableCell>Branch</TableCell>
            <TableCell>Client</TableCell>
            <TableCell>Property</TableCell>
            <TableCell>Created by</TableCell>
            <TableCell>Updated</TableCell>
            <TableCell align="right" />
          </TableRow>
        </TableHead>
        <TableBody>
          {deals.map((d) => (
            <TableRow key={d.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(openPathFor(d))}>
              <TableCell sx={mono}>{d.reference ?? `#${d.id}`}</TableCell>
              <TableCell><DealStatusChip status={d.status} /></TableCell>
              <TableCell><RiskRatingChip rating={d.riskRating} /></TableCell>
              <TableCell>{d.transactionType}</TableCell>
              {/* The broker's min–max estimate; pre-V28 deals fall back to their single value. */}
              <TableCell sx={mono}>{money.dealRange(d)}</TableCell>
              {showFirm && <TableCell>{d.firmName ?? '—'}</TableCell>}
              <TableCell>{d.branchName ?? '—'}</TableCell>
              <TableCell>{d.clientDisplayName ?? '—'}</TableCell>
              <TableCell>{d.propertyAddress ?? '—'}</TableCell>
              <TableCell>{d.createdByEmail ?? '—'}</TableCell>
              <TableCell sx={{ color: tokens.muted }}>{timeAgo(d.updatedAt)}</TableCell>
              <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                <Tooltip title={mayEdit && isEditable(d.status) ? 'Continue this deal' : 'Open'}>
                  <IconButton size="small" onClick={() => navigate(openPathFor(d))}>
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
