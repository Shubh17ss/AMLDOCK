import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, Stack, TextField, Typography,
} from '@mui/material';
import { NODE_TYPES, nameLabelFor } from '../../api/ownership.js';
import { visualFor, tintOf } from './nodeTypeVisual.js';
import { tokens, fonts, motion } from '../../theme/theme.js';

/**
 * What the picker offers. `OTHER` is a real stored type and still renders everywhere else, but
 * nobody should be choosing it: an owner nobody could classify is a gap in the file, not a kind
 * of owner.
 */
const PICKABLE = NODE_TYPES.filter((t) => t.value !== 'OTHER');

/**
 * Adds an owner: pick a type, name it, done.
 *
 * <p>It used to be the whole node form — a type dropdown followed by every field that type
 * carries. The drawer now edits exactly those fields against a saved owner, so asking here was
 * asking twice, and a dropdown made choosing a type feel like filling in a form. A grid of cards
 * makes it what it is: picking a thing.
 *
 * <p>Three steps on submit, none of them a question any more:
 *   1) POST /ownership/nodes — type and name, the only two columns that are NOT NULL
 *   2) (if parentNodeId) POST /ownership/edges — no percentage; the drawer sets that
 *   3) (if the structure was empty) POST /ownership/root
 *
 * Props:
 *   open, onClose
 *   parentNodeId: number | null — if set, the new owner is linked under that parent
 *   parentLabel: string — the parent's name, named in the subtitle
 *   isFirstNode: boolean — an empty structure roots whatever is added first
 *   useTree: result of useOwnershipTree(dealId)
 *   onCreated: (nodeId) => void — the review screen opens the drawer on it
 */
export function AddNodeDialog({
  open, onClose, parentNodeId, parentLabel, isFirstNode, useTree, onCreated,
}) {
  const [nodeType, setNodeType] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setNodeType(null);
      setDisplayName('');
      setError(null);
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (!nodeType || !displayName.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const created = await useTree.createNode.mutateAsync({
        nodeType,
        displayName: displayName.trim(),
      });
      if (parentNodeId != null) {
        await useTree.createEdge.mutateAsync({
          parentNodeId,
          childNodeId: created.id,
          percentage: null,
        });
      }
      if (isFirstNode && parentNodeId == null) {
        await useTree.setRoot.mutateAsync(created.id);
      }
      onClose();
      onCreated?.(created.id);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not add this owner');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogContent sx={{ pt: 4, pb: 2 }}>
          <Stack spacing={1} sx={{ textAlign: 'center', mb: 3 }}>
            <Typography sx={{ fontFamily: fonts.display, fontSize: '1.3rem', color: tokens.ink }}>
              Add owner
            </Typography>
            <Typography variant="body2" sx={{ color: tokens.muted }}>
              {parentNodeId != null
                ? <>What sits under <strong>{parentLabel}</strong>?</>
                : 'What type of owner do you want to add?'}
            </Typography>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              // Four across where there is room, two on a phone. A CSS grid rather than MUI's,
              // which is mid-migration between two APIs and not worth the argument here.
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
              gap: 1.25,
            }}
          >
            {PICKABLE.map((t) => (
              <TypeCard
                key={t.value}
                type={t}
                selected={nodeType === t.value}
                onSelect={() => setNodeType(t.value)}
              />
            ))}
          </Box>

          {/* The one thing the drawer cannot supply, because an owner has to exist before it can
              be edited and the name is the only field the database insists on. */}
          {nodeType && (
            <Box sx={motion.respectful({
              mt: 3,
              animation: `nameIn ${motion.swift} ${motion.ease} both`,
              '@keyframes nameIn': {
                from: { opacity: 0, transform: 'translateY(-4px)' },
                to: { opacity: 1, transform: 'none' },
              },
            })}>
              <TextField
                fullWidth
                autoFocus
                label={nameLabelFor(nodeType)}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                helperText="Everything else is filled in on the owner's own panel."
              />
            </Box>
          )}

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || !nodeType || !displayName.trim()}
          >
            {submitting ? 'Adding…' : 'Add owner'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

/** One owner type: its colour, its glyph, its name. */
function TypeCard({ type, selected, onSelect }) {
  const { hue, Icon } = visualFor(type.value);

  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      sx={motion.respectful({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 2,
        cursor: 'pointer',
        borderRadius: 3,
        backgroundColor: selected ? tokens.blueWash : tokens.tile,
        // One border that changes colour rather than a border plus a ring: an outline added on
        // selection would shift every neighbouring card by a pixel.
        border: `1.5px solid ${selected ? tokens.blue : tokens.hairline}`,
        font: 'inherit',
        transition: `background-color ${motion.swift} ease, border-color ${motion.swift} ease`,
        '&:hover': { backgroundColor: selected ? tokens.blueWash : tokens.hover },
        '&:focus-visible': { outline: `2px solid ${tokens.blue}`, outlineOffset: 2 },
      })}
    >
      <Box
        sx={{
          width: 48, height: 48, borderRadius: '50%',
          display: 'grid', placeItems: 'center',
          backgroundColor: tintOf(hue),
          color: hue,
        }}
      >
        <Icon sx={{ fontSize: 26 }} />
      </Box>
      <Typography
        variant="caption"
        sx={{ color: tokens.ink, lineHeight: 1.25, textAlign: 'center' }}
      >
        {type.label}
      </Typography>
    </Box>
  );
}
