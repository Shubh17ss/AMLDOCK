import { Box, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';
import { DealStatusChip } from './DealStatusChip.jsx';
import { fonts } from '../theme/theme.js';
import { timeAgo } from '../utils/formatters.js';
import { useCurrency } from '../dashboard/useCurrency.js';
import { tokens } from '../theme/theme.js';

const mono = { fontFamily: fonts.mono, fontSize: '0.8rem' };

export function DealsTable({ deals = [], showFirm = false, emptyMessage = 'No deals yet.' }) {
  const navigate = useNavigate();
  const money = useCurrency();

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
            <TableRow key={d.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/deals/${d.id}`)}>
              <TableCell sx={mono}>{d.reference ?? `#${d.id}`}</TableCell>
              <TableCell><DealStatusChip status={d.status} /></TableCell>
              <TableCell>{d.transactionType}</TableCell>
              <TableCell sx={mono}>{money.format(d.transactionValue)}</TableCell>
              {showFirm && <TableCell>{d.firmName ?? '—'}</TableCell>}
              <TableCell>{d.branchName ?? '—'}</TableCell>
              <TableCell>{d.clientDisplayName ?? '—'}</TableCell>
              <TableCell>{d.propertyAddress ?? '—'}</TableCell>
              <TableCell>{d.createdByEmail ?? '—'}</TableCell>
              <TableCell sx={{ color: tokens.muted }}>{timeAgo(d.updatedAt)}</TableCell>
              <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                <Tooltip title="Open">
                  <IconButton size="small" onClick={() => navigate(`/deals/${d.id}`)}>
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
