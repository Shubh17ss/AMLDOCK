import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Box, ButtonBase, Typography } from '@mui/material';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { dropEntityQueries, useScopeSwitch } from '../../dashboard/useScopeSwitch.js';
import { ScopePickerDialog } from './ScopePickerDialog.jsx';
import { ScopeSwitchOverlay } from './ScopeSwitchOverlay.jsx';
import { DASHBOARD_PATH } from '../../navigation/moduleRegistry.jsx';
import { tokens } from '../../theme/theme.js';

/**
 * The scope the app works in, as one card: an icon, what is selected, and — where there is a
 * choice — a chevron that opens ScopePickerDialog. Role-aware:
 *   ROOT / AUDIT → entity and branch; picks any of either.
 *   Firm-level in several entities → entity and branch; another entity is picked by switching
 *                  the session into it (AuthContext.switchEntity), then a branch inside it.
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
 * A switch is confirmed with the server first (useScopeSwitch). Once applied, the app leaves for
 * the dashboard and drops every deal-keyed query: a deal, its versions or its draft from the old
 * branch must not stay on screen under the new one. `replace`, so Back from the dashboard does not
 * land on the old branch's deal either — and if history still reaches it, useDealScopeGuard stops it.
 */

export function ScopeSelector({ stacked = false }) {
  const { firm, branch, isRoot, branchSelectable, multiEntity, selectScope } = useDashboardScope();
  const { switchEntity } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { switching, switchTo } = useScopeSwitch({
    onSwitched: () => {
      navigate(DASHBOARD_PATH, { replace: true });
      dropEntityQueries(qc);
    },
  });

  // Moving to another entity is a server round trip, not a state change: the session is
  // re-issued for it, and only then does the scope follow. The branch is left unchosen, so
  // ScopeRequiredDialog asks for one in the new entity — the old entity's branches mean nothing there.
  const [entitySwitch, setEntitySwitch] = useState(null);   // { phase, branchName, error }
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  const switchToEntity = async (m) => {
    setEntitySwitch({ phase: 'switching', branchName: m.realEstateFirmName });
    try {
      await switchEntity(m.id);
      selectScope({ id: m.realEstateFirmId, name: m.realEstateFirmName, country: m.country }, null);
      navigate(DASHBOARD_PATH, { replace: true });
      if (alive.current) setEntitySwitch({ phase: 'done', branchName: m.realEstateFirmName });
    } catch (e) {
      if (alive.current) {
        setEntitySwitch({
          phase: 'failed',
          branchName: m.realEstateFirmName,
          error: e?.response?.data?.message || 'The server could not be reached. Try again.',
        });
      }
    }
    setTimeout(() => { if (alive.current) setEntitySwitch(null); }, 1200);
  };

  const showsEntity = isRoot || multiEntity;
  const canChange = isRoot || branchSelectable;
  const Icon = showsEntity ? BusinessRoundedIcon : StorefrontRoundedIcon;
  const primary = showsEntity ? (firm?.name ?? 'Choose reporting entity') : (branch?.name ?? 'Choose branch');
  const secondary = showsEntity ? (branch?.name ?? 'Choose branch') : 'Branch';
  const unset = showsEntity ? !firm : !branch;
  const overlay = entitySwitch ?? switching;

  return (
    <>
      <ButtonBase
        onClick={canChange ? () => setOpen(true) : undefined}
        disabled={!canChange}
        aria-label={canChange ? `${showsEntity ? 'Reporting entity and branch' : 'Branch'}: ${primary}. Change` : undefined}
        sx={{
          width: stacked ? '100%' : 'auto',
          minWidth: stacked ? 0 : 220,
          display: 'flex', alignItems: 'center', gap: 1.25,
          px: 1.25, py: 1,
          textAlign: 'left',
          borderRadius: '14px',
          border: `1px solid ${tokens.hairline2}`,
          backgroundColor: tokens.tile,
          transition: 'border-color 120ms ease',
          '&:hover': canChange ? { borderColor: tokens.ink } : {},
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
      {canChange && (
        <ScopePickerDialog open={open} onClose={() => setOpen(false)} onPick={switchTo}
                           onPickEntity={switchToEntity} />
      )}
      <ScopeSwitchOverlay phase={overlay?.phase ?? null} branchName={overlay?.branchName}
                          error={overlay?.error} entity={Boolean(entitySwitch)} />
    </>
  );
}
