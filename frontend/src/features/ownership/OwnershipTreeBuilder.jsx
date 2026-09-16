import { Fragment, useCallback, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, IconButton, Menu, MenuItem, Stack, Tooltip, Typography,
} from '@mui/material';
import { DndContext, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddLinkIcon from '@mui/icons-material/AddLink';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import { isLeafOnlyType, nodeTypeLabel, personRolesLabel, trustTypeLabel } from '../../api/ownership.js';
import { countryName } from '../../data/countries.js';
import { formatPropertyAddress } from '../../data/addressFinderMeta.js';
import { propertyTypeLabel } from '../../data/propertyTypes.js';
import { visualFor, tintOf, washOf, edgeOf } from './nodeTypeVisual.js';
import {
  PROPERTY_DROP_ID, dragIdFor, dropIdForNode, gapDropId, sortSiblings,
} from './dragModel.js';
import { useOwnershipDrag } from './useOwnershipDrag.js';
import { tokens, fonts, motion } from '../../theme/theme.js';

const VERIFICATION_COLOR = {
  NOT_STARTED: 'default',
  IN_PROGRESS: 'info',
  VERIFIED: 'success',
  FAILED: 'error',
};

/** Rows fade in one after another on first paint, and never again. */
const STAGGER_MS = 30;
const STAGGER_CAP = 10;   // ~300ms for the whole tree, however deep it goes

/** Nothing is dragging, so nothing needs dimming. One frozen object rather than a new one a render. */
const NO_DRAG = {
  enabled: false,
  settled: false,
  activeDrag: null,
  overId: null,
  rejections: new Map(),
  forceExpandedIds: new Set(),
};

/**
 * The second line of a node card: what this owner is to this deal.
 *
 * <p>Type alone is nearly useless to a reviewer — half the tree is a company of some sort. What
 * they need at a glance is the distinguishing fact: which jurisdiction, which capacity, what kind
 * of trust. Only what is actually recorded appears; nothing is padded with "not stated".
 */
function subtitleFor(node) {
  const parts = [nodeTypeLabel(node.nodeType)];
  // Every capacity, not the first: a settlor who is also the trustee is a different read.
  const roles = personRolesLabel(node.personRoles);
  if (roles) parts.push(roles);
  if (node.jurisdictionCountry) parts.push(countryName(node.jurisdictionCountry));
  if (node.trustType) parts.push(trustTypeLabel(node.trustType));
  return parts.join(' · ');
}

/**
 * Why this node pushed the deal to High risk, or null.
 *
 * <p>The same three answers {@code DealRiskService.reason} checks, phrased the same way. Two
 * copies of a rule will disagree eventually, so if this grows a fourth case the server's version
 * is the one to read.
 */
function riskReasonFor(node) {
  if (node.nomineeStatus === 'YES') {
    return node.nodeType === 'LIMITED_PARTNERSHIP'
      ? 'Reports a nominee limited partner — this sets the deal to High risk'
      : 'Reports a nominee director or shareholder — this sets the deal to High risk';
  }
  if (node.companyComplexOwnership === true) {
    return 'Reports a complex ownership structure — this sets the deal to High risk';
  }
  if (node.trustHoldingComplexity === 'EXTENSIVE_DIVERSE_PORTFOLIO') {
    return 'Holds an extensive or diverse asset portfolio — this sets the deal to High risk';
  }
  return null;
}

export function OwnershipTreeBuilder({
  tree,
  deal,
  selectedNodeId,
  onSelectNode,
  onAddRoot,
  onAddChild,
  onAttachDetached,
  onChangeOwner,
  onDetachFromParent,
  onDeleteNode,
  // Hides every control that changes the chain, leaving the chain itself readable. Selecting a
  // node still works — looking at an owner is not editing one.
  readOnly = false,
  /**
   * The live tree's mutations, for dragging a row to a new owner. Absent on a historical version,
   * which has nothing to mutate, and unused when `readOnly` — in either case the tree draws
   * exactly as it always did, with no drag context and no listeners on any row.
   */
  useTree = null,
  /** Opens the deal itself, from the property at the head of the chain. */
  onOpenDeal,
  dealSelected = false,
}) {
  const { nodesById, childrenByParent, parentIdByChild } = useMemo(() => indexTree(tree), [tree]);

  const dragEnabled = !readOnly && Boolean(useTree?.moveNode);
  const liveDrag = useOwnershipDrag({ tree, useTree, enabled: dragEnabled });
  const drag = dragEnabled ? liveDrag : NO_DRAG;

  // Every node with no owner above it, on equal terms. There is no privileged head of the chain:
  // a node sitting at the top level is a finished answer — "this person owns the property" — and
  // not a loose end. The structure used to single one out as the root, which bought nothing (the
  // risk rules never read it) and cost two bugs: a starred node with no actions but Delete, and a
  // "make top of the chain" that moved the pointer without moving the edge, so the node drew twice.
  const topLevel = useMemo(() => (tree?.nodes ?? [])
    .filter((n) => !parentIdByChild.has(n.id))
    .sort(sortSiblings), [tree, parentIdByChild]);

  if (!tree) return null;

  // One counter threaded through the render so the stagger follows reading order rather than
  // restarting at each branch.
  const order = { i: 0 };

  const branchProps = {
    nodesById,
    childrenByParent,
    selectedNodeId,
    onSelectNode,
    onAddChild,
    onAttachDetached,
    onChangeOwner,
    onDetachFromParent,
    onDeleteNode,
    readOnly,
    dragEnabled,
    drag,
    order,
  };

  const body = (
    <Box
      sx={{
        border: `1px solid ${tokens.hairline}`,
        borderRadius: 3,
        backgroundColor: tokens.tile,
        overflow: 'hidden',
      }}
    >
      {deal && (
        <PropertyAnchor
          deal={deal}
          onOpen={onOpenDeal}
          selected={dealSelected}
          drag={drag}
          dragEnabled={dragEnabled}
        />
      )}

      <Box sx={{ px: { xs: 1, sm: 2 }, py: 2 }}>
        {tree.nodes.length === 0 ? (
          <Alert severity="info" sx={{ m: 0 }}>
            Nothing here yet. Add the entity or person that owns this property — everyone else
            hangs off them.
          </Alert>
        ) : (
          <>
            {topLevel.map((n, i) => (
              <Fragment key={n.id}>
                <SiblingGap parentKey="top" index={i} drag={drag} dragEnabled={dragEnabled} />
                <NodeBranch node={n} parentEdge={null} depth={0} {...branchProps} />
              </Fragment>
            ))}
            <SiblingGap
              parentKey="top"
              index={topLevel.length}
              drag={drag}
              dragEnabled={dragEnabled}
            />
          </>
        )}
      </Box>
    </Box>
  );

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Box>
          <Typography sx={{ fontFamily: fonts.display, fontSize: '1.05rem', color: tokens.ink }}>
            Ownership structure
          </Typography>
          {/* <Typography variant="caption" sx={{ color: tokens.muted }}>
            {dragEnabled
              ? 'Who stands behind this property, down to the people — drag a row onto an owner to move it'
              : 'Who stands behind this property, down to the people'}
          </Typography> */}
        </Box>
        {!readOnly && (
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={onAddRoot}>
            Add owner
          </Button>
        )}
      </Stack>

      {/* Read-only renders the same markup with no context around it — the version snapshot has no
          mutations to call, and an auditor has nothing to move. */}
      {dragEnabled ? (
        <DndContext {...drag.contextProps}>
          {body}
          {/* The carried card lives in a portal at the document root, so the row it came from is
              never transformed and no ancestor's overflow or transform can clip it. That is also
              what keeps Safari honest: a drag image anchored inside a transformed ancestor is the
              oldest bug in this area. */}
          <DragOverlay dropAnimation={{ duration: 180, easing: motion.ease }}>
            {drag.activeDrag?.node ? <NodeGhost node={drag.activeDrag.node} /> : null}
          </DragOverlay>
        </DndContext>
      ) : body}
    </Stack>
  );
}

