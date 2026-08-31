import { useEffect, useState } from 'react';
import {
  Box, Button, Drawer, IconButton, Stack, Tab, Tabs, Tooltip, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { NodeEditorPane } from '../../ownership/NodeEditorPane.jsx';
import { nodeTypeLabel } from '../../../api/ownership.js';
import { tokens, fonts, motion } from '../../../theme/theme.js';

/**
 * The five faces of one owner. `pep` and `echecks` are parked — labelled, reachable, and honest
 * about having nothing behind them yet.
 */
const TABS = [
  { value: 'details', label: 'Details' },
  { value: 'documents', label: 'Documents' },
  { value: 'echecks', label: 'eChecks' },
  { value: 'pep', label: 'PEP' },
  { value: 'verification', label: 'Verification' },
];

/**
 * One owner, opened from the structure.
 *
 * <p>A drawer rather than a third panel: the tree is the subject of this screen and deserves the
 * width, and a reviewer works one owner at a time. It comes in over the tree so the chain stays
 * visible behind it — you can still see where in the structure you are.
 *
 * <p>The panel is temporary and dismissible in every way a panel should be: Escape, the close
 * button, the footer, or clicking the tree behind it. Nothing here is a commit, so leaving costs
 * nothing — each tab saves its own work with its own button.
 */
export function NodeDrawer({ open, node, tree, useTree, dealId, onClose, onRequestDelete, readOnly = false }) {
  const [tab, setTab] = useState('details');

  // A different owner opens on Details. Landing on whichever tab the last one was left on would
  // mean opening a person and being shown an empty documents list for no reason.
  useEffect(() => { if (node?.id) setTab('details'); }, [node?.id]);

  const typeLabel = node ? nodeTypeLabel(node.nodeType) : '';

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      transitionDuration={{ enter: parseInt(motion.enter, 10), exit: 200 }}
      slotProps={{
        backdrop: { sx: { backgroundColor: 'rgba(15, 23, 42, 0.32)' } },
      }}
      PaperProps={{
        sx: motion.respectful({
          width: { xs: '100%', sm: 560, md: 640 },
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: tokens.tile,
          backgroundImage: 'none',
          borderLeft: `1px solid ${tokens.hairline}`,
          transitionTimingFunction: motion.ease,
        }),
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Stack
        direction="row"
        alignItems="flex-start"
        spacing={1}
        sx={{ px: 2.5, pt: 2.5, pb: 1.5 }}
      >
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography
            sx={{
              fontFamily: fonts.mono,
              fontSize: '0.62rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: tokens.blue,
            }}
          >
            Update {typeLabel}
          </Typography>
          <Typography
            sx={{
              fontFamily: fonts.display,
              fontSize: '1.25rem',
              lineHeight: 1.25,
              color: tokens.ink,
              wordBreak: 'break-word',
            }}
          >
            {node?.displayName ?? ''}
          </Typography>
        </Box>
        <Tooltip title="Close">
          <IconButton onClick={onClose} size="small" aria-label="Close owner panel">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons={false}
        sx={{
          px: 1,
          borderBottom: `1px solid ${tokens.hairline}`,
          // No minHeight here or on the tab. The theme's track carries 5px of padding around the
          // pill, so its height and the tab's are one sum — 5 + 38 + 5 — and overriding half of it
          // left the pill sitting off-centre in its own highlight.
          '& .MuiTab-root': {
            textTransform: 'none',
            fontSize: '0.78rem',
            fontFamily: fonts.body,
            // Horizontal padding still comes down: the theme's 18px is sized for a page-width
            // strip, and five tabs have to fit a panel without the last one clipping.
            minWidth: 0,
            px: 1.25,
          },
        }}
      >
        {TABS.map((t) => (
          <Tab key={t.value} value={t.value} label={t.label} id={`node-tab-${t.value}`} />
        ))}
      </Tabs>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <Box
        sx={motion.respectful({
          flexGrow: 1,
          overflowY: 'auto',
          px: 2.5,
          // Every tab opens on a field or a heading, and a label sitting tight under the tab strip
          // reads as part of it. The top gets more room than the bottom needs.
          pt: 4,
          pb: 2.5,
          // Keyed on the tab so switching re-runs the entrance — the same quiet rise the deal
          // panels use, so the two tab strips behave alike.
          animation: `nodePanelIn ${motion.swift} ${motion.ease} both`,
          '@keyframes nodePanelIn': {
            from: { opacity: 0, transform: 'translateY(4px)' },
            to: { opacity: 1, transform: 'none' },
          },
        })}
        key={tab}
      >
        {node && (
          <NodeEditorPane
            readOnly={readOnly}
            tree={tree}
            selectedNodeId={node.id}
            useTree={useTree}
            dealId={dealId}
            tab={tab}
            onRequestDelete={onRequestDelete}
          />
        )}
      </Box>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          borderTop: `1px solid ${tokens.hairline}`,
          backgroundColor: tokens.tileRaised,
        }}
      >
        <Button fullWidth variant="outlined" onClick={onClose}>Close</Button>
      </Box>
    </Drawer>
  );
}
