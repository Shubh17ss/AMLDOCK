import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, IconButton, Menu, MenuItem, Stack, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddLinkIcon from '@mui/icons-material/AddLink';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import { isLeafOnlyType, nodeTypeLabel, personRoleLabel, trustTypeLabel } from '../../api/ownership.js';
import { countryName } from '../../data/countries.js';
import { formatPropertyAddress } from '../../data/addressFinderMeta.js';
import { propertyTypeLabel } from '../../data/propertyTypes.js';
import { visualFor, tintOf } from './nodeTypeVisual.js';
import { tokens, fonts, motion } from '../../theme/theme.js';

const VERIFICATION_COLOR = {
  NOT_STARTED: 'default',
  IN_PROGRESS: 'info',
  VERIFIED: 'success',
  FAILED: 'error',
};

/** Rows fade in one after another on first paint, and never again. */
const STAGGER_MS = 30;
const STAGGER_CAP = 10;   // ~300ms for the whole tree, however deep it goes

/**
 * The second line of a node card: what this owner is to this deal.
 *
 * <p>Type alone is nearly useless to a reviewer — half the tree is a company of some sort. What
 * they need at a glance is the distinguishing fact: which jurisdiction, which capacity, what kind
 * of trust. Only what is actually recorded appears; nothing is padded with "not stated".
 */
function subtitleFor(node) {
  const parts = [nodeTypeLabel(node.nodeType)];
  if (node.personRole) parts.push(personRoleLabel(node.personRole));
  if (node.jurisdictionCountry) parts.push(countryName(node.jurisdictionCountry));
  if (node.trustType) parts.push(trustTypeLabel(node.trustType));
  return parts.join(' · ');
}

/**
 * Why this node pushed the deal to High risk, or null.
 *
 * <p>The same three answers {@code DealRiskService.reason} checks, phrased the same way. Two
 * copies of a rule will disagree eventually, so if this grows a fourth case the server's version
 * is the one to read.
 */
function riskReasonFor(node) {
  if (node.nomineeStatus === 'YES') {
    return node.nodeType === 'LIMITED_PARTNERSHIP'
      ? 'Reports a nominee limited partner — this sets the deal to High risk'
      : 'Reports a nominee director or shareholder — this sets the deal to High risk';
  }
  if (node.companyComplexOwnership === true) {
    return 'Reports a complex ownership structure — this sets the deal to High risk';
  }
  if (node.trustHoldingComplexity === 'EXTENSIVE_DIVERSE_PORTFOLIO') {
    return 'Holds an extensive or diverse asset portfolio — this sets the deal to High risk';
  }
  return null;
}

