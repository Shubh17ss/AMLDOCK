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
import { submitCourseAttempt, checkCourseAnswer } from '../../api/training.js';
import { tokens, fonts } from '../../theme/theme.js';

/**
 * Sit a course assessment, one question per slide, with the answer shown after each one.
 *
 * The options arrive with their `correct` flag nulled out — the key is never in the payload — so
 * every question is marked by the server: `checkCourseAnswer` for the feedback shown here, and
 * `submitCourseAttempt` at the end for the score that actually counts.
 *
 * Checking locks the question. Without that, being shown the answer and then being allowed to
 * change the selection would make the final score meaningless.
 */
export function CoursePlayerDialog({ course, onClose }) {
  const qc = useQueryClient();
  const open = Boolean(course);
  const questions = course?.questions ?? [];

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState('next');
  const [answers, setAnswers] = useState({});
  // { [questionId]: { correct, correctOptionIds } } — a question is locked once it has an entry.
  const [feedback, setFeedback] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const slideRef = useRef(null);

  // Start clean each time the dialog opens on a course.
  useEffect(() => {
    if (open) {
      setIndex(0);
      setDirection('next');
      setAnswers({});
      setFeedback({});
      setResult(null);
      setError(null);
    }
  }, [open, course?.id]);

  const question = questions[index];
  const picked = answers[question?.id] ?? [];
  const verdict = feedback[question?.id];
  const locked = Boolean(verdict);

  const checkMut = useMutation({
    mutationFn: () => checkCourseAnswer(course.id, question.id, picked),
    onSuccess: (data) => {
      setError(null);
      setFeedback((f) => ({ ...f, [question.id]: data }));
    },
    onError: (e) => setError(e.response?.data?.message || 'Could not check that answer. Try again.'),
  });

  const submitMut = useMutation({
    mutationFn: () => submitCourseAttempt(course.id, questions.map((q) => ({
      questionId: q.id,
      selectedOptionIds: answers[q.id] ?? [],
    }))),
    onSuccess: (data) => setResult(data),
    onError: (e) => setError(e.response?.data?.message || 'Could not submit. Try again.'),
  });

  const busy = checkMut.isPending || submitMut.isPending;

  const finish = () => {
    // Only refresh the lists once we're done — mid-quiz the card behind shouldn't move.
    if (result) {
      qc.invalidateQueries({ queryKey: ['myTrainingCourses'] });
      qc.invalidateQueries({ queryKey: ['trainingCourses'] });
    }
    onClose();
  };

  if (!open) return null;

  const single = question?.questionType === 'SINGLE_CHOICE';
  const last = index === questions.length - 1;
  // Scoring a skipped question as wrong without saying so would be a trap, so an answer is
  // required before it can be checked.
  const canCheck = picked.length > 0;

  const setPicked = (optionId, checked) => setAnswers((a) => ({
    ...a,
    [question.id]: single
      ? [optionId]
      : (checked
        ? [...(a[question.id] ?? []), optionId]
        : (a[question.id] ?? []).filter((id) => id !== optionId)),
  }));

  const go = (delta) => {
    setError(null);
    setDirection(delta > 0 ? 'next' : 'prev');
    setIndex((i) => i + delta);
  };

  // Before checking: just selected or not. After: right, wrongly picked, or neither — an option
  // the taker missed still shows as correct, which is the whole point of the feedback.
  const stateOf = (o) => {
    if (!verdict) return picked.includes(o.id) ? 'selected' : 'idle';
    if (verdict.correctOptionIds.includes(o.id)) return 'correct';
    if (picked.includes(o.id)) return 'wrong';
    return 'idle';
  };

  const optionLabel = (o) => {
    const state = stateOf(o);
    if (state !== 'correct' && state !== 'wrong') return o.label;
    return (
      <Stack direction="row" spacing={0.75} alignItems="center">
        <span>{o.label}</span>
        {state === 'correct'
          ? <CheckCircleIcon sx={{ fontSize: 16, color: tokens.approved }} />
          : <CancelIcon sx={{ fontSize: 16, color: tokens.rejected }} />}
      </Stack>
    );
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
                        disabled={locked}
                        control={<Radio />}
                        label={optionLabel(o)}
                        sx={optionSx(stateOf(o))}
                      />
                    ))}
                  </RadioGroup>
                ) : (
                  <Stack>
                    {question.options.map((o) => (
                      <FormControlLabel
                        key={o.id}
                        disabled={locked}
                        control={(
                          <Checkbox
                            checked={picked.includes(o.id)}
                            onChange={(e) => setPicked(o.id, e.target.checked)}
                          />
                        )}
                        label={optionLabel(o)}
                        sx={optionSx(stateOf(o))}
                      />
                    ))}
                  </Stack>
                )}

                {verdict && (
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="flex-start"
                    sx={{
                      mt: 1.5, px: 1.75, py: 1.25, borderRadius: '12px',
                      backgroundColor: `${verdict.correct ? tokens.approved : tokens.rejected}12`,
                    }}
                  >
                    {verdict.correct
                      ? <CheckCircleIcon sx={{ fontSize: 18, color: tokens.approved }} />
                      : <CancelIcon sx={{ fontSize: 18, color: tokens.rejected }} />}
                    <Typography sx={{
                      fontSize: '0.85rem', fontWeight: 600,
                      color: verdict.correct ? tokens.approved : tokens.rejected,
                    }}>
                      {verdict.correct
                        ? 'Correct.'
                        : `Not quite — the correct ${verdict.correctOptionIds.length === 1
                          ? 'answer is' : 'answers are'} highlighted above.`}
                    </Typography>
                  </Stack>
                )}
              </Box>
            </Slide>

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </DialogContent>

          <DialogActions>
            <Button onClick={finish} disabled={busy} sx={{ mr: 'auto' }}>Exit</Button>
            <Button
              startIcon={<ArrowBackIcon />}
              disabled={index === 0 || busy}
              onClick={() => go(-1)}
            >
              Back
            </Button>
            {/* Check first, then move on — the answer has to be committed before it's revealed. */}
            {!locked ? (
              <Button
                variant="contained"
                disabled={!canCheck || busy}
                onClick={() => checkMut.mutate()}
              >
                {checkMut.isPending ? 'Checking…' : 'Check answer'}
              </Button>
            ) : last ? (
              <Button
                variant="contained"
                disabled={busy}
                onClick={() => submitMut.mutate()}
              >
                {submitMut.isPending ? 'Submitting…' : 'Submit'}
              </Button>
            ) : (
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                disabled={busy}
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

const OPTION_COLOURS = {
  selected: { border: tokens.blue, background: tokens.blueWash },
  correct: { border: tokens.approved, background: `${tokens.approved}14` },
  wrong: { border: tokens.rejected, background: `${tokens.rejected}14` },
  idle: { border: tokens.hairline, background: 'transparent' },
};

const optionSx = (state) => {
  const { border, background } = OPTION_COLOURS[state] ?? OPTION_COLOURS.idle;
  return {
    m: 0,
    mb: 1,
    px: 1.5,
    py: 0.75,
    borderRadius: '12px',
    border: `1px solid ${border}`,
    backgroundColor: background,
    transition: 'background-color 0.15s ease, border-color 0.15s ease',
    '&:hover': { backgroundColor: state === 'idle' ? '#F5F8FC' : background },
    // A locked question is still readable — the point is to look at the answer.
    '&.Mui-disabled': { opacity: 1 },
    '& .MuiFormControlLabel-label.Mui-disabled': { color: tokens.ink },
  };
};
