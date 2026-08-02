import { useMemo } from 'react';
import { Autocomplete, Box, Chip, TextField, Typography } from '@mui/material';
import { useAssignableUsers } from '../hooks/useAssignableUsers.js';
import { roleLabel } from '../auth/roles.js';
import { tokens, fonts } from '../theme/theme.js';

/**
 * Picks several staff members from one branch. Value is an array of user ids so it maps
 * straight onto the API field; onChange receives the new array.
 *
 * Only branch-level staff of `branchId` are offered. The users endpoint deliberately also
 * returns branchless firm-level staff when filtered by branch (they oversee every branch), and
 * those are exactly the people the server refuses to assign — so filtering them out here keeps
 * the picker honest rather than offering choices the save would reject.
 */
export function UserMultiSelect({
  value = [],
  onChange,
  firmId,
  branchId,
  label = 'Assign users',
  disabled = false,
  helperText,
}) {
  const { users: options, isLoading, empty } = useAssignableUsers(firmId, branchId);

  const selected = useMemo(
    () => options.filter((u) => value.includes(u.id)),
    [options, value],
  );

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      options={options}
      value={selected}
      loading={isLoading}
      disabled={disabled || empty}
      onChange={(_e, picked) => onChange(picked.map((u) => u.id))}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      getOptionLabel={(u) => u.fullName || u.email || `User ${u.id}`}
      filterOptions={(opts, { inputValue }) => {
        const q = inputValue.trim().toLowerCase();
        if (!q) return opts;
        return opts.filter((u) => (u.fullName ?? '').toLowerCase().includes(q)
          || (u.email ?? '').toLowerCase().includes(q));
      }}
      renderOption={(props, u) => {
        const { key, ...liProps } = props;
        return (
          <Box component="li" key={key} {...liProps}
               sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.875rem', color: tokens.ink }}>
                {u.fullName || u.email}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: tokens.muted }}>
                {u.email}
              </Typography>
            </Box>
            <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.68rem', color: tokens.muted }}>
              {roleLabel(u.role)}
            </Typography>
          </Box>
        );
      }}
      renderTags={(picked, getTagProps) => picked.map((u, index) => {
        const { key, ...chipProps } = getTagProps({ index });
        return (
          <Chip
            key={key}
            {...chipProps}
            size="small"
            label={u.fullName || u.email}
            sx={{ backgroundColor: tokens.blueWash, color: tokens.blue, fontWeight: 600 }}
          />
        );
      })}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={selected.length === 0 ? 'Search staff…' : undefined}
          helperText={empty
            ? 'No branch staff to assign — add agents to this branch under Settings › Users first.'
            : helperText}
          FormHelperTextProps={empty ? { sx: { color: 'warning.main' } } : undefined}
        />
      )}
      fullWidth
    />
  );
}
