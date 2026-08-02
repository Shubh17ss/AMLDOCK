import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, LinearProgress, Radio, RadioGroup, Slide, Stack, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircleRounded';
import CancelIcon from '@mui/icons-material/CancelRounded';
import { submitCourseAttempt } from '../../api/training.js';
import { tokens, fonts } from '../../theme/theme.js';

/**
 * Sit a course assessment, one question per slide.
 *
 * The options arrive with their `correct` flag nulled out — the answer key never reaches the
 * browser — so submitting posts the picked ids and the server returns the mark.
 */
export function CoursePlayerDialog({ course, onClose }) {
  const qc = useQueryClient();
  const open = Boolean(course);
  const questions = course?.questions ?? [];

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState('next');
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const slideRef = useRef(null);

  // Start clean each time the dialog opens on a course.
  useEffect(() => {
    if (open) {
      setIndex(0);
      setDirection('next');
      setAnswers({});
      setResult(null);
      setError(null);
    }
  }, [open, course?.id]);

  const mut = useMutation({
    mutationFn: () => submitCourseAttempt(course.id, questions.map((q) => ({
      questionId: q.id,
      selectedOptionIds: answers[q.id] ?? [],
    }))),
    onSuccess: (data) => setResult(data),
    onError: (e) => setError(e.response?.data?.message || 'Could not submit. Try again.'),
  });

  const finish = () => {
    // Only refresh the list once we're done — mid-quiz the card behind shouldn't move.
    if (result) qc.invalidateQueries({ queryKey: ['trainingCourses'] });
    onClose();
  };

  if (!open) return null;

  const question = questions[index];
  const picked = answers[question?.id] ?? [];
  const single = question?.questionType === 'SINGLE_CHOICE';
  const last = index === questions.length - 1;
  // Scoring a skipped question as wrong without saying so would be a trap, so an answer is
  // required before moving on.
  const canAdvance = picked.length > 0;

  const setPicked = (optionId, checked) => setAnswers((a) => ({
    ...a,
    [question.id]: single
      ? [optionId]
      : (checked
        ? [...(a[question.id] ?? []), optionId]
        : (a[question.id] ?? []).filter((id) => id !== optionId)),
  }));

  const go = (delta) => {
    setDirection(delta > 0 ? 'next' : 'prev');
    setIndex((i) => i + delta);
  };

  return (
    <Dialog
      open={open}
      // Backdrop and escape are ignored while the quiz is running so a stray click can't
      // discard answers; the Exit button is always there.
      onClose={() => { if (result) finish(); }}
      maxWidth="sm"
      fullWidth
    >
      {result ? (
        <>
          <DialogTitle sx={{ pb: 1 }}>Assessment complete</DialogTitle>
          <DialogContent>
            <Stack spacing={2} alignItems="center" sx={{ py: 3, textAlign: 'center' }}>
              {result.passed
                ? <CheckCircleIcon sx={{ fontSize: 56, color: tokens.approved }} />
                : <CancelIcon sx={{ fontSize: 56, color: tokens.rejected }} />}

              <Typography sx={{
                fontFamily: fonts.display, fontSize: '3rem', fontWeight: 700,
                lineHeight: 1, color: result.passed ? tokens.approved : tokens.rejected,
              }}>
                {result.scorePercent}%
              </Typography>

              <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, color: tokens.ink }}>
                {result.passed ? 'You passed' : 'Not quite'}
              </Typography>

              <Typography sx={{ fontSize: '0.875rem', color: tokens.muted, maxWidth: 380 }}>
                {result.totalQuestions > 0
                  ? `${result.correctCount} of ${result.totalQuestions} correct. The pass mark is ${result.passMarkPercent}%.`
                  : 'This course is material only, so it counts as done.'}
                {!result.passed && ' You can retake this assessment from My Training.'}
              </Typography>

              <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.7rem', color: tokens.muted }}>
                Attempt {result.attemptCount}
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button variant="contained" onClick={finish}>Close</Button>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogTitle sx={{ pb: 0.5 }}>{course.name}</DialogTitle>

          <Box sx={{ px: 3, pb: 1 }}>
            <Typography sx={{
              fontFamily: fonts.mono, fontSize: '0.68rem', letterSpacing: '0.1em',
              textTransform: 'uppercase', color: tokens.muted, mb: 0.75,
            }}>
              Question {index + 1} of {questions.length}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={((index + 1) / questions.length) * 100}
              sx={{ height: 5, borderRadius: 999 }}
            />
          </Box>

          <DialogContent sx={{ overflowX: 'hidden', minHeight: 280 }} ref={slideRef}>
            {/* Keying on the index remounts the child, which is what produces the slide. */}
            <Slide
              key={index}
              direction={direction === 'next' ? 'left' : 'right'}
              in
              appear
              container={slideRef.current}
            >
              <Box>
                <Typography sx={{
                  fontSize: '1.05rem', fontWeight: 700, color: tokens.ink,
                  whiteSpace: 'pre-wrap', mb: 0.5,
                }}>
                  {question.prompt}
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: tokens.muted, mb: 1.5 }}>
                  {single ? 'Choose one answer.' : 'Choose all that apply.'}
                </Typography>

                {single ? (
                  <RadioGroup
                    value={picked[0] ?? ''}
                    onChange={(e) => setPicked(Number(e.target.value), true)}
                  >
                    {question.options.map((o) => (
                      <FormControlLabel
                        key={o.id}
                        value={o.id}
                        control={<Radio />}
                        label={o.label}
                        sx={optionSx(picked.includes(o.id))}
                      />
                    ))}
                  </RadioGroup>
                ) : (
                  <Stack>
                    {question.options.map((o) => (
                      <FormControlLabel
                        key={o.id}
                        control={(
                          <Checkbox
                            checked={picked.includes(o.id)}
                            onChange={(e) => setPicked(o.id, e.target.checked)}
                          />
                        )}
                        label={o.label}
                        sx={optionSx(picked.includes(o.id))}
                      />
                    ))}
                  </Stack>
                )}
              </Box>
            </Slide>

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </DialogContent>

          <DialogActions>
            <Button onClick={finish} disabled={mut.isPending} sx={{ mr: 'auto' }}>Exit</Button>
            <Button
              startIcon={<ArrowBackIcon />}
              disabled={index === 0 || mut.isPending}
              onClick={() => go(-1)}
            >
              Back
            </Button>
            {last ? (
              <Button
                variant="contained"
                disabled={!canAdvance || mut.isPending}
                onClick={() => mut.mutate()}
              >
                {mut.isPending ? 'Submitting…' : 'Submit'}
              </Button>
            ) : (
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                disabled={!canAdvance}
                onClick={() => go(1)}
              >
                Next
              </Button>
            )}
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

const optionSx = (selected) => ({
  m: 0,
  mb: 1,
  px: 1.5,
  py: 0.75,
  borderRadius: '12px',
  border: `1px solid ${selected ? tokens.blue : tokens.hairline}`,
  backgroundColor: selected ? tokens.blueWash : 'transparent',
  transition: 'background-color 0.15s ease, border-color 0.15s ease',
  '&:hover': { backgroundColor: selected ? tokens.blueWash : '#F5F8FC' },
});
