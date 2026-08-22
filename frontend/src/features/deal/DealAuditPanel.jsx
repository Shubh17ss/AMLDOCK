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
import { tokens, fonts } from '../../theme/theme.js';

/**
 * @param embedded true when this owns a whole tab, which makes the accordion around it
 *                 redundant — a section you have already navigated to should not ask to be
 *                 opened again.
 */
export function DealAuditPanel({ dealId, defaultExpanded = false, embedded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded || embedded);
  const q = useQuery({
    queryKey: ['audit', 'deal', dealId],
    queryFn: () => listAuditForDeal(dealId),
    enabled: Boolean(dealId) && expanded,
  });

  const body = (
    <>
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
                  <TableCell colSpan={4} align="center" sx={{ py: 3, color: tokens.muted }}>
                    Nothing recorded against this deal yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );

  if (embedded) {
    return (
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <Box>
            <Typography sx={{ fontFamily: fonts.display, fontSize: '1.05rem', color: tokens.ink }}>
              Audit trail
            </Typography>
            <Typography variant="caption" sx={{ color: tokens.muted }}>
              Every write against this deal, newest first
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Refresh">
            <span>
              <IconButton size="small" onClick={() => q.refetch()} disabled={q.isFetching}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
        {body}
      </Box>
    );
  }

  return (
    <Accordion expanded={expanded} onChange={(_, v) => setExpanded(v)} disableGutters sx={{borderRadius: 1.5}}>
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
      <AccordionDetails>{body}</AccordionDetails>
    </Accordion>
  );
}
