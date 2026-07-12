import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, MenuItem, Select, Typography } from '@mui/material';
import { useAuth } from '../../auth/AuthContext.jsx';
import { isBranchLevel, requiresFirm } from '../../auth/roles.js';
import { getFirm, listFirms, listBranches } from '../../api/firms.js';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { tokens, fonts } from '../../theme/theme.js';

/**
 * Firm + branch dropdowns that drive the dashboard scope. Role-aware:
 *   ROOT        → picks any firm and branch (or "All").
 *   Firm-level  → firm pinned, picks a branch (or "All branches").
 *   Branch-level→ firm and branch pinned to their own.
 * Seeds sensible defaults once from the signed-in user (unless a saved selection
 * was restored). `stacked` lays the two selects out vertically at full width for
 * the sidebar.
 */
export function ScopeSelector({ stacked = false }) {
  const { user } = useAuth();
  const { firm, setFirm, branch, setBranch, initialized, setInitialized } = useDashboardScope();

  const role = user?.role;
  const isRoot = role === 'ROOT';
  const branchLevel = isBranchLevel(role);
  const firmLevel = !isRoot && !branchLevel && requiresFirm(role);
  const branchSelectable = isRoot || firmLevel;

  const currentFirmId = isRoot ? (firm?.id ?? null) : user?.realEstateFirmId;

  const firmsQ = useQuery({ queryKey: ['firms'], queryFn: listFirms, enabled: isRoot });
  const firmQ = useQuery({
    queryKey: ['firm', user?.realEstateFirmId],
    queryFn: () => getFirm(user.realEstateFirmId),
    enabled: !isRoot && Boolean(user?.realEstateFirmId),
  });
  const branchesQ = useQuery({
    queryKey: ['firms', currentFirmId, 'branches'],
    queryFn: () => listBranches(currentFirmId),
    enabled: Boolean(currentFirmId),
  });

  const activeFirms = (firmsQ.data ?? []).filter((f) => f.active);
  const activeBranches = (branchesQ.data ?? []).filter((b) => b.active);

  // One-time default seeding from the signed-in user.
  useEffect(() => {
    if (initialized || !user) return;
    if (isRoot) { setInitialized(true); return; }              // default: all firms / all branches
    if (!firmQ.data) return;                                    // wait for the firm name
    const firmObj = { id: firmQ.data.id, name: firmQ.data.name };
    if (branchLevel) {
      const b = (branchesQ.data ?? []).find((x) => x.id === user.firmBranchId);
      if (user.firmBranchId && !b) return;                      // wait for branch name
      setFirm(firmObj);
      setBranch(b ? { id: b.id, name: b.name } : null);
    } else {
      setFirm(firmObj);
      setBranch(null);
    }
    setInitialized(true);
  }, [initialized, user, isRoot, branchLevel, firmQ.data, branchesQ.data, setFirm, setBranch, setInitialized]);

  const onFirmChange = (e) => {
    const f = activeFirms.find((x) => x.id === e.target.value);
    setFirm(f ? { id: f.id, name: f.name } : null);
    setBranch(null);
  };
  const onBranchChange = (e) => {
    const b = activeBranches.find((x) => x.id === e.target.value);
    setBranch(b ? { id: b.id, name: b.name } : null);
  };

  const firmOptions = isRoot ? activeFirms : (firmQ.data ? [firmQ.data] : []);

  return (
    <Box sx={{
      display: 'flex', gap: 1.25,
      flexDirection: stacked ? 'column' : 'row',
      flexWrap: stacked ? 'nowrap' : 'wrap',
    }}>
      <ScopeSelect
        label="Entity"
        value={firm?.id ?? ''}
        display={firm?.name ?? 'All entities'}
        onChange={onFirmChange}
        disabled={!isRoot}
        fullWidth={stacked}
      >
        {isRoot && <MenuItem value=""><em>All entities</em></MenuItem>}
        {firmOptions.map((f) => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
      </ScopeSelect>

      <ScopeSelect
        label="Branch"
        value={branch?.id ?? ''}
        display={branch?.name ?? 'All branches'}
        onChange={onBranchChange}
        disabled={!branchSelectable || !currentFirmId}
        fullWidth={stacked}
      >
        {branchSelectable && <MenuItem value=""><em>All branches</em></MenuItem>}
        {activeBranches.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
      </ScopeSelect>
    </Box>
  );
}

/**
 * A frosted select with an inline ledger label. `renderValue` always paints
 * "LABEL · value" itself — no floating InputLabel, so the empty value can't
 * collide with placeholder text (the old label/placeholder overlap glitch).
 */
function ScopeSelect({ label, value, display, onChange, disabled, fullWidth, children }) {
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
            color: disabled ? tokens.muted : tokens.ink,
          }}>
            {display}
          </Typography>
        </Box>
      )}
      MenuProps={{ PaperProps: { sx: { maxHeight: 320 } } }}
      sx={{
        minWidth: 168,
        borderRadius: '11px',
        backgroundColor: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(10px) saturate(160%)',
        WebkitBackdropFilter: 'blur(10px) saturate(160%)',
        boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
        '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.hairline },
        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: tokens.hairline2 },
        '&.Mui-disabled': { backgroundColor: 'rgba(255,255,255,0.5)' },
      }}
    >
      {children}
    </Select>
  );
}
