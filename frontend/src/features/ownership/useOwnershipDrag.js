import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardSensor, MeasuringStrategy, MouseSensor, TouchSensor,
  closestCenter, pointerWithin, useSensor, useSensors,
} from '@dnd-kit/core';
import { useToast } from '../../components/ToastProvider.jsx';
import {
  PROPERTY_DROP_ID, dropRejection, nodeIdFromDropId, orderWithMoved, parseGapDropId,
  rejectionsFor, sameOrder, siblingNodeIds,
} from './dragModel.js';

/** A node’s display name, for a message that has to name what was aimed at. */
const nameOf = (tree, nodeId) => (nodeId == null
  ? 'the property'
  : tree?.nodes.find((n) => n.id === nodeId)?.displayName ?? 'its new owner');

/** Where a reorder happened, phrased for a toast. */
const describeGroup = (tree, parentNodeId) => (parentNodeId == null
  ? 'among the top-level owners'
  : `among ${nameOf(tree, parentNodeId)}’s owners`);

/** The stored position of one member of a sibling group, wherever that group keeps it. */
const positionOf = (tree, parentNodeId, nodeId) => (parentNodeId == null
  ? tree?.nodes.find((n) => n.id === nodeId)?.sortOrder
  : tree?.edges.find((e) => e.parentNodeId === parentNodeId
      && e.childNodeId === nodeId)?.sortOrder);

/**
 * A sibling group’s order, but only if somebody has actually arranged it — otherwise null.
 *
 * <p>This is what an undo puts back, and the distinction matters. A group nobody has arranged
 * carries no positions at all and is drawn in creation order; writing 0..n-1 over it while
 * undoing something else would be a second change nobody asked for, and one that could not
 * itself be undone.
 */
function arrangedOrder(tree, parentNodeId) {
  const group = siblingNodeIds(tree, parentNodeId);
  const arranged = group.some((id) => positionOf(tree, parentNodeId, id) != null);
  return arranged ? group : null;
}

/** How long a collapsed row has to be hovered before it opens to be dropped into. */
const AUTO_EXPAND_MS = 600;

/**
 * Everything a drag in the ownership structure needs, and nothing the tree draws.
 *
 * <p>The gesture is the same edit the ⋮ menu has always offered — attach, change owner, detach —
 * so it commits through the same composed mutation and obeys the same rules. What it adds is that
 * the answer can be given by pointing at a row instead of by finding it in a dropdown.
 *
 * <p>Returns a bag meant to be spread onto a `DndContext`, plus the state the rows read to dim
 * themselves.
 */
