import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Tab, Tabs, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import EditNoteIcon from '@mui/icons-material/EditNote';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { approveDeal, assignDeal, getDeal, overrideDeal, rejectDeal } from '../api/deals.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { isDealReviewer } from '../auth/roles.js';
import { DealStatusChip } from '../components/DealStatusChip.jsx';
import { OwnershipTreeBuilder } from '../features/ownership/OwnershipTreeBuilder.jsx';
import { NodeEditorPane } from '../features/ownership/NodeEditorPane.jsx';
import { AddNodeDialog } from '../features/ownership/AddNodeDialog.jsx';
import { AttachToParentDialog } from '../features/ownership/AttachToParentDialog.jsx';
import { PdfViewerPane } from '../features/ownership/PdfViewerPane.jsx';
import { useOwnershipTree } from '../features/ownership/useOwnershipTree.js';
import { BrokerNotesCard } from '../features/deal/BrokerNotesCard.jsx';
import { DecideDialog, OverrideDialog } from '../features/deal/DecisionDialogs.jsx';
import { DealAuditPanel } from '../features/deal/DealAuditPanel.jsx';
import { DealCapturedInfo } from '../features/deal/DealCapturedInfo.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { tokens, shadows } from '../theme/theme.js';

const NZD = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 });

const NEU_BASE   = tokens.tile;
const NEU_ACCENT = tokens.blue;
const NEU_MUTED  = tokens.muted;
const EXT_SM     = shadows.sm;
const INSET_SM   = 'inset 0 1px 2px rgba(16,24,40,0.06)';

