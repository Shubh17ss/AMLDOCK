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
import { tokens, fonts } from '../../theme/theme.js';

const norm = (s) => (s ?? '').toLowerCase();

// A row is an inset, rounded target rather than an edge-to-edge strip.
const ROW_SX = { mx: 1.5, my: 0.25, px: 1.5, py: 0.9, borderRadius: '14px' };

// An entity's name over its branches. Sticky, so it has to cover what scrolls under it.
const HEADER_SX = {
  display: 'flex', alignItems: 'center', gap: 1, lineHeight: 1.3,
  px: 3, pt: 2, pb: 0.75,
  backgroundColor: 'background.paper',
};

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
  const { isRoot, multiEntity, firm, branch } = useDashboardScope();
  const showsEntity = isRoot || multiEntity;
  const [search, setSearch] = useState('');

  useEffect(() => { if (open) setSearch(''); }, [open]);

  const where = showsEntity
    ? [firm?.name, branch?.name].filter(Boolean).join(', ')
    : branch?.name;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      // As tall as its list needs, up to a cap: three branches should not sit in a 580px sheet.
      PaperProps={{ sx: { borderRadius: '24px', maxHeight: 'min(72vh, 580px)' } }}
    >
      <DialogTitle component="div" sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h2" sx={{
            fontFamily: fonts.display, fontWeight: 500, fontSize: '1.45rem',
            letterSpacing: '-0.03em', lineHeight: 1.15, color: tokens.ink,
          }}>
            {showsEntity ? 'Switch reporting entity' : 'Switch branch'}
          </Typography>
          {/* Where you are now, so the list below reads as "where to instead". */}
          {where && (
            <Typography sx={{ mt: 0.5, fontSize: '0.86rem', color: tokens.muted }}>
              You are working in <Box component="span" sx={{ color: tokens.ink, fontWeight: 600 }}>{where}</Box>
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} aria-label="Close" sx={{ mt: -0.5, mr: -1, borderRadius: '50%' }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Box sx={{ px: 3, pb: 2 }}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder={showsEntity ? 'Search entities and branches' : 'Search branches'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 999, pl: 1.75 } }}
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
      <DialogContent sx={{ p: 0, pb: 1, borderTop: `1px solid ${tokens.hairline}` }}>
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
            <ListSubheader sx={HEADER_SX}>
              <Box component="span" className={flagClass(f.country)} title={f.country}
                   sx={{ fontSize: '1rem', borderRadius: '2px', flexShrink: 0 }} />
              <Typography noWrap sx={{ fontSize: '0.88rem', fontWeight: 600, color: tokens.ink, flex: 1 }}>
                {f.name}
              </Typography>
              {!f.active && (
                <Typography noWrap sx={{ fontSize: '0.76rem', color: tokens.muted }}>Deactivated, read-only</Typography>
              )}
            </ListSubheader>
            {loading && (
              <Box sx={{ py: 1.5, pl: 3 }}><CircularProgress size={16} /></Box>
            )}
            {!loading && branches.length === 0 && (
              <Typography sx={{ py: 1, pl: 3, fontSize: '0.84rem', color: tokens.muted }}>
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
                          caption={`${roleLabel(current.role)}, current${current.readOnly ? ', read-only' : ''}`} />
            {branches.length === 0 && (
              <Typography sx={{ py: 1, pl: 3, fontSize: '0.84rem', color: tokens.muted }}>
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
        <ListSubheader sx={{ ...HEADER_SX, fontSize: '0.8rem', fontWeight: 600, color: tokens.muted }}>
          Your other reporting entities
        </ListSubheader>
      )}
      {others.map((m) => (
        <ListItemButton key={m.id} onClick={() => onPickEntity(m)} sx={{ ...ROW_SX, gap: 1.25 }}>
          <Box component="span" className={flagClass(m.country)} title={m.country ?? undefined}
               sx={{ fontSize: '1rem', borderRadius: '2px', flexShrink: 0 }} />
          <ListItemText
            primary={m.realEstateFirmName}
            secondary={m.readOnly ? `${roleLabel(m.role)}, deactivated, read-only` : roleLabel(m.role)}
            primaryTypographyProps={{ noWrap: true, fontSize: '0.9rem', fontWeight: 500 }}
            secondaryTypographyProps={{ noWrap: true, fontSize: '0.76rem' }}
          />
          <SwapHorizRoundedIcon sx={{ fontSize: 18, color: tokens.muted }} />
        </ListItemButton>
      ))}
    </List>
  );
}

function EntityHeader({ name, country, caption }) {
  return (
    <ListSubheader sx={HEADER_SX}>
      <Box component="span" className={flagClass(country)} title={country ?? undefined}
           sx={{ fontSize: '1rem', borderRadius: '2px', flexShrink: 0 }} />
      <Typography noWrap sx={{ fontSize: '0.88rem', fontWeight: 600, color: tokens.ink, flex: 1 }}>
        {name}
      </Typography>
      {caption && (
        <Typography noWrap sx={{ fontSize: '0.76rem', color: tokens.muted }}>{caption}</Typography>
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
    <List disablePadding sx={{ pt: 1 }}>
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
// `indent` is accepted for the callers that nest branches under an entity; the entity header
// above already groups them, so the rows no longer step in.
function BranchRow({ name, selected, inactive = false, indent = false, onClick }) {
  return (
    <ListItemButton
      selected={selected}
      onClick={onClick}
      aria-current={selected ? 'true' : undefined}
      sx={{
        ...ROW_SX,
        '&.Mui-selected, &.Mui-selected:hover': { backgroundColor: tokens.blueWash, color: tokens.ink },
      }}
    >
      {/* The icon sits in a chip, as it does on the scope card this dialog opens from. */}
      <ListItemIcon sx={{ minWidth: 0, mr: 1.5 }}>
        <Box sx={{
          width: 32, height: 32, borderRadius: '10px', display: 'grid', placeItems: 'center',
          backgroundColor: selected ? tokens.blue : tokens.hover,
          color: selected ? '#fff' : tokens.muted,
        }}>
          <StorefrontRoundedIcon sx={{ fontSize: 17 }} />
        </Box>
      </ListItemIcon>
      <ListItemText
        primary={name}
        secondary={inactive ? 'Deactivated, read-only' : null}
        primaryTypographyProps={{ noWrap: true, fontSize: '0.9rem', fontWeight: selected ? 600 : 500, color: tokens.ink }}
        secondaryTypographyProps={{ noWrap: true, fontSize: '0.76rem' }}
      />
      {selected && (
        <Typography sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: '0.78rem', fontWeight: 600, color: tokens.blue, flexShrink: 0 }}>
          <CheckRoundedIcon sx={{ fontSize: 16 }} /> Current
        </Typography>
      )}
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