/**
 * The property the deal is about, at the head of the chain.
 *
 * <p>Still not a tree row: no type chip, no menu, and none of the chain's own actions can aim at
 * it — a reviewer reaching for "Make root" must never land here. It is the deal's property rather
 * than an ownership node, and it sits at the top because a chain of owners with nothing above
 * them reads as a list.
 *
 * <p>It does open the deal, though. Everything else in this tree opens a drawer when you click
 * it, and the property is where a reader already looks for "what is this deal" — so it opens the
 * deal drawer rather than an owner one. Opening is not editing, so `readOnly` does not gate it,
 * exactly as it does not gate selecting a node.
 *
 * <p>During a drag it is also the one place to drop a row that should stop belonging to anyone:
 * releasing here cuts the link above it and returns it to the top of the chain. That is the same
 * edit as "Detach from parent", aimed rather than chosen.
 */
function PropertyAnchor({ deal, onOpen, selected = false, drag = NO_DRAG, dragEnabled = false }) {
  const p = deal.property ?? {};
  const address = formatPropertyAddress(p) || 'Property address not recorded';
  const detail = [
    p.propertyType ? propertyTypeLabel(p.propertyType) : null,
    'the property this deal concerns',
  ].filter(Boolean).join(' · ');

  const { setNodeRef } = useDroppable({ id: PROPERTY_DROP_ID, disabled: !dragEnabled });
  // Only a row that has an owner has anything to detach, so the band offers itself to those and
  // stays quiet for a row already at the top of the chain.
  const armed = Boolean(drag.activeDrag?.edgeId);
  const isOver = armed && drag.overId === PROPERTY_DROP_ID;

  return (
    <Stack
      ref={setNodeRef}
      direction="row"
      spacing={1.5}
      alignItems="center"
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-pressed={onOpen ? selected : undefined}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (!onOpen) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); }
      }}
      sx={motion.respectful({
        px: { xs: 1.5, sm: 2.5 },
        py: 1.75,
        backgroundColor: isOver ? tokens.blueWash : (selected ? tokens.blueWash : tokens.tileRaised),
        borderBottom: `1px solid ${tokens.hairline}`,
        cursor: onOpen ? 'pointer' : 'default',
        // An inset bar rather than a border: this band is full-bleed with no border of its own,
        // so anything outset would either be clipped by the parent's overflow or move the row.
        // Under a drag it thickens into a full ring — the band is a target now, not a header.
        boxShadow: isOver
          ? `inset 0 0 0 2px ${tokens.blue}`
          : (selected ? `inset 3px 0 0 ${tokens.blue}` : 'none'),
        transition: `background-color ${motion.swift} ease, box-shadow ${motion.swift} ease`,
        '&:hover': onOpen
          ? { backgroundColor: selected ? tokens.blueWash : tokens.hover }
          : {},
        '&:focus-visible': { outline: `2px solid ${tokens.blue}`, outlineOffset: -2 },
      })}
    >
      <Box
        sx={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          display: 'grid', placeItems: 'center',
          backgroundColor: tokens.blueWash, color: tokens.blue,
        }}
      >
        <HomeWorkOutlinedIcon fontSize="small" />
      </Box>
      <Box sx={{ minWidth: 0}}>
        {/* Bold, like the owners directly beneath it. This is the head of the whole chain, and
            at regular weight it read as subordinate to the nodes it owns. Unconditional — there
            is only ever one property — and a notch larger than a node name at 0.9rem. */}
        <Typography
          sx={{
            fontFamily: fonts.display, fontSize: '0.94rem', fontWeight: 700, color: tokens.ink,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {address.toUpperCase()}
        </Typography>
        <Typography variant="caption" sx={{ color: tokens.muted }}>
          {/* The band says what it is at rest and what it will do mid-drag. A drop target that
              looks like a target but never says what dropping means is a guess. */}
          {armed ? 'Drop here to remove this owner’s owner' : detail}
        </Typography>
      </Box>
    </Stack>
  );
}

