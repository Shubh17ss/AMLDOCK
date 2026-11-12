import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Box, ButtonBase, Typography } from '@mui/material';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { ScopePickerDialog } from './ScopePickerDialog.jsx';
import { ScopeSwitchOverlay } from './ScopeSwitchOverlay.jsx';
import { listBranches } from '../../api/firms.js';
import { tokens } from '../../theme/theme.js';

// The minimum hold behind a switch, and how long its result stays up.
const SWITCH_HOLD_MS = 1500;
const RESULT_MS = 1200;
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

/**
 * The scope the app works in, as one card: an icon, what is selected, and — where there is a
 * choice — a chevron that opens ScopePickerDialog. Role-aware:
 *   ROOT / AUDIT → entity and branch; picks any of either.
 *   Firm-level   → branch only; their entity is their account's and is not shown.
 *   Branch-level → branch only, pinned, so the card does not open anything.
 *
 * There is no "All entities" / "All branches": a single firm and a single branch are a
 * precondition for the app, not a filter on it. ScopeRequiredDialog collects them when they are
 * missing; this is the control for changing them afterwards.
 *
 * Purely presentational. The queries, the one-time seeding and the stale-scope reconciliation all
 * live in DashboardScopeProvider, because the blocking dialog needs them to have run whether or
 * not this sidebar component ever mounted.
 *
 * `stacked` makes the card full width, for the sidebar and the broker's mobile home.
 *
 * A switch is confirmed with the server before it is applied: the entity's branches are fetched
 * fresh behind a blurred "Switching branch" hold of at least SWITCH_HOLD_MS, and only a branch that
 * comes back active is switched to — then a tick says so. Anything else leaves the scope as it was.
 */

export function ScopeSelector({ stacked = false }) {
  const {
    firm, branch, isRoot, branchSelectable, currentFirmRef, selectScope,
  } = useDashboardScope();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(null);   // { phase, branchName, error }
  // Set on every mount, not just initialised: StrictMode mounts, unmounts and mounts again, and a
  // flag only ever cleared would read "gone" for good and leave the overlay stuck on its spinner.
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const switchTo = async (pickedFirm, pickedBranch) => {
    if (pickedBranch.id === branch?.id && (!pickedFirm || pickedFirm.id === firm?.id)) return;
    const firmRef = pickedFirm ? pickedFirm.publicId : currentFirmRef;
    setSwitching({ phase: 'switching', branchName: pickedBranch.name });

    let fresh = null;
    let error = null;
    const [result] = await Promise.allSettled([
      qc.fetchQuery({
        queryKey: ['firms', firmRef, 'branches'],
        queryFn: () => listBranches(firmRef),
        staleTime: 0,
      }),
      sleep(SWITCH_HOLD_MS),
    ]);
    if (result.status === 'fulfilled') {
      fresh = result.value.find((b) => b.id === pickedBranch.id && b.active) ?? null;
      if (!fresh) error = 'That branch is no longer active.';
    } else {
      error = result.reason?.response?.data?.message || 'The server could not be reached. Try again.';
    }
    if (!alive.current) return;

    if (fresh) {
      // The fetched row, not a lookup in `activeBranches`, which may predate the fetch.
      selectScope(pickedFirm ?? firm, fresh);
      setSwitching({ phase: 'done', branchName: fresh.name });
    } else {
      setSwitching({ phase: 'failed', branchName: pickedBranch.name, error });
    }
    await sleep(RESULT_MS);
    if (alive.current) setSwitching(null);
  };

  const canChange = isRoot || branchSelectable;
  const Icon = isRoot ? BusinessRoundedIcon : StorefrontRoundedIcon;
  const primary = isRoot ? (firm?.name ?? 'Choose reporting entity') : (branch?.name ?? 'Choose branch');
  const secondary = isRoot ? (branch?.name ?? 'Choose branch') : 'Branch';
  const unset = isRoot ? !firm : !branch;

  return (
    <>
      <ButtonBase
        onClick={canChange ? () => setOpen(true) : undefined}
        disabled={!canChange}
        aria-label={canChange ? `${isRoot ? 'Reporting entity and branch' : 'Branch'}: ${primary}. Change` : undefined}
        sx={{
          width: stacked ? '100%' : 'auto',
          minWidth: stacked ? 0 : 220,
          display: 'flex', alignItems: 'center', gap: 1.25,
          px: 1.25, py: 1,
          textAlign: 'left',
          borderRadius: '11px',
          border: `1px solid ${tokens.hairline}`,
          backgroundColor: tokens.scopeBg,
          backdropFilter: 'blur(10px) saturate(160%)',
          WebkitBackdropFilter: 'blur(10px) saturate(160%)',
          boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
          transition: 'border-color 120ms ease, box-shadow 120ms ease',
          '&:hover': canChange ? { borderColor: tokens.hairline2, boxShadow: '0 2px 6px rgba(16,24,40,0.08)' } : {},
          '&.Mui-focusVisible': { outline: `2px solid ${tokens.blue}`, outlineOffset: 2 },
          '&.Mui-disabled': { cursor: 'default' },
        }}
      >
        <Box sx={{
          width: 32, height: 32, flexShrink: 0, borderRadius: '9px',
          display: 'grid', placeItems: 'center',
          backgroundColor: tokens.blueWash, color: tokens.blue,
        }}>
          <Icon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography noWrap sx={{
            fontSize: '0.84rem', fontWeight: 700, lineHeight: 1.25,
            color: unset ? tokens.muted : tokens.ink,
          }}>
            {primary}
          </Typography>
          <Typography noWrap sx={{ fontSize: '0.74rem', lineHeight: 1.3, color: tokens.muted }}>
            {secondary}
          </Typography>
        </Box>
        {canChange && <UnfoldMoreRoundedIcon sx={{ fontSize: 18, color: tokens.muted, flexShrink: 0 }} />}
      </ButtonBase>
      {canChange && <ScopePickerDialog open={open} onClose={() => setOpen(false)} onPick={switchTo} />}
      <ScopeSwitchOverlay phase={switching?.phase ?? null} branchName={switching?.branchName}
                          error={switching?.error} />
    </>
  );
}