export function OwnershipTreeBuilder({
  tree,
  deal,
  selectedNodeId,
  onSelectNode,
  onAddRoot,
  onAddChild,
  onSetRoot,
  onAttachDetached,
  onDeleteNode,
  // Hides every control that changes the chain, leaving the chain itself readable. Selecting a
  // node still works — looking at an owner is not editing one.
  readOnly = false,
  /** Opens the deal itself, from the property at the head of the chain. */
  onOpenDeal,
  dealSelected = false,
}) {
  const { nodesById, childrenByParent, parentIdByChild } = useMemo(() => indexTree(tree), [tree]);
  const root = tree?.rootNodeId ? nodesById.get(tree.rootNodeId) : null;

  const detached = useMemo(() => {
    if (!tree) return [];
    return tree.nodes
      .filter((n) => !parentIdByChild.has(n.id) && n.id !== tree.rootNodeId)
      .sort((a, b) => a.id - b.id);
  }, [tree, parentIdByChild]);

  if (!tree) return null;

  // One counter threaded through the render so the stagger follows reading order rather than
  // restarting at each branch.
  const order = { i: 0 };

  const branchProps = {
    nodesById,
    childrenByParent,
    selectedNodeId,
    onSelectNode,
    onAddChild,
    onSetRoot,
    onAttachDetached,
    onDeleteNode,
    readOnly,
    order,
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Box>
          <Typography sx={{ fontFamily: fonts.display, fontSize: '1.05rem', color: tokens.ink }}>
            Ownership structure
          </Typography>
          <Typography variant="caption" sx={{ color: tokens.muted }}>
            Who stands behind this property, down to the people
          </Typography>
        </Box>
        {!readOnly && (
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={onAddRoot}>
            Add owner
          </Button>
        )}
      </Stack>

      <Box
        sx={{
          border: `1px solid ${tokens.hairline}`,
          borderRadius: 3,
          backgroundColor: tokens.tile,
          overflow: 'hidden',
        }}
      >
        {deal && <PropertyAnchor deal={deal} onOpen={onOpenDeal} selected={dealSelected} />}

        <Box sx={{ px: { xs: 1, sm: 2 }, py: 2 }}>
          {tree.nodes.length === 0 ? (
            <Alert severity="info" sx={{ m: 0 }}>
              Nothing here yet. Add the entity or person that owns this property — everyone else
              hangs off them.
            </Alert>
          ) : (
            <>
              {root && <NodeBranch node={root} parentEdge={null} depth={0} isRoot {...branchProps} />}

              {detached.length > 0 && (
                <Box sx={{ mt: root ? 2.5 : 0 }}>
                  {root && (
                    <Typography
                      sx={{
                        fontFamily: fonts.mono,
                        fontSize: '0.62rem',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: tokens.muted,
                        pl: 0.5,
                        mb: 0.75,
                      }}
                    >
                      Not yet attached
                    </Typography>
                  )}
                  {detached.map((n) => (
                    <NodeBranch key={n.id} node={n} parentEdge={null} depth={0} {...branchProps} />
                  ))}
                </Box>
              )}
            </>
          )}
        </Box>
      </Box>
    </Stack>
  );
}

/**
 * The property the deal is about, at the head of the chain.
 *
 * <p>Still not a tree row: no type chip, no menu, and none of the chain's own actions can aim at
 * it — a reviewer reaching for "Make root" must never land here. It is the deal's property rather
 * than an ownership node, and it sits at the top because a chain of owners with nothing above
 * them reads as a list.
 *
 * <p>It does open the deal, though. Everything else in this tree opens a drawer when you click
 * it, and the property is where a reader already looks for "what is this deal" — so it opens the
 * deal drawer rather than an owner one. Opening is not editing, so `readOnly` does not gate it,
 * exactly as it does not gate selecting a node.
 */
function PropertyAnchor({ deal, onOpen, selected = false }) {
  const p = deal.property ?? {};
  const address = formatPropertyAddress(p) || 'Property address not recorded';
  const detail = [
    p.propertyType ? propertyTypeLabel(p.propertyType) : null,
    'the property this deal concerns',
  ].filter(Boolean).join(' · ');

  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-pressed={onOpen ? selected : undefined}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (!onOpen) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); }
      }}
      sx={motion.respectful({
        px: { xs: 1.5, sm: 2.5 },
        py: 1.75,
        backgroundColor: selected ? tokens.blueWash : tokens.tileRaised,
        borderBottom: `1px solid ${tokens.hairline}`,
        cursor: onOpen ? 'pointer' : 'default',
        // An inset bar rather than a border: this band is full-bleed with no border of its own,
        // so anything outset would either be clipped by the parent's overflow or move the row.
        boxShadow: selected ? `inset 3px 0 0 ${tokens.blue}` : 'none',
        transition: `background-color ${motion.swift} ease, box-shadow ${motion.swift} ease`,
        '&:hover': onOpen
          ? { backgroundColor: selected ? tokens.blueWash : tokens.hover }
          : {},
        '&:focus-visible': { outline: `2px solid ${tokens.blue}`, outlineOffset: -2 },
      })}
    >
      <Box
        sx={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          display: 'grid', placeItems: 'center',
          backgroundColor: tokens.blueWash, color: tokens.blue,
        }}
      >
        <HomeWorkOutlinedIcon fontSize="small" />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontFamily: fonts.display, fontSize: '0.94rem', color: tokens.ink,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {address}
        </Typography>
        <Typography variant="caption" sx={{ color: tokens.muted }}>{detail}</Typography>
      </Box>
    </Stack>
  );
}

