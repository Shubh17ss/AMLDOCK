import { useQuery } from '@tanstack/react-query';
import { Alert, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { listBranches } from '../../../api/firms.js';
import { tokens } from '../../../theme/theme.js';

/**
 * Which branch the deal belongs to.
 *
 * <p>Only firm-level staff ever see this. A deal belongs to a branch, and for an agent, agent PA,
 * branch admin or sales manager the server derives it from their own assignment — asking would be
 * offering a choice they do not have. A compliance officer or senior manager belongs to the firm
 * rather than to any one branch, so for them there is nothing to derive and the question has to be
 * asked before the deal can exist.
 *
 * <p>The list is the firm's own active branches; the server re-checks that the chosen one is
 * theirs, because a picker is a suggestion.
 */
export function BranchField({ firmId, value, onChange }) {
  const branchesQ = useQuery({
    queryKey: ['firms', firmId, 'branches'],
    queryFn: () => listBranches(firmId),
    enabled: Boolean(firmId),
  });

  const active = (branchesQ.data ?? []).filter((b) => b.active);

  if (branchesQ.isError) {
    return <Alert severity="error">Could not load the branches for your firm.</Alert>;
  }

  if (!branchesQ.isLoading && active.length === 0) {
    return (
      <Alert severity="warning">
        Your firm has no active branches, so there is nowhere to file this deal. Add one under
        Settings before creating it.
      </Alert>
    );
  }

  return (
    <>
      <FormControl fullWidth required disabled={branchesQ.isLoading}>
        <InputLabel id="deal-branch-label">Branch</InputLabel>
        <Select
          labelId="deal-branch-label"
          label="Branch"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          {active.map((b) => (
            <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <Typography variant="caption" sx={{ color: tokens.muted }}>
        You are not assigned to a branch, so this deal needs one naming. It cannot be changed
        afterwards.
      </Typography>
    </>
  );
}
