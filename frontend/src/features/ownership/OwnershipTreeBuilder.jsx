import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, IconButton, Menu, MenuItem, Paper, Stack, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import GroupIcon from '@mui/icons-material/Group';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddLinkIcon from '@mui/icons-material/AddLink';

const NODE_ICON = {
  NATURAL_PERSON: <PersonIcon fontSize="small" />,
  NZ_COMPANY: <BusinessIcon fontSize="small" />,
  TRUST: <AccountBalanceIcon fontSize="small" />,
  PARTNERSHIP: <GroupIcon fontSize="small" />,
  OTHER: <HelpOutlineIcon fontSize="small" />,
};

const VERIFICATION_COLOR = {
  NOT_STARTED: 'default',
  IN_PROGRESS: 'info',
  VERIFIED: 'success',
  FAILED: 'error',
};

export function OwnershipTreeBuilder({
  tree,
  selectedNodeId,
  onSelectNode,
  onAddRoot,
  onAddChild,
  onSetRoot,
  onAttachDetached,
}) {
  const { nodesById, childrenByParent, parentIdByChild } = useMemo(() => indexTree(tree), [tree]);
  const root = tree?.rootNodeId ? nodesById.get(tree.rootNodeId) : null;

  // Nodes with no incoming edge and not the root are "detached"
  const detached = useMemo(() => {
    if (!tree) return [];
    return tree.nodes
      .filter((n) => !parentIdByChild.has(n.id) && n.id !== tree.rootNodeId)
      .sort((a, b) => a.id - b.id);
  }, [tree, parentIdByChild]);

  if (!tree) return null;

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1">Ownership structure</Typography>
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={onAddRoot}>
          {root ? 'Add detached node' : 'Add root node'}
        </Button>
      </Stack>

      {tree.nodes.length === 0 && (
        <Alert severity="info">
          No nodes yet. Start by adding a root node — typically the entity being assessed (the buyer/seller).
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 1 }}>
        {root && (
          <NodeBranch
            node={root}
            parentEdge={null}
            depth={0}
            isRoot
            nodesById={nodesById}
            childrenByParent={childrenByParent}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
            onAddChild={onAddChild}
            onSetRoot={onSetRoot}
            onAttachDetached={onAttachDetached}
          />
        )}
        {detached.length > 0 && (
          <Box sx={{ mt: root ? 2 : 0 }}>
            {root && (
              <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                Detached
              </Typography>
            )}
            {detached.map((n) => (
              <NodeBranch
                key={n.id}
                node={n}
                parentEdge={null}
                depth={0}
                nodesById={nodesById}
                childrenByParent={childrenByParent}
                selectedNodeId={selectedNodeId}
                onSelectNode={onSelectNode}
                onAddChild={onAddChild}
                onSetRoot={onSetRoot}
                onAttachDetached={onAttachDetached}
              />
            ))}
          </Box>
        )}
      </Paper>
    </Stack>
  );
}

function NodeBranch({
  node, parentEdge, depth, isRoot = false,
  nodesById, childrenByParent, selectedNodeId, onSelectNode, onAddChild, onSetRoot, onAttachDetached,
}) {
  const children = childrenByParent.get(node.id) ?? [];
  const [expanded, setExpanded] = useState(true);
  const [menuAnchor, setMenuAnchor] = useState(null);

  const isSelected = selectedNodeId === node.id;
  // "Detached" = renders at the top level but isn't the root. Its descendants render
  // normally (with parentEdge set) and should NOT show the attach action.
  const isDetached = !isRoot && !parentEdge;

  return (
    <Box>
      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        sx={{
          pl: depth * 2.5,
          py: 0.5,
          borderRadius: 1,
          bgcolor: isSelected ? 'action.selected' : undefined,
          '&:hover': { bgcolor: isSelected ? 'action.selected' : 'action.hover' },
          cursor: 'pointer',
        }}
        onClick={() => onSelectNode(node.id)}
      >
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
                    disabled={children.length === 0} sx={{ visibility: children.length > 0 ? 'visible' : 'hidden' }}>
          {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        </IconButton>
        <Tooltip title={isRoot ? 'Root node' : ''}>
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 0.5 }}>
            {isRoot ? <StarIcon fontSize="small" color="primary" /> : NODE_ICON[node.nodeType]}
          </Box>
        </Tooltip>
        <Typography variant="body2" sx={{ fontWeight: isSelected ? 600 : 400 }}>
          {node.displayName}
        </Typography>
        <Chip size="small" label={prettyType(node.nodeType)} variant="outlined" />
        {parentEdge && (
          <>
            {parentEdge.role && <Chip size="small" label={prettyType(parentEdge.role)} />}
            {parentEdge.percentage != null && (
              <Chip size="small" color="primary" variant="outlined"
                    label={`${Number(parentEdge.percentage).toFixed(2)}%`} />
            )}
          </>
        )}
        <Chip
          size="small"
          variant="outlined"
          color={VERIFICATION_COLOR[node.verificationStatus] ?? 'default'}
          label={node.verificationStatus.replaceAll('_', ' ').toLowerCase()}
        />
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Add child">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="More">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}>
            <MoreVertSafe />
          </IconButton>
        </Tooltip>
        <Menu open={Boolean(menuAnchor)} anchorEl={menuAnchor} onClose={() => setMenuAnchor(null)}>
          {isDetached && onAttachDetached && (
            <MenuItem onClick={() => { onAttachDetached(node.id); setMenuAnchor(null); }}>
              <AddLinkIcon fontSize="small" sx={{ mr: 1 }} /> Attach to parent…
            </MenuItem>
          )}
          {!isRoot && (
            <MenuItem onClick={() => { onSetRoot(node.id); setMenuAnchor(null); }}>
              <StarBorderIcon fontSize="small" sx={{ mr: 1 }} /> Make root
            </MenuItem>
          )}
          {isRoot && (
            <MenuItem onClick={() => { onSetRoot(null); setMenuAnchor(null); }}>
              <StarBorderIcon fontSize="small" sx={{ mr: 1 }} /> Clear root
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
          />
        );
      })}
    </Box>
  );
}

function MoreVertSafe() { return <MoreVertIcon fontSize="small" />; }

function prettyType(value) {
  if (!value) return '';
  return value.replaceAll('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
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
