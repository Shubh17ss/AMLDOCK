import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, CircularProgress, Stack, Tab, Tabs, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  closeDeal, getDeal, holdDeal, overrideDeal, revertDeal, submitDealForReview, verifyDeal,
} from '../api/deals.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { canOverride, canWrite, isDealAuthor, isDealReviewer } from '../auth/roles.js';
import { DealStatusChip } from '../components/DealStatusChip.jsx';
import { RiskRatingChip } from '../components/RiskRatingChip.jsx';
import { OwnershipTreeBuilder } from '../features/ownership/OwnershipTreeBuilder.jsx';
import { AddNodeDialog } from '../features/ownership/AddNodeDialog.jsx';
import { AttachToParentDialog } from '../features/ownership/AttachToParentDialog.jsx';
import { useOwnershipTree } from '../features/ownership/useOwnershipTree.js';
import { NodeDrawer } from '../features/deal/review/NodeDrawer.jsx';
import { DealDrawer } from '../features/deal/review/DealDrawer.jsx';
import { ReviewTabPanel } from '../features/deal/review/ReviewTabPanel.jsx';
import { ParkedPanel } from '../features/deal/review/ParkedPanel.jsx';
import { DealStatusDialog } from '../features/deal/DealStatusDialog.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { tokens, fonts } from '../theme/theme.js';
import { useCurrency } from '../dashboard/useCurrency.js';
import { canEditContent, dealStatusLabel, isEditable, transitionsFrom } from '../data/dealStatus.js';

/**
 * The three faces of a deal under review.
 *
 * <p>Order is the reviewer's order: the structure is the work, so it opens first; the two parked
 * sections sit next to it because that is where they will belong; and the three reference
 * surfaces — what was captured, what was said, what happened — come after.
 */
const TABS = [
  { value: 'structure', label: 'Structure' },
  { value: 'echecks', label: 'eChecks' },
  { value: 'risk', label: 'Risk' },
];

const TAB_VALUES = TABS.map((t) => t.value);

