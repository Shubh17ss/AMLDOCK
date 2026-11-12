import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import { useDashboardScope } from './DashboardScope.jsx';
import { useScopeSwitch } from './useScopeSwitch.js';
import { ScopeSwitchOverlay } from '../components/dashboard/ScopeSwitchOverlay.jsx';
import { DASHBOARD_PATH } from '../navigation/moduleRegistry.jsx';
import { tokens } from '../theme/theme.js';

/**
 * Keeps a deal page honest about the scope it is shown under.
 *
 * This used to be a silent follow: opening a deal moved the scope to the deal's branch, through the
 * raw setters, so the active-branch check never ran — and Back to an old deal after a switch quietly
 * switched you back. Now a deal outside the current scope is not rendered at all; the viewer is told
 * where it lives and chooses to switch (through the same checked path as the selector) or leave.
 *
 * The one convenience kept: a scope that is still empty — a deep link on first load — is filled
 * from the deal, again through the checked path.
 *
 * Branch-pinned roles are left alone. Their scope cannot move, and the server only ever hands them
 * their own branch's deals.
 *
 * Returns `{ blocked, element }`: while `blocked`, render `element` in place of the deal.
 */
export function useDealScopeGuard(deal) {
  const scope = useDashboardScope();
  const navigate = useNavigate();
  const { switching, switchTo } = useScopeSwitch();

  const applies = Boolean(deal?.firmBranchId) && scope.branchSelectable;
  const firmMismatch = scope.isRoot && deal?.firmId != null && scope.firm?.id !== deal.firmId;
  const mismatch = applies && (firmMismatch || scope.branch?.id !== deal.firmBranchId);

  // The deal's entity as switchTo needs it: by public id, which only the entity list carries.
  // Null for a non-ROOT viewer, whose entity never changes.
  const dealFirm = scope.isRoot
    ? (scope.firmOptions.find((f) => f.id === deal?.firmId) ?? null)
    : null;
  const target = { id: deal?.firmBranchId, name: deal?.branchName };
  const goSwitch = () => switchTo(dealFirm, target);

  // Fill an empty scope once per deal; never override one the viewer chose.
  const filledFor = useRef(null);
  const scopeEmpty = !scope.branch;
  useEffect(() => {
    if (!applies || !scopeEmpty || !scope.scopeSettled) return;
    if (scope.isRoot && !dealFirm) return;     // wait for the entity list
    if (filledFor.current === deal.id) return;
    filledFor.current = deal.id;
    switchTo(dealFirm, target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applies, scopeEmpty, scope.scopeSettled, dealFirm, deal?.id]);

  const overlay = (
    <ScopeSwitchOverlay phase={switching?.phase ?? null} branchName={switching?.branchName}
                        error={switching?.error} />
  );

  if (!mismatch) return { blocked: false, element: overlay };

  const where = scope.isRoot && firmMismatch
    ? `${deal.branchName} · ${deal.firmName}`
    : deal.branchName;
  return {
    blocked: true,
    element: (
      <>
        <Paper variant="outlined" sx={{ maxWidth: 520, mx: 'auto', mt: 6, p: 3, borderRadius: '14px' }}>
          <Stack spacing={2} alignItems="flex-start">
            <Box sx={{
              width: 40, height: 40, borderRadius: '11px', display: 'grid', placeItems: 'center',
              backgroundColor: tokens.blueWash, color: tokens.blue,
            }}>
              <StorefrontRoundedIcon />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: tokens.ink }}>
                This deal belongs to {where}
              </Typography>
              <Typography variant="body2" sx={{ color: tokens.muted, mt: 0.5 }}>
                You are working in {scope.branch?.name ?? 'another branch'}. Switch to the deal’s
                branch to open it, or go back to your dashboard.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={goSwitch} disabled={Boolean(switching)}
                      disableElevation>
                Switch to {deal.branchName}
              </Button>
              <Button onClick={() => navigate(DASHBOARD_PATH, { replace: true })}>
                Go to dashboard
              </Button>
            </Stack>
          </Stack>
        </Paper>
        {overlay}
      </>
    ),
  };
}
