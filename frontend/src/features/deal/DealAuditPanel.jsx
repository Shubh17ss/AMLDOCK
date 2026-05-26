import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, CircularProgress,
  IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tooltip, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import { listAuditForDeal } from '../../api/audit.js';
import { AuditActionChip } from '../../components/AuditActionChip.jsx';

export function DealAuditPanel({ dealId, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const q = useQuery({
    queryKey: ['audit', 'deal', dealId],
    queryFn: () => listAuditForDeal(dealId),
    enabled: Boolean(dealId) && expanded,
  });

  return (
    <Accordion expanded={expanded} onChange={(_, v) => setExpanded(v)} disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
          <Typography variant="subtitle1">Audit trail</Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Refresh">
            <span>
              <IconButton size="small"
                          onClick={(e) => { e.stopPropagation(); q.refetch(); }}
                          disabled={!expanded || q.isFetching}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        {q.isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
        )}
        {q.isError && <Alert severity="error">Failed to load audit trail.</Alert>}
        {q.data && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Actor</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Summary</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {q.data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{row.actorEmail ?? 'system'}</TableCell>
                    <TableCell><AuditActionChip action={row.action} /></TableCell>
                    <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{row.summary}</TableCell>
                  </TableRow>
                ))}
                {q.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      No audit entries.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
