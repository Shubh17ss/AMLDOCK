import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  Box, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, InputAdornment,
  List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, TextField, Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import { listBranches } from '../../api/firms.js';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { flagClass } from '../../data/countries.js';
import { tokens } from '../../theme/theme.js';

const norm = (s) => (s ?? '').toLowerCase();

/**
 * Centred picker behind ScopeSelector. ROOT and AUDIT get every active entity with its branches
 * beneath it; everyone else gets their own entity's branches only, with no entity shown. A search
 * at the top narrows either list by name.
 *
 * It only reports the pick — `onPick(firm, branch)`, firm null for non-ROOT — and closes. Applying
 * it is ScopeSelector's, which confirms the branch with the server first.
 */
export function ScopePickerDialog({ open, onClose, onPick }) {
  const { isRoot } = useDashboardScope();
  const [search, setSearch] = useState('');

  useEffect(() => { if (open) setSearch(''); }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: '16px', height: 'min(70vh, 560px)' } }}
    >
      <DialogTitle component="div" sx={{ pb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="h6" component="h2" sx={{ flex: 1 }}>
          {isRoot ? 'Switch reporting entity' : 'Switch branch'}
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Box sx={{ px: 3, pb: 1.5 }}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder={isRoot ? 'Search entities and branches' : 'Search branches'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" sx={{ color: tokens.muted }} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>
      <DialogContent dividers sx={{ p: 0 }}>
        {isRoot
          ? <EntityList query={norm(search.trim())} onPick={(f, b) => { onClose(); onPick(f, b); }} open={open} />
          : <BranchList query={norm(search.trim())} onPick={(b) => { onClose(); onPick(null, b); }} />}
      </DialogContent>
    </Dialog>
  );
}

/** ROOT / AUDIT: entities with their branches beneath. Branches are fetched only while open. */
function EntityList({ query, onPick, open }) {
  const { firm, branch, firmOptions } = useDashboardScope();

  // Same keys as everywhere else, so the current entity's branches come straight from cache.
  const branchQs = useQueries({
    queries: firmOptions.map((f) => ({
      queryKey: ['firms', f.publicId, 'branches'],
      queryFn: () => listBranches(f.publicId),
      enabled: open && Boolean(f.publicId),
    })),
  });

  const groups = useMemo(() => firmOptions.map((f, i) => {
    const q = branchQs[i];
    const branches = (q?.data ?? []).filter((b) => b.active);
    const firmHit = !query || norm(f.name).includes(query);
    return {
      firm: f,
      loading: q?.isLoading,
      // A matching entity shows all its branches; otherwise only the branches that match.
      branches: firmHit ? branches : branches.filter((b) => norm(b.name).includes(query)),
      visible: firmHit || branches.some((b) => norm(b.name).includes(query)),
    };
  }).filter((g) => g.visible), [firmOptions, branchQs, query]);

  if (groups.length === 0) return <Empty text={firmOptions.length ? 'No matches' : 'No reporting entities'} />;

  return (
    <List disablePadding>
      {groups.map(({ firm: f, branches, loading }) => (
        <li key={f.id}>
          <List disablePadding>
            <ListSubheader sx={{
              display: 'flex', alignItems: 'center', gap: 1, lineHeight: 1.3, py: 1.25,
              backgroundColor: 'background.paper', borderBottom: `1px solid ${tokens.hairline}`,
            }}>
              <Box component="span" className={flagClass(f.country)} title={f.country}
                   sx={{ fontSize: '1rem', borderRadius: '2px', flexShrink: 0 }} />
              <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: 700, color: tokens.ink }}>
                {f.name}
              </Typography>
            </ListSubheader>
            {loading && (
              <Box sx={{ py: 1.5, pl: 6 }}><CircularProgress size={16} /></Box>
            )}
            {!loading && branches.length === 0 && (
              <Typography sx={{ py: 1.25, pl: 6, fontSize: '0.8rem', color: tokens.muted }}>
                No active branches
              </Typography>
            )}
            {branches.map((b) => (
              <BranchRow
                key={b.id}
                name={b.name}
                indent
                selected={firm?.id === f.id && branch?.id === b.id}
                onClick={() => onPick(f, b)}
              />
            ))}
          </List>
        </li>
      ))}
    </List>
  );
}

/** Everyone else: their entity's branches, nothing about the entity itself. */
function BranchList({ query, onPick }) {
  const { branch, activeBranches } = useDashboardScope();
  const rows = activeBranches.filter((b) => !query || norm(b.name).includes(query));

  if (rows.length === 0) return <Empty text={activeBranches.length ? 'No matches' : 'No active branches'} />;

  return (
    <List disablePadding>
      {rows.map((b) => (
        <BranchRow
          key={b.id}
          name={b.name}
          selected={branch?.id === b.id}
          onClick={() => onPick(b)}
        />
      ))}
    </List>
  );
}

function BranchRow({ name, selected, indent = false, onClick }) {
  return (
    <ListItemButton
      selected={selected}
      onClick={onClick}
      sx={{
        pl: indent ? 4 : 2.5, py: 1,
        '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: tokens.blueWash },
      }}
    >
      <ListItemIcon sx={{ minWidth: 34, color: selected ? tokens.blue : tokens.muted }}>
        <StorefrontRoundedIcon sx={{ fontSize: 18 }} />
      </ListItemIcon>
      <ListItemText
        primary={name}
        primaryTypographyProps={{ noWrap: true, fontSize: '0.86rem', fontWeight: selected ? 700 : 500 }}
      />
      {selected && <CheckRoundedIcon sx={{ fontSize: 18, color: tokens.blue }} />}
    </ListItemButton>
  );
}

function Empty({ text }) {
  return (
    <Typography sx={{ py: 6, textAlign: 'center', fontSize: '0.86rem', color: tokens.muted }}>
      {text}
    </Typography>
  );
}
