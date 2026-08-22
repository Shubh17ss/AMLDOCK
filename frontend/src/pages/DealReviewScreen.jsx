import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, CircularProgress, Stack, Tab, Tabs, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { closeDeal, getDeal, holdDeal, overrideDeal, revertDeal, startDealReview, verifyDeal } from '../api/deals.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { DealStatusChip } from '../components/DealStatusChip.jsx';
import { RiskRatingChip } from '../components/RiskRatingChip.jsx';
import { OwnershipTreeBuilder } from '../features/ownership/OwnershipTreeBuilder.jsx';
import { AddNodeDialog } from '../features/ownership/AddNodeDialog.jsx';
import { AttachToParentDialog } from '../features/ownership/AttachToParentDialog.jsx';
import { useOwnershipTree } from '../features/ownership/useOwnershipTree.js';
import { NodeDrawer } from '../features/deal/review/NodeDrawer.jsx';
import { ReviewTabPanel } from '../features/deal/review/ReviewTabPanel.jsx';
import { ParkedPanel } from '../features/deal/review/ParkedPanel.jsx';
import { DealNotesTimeline } from '../features/deal/DealNotesTimeline.jsx';
import { OverrideDialog, StatusNoteDialog } from '../features/deal/DecisionDialogs.jsx';
import { DealAuditPanel } from '../features/deal/DealAuditPanel.jsx';
import { DealCapturedInfo } from '../features/deal/DealCapturedInfo.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { tokens, fonts } from '../theme/theme.js';
import { useCurrency } from '../dashboard/useCurrency.js';
import { canClose, canHold, canRevert, canStartReview, canVerify, dealStatusLabel } from '../data/dealStatus.js';

/** Wording for the three verbs that require a note. Keyed by the value held in `noteAction`. */
const NOTE_DIALOGS = {
  hold: {
    title: 'Put this deal on hold?',
    prompt: "It stays with compliance, parked. Say what you're waiting on — the broker sees this on the deal's timeline.",
    confirmLabel: 'Put on hold', color: 'warning',
  },
  verify: {
    title: 'Verify this deal?',
    prompt: 'Record what you checked. This is the compliance sign-off and it is kept against the deal.',
    confirmLabel: 'Verify', color: 'success',
  },
  revert: {
    title: 'Send this deal back?',
    prompt: "It returns to NEW so the broker can make changes. Say what needs doing — they see this on the deal's timeline.",
    confirmLabel: 'Send back', color: 'primary',
  },
};

/**
 * The six faces of a deal under review.
 *
 * <p>Order is the reviewer's order: the structure is the work, so it opens first; the two parked
 * sections sit next to it because that is where they will belong; and the three reference
 * surfaces — what was captured, what was said, what happened — come after.
 */
const TABS = [
  { value: 'structure', label: 'Structure' },
  { value: 'echecks', label: 'eChecks' },
  { value: 'risk', label: 'Risk' },
  { value: 'details', label: 'Details' },
  { value: 'notes', label: 'Notes' },
  { value: 'audit', label: 'Audit trail' },
];

const TAB_VALUES = TABS.map((t) => t.value);

