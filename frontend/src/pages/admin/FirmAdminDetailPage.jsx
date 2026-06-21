import { Link as RouterLink, useParams } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../../auth/AuthContext.jsx';
import { FirmManageView } from '../../features/firm/FirmManageView.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';

/** ROOT per-firm management — same view senior managers / compliance officers use for their firm. */
export function FirmAdminDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const firmId = Number(id);

  return (
    <Stack spacing={3}>
      <Box>
        <Button component={RouterLink} to="/admin/firms" startIcon={<ArrowBackIcon />} size="small">
          Back to firms
        </Button>
      </Box>
      <PageHeader eyebrow="firm · manage" title="Manage firm" />
      <FirmManageView firmId={firmId} currentUser={user} editableIdentity />
    </Stack>
  );
}
