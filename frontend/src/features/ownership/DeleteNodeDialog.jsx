import { useState } from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { collectCascade } from './cascade.js';

/**
 * Confirms removing a node and everything it holds up.
 *
 * <p>The count is the point. On a graph you cannot see the blast radius by looking at the row — a
 * company three levels down may hold up a dozen people, or none of them, depending on who else owns
 * them — so the dialog counts before you commit rather than after.
 *
 * <p>The count comes from the client-side copy of the rule in cascade.js; the server recomputes it
 * and is the authority on what actually goes.
 */
export function DeleteNodeDialog({ open, tree, nodeId, onClose, onDeleted, useTree }) {
  const [error, setError] = useState(null);
  const pending = useTree.deleteNode.isPending;

  const node = (tree?.nodes ?? []).find((n) => n.id === nodeId);
  const alsoGoing = nodeId == null ? 0 : collectCascade(tree, nodeId).size - 1;

  const handleDelete = async () => {
    setError(null);
    try {
      await useTree.deleteNode.mutateAsync({ nodeId, force: true });
      onDeleted?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not remove this node. Try again.');
    }
  };

  return (
    <Dialog
      open={open}
      // Closing mid-delete would leave the caller unsure whether it happened.
      onClose={pending ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>
        {alsoGoing > 0
          ? `Delete ${node?.displayName ?? 'this node'} and ${alsoGoing} below it?`
          : `Delete ${node?.displayName ?? 'this node'}?`}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: alsoGoing > 0 ? 1.5 : 0 }}>
          {alsoGoing > 0
            ? `${node?.displayName ?? 'This node'} and everything it holds up will be removed from
               the ownership structure. Anything still owned elsewhere in the structure stays.`
            : `${node?.displayName ?? 'This node'} will be removed from the ownership structure.`}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This cannot be undone, and any documents attached to the removed nodes go with them.
        </Typography>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={pending}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          startIcon={<DeleteOutlineIcon />}
          onClick={handleDelete}
          disabled={pending}
        >
          {pending ? 'Deleting…' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
