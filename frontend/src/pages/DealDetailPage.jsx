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
import { isDealAuthor, isDealReviewer, canDelete, canOverride } from '../auth/roles.js';
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
  const isOwnerAgent = isDealAuthor(user?.role) && user.userId === deal.createdByUserId;
  const isDraft = deal.status === 'DRAFT';

  return (
    /* Centered, max-width container */
    <Box sx={{ maxWidth: 960, mx: 'auto', width: '100%' }}>
      <Stack spacing={3}>

        {/* ── Header card: identity + actions ─────────────────────────── */}
        <Card>
          <CardContent>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              spacing={2}
            >
              {/* Deal identity */}
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {deal.reference ?? `Deal #${deal.id}`}
                </Typography>
                <DealStatusChip status={deal.status} />
                <Chip label={deal.transactionType} size="small" />
              </Stack>

              {/* Action buttons */}
              <Stack direction="row" spacing={1.5} flexWrap="wrap">
                {isOwnerAgent && isDraft && (
                  <Button
                    variant="contained"
                    startIcon={<SendIcon />}
                    onClick={() => submitMut.mutate()}
                    disabled={submitMut.isPending}
                  >
                    {submitMut.isPending ? 'Submitting…' : 'Submit for review'}
                  </Button>
                )}
                {canDelete(user?.role) && (
                  <Button
                    color="error"
                    startIcon={<DeleteOutlineIcon />}
                    onClick={() => setConfirmDelete(true)}
                    disabled={submitMut.isPending || deleteMut.isPending}
                  >
                    Delete
                  </Button>
                )}
                {isDealReviewer(user?.role) && deal.status !== 'DRAFT' && (
                  <Button variant="contained" onClick={() => navigate(`/deals/${deal.id}/review`)}>
                    Open review
                  </Button>
                )}
                {canOverride(user?.role) && deal.status !== 'DRAFT' && (
                  <Button variant="outlined" color="warning" onClick={() => setOverrideOpen(true)}>
                    Override
                  </Button>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {actionError && (
          <Alert severity="error" onClose={() => setActionError(null)}>{actionError}</Alert>
        )}

        {(deal.status === 'APPROVED' || deal.status === 'REJECTED') && (
          <DecisionCard deal={deal} />
        )}

        <BrokerNotesCard deal={deal} />

        {/* ── Detail cards grid ────────────────────────────────────────── */}
        {/* Box clips the negative margin MUI Grid adds for spacing */}
        <Box sx={{ overflow: 'hidden' }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Firm & branch</Typography>
                <Divider sx={{ mb: 1.5 }} />
                <DetailRow label="Firm"    value={deal.firmName} />
                <DetailRow label="Branch"  value={deal.branchName} />
                <DetailRow label="Value"   value={deal.transactionValueNzd != null ? NZD.format(deal.transactionValueNzd) : null} />
                <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 700 }}>Point of contact</Typography>
                <DetailRow label="Name"    value={deal.pocName} />
                <DetailRow label="Role"    value={deal.pocRole} />
                <DetailRow label="Phone"   value={deal.pocPhone} />
                <DetailRow label="Email"   value={deal.pocEmail} />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Property</Typography>
                <Divider sx={{ mb: 1.5 }} />
                <DetailRow label="Address"      value={[deal.property?.addressLine1, deal.property?.addressLine2].filter(Boolean).join(', ')} />
                <DetailRow label="Suburb"        value={deal.property?.suburb} />
                <DetailRow label="District"      value={deal.property?.district} />
                <DetailRow label="Region"        value={deal.property?.region} />
                <DetailRow label="Country"       value={deal.property?.country} />
                <DetailRow label="Postcode"      value={deal.property?.postcode} />
                <DetailRow label="Title ref"     value={deal.property?.titleReference} />
                <DetailRow label="Land area"     value={deal.property?.landAreaSqm ? `${deal.property.landAreaSqm} m²` : null} />
                <DetailRow label="Legal desc."   value={deal.property?.legalDescription} />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Client</Typography>
                <Divider sx={{ mb: 1.5 }} />
                <DetailRow label="Name"  value={deal.client?.displayName} />
                <DetailRow label="Type"  value={deal.client?.clientType} />
                <DetailRow label="Email" value={deal.client?.email} />
                <DetailRow label="Phone" value={deal.client?.phone} />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Metadata</Typography>
                <Divider sx={{ mb: 1.5 }} />
                <DetailRow label="Created by" value={deal.createdByEmail} />
                <DetailRow label="Created"    value={new Date(deal.createdAt).toLocaleString()} />
                <DetailRow label="Updated"    value={new Date(deal.updatedAt).toLocaleString()} />
                {deal.decidedAt && (
                  <>
                    <DetailRow label="Decided" value={new Date(deal.decidedAt).toLocaleString()} />
                    <DetailRow label="Notes"   value={deal.decisionNotes} />
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        </Box>

        {/* ── Documents ────────────────────────────────────────────────── */}
        <Card>
          <CardContent>
            <DocumentUploader
              dealId={deal.id}
              canUpload={
                isDealReviewer(user?.role) ||
                (isOwnerAgent && isDraft)
              }
              title="Documents"
            />
          </CardContent>
        </Card>

        {/* ── Audit log (deal reviewers only) ──────────────────────────── */}
        {isDealReviewer(user?.role) && (
          <DealAuditPanel dealId={deal.id} />
        )}

        {/* ── Delete confirm dialog ─────────────────────────────────────── */}
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
    </Box>
  );
}

function DecisionCard({ deal }) {
  const isApproved = deal.status === 'APPROVED';
  const isOverride = (deal.decisionNotes ?? '').startsWith('[OVERRIDE');
  return (
    <Alert severity={isApproved ? 'success' : 'error'} sx={{ alignItems: 'flex-start' }}>
      <Stack spacing={0.5}>
        <Typography variant="subtitle1">
          {isApproved ? 'Approved' : 'Rejected'}{isOverride ? ' (via override)' : ''}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {deal.decidedAt && new Date(deal.decidedAt).toLocaleString()}
          {deal.decidedByUserId && ` · by user #${deal.decidedByUserId}`}
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
  if (!value) return null;
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={{ xs: 0, sm: 1 }}
      sx={{ py: 0.5 }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ minWidth: 110, fontWeight: 600, flexShrink: 0 }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{value}</Typography>
    </Stack>
  );
}
