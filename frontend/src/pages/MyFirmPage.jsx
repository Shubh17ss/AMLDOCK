import { useQuery } from '@tanstack/react-query';
import { Alert, Stack, Typography } from '@mui/material';
import { useAuth } from '../auth/AuthContext.jsx';
import { getFirm } from '../api/firms.js';
import { FirmManageView } from '../features/firm/FirmManageView.jsx';

export function MyFirmPage() {
  const { user } = useAuth();
  const firmId = user?.realEstateFirmId;
  const firmQ = useQuery({
    queryKey: ['firm', firmId],
    queryFn: () => getFirm(firmId),
    enabled: Boolean(firmId),
  });

  return (
    <Stack spacing={3}>
      <Typography variant="h4">{firmQ.data?.name ?? 'My firm'}</Typography>
      {firmId
        ? <FirmManageView firmId={firmId} currentUser={user} editableIdentity={false} />
        : <Alert severity="info">Your account isn't linked to a firm.</Alert>}
    </Stack>
  );
}
