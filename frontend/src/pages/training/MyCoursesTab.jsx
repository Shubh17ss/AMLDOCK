import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, IconButton, Paper, Stack, Tooltip, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutlined';
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import QuizIcon from '@mui/icons-material/QuizOutlined';
import DoneIcon from '@mui/icons-material/DoneRounded';
import EventIcon from '@mui/icons-material/EventOutlined';
import BusinessIcon from '@mui/icons-material/BusinessOutlined';
import { fetchCourseFileDownloadUrl, submitCourseAttempt } from '../../api/training.js';
import { CoursePlayerDialog } from './CoursePlayerDialog.jsx';
import { formatBytes } from './CourseContentUploader.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { tokens, fonts } from '../../theme/theme.js';

const dateFmt = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

const isOverdue = (c) =>
  Boolean(c.dueDate) && c.myPassed !== true
  && new Date(c.dueDate) < new Date(new Date().toDateString());

/** One line of course metadata with a leading glyph — the same shape as MySessionsTab's. */
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
 * My Training › Courses — self-paced material plus the assessment.
 *
 * A course is Done once the user has passed; anything else reads "Complete assessment", whether
 * they failed or never sat it. Marking happens server-side: the option `correct` flags arrive
 * null here, by design.
 */
export function MyCoursesTab({ courses, isLoading, isError }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [playing, setPlaying] = useState(null);

  // A course with no questions has nothing to mark — reading the material is the completion,
  // so it gets the same self-declared button sessions use.
  const markDoneMut = useMutation({
    mutationFn: (c) => submitCourseAttempt(c.id, []),
    onSuccess: () => {
      // Both keys: this page's own list, and the manager catalogue behind it.
      qc.invalidateQueries({ queryKey: ['myTrainingCourses'] });
      qc.invalidateQueries({ queryKey: ['trainingCourses'] });
      showToast({ severity: 'success', message: 'Course marked done' });
    },
    onError: (e) => {
      showToast({ severity: 'error', message: e.response?.data?.message || 'Could not save. Try again.' });
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

  return (
    <Stack spacing={2}>
      {isError && <Alert severity="error">Failed to load your courses. Refresh to try again.</Alert>}

      {courses.map((c) => {
        const done = c.myPassed === true;
        const overdue = isOverdue(c);
        const attempted = c.myAttemptCount > 0;
        const hasQuestions = (c.questions?.length ?? 0) > 0;

        return (
          <Paper
            key={c.id}
            sx={{
              p: 2.5,
              borderLeft: `3px solid ${done ? tokens.approved : (overdue ? tokens.rejected : tokens.blue)}`,
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              alignItems={{ xs: 'stretch', sm: 'flex-start' }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: tokens.ink }}>
                    {c.name}
                  </Typography>
                  <Chip
                    size="small"
                    label={done ? 'Done' : 'Complete assessment'}
                    icon={done
                      ? <CheckCircleIcon sx={{ fontSize: 14, color: `${tokens.approved} !important` }} />
                      : undefined}
                    sx={{
                      color: done ? tokens.approved : tokens.review,
                      backgroundColor: `${done ? tokens.approved : tokens.review}14`,
                      fontWeight: 700, fontSize: '0.68rem',
                    }}
                  />
                  {overdue && (
                    <Chip size="small" label="Overdue" sx={{
                      color: tokens.rejected, backgroundColor: `${tokens.rejected}14`,
                      fontWeight: 700, fontSize: '0.68rem',
                    }} />
                  )}
                </Stack>

                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                  <Meta icon={<EventIcon />}>
                    {c.dueDate ? `Due ${dateFmt(c.dueDate)}` : null}
                  </Meta>
                  <Meta icon={<BusinessIcon />}>{c.branchName}</Meta>
                </Stack>

                {c.description && (
                  <Typography sx={{
                    fontSize: '0.875rem', color: tokens.ink, mt: 1,
                    whiteSpace: 'pre-wrap', lineHeight: 1.6,
                  }}>
                    {c.description}
                  </Typography>
                )}

                {(c.files?.length ?? 0) > 0 && (
                  <Box sx={{ mt: 1.5 }}>
                    <Typography sx={{
                      fontFamily: fonts.mono, fontSize: '0.65rem', letterSpacing: '0.1em',
                      textTransform: 'uppercase', color: tokens.muted, mb: 0.75,
                    }}>
                      Course material
                    </Typography>
                    <Stack spacing={0.5}>
                      {c.files.map((f) => (
                        <Stack key={f.id} direction="row" spacing={1} alignItems="center">
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{
                              fontSize: '0.85rem', color: tokens.ink,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {f.originalFilename}
                            </Typography>
                            <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.7rem', color: tokens.muted }}>
                              {formatBytes(f.sizeBytes)}
                            </Typography>
                          </Box>
                          <Tooltip title="Download">
                            <IconButton size="small" onClick={() => download(c.id, f)}>
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                )}

                <Typography sx={{
                  fontFamily: fonts.mono, fontSize: '0.72rem', color: tokens.muted, mt: 1.5,
                }}>
                  {attempted
                    ? `Last score ${c.myScorePercent}% · pass mark ${c.passMarkPercent}% · `
                      + `${c.myAttemptCount} attempt${c.myAttemptCount === 1 ? '' : 's'}`
                    : `${c.questions?.length ?? 0} question${(c.questions?.length ?? 0) === 1 ? '' : 's'} · `
                      + `pass mark ${c.passMarkPercent}%`}
                </Typography>
              </Box>

              <Box sx={{ flexShrink: 0 }}>
                {done ? (
                  <Chip
                    icon={<CheckCircleIcon sx={{ fontSize: 16, color: `${tokens.approved} !important` }} />}
                    label={`Passed ${dateFmt(c.myCompletedAt)}`}
                    sx={{
                      color: tokens.approved, backgroundColor: `${tokens.approved}14`,
                      fontWeight: 600, fontSize: '0.75rem',
                    }}
                  />
                ) : hasQuestions ? (
                  <Button variant="contained" startIcon={<QuizIcon />} onClick={() => setPlaying(c)}>
                    {attempted ? 'Retake the test' : 'Take the test'}
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    startIcon={<DoneIcon />}
                    disabled={markDoneMut.isPending}
                    onClick={() => markDoneMut.mutate(c)}
                  >
                    Mark as done
                  </Button>
                )}
              </Box>
            </Stack>
          </Paper>
        );
      })}

      {!isLoading && courses.length === 0 && (
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: tokens.ink }}>
            No courses assigned
          </Typography>
          <Typography sx={{ fontSize: '0.875rem', color: tokens.muted, mt: 0.5 }}>
            Courses assigned to you by your compliance team will appear here.
          </Typography>
        </Paper>
      )}

      <CoursePlayerDialog course={playing} onClose={() => setPlaying(null)} />
    </Stack>
  );
}
