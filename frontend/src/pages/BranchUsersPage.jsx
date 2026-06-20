import { Alert, Stack, Typography } from '@mui/material';
import { useAuth } from '../auth/AuthContext.jsx';
import { FirmUsersCard } from '../features/firm/FirmUsersCard.jsx';

/** Sales-manager view: manage the agents in their branch (add / edit name+email / delete). */
export function BranchUsersPage() {
  const { user } = useAuth();
  const firmId = user?.realEstateFirmId;

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Branch users</Typography>
      {firmId
        ? <FirmUsersCard firmId={firmId} currentUser={user} title="Branch users" />
        : <Alert severity="info">Your account isn't linked to a branch.</Alert>}
    </Stack>
  );
}