export function DealReviewScreen() {
  const { id } = useParams();
  const dealId = Number(id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [selectedNodeId, setSelectedNodeId]     = useState(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [addDialog, setAddDialog]               = useState(null);
  const [attachNodeId, setAttachNodeId]         = useState(null);
  const [decideMode, setDecideMode]             = useState(null);
  const [overrideOpen, setOverrideOpen]         = useState(false);
  const [actionError, setActionError]           = useState(null);
  const [mobileTab, setMobileTab]               = useState('docs');

  const dealQ = useQuery({ queryKey: ['deals', dealId], queryFn: () => getDeal(dealId) });
  const tree  = useOwnershipTree(dealId);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['deals', dealId] });
    qc.invalidateQueries({ queryKey: ['deals', 'queue'] });
    qc.invalidateQueries({ queryKey: ['deals', 'mine'] });
    qc.invalidateQueries({ queryKey: ['deals', 'firm'] });
  };

  const claimMut = useMutation({
    mutationFn: () => assignDeal(dealId),
    onSuccess: () => { invalidate(); showToast({ severity: 'success', message: 'Claimed for review' }); },
    onError: (e) => {
      const msg = e.response?.data?.message || 'Failed to claim';
      setActionError(msg);
      showToast({ severity: 'error', message: msg });
    },
  });

  const decideMut = useMutation({
    mutationFn: ({ mode, notes }) =>
      (mode === 'approve' ? approveDeal(dealId, notes) : rejectDeal(dealId, notes)),
    onSuccess: (_, vars) => {
      invalidate();
      setDecideMode(null);
      showToast({
        severity: vars.mode === 'approve' ? 'success' : 'warning',
        message: `Deal ${vars.mode === 'approve' ? 'approved' : 'rejected'}`,
      });
      navigate('/queue');
    },
  });

  const overrideMut = useMutation({
    mutationFn: ({ targetStatus, reason }) => overrideDeal(dealId, targetStatus, reason),
    onSuccess: (_, vars) => {
      invalidate();
      setOverrideOpen(false);
      showToast({ severity: 'warning', message: `Status overridden to ${vars.targetStatus}` });
    },
  });

  if (dealQ.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }
  if (dealQ.isError) {
    return <Alert severity="error">Failed to load deal.</Alert>;
  }

  const deal        = dealQ.data;
  const isFirstNode = !tree.tree || tree.tree.nodes.length === 0;
  const canClaim    = deal.status === 'SUBMITTED';
  const isUnderReview = deal.status === 'UNDER_REVIEW';
  const isOverrider = user?.role === 'SENIOR_MANAGER';
  const canDecide   = isUnderReview;
  const canOverride = isOverrider && deal.status !== 'DRAFT';

  // Switch to node tab automatically when a node is selected on mobile
  const handleSelectNode = (nodeId) => {
    setSelectedNodeId(nodeId);
    if (isMobile && nodeId) setMobileTab('node');
  };

  return (
    // Let the page scroll instead of trapping everything in one viewport-height flexbox —
    // that clipped the info cards and squeezed the workspace panels on shorter screens.
    <Stack spacing={2}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      {isMobile ? (
        <MobileHeader
          deal={deal}
          canClaim={canClaim}
          canDecide={canDecide}
          canOverride={canOverride}
          claimMut={claimMut}
          onReject={() => setDecideMode('reject')}
          onApprove={() => setDecideMode('approve')}
          onOverride={() => setOverrideOpen(true)}
          onBack={() => navigate('/queue')}
        />
      ) : (
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/queue')}>
            Back to queue
          </Button>
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
          {canDecide && (
            <>
              <Button variant="outlined" color="error" onClick={() => setDecideMode('reject')}>Reject</Button>
              <Button
                variant="contained"
                sx={{
                  backgroundColor: '#2E8B57',
                  '&:hover': {
                    backgroundColor: '#2d905a',
                  },
                }}
                onClick={() => setDecideMode('approve')}
              >
                Approve
              </Button>
            </>
          )}
          {canOverride && (
            <Button variant="outlined" color="warning" onClick={() => setOverrideOpen(true)}>Override</Button>
          )}
        </Stack>
      )}

      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)}>{actionError}</Alert>
      )}

      {!isUnderReview && !canClaim && (
        <Alert severity="info" sx={{ py: 0.5 }}>
          This deal is <strong>{deal.status}</strong>. Ownership edits are best made while UNDER_REVIEW.
        </Alert>
      )}

      <DealCapturedInfo deal={deal} />

      {isDealReviewer(user?.role) && (
        <BrokerNotesCard deal={deal} />
      )}

      <DealAuditPanel dealId={dealId} />

      {/* ── Main panel area ──────────────────────────────────────────────── */}
      {isMobile ? (
        /* Mobile: tabs switching between the three panels */
        <Stack spacing={0}>
          <Box
            sx={{
              borderRadius: 3,
              boxShadow: INSET_SM,
              p: 0.5,
              display: 'flex',
              gap: 0.5,
            }}
          >
            {[
              { value: 'docs', label: 'Documents', icon: <ArticleOutlinedIcon sx={{ fontSize: 18 }} /> },
              { value: 'tree', label: 'Ownership', icon: <AccountTreeOutlinedIcon sx={{ fontSize: 18 }} /> },
              { value: 'node', label: 'Node', icon: <EditNoteIcon sx={{ fontSize: 18 }} />, disabled: !selectedNodeId },
            ].map((tab) => (
              <Box
                key={tab.value}
                onClick={() => !tab.disabled && setMobileTab(tab.value)}
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.75,
                  py: 1,
                  borderRadius: 2.5,
                  cursor: tab.disabled ? 'not-allowed' : 'pointer',
                  opacity: tab.disabled ? 0.4 : 1,
                  transition: 'box-shadow 0.25s ease, color 0.25s ease',
                  boxShadow: mobileTab === tab.value ? EXT_SM : 'none',
                  color: mobileTab === tab.value ? NEU_ACCENT : NEU_MUTED,
                  backgroundColor: NEU_BASE,
                  userSelect: 'none',
                }}
              >
                {tab.icon}
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700 }}>{tab.label}</Typography>
              </Box>
            ))}
          </Box>

          <Box sx={{ mt: 1.5 }}>
            {mobileTab === 'docs' && (
              <Box sx={{ height: '62vh', borderRadius: 2, overflow: 'hidden', boxShadow: INSET_SM }}>
                <PdfViewerPane
                  dealId={dealId}
                  selectedDocumentId={selectedDocumentId}
                  onSelectDocument={setSelectedDocumentId}
                />
              </Box>
            )}

            {mobileTab === 'tree' && (
              <Box sx={{ borderRadius: 2, p: 2, boxShadow: INSET_SM, minHeight: 300, maxHeight: '62vh', overflow: 'auto' }}>
                {tree.loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
                ) : tree.error ? (
                  <Alert severity="error">Failed to load ownership tree.</Alert>
                ) : (
                  <OwnershipTreeBuilder
                    tree={tree.tree}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={handleSelectNode}
                    onAddRoot={() => setAddDialog({ parentNodeId: null })}
                    onAddChild={(parentNodeId) => setAddDialog({ parentNodeId })}
                    onSetRoot={(nodeId) => tree.setRoot.mutate(nodeId)}
                    onAttachDetached={setAttachNodeId}
                  />
                )}
              </Box>
            )}

            {mobileTab === 'node' && (
              <Box sx={{ borderRadius: 2, overflow: 'hidden', height: '62vh', minHeight: 360 }}>
                <NodeEditorPane
                  tree={tree.tree}
                  selectedNodeId={selectedNodeId}
                  useTree={tree}
                  onCleared={() => { setSelectedNodeId(null); setMobileTab('tree'); }}
                  dealId={dealId}
                  onViewDocument={(docId) => { setSelectedDocumentId(docId); setMobileTab('docs'); }}
                />
              </Box>
            )}
          </Box>
        </Stack>
      ) : (
        /* Desktop: resizable 3-panel layout — its own bounded height with a floor so the
           panels stay usable regardless of how tall the info cards above grow. */
        <Box sx={{ height: 'calc(100vh - 160px)', minHeight: 560, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
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
                      onAttachDetached={setAttachNodeId}
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
      )}

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
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

      <DecideDialog
        open={Boolean(decideMode)}
        mode={decideMode}
        dealReference={deal.reference ?? `#${deal.id}`}
        onClose={() => setDecideMode(null)}
        submitting={decideMut.isPending}
        onSubmit={(notes) => decideMut.mutateAsync({ mode: decideMode, notes })}
      />

      <OverrideDialog
        open={overrideOpen}
        deal={deal}
        onClose={() => setOverrideOpen(false)}
        submitting={overrideMut.isPending}
        onSubmit={(targetStatus, reason) => overrideMut.mutateAsync({ targetStatus, reason })}
      />

      <AttachToParentDialog
        open={attachNodeId != null}
        node={tree.tree?.nodes.find((n) => n.id === attachNodeId) ?? null}
        tree={tree.tree}
        useTree={tree}
        onClose={() => setAttachNodeId(null)}
      />
    </Stack>
  );
}

