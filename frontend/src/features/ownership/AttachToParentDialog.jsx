import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import { EDGE_ROLES } from '../../api/ownership.js';

/**
 * Lets the user attach an existing detached node to a chosen parent.
 *
 * Validates *in the UI* that the chosen parent isn't the node itself or one of its
 * descendants (cycle prevention). The backend also enforces cycle detection on save —
 * this is a defence-in-depth that also makes the dropdown clean.
 */
export function AttachToParentDialog({ open, onClose, node, tree, useTree }) {
  const [parentId, setParentId] = useState('');
  const [percentage, setPercentage] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setParentId('');
      setPercentage('');
      setRole('');
      setError(null);
    }
  }, [open, node?.id]);

  // Valid parents = every node except `node` and the subtree rooted at `node`.
  const validParents = useMemo(() => {
    if (!node || !tree) return [];
    const forbidden = new Set([node.id]);
    const queue = [node.id];
    while (queue.length > 0) {
      const id = queue.shift();
      tree.edges
        .filter((e) => e.parentNodeId === id)
        .forEach((e) => {
          if (!forbidden.has(e.childNodeId)) {
            forbidden.add(e.childNodeId);
            queue.push(e.childNodeId);
          }
        });
    }
    return tree.nodes
      .filter((n) => !forbidden.has(n.id))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [node?.id, tree]);

  const submit = async (e) => {
    e.preventDefault();
    if (!parentId) {
      setError('Pick a parent node');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await useTree.createEdge.mutateAsync({
        parentNodeId: parentId,
        childNodeId: node.id,
        percentage: percentage === '' ? null : Number(percentage),
        role: role || null,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to attach');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>
          Attach <strong>{node?.displayName ?? 'node'}</strong> to a parent
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Pick the node that should sit <em>above</em> {node?.displayName ?? 'this node'} in
              the ownership tree. Ancestors-of-self are hidden from the list to prevent cycles.
            </Typography>

            <FormControl required disabled={validParents.length === 0}>
              <InputLabel id="parent-label">Parent node</InputLabel>
              <Select
                labelId="parent-label"
                label="Parent node"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                {validParents.map((n) => (
                  <MenuItem key={n.id} value={n.id}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>{n.displayName}</span>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={n.nodeType.replaceAll('_', ' ').toLowerCase()}
                      />
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
              {validParents.length === 0 && (
                <Typography variant="caption" color="warning.main" sx={{ mt: 0.5 }}>
                  No valid parents — the tree only has this node (or its descendants).
                </Typography>
              )}
            </FormControl>

            <Stack direction="row" spacing={2}>
              <TextField
                label="Percentage"
                type="number"
                inputProps={{ min: 0, max: 100, step: 0.01 }}
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                sx={{ width: 180 }}
                helperText="Optional"
              />
              <FormControl sx={{ minWidth: 220 }}>
                <InputLabel id="role-label">Role</InputLabel>
                <Select
                  labelId="role-label"
                  label="Role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {EDGE_ROLES.map((r) => (
                    <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || !parentId}
          >
            {submitting ? 'Attaching…' : 'Attach'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
