import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, Divider, FormControl, IconButton, InputLabel, MenuItem,
  Paper, Select, Stack, Tab, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';
import { EDGE_ROLES } from '../../api/ownership.js';
import { NodeFormFields, buildNodePayload } from './NodeFormFields.jsx';

/**
 * Editor for a selected ownership node. Lets the user:
 *   - rename / patch type-specific fields
 *   - inspect the incoming edge and edit its percentage / role
 *   - delete the node (with cascade confirm if it has edges)
 * Documents and Verifications tabs are placeholders for M8 / M9.
 */
export function NodeEditorPane({ tree, selectedNodeId, useTree, onCleared }) {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState(null);
  const [edgeForm, setEdgeForm] = useState({ percentage: '', role: '' });
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const selected = useMemo(
    () => tree?.nodes?.find((n) => n.id === selectedNodeId) ?? null,
    [tree, selectedNodeId],
  );

  const incomingEdge = useMemo(
    () => tree?.edges?.find((e) => e.childNodeId === selectedNodeId) ?? null,
    [tree, selectedNodeId],
  );

  // Hydrate the form when selection changes
  useEffect(() => {
    if (selected) {
      setForm({
        nodeType: selected.nodeType,
        displayName: selected.displayName,
        dateOfBirth: selected.dateOfBirth ?? '',
        idDocumentType: selected.idDocumentType ?? '',
        idDocumentNumber: selected.idDocumentNumber ?? '',
        idDocumentCountry: selected.idDocumentCountry ?? '',
        nzbn: selected.nzbn ?? '',
        companyNumber: selected.companyNumber ?? '',
        incorporationDate: selected.incorporationDate ?? '',
        registeredOffice: selected.registeredOffice ?? '',
        trustName: selected.trustName ?? '',
        trustDeedDocumentId: selected.trustDeedDocumentId ?? '',
        settlorName: selected.settlorName ?? '',
      });
      setError(null);
    } else {
      setForm(null);
    }
  }, [selected?.id]);

  useEffect(() => {
    if (incomingEdge) {
      setEdgeForm({
        percentage: incomingEdge.percentage ?? '',
        role: incomingEdge.role ?? '',
      });
    } else {
      setEdgeForm({ percentage: '', role: '' });
    }
  }, [incomingEdge?.id]);

  if (!selected || !form) {
    return (
      <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
        <Typography color="text.secondary" variant="body2">
          Select a node from the tree to view or edit its details.
        </Typography>
      </Paper>
    );
  }

  const saveDetails = async () => {
    setError(null);
    try {
      await useTree.updateNode.mutateAsync({ nodeId: selected.id, payload: buildNodePayload(form) });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    }
  };

  const saveEdge = async () => {
    if (!incomingEdge) return;
    setError(null);
    try {
      await useTree.updateEdge.mutateAsync({
        edgeId: incomingEdge.id,
        payload: {
          percentage: edgeForm.percentage === '' ? null : Number(edgeForm.percentage),
          role: edgeForm.role || null,
        },
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update edge');
    }
  };

  const detachFromParent = async () => {
    if (!incomingEdge) return;
    try {
      await useTree.deleteEdge.mutateAsync(incomingEdge.id);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to detach');
    }
  };

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      // Try without force first.
      await useTree.deleteNode.mutateAsync({ nodeId: selected.id, force: false });
      onCleared?.();
    } catch (err) {
      const message = err.response?.data?.message || '';
      if (/edges/i.test(message)) {
        if (window.confirm('This node has edges. Delete it anyway? Edges will also be removed.')) {
          try {
            await useTree.deleteNode.mutateAsync({ nodeId: selected.id, force: true });
            onCleared?.();
          } catch (err2) {
            setError(err2.response?.data?.message || 'Failed to force-delete');
          }
        }
      } else {
        setError(message || 'Failed to delete');
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
          {selected.displayName}
        </Typography>
        <Chip size="small" label={selected.nodeType.replaceAll('_', ' ').toLowerCase()} variant="outlined" />
        <Tooltip title="Delete node">
          <IconButton size="small" color="error" onClick={handleDelete} disabled={deleting}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tab label="Details" />
        <Tab label="Documents" />
        <Tab label="Verifications" />
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {tab === 0 && (
        <Stack spacing={3} sx={{ overflowY: 'auto' }}>
          <NodeFormFields value={form} onChange={setForm} includeTypeSelector={false} />

          {incomingEdge && (
            <>
              <Divider />
              <Typography variant="subtitle2">Link from parent</Typography>
              <Stack direction="row" spacing={2}>
                <TextField label="Percentage" type="number" inputProps={{ min: 0, max: 100, step: 0.01 }}
                           value={edgeForm.percentage}
                           onChange={(e) => setEdgeForm((p) => ({ ...p, percentage: e.target.value }))}
                           sx={{ width: 180 }} />
                <FormControl sx={{ minWidth: 200 }}>
                  <InputLabel id="edge-role-label">Role</InputLabel>
                  <Select labelId="edge-role-label" label="Role" value={edgeForm.role}
                          onChange={(e) => setEdgeForm((p) => ({ ...p, role: e.target.value }))}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {EDGE_ROLES.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" onClick={saveEdge}
                        disabled={useTree.updateEdge.isPending}>Save link</Button>
                <Button size="small" color="error" onClick={detachFromParent}
                        disabled={useTree.deleteEdge.isPending}>Detach from parent</Button>
              </Stack>
            </>
          )}

          <Divider />
          <Box>
            <Button variant="contained" startIcon={<SaveIcon />} onClick={saveDetails}
                    disabled={useTree.updateNode.isPending}>
              {useTree.updateNode.isPending ? 'Saving…' : 'Save details'}
            </Button>
          </Box>
        </Stack>
      )}

      {tab === 1 && (
        <Alert severity="info">Per-node document attachments arrive in M8 (PDF viewer + side-by-side).</Alert>
      )}

      {tab === 2 && (
        <Alert severity="info">Verification checks (LINZ / NZBN / IDV mocks) arrive in M9.</Alert>
      )}
    </Paper>
  );
}
