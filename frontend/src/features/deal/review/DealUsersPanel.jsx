import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Avatar, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, ListItemText, MenuItem, Stack, Tooltip, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import {
  addDealUsers, listDealUserCandidates, listDealUsers, removeDealUser,
} from '../../../api/dealUsers.js';
import { roleLabel } from '../../../auth/roles.js';
import { useToast } from '../../../components/ToastProvider.jsx';
import { tokens, fonts, motion } from '../../../theme/theme.js';

/** Two letters from a name, for the row's disc. */
const initials = (name) => String(name ?? '?')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

/**
 * Who can open this deal.
 *
 * <p>Agents see only the deals they created — the right default, and a dead end the moment two of
 * them work one file. This panel is the exception: the author is here by authorship and cannot be
 * removed, and everyone below them was let in and can be taken out again.
 *
 * <p>Branch managers and firm compliance are deliberately absent. They reach every deal in their
 * scope, so listing them would turn a short, actionable list into a roster of the office that says
 * nothing specific to this deal — and imply their access could be revoked here, which it cannot.
 * The caption says so instead.
 */
export function DealUsersPanel({ dealId, readOnly = false }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState(null);

  const usersQ = useQuery({
    queryKey: ['dealUsers', dealId],
    queryFn: () => listDealUsers(dealId),
    enabled: Boolean(dealId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['dealUsers', dealId] });
    // The candidate list is this list's complement, so it is stale the moment this one changes.
    qc.invalidateQueries({ queryKey: ['dealUserCandidates', dealId] });
  };

  const removeMut = useMutation({
    mutationFn: (userId) => removeDealUser(dealId, userId),
    onSuccess: () => { setError(null); invalidate(); showToast({ severity: 'success', message: 'Access removed' }); },
    onError: (e) => setError(e.response?.data?.message || 'Could not remove access'),
  });

  const rows = usersQ.data ?? [];

  return (
    <Stack spacing={1.5}>
      <Typography variant="caption" sx={{ color: tokens.muted }}>
        Agents who can open this deal. Their sales manager and the firm’s compliance officers reach
        every deal in scope and are not listed here.
      </Typography>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1">Who can open this deal</Typography>
        {!readOnly && (
          <Button size="small" variant="contained" startIcon={<PersonAddAltIcon />}
                  onClick={() => setPickerOpen(true)}>
            Add
          </Button>
        )}
      </Stack>

      {usersQ.isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} /></Box>
      )}
      {usersQ.isError && <Alert severity="error">Could not load who can see this deal.</Alert>}

      <Box sx={{ border: `1px solid ${tokens.hairline}`, borderRadius: 2, overflow: 'hidden' }}>
        {rows.map((u, i) => (
          <Stack
            key={u.userId}
            direction="row"
            spacing={1.25}
            alignItems="center"
            sx={{ px: 1.5, py: 1.25, borderTop: i === 0 ? 'none' : `1px solid ${tokens.hairline}` }}
          >
            <Avatar sx={{ width: 30, height: 30, fontSize: '0.72rem', bgcolor: tokens.blueWash, color: tokens.blue }}>
              {initials(u.fullName)}
            </Avatar>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography variant="body2" sx={{ color: tokens.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.fullName}
              </Typography>
              <Typography variant="caption" sx={{ color: tokens.muted, fontFamily: fonts.mono, fontSize: '0.68rem' }}>
                {u.email}
              </Typography>
            </Box>
            <Chip size="small" variant="outlined" label={roleLabel(u.role)} sx={{ fontSize: '0.66rem', flexShrink: 0 }} />
            {u.creator ? (
              // Not a grant, so there is nothing to revoke — said out loud rather than shown as a
              // disabled × the reader has to hover to understand.
              <Chip size="small" label="creator" sx={{ fontSize: '0.66rem', flexShrink: 0 }} />
            ) : (!readOnly && (
              <Tooltip title={`Remove ${u.fullName}'s access`}>
                <IconButton size="small" onClick={() => removeMut.mutate(u.userId)}
                            disabled={removeMut.isPending}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ))}
          </Stack>
        ))}
        {!usersQ.isLoading && rows.length === 0 && (
          <Typography variant="body2" sx={{ color: tokens.muted, py: 3, textAlign: 'center' }}>
            Nobody yet.
          </Typography>
        )}
      </Box>

      <AddUsersDialog
        open={pickerOpen}
        dealId={dealId}
        onClose={() => setPickerOpen(false)}
        onAdded={(n) => {
          invalidate();
          showToast({ severity: 'success', message: `Added ${n} ${n === 1 ? 'person' : 'people'}` });
        }}
      />
    </Stack>
  );
}

/**
 * The branch's other agents, as a multi-select.
 *
 * <p>Fetched only while open: the candidate list is the complement of the panel above it, so it
 * goes stale on every add, and a query that runs behind a closed dialog would be answering a
 * question nobody has asked yet.
 */
function AddUsersDialog({ open, dealId, onClose, onAdded }) {
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState(null);

  const candidatesQ = useQuery({
    queryKey: ['dealUserCandidates', dealId],
    queryFn: () => listDealUserCandidates(dealId),
    enabled: open && Boolean(dealId),
  });

  const addMut = useMutation({
    mutationFn: () => addDealUsers(dealId, selected),
    onSuccess: () => {
      const n = selected.length;
      setSelected([]);
      setError(null);
      onClose();
      onAdded(n);
    },
    onError: (e) => setError(e.response?.data?.message || 'Could not add them to this deal'),
  });

  const toggle = (id) => setSelected((prev) =>
    (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const candidates = candidatesQ.data ?? [];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Add people to this deal</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {error && <Alert severity="error" sx={{ m: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        {candidatesQ.isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={22} /></Box>
        )}
        {candidatesQ.isError && <Alert severity="error" sx={{ m: 2 }}>Could not load this branch’s agents.</Alert>}

        {!candidatesQ.isLoading && candidates.length === 0 && (
          <Typography variant="body2" sx={{ color: tokens.muted, p: 3, textAlign: 'center' }}>
            Everyone in this branch who could be added already has access.
          </Typography>
        )}

        {candidates.map((u) => (
          <MenuItem key={u.userId} onClick={() => toggle(u.userId)} sx={motion.respectful({ py: 1 })}>
            <Checkbox size="small" checked={selected.includes(u.userId)} />
            <ListItemText
              primary={u.fullName}
              secondary={`${u.email} · ${roleLabel(u.role)}`}
              secondaryTypographyProps={{ sx: { fontSize: '0.72rem' } }}
            />
          </MenuItem>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={selected.length === 0 || addMut.isPending}
                onClick={() => addMut.mutate()}>
          {addMut.isPending ? 'Adding…' : `Add ${selected.length || ''}`.trim()}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