/**
 * The card that follows the pointer.
 *
 * <p>A quieter copy of the row rather than the row itself: no chips, no actions, nothing that
 * invites a click while it is in the air.
 */
function NodeGhost({ node }) {
  const visual = visualFor(node.nodeType);
  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="center"
      sx={{
        px: 1.5,
        py: 1,
        borderRadius: '14px',
        maxWidth: 380,
        cursor: 'grabbing',
        // The same wash the row has, so a company does not turn white in mid-air. The blue border
        // and the shadow are what say "in flight"; the fill still says what this is.
        backgroundColor: node.nodeType === 'INDIVIDUAL' ? tokens.tile : washOf(visual.hue),
        border: `1px solid ${tokens.blue}`,
        boxShadow: '0 12px 28px rgba(15, 23, 42, 0.18)',
      }}
    >
      <Box
        sx={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          display: 'grid', placeItems: 'center',
          backgroundColor: tintOf(visual.hue),
          color: visual.hue,
        }}
      >
        <visual.Icon fontSize="small" />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontFamily: fonts.display, fontSize: '0.9rem', color: tokens.ink,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {node.displayName}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: tokens.muted, display: 'block',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {subtitleFor(node)}
        </Typography>
      </Box>
    </Stack>
  );
}

/**
 * The slot between two siblings: drop here to put a row in this position rather than merely
 * under this owner.
 *
 * <p>Takes up no space. The strip that catches the pointer is absolutely positioned across the
 * boundary and out of flow, so the tree measures identically whether a drag is happening or not.
 * A gap that appeared mid-drag would push every row below it down, and dnd-kit would be aiming at
 * rectangles that had already moved — which is exactly how a drag starts feeling unreliable.
 *
 * <p>It overlaps a few pixels of the rows on either side. Near the boundary both it and the row
 * are under the pointer, and `pointerWithin` prefers whichever centre is closer — the strip’s
 * centre is the boundary itself, so the edges of a row mean "between" and its middle means
 * "under". That is the whole distinction, and it needs no modifier key.
 */
