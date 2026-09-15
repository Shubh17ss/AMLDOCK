/**
 * The rules a drag in the ownership structure has to obey, with no React in them.
 *
 * <p>Everything here is a pure function of the tree, so the same answers are available to the
 * drag layer (which needs them at drag start, to dim what cannot be dropped on) and to
 * AttachToParentDialog (which needs them to build its dropdown). Two copies of "which parents are
 * legal" would disagree eventually, and the one in the dialog already carried a comment saying so.
 *
 * <p>The server is still the authority — OwnershipService refuses a cycle, a self-parent, a
 * duplicate pair and an individual parent. This is defence in depth, and the reason it exists is
 * that a drop is not a form: by the time a request comes back the row has already appeared to move.
 */

import { isLeafOnlyType } from '../../api/ownership.js';

/**
 * What a dragged row is, as a string dnd-kit can carry.
 *
 * <p>The structure is a DAG, not a tree — a person can be a shareholder in two subsidiaries — so a
 * node renders once per incoming edge. Identity is therefore the EDGE, not the node: dragging the
 * instance under owner A must move that link alone and leave the instance under owner B where it
 * is. A row with no owner above it has no edge to name, so it falls back to its node id.
 */
export const dragIdFor = (node, parentEdge) =>
  (parentEdge ? `edge:${parentEdge.id}` : `top:${node.id}`);

/** The droppable id of a row, as a target rather than as cargo. */
export const dropIdForNode = (nodeId) => `node:${nodeId}`;

/** The one droppable that is not a node: the property band at the head of the chain. */
export const PROPERTY_DROP_ID = 'property';

/** `"node:12"` → `12`, and null for anything else. */
export function nodeIdFromDropId(id) {
  if (typeof id !== 'string' || !id.startsWith('node:')) return null;
  const n = Number(id.slice(5));
  return Number.isFinite(n) ? n : null;
}

/**
 * Everything reachable below `nodeId`, not counting the node itself.
 *
 * <p>Breadth-first with the result doubling as the seen-set, which is what stops a diamond being
 * walked twice. Lifted out of AttachToParentDialog, which is now a caller.
 */
export function descendantsOf(tree, nodeId) {
  const found = new Set();
  if (!tree || nodeId == null) return found;
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift();
    tree.edges
      .filter((e) => e.parentNodeId === current)
      .forEach((e) => {
        if (!found.has(e.childNodeId)) {
          found.add(e.childNodeId);
          queue.push(e.childNodeId);
        }
      });
  }
  return found;
}

/**
 * Whether `nodeId` may be given `parentNodeId` as an owner, and if not, why in words.
 *
 * <p>Returns null when the move is legal. The messages are the ones shown on a refused drop, so
 * they are written to be read by a person mid-gesture rather than logged: they name the row that
 * was aimed at, because by then the pointer has moved on and "invalid target" answers nothing.
 *
 * <p>The individual wording tracks OwnershipService.createEdge, which is the rule's real home.
 */
export function dropRejection(tree, nodeId, parentNodeId) {
  if (!tree || nodeId == null || parentNodeId == null) return null;
  const dragged = tree.nodes.find((n) => n.id === nodeId);
  const target = tree.nodes.find((n) => n.id === parentNodeId);
  if (!dragged || !target) return null;

  if (isLeafOnlyType(target.nodeType)) {
    return {
      code: 'LEAF_ONLY',
      message: `An individual cannot own another owner — ${target.displayName} is always the `
        + 'bottom of a chain.',
    };
  }
  if (parentNodeId === nodeId) {
    return { code: 'SELF', message: `${dragged.displayName} cannot own itself.` };
  }
  if (descendantsOf(tree, nodeId).has(parentNodeId)) {
    return {
      code: 'CYCLE',
      message: `That would close a loop — ${target.displayName} already sits below `
        + `${dragged.displayName}.`,
    };
  }
  if (tree.edges.some((e) => e.parentNodeId === parentNodeId && e.childNodeId === nodeId)) {
    return {
      code: 'EXISTS',
      message: `${target.displayName} already owns ${dragged.displayName}.`,
    };
  }
  return null;
}

/**
 * Every rejection at once, keyed by droppable id.
 *
 * <p>Computed once when a drag starts rather than per hover: the tree does not change during a
 * drag, and asking on each pointer move would run a graph walk inside the animation frame.
 */
export function rejectionsFor(tree, nodeId) {
  const map = new Map();
  if (!tree || nodeId == null) return map;
  tree.nodes.forEach((n) => {
    const rejection = dropRejection(tree, nodeId, n.id);
    if (rejection) map.set(dropIdForNode(n.id), rejection);
  });
  return map;
}

/**
 * The order siblings are drawn in.
 *
 * <p>A position somebody has set, then the id. Null means nobody has arranged this group, which
 * is the ordinary state and the reason nothing had to be backfilled: falling through to the id
 * gives creation order, which is what the tree has always drawn. Sorting nulls LAST rather than
 * first matters on the way in — a newly created edge has no position, and belongs after the rows
 * already arranged rather than jumping to the top of them.
 *
 * <p>Reads the same field on either shape: an edge for a child, the node itself for a top-level
 * owner, which has no edge to carry one.
 */
export const sortSiblings = (a, b) => (
  (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || a.id - b.id
);

/**
 * The node ids of one sibling group, in the order the tree draws them.
 *
 * <p>`parentNodeId: null` is the top of the chain: the nodes with nothing above them, which carry
 * their own position because there is no edge to put one on. Everything else is the children of
 * one owner, read off the edges that hold them there.
 *
 * <p>This is the list a reorder sends back to the server, so it has to match what the reader is
 * looking at exactly — same membership, same order.
 */
export function siblingNodeIds(tree, parentNodeId) {
  if (!tree) return [];
  if (parentNodeId == null) {
    const owned = new Set(tree.edges.map((e) => e.childNodeId));
    return tree.nodes.filter((n) => !owned.has(n.id)).sort(sortSiblings).map((n) => n.id);
  }
  return tree.edges
    .filter((e) => e.parentNodeId === parentNodeId)
    .sort(sortSiblings)
    .map((e) => e.childNodeId);
}

/**
 * That group with `nodeId` moved into the slot at `index`.
 *
 * <p>The index counts slots in what is currently on screen. Taking the row out first closes up
 * one slot, so every position after where it used to be shifts down by one — without that, every
 * downward drag lands one row short of where it was aimed.
 *
 * <p>A node not currently in the group is simply inserted; that is the cross-owner case, where the
 * row is arriving from somewhere else.
 */
export function orderWithMoved(siblings, nodeId, index) {
  const without = siblings.filter((id) => id !== nodeId);
  const from = siblings.indexOf(nodeId);
  const at = from !== -1 && from < index ? index - 1 : index;
  const clamped = Math.max(0, Math.min(at, without.length));
  return [...without.slice(0, clamped), nodeId, ...without.slice(clamped)];
}

/** Whether two orders are the same list in the same order. */
export const sameOrder = (a, b) => a.length === b.length && a.every((id, i) => id === b[i]);

/** The droppable id of the slot between two siblings. `parentKey` is a node id, or "top". */
export const gapDropId = (parentKey, index) => `gap:${parentKey}:${index}`;

/** `"gap:7:2"` → `{ parentNodeId: 7, index: 2 }`; `"gap:top:0"` → `{ parentNodeId: null, index: 0 }`. */
export function parseGapDropId(id) {
  if (typeof id !== 'string' || !id.startsWith('gap:')) return null;
  const [, key, index] = id.split(':');
  return { parentNodeId: key === 'top' ? null : Number(key), index: Number(index) };
}
