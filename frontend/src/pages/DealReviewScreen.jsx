import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { assignDeal, getDeal } from '../api/deals.js';
import { DealStatusChip } from '../components/DealStatusChip.jsx';
import { OwnershipTreeBuilder } from '../features/ownership/OwnershipTreeBuilder.jsx';
import { NodeEditorPane } from '../features/ownership/NodeEditorPane.jsx';
import { AddNodeDialog } from '../features/ownership/AddNodeDialog.jsx';
import { PdfViewerPane } from '../features/ownership/PdfViewerPane.jsx';
import { useOwnershipTree } from '../features/ownership/useOwnershipTree.js';

const NZD = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 });

export function DealReviewScreen() {
  const { id } = useParams();
  const dealId = Number(id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [addDialog, setAddDialog] = useState(null);
  const [actionError, setActionError] = useState(null);

  const dealQ = useQuery({ queryKey: ['deals', dealId], queryFn: () => getDeal(dealId) });
  const tree = useOwnershipTree(dealId);

  const claimMut = useMutation({
    mutationFn: () => assignDeal(dealId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId] }),
    onError: (e) => setActionError(e.response?.data?.message || 'Failed to claim'),
  });

  if (dealQ.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }
  if (dealQ.isError) {
    return <Alert severity="error">Failed to load deal.</Alert>;
  }

  const deal = dealQ.data;
  const isFirstNode = !tree.tree || tree.tree.nodes.length === 0;
  const canClaim = deal.status === 'SUBMITTED';
  const isUnderReview = deal.status === 'UNDER_REVIEW';

  return (
    <Stack spacing={2} sx={{ height: 'calc(100vh - 110px)' }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/queue')}>Back to queue</Button>
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="h6">{deal.reference ?? `Deal #${deal.id}`}</Typography>
        <DealStatusChip status={deal.status} />
        <Chip label={deal.transactionType} size="small" variant="outlined" />
        {deal.transactionValueNzd != null && (
          <Chip label={NZD.format(deal.transactionValueNzd)} size="small" variant="outlined" />
        )}
        {canClaim && (
          <Button variant="contained" onClick={() => claimMut.mutate()} disabled={claimMut.isPending}>
            {claimMut.isPending ? 'Claiming…' : 'Claim for review'}
          </Button>
        )}
      </Stack>

      {actionError && <Alert severity="error" onClose={() => setActionError(null)}>{actionError}</Alert>}

      {!isUnderReview && !canClaim && (
        <Alert severity="info" sx={{ py: 0.5 }}>
          This deal is <strong>{deal.status}</strong>. Ownership edits are best made while UNDER_REVIEW.
        </Alert>
      )}

      <DealSummaryStrip deal={deal} />

      <Box sx={{ flexGrow: 1, minHeight: 0, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        <PanelGroup orientation="horizontal" style={{ height: '100%' }}>
          <Panel defaultSize={36} minSize={20}>
            <Box sx={{ height: '100%', p: 1, overflow: 'hidden' }}>
              <PdfViewerPane
                dealId={dealId}
                selectedDocumentId={selectedDocumentId}
                onSelectDocument={setSelectedDocumentId}
              />
            </Box>
          </Panel>

          <PanelResizeHandle><DragHandle /></PanelResizeHandle>

          <Panel defaultSize={34} minSize={22}>
            <Box sx={{ height: '100%', p: 1, overflow: 'auto' }}>
              <Paper variant="outlined" sx={{ p: 2, minHeight: '100%' }}>
                {tree.loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
                ) : tree.error ? (
                  <Alert severity="error">Failed to load ownership tree.</Alert>
                ) : (
                  <OwnershipTreeBuilder
                    tree={tree.tree}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={setSelectedNodeId}
                    onAddRoot={() => setAddDialog({ parentNodeId: null })}
                    onAddChild={(parentNodeId) => setAddDialog({ parentNodeId })}
                    onSetRoot={(nodeId) => tree.setRoot.mutate(nodeId)}
                  />
                )}
              </Paper>
            </Box>
          </Panel>

          <PanelResizeHandle><DragHandle /></PanelResizeHandle>

          <Panel defaultSize={30} minSize={22}>
            <Box sx={{ height: '100%', p: 1, overflow: 'hidden' }}>
              <NodeEditorPane
                tree={tree.tree}
                selectedNodeId={selectedNodeId}
                useTree={tree}
                onCleared={() => setSelectedNodeId(null)}
                dealId={dealId}
                onViewDocument={(docId) => setSelectedDocumentId(docId)}
              />
            </Box>
          </Panel>
        </PanelGroup>
      </Box>

      <AddNodeDialog
        open={Boolean(addDialog)}
        onClose={() => setAddDialog(null)}
        parentNodeId={addDialog?.parentNodeId ?? null}
        parentLabel={addDialog?.parentNodeId != null
          ? tree.tree?.nodes.find((n) => n.id === addDialog.parentNodeId)?.displayName
          : null}
        isFirstNode={isFirstNode}
        useTree={tree}
      />
    </Stack>
  );
}

function DragHandle() {
  return (
    <Box sx={{
      width: 6, height: '100%', bgcolor: 'divider',
      cursor: 'col-resize', '&:hover': { bgcolor: 'primary.main' },
    }} />
  );
}

function DealSummaryStrip({ deal }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" spacing={4} flexWrap="wrap">
        <SummaryItem label="Firm" value={deal.firmName} />
        <SummaryItem label="Branch" value={deal.branchName} />
        <SummaryItem label="Client" value={deal.client?.displayName} />
        <SummaryItem label="Property" value={[deal.property?.addressLine1, deal.property?.suburb, deal.property?.district].filter(Boolean).join(', ')} />
        <SummaryItem label="POC" value={[deal.pocName, deal.pocEmail].filter(Boolean).join(' · ')} />
      </Stack>
    </Paper>
  );
}

function SummaryItem({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2">{value || '—'}</Typography>
    </Box>
  );
}
