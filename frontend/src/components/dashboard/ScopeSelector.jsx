import { Box, MenuItem, Select, Typography } from '@mui/material';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { tokens, fonts } from '../../theme/theme.js';

/**
 * Firm + branch dropdowns that drive the dashboard scope. Role-aware:
 *   ROOT / AUDIT → picks any firm and branch.
 *   Firm-level   → firm pinned, picks a branch.
 *   Branch-level → firm and branch pinned to their own.
 *
 * There is no "All entities" / "All branches": a single firm and a single branch are a
 * precondition for the app, not a filter on it. ScopeRequiredDialog collects them when they are
 * missing; this is the control for changing them afterwards.
 *
 * Purely presentational. The queries, the one-time seeding and the stale-scope reconciliation all
 * live in DashboardScopeProvider, because the blocking dialog needs them to have run whether or
 * not this sidebar component ever mounted.
 *
 * `stacked` lays the two selects out vertically at full width for the sidebar.
 */
export function ScopeSelector({ stacked = false }) {
  const {
    firm, branch, firmOptions, activeBranches, selectFirm, selectBranch,
    isRoot, branchSelectable, currentFirmId,
  } = useDashboardScope();

  return (
    <Box sx={{
      display: 'flex', gap: 1.25,
      flexDirection: stacked ? 'column' : 'row',
      flexWrap: stacked ? 'nowrap' : 'wrap',
    }}>
      <ScopeSelect
        label="Entity"
        value={firm?.id ?? ''}
        display={firm?.name ?? 'Select entity'}
        unset={!firm?.id}
        onChange={(e) => selectFirm(e.target.value)}
        disabled={!isRoot}
        fullWidth={stacked}
      >
        {firmOptions.map((f) => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
      </ScopeSelect>

      <ScopeSelect
        label="Branch"
        value={branch?.id ?? ''}
        display={branch?.name ?? 'Select branch'}
        unset={!branch?.id}
        onChange={(e) => selectBranch(e.target.value)}
        disabled={!branchSelectable || !currentFirmId}
        fullWidth={stacked}
      >
        {activeBranches.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
      </ScopeSelect>
    </Box>
  );
}

/**
 * A frosted select with an inline ledger label. `renderValue` always paints
 * "LABEL · value" itself — no floating InputLabel, so the empty value can't
 * collide with placeholder text (the old label/placeholder overlap glitch).
 *
 * `unset` greys the value so an unchosen scope reads as an empty field rather than as a setting.
 */
function ScopeSelect({ label, value, display, unset, onChange, disabled, fullWidth, children }) {
  return (
    <Select
      size="small"
      value={value}
      onChange={onChange}
      disabled={disabled}
      fullWidth={fullWidth}
      displayEmpty
      inputProps={{ 'aria-label': `${label} filter` }}
      renderValue={() => (
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, minWidth: 0 }}>
          <Typography component="span" sx={{
            fontFamily: fonts.mono, fontSize: '0.6rem', fontWeight: 500,
            letterSpacing: '0.13em', textTransform: 'uppercase',
            color: tokens.muted, flexShrink: 0,
          }}>
            {label}
          </Typography>
          <Typography component="span" noWrap sx={{
            fontSize: '0.83rem', fontWeight: 600,
            color: (disabled || unset) ? tokens.muted : tokens.ink,
          }}>
            {display}
          </Typography>
        </Box>
      )}
      MenuProps={{ PaperProps: { sx: { maxHeight: 320 } } }}
      sx={{
        minWidth: 168,
        borderRadius: '11px',
        backgroundColor: tokens.scopeBg,
        backdropFilter: 'blur(10px) saturate(160%)',
        WebkitBackdropFilter: 'blur(10px) saturate(160%)',
        boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
        '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.hairline },
        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: tokens.hairline2 },
        '&.Mui-disabled': { backgroundColor: tokens.scopeBgOff },
      }}
    >
      {children}
    </Select>
  );
}
