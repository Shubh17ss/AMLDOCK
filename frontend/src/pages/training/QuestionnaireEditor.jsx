import {
  Box, Button, Checkbox, FormControl, IconButton, InputLabel, MenuItem, Paper, Radio, Select,
  Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/CloseRounded';
import { tokens, fonts } from '../../theme/theme.js';

const MAX_QUESTIONS = 50;

export const emptyOption = () => ({ label: '', correct: false });
export const emptyQuestion = () => ({
  questionType: 'SINGLE_CHOICE',
  prompt: '',
  options: [emptyOption(), emptyOption()],
});

/**
 * What's wrong with a question, or null if it's fine. Mirrors the server rules in
 * TrainingCourseService.validateQuestions so the dialog never submits something the API
 * will reject.
 */
export function questionProblem(q) {
  if (!q.prompt.trim()) return 'Needs a question';
  if (q.options.length < 2) return 'Needs at least two options';
  if (q.options.some((o) => !o.label.trim())) return 'Every option needs text';
  const correct = q.options.filter((o) => o.correct).length;
  if (q.questionType === 'SINGLE_CHOICE' && correct !== 1) return 'Pick exactly one correct answer';
  if (q.questionType === 'MULTI_CHOICE' && correct < 1) return 'Pick at least one correct answer';
  return null;
}

export const questionnaireValid = (questions) => questions.every((q) => questionProblem(q) === null);

/**
 * The questionnaire builder: choose how many questions, then fill in that many cards.
 *
 * Correctness is marked inline on each option — a radio when only one answer can be right, a
 * checkbox when several can. That is the answer key, and it never reaches a course taker.
 */
export function QuestionnaireEditor({ questions, onChange }) {
  const setCount = (raw) => {
    const next = Math.max(0, Math.min(MAX_QUESTIONS, Number(raw) || 0));
    if (next === questions.length) return;
    if (next < questions.length) {
      // Trim from the end so everything already filled in above survives.
      onChange(questions.slice(0, next));
      return;
    }
    const grown = [...questions];
    while (grown.length < next) grown.push(emptyQuestion());
    onChange(grown);
  };

  const patchQuestion = (index, patch) => onChange(questions.map((q, i) => (
    i === index ? { ...q, ...patch } : q
  )));

  const changeType = (index, questionType) => {
    const q = questions[index];
    let options = q.options;
    // Going multi -> single can leave several answers marked correct, which the server would
    // reject. Keep the first and clear the rest so the card is always in a valid shape.
    if (questionType === 'SINGLE_CHOICE') {
      let seen = false;
      options = q.options.map((o) => {
        if (o.correct && !seen) { seen = true; return o; }
        return { ...o, correct: false };
      });
    }
    patchQuestion(index, { questionType, options });
  };

  const patchOption = (qIndex, oIndex, patch) => patchQuestion(qIndex, {
    options: questions[qIndex].options.map((o, i) => (i === oIndex ? { ...o, ...patch } : o)),
  });

  const markCorrect = (qIndex, oIndex, checked) => {
    const q = questions[qIndex];
    if (q.questionType === 'SINGLE_CHOICE') {
      patchQuestion(qIndex, {
        options: q.options.map((o, i) => ({ ...o, correct: i === oIndex })),
      });
    } else {
      patchOption(qIndex, oIndex, { correct: checked });
    }
  };

  const addOption = (qIndex) => patchQuestion(qIndex, {
    options: [...questions[qIndex].options, emptyOption()],
  });

  const removeOption = (qIndex, oIndex) => patchQuestion(qIndex, {
    options: questions[qIndex].options.filter((_, i) => i !== oIndex),
  });

  return (
    <Stack spacing={2}>
      <TextField
        label="Number of questions"
        type="number"
        value={questions.length}
        onChange={(e) => setCount(e.target.value)}
        inputProps={{ min: 0, max: MAX_QUESTIONS, step: 1 }}
        helperText={questions.length === 0
          ? 'A course can be material only — leave this at 0 to skip the questionnaire.'
          : 'Reducing this removes cards from the end.'}
        sx={{ maxWidth: 260 }}
      />

      {questions.map((q, qIndex) => {
        const problem = questionProblem(q);
        const single = q.questionType === 'SINGLE_CHOICE';
        return (
          <Paper key={qIndex} variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Typography sx={{
                  fontFamily: fonts.mono, fontSize: '0.7rem', letterSpacing: '0.1em',
                  color: tokens.muted, flexShrink: 0,
                }}>
                  Q{qIndex + 1}
                </Typography>
                <FormControl size="small" sx={{ minWidth: 190 }}>
                  <InputLabel id={`qtype-${qIndex}`}>Type</InputLabel>
                  <Select
                    labelId={`qtype-${qIndex}`}
                    label="Type"
                    value={q.questionType}
                    onChange={(e) => changeType(qIndex, e.target.value)}
                  >
                    <MenuItem value="SINGLE_CHOICE">Single choice</MenuItem>
                    <MenuItem value="MULTI_CHOICE">Multiple choice</MenuItem>
                  </Select>
                </FormControl>
                {problem && (
                  <Typography sx={{ fontSize: '0.75rem', color: tokens.review, ml: 'auto' }}>
                    {problem}
                  </Typography>
                )}
              </Stack>

              <TextField
                label="Question"
                value={q.prompt}
                onChange={(e) => patchQuestion(qIndex, { prompt: e.target.value })}
                multiline
                minRows={2}
                fullWidth
              />

              <Box>
                <Typography sx={{
                  fontFamily: fonts.mono, fontSize: '0.65rem', letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: tokens.muted, mb: 1,
                }}>
                  Options — tick the correct {single ? 'answer' : 'answers'}
                </Typography>
                <Stack spacing={1}>
                  {q.options.map((o, oIndex) => (
                    <Stack key={oIndex} direction="row" spacing={1} alignItems="center">
                      {single ? (
                        <Radio
                          checked={o.correct}
                          onChange={() => markCorrect(qIndex, oIndex, true)}
                          size="small"
                        />
                      ) : (
                        <Checkbox
                          checked={o.correct}
                          onChange={(e) => markCorrect(qIndex, oIndex, e.target.checked)}
                          size="small"
                        />
                      )}
                      <TextField
                        value={o.label}
                        onChange={(e) => patchOption(qIndex, oIndex, { label: e.target.value })}
                        placeholder={`Option ${oIndex + 1}`}
                        size="small"
                        fullWidth
                      />
                      <Tooltip title={q.options.length <= 2 ? 'A question needs two options' : 'Remove option'}>
                        <span>
                          <IconButton
                            size="small"
                            disabled={q.options.length <= 2}
                            onClick={() => removeOption(qIndex, oIndex)}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  ))}
                </Stack>
                <Button size="small" startIcon={<AddIcon />} sx={{ mt: 1 }}
                        onClick={() => addOption(qIndex)}>
                  Add option
                </Button>
              </Box>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}
