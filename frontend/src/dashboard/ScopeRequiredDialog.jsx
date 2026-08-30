import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useAuth } from '../auth/AuthContext.jsx';
import { useDashboardScope } from './DashboardScope.jsx';
import { tokens, fonts } from '../theme/theme.js';

/**
 * Blocks the app until a single reporting entity and a single branch are chosen.
 *
 * <p>The house rule was always that a page shows data and offers actions only once both are picked
 * — anything wider is ambiguous, because you cannot say which register you are writing into. It
 * used to be advisory: two training pages honoured it via ScopeGate and the other twenty-odd
 * consumers rendered unscoped data, while a dozen write paths posted `realEstateFirmId: undefined`
 * with nothing stopping them. This is the rule made real.
 *
 * <p>Not dismissible. "All entities" no longer exists, so there is nothing to dismiss *to*. The one
 * way out is signing out, which matters for the single state this dialog cannot resolve on its
 * own: an entity whose branches are all inactive.
 *
 * <p>Branch-level staff never see it — DashboardScopeProvider pins both values from their own
 * record before the first paint. The exception is one whose record names no branch: they are
 * offered the branch list rather than a dead end, because the server already lets a branch-less
 * actor work any branch of their own firm, and locking a functioning user out over a
 * data-hygiene problem trades a support ticket for an outage.
 */
export function ScopeRequiredDialog() {
  const { user, logout } = useAuth();
  const {
    firm, branch, firmOptions, activeBranches, selectFirm, selectBranch,
    isRoot, branchSelectable, currentFirmId, optionsLoading, scopeComplete, scopeSettled,
  } = useDashboardScope();

  // `scopeSettled` keeps a branch-level user — whose scope pins itself the moment the branches
  // query resolves — from seeing this flash open and shut on every cold load.
  if (!user || scopeComplete || !scopeSettled) return null;

  // A firm whose branches are all inactive: nothing to select, and not something the dialog can
  // resolve. Only rendered once the list has actually arrived, so a slow network never shows a
  // dead end that then fixes itself.
  const noBranches = Boolean(currentFirmId) && activeBranches.length === 0;

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
              <FormControl fullWidth required>
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

            {noBranches && (
              <Alert severity="warning">
                {firm?.name ?? 'This entity'} has no active branches. Ask an administrator to add
                one under Settings.
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        {/* Always present. Without it, the two dead ends above would strand the user in a modal
            with no exit. */}
        <Button onClick={logout} color="inherit">Sign out</Button>
        <Box sx={{ flexGrow: 1 }} />
        {/* No confirm button: choosing both values closes the dialog on its own, so a Continue
            that is only ever clickable at the moment it becomes redundant would be furniture. */}
        {!noBranches && !optionsLoading && (
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
