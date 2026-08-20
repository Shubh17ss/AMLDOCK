import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, MenuItem, Select, Typography } from '@mui/material';
import { useAuth } from '../../auth/AuthContext.jsx';
import { isBranchLevel, requiresFirm, seesAllFirms } from '../../auth/roles.js';
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
  // AUDIT reads every entity, so it gets ROOT's entity switcher — the read-only guarantee is
  // enforced server-side by AuditReadOnlyFilter, not by pinning the scope.
  const isRoot = seesAllFirms(role);
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

  // Memoised because the reconciliation effect below depends on them; a fresh array each render
  // would re-run it on every render.
  const activeFirms = useMemo(() => (firmsQ.data ?? []).filter((f) => f.active), [firmsQ.data]);
  const activeBranches = useMemo(() => (branchesQ.data ?? []).filter((b) => b.active), [branchesQ.data]);

  // One-time default seeding from the signed-in user.
  useEffect(() => {
    if (initialized || !user) return;
    if (isRoot) { setInitialized(true); return; }              // default: all firms / all branches
    if (!firmQ.data) return;                                    // wait for the firm name
    const firmObj = { id: firmQ.data.id, name: firmQ.data.name, country: firmQ.data.country };
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

  // A saved scope can outlive what it points at — an entity deactivated, a branch removed, or a
  // dev database reset. Nothing else catches this: the selects display the firm and branch *names*
  // held in the saved scope, while their options come from the API, so the sidebar goes on naming
  // an entity that is gone while the dropdown beside it is empty. And because a restored selection
  // counts as initialised, the seeding effect above returns early and never corrects it.
  //
  // Clearing to null means "all", which is the honest reading of a scope that no longer resolves.
  useEffect(() => {
    if (!initialized) return;

    if (firm) {
      // A missing firm 404s, so an error is an answer here, not just a pending state.
      const firmSettled = isRoot ? firmsQ.isSuccess : (firmQ.isSuccess || firmQ.isError);
      if (!firmSettled) return;

      const stillExists = isRoot
        ? activeFirms.some((f) => f.id === firm.id)
        : firmQ.data?.id === firm.id;
      if (!stillExists) {
        setFirm(null);
        setBranch(null);   // a branch cannot outlive the firm it belonged to
        return;
      }
    }

    if (branch && branchesQ.isSuccess && !activeBranches.some((b) => b.id === branch.id)) {
      setBranch(null);
    }
  }, [initialized, isRoot, firm, branch, activeFirms, activeBranches,
      firmsQ.isSuccess, firmQ.isSuccess, firmQ.isError, firmQ.data,
      branchesQ.isSuccess, setFirm, setBranch]);

  // `country` rides along because it decides the currency every amount in the app is shown in
  // (useCurrency). Without it the scope object couldn't answer "NZD or AUD?".
  const onFirmChange = (e) => {
    const f = activeFirms.find((x) => x.id === e.target.value);
    setFirm(f ? { id: f.id, name: f.name, country: f.country } : null);
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
