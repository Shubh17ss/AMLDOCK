import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
  Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip,
  Typography,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import {
  listTrainingCourses, deleteTrainingCourse, fetchCourseFileDownloadUrl,
} from '../../api/training.js';
import { CourseDialog } from './CourseDialog.jsx';
import { formatBytes } from './CourseContentUploader.jsx';
import { CompletionProgress } from '../../components/CompletionProgress.jsx';
import { SearchField, matchesSearch } from '../../components/SearchField.jsx';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { canDelete, canManageTraining, roleLabel } from '../../auth/roles.js';
import { tokens, fonts } from '../../theme/theme.js';

const dateFmt = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const isOverdue = (c) =>
  Boolean(c.dueDate)
  && c.completedCount < c.assignedCount
  && new Date(c.dueDate) < new Date(new Date().toDateString());

const TYPE_LABEL = { SINGLE_CHOICE: 'Single choice', MULTI_CHOICE: 'Multiple choice' };

/** AML Training › Courses — self-paced material plus the questionnaire that proves it was read. */
export function CoursesTab({ createOpen, onCloseCreate }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { firm, branch } = useDashboardScope();
  const [editTarget, setEditTarget] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState('');

  const mayManage = canManageTraining(user?.role);
  const mayDelete = canDelete(user?.role);
  const colCount = 6 + (mayManage ? 1 : 0) + (mayDelete ? 1 : 0);

  const coursesQ = useQuery({
    queryKey: ['trainingCourses', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listTrainingCourses({ firmId: firm?.id, branchId: branch?.id }),
  });
  const all = coursesQ.data ?? [];
  const rows = useMemo(
    () => all.filter((c) => matchesSearch(search, c.name)),
    [all, search],
  );

  // The dialog and the detail view both need the freshest row, not the one captured on click.
  // Resolved against the unfiltered list so an open dialog survives a change to the search.
  const liveRow = (row) => all.find((r) => r.id === row?.id) ?? row;

  const deleteMut = useMutation({
    mutationFn: (c) => deleteTrainingCourse(c.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trainingCourses'] });
      showToast({ severity: 'success', message: 'Course deleted' });
      setToDelete(null);
    },
    onError: (e) => {
      showToast({ severity: 'error', message: e.response?.data?.message || 'Delete failed. Try again.' });
    },
  });

  const download = async (courseId, f) => {
    try {
      const { downloadUrl } = await fetchCourseFileDownloadUrl(courseId, f.id);
      window.open(downloadUrl, '_blank', 'noopener');
    } catch {
      showToast({ severity: 'error', message: 'Could not get a download link. Try again.' });
    }
  };

  const detailRow = detail ? liveRow(detail) : null;

  return (
    <Stack spacing={2}>
      {coursesQ.isError && <Alert severity="error">Failed to load courses. Refresh to try again.</Alert>}

      <SearchField value={search} onChange={setSearch} placeholder="Search courses…" />

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Course</TableCell>
              <TableCell>Due</TableCell>
              <TableCell align="right">Pass mark</TableCell>
              <TableCell align="right">Questions</TableCell>
              <TableCell align="right">Content</TableCell>
              <TableCell>Completed</TableCell>
              {mayManage && <TableCell align="right" />}
              {mayDelete && <TableCell align="right" />}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id} hover onClick={() => setDetail(c)} sx={{ cursor: 'pointer' }}>
                <TableCell sx={{ color: tokens.ink, fontWeight: 600 }}>{c.name}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <span>{dateFmt(c.dueDate)}</span>
                    {isOverdue(c) && (
                      <Chip size="small" label="Overdue" sx={{
                        color: tokens.rejected, backgroundColor: `color-mix(in srgb, ${tokens.rejected} 8%, transparent)`,
                        fontWeight: 700, fontSize: '0.68rem',
                      }} />
                    )}
                  </Stack>
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: fonts.mono, fontSize: '0.78rem', color: tokens.ink }}>
                  {c.passMarkPercent}%
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: fonts.mono, fontSize: '0.78rem', color: tokens.muted }}>
                  {c.questions?.length ?? 0}
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: fonts.mono, fontSize: '0.78rem', color: tokens.muted }}>
                  {c.files?.length ?? 0}
                </TableCell>
                <TableCell>
                  <CompletionProgress done={c.completedCount} total={c.assignedCount} />
                </TableCell>
                {mayManage && (
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', width: 56 }}>
                    <Tooltip title="Edit this course">
                      <IconButton size="small"
                                  onClick={(e) => { e.stopPropagation(); setEditTarget(c); }}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
                {mayDelete && (
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', width: 56 }}>
                    <Tooltip title="Delete this course">
                      <IconButton size="small"
                                  onClick={(e) => { e.stopPropagation(); setToDelete(c); }}>
                        <DeleteOutlineIcon fontSize="small" sx={{ color: tokens.rejected }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!coursesQ.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={colCount} align="center" sx={{ py: 5, color: tokens.muted }}>
                  {search
                    ? `No courses match “${search}”.`
                    : 'No courses yet — create the first one to start the training catalogue.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <CourseDialog mode="create" open={createOpen} onClose={onCloseCreate} />
      <CourseDialog mode="edit" target={liveRow(editTarget)} onClose={() => setEditTarget(null)} />

      {/* Read-only view of everything the course holds. */}
      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} maxWidth="md" fullWidth>
        {detailRow && (
          <>
            <DialogTitle sx={{ pb: 1 }}>{detailRow.name}</DialogTitle>
            <DialogContent>
              <Stack spacing={3} sx={{ mt: 1 }}>
                <Typography sx={{ fontSize: '0.8rem', color: tokens.muted }}>
                  {[
                    detailRow.dueDate ? `Due ${dateFmt(detailRow.dueDate)}` : 'No due date',
                    `Pass mark ${detailRow.passMarkPercent}%`,
                    `${detailRow.completedCount} of ${detailRow.assignedCount} completed`,
                  ].join(' · ')}
                </Typography>

                {detailRow.description && (
                  <Typography sx={{ fontSize: '0.9rem', color: tokens.ink, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {detailRow.description}
                  </Typography>
                )}

                <DetailSection label={`Content — ${detailRow.files?.length ?? 0} file${detailRow.files?.length === 1 ? '' : 's'}`}>
                  {(detailRow.files ?? []).length === 0
                    ? <Muted>No material attached.</Muted>
                    : (
                      <Stack spacing={0.75}>
                        {detailRow.files.map((f) => (
                          <Stack key={f.id} direction="row" spacing={1} alignItems="center">
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ fontSize: '0.85rem', color: tokens.ink }}>
                                {f.originalFilename}
                              </Typography>
                              <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.7rem', color: tokens.muted }}>
                                {formatBytes(f.sizeBytes)}
                              </Typography>
                            </Box>
                            <Tooltip title="Download">
                              <IconButton size="small" onClick={() => download(detailRow.id, f)}>
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        ))}
                      </Stack>
                    )}
                </DetailSection>

                <DetailSection label={`Questionnaire — ${detailRow.questions?.length ?? 0} question${detailRow.questions?.length === 1 ? '' : 's'}`}>
                  {(detailRow.questions ?? []).length === 0
                    ? <Muted>Material only — no questions.</Muted>
                    : (
                      <Stack spacing={2}>
                        {detailRow.questions.map((q, i) => (
                          <Box key={q.id}>
                            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: tokens.ink }}>
                              {i + 1}. {q.prompt}
                            </Typography>
                            <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.65rem', color: tokens.muted, mb: 0.5 }}>
                              {TYPE_LABEL[q.questionType] ?? q.questionType}
                            </Typography>
                            <Stack spacing={0.4}>
                              {q.options.map((o) => (
                                <Stack key={o.id} direction="row" spacing={1} alignItems="center">
                                  {o.correct
                                    ? <CheckCircleIcon sx={{ fontSize: 16, color: tokens.approved }} />
                                    : <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: tokens.muted }} />}
                                  <Typography sx={{
                                    fontSize: '0.85rem',
                                    color: o.correct ? tokens.ink : tokens.muted,
                                    fontWeight: o.correct ? 600 : 400,
                                  }}>
                                    {o.label}
                                  </Typography>
                                </Stack>
                              ))}
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    )}
                </DetailSection>

                <DetailSection label={`Assigned — ${detailRow.completedCount} of ${detailRow.assignedCount} completed`}>
                  {(detailRow.assignees ?? []).length === 0
                    ? <Muted>Nobody is assigned to this course yet.</Muted>
                    : (
                      <Stack spacing={1}>
                        {detailRow.assignees.map((a) => (
                          <Stack key={a.userId} direction="row" spacing={1.25} alignItems="center">
                            {a.completedAt
                              ? <CheckCircleIcon sx={{ fontSize: 18, color: tokens.approved }} />
                              : <RadioButtonUncheckedIcon sx={{ fontSize: 18, color: tokens.muted }} />}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ fontSize: '0.875rem', color: tokens.ink }}>
                                {a.fullName || a.email}
                              </Typography>
                              <Typography sx={{ fontSize: '0.72rem', color: tokens.muted }}>
                                {roleLabel(a.role)}
                              </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                              <Typography sx={{ fontSize: '0.75rem', color: tokens.muted, whiteSpace: 'nowrap' }}>
                                {a.completedAt ? dateFmt(a.completedAt) : 'Not yet'}
                              </Typography>
                              {a.scorePercent != null && (
                                <Typography sx={{
                                  fontFamily: fonts.mono, fontSize: '0.7rem', whiteSpace: 'nowrap',
                                  color: a.passed ? tokens.approved : tokens.rejected,
                                }}>
                                  {a.scorePercent}% · {a.passed ? 'passed' : 'failed'}
                                </Typography>
                              )}
                            </Box>
                          </Stack>
                        ))}
                      </Stack>
                    )}
                </DetailSection>
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
        <DialogTitle>Delete this course?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.9rem', color: tokens.ink }}>
            {toDelete && (
              <>Delete <Box component="span" sx={{ fontWeight: 700 }}>{toDelete.name}</Box>, its{' '}
              {toDelete.files?.length ?? 0} file{(toDelete.files?.length ?? 0) === 1 ? '' : 's'},
              its questionnaire and {toDelete.assignedCount} assignment
              {toDelete.assignedCount === 1 ? '' : 's'}? It can&apos;t be undone.</>
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

function DetailSection({ label, children }) {
  return (
    <Box>
      <Typography sx={{
        fontFamily: fonts.mono, fontSize: '0.68rem', letterSpacing: '0.08em',
        textTransform: 'uppercase', color: tokens.muted, mb: 1,
      }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

const Muted = ({ children }) => (
  <Typography sx={{ fontSize: '0.85rem', color: tokens.muted }}>{children}</Typography>
);