export function useOwnershipDrag({ tree, useTree, enabled }) {
  const { showToast } = useToast();

  // { nodeId, edgeId, node } — the row being carried, not merely the node it points at. A node
  // with two owners is drawn twice, and only the instance under the hand is moving.
  const [activeDrag, setActiveDrag] = useState(null);
  const [overId, setOverId] = useState(null);
  const [rejections, setRejections] = useState(() => new Map());
  const [forceExpandedIds, setForceExpandedIds] = useState(() => new Set());

  // Once anything has been dragged, the tree stops replaying its entrance. A moved row gets a new
  // edge, so a new React key, so a remount — and without this the branch fades in again every
  // time something is dropped, which reads as the page reloading under you.
  const [settled, setSettled] = useState(false);

  // MouseSensor + TouchSensor rather than the combined PointerSensor: the two gestures want
  // different openings. A mouse should start dragging as soon as it has clearly moved, while a
  // finger that moves is nearly always scrolling the page — so touch waits for a press instead.
  // PointerSensor can only be given one of those rules.
  const sensors = useSensors(
    // Six pixels of travel. Below it the row is still a button: clicking one opens its drawer,
    // and that must not become unreliable in exchange for a drag.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  // Rows are the only drop targets and they do not overlap — the droppable is the card, not the
  // box that also contains its children — so the pointer is inside at most one at a time and
  // `pointerWithin` is exact. It reports nothing once the pointer leaves the tree, and the
  // fallback is what keeps a keyboard drag, which has no pointer at all, working.
  const collisionDetection = useCallback((args) => {
    const hits = pointerWithin(args);
    return hits.length > 0 ? hits : closestCenter(args);
  }, []);

  // Re-measured while dragging because auto-expand changes the layout underneath the pointer.
  const measuring = useMemo(
    () => ({ droppable: { strategy: MeasuringStrategy.WhileDragging } }), [],
  );

  /** Opens a collapsed branch that has been hovered long enough to look deliberate. */
  useEffect(() => {
    if (!activeDrag) return undefined;
    const nodeId = nodeIdFromDropId(overId);
    if (nodeId == null) return undefined;
    const timer = setTimeout(() => {
      setForceExpandedIds((prev) => (prev.has(nodeId) ? prev : new Set(prev).add(nodeId)));
    }, AUTO_EXPAND_MS);
    return () => clearTimeout(timer);
  }, [overId, activeDrag]);

  const reset = useCallback(() => {
    setActiveDrag(null);
    setOverId(null);
    setRejections(new Map());
    setForceExpandedIds(new Set());
  }, []);

  const onDragStart = useCallback(({ active }) => {
    const data = active.data.current ?? {};
    setActiveDrag({ nodeId: data.nodeId, edgeId: data.edgeId ?? null, node: data.node });
    // Every refusal worked out once, here, rather than on each pointer move: the tree cannot
    // change mid-drag, and the cycle check is a graph walk that has no business running inside an
    // animation frame. Rows read it to dim themselves, so what cannot be dropped on says so
    // before the drop rather than after it.
    setRejections(rejectionsFor(tree, data.nodeId));
    setSettled(true);
  }, [tree]);

  const onDragOver = useCallback(({ over }) => setOverId(over ? String(over.id) : null), []);

  /**
   * Undo, for either direction.
   *
   * <p>One path covers all three gestures: put the node back under whatever held it before —
   * nothing, for a row that was at the top of the chain — and cut the link the move created.
   *
   * <p>The second half is the one that is easy to miss. The server clears a node's share of the
   * property when it gains an owner, because a node with a parent does not hold the property
   * directly. Undoing an attach therefore has to hand that figure back, or the move quietly cost
   * an answer somebody gave.
   */
  const undo = useCallback(async (before) => {
    try {
      await useTree.moveNode.mutateAsync({
        nodeId: before.nodeId,
        fromEdgeId: before.createdEdgeId,
        toParentNodeId: before.parentNodeId,
        percentage: before.percentage,
      });
      if (before.parentNodeId == null && before.propertyPercentage != null) {
        await useTree.updateNode.mutateAsync({
          nodeId: before.nodeId,
          payload: { propertyPercentage: before.propertyPercentage },
        });
      }
      // Back to the place it held among its siblings, not merely back under its old owner.
      // Returning to the bottom of the group would be a second change nobody asked for.
      if (before.homeOrder) {
        await useTree.reorder.mutateAsync({
          parentNodeId: before.parentNodeId,
          childNodeIds: before.homeOrder,
        });
      }
    } catch (err) {
      showToast({
        severity: 'error',
        message: err.response?.data?.message || err.message || 'Could not undo that move',
      });
    }
  }, [useTree, showToast]);

  /** Runs the move, then offers to take it back. */
  const commit = useCallback(async ({ node, fromEdge, toParentNodeId, message }) => {
    // Read before the write: once the mutation lands, none of it is still true.
    const before = {
      nodeId: node.id,
      parentNodeId: fromEdge ? fromEdge.parentNodeId : null,
      percentage: fromEdge ? fromEdge.percentage : null,
      propertyPercentage: node.propertyPercentage ?? null,
      createdEdgeId: null,
      homeOrder: arrangedOrder(tree, fromEdge ? fromEdge.parentNodeId : null),
    };
    try {
      const created = await useTree.moveNode.mutateAsync({
        nodeId: node.id,
        fromEdgeId: fromEdge?.id ?? null,
        toParentNodeId,
        percentage: before.percentage,
      });
      before.createdEdgeId = created?.id ?? null;
      showToast({
        severity: 'success',
        message,
        action: { label: 'Undo', onClick: () => undo(before) },
      });
    } catch (err) {
      showToast({
        severity: 'error',
        message: err.response?.data?.message || err.message || 'Could not move that owner',
      });
    }
  }, [tree, useTree, showToast, undo]);

  /**
   * Puts a row in a particular slot among its siblings, arriving from that group or another.
   *
   * <p>Two writes at most, in this order: give it the owner it was dropped under, then set the
   * order of the group it landed in. A row dropped into a gap in its own group skips the first.
   *
   * <p>The order goes as node ids rather than edge ids on purpose — when a move ran first, the
   * edge it created has an id only the server knows, and the row is in the group all the same.
   */
  const commitReorder = useCallback(async ({ node, fromEdge, gap }) => {
    const { parentNodeId, index } = gap;
    const siblings = siblingNodeIds(tree, parentNodeId);
    const next = orderWithMoved(siblings, node.id, index);
    const sameGroup = (fromEdge?.parentNodeId ?? null) === parentNodeId;

    // Dropped back into the slot it came out of.
    if (sameGroup && sameOrder(siblings, next)) return;

    const before = {
      nodeId: node.id,
      parentNodeId: fromEdge ? fromEdge.parentNodeId : null,
      percentage: fromEdge ? fromEdge.percentage : null,
      propertyPercentage: node.propertyPercentage ?? null,
      createdEdgeId: null,
      // Same rule as a plain move: only a group somebody has actually arranged is worth putting
      // back, and only when the row is leaving that group in the first place.
      homeOrder: sameGroup ? null : arrangedOrder(tree, fromEdge?.parentNodeId ?? null),
    };

    try {
      if (!sameGroup) {
        const created = await useTree.moveNode.mutateAsync({
          nodeId: node.id,
          fromEdgeId: fromEdge?.id ?? null,
          toParentNodeId: parentNodeId,
          percentage: before.percentage,
        });
        before.createdEdgeId = created?.id ?? null;
      }
      await useTree.reorder.mutateAsync({ parentNodeId, childNodeIds: next });
      showToast({
        severity: 'success',
        message: sameGroup
          ? `Moved ${node.displayName} ${describeGroup(tree, parentNodeId)}`
          : `${node.displayName} is now owned by ${nameOf(tree, parentNodeId)}`,
        action: {
          label: 'Undo',
          onClick: () => (sameGroup
            ? useTree.reorder.mutate({ parentNodeId, childNodeIds: siblings })
            : undo(before)),
        },
      });
    } catch (err) {
      showToast({
        severity: 'error',
        message: err.response?.data?.message || err.message || 'Could not reorder those owners',
      });
    }
  }, [tree, useTree, showToast, undo]);

  const onDragEnd = useCallback(({ active, over }) => {
    const data = active.data.current ?? {};
    reset();
    if (!over || !tree) return;

    const node = tree.nodes.find((n) => n.id === data.nodeId);
    if (!node) return;
    const fromEdge = data.edgeId == null
      ? null
      : tree.edges.find((e) => e.id === data.edgeId) ?? null;

    const target = String(over.id);

    // Onto the property band: the node stops belonging to anyone and returns to the top of the
    // chain. A row already at the top has nothing to cut, and says nothing about it.
    if (target === PROPERTY_DROP_ID) {
      if (!fromEdge) return;
      commit({
        node,
        fromEdge,
        toParentNodeId: null,
        message: `${node.displayName} now owns the property directly`,
      });
      return;
    }

    // A gap between two rows says where among them, not only under whom.
    const gap = parseGapDropId(target);
    if (gap) {
      const sameGroup = (fromEdge?.parentNodeId ?? null) === gap.parentNodeId;
      // Already a child of this owner by some other link. A second one is what the server calls
      // a duplicate edge, and it is not what dropping here looks like it would do.
      if (!sameGroup && siblingNodeIds(tree, gap.parentNodeId).includes(node.id)) {
        showToast({
          severity: 'warning',
          message: `${nameOf(tree, gap.parentNodeId)} already owns ${node.displayName}.`,
        });
        return;
      }
      // Arriving from elsewhere means gaining an owner, so the owner rules apply. Staying in
      // the group, or landing at the top of the chain, gains nobody and is always allowed.
      const gapRejection = sameGroup || gap.parentNodeId == null
        ? null
        : dropRejection(tree, node.id, gap.parentNodeId);
      if (gapRejection) {
        showToast({ severity: 'warning', message: gapRejection.message });
        return;
      }
      commitReorder({ node, fromEdge, gap });
      return;
    }

    const targetNodeId = nodeIdFromDropId(target);
    if (targetNodeId == null) return;
    // Dropped where it already was. Not an error, and not worth a toast.
    if (fromEdge && fromEdge.parentNodeId === targetNodeId) return;

    // The same four rules the rows were dimmed by, asked again at the moment of the drop. An
    // individual is a drop target on purpose even though it can never accept one: leaving it
    // unregistered would make the drop land nowhere and say nothing, and "why did that not work"
    // is the question this answers.
    const rejection = dropRejection(tree, node.id, targetNodeId);
    if (rejection) {
      showToast({ severity: 'warning', message: rejection.message });
      return;
    }

    const parent = tree.nodes.find((n) => n.id === targetNodeId);
    commit({
      node,
      fromEdge,
      toParentNodeId: targetNodeId,
      message: `${node.displayName} is now owned by ${parent?.displayName ?? 'its new owner'}`,
    });
  }, [tree, commit, commitReorder, reset, showToast]);

  /** What a screen reader hears, since none of the above is visible to one. */
  const announcements = useMemo(() => ({
    onDragStart: ({ active }) => `Picked up ${active.data.current?.node?.displayName ?? 'owner'}.`,
    onDragOver: ({ over }) => {
      if (!over) return 'Not over a drop target.';
      if (String(over.id) === PROPERTY_DROP_ID) {
        return 'Over the property. Drop to remove its owner.';
      }
      // A slot reads differently from a row: it is a position, not an owner, and saying
      // "drop to make it the owner" of a gap would be describing the wrong gesture entirely.
      const gap = parseGapDropId(String(over.id));
      if (gap) {
        const group = gap.parentNodeId == null
          ? 'the top-level owners'
          : `${nameOf(tree, gap.parentNodeId)}’s owners`;
        return `Between ${group}, position ${gap.index + 1}. Drop to place it here.`;
      }
      const rejection = rejections.get(String(over.id));
      if (rejection) return rejection.message;
      return `Over ${over.data.current?.node?.displayName ?? 'an owner'}. Drop to make it the owner.`;
    },
    onDragEnd: ({ over }) => (over ? 'Dropped.' : 'Cancelled, nothing moved.'),
    onDragCancel: () => 'Cancelled, nothing moved.',
  }), [rejections, tree]);

  return {
    enabled,
    settled,
    activeDrag,
    overId,
    rejections,
    forceExpandedIds,
    // Spread straight onto <DndContext>.
    contextProps: {
      sensors,
      collisionDetection,
      measuring,
      accessibility: { announcements },
      onDragStart,
      onDragOver,
      onDragEnd,
      onDragCancel: reset,
    },
  };
}