function NodeBranch({
  node, parentEdge, depth, isRoot = false,
  nodesById, childrenByParent, selectedNodeId, onSelectNode, onAddChild, onSetRoot,
  onAttachDetached, onDeleteNode, readOnly, order,
}) {
  const children = childrenByParent.get(node.id) ?? [];
  const [expanded, setExpanded] = useState(true);
  const [menuAnchor, setMenuAnchor] = useState(null);

  const isSelected = selectedNodeId === node.id;
  // "Detached" = renders at the top level but isn't the root. Its descendants render normally
  // (with parentEdge set) and should NOT show the attach action.
  const isDetached = !isRoot && !parentEdge;
  const riskReason = riskReasonFor(node);
  const visual = visualFor(node.nodeType);

  // Captured at first render and never recomputed: a tree that re-animated on every save would
  // be exhausting to work in.
  const [delay] = useState(() => Math.min(order.i++, STAGGER_CAP) * STAGGER_MS);

  return (
    <Box>
      <Box
        sx={{
          position: 'relative',
          pl: depth === 0 ? 0 : 3.5,
          // The rail: one hairline per level of depth, drawn as the row's left border rather
          // than a stack of spacer divs.
          '&::before': depth === 0 ? undefined : {
            content: '""',
            position: 'absolute',
            left: 10, top: 0, bottom: 0,
            borderLeft: `1px solid ${tokens.hairline2}`,
          },
          // The elbow into this row.
          '&::after': depth === 0 ? undefined : {
            content: '""',
            position: 'absolute',
            left: 10, top: 26,
            width: 16,
            borderTop: `1px solid ${tokens.hairline2}`,
          },
        }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          role="button"
          tabIndex={0}
          aria-pressed={isSelected}
          onClick={() => onSelectNode(node.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectNode(node.id); }
          }}
          sx={motion.respectful({
            px: 1.25,
            py: 1,
            my: 0.4,
            borderRadius: 2.5,
            cursor: 'pointer',
            backgroundColor: isSelected ? tokens.blueWash : tokens.tile,
            border: `1px solid ${isSelected ? tokens.blue : tokens.hairline}`,
            transition: `background-color ${motion.swift} ease, border-color ${motion.swift} ease`,
            animation: `nodeIn ${motion.swift} ${motion.ease} ${delay}ms both`,
            '@keyframes nodeIn': {
              from: { opacity: 0, transform: 'translateX(-6px)' },
              to: { opacity: 1, transform: 'none' },
            },
            '&:hover': { backgroundColor: isSelected ? tokens.blueWash : tokens.hover },
            '&:focus-visible': { outline: `2px solid ${tokens.blue}`, outlineOffset: 2 },
            // Row actions rest quietly and come forward on approach — but never disappear for
            // anyone arriving by keyboard.
            '&:hover .rowAction, &:focus-within .rowAction': { opacity: 1 },
          })}
        >
          <IconButton
            size="small"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            disabled={children.length === 0}
            sx={{ visibility: children.length > 0 ? 'visible' : 'hidden', p: 0.25 }}
          >
            {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </IconButton>

          {/* The type's colour holds whether the row is selected or not — identity should not
              change when you click on something. The row itself carries the selected state. */}
          <Box
            sx={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              display: 'grid', placeItems: 'center',
              backgroundColor: tintOf(visual.hue),
              color: visual.hue,
            }}
          >
            {isRoot ? <StarIcon fontSize="small" /> : <visual.Icon fontSize="small" />}
          </Box>

          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Typography
                sx={{
                  fontFamily: fonts.display,
                  fontSize: '0.9rem',
                  color: tokens.ink,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {node.displayName}
              </Typography>
              {riskReason && (
                <Tooltip title={riskReason}>
                  <ReportProblemOutlinedIcon
                    sx={{ fontSize: '1rem', color: 'warning.main', flexShrink: 0 }}
                  />
                </Tooltip>
              )}
            </Stack>
            <Typography
              variant="caption"
              sx={{
                color: tokens.muted, display: 'block',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {subtitleFor(node)}
            </Typography>
          </Box>

          {parentEdge?.percentage != null && (
            <Chip
              size="small"
              label={`${Number(parentEdge.percentage).toFixed(0)}%`}
              sx={{ fontFamily: fonts.mono, fontSize: '0.66rem', flexShrink: 0 }}
            />
          )}
          <Chip
            size="small"
            variant="outlined"
            color={VERIFICATION_COLOR[node.verificationStatus] ?? 'default'}
            label={node.verificationStatus.replaceAll('_', ' ').toLowerCase()}
            sx={{ fontSize: '0.66rem', flexShrink: 0, display: { xs: 'none', md: 'flex' } }}
          />

          {/* An individual owns nothing, so there is no child to add. */}
          {!readOnly && !isLeafOnlyType(node.nodeType) && (
            <Tooltip title="Add owned entity or person">
              <IconButton
                className="rowAction"
                size="small"
                onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}
                sx={motion.respectful({
                  opacity: 0, transition: `opacity ${motion.swift} ease`, flexShrink: 0,
                })}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {/* Every item in this menu rewrites the chain, so the trigger goes when they do —
              an empty menu is worse than no menu. */}
          {!readOnly && (
            <Tooltip title="More">
              <IconButton
                className="rowAction"
                size="small"
                aria-label={`More actions for ${node.displayName}`}
                onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}
                sx={motion.respectful({
                  opacity: 0, transition: `opacity ${motion.swift} ease`, flexShrink: 0,
                })}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          <Menu open={Boolean(menuAnchor)} anchorEl={menuAnchor} onClose={() => setMenuAnchor(null)}>
            {isDetached && onAttachDetached && (
              <MenuItem onClick={() => { onAttachDetached(node.id); setMenuAnchor(null); }}>
                <AddLinkIcon fontSize="small" sx={{ mr: 1 }} /> Attach to an owner…
              </MenuItem>
            )}
            {!isRoot && (
              <MenuItem onClick={() => { onSetRoot(node.id); setMenuAnchor(null); }}>
                <StarBorderIcon fontSize="small" sx={{ mr: 1 }} /> Make top of the chain
              </MenuItem>
            )}
            {isRoot && (
              <MenuItem onClick={() => { onSetRoot(null); setMenuAnchor(null); }}>
                <StarBorderIcon fontSize="small" sx={{ mr: 1 }} /> Clear top of the chain
              </MenuItem>
            )}
            {/* Last, and set apart by colour: the only item here that destroys anything. Offered on
                the root too — clearing the structure to start again is a real thing to want, and
                the dialog names the count before anyone commits. */}
            {onDeleteNode && (
              <MenuItem
                sx={{ color: 'error.main' }}
                onClick={() => { onDeleteNode(node.id); setMenuAnchor(null); }}
              >
                <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} /> Delete
              </MenuItem>
            )}
          </Menu>
        </Stack>

        {expanded && children.map((edge) => {
          const child = nodesById.get(edge.childNodeId);
          if (!child) return null;
          return (
            <NodeBranch
              key={edge.id}
              node={child}
              parentEdge={edge}
              depth={depth + 1}
              nodesById={nodesById}
              childrenByParent={childrenByParent}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              onAddChild={onAddChild}
              onSetRoot={onSetRoot}
              onAttachDetached={onAttachDetached}
              onDeleteNode={onDeleteNode}
              readOnly={readOnly}
              order={order}
            />
          );
        })}
      </Box>
    </Box>
  );
}

function indexTree(tree) {
  const nodesById = new Map();
  const childrenByParent = new Map();
  const parentIdByChild = new Map();
  if (!tree) return { nodesById, childrenByParent, parentIdByChild };
  tree.nodes.forEach((n) => nodesById.set(n.id, n));
  tree.edges.forEach((e) => {
    if (!childrenByParent.has(e.parentNodeId)) childrenByParent.set(e.parentNodeId, []);
    childrenByParent.get(e.parentNodeId).push(e);
    parentIdByChild.set(e.childNodeId, e.parentNodeId);
  });
  // Sort children by edge id so the order is stable.
  childrenByParent.forEach((arr) => arr.sort((a, b) => a.id - b.id));
  return { nodesById, childrenByParent, parentIdByChild };
}