function SiblingGap({ parentKey, index, drag, dragEnabled }) {
  const id = gapDropId(parentKey, index);
  const { setNodeRef } = useDroppable({ id, disabled: !dragEnabled });
  const dragging = Boolean(drag.activeDrag);
  const isOver = dragging && drag.overId === id;

  return (
    <Box sx={{ position: 'relative', height: 0 }}>
      <Box
        ref={setNodeRef}
        // Announced through the drag’s own live region rather than as an element of its own:
        // a reader tabbing the tree has no use for a run of empty slots between every row.
        aria-hidden
        sx={motion.respectful({
          position: 'absolute',
          left: 0,
          right: 0,
          top: -7,
          height: 14,
          zIndex: 1,
          // Inert until something is actually in the air, so the strips never intercept a click
          // aimed at the row above or below them.
          pointerEvents: dragging ? 'auto' : 'none',
          display: 'flex',
          alignItems: 'center',
          '&::after': {
            content: '""',
            flexGrow: 1,
            height: 2,
            borderRadius: 1,
            backgroundColor: isOver ? tokens.blue : 'transparent',
            transition: `background-color ${motion.swift} ease`,
          },
        })}
      />
    </Box>
  );
}

function NodeBranch({
  node, parentEdge, depth,
  nodesById, childrenByParent, selectedNodeId, onSelectNode, onAddChild,
  onAttachDetached, onChangeOwner, onDetachFromParent, onDeleteNode, readOnly,
  dragEnabled, drag, order,
}) {
  const children = childrenByParent.get(node.id) ?? [];
  const [locallyExpanded, setLocallyExpanded] = useState(true);
  const [menuAnchor, setMenuAnchor] = useState(null);

  const isSelected = selectedNodeId === node.id;
  // No parent edge means this row is at the top level, and the only thing that can be done to its
  // position is to give it an owner. Everything below has a parentEdge and gets the other two.
  const riskReason = riskReasonFor(node);
  const visual = visualFor(node.nodeType);

  // A person is not an entity, and the tree should say so without a legend: every other type gets
  // a card in its own colour, and an individual — always a leaf — stays plain. Colour is the
  // second signal here, never the only one; the glyph on the disc is what names the type.
  const tinted = node.nodeType !== 'INDIVIDUAL';

  // The edge's figure where there is an edge, the node's own where there is not.
  const share = parentEdge ? parentEdge.percentage : node.propertyPercentage;
  const ownerName = parentEdge ? (nodesById.get(parentEdge.parentNodeId)?.displayName ?? 'its owner') : null;

  // ── The drag ──────────────────────────────────────────────────────────────
  // Identity is the edge, because the structure is a graph: a node owned by two parents is drawn
  // twice, and dragging one instance must move that link alone.
  const dropId = dropIdForNode(node.id);
  const {
    attributes, listeners, setNodeRef: setDragRef, isDragging,
  } = useDraggable({
    id: dragIdFor(node, parentEdge),
    disabled: !dragEnabled,
    data: { nodeId: node.id, edgeId: parentEdge?.id ?? null, node },
  });
  const { setNodeRef: setDropRef } = useDroppable({
    id: dropId,
    disabled: !dragEnabled,
    data: { node },
  });
  const setRowRef = useCallback((el) => { setDragRef(el); setDropRef(el); }, [setDragRef, setDropRef]);

  const rejection = drag.rejections.get(dropId) ?? null;
  const dragging = Boolean(drag.activeDrag);
  const isDropTarget = dragging && drag.overId === dropId && !rejection;
  const isRefusing = dragging && drag.overId === dropId && Boolean(rejection);
  // Dimmed for the whole drag, not only on approach: what cannot take this row should be readable
  // as such while you are still deciding where to go.
  const isForbidden = dragging && Boolean(rejection);

  // A mousedown on the ⋮, the ＋ or the chevron is aimed at that control, not at the row. Without
  // this the sensor arms on those too, and a slightly unsteady click on a menu button drags the
  // whole branch instead of opening it.
  const fromControl = (e) => Boolean(e.target?.closest?.('button, a, [role="menuitem"]'));
  const rowDragListeners = dragEnabled ? {
    onMouseDown: (e) => { if (!fromControl(e)) listeners?.onMouseDown?.(e); },
    onTouchStart: (e) => { if (!fromControl(e)) listeners?.onTouchStart?.(e); },
  } : {};

  // The branch opens itself when it is hovered long enough during a drag, so a collapsed owner is
  // still reachable. Merged rather than assigned: whatever the reader had opened stays open.
  const expanded = locallyExpanded || drag.forceExpandedIds.has(node.id);

  // Captured at first render and never recomputed: a tree that re-animated on every save would
  // be exhausting to work in. Once something has been dragged the entrance is retired outright —
  // a moved row is a new edge, so a new key, so a remount, and replaying the fade on every drop
  // reads as the page reloading underneath you.
  const [entrance] = useState(() => (drag.settled
    ? null
    : `nodeIn ${motion.swift} ${motion.ease} ${Math.min(order.i++, STAGGER_CAP) * STAGGER_MS}ms both`));

  return (
    <Box>
      <Box
        sx={{
          position: 'relative',
          pl: depth === 0 ? 0 : 3.5,
          // The rail: one hairline per level of depth, drawn as the row's left border rather
          // than a stack of spacer divs.
          '&::before': depth === 0 ? undefined : {
            content: '""',
            position: 'absolute',
            left: 10, top: 0, bottom: 0,
            borderLeft: `1px solid ${tokens.hairline2}`,
          },
          // The elbow into this row.
          '&::after': depth === 0 ? undefined : {
            content: '""',
            position: 'absolute',
            left: 10, top: 26,
            width: 16,
            borderTop: `1px solid ${tokens.hairline2}`,
          },
        }}
      >
        <Stack
          ref={setRowRef}
          direction="row"
          spacing={1.25}
          alignItems="center"
          role="button"
          tabIndex={0}
          aria-pressed={isSelected}
          {...rowDragListeners}
          onClick={() => onSelectNode(node.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectNode(node.id); }
          }}
          sx={motion.respectful({
            px: 1.25,
            py: 1,
            my: 0.4,
            borderRadius: '14px',
            cursor: 'pointer',
            // Stops a press-and-hold on touch turning into a text selection or a zoom while the
            // sensor is waiting to see whether this is a drag or a scroll.
            touchAction: dragEnabled ? 'manipulation' : undefined,
            // Selection and the drop target own the row's colour for as long as they last; the
            // type takes it back the moment they let go. A tint that competed with the blue would
            // make the tree harder to drag in, not easier.
            //
            // 'transparent' rather than no border on an individual: a row that drops its 1px edge
            // is 2px shorter than its siblings and the whole column stops lining up.
            backgroundColor: isDropTarget || isSelected
              ? tokens.blueWash
              : (tinted ? washOf(visual.hue) : 'transparent'),
            border: `1px solid ${isDropTarget || isSelected
              ? tokens.blue
              : (tinted ? edgeOf(visual.hue) : 'transparent')}`,
            // The row being carried stays in place and steps back; the copy under the pointer is
            // the one that moves. Nothing here is ever transformed.
            opacity: isDragging ? 0.35 : (isForbidden ? 0.4 : 1),
            // A ring rather than a border swap, so the row does not shift by a pixel as it
            // becomes a target.
            boxShadow: isDropTarget ? `inset 0 0 0 1px ${tokens.blue}` : 'none',
            transition: `background-color ${motion.swift} ease, border-color ${motion.swift} ease,`
              + ` opacity ${motion.swift} ease, box-shadow ${motion.swift} ease`,
            ...(entrance ? {
              animation: entrance,
              '@keyframes nodeIn': {
                from: { opacity: 0, transform: 'translateX(-6px)' },
                to: { opacity: 1, transform: 'none' },
              },
            } : {}),
            // A tinted row steps up to the disc's own strength on hover — one notch of the same
            // colour rather than a fourth value invented for the purpose.
            '&:hover': {
              backgroundColor: isSelected
                ? tokens.blueWash
                : (tinted ? tintOf(visual.hue) : tokens.hover),
            },
            '&:focus-visible': { outline: `2px solid ${tokens.blue}`, outlineOffset: 2 },
            // Row actions rest quietly and come forward on approach — but never disappear for
            // anyone arriving by keyboard.
            '&:hover .rowAction, &:focus-within .rowAction': { opacity: 1 },
            // Nothing inside the row should be reachable while it is being dragged over, or the
            // pointer lands on a chip instead of the row it is aimed at.
            ...(dragging ? { '& .rowAction': { pointerEvents: 'none' } } : {}),
          })}
        >
          <IconButton
            size="small"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            onClick={(e) => { e.stopPropagation(); setLocallyExpanded((v) => !v); }}
            disabled={children.length === 0}
            sx={{ visibility: children.length > 0 ? 'visible' : 'hidden', p: 0.25 }}
          >
            {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </IconButton>

          {/* The type's colour holds whether the row is selected or not — identity should not
              change when you click on something. The row itself carries the selected state. */}
          <Box
            sx={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              display: 'grid', placeItems: 'center',
              backgroundColor: tintOf(visual.hue),
              color: visual.hue,
            }}
          >
            <visual.Icon fontSize="small" />
          </Box>

          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              {/* Bold at the top of the chain and nowhere else. These are the owners a reviewer
                  reads first — everyone below is reached through them — and the weight is added
                  conditionally so no other row's rendering changes. */}
              <Typography
                sx={{
                  fontFamily: fonts.display,
                  fontSize: '0.9rem',
                  color: tokens.ink,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  ...(depth === 0 && { fontWeight: 700 }),
                }}
              >
                {node.displayName}
              </Typography>
              {riskReason && (
                <Tooltip title={riskReason}>
                  <ReportProblemOutlinedIcon
                    sx={{ fontSize: '1rem', color: 'warning.main', flexShrink: 0 }}
                  />
                </Tooltip>
              )}
            </Stack>
            <Typography
              variant="caption"
              sx={{
                color: tokens.muted, display: 'block',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {/* Mid-drag the second line answers the only question being asked of this row: can
                  it take the one in the air, and if not, why. It goes back to describing itself
                  the moment the drag ends. */}
              {isRefusing ? rejection.message : subtitleFor(node)}
            </Typography>
          </Box>

          {/* One chip, two questions. A row under an owner shows its share of that owner; a row at
              the top of the chain shows its share of the property, which lives on the node because
              there is no link to hang it on. They look alike deliberately — it is the same kind of
              answer — so the tooltip is what tells them apart. */}
          {share != null && (
            <Tooltip title={parentEdge ? `${share}% of ${ownerName}` : `${share}% of the property`}>
              <Chip
                size="small"
                label={`${Number(share).toFixed(0)}%`}
                sx={{
                  fontFamily: fonts.mono, fontSize: '0.66rem', flexShrink: 0,
                  // The share of the property is the other fact worth reading first, so it takes
                  // the same weight as the name beside it.
                  ...(depth === 0 && { '& .MuiChip-label': { fontWeight: 700 } }),
                }}
              />
            </Tooltip>
          )}
          <Chip
            size="small"
            variant="outlined"
            color={VERIFICATION_COLOR[node.verificationStatus] ?? 'default'}
            label={node.verificationStatus.replaceAll('_', ' ').toLowerCase()}
            sx={{ fontSize: '0.66rem', flexShrink: 0, display: { xs: 'none', md: 'flex' } }}
          />

          {/* The whole row is draggable with a mouse or a finger; this is the grip that says so,
              and the only way in by keyboard. The row's own Enter and Space open the drawer, so
              the drag's keyboard activator has to live somewhere else — here — or one key would
              mean two things. */}
          {dragEnabled && (
            <Tooltip title="Drag to move this owner">
              <IconButton
                className="rowAction"
                size="small"
                disableRipple
                {...attributes}
                {...listeners}
                onClick={(e) => e.stopPropagation()}
                sx={motion.respectful({
                  opacity: 0,
                  transition: `opacity ${motion.swift} ease`,
                  flexShrink: 0,
                  cursor: 'grab',
                  color: tokens.muted,
                  touchAction: 'none',
                  '&:active': { cursor: 'grabbing' },
                })}
              >
                <DragIndicatorIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {/* An individual owns nothing, so there is no child to add. */}
          {!readOnly && !isLeafOnlyType(node.nodeType) && (
            <Tooltip title="Add owned entity or person">
              <IconButton
                className="rowAction"
                size="small"
                onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}
                sx={motion.respectful({
                  opacity: 0, transition: `opacity ${motion.swift} ease`, flexShrink: 0,
                })}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {/* Every item in this menu rewrites the chain, so the trigger goes when they do —
              an empty menu is worse than no menu. Dragging does not replace any of them: this is
              still the keyboard route, and still the only way to set a percentage as you move. */}
          {!readOnly && (
            <Tooltip title="More">
              <IconButton
                className="rowAction"
                size="small"
                aria-label={`More actions for ${node.displayName}`}
                onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}
                sx={motion.respectful({
                  opacity: 0, transition: `opacity ${motion.swift} ease`, flexShrink: 0,
                })}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          <Menu open={Boolean(menuAnchor)} anchorEl={menuAnchor} onClose={() => setMenuAnchor(null)}>
            {!parentEdge && onAttachDetached && (
              <MenuItem onClick={() => { onAttachDetached(node.id); setMenuAnchor(null); }}>
                <AddLinkIcon fontSize="small" sx={{ mr: 1 }} /> Attach to an owner…
              </MenuItem>
            )}
            {/* Both keyed on parentEdge, which is the edge this row is drawn under and so exactly
                the one to move or cut. Together with Attach above they are one symmetrical set:
                a row either has an owner or it does not. */}
            {parentEdge && onChangeOwner && (
              <MenuItem onClick={() => { onChangeOwner(node.id, parentEdge); setMenuAnchor(null); }}>
                <SwapHorizIcon fontSize="small" sx={{ mr: 1 }} /> Change owner…
              </MenuItem>
            )}
            {parentEdge && onDetachFromParent && (
              <MenuItem onClick={() => { onDetachFromParent(parentEdge.id); setMenuAnchor(null); }}>
                <LinkOffIcon fontSize="small" sx={{ mr: 1 }} /> Detach from parent
              </MenuItem>
            )}
            {/* Last, and set apart by colour: the only item here that destroys anything. Offered on
                every row, top-level ones included — clearing a structure to start again is a real
                thing to want, and the dialog names the count before anyone commits. */}
            {onDeleteNode && (
              <MenuItem
                sx={{ color: 'error.main' }}
                onClick={() => { onDeleteNode(node.id); setMenuAnchor(null); }}
              >
                <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} /> Delete
              </MenuItem>
            )}
          </Menu>
        </Stack>

        {expanded && children.map((edge, i) => {
          const child = nodesById.get(edge.childNodeId);
          if (!child) return null;
          return (
            <Fragment key={edge.id}>
              <SiblingGap
                parentKey={node.id}
                index={i}
                drag={drag}
                dragEnabled={dragEnabled}
              />
            <NodeBranch
              node={child}
              parentEdge={edge}
              depth={depth + 1}
              nodesById={nodesById}
              childrenByParent={childrenByParent}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              onAddChild={onAddChild}
              onAttachDetached={onAttachDetached}
              onChangeOwner={onChangeOwner}
              onDetachFromParent={onDetachFromParent}
              onDeleteNode={onDeleteNode}
              readOnly={readOnly}
              dragEnabled={dragEnabled}
              drag={drag}
              order={order}
            />
            </Fragment>
          );
        })}
        {expanded && children.length > 0 && (
          <SiblingGap
            parentKey={node.id}
            index={children.length}
            drag={drag}
            dragEnabled={dragEnabled}
          />
        )}
      </Box>
    </Box>
  );
}

function indexTree(tree) {
  const nodesById = new Map();
  const childrenByParent = new Map();
  const parentIdByChild = new Map();
  if (!tree) return { nodesById, childrenByParent, parentIdByChild };
  tree.nodes.forEach((n) => nodesById.set(n.id, n));
  tree.edges.forEach((e) => {
    if (!childrenByParent.has(e.parentNodeId)) childrenByParent.set(e.parentNodeId, []);
    childrenByParent.get(e.parentNodeId).push(e);
    parentIdByChild.set(e.childNodeId, e.parentNodeId);
  });
  // Sort children by edge id so the order is stable.
  childrenByParent.forEach((arr) => arr.sort(sortSiblings));
  return { nodesById, childrenByParent, parentIdByChild };
}
