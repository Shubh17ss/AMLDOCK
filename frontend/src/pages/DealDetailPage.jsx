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
import { RiskRatingChip } from '../components/RiskRatingChip.jsx';
import { propertyTypeLabel, reasonForSellingLabel } from '../data/propertyTypes.js';
import { countryName } from '../data/countries.js';
import { DocumentUploader } from '../components/DocumentUploader.jsx';
import { BrokerNotesCard } from '../features/deal/BrokerNotesCard.jsx';
import { OverrideDialog } from '../features/deal/DecisionDialogs.jsx';
import { DealAuditPanel } from '../features/deal/DealAuditPanel.jsx';
import { useCurrency } from '../dashboard/useCurrency.js';
import { tokens } from '../theme/theme.js';

export function DealDetailPage() {
  const { id } = useParams();
  const dealId = Number(id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const money = useCurrency();
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
                <RiskRatingChip rating={deal.riskRating} />
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
            <Card sx={{ height: '100%', minHeight: 200, overflow: 'auto' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Firm & branch</Typography>
                <Divider sx={{ mb: 1.5 }} />
                <DetailRow label="Reporting entity" value={deal.firmName} />
                <DetailRow label="Branch"  value={deal.branchName} />
                <DetailRow label="Value"   value={hasValue(deal) ? money.dealRange(deal) : null} />
                <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 700 }}>Point of contact</Typography>
                <DetailRow label="Name"    value={deal.pocName} />
                <DetailRow label="Role"    value={deal.pocRole} />
                <DetailRow label="Phone"   value={deal.pocPhone} />
                <DetailRow label="Email"   value={deal.pocEmail} />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%', minHeight: 200, overflow: 'auto' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Property</Typography>
                <Divider sx={{ mb: 1.5 }} />
                <DetailRow label="Type"          value={deal.property?.propertyType ? propertyTypeLabel(deal.property.propertyType) : null} />
                <DetailRow label="Reason"        value={deal.property?.reasonForSelling
                  ? reasonForSellingLabel(deal.property?.propertyType, deal.property.reasonForSelling)
                  : null} />
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
            <Card sx={{ height: '100%', minHeight: 200, overflow: 'auto' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Client</Typography>
                <Divider sx={{ mb: 1.5 }} />
                <DetailRow label="Name"  value={deal.client?.displayName} />
                {/* Set during the ownership-structure review, not at creation — the broker
                    scans IDs of natural persons and can't be asked to classify the entity. */}
                <DetailRow label="Type"  value={deal.client?.clientType ?? 'Pending review'} />
                <DetailRow label="Email" value={deal.client?.email} />
                <DetailRow label="Phone" value={deal.client?.phone} />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%', minHeight: 200, overflow: 'auto' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Risk & valuation</Typography>
                <Divider sx={{ mb: 1.5 }} />
                <DetailRow label="Risk rating" value={deal.riskRating
                  ? `${deal.riskRating}${deal.riskRatingSource === 'OVERRIDE' ? ' (set by compliance)' : ''}`
                  : 'Not assessed'} />
                <DetailRow label="Red flag"    value={yesNo(deal.redFlagPresent)} />
                <DetailRow label="Min value"   value={deal.valuationMin != null ? money.formatWithCode(deal.valuationMin) : null} />
                <DetailRow label="Max value"   value={deal.valuationMax != null ? money.formatWithCode(deal.valuationMax) : null} />
                {/* Pre-V28 deals answered none of these, so the whole block goes rather than
                    leaving a heading with nothing under it. */}
                {hasTransactionContext(deal) && (
                  <>
                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5, fontWeight: 700 }}>Transaction</Typography>
                    <DetailRow label="Purpose"     value={deal.transactionPurpose} />
                    <DetailRow label="Trust in ownership" value={yesNo(deal.trustInvolved)} />
                    <DetailRow label="On-sold quickly"    value={yesNo(deal.onSoldQuickly)} />
                    <DetailRow label="Foreign exposure"   value={
                      deal.foreignExposureCountry === 'NONE' ? 'None'
                        : deal.foreignExposureCountry ? countryName(deal.foreignExposureCountry)
                          : null} />
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%', minHeight: 200, overflow: 'auto' }}>
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
              hideVoiceNotes
              scrollTable
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
        <Typography variant="caption" sx={{ color: tokens.muted }}>
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

/**
 * Booleans have to reach DetailRow as strings: it hides falsy values, so a raw `false` would
 * silently drop the row and read as "never asked" — the opposite of what a "No" answer means.
 */
function yesNo(v) {
  if (v == null) return null;
  return v ? 'Yes' : 'No';
}

const hasValue = (d) =>
  d.valuationMin != null || d.valuationMax != null || d.transactionValue != null;

const hasTransactionContext = (d) =>
  Boolean(d.transactionPurpose) || d.trustInvolved != null || d.onSoldQuickly != null
  || Boolean(d.foreignExposureCountry);

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
        sx={{ color: tokens.muted, minWidth: 110, fontWeight: 600, flexShrink: 0 }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{value}</Typography>
    </Stack>
  );
}