export function DealReviewScreen() {
  const { id } = useParams();
  const dealId = Number(id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();

  // This screen answers to two addresses. Sending a firm-level viewer back to the CDD register
  // would drop them into a list they did not come from.
  const listPath = pathname.startsWith('/firm/') ? '/firm/deals' : '/cdd/deals';
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
  // The deal's own record — Details, Notes and the audit trail — opened from the property at the
  // head of the structure rather than from a tab beside it.
  const [dealDrawerOpen, setDealDrawerOpen] = useState(false);
  const [addDialog, setAddDialog]           = useState(null);
  const [attachNodeId, setAttachNodeId]     = useState(null);
  const [statusOpen, setStatusOpen]         = useState(false);
  const [actionError, setActionError]       = useState(null);

  const dealQ = useQuery({ queryKey: ['deals', dealId], queryFn: () => getDeal(dealId) });
  const tree  = useOwnershipTree(dealId);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['deals', dealId] });
    qc.invalidateQueries({ queryKey: ['deals', 'queue'] });
    qc.invalidateQueries({ queryKey: ['deals', 'mine'] });
    qc.invalidateQueries({ queryKey: ['deals', 'firm'] });
  };

  /** What each move is called once it has happened, and how loudly to say it. */
  const SAID = {
    submit:   { message: 'Sent to compliance for review', severity: 'success' },
    verify:   { message: 'Deal verified', severity: 'success' },
    hold:     { message: 'Deal put on hold', severity: 'warning' },
    revert:   { message: 'Sent back to the broker', severity: 'warning' },
    close:    { message: 'Deal closed', severity: 'success' },
  };

  /**
   * Every status change, through one mutation.
   *
   * <p>There were four, and between them they were the six buttons this screen used to carry.
   * They only ever differed in which endpoint they hit, so the dialog picks the row and this
   * reads the row's `action`.
   */
  const statusMut = useMutation({
    mutationFn: ({ transition, reason }) => {
      switch (transition.action) {
        case 'submit': return submitDealForReview(dealId);
        case 'hold':   return holdDeal(dealId, reason);
        case 'verify': return verifyDeal(dealId, reason);
        case 'revert': return revertDeal(dealId, reason);
        case 'close':  return closeDeal(dealId);
        default:       return overrideDeal(dealId, transition.to, reason);
      }
    },
    onSuccess: (_, vars) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['dealNotes', dealId] });
      setStatusOpen(false);
      setActionError(null);
      const said = SAID[vars.transition.action]
        ?? { message: `Status overridden to ${dealStatusLabel(vars.transition.to)}`, severity: 'warning' };
      showToast(said);
      // Verifying and sending back both end this reviewer's involvement for now; a hold does not,
      // so it stays on the deal.
      if (vars.transition.action === 'verify' || vars.transition.action === 'revert') {
        navigate(listPath);
      }
    },
    onError: (e) => setActionError(e.response?.data?.message || 'Could not update the status'),
  });

  if (dealQ.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }
  if (dealQ.isError) {
    return <Alert severity="error">Failed to load deal.</Alert>;
  }

  const deal        = dealQ.data;
  const isFirstNode = !tree.tree || tree.tree.nodes.length === 0;
  const isOwnerAgent = isDealAuthor(user?.role) && user?.userId === deal.createdByUserId;

  // A NEW deal in the broker's hands is unfinished, and finishing it is what the form is for — so
  // its author still gets the form rather than this screen. A reviewer does not: the work they do
  // on a NEW deal is the ownership structure, which exists only here, and the deal's own record is
  // editable in the drawer beside it. NewDealPage's guard is deliberately wider than this one, so
  // a reviewer who asks for the form by name still gets it and the two routes cannot bounce.
  if (isEditable(deal.status) && isOwnerAgent) {
    return <Navigate to={`/deals/${deal.id}/edit`} replace />;
  }

  /**
   * Whether this viewer may change anything on this deal.
   *
   * Until now the answer was "you reached this URL, so yes" — the route was reviewer-only and
   * the screen carried no check of its own. Now that a deal has one address, everyone arrives
   * here and the question has to be asked properly: the author or a firm reviewer, in a status
   * that still allows content changes, and never the auditor, who reads every screen in the
   * product and writes to none.
   */
  const mayEdit = (isOwnerAgent || isDealReviewer(user?.role))
    && canEditContent(deal.status, user?.role)
    && canWrite(user?.role);

  const showOverride = canOverride(user?.role);

  const selectedNode = tree.tree?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  // Whether the deal has anywhere to go, and whether this viewer is the one to take it there.
  // The role test used to be the router's job.
  const canUpdateStatus = isDealReviewer(user?.role)
    && (transitionsFrom(deal.status).length > 0 || showOverride);

  return (
    <Stack spacing={2}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(listPath)} size="small">
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

        {/* One button. It used to be up to six verbs, and "Verify" beside an ownership tree read
            as an action on the tree rather than on the deal. */}
        {canUpdateStatus && (
          <Stack direction="row" justifyContent="flex-end">
            <Button variant="contained" size="small" onClick={() => setStatusOpen(true)}>
              Update status
            </Button>
          </Stack>
        )}
      </Stack>

      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)}>{actionError}</Alert>
      )}

      {!mayEdit && (
        <Alert severity="info" sx={{ py: 0.5 }}>
          This deal is <strong>{dealStatusLabel(deal.status)}</strong> and is read-only for you.
          You can see everything on it; changing it is not yours to do from here.
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
            onSelectNode={(nodeId) => { setDealDrawerOpen(false); setSelectedNodeId(nodeId); }}
            onAddRoot={() => setAddDialog({ parentNodeId: null })}
            onAddChild={(parentNodeId) => setAddDialog({ parentNodeId })}
            onSetRoot={(nodeId) => tree.setRoot.mutate(nodeId)}
            onAttachDetached={setAttachNodeId}
            readOnly={!mayEdit}
            // Two right-hand drawers open at once would stack two backdrops on each other, so
            // opening either closes the other.
            onOpenDeal={() => { setSelectedNodeId(null); setDealDrawerOpen(true); }}
            dealSelected={dealDrawerOpen}
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

      {/* ── The deal itself ─────────────────────────────────────────────── */}
      <DealDrawer
        open={dealDrawerOpen}
        deal={deal}
        dealId={dealId}
        onClose={() => setDealDrawerOpen(false)}
        readOnly={!mayEdit}
        // Commenting is not editing — a reviewer may still add a note to a deal they can no
        // longer change. Only the auditor, who writes nothing anywhere, is kept out.
        canComment={canWrite(user?.role)}
      />

      {/* ── The selected owner ──────────────────────────────────────────── */}
      <NodeDrawer
        open={Boolean(selectedNode)}
        node={selectedNode}
        tree={tree.tree}
        useTree={tree}
        dealId={dealId}
        onClose={() => setSelectedNodeId(null)}
        readOnly={!mayEdit}
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
        // Straight into the panel that asks for everything the picker no longer does.
        onCreated={setSelectedNodeId}
      />

      <DealStatusDialog
        open={statusOpen}
        deal={deal}
        canOverride={showOverride}
        onClose={() => setStatusOpen(false)}
        submitting={statusMut.isPending}
        onSubmit={(transition, reason) => statusMut.mutateAsync({ transition, reason })}
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
