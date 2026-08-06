import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
  Link, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tooltip, Typography,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import {
  listTrainingSessions, deleteTrainingSession, setSessionAttendeeCompletion,
} from '../../api/training.js';
import { SessionDialog } from './SessionDialog.jsx';
import { CompletionProgress } from '../../components/CompletionProgress.jsx';
import { SearchField, matchesSearch } from '../../components/SearchField.jsx';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { canDelete, canManageTraining, roleLabel } from '../../auth/roles.js';
import { tokens, fonts } from '../../theme/theme.js';

const dateFmt = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// The session has been and gone and somebody on the roster still hasn't marked it off.
const isOverdue = (session) =>
  Boolean(session.sessionDate)
  && session.completedCount < session.assignedCount
  && new Date(session.sessionDate) < new Date(new Date().toDateString());

/** AML Training › Sessions — the branch's training schedule and who has completed what. */
export function SessionsTab({ createOpen, onCloseCreate }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { firm, branch } = useDashboardScope();
  const [editTarget, setEditTarget] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState('');

  // The route already restricts this page to training managers, but gate the row controls on
  // the role too so the table stays correct wherever it gets mounted.
  const mayManage = canManageTraining(user?.role);
  const mayDelete = canDelete(user?.role);
  const colCount = 6 + (mayManage ? 1 : 0) + (mayDelete ? 1 : 0);

  const sessionsQ = useQuery({
    queryKey: ['trainingSessions', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listTrainingSessions({ firmId: firm?.id, branchId: branch?.id }),
  });
  const all = sessionsQ.data ?? [];
  const rows = useMemo(
    () => all.filter((s) => matchesSearch(search, s.name)),
    [all, search],
  );

  // Attendance is recorded here rather than by the attendee — whoever ran the session is the one
  // who knows who turned up. The response is the refreshed session, so the open roster dialog is
  // re-seeded from it instead of holding a stale snapshot until the refetch lands.
  const attendanceMut = useMutation({
    mutationFn: ({ session, userId, completed }) =>
      setSessionAttendeeCompletion(session.id, userId, completed),
    onSuccess: (updated) => {
      setDetail(updated);
      qc.invalidateQueries({ queryKey: ['trainingSessions'] });
      qc.invalidateQueries({ queryKey: ['myTrainingSessions'] });
    },
    onError: (e) => {
      showToast({
        severity: 'error',
        message: e.response?.data?.message || 'Could not record attendance. Try again.',
      });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (s) => deleteTrainingSession(s.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trainingSessions'] });
      showToast({ severity: 'success', message: 'Session deleted' });
      setToDelete(null);
    },
    onError: (e) => {
      showToast({ severity: 'error', message: e.response?.data?.message || 'Delete failed. Try again.' });
    },
  });

  return (
    <Stack spacing={2}>
      {sessionsQ.isError && <Alert severity="error">Failed to load sessions. Refresh to try again.</Alert>}

      <SearchField value={search} onChange={setSearch} placeholder="Search sessions…" />

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Session</TableCell>
              <TableCell>Provider</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Date</TableCell>
              <TableCell align="right">Minutes</TableCell>
              <TableCell>Completed</TableCell>
              {mayManage && <TableCell align="right" />}
              {mayDelete && <TableCell align="right" />}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id} hover onClick={() => setDetail(s)} sx={{ cursor: 'pointer' }}>
                <TableCell sx={{ color: tokens.ink, fontWeight: 600 }}>{s.name}</TableCell>
                <TableCell sx={{ color: tokens.ink }}>{s.providerName || '—'}</TableCell>
                <TableCell sx={{ color: tokens.ink }}>{s.location}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <span>{dateFmt(s.sessionDate)}</span>
                    {isOverdue(s) && (
                      <Chip size="small" label="Overdue" sx={{
                        color: tokens.rejected, backgroundColor: `${tokens.rejected}14`,
                        fontWeight: 700, fontSize: '0.68rem',
                      }} />
                    )}
                  </Stack>
                </TableCell>
                <TableCell align="right"
                           sx={{ fontFamily: fonts.mono, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                  <Box component="span" sx={{ color: tokens.ink }}>{s.totalMinutes}</Box>
                  <Box component="span" sx={{ color: tokens.muted }}> min</Box>
                </TableCell>
                <TableCell>
                  <CompletionProgress done={s.completedCount} total={s.assignedCount} />
                </TableCell>
                {mayManage && (
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', width: 56 }}>
                    <Tooltip title="Edit this session">
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); setEditTarget(s); }}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
                {mayDelete && (
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', width: 56 }}>
                    <Tooltip title="Delete this session">
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); setToDelete(s); }}
                      >
                        <DeleteOutlineIcon fontSize="small" sx={{ color: tokens.rejected }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!sessionsQ.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={colCount} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  {search
                    ? `No sessions match “${search}”.`
                    : 'No sessions yet — create the first one to start the training record.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <SessionDialog mode="create" open={createOpen} onClose={onCloseCreate} />
      <SessionDialog mode="edit" target={editTarget} onClose={() => setEditTarget(null)} />

      {/* Roster — who is assigned and who has completed. */}
      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} maxWidth="sm" fullWidth>
        {detail && (
          <>
            <DialogTitle sx={{ pb: 1 }}>{detail.name}</DialogTitle>
            <DialogContent>
              <Stack spacing={2.5} sx={{ mt: 1 }}>
                <Typography sx={{ fontSize: '0.8rem', color: tokens.muted }}>
                  {[
                    detail.providerName,
                    detail.location,
                    dateFmt(detail.sessionDate),
                    `${detail.totalMinutes} min`,
                  ].filter(Boolean).join(' · ')}
                </Typography>

                {detail.description && (
                  <Typography sx={{
                    fontSize: '0.875rem', color: tokens.ink, whiteSpace: 'pre-wrap',
                  }}>
                    {detail.description}
                  </Typography>
                )}

                {detail.url && (
                  <Link href={detail.url} target="_blank" rel="noopener"
                        sx={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>
                    {detail.url}
                  </Link>
                )}

                <Box>
                  <Typography sx={{
                    fontFamily: fonts.mono, fontSize: '0.68rem', letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: tokens.muted, mb: 1,
                  }}>
                    Assigned — {detail.completedCount} of {detail.assignedCount} attended
                  </Typography>
                  {mayManage && (
                    <Typography sx={{ fontSize: '0.75rem', color: tokens.muted, mb: 1 }}>
                      Tick someone off once they&apos;ve attended. Staff can see their own status
                      but can&apos;t set it.
                    </Typography>
                  )}
                  <Stack spacing={1}>
                    {detail.attendees.map((a) => {
                      const done = Boolean(a.completedAt);
                      const icon = done
                        ? <CheckCircleIcon sx={{ fontSize: 18, color: tokens.approved }} />
                        : <RadioButtonUncheckedIcon sx={{ fontSize: 18, color: tokens.muted }} />;
                      return (
                        <Stack key={a.userId} direction="row" spacing={1.25} alignItems="center">
                          {mayManage ? (
                            <Tooltip title={done ? 'Clear attendance' : 'Mark as attended'}>
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={attendanceMut.isPending}
                                  onClick={() => attendanceMut.mutate({
                                    session: detail, userId: a.userId, completed: !done,
                                  })}
                                >
                                  {icon}
                                </IconButton>
                              </span>
                            </Tooltip>
                          ) : icon}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.875rem', color: tokens.ink }}>
                              {a.fullName || a.email}
                            </Typography>
                            <Typography sx={{ fontSize: '0.72rem', color: tokens.muted }}>
                              {roleLabel(a.role)}
                            </Typography>
                          </Box>
                          <Typography sx={{ fontSize: '0.75rem', color: tokens.muted, whiteSpace: 'nowrap' }}>
                            {done ? dateFmt(a.completedAt) : 'Not yet'}
                          </Typography>
                        </Stack>
                      );
                    })}
                    {detail.attendees.length === 0 && (
                      <Typography sx={{ fontSize: '0.85rem', color: tokens.muted }}>
                        Nobody is assigned to this session yet.
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetail(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog open={Boolean(toDelete)} onClose={() => !deleteMut.isPending && setToDelete(null)}
              maxWidth="xs" fullWidth>
        <DialogTitle>Delete this session?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.9rem', color: tokens.ink }}>
            {toDelete && (
              <>Delete <Box component="span" sx={{ fontWeight: 700 }}>{toDelete.name}</Box> and its{' '}
              {toDelete.assignedCount} assignment{toDelete.assignedCount === 1 ? '' : 's'}? Completion
              records for this session go with it. It can&apos;t be undone.</>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)} disabled={deleteMut.isPending}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            startIcon={<DeleteOutlineIcon />}
            disabled={deleteMut.isPending}
            onClick={() => deleteMut.mutate(toDelete)}
          >
            {deleteMut.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
