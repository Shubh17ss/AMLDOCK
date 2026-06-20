import { Alert, Stack, Typography } from '@mui/material';
import { useAuth } from '../auth/AuthContext.jsx';
import { FirmManageView } from '../features/firm/FirmManageView.jsx';

export function MyFirmPage() {
  const { user } = useAuth();
  const firmId = user?.realEstateFirmId;

  return (
    <Stack spacing={3}>
      <Typography variant="h4">My firm</Typography>
      {firmId
        ? <FirmManageView firmId={firmId} currentUser={user} editableIdentity={false} />
        : <Alert severity="info">Your account isn't linked to a firm.</Alert>}
    </Stack>
  );
}
