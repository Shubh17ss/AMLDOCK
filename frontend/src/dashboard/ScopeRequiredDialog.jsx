import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { SCOPE_SETUP_ROLES } from '../auth/roles.js';
import { useDashboardScope, isScopeExemptPath } from './DashboardScope.jsx';
import { tokens, fonts } from '../theme/theme.js';

const FIRMS_ADMIN_PATH = '/settings/reporting-entities';

/**
 * Blocks the app until a single reporting entity and a single branch are chosen.
 *
 * <p>The house rule was always that a page shows data and offers actions only once both are picked
 * — anything wider is ambiguous, because you cannot say which register you are writing into. It
 * used to be advisory: two training pages honoured it via ScopeGate and the other twenty-odd
 * consumers rendered unscoped data, while a dozen write paths posted `realEstateFirmId: undefined`
 * with nothing stopping them. This is the rule made real.
 *
 * <p>Not dismissible by clicking away — "All entities" no longer exists, so there is nothing to
 * dismiss *to*. There are two ways out. Signing out, always. And, for the two states the dialog
 * cannot resolve with a dropdown — no reporting entity on the platform at all, or an entity whose
 * branches are all inactive — a button through to Settings › Reporting Entities, which is
 * scope-exempt precisely so that the rule cannot trap the account that exists to satisfy it.
 *
 * <p>Branch-level staff never see it — DashboardScopeProvider pins both values from their own
 * record before the first paint. The exception is one whose record names no branch: they are
 * offered the branch list rather than a dead end, because the server already lets a branch-less
 * actor work any branch of their own firm, and locking a functioning user out over a
 * data-hygiene problem trades a support ticket for an outage.
 */
