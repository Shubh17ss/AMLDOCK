import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, Link, Paper, Stack, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutlined';
import DoneIcon from '@mui/icons-material/DoneRounded';
import PlaceIcon from '@mui/icons-material/PlaceOutlined';
import EventIcon from '@mui/icons-material/EventOutlined';
import SchoolIcon from '@mui/icons-material/SchoolOutlined';
import { listTrainingSessions, completeTrainingSession } from '../../api/training.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ScopeGate } from '../../dashboard/ScopeGate.jsx';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { tokens, fonts } from '../../theme/theme.js';

const dateFmt = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

const isOverdue = (s) =>
  Boolean(s.dueDate) && !s.myCompletedAt && new Date(s.dueDate) < new Date(new Date().toDateString());

/** One line of session metadata with a leading glyph. */
function Meta({ icon, children }) {
  if (!children) return null;
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box sx={{ display: 'inline-flex', color: tokens.muted, '& svg': { fontSize: 16 } }}>{icon}</Box>
      <Typography sx={{ fontSize: '0.82rem', color: tokens.muted }}>{children}</Typography>
    </Stack>
  );
}

/**
 * My Training — the personal view for branch staff. The sessions endpoint is role-aware, so
 * this only ever receives the sessions the signed-in user is assigned to.
 */
export function MyTrainingPage() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { firm, branch } = useDashboardScope();

  const sessionsQ = useQuery({
    queryKey: ['trainingSessions', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listTrainingSessions({ firmId: firm?.id, branchId: branch?.id }),
  });
  const rows = sessionsQ.data ?? [];
  const outstanding = rows.filter((s) => !s.myCompletedAt).length;

  const completeMut = useMutation({
    mutationFn: (s) => completeTrainingSession(s.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trainingSessions'] });
      showToast({ severity: 'success', message: 'Training marked complete' });
    },
    onError: (e) => {
      showToast({ severity: 'error', message: e.response?.data?.message || 'Could not save. Try again.' });
    },
  });

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow={[
          rows.length === 0
            ? 'Nothing assigned'
            : `${outstanding} outstanding of ${rows.length}`,
          branch?.name,
        ].filter(Boolean).join(' · ')}
        title="My Training"
      />

      <ScopeGate what="Training">
        <Stack spacing={2}>
          {sessionsQ.isError && (
            <Alert severity="error">Failed to load your training. Refresh to try again.</Alert>
          )}

          {rows.map((s) => {
            const done = Boolean(s.myCompletedAt);
            const overdue = isOverdue(s);
            return (
              <Paper
                key={s.id}
                sx={{
                  p: 2.5,
                  borderLeft: `3px solid ${done ? tokens.approved : (overdue ? tokens.rejected : tokens.blue)}`,
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: tokens.ink }}>
                        {s.name}
                      </Typography>
                      {overdue && (
                        <Chip size="small" label="Overdue" sx={{
                          color: tokens.rejected, backgroundColor: `${tokens.rejected}14`,
                          fontWeight: 700, fontSize: '0.68rem',
                        }} />
                      )}
                    </Stack>

                    <Stack
                      direction="row"
                      spacing={2}
                      flexWrap="wrap"
                      useFlexGap
                      sx={{ mt: 1 }}
                    >
                      <Meta icon={<SchoolIcon />}>{s.providerName}</Meta>
                      <Meta icon={<PlaceIcon />}>{s.location}</Meta>
                      <Meta icon={<EventIcon />}>
                        {s.dueDate ? `Due ${dateFmt(s.dueDate)}` : null}
                      </Meta>
                    </Stack>

                    <Typography sx={{
                      fontFamily: fonts.mono, fontSize: '0.75rem', color: tokens.muted, mt: 1,
                    }}>
                      {s.totalMinutes} min · {s.certifiedMinutes} certified
                    </Typography>

                    {s.url && (
                      <Link href={s.url} target="_blank" rel="noopener"
                            sx={{ fontSize: '0.82rem', mt: 1, display: 'inline-block', wordBreak: 'break-all' }}>
                        Open course link
                      </Link>
                    )}
                  </Box>

                  <Box sx={{ flexShrink: 0 }}>
                    {done ? (
                      <Chip
                        icon={<CheckCircleIcon sx={{ fontSize: 16, color: `${tokens.approved} !important` }} />}
                        label={`Completed ${dateFmt(s.myCompletedAt)}`}
                        sx={{
                          color: tokens.approved, backgroundColor: `${tokens.approved}14`,
                          fontWeight: 600, fontSize: '0.75rem',
                        }}
                      />
                    ) : (
                      <Button
                        variant="contained"
                        startIcon={<DoneIcon />}
                        disabled={completeMut.isPending}
                        onClick={() => completeMut.mutate(s)}
                      >
                        Mark complete
                      </Button>
                    )}
                  </Box>
                </Stack>
              </Paper>
            );
          })}

          {!sessionsQ.isLoading && rows.length === 0 && (
            <Paper sx={{ p: 5, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: tokens.ink }}>
                No training assigned
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', color: tokens.muted, mt: 0.5 }}>
                Sessions assigned to you by your compliance team will appear here.
              </Typography>
            </Paper>
          )}
        </Stack>
      </ScopeGate>
    </Stack>
  );
}