export function DealReviewScreen() {
  const { id } = useParams();
  const dealId = Number(id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const money = useCurrency();

  // The tab lives in the URL so a reload keeps your place and a link can point at one. An
  // unknown or missing value falls back rather than rendering nothing.
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab = TAB_VALUES.includes(requested) ? requested : 'structure';
  const setTab = (next) => {
    const merged = new URLSearchParams(params);
    merged.set('tab', next);
    setParams(merged, { replace: true });
  };

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [addDialog, setAddDialog]           = useState(null);
  const [attachNodeId, setAttachNodeId]     = useState(null);
  // Which note-taking dialog is open: 'hold' | 'verify' | 'revert' | null.
  const [noteAction, setNoteAction]         = useState(null);
  const [overrideOpen, setOverrideOpen]     = useState(false);
  const [actionError, setActionError]       = useState(null);

  const dealQ = useQuery({ queryKey: ['deals', dealId], queryFn: () => getDeal(dealId) });
  const tree  = useOwnershipTree(dealId);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['deals', dealId] });
    qc.invalidateQueries({ queryKey: ['deals', 'queue'] });
    qc.invalidateQueries({ queryKey: ['deals', 'mine'] });
    qc.invalidateQueries({ queryKey: ['deals', 'firm'] });
  };

  const startReviewMut = useMutation({
    mutationFn: () => startDealReview(dealId),
    onSuccess: () => { invalidate(); showToast({ severity: 'success', message: 'Review started' }); },
    onError: (e) => {
      const msg = e.response?.data?.message || 'Could not start the review';
      setActionError(msg);
      showToast({ severity: 'error', message: msg });
    },
  });

  const closeMut = useMutation({
    mutationFn: () => closeDeal(dealId),
    onSuccess: () => { invalidate(); showToast({ severity: 'success', message: 'Deal closed' }); },
    onError: (e) => setActionError(e.response?.data?.message || 'Could not close the deal'),
  });

  /**
   * The three verbs that carry a note. One mutation rather than three: they differ only in which
   * endpoint they hit and where the reviewer ends up afterwards.
   */
  const noteMut = useMutation({
    mutationFn: ({ action, note }) => {
      if (action === 'hold') return holdDeal(dealId, note);
      if (action === 'verify') return verifyDeal(dealId, note);
      return revertDeal(dealId, note);
    },
    onSuccess: (_, vars) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['dealNotes', dealId] });
      setNoteAction(null);
      const said = { hold: 'Deal put on hold', verify: 'Deal verified', revert: 'Sent back to the broker' };
      showToast({ severity: vars.action === 'verify' ? 'success' : 'warning', message: said[vars.action] });
      // Verifying and reverting both end this reviewer's involvement for now; a hold does not,
      // so it stays on the deal.
      if (vars.action !== 'hold') navigate('/cdd/deals');
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
  const startable   = canStartReview(deal.status);
  const inReview    = deal.status === 'REVIEW';
  const showOverride = user?.role === 'SENIOR_MANAGER';

  const selectedNode = tree.tree?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  /**
   * What this reviewer can do to the deal right now. Mirrors DealLifecycleService.RULES; the
   * server rejects anything this lets through.
   */
  const actions = [
    startable && {
      key: 'start', label: 'Start review', variant: 'contained',
      onClick: () => startReviewMut.mutate(), pending: startReviewMut.isPending,
    },
    canHold(deal.status) && {
      key: 'hold', label: 'Put on hold', variant: 'outlined', color: 'warning',
      onClick: () => setNoteAction('hold'),
    },
    canVerify(deal.status) && {
      key: 'verify', label: 'Verify', variant: 'contained', color: 'success',
      onClick: () => setNoteAction('verify'),
    },
    canClose(deal.status) && {
      key: 'close', label: 'Close deal', variant: 'contained',
      onClick: () => closeMut.mutate(), pending: closeMut.isPending,
    },
    canRevert(deal.status) && {
      key: 'revert', label: 'Send back', variant: 'outlined',
      onClick: () => setNoteAction('revert'),
    },
    showOverride && {
      key: 'override', label: 'Override', variant: 'outlined', color: 'warning',
      onClick: () => setOverrideOpen(true),
    },
  ].filter(Boolean);

  return (
    <Stack spacing={2}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/cdd/deals')} size="small">
            Back to queue
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Typography sx={{ fontFamily: fonts.display, fontSize: '1.1rem', color: tokens.ink }}>
            {deal.reference ?? `Deal #${deal.id}`}
          </Typography>
          <DealStatusChip status={deal.status} />
          <RiskRatingChip rating={deal.riskRating} hideWhenUnset />
          <Chip label={deal.transactionType} size="small" variant="outlined" />
          {(deal.valuationMin != null || deal.valuationMax != null || deal.transactionValue != null) && (
            <Chip label={`${money.code} ${money.dealRange(deal)}`} size="small" variant="outlined" />
          )}
        </Stack>

        {actions.length > 0 && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
            {actions.map((a) => (
              <Button key={a.key} variant={a.variant} color={a.color} size="small"
                      onClick={a.onClick} disabled={a.pending}>
                {a.pending ? 'Working…' : a.label}
              </Button>
            ))}
          </Stack>
        )}
      </Stack>

      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)}>{actionError}</Alert>
      )}

      {!inReview && !startable && (
        <Alert severity="info" sx={{ py: 0.5 }}>
          This deal is <strong>{dealStatusLabel(deal.status)}</strong>. Ownership edits are best
          made while it is in review.
        </Alert>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          borderBottom: `1px solid ${tokens.hairline}`,
          minHeight: 44,
          '& .MuiTab-root': {
            minHeight: 44,
            textTransform: 'none',
            fontSize: '0.9rem',
            fontFamily: fonts.body,
          },
        }}
      >
        {TABS.map((t) => (
          <Tab
            key={t.value}
            value={t.value}
            label={t.label}
            id={`deal-tab-${t.value}`}
            aria-controls={`deal-panel-${t.value}`}
          />
        ))}
      </Tabs>

      {/* ── Panels ──────────────────────────────────────────────────────── */}
      <ReviewTabPanel value="structure" current={tab}>
        {tree.loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : tree.error ? (
          <Alert severity="error">Failed to load the ownership structure.</Alert>
        ) : (
          <OwnershipTreeBuilder
            tree={tree.tree}
            deal={deal}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onAddRoot={() => setAddDialog({ parentNodeId: null })}
            onAddChild={(parentNodeId) => setAddDialog({ parentNodeId })}
            onSetRoot={(nodeId) => tree.setRoot.mutate(nodeId)}
            onAttachDetached={setAttachNodeId}
          />
        )}
      </ReviewTabPanel>

      <ReviewTabPanel value="echecks" current={tab}>
        <ParkedPanel title="Electronic checks">
          Identity, address and register checks for every party on this deal will run here, with
          each result kept as evidence against the party it belongs to.
        </ParkedPanel>
      </ReviewTabPanel>

      <ReviewTabPanel value="risk" current={tab}>
        <ParkedPanel title="Risk assessment">
          The rating in the header is derived from the deal's answers and its ownership structure.
          The workings behind it — every factor, and what a reviewer decided about each — will be
          shown here.
        </ParkedPanel>
      </ReviewTabPanel>

      <ReviewTabPanel value="details" current={tab}>
        <DealCapturedInfo deal={deal} embedded />
      </ReviewTabPanel>

      <ReviewTabPanel value="notes" current={tab}>
        <DealNotesTimeline dealId={dealId} status={deal.status} />
      </ReviewTabPanel>

      <ReviewTabPanel value="audit" current={tab}>
        <DealAuditPanel dealId={dealId} embedded />
      </ReviewTabPanel>

      {/* ── The selected owner ──────────────────────────────────────────── */}
      <NodeDrawer
        open={Boolean(selectedNode)}
        node={selectedNode}
        tree={tree.tree}
        useTree={tree}
        dealId={dealId}
        onClose={() => setSelectedNodeId(null)}
      />

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}
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

      <StatusNoteDialog
        open={Boolean(noteAction)}
        title={NOTE_DIALOGS[noteAction]?.title}
        prompt={NOTE_DIALOGS[noteAction]?.prompt}
        confirmLabel={NOTE_DIALOGS[noteAction]?.confirmLabel}
        confirmColor={NOTE_DIALOGS[noteAction]?.color}
        onClose={() => setNoteAction(null)}
        submitting={noteMut.isPending}
        onSubmit={(note) => noteMut.mutateAsync({ action: noteAction, note })}
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
