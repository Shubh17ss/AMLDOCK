import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import { EDGE_ROLES } from '../../api/ownership.js';
import { NodeFormFields, buildNodePayload } from './NodeFormFields.jsx';

const EMPTY_NODE = {
  nodeType: 'NATURAL_PERSON',
  displayName: '',
  dateOfBirth: '',
  idDocumentType: '',
  idDocumentNumber: '',
  idDocumentCountry: 'NZ',
  nzbn: '',
  companyNumber: '',
  incorporationDate: '',
  registeredOffice: '',
  trustName: '',
  trustDeedDocumentId: '',
  settlorName: '',
};

/**
 * Adds a node, optionally linking it to a parent in the same transaction:
 *   1) POST /ownership/nodes
 *   2) (if parentNodeId) POST /ownership/edges
 *   3) (if no current root and not adding under a parent) POST /ownership/root
 *
 * Props:
 *   open, onClose
 *   parentNodeId: number | null — if set, this is an "add child" flow and an edge will be created
 *   parentLabel: string — display label for the parent (rendered in dialog title)
 *   isFirstNode: boolean — if true, prompt to make this node the root
 *   useTree: result of useOwnershipTree(dealId) — exposes createNode / createEdge / setRoot mutations
 */
export function AddNodeDialog({ open, onClose, parentNodeId, parentLabel, isFirstNode, useTree }) {
  const [form, setForm] = useState(EMPTY_NODE);
  const [edge, setEdge] = useState({ percentage: '', role: '' });
  const [makeRoot, setMakeRoot] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_NODE);
      setEdge({ percentage: '', role: '' });
      setMakeRoot(isFirstNode);
      setError(null);
    }
  }, [open, isFirstNode]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await useTree.createNode.mutateAsync(buildNodePayload(form));
      if (parentNodeId != null) {
        await useTree.createEdge.mutateAsync({
          parentNodeId,
          childNodeId: created.id,
          percentage: edge.percentage === '' ? null : Number(edge.percentage),
          role: edge.role || null,
        });
      }
      if (makeRoot) {
        await useTree.setRoot.mutateAsync(created.id);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to add node');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>
          {parentNodeId != null
            ? <>Add child of <strong>{parentLabel}</strong></>
            : 'Add ownership node'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <NodeFormFields value={form} onChange={setForm} />

            {parentNodeId != null && (
              <>
                <Divider />
                <Typography variant="subtitle2">Link to parent</Typography>
                <Stack direction="row" spacing={2}>
                  <TextField label="Percentage" type="number" inputProps={{ min: 0, max: 100, step: 0.01 }}
                             value={edge.percentage}
                             onChange={(e) => setEdge((p) => ({ ...p, percentage: e.target.value }))}
                             helperText="Shareholders / partners. Leave blank for role-only edges (e.g. trustees)."
                             sx={{ width: 200 }} />
                  <FormControl sx={{ minWidth: 220 }}>
                    <InputLabel id="role-label">Role</InputLabel>
                    <Select labelId="role-label" label="Role" value={edge.role}
                            onChange={(e) => setEdge((p) => ({ ...p, role: e.target.value }))}>
                      <MenuItem value=""><em>None</em></MenuItem>
                      {EDGE_ROLES.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Stack>
              </>
            )}

            {parentNodeId == null && (
              <FormControl>
                <Stack direction="row" spacing={1} alignItems="center">
                  <input type="checkbox" checked={makeRoot} onChange={(e) => setMakeRoot(e.target.checked)} />
                  <Typography variant="body2">Make this the root node of the ownership tree</Typography>
                </Stack>
              </FormControl>
            )}

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={submitting || !form.displayName}>
            {submitting ? 'Saving…' : 'Add node'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
