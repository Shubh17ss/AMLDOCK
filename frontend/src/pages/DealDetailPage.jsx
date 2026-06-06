import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogContentText, DialogTitle, Divider, Grid, Stack, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SendIcon from '@mui/icons-material/Send';
import { useAuth } from '../auth/AuthContext.jsx';
import { deleteDeal, getDeal, overrideDeal, submitDeal } from '../api/deals.js';
import { DealStatusChip } from '../components/DealStatusChip.jsx';
import { DocumentUploader } from '../components/DocumentUploader.jsx';
import { BrokerNotesCard } from '../features/deal/BrokerNotesCard.jsx';
import { OverrideDialog } from '../features/deal/DecisionDialogs.jsx';
import { DealAuditPanel } from '../features/deal/DealAuditPanel.jsx';

const NZD = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 });

export function DealDetailPage() {
  const { id } = useParams();
  const dealId = Number(id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [actionError, setActionError] = useState(null);

  const q = useQuery({ queryKey: ['deals', dealId], queryFn: () => getDeal(dealId) });

  const overrideMut = useMutation({
    mutationFn: ({ targetStatus, reason }) => overrideDeal(dealId, targetStatus, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deals', dealId] }); setOverrideOpen(false); },
  });

  const submitMut = useMutation({
    mutationFn: () => submitDeal(dealId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId] }),
    onError: (e) => setActionError(e.response?.data?.message || 'Failed to submit'),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteDeal(dealId),
    onSuccess: () => navigate('/my-deals'),
    onError: (e) => setActionError(e.response?.data?.message || 'Failed to delete'),
  });

  if (q.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }
  if (q.isError) {
    return <Alert severity="error">Failed to load deal.</Alert>;
  }

  const deal = q.data;
  const isOwnerBroker = user?.role === 'BROKER' && user.userId === deal.createdByUserId;
  const isDraft = deal.status === 'DRAFT';

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="h4">{deal.reference ?? `Deal #${deal.id}`}</Typography>
        <DealStatusChip status={deal.status} />
        <Chip label={deal.transactionType} size="small" variant="outlined" />
        <Box sx={{ flexGrow: 1 }} />
        {isOwnerBroker && isDraft && (
          <>
            <Button color="error" startIcon={<DeleteOutlineIcon />}
                    onClick={() => setConfirmDelete(true)} disabled={submitMut.isPending || deleteMut.isPending}>
              Delete
            </Button>
            <Button variant="contained" startIcon={<SendIcon />}
                    onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>
              {submitMut.isPending ? 'Submitting…' : 'Submit for review'}
            </Button>
          </>
        )}
        {(user?.role === 'COMPLIANCE' || user?.role === 'MANAGER') && deal.status !== 'DRAFT' && (
          <Button variant="contained" onClick={() => navigate(`/deals/${deal.id}/review`)}>
            Open review
          </Button>
        )}
        {user?.role === 'MANAGER' && deal.status !== 'DRAFT' && (
          <Button variant="outlined" color="warning" onClick={() => setOverrideOpen(true)}>
            Override
          </Button>
        )}
      </Stack>

      {actionError && <Alert severity="error" onClose={() => setActionError(null)}>{actionError}</Alert>}

      {(deal.status === 'APPROVED' || deal.status === 'REJECTED') && (
        <DecisionCard deal={deal} />
      )}

      <BrokerNotesCard deal={deal} />

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1">Firm & branch</Typography>
              <Divider sx={{ my: 1 }} />
              <DetailRow label="Firm" value={deal.firmName} />
              <DetailRow label="Branch" value={deal.branchName} />
              <DetailRow label="Value" value={deal.transactionValueNzd != null ? NZD.format(deal.transactionValueNzd) : null} />
              <Typography variant="subtitle2" sx={{ mt: 2 }}>Point of contact</Typography>
              <DetailRow label="Name" value={deal.pocName} />
              <DetailRow label="Role" value={deal.pocRole} />
              <DetailRow label="Phone" value={deal.pocPhone} />
              <DetailRow label="Email" value={deal.pocEmail} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1">Property</Typography>
              <Divider sx={{ my: 1 }} />
              <DetailRow label="Address" value={[deal.property?.addressLine1, deal.property?.addressLine2].filter(Boolean).join(', ')} />
              <DetailRow label="Suburb" value={deal.property?.suburb} />
              <DetailRow label="District / City" value={deal.property?.district} />
              <DetailRow label="Region" value={deal.property?.region} />
              <DetailRow label="Country" value={deal.property?.country} />
              <DetailRow label="Postcode" value={deal.property?.postcode} />
              <DetailRow label="Title ref" value={deal.property?.titleReference} />
              <DetailRow label="Land area" value={deal.property?.landAreaSqm ? `${deal.property.landAreaSqm} m²` : null} />
              <DetailRow label="Legal description" value={deal.property?.legalDescription} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1">Client</Typography>
              <Divider sx={{ my: 1 }} />
              <DetailRow label="Name" value={deal.client?.displayName} />
              <DetailRow label="Type" value={deal.client?.clientType} />
              <DetailRow label="Email" value={deal.client?.email} />
              <DetailRow label="Phone" value={deal.client?.phone} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1">Metadata</Typography>
              <Divider sx={{ my: 1 }} />
              <DetailRow label="Created by" value={deal.createdByEmail} />
              <DetailRow label="Created" value={new Date(deal.createdAt).toLocaleString()} />
              <DetailRow label="Updated" value={new Date(deal.updatedAt).toLocaleString()} />
              {deal.decidedAt && (
                <>
                  <DetailRow label="Decided" value={new Date(deal.decidedAt).toLocaleString()} />
                  <DetailRow label="Notes" value={deal.decisionNotes} />
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <DocumentUploader
            dealId={deal.id}
            canUpload={
              user?.role === 'COMPLIANCE' ||
              user?.role === 'MANAGER' ||
              (isOwnerBroker && isDraft)
            }
            title="Documents"
          />
        </CardContent>
      </Card>

      {(user?.role === 'COMPLIANCE' || user?.role === 'MANAGER') && (
        <DealAuditPanel dealId={deal.id} />
      )}

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <DialogTitle>Delete this draft?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Draft <strong>{deal.reference ?? `#${deal.id}`}</strong> will be removed permanently along with its
            property and client records. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <OverrideDialog
        open={overrideOpen}
        deal={deal}
        onClose={() => setOverrideOpen(false)}
        submitting={overrideMut.isPending}
        onSubmit={(targetStatus, reason) => overrideMut.mutateAsync({ targetStatus, reason })}
      />
    </Stack>
  );
}

function DecisionCard({ deal }) {
  const isApproved = deal.status === 'APPROVED';
  const isOverride = (deal.decisionNotes ?? '').startsWith('[OVERRIDE');
  const severity = isApproved ? 'success' : 'error';
  return (
    <Alert severity={severity} sx={{ alignItems: 'flex-start' }}>
      <Stack spacing={0.5}>
        <Typography variant="subtitle1">
          {isApproved ? 'Approved' : 'Rejected'}{isOverride ? ' (via override)' : ''}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {deal.decidedAt && new Date(deal.decidedAt).toLocaleString()}
          {deal.createdByEmail && ' · '}
          {deal.decidedByUserId && `by user #${deal.decidedByUserId}`}
        </Typography>
        {deal.decisionNotes && (
          <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
            {deal.decisionNotes}
          </Typography>
        )}
      </Stack>
    </Alert>
  );
}

function DetailRow({ label, value }) {
  return (
    <Stack direction="row" spacing={1} sx={{ py: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>{label}</Typography>
      <Typography variant="body2">{value || '—'}</Typography>
    </Stack>
  );
}
