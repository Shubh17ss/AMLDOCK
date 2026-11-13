import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle, Divider, Stack, Typography,
} from '@mui/material';
import {
  activateFirm, deactivateFirm, deleteFirm, getFirmDeletionPreview,
} from '../../api/firms.js';
import { TypeToConfirmDialog } from '../../components/TypeToConfirmDialog.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { tokens } from '../../theme/theme.js';

// Shades of the theme's red, mixed rather than hard-coded so they follow light and dark mode:
// deeper for the entity's name, the base red for the heading, softer for the explanation.
const RED_DEEP = 'color-mix(in srgb, var(--cl-rejected) 78%, var(--cl-ink))';
const RED_SOFT = 'color-mix(in srgb, var(--cl-rejected) 72%, transparent)';

const RED_BUTTON = {
  flexShrink: 0,
  px: 2.5,
  fontWeight: 700,
  color: tokens.rejected,
  backgroundColor: 'var(--cl-err-wash)',
  '&:hover': { backgroundColor: 'var(--cl-err-wash)', filter: 'brightness(0.96)' },
};

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * The boxed off-boarding section at the foot of ROOT's reporting entity page, naming the entity it
 * acts on: deactivate (or reactivate) it, and delete it. Delete is offered either way — the
 * server's preview decides whether the retention hold allows it yet.
 */
export function FirmDeactivateCard({ firm }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <Card variant="outlined" sx={{ borderColor: tokens.rejected, borderStyle: 'solid' }}>
      <CardContent>
        <Row
          heading={firm.active ? 'Deactivate reporting entity' : 'Reactivate reporting entity'}
          name={firm.name}
          text={firm.active
            ? ' — deactivating signs out its branch staff and leaves its records read-only.'
            : ` — deactivated since ${formatDate(firm.deactivatedAt)}. Reactivating reopens the branches it closed.`}
          action={firm.active ? 'Deactivate' : 'Reactivate'}
          onClick={() => setStatusOpen(true)}
        />
        <Divider sx={{ my: 2, borderColor: 'var(--cl-err-wash)' }} />
        <Row
          heading="Delete reporting entity"
          name={firm.name}
          text=" — permanently deletes every branch, deal, document and user that belongs only to it."
          action="Delete"
          onClick={() => setDeleteOpen(true)}
        />
      </CardContent>
      <FirmStatusDialog firm={firm} open={statusOpen} onClose={() => setStatusOpen(false)} />
      <DeleteFirmDialog firm={firm} open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </Card>
  );
}

function Row({ heading, name, text, action, onClick }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      justifyContent="space-between"
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.rejected }}>
          {heading}
        </Typography>
        <Typography variant="body2" sx={{ color: RED_SOFT, mt: 0.5, overflowWrap: 'anywhere' }}>
          <Box component="span" sx={{ fontWeight: 700, color: RED_DEEP }}>{name}</Box>
          {text}
        </Typography>
      </Box>
      <Button disableElevation sx={RED_BUTTON} onClick={onClick}>{action}</Button>
    </Stack>
  );
}

/** Confirms deactivating or reactivating, saying what each does to the people in the entity. */
function FirmStatusDialog({ firm, open, onClose }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [error, setError] = useState(null);
  const deactivating = firm.active;

  useEffect(() => { if (open) setError(null); }, [open]);

  const mut = useMutation({
    mutationFn: () => (deactivating ? deactivateFirm(firm.publicId) : activateFirm(firm.publicId)),
    onSuccess: (data) => {
      qc.setQueryData(['firm', firm.publicId], data);
      qc.invalidateQueries({ queryKey: ['firms'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      showToast({ severity: 'success', message: `${firm.name} ${deactivating ? 'deactivated' : 'reactivated'}` });
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'That didn’t go through. Try again.'),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{deactivating ? `Deactivate ${firm.name}?` : `Reactivate ${firm.name}?`}</DialogTitle>
      <DialogContent>
        {deactivating ? (
          <Stack spacing={1.5}>
            <DialogContentText>
              Every branch is deactivated. Everyone who works in a branch is signed out and can no
              longer sign in.
            </DialogContentText>
            <DialogContentText>
              Compliance officers and senior managers keep read-only access. Nothing can be changed
              or deleted — not even by a platform administrator — until the retention period
              has passed ({firm.country === 'AU' ? '7 years' : '5 years'}).
            </DialogContentText>
            <DialogContentText>You can reactivate it later.</DialogContentText>
          </Stack>
        ) : (
          <DialogContentText>
            The entity and the branches its deactivation closed become editable again, and their
            staff can sign in again. A branch that was deactivated on its own beforehand stays
            deactivated.
          </DialogContentText>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color={deactivating ? 'warning' : 'primary'}
                disabled={mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? 'Working…' : (deactivating ? 'Deactivate' : 'Reactivate')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DeleteFirmDialog({ firm, open, onClose }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [error, setError] = useState(null);

  const previewQ = useQuery({
    queryKey: ['firms', firm.publicId, 'deletion-preview'],
    queryFn: () => getFirmDeletionPreview(firm.publicId),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => { if (open) setError(null); }, [open]);

  const mut = useMutation({
    mutationFn: (typed) => deleteFirm(firm.publicId, typed),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['firm', firm.publicId] });
      qc.invalidateQueries({ queryKey: ['firms'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      showToast({ severity: 'success', message: `${firm.name} deleted` });
      navigate('/settings/reporting-entities', { replace: true });
    },
    onError: (err) => setError(err.response?.data?.message || 'That didn’t go through. Try again.'),
  });

  const p = previewQ.data;
  const summary = p && (
    <Box component="ul" sx={{ m: 0, pl: 2.5, color: tokens.muted }}>
      <li>{p.branches} branch(es), {p.deals} deal(s) and {p.documents} document(s)</li>
      <li>{p.usersDeleted} user account(s) that belong only to this reporting entity</li>
      {p.usersKept > 0 && (
        <li>{p.usersKept} user(s) who also belong to another reporting entity lose access here only</li>
      )}
      <li>Its compliance, fund transaction, suspicious activity and training records</li>
    </Box>
  );

  return (
    <TypeToConfirmDialog
      open={open}
      title={`Delete ${firm.name}?`}
      name={firm.name}
      kind="reporting entity"
      preview={p}
      loading={previewQ.isLoading}
      loadError={previewQ.isError
        ? (previewQ.error?.response?.data?.message || 'Couldn’t check this reporting entity.') : null}
      summary={summary}
      error={error}
      pending={mut.isPending}
      onConfirm={(typed) => mut.mutate(typed)}
      onClose={onClose}
    />
  );
}
