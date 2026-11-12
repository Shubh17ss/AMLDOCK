import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Alert, Link, Stack } from '@mui/material';
import { useAuth } from '../auth/AuthContext.jsx';
import { QUERY_RAISER_ROLES } from '../auth/roles.js';
import { FirmManageView } from '../features/firm/FirmManageView.jsx';
import { ContactAdminDialog } from '../features/firm/ContactAdminDialog.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { tokens } from '../theme/theme.js';

/**
 * Settings › Reporting Entity: a compliance officer's, senior manager's or auditor's view of
 * their own entity. Name, NZBN/ABN, country and branch count are read-only; the liaison and
 * compliance officer details and the branches may be edited. ROOT manages every entity from
 * Settings › Reporting Entities instead.
 *
 * <p>What is read-only here is changed by asking: the "Contact AMLDOCK admin" link raises a query
 * in ROOT's Workspace › Queries.
 *
 * <p>Another entity's id is refused here before a request is made, and by assertVisible on the
 * server regardless.
 */
export function ReportingEntityPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [contactOpen, setContactOpen] = useState(false);
  const own = user?.realEstateFirmPublicId;
  const mayAsk = id === own && QUERY_RAISER_ROLES.includes(user?.role);

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="settings · reporting entity"
        title="Reporting Entity"
        actions={mayAsk && (
          <Link
            component="button"
            type="button"
            underline="always"
            onClick={() => setContactOpen(true)}
            sx={{ color: tokens.blue, fontWeight: 400, fontSize: '0.92rem' }}
          >
            Contact AMLDOCK admin for changes
          </Link>
        )}
      />
      {id === own
        ? <FirmManageView firmId={id} currentUser={user} showUsers={false} />
        : <Alert severity="error">You don&apos;t have access to this reporting entity.</Alert>}
      {mayAsk && <ContactAdminDialog open={contactOpen} onClose={() => setContactOpen(false)} />}
    </Stack>
  );
}

/** The menu's link: forwards to the signed-in user's own entity. */
export function ReportingEntityRedirect() {
  const { user } = useAuth();
  if (!user?.realEstateFirmPublicId) {
    return <Alert severity="info">Your account is not linked to a reporting entity.</Alert>;
  }
  return <Navigate to={`/reporting-entity/${user.realEstateFirmPublicId}`} replace />;
}