/* ── Mobile-specific header ─────────────────────────────────────────────── */
function MobileHeader({ deal, canClaim, canDecide, canOverride, claimMut, onReject, onApprove, onOverride, onBack }) {
  const hasActions = canClaim || canDecide || canOverride;
  return (
    <Stack spacing={1.5}>
      {/* Row 1: back + reference */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          size="small"
          sx={{ flexShrink: 0 }}
        >
          Queue
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700, textAlign: 'right', lineHeight: 1.2 }}>
          {deal.reference ?? `Deal #${deal.id}`}
        </Typography>
      </Stack>

      {/* Row 2: status chips */}
      <Stack direction="row" spacing={1} flexWrap="wrap">
        <DealStatusChip status={deal.status} />
        <Chip label={deal.transactionType} size="small" />
        {deal.transactionValueNzd != null && (
          <Chip label={NZD.format(deal.transactionValueNzd)} size="small" />
        )}
      </Stack>

      {/* Row 3: action buttons (full-width, equal split) */}
      {hasActions && (
        <Stack direction="row" spacing={1}>
          {canClaim && (
            <Button
              variant="contained"
              fullWidth
              onClick={() => claimMut.mutate()}
              disabled={claimMut.isPending}
            >
              {claimMut.isPending ? 'Claiming…' : 'Claim'}
            </Button>
          )}
          {canDecide && (
            <>
              <Button variant="outlined" color="error" fullWidth onClick={onReject}>Reject</Button>
              <Button variant="contained" sx={{backgroundColor:'#2E8B57'}} fullWidth onClick={onApprove}>Approve</Button>
            </>
          )}
          {canOverride && (
            <Button variant="outlined" color="warning" fullWidth onClick={onOverride}>Override</Button>
          )}
        </Stack>
      )}
    </Stack>
  );
}

/* ── Desktop drag handle ─────────────────────────────────────────────────── */
function DragHandle() {
  return (
    <Box sx={{
      width: 6, height: '100%', bgcolor: 'divider',
      cursor: 'col-resize', '&:hover': { bgcolor: 'primary.main' },
    }} />
  );
}