export function ScopeRequiredDialog() {
  const { user, logout } = useAuth();
  // Both above the early return below, or the hook count changes the moment the scope completes.
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const {
    firm, branch, firmOptions, activeBranches, selectFirm, selectBranch,
    isRoot, branchSelectable, currentFirmId, optionsLoading, scopeComplete, scopeSettled,
  } = useDashboardScope();

  // `scopeSettled` keeps a branch-level user — whose scope pins itself the moment the branches
  // query resolves — from seeing this flash open and shut on every cold load.
  //
  // The path clause is the way out. Settings › Reporting Entities is where both dead ends below are
  // repaired, so the dialog stands down there rather than covering the only screen that can answer
  // it. There is no dismissal state: navigating away re-arms it, and a refresh on the exempt path
  // lands with it still down.
  if (!user || scopeComplete || !scopeSettled || isScopeExemptPath(pathname)) return null;

  // The two states this dialog cannot resolve on its own, because the thing to choose does not
  // exist. Both wait on `optionsLoading` so a slow network never paints a dead end that then fixes
  // itself — `noBranches` used to get that implicitly from rendering inside the ternary below, but
  // the escape button sits in DialogActions, outside it, and would otherwise flash on every load.
  //
  //   noEntities — nothing onboarded yet. Only reachable by ROOT and AUDIT, the two roles asked to
  //                choose an entity at all; everyone else has theirs pinned from their account.
  //   noBranches — an entity whose branches are all inactive.
  const noEntities = !optionsLoading && firmOptions.length === 0;
  const noBranches = Boolean(currentFirmId) && !optionsLoading && activeBranches.length === 0;
  const deadEnd = noEntities || noBranches;

  // AUDIT reaches both screens — it is in SETTINGS_ROLES — but may create neither an entity nor a
  // branch, so the button would only move its dead end one screen along. It gets the explanation
  // and Sign out instead.
  const canFixScope = SCOPE_SETUP_ROLES.includes(user.role);

  // Where each dead end is repaired. A has no entity to deep-link to, so it goes to the register and
  // its create button; B goes straight to the entity's own page, whose branches card is the exact
  // control needed.
  const setupPath = noEntities ? FIRMS_ADMIN_PATH : `${FIRMS_ADMIN_PATH}/${currentFirmId}`;

  return (
    <Dialog
      open
      maxWidth="xs"
      fullWidth
      // The whole point: no backdrop click, no Escape, no close button.
      disableEscapeKeyDown
      onClose={() => {}}
    >
      <DialogContent sx={{ pt: 4, pb: 2 }}>
        <Stack spacing={1.25} alignItems="center" sx={{ textAlign: 'center', mb: 3 }}>
          <Box
            sx={{
              width: 46, height: 46, borderRadius: '14px',
              display: 'grid', placeItems: 'center',
              backgroundColor: tokens.blueWash, color: tokens.blue,
            }}
          >
            <TuneRoundedIcon />
          </Box>
          <Typography
            sx={{
              fontFamily: fonts.mono, fontSize: '0.65rem', letterSpacing: '0.13em',
              textTransform: 'uppercase', color: tokens.muted,
            }}
          >
            Scope required
          </Typography>
          <Typography sx={{ fontFamily: fonts.display, fontSize: '1.3rem', color: tokens.ink }}>
            Choose where you're working
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.muted, maxWidth: 360 }}>
            Every register in AMLDOCK is kept per branch, so a reporting entity and a branch have to
            be set before anything can be shown or changed.
          </Typography>
        </Stack>

        {optionsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Stack spacing={2}>
            {/* ROOT and AUDIT belong to no entity and pick one; everybody else has theirs. */}
            {isRoot ? (
              // Disabled when empty, mirroring the branch control below. A required-looking select
              // that opens an empty popper is the visual signature of a broken screen.
              <FormControl fullWidth required disabled={noEntities}>
                <InputLabel id="scope-entity-label">Reporting entity</InputLabel>
                <SelectField
                  labelId="scope-entity-label"
                  label="Reporting entity"
                  value={firm?.id ?? ''}
                  onChange={(e) => selectFirm(e.target.value)}
                  options={firmOptions}
                />
              </FormControl>
            ) : (
              <TextField
                label="Reporting entity"
                value={firm?.name ?? '—'}
                InputProps={{ readOnly: true }}
                fullWidth
                helperText="Your reporting entity, from your account."
              />
            )}

            {branchSelectable ? (
              <FormControl fullWidth required disabled={!currentFirmId || noBranches}>
                <InputLabel id="scope-branch-label">Branch</InputLabel>
                <SelectField
                  labelId="scope-branch-label"
                  label="Branch"
                  value={branch?.id ?? ''}
                  onChange={(e) => selectBranch(e.target.value)}
                  options={activeBranches}
                />
              </FormControl>
            ) : (
              <TextField
                label="Branch"
                value={branch?.name ?? '—'}
                InputProps={{ readOnly: true }}
                fullWidth
              />
            )}

            {noEntities && (
              <Alert severity="warning">
                No reporting entities have been set up yet.
                {canFixScope
                  ? ' Create the first one to start using the workspace.'
                  : ' Ask a platform administrator to create one.'}
              </Alert>
            )}

            {noBranches && (
              <Alert severity="warning">
                {firm?.name ?? 'This entity'} has no active branches.
                {canFixScope
                  ? ' Add one to continue.'
                  : ' Ask an administrator to add one under Settings › Reporting entities.'}
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        {/* Always present. Not everyone's dead end is theirs to fix — AUDIT creates nothing, and a
            firm-level user on a suspended entity has nowhere to go. */}
        <Button onClick={logout} color="inherit">Sign out</Button>
        <Box sx={{ flexGrow: 1 }} />

        {/* No confirm button in the ordinary case: choosing both values closes the dialog on its
            own, so a Continue that is only ever clickable at the moment it becomes redundant would
            be furniture. A dead end is the exception — there is nothing to choose, so the only
            useful action is to go and create what is missing. Navigating there is enough to close
            this: the route is scope-exempt, so the next render returns null. */}
        {deadEnd && canFixScope && (
          <Button
            variant="contained"
            endIcon={<ArrowForwardRoundedIcon />}
            onClick={() => navigate(setupPath)}
          >
            {noEntities ? 'Set up reporting entities' : 'Add a branch'}
          </Button>
        )}

        {/* `!deadEnd`, not `!noBranches`: with no entities at all the old guard was true and this
            told ROOT to choose from an empty list. The alert and the button take that space now. */}
        {!deadEnd && !optionsLoading && (
          <Typography variant="caption" sx={{ color: tokens.muted }}>
            {firm?.id ? 'Choose a branch to continue' : 'Choose an entity to continue'}
          </Typography>
        )}
      </DialogActions>
    </Dialog>
  );
}

/** The two choosers differ only in their options, so they share one select. */
function SelectField({ labelId, label, value, onChange, options }) {
  return (
    <Select labelId={labelId} label={label} value={value} onChange={onChange}>
      {options.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
    </Select>
  );
}
