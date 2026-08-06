import { useMemo, useState } from 'react';
import {
  Box, Button, Checkbox, Divider, InputAdornment, Paper, Stack, TextField, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/SearchOutlined';
import { useAssignableUsers } from '../hooks/useAssignableUsers.js';
import { roleLabel } from '../auth/roles.js';
import { tokens, fonts } from '../theme/theme.js';

const matches = (u, q) => (u.fullName ?? '').toLowerCase().includes(q)
  || (u.email ?? '').toLowerCase().includes(q);

/** Mono uppercase group heading, matching the section labels on the training detail dialogs. */
function GroupLabel({ children }) {
  return (
    <Typography sx={{
      fontFamily: fonts.mono, fontSize: '0.62rem', letterSpacing: '0.1em',
      textTransform: 'uppercase', color: tokens.muted,
      px: 1.5, py: 0.75, backgroundColor: tokens.tileRaised,
    }}>
      {children}
    </Typography>
  );
}

function UserRow({ user, checked, onToggle }) {
  return (
    <Box
      onClick={onToggle}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1,
        cursor: 'pointer',
        backgroundColor: checked ? tokens.blueWash : 'transparent',
        '&:hover': { backgroundColor: checked ? tokens.blueWash : tokens.hover },
      }}
    >
      <Checkbox checked={checked} size="small" tabIndex={-1} disableRipple />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.875rem', color: tokens.ink }}>
          {user.fullName || user.email}
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: tokens.muted }}>
          {user.email}
        </Typography>
      </Box>
      <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.68rem', color: tokens.muted }}>
        {roleLabel(user.role)}
      </Typography>
    </Box>
  );
}

/**
 * Tick the staff to assign a piece of training to. Shared by the session and course dialogs.
 *
 * Two groups: the branch's own staff, then the firm's compliance officers and senior managers.
 * The second group is branchless — the same people appear when assigning training in any branch
 * of the firm — which is why they are separated rather than mixed into the branch list.
 */
export function AssigneePicker({ value = [], onChange, firmId, branchId, branchName }) {
  const { branchUsers, firmUsers, users, isLoading, empty } = useAssignableUsers(firmId, branchId);
  const [search, setSearch] = useState('');

  const { visibleBranch, visibleFirm } = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return { visibleBranch: branchUsers, visibleFirm: firmUsers };
    return {
      visibleBranch: branchUsers.filter((u) => matches(u, q)),
      visibleFirm: firmUsers.filter((u) => matches(u, q)),
    };
  }, [branchUsers, firmUsers, search]);

  const toggle = (id) => onChange(
    value.includes(id) ? value.filter((x) => x !== id) : [...value, id],
  );

  // Select-all acts on what's currently filtered across both groups, which is what you'd
  // expect after a search.
  const visibleIds = [...visibleBranch, ...visibleFirm].map((u) => u.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => value.includes(id));
  const toggleAll = () => {
    if (allVisibleSelected) onChange(value.filter((id) => !visibleIds.includes(id)));
    else onChange([...new Set([...value, ...visibleIds])]);
  };

  if (empty) {
    return (
      <Typography sx={{ fontSize: '0.875rem', color: 'warning.main' }}>
        Nobody to assign — add staff to this branch under Settings › Users first.
      </Typography>
    );
  }

  const groups = [
    { key: 'branch', label: branchName || 'This branch', rows: visibleBranch },
    { key: 'firm', label: 'Firm-wide', rows: visibleFirm },
  ].filter((g) => g.rows.length > 0);

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search staff…"
          size="small"
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: tokens.muted }} />
              </InputAdornment>
            ),
          }}
        />
        <Button size="small" onClick={toggleAll} disabled={visibleIds.length === 0}
                sx={{ flexShrink: 0 }}>
          {allVisibleSelected ? 'Clear' : 'Select all'}
        </Button>
      </Stack>

      <Typography sx={{
        fontFamily: fonts.mono, fontSize: '0.65rem', letterSpacing: '0.1em',
        textTransform: 'uppercase', color: tokens.muted,
      }}>
        {value.length} of {users.length} selected
      </Typography>

      <Paper variant="outlined" sx={{ maxHeight: 320, overflowY: 'auto' }}>
        {groups.map((group, groupIndex) => (
          <Box key={group.key}>
            {groupIndex > 0 && <Divider />}
            <GroupLabel>{group.label}</GroupLabel>
            {group.rows.map((u, index) => (
              <Box key={u.id}>
                {index > 0 && <Divider />}
                <UserRow user={u} checked={value.includes(u.id)} onToggle={() => toggle(u.id)} />
              </Box>
            ))}
          </Box>
        ))}
        {!isLoading && groups.length === 0 && (
          <Typography sx={{ p: 2.5, fontSize: '0.85rem', color: tokens.muted, textAlign: 'center' }}>
            No staff match “{search}”.
          </Typography>
        )}
      </Paper>
    </Stack>
  );
}
