import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createEdge, createNode, deleteEdge, deleteNode,
  getTree, updateEdge, updateNode,
} from '../../api/ownership.js';

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
    updateEdge: updateEdgeMut,
    deleteEdge: deleteEdgeMut,
  };
}
