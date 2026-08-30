import { Box, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';
import { DealStatusChip } from './DealStatusChip.jsx';
import { RiskRatingChip } from './RiskRatingChip.jsx';
import { opensDealForm } from '../data/dealStatus.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { fonts } from '../theme/theme.js';
import { timeAgo } from '../utils/formatters.js';
import { useCurrency } from '../dashboard/useCurrency.js';
import { tokens } from '../theme/theme.js';

const mono = { fontFamily: fonts.mono, fontSize: '0.8rem' };

export function DealsTable({ deals = [], showFirm = false, emptyMessage = 'No deals yet.' }) {
  const navigate = useNavigate();
  const money = useCurrency();
  const { user } = useAuth();

  // Only the broker who owns an unfinished deal wants the form: finishing it is the one thing to
  // do with their own half-written deal, and it opens at the first unanswered section. Everyone
  // else — reviewers included — wants the deal page, where the ownership structure is.
  //
  // One predicate, read by both the link and the tooltip below, so the two cannot drift apart.
  const opensForm = (d) => opensDealForm(d, user);
  const openPathFor = (d) => (opensForm(d) ? `/deals/${d.id}/edit` : `/deals/${d.id}`);

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
                <Tooltip title={opensForm(d) ? 'Continue this deal' : 'Open'}>
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
