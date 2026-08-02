import { useMemo, useState } from 'react';
import {
  Box, Button, Checkbox, Divider, InputAdornment, Paper, Stack, TextField, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/SearchOutlined';
import { useAssignableUsers } from '../../hooks/useAssignableUsers.js';
import { roleLabel } from '../../auth/roles.js';
import { tokens, fonts } from '../../theme/theme.js';

/**
 * Tick the staff who have to take this course.
 *
 * The list is only ever this branch's branch-level staff — compliance officers and senior
 * managers run training rather than take it, and the server rejects them outright.
 */
export function CourseUsersPicker({ value = [], onChange, firmId, branchId }) {
  const { users, isLoading, empty } = useAssignableUsers(firmId, branchId);
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => (u.fullName ?? '').toLowerCase().includes(q)
      || (u.email ?? '').toLowerCase().includes(q));
  }, [users, search]);

  const toggle = (id) => onChange(
    value.includes(id) ? value.filter((x) => x !== id) : [...value, id],
  );

  // Select-all acts on what's currently filtered, which is what you'd expect after a search.
  const visibleIds = visible.map((u) => u.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => value.includes(id));
  const toggleAll = () => {
    if (allVisibleSelected) onChange(value.filter((id) => !visibleIds.includes(id)));
    else onChange([...new Set([...value, ...visibleIds])]);
  };

  if (empty) {
    return (
      <Typography sx={{ fontSize: '0.875rem', color: 'warning.main' }}>
        No branch staff to assign — add agents to this branch under Settings › Users first.
      </Typography>
    );
  }

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
        {visible.map((u, index) => {
          const checked = value.includes(u.id);
          return (
            <Box key={u.id}>
              {index > 0 && <Divider />}
              <Box
                onClick={() => toggle(u.id)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1,
                  cursor: 'pointer',
                  backgroundColor: checked ? tokens.blueWash : 'transparent',
                  '&:hover': { backgroundColor: checked ? tokens.blueWash : '#F5F8FC' },
                }}
              >
                <Checkbox checked={checked} size="small" tabIndex={-1} disableRipple />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.875rem', color: tokens.ink }}>
                    {u.fullName || u.email}
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: tokens.muted }}>
                    {u.email}
                  </Typography>
                </Box>
                <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.68rem', color: tokens.muted }}>
                  {roleLabel(u.role)}
                </Typography>
              </Box>
            </Box>
          );
        })}
        {!isLoading && visible.length === 0 && (
          <Typography sx={{ p: 2.5, fontSize: '0.85rem', color: tokens.muted, textAlign: 'center' }}>
            No staff match “{search}”.
          </Typography>
        )}
      </Paper>
    </Stack>
  );
}
