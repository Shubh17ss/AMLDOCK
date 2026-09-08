import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createEdge, createNode, deleteEdge, deleteNode,
  getTree, reorder, updateEdge, updateNode,
} from '../../api/ownership.js';

/**
 * The tree as it will be once a move lands, for the cache to hold in the meantime.
 *
 * <p>Mirrors what the server does, including the part that is easy to forget: a node that gains an
 * owner above it no longer holds the property directly, so its `propertyPercentage` goes
 * (OwnershipService.createEdge). Getting that wrong here would show a share of the property on a
 * row that is no longer a top-level owner, until the refetch quietly removed it.
 *
 * <p>The stand-in edge takes an id near the top of the range so it sorts where a real new edge
 * would — last among its siblings, since the tree orders children by edge id. A negative id would
 * put it first and then make it jump when the server's answer arrived.
 */
let pendingEdgeSeq = 0;
function applyMoveLocally(prev, { nodeId, fromEdgeId, toParentNodeId, percentage }) {
  if (!prev) return prev;
  const edges = prev.edges.filter((e) => e.id !== fromEdgeId);
  if (toParentNodeId != null) {
    edges.push({
      id: Number.MAX_SAFE_INTEGER - (pendingEdgeSeq += 1),
      parentNodeId: toParentNodeId,
      childNodeId: nodeId,
      percentage: percentage ?? null,
      role: null,
      createdAt: new Date().toISOString(),
    });
  }
  const nodes = toParentNodeId == null ? prev.nodes : prev.nodes.map(
    (n) => (n.id === nodeId ? { ...n, propertyPercentage: null } : n));
  return { ...prev, nodes, edges };
}

/**
 * The same tree with one sibling group renumbered, for the cache to hold until the server
 * answers with its own copy.
 *
 * <p>Writes the position where the row that carries it lives: on the edge for a child, on the
 * node itself for a top-level owner, which has no edge. Dense 0..n-1, exactly as the server does.
 */
function applyOrderLocally(prev, { parentNodeId, childNodeIds }) {
  if (!prev) return prev;
  const position = new Map(childNodeIds.map((id, i) => [id, i]));
  if (parentNodeId == null) {
    return {
      ...prev,
      nodes: prev.nodes.map((n) => (position.has(n.id)
        ? { ...n, sortOrder: position.get(n.id) } : n)),
    };
  }
  return {
    ...prev,
    edges: prev.edges.map((e) => (e.parentNodeId === parentNodeId && position.has(e.childNodeId)
      ? { ...e, sortOrder: position.get(e.childNodeId) } : e)),
  };
}

export function useOwnershipTree(dealId) {
  const qc = useQueryClient();
  const key = ['ownership', dealId];

  const treeQ = useQuery({
    queryKey: key,
    queryFn: () => getTree(dealId),
    enabled: Boolean(dealId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    // The deal too, not just the tree. From V35 a node's answers feed the deal's risk rating,
    // so any node write can move the chip at the top of the review screen. Centralised here
    // rather than at each call site: create, update and delete can all change it, and one of
    // them being forgotten is exactly the bug this replaces.
    if (dealId) qc.invalidateQueries({ queryKey: ['deals', dealId] });
    // And the individuals register, which every INDIVIDUAL node is a row of. The owner picker
    // reads that same list to offer people from the firm's other deals, so without this a person
    // added here would be missing from the picker for the rest of the session — including when
    // the very next owner is their co-owner. Prefix key: every firm/branch scope goes stale.
    qc.invalidateQueries({ queryKey: ['individuals'] });
  };

  const createNodeMut = useMutation({ mutationFn: (payload) => createNode(dealId, payload), onSuccess: invalidate });
  const updateNodeMut = useMutation({
    mutationFn: ({ nodeId, payload }) => updateNode(dealId, nodeId, payload),
    onSuccess: invalidate,
  });
  const deleteNodeMut = useMutation({
    mutationFn: ({ nodeId, force }) => deleteNode(dealId, nodeId, { force }),
    onSuccess: invalidate,
  });

  const createEdgeMut = useMutation({ mutationFn: (payload) => createEdge(dealId, payload), onSuccess: invalidate });

  /**
   * Give a node a different owner, its first owner, or none — in one operation.
   *
   * <p>Composed rather than exposed as two calls because the halves must not be seen apart. The
   * dialog has always done create-then-delete (AttachToParentDialog), but behind a modal, where
   * the moment between them is invisible. A drag has no modal: run the same pair through
   * `createEdge` and `deleteEdge` and each one's own `invalidate` refetches between them, so the
   * tree draws the node under BOTH owners for a frame. One mutation, one invalidate at the end.
   *
   * <p>Order is the dialog's, for the dialog's reason: the server refuses an edge that would close
   * a cycle, so a rejected move leaves the node where it was. Cutting first would strand it.
   *
   * <p>`toParentNodeId: null` is a detach; `fromEdgeId: null` is an attach from the top level.
   */
  const moveNodeMut = useMutation({
    mutationFn: async ({ nodeId, fromEdgeId, toParentNodeId, percentage }) => {
      const created = toParentNodeId == null ? null : await createEdge(dealId, {
        parentNodeId: toParentNodeId,
        childNodeId: nodeId,
        percentage: percentage ?? null,
      });
      if (fromEdgeId != null) await deleteEdge(dealId, fromEdgeId);
      return created;
    },
    // The row lands where it was dropped now, not two round-trips from now. Without this a drag
    // feels like a form: you let go, and nothing happens for as long as the network takes.
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData(key);
      qc.setQueryData(key, (prev) => applyMoveLocally(prev, vars));
      return { previous };
    },
    // Put it back immediately rather than waiting for the refetch below to correct it — a failed
    // move that lingers in the wrong place for a round-trip reads as a move that worked.
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(key, ctx.previous);
    },
    // Both paths: the server stays the authority on what the structure is.
    onSettled: invalidate,
  });

  /**
   * The new top-to-bottom order of one sibling group.
   *
   * <p>Optimistic like the move above, and for the same reason: dragging a row two places up
   * and watching it stay put until the network answers is worse than not being able to drag it
   * at all. The server returns the whole tree, which the invalidate below picks up.
   */
  const reorderMut = useMutation({
    mutationFn: (payload) => reorder(dealId, payload),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData(key);
      qc.setQueryData(key, (prev) => applyOrderLocally(prev, vars));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(key, ctx.previous);
    },
    onSettled: invalidate,
  });

  const updateEdgeMut = useMutation({
    mutationFn: ({ edgeId, payload }) => updateEdge(dealId, edgeId, payload),
    onSuccess: invalidate,
  });
  const deleteEdgeMut = useMutation({
    mutationFn: (edgeId) => deleteEdge(dealId, edgeId),
    onSuccess: invalidate,
  });


  return {
    tree: treeQ.data,
    loading: treeQ.isLoading,
    error: treeQ.error,
    refetch: treeQ.refetch,
    createNode: createNodeMut,
    updateNode: updateNodeMut,
    deleteNode: deleteNodeMut,
    createEdge: createEdgeMut,
    moveNode: moveNodeMut,
    reorder: reorderMut,
    updateEdge: updateEdgeMut,
    deleteEdge: deleteEdgeMut,
  };
}
