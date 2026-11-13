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
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import { listBranches } from '../../api/firms.js';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { flagClass } from '../../data/countries.js';
import { roleLabel } from '../../auth/roles.js';
import { tokens } from '../../theme/theme.js';

const norm = (s) => (s ?? '').toLowerCase();

/**
 * Centred picker behind ScopeSelector. ROOT and AUDIT get every active entity with its branches
 * beneath it; an officer serving several entities gets theirs, the current one with its branches
 * and the others to switch into; everyone else gets their own entity's branches only, with no
 * entity shown. A search at the top narrows the list by name.
 *
 * It only reports the pick — `onPick(firm, branch)`, firm null for non-ROOT, or
 * `onPickEntity(membership)` to move to another entity — and closes. Applying it is ScopeSelector's.
 */
export function ScopePickerDialog({ open, onClose, onPick, onPickEntity }) {
  const { isRoot, multiEntity } = useDashboardScope();
  const showsEntity = isRoot || multiEntity;
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
          {showsEntity ? 'Switch reporting entity' : 'Switch branch'}
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
          placeholder={showsEntity ? 'Search entities and branches' : 'Search branches'}
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
        {isRoot && (
          <EntityList query={norm(search.trim())} onPick={(f, b) => { onClose(); onPick(f, b); }} open={open} />
        )}
        {!isRoot && multiEntity && (
          <MembershipList
            query={norm(search.trim())}
            onPick={(b) => { onClose(); onPick(null, b); }}
            onPickEntity={(m) => { onClose(); onPickEntity(m); }}
          />
        )}
        {!isRoot && !multiEntity && (
          <BranchList query={norm(search.trim())} onPick={(b) => { onClose(); onPick(null, b); }} />
        )}
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
    const branches = q?.data ?? [];
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
              <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: 700, color: tokens.ink, flex: 1 }}>
                {f.name}
              </Typography>
              {!f.active && (
                <Typography noWrap sx={{ fontSize: '0.72rem', color: tokens.muted }}>Deactivated · read-only</Typography>
              )}
            </ListSubheader>
            {loading && (
              <Box sx={{ py: 1.5, pl: 6 }}><CircularProgress size={16} /></Box>
            )}
            {!loading && branches.length === 0 && (
              <Typography sx={{ py: 1.25, pl: 6, fontSize: '0.8rem', color: tokens.muted }}>
                No branches
              </Typography>
            )}
            {branches.map((b) => (
              <BranchRow
                key={b.id}
                name={b.name}
                inactive={!b.active}
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

/**
 * An officer serving several entities: the one the session is in, with its branches, then the
 * others. Only the current entity's branches are listed — the session can read no other entity's
 * until it has switched into it, which is what picking one of those does. A branch is then chosen
 * there, by ScopeRequiredDialog.
 */
function MembershipList({ query, onPick, onPickEntity }) {
  const { branch, branchOptions, memberships, currentFirmId } = useDashboardScope();
  const current = memberships.find((m) => m.realEstateFirmId === currentFirmId);
  const others = memberships
    .filter((m) => m.realEstateFirmId !== currentFirmId)
    .filter((m) => !query || norm(m.realEstateFirmName).includes(query));
  const currentHit = !query || norm(current?.realEstateFirmName).includes(query);
  const branches = currentHit ? branchOptions : branchOptions.filter((b) => norm(b.name).includes(query));

  if (!current && others.length === 0) return <Empty text="No matches" />;

  return (
    <List disablePadding>
      {current && (currentHit || branches.length > 0) && (
        <li>
          <List disablePadding>
            <EntityHeader name={current.realEstateFirmName} country={current.country}
                          caption={`${roleLabel(current.role)} · current${current.readOnly ? ' · read-only' : ''}`} />
            {branches.length === 0 && (
              <Typography sx={{ py: 1.25, pl: 6, fontSize: '0.8rem', color: tokens.muted }}>
                No branches
              </Typography>
            )}
            {branches.map((b) => (
              <BranchRow key={b.id} name={b.name} inactive={!b.active} indent
                         selected={branch?.id === b.id} onClick={() => onPick(b)} />
            ))}
          </List>
        </li>
      )}
      {others.length > 0 && (
        <ListSubheader sx={{
          lineHeight: 1.3, py: 1.25, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em',
          textTransform: 'uppercase', color: tokens.muted, backgroundColor: 'background.paper',
          borderBottom: `1px solid ${tokens.hairline}`,
        }}>
          Your other reporting entities
        </ListSubheader>
      )}
      {others.map((m) => (
        <ListItemButton key={m.id} onClick={() => onPickEntity(m)} sx={{ pl: 2.5, py: 1.1, gap: 1 }}>
          <Box component="span" className={flagClass(m.country)} title={m.country ?? undefined}
               sx={{ fontSize: '1rem', borderRadius: '2px', flexShrink: 0 }} />
          <ListItemText
            primary={m.realEstateFirmName}
            secondary={m.readOnly ? `${roleLabel(m.role)} · deactivated, read-only` : roleLabel(m.role)}
            primaryTypographyProps={{ noWrap: true, fontSize: '0.86rem', fontWeight: 600 }}
            secondaryTypographyProps={{ noWrap: true, fontSize: '0.74rem' }}
          />
          <SwapHorizRoundedIcon sx={{ fontSize: 18, color: tokens.muted }} />
        </ListItemButton>
      ))}
    </List>
  );
}

function EntityHeader({ name, country, caption }) {
  return (
    <ListSubheader sx={{
      display: 'flex', alignItems: 'center', gap: 1, lineHeight: 1.3, py: 1.25,
      backgroundColor: 'background.paper', borderBottom: `1px solid ${tokens.hairline}`,
    }}>
      <Box component="span" className={flagClass(country)} title={country ?? undefined}
           sx={{ fontSize: '1rem', borderRadius: '2px', flexShrink: 0 }} />
      <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: 700, color: tokens.ink, flex: 1 }}>
        {name}
      </Typography>
      {caption && (
        <Typography noWrap sx={{ fontSize: '0.72rem', color: tokens.muted }}>{caption}</Typography>
      )}
    </ListSubheader>
  );
}

/** Everyone else: their entity's branches, nothing about the entity itself. */
function BranchList({ query, onPick }) {
  const { branch, branchOptions } = useDashboardScope();
  const rows = branchOptions.filter((b) => !query || norm(b.name).includes(query));

  if (rows.length === 0) return <Empty text={branchOptions.length ? 'No matches' : 'No branches'} />;

  return (
    <List disablePadding>
      {rows.map((b) => (
        <BranchRow
          key={b.id}
          name={b.name}
          inactive={!b.active}
          selected={branch?.id === b.id}
          onClick={() => onPick(b)}
        />
      ))}
    </List>
  );
}

/** `inactive`: a deactivated branch, still opened to be read through its retention period. */
function BranchRow({ name, selected, inactive = false, indent = false, onClick }) {
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
        secondary={inactive ? 'Deactivated · read-only' : null}
        primaryTypographyProps={{ noWrap: true, fontSize: '0.86rem', fontWeight: selected ? 700 : 500 }}
        secondaryTypographyProps={{ noWrap: true, fontSize: '0.72rem' }}
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
