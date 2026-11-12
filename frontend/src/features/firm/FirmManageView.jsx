import { useQuery } from '@tanstack/react-query';
import { Alert, Box, CircularProgress, Stack } from '@mui/material';
import { getFirm } from '../../api/firms.js';
import { FirmDetailsCard } from './FirmDetailsCard.jsx';
import { FirmUsersCard } from './FirmUsersCard.jsx';
import { FirmBranchesCard } from './FirmBranchesCard.jsx';

/**
 * Full management surface for a single reporting entity: details + users + branches. `firmId` is
 * the entity's public id. Shared by Settings › Reporting Entity (compliance officers, senior
 * managers, audit) and ROOT's per-entity page.
 *   - editableIdentity: ROOT may edit firm name / NZBN / active.
 *   - showUsers: firm users are managed in the dedicated Settings › Users section, so the
 *     reporting-entities view hides this card to avoid duplicating it.
 *   - branch deactivate is limited to ROOT and senior managers (the delete-capable roles).
 */
export function FirmManageView({ firmId, currentUser, editableIdentity = false, showUsers = true }) {
  const firmQ = useQuery({
    queryKey: ['firm', firmId],
    queryFn: () => getFirm(firmId),
    enabled: Boolean(firmId),
  });

  if (!firmId) return <Alert severity="info">No reporting entity selected.</Alert>;
  if (firmQ.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }
  if (firmQ.isError) return <Alert severity="error">Failed to load the reporting entity.</Alert>;

  const canDeactivateBranch = currentUser?.role === 'ROOT' || currentUser?.role === 'SENIOR_MANAGER';

  return (
    <Stack spacing={3}>
      <FirmDetailsCard firm={firmQ.data} editableIdentity={editableIdentity} />
      {/* Users filter by the numeric id, which the loaded entity carries. */}
      {showUsers && <FirmUsersCard firmId={firmQ.data.id} currentUser={currentUser} />}
      <FirmBranchesCard firmRef={firmId} canDeactivate={canDeactivateBranch}
                        maxBranches={firmQ.data?.numberOfBranches ?? null} />
    </Stack>
  );
}
