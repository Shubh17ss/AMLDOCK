import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createEdge, createNode, deleteEdge, deleteNode,
  getTree, setRoot, updateEdge, updateNode,
} from '../../api/ownership.js';

export function useOwnershipTree(dealId) {
  const qc = useQueryClient();
  const key = ['ownership', dealId];

  const treeQ = useQuery({
    queryKey: key,
    queryFn: () => getTree(dealId),
    enabled: Boolean(dealId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

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

  const setRootMut = useMutation({ mutationFn: (nodeId) => setRoot(dealId, nodeId), onSuccess: invalidate });

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
    setRoot: setRootMut,
  };
}
