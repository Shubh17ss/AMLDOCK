import { Box, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';
import { DealStatusChip } from './DealStatusChip.jsx';

const NZD = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 });

export function DealsTable({ deals = [], showFirm = false, emptyMessage = 'No deals yet.' }) {
  const navigate = useNavigate();

  if (deals.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography color="text.secondary">{emptyMessage}</Typography>
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
            <TableCell>Value (NZD)</TableCell>
            {showFirm && <TableCell>Firm</TableCell>}
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
              <TableCell>{d.reference ?? `#${d.id}`}</TableCell>
              <TableCell><DealStatusChip status={d.status} /></TableCell>
              <TableCell>{d.transactionType}</TableCell>
              <TableCell>{d.transactionValueNzd != null ? NZD.format(d.transactionValueNzd) : '—'}</TableCell>
              {showFirm && <TableCell>{d.firmName ?? '—'}</TableCell>}
              <TableCell>{d.branchName ?? '—'}</TableCell>
              <TableCell>{d.clientDisplayName ?? '—'}</TableCell>
              <TableCell>{d.propertyAddress ?? '—'}</TableCell>
              <TableCell>{d.createdByEmail ?? '—'}</TableCell>
              <TableCell>{d.updatedAt ? new Date(d.updatedAt).toLocaleString() : '—'}</TableCell>
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
