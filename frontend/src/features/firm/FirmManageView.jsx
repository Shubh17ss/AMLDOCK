import { useQuery } from '@tanstack/react-query';
import { Alert, Box, CircularProgress, Stack } from '@mui/material';
import { getFirm } from '../../api/firms.js';
import { FirmDetailsCard } from './FirmDetailsCard.jsx';
import { FirmUsersCard } from './FirmUsersCard.jsx';
import { FirmBranchesCard } from './FirmBranchesCard.jsx';

/**
 * Full management surface for a single firm: details + users + branches.
 * Shared by the senior-manager / compliance "My firm" page and the ROOT per-firm page.
 *   - editableIdentity: ROOT may edit firm name / NZBN / active.
 *   - branch deactivate is limited to ROOT and senior managers (the delete-capable roles).
 */
export function FirmManageView({ firmId, currentUser, editableIdentity = false }) {
  const firmQ = useQuery({
    queryKey: ['firm', firmId],
    queryFn: () => getFirm(firmId),
    enabled: Boolean(firmId),
  });

  if (!firmId) return <Alert severity="info">No firm selected.</Alert>;
  if (firmQ.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }
  if (firmQ.isError) return <Alert severity="error">Failed to load the firm.</Alert>;

  const canDeactivateBranch = currentUser?.role === 'ROOT' || currentUser?.role === 'SENIOR_MANAGER';

  return (
    <Stack spacing={3}>
      <FirmDetailsCard firm={firmQ.data} editableIdentity={editableIdentity} />
      <FirmUsersCard firmId={firmId} currentUser={currentUser} />
      <FirmBranchesCard firmId={firmId} canDeactivate={canDeactivateBranch} />
    </Stack>
  );
}
