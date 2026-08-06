import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Badge, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress,
  Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/SaveOutlined';
import { createTrainingCourseWithFiles, updateTrainingCourse } from '../../api/training.js';
import { QuestionnaireEditor, questionnaireValid, questionProblem } from './QuestionnaireEditor.jsx';
import { CourseContentUploader } from './CourseContentUploader.jsx';
import { AssigneePicker } from '../../components/AssigneePicker.jsx';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { tokens } from '../../theme/theme.js';

const emptyForm = () => ({
  name: '',
  description: '',
  dueDate: '',
  passMarkPercent: '80',
  questions: [],
  assigneeUserIds: [],
});

/**
 * Panels all stay mounted with the inactive ones hidden, so switching tabs never loses what's
 * been typed. (The suspicious-activity dialog slides its two panels; with four panels of very
 * different heights, hiding is the more robust choice.)
 */
const panelSx = (active) => (active ? {} : { display: 'none' });

/** Strip the DTO's question shape back to what the API accepts. */
const toQuestionInput = (q) => ({
  questionType: q.questionType,
  prompt: q.prompt,
  options: q.options.map((o) => ({ label: o.label, correct: Boolean(o.correct) })),
});

/**
 * Create or edit a course across four tabs: Details, Content, Questionnaire, Users.
 * One component, two modes, mounted twice by the parent — the same shape as SessionDialog.
 */
export function CourseDialog({ mode, open: openProp, target, onClose }) {
  const isEdit = mode === 'edit';
  const open = isEdit ? Boolean(target) : openProp;

  const qc = useQueryClient();
  const { showToast } = useToast();
  const { firm, branch } = useDashboardScope();
  const [tab, setTab] = useState('details');
  const [form, setForm] = useState(emptyForm);
  const [stagedFiles, setStagedFiles] = useState([]);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isEdit && target) {
      setForm({
        name: target.name ?? '',
        description: target.description ?? '',
        dueDate: target.dueDate ?? '',
        passMarkPercent: target.passMarkPercent ?? '',
        questions: (target.questions ?? []).map((q) => ({
          questionType: q.questionType,
          prompt: q.prompt ?? '',
          options: (q.options ?? []).map((o) => ({
            label: o.label ?? '', correct: Boolean(o.correct),
          })),
        })),
        assigneeUserIds: (target.assignees ?? []).map((a) => a.userId),
      });
      setStagedFiles([]);
      setTab('details');
      setProgress(null);
      setError(null);
    }
    if (!isEdit && open) {
      setForm(emptyForm());
      setStagedFiles([]);
      setTab('details');
      setProgress(null);
      setError(null);
    }
  }, [isEdit, isEdit ? target?.id : open]); // eslint-disable-line react-hooks/exhaustive-deps

  const ch = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        dueDate: form.dueDate,
        passMarkPercent: form.passMarkPercent,
        questions: form.questions.map(toQuestionInput),
        assigneeUserIds: form.assigneeUserIds,
      };
      // In edit mode the course already exists, so its files upload as they're picked; only a
      // new course has to save first and attach afterwards.
      return isEdit
        ? updateTrainingCourse(target.id, payload)
        : createTrainingCourseWithFiles({
          ...payload,
          realEstateFirmId: firm?.id,
          firmBranchId: branch?.id,
          files: stagedFiles,
          onProgress: setProgress,
        });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trainingCourses'] });
      showToast({ severity: 'success', message: isEdit ? 'Course updated' : 'Course created' });
      onClose();
    },
    onError: (e) => {
      setProgress(null);
      setError(e.response?.data?.message || 'Could not save the course. Try again.');
    },
  });

  const close = () => { if (!mut.isPending) onClose(); };

  const passMark = Number(form.passMarkPercent);
  const passMarkValid = form.passMarkPercent !== '' && passMark >= 1 && passMark <= 100;
  const detailsValid = Boolean(form.name.trim()) && passMarkValid;
  const questionsValid = questionnaireValid(form.questions);
  const submittable = detailsValid && questionsValid;

  const submit = (e) => {
    e.preventDefault();
    if (submittable) { mut.mutate(); return; }
    // Land the user on whichever tab is actually blocking them.
    setTab(detailsValid ? 'questions' : 'details');
  };

  const firstQuestionProblem = form.questions
    .map((q, i) => (questionProblem(q) ? `Q${i + 1}: ${questionProblem(q)}` : null))
    .find(Boolean);

  const countBadge = (label, count) => (
    <Badge color="primary" badgeContent={count}
           sx={{ '& .MuiBadge-badge': { right: -12, top: 2 } }}>
      {label}
    </Badge>
  );

  return (
    <Dialog open={open} onClose={close} maxWidth="md" fullWidth>
      {/* noValidate: inactive panels stay mounted, and the browser refuses to submit a form
          containing a hidden required control. `submittable` is the real gate. */}
      <Box component="form" noValidate onSubmit={submit}>
        <DialogTitle sx={{ pb: 1 }}>{isEdit ? 'Edit course' : 'New course'}</DialogTitle>

        <Box sx={{ px: 3 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label="Details" value="details" />
            <Tab value="content"
                 label={countBadge('Content', isEdit ? (target?.files?.length ?? 0) : stagedFiles.length)} />
            <Tab value="questions" label={countBadge('Questionnaire', form.questions.length)} />
            <Tab value="users" label={countBadge('Users', form.assigneeUserIds.length)} />
          </Tabs>
        </Box>

        <DialogContent sx={{ minHeight: 380 }}>
          <Box sx={panelSx(tab === 'details')}>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Course name" value={form.name} onChange={ch('name')}
                         required fullWidth autoFocus />
              <TextField label="Description" value={form.description} onChange={ch('description')}
                         multiline minRows={3} fullWidth />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Due"
                  type="date"
                  value={form.dueDate}
                  onChange={ch('dueDate')}
                  InputLabelProps={{ shrink: true }}
                  helperText="Optional"
                  fullWidth
                />
                <TextField
                  label="Success criteria (%)"
                  type="number"
                  value={form.passMarkPercent}
                  onChange={ch('passMarkPercent')}
                  inputProps={{ min: 1, max: 100, step: 1 }}
                  error={form.passMarkPercent !== '' && !passMarkValid}
                  helperText="Score needed to pass — 1 to 100"
                  required
                  fullWidth
                />
              </Stack>
            </Stack>
          </Box>

          <Box sx={panelSx(tab === 'content')}>
            <Box sx={{ mt: 1 }}>
              <CourseContentUploader
                courseId={isEdit ? target?.id : null}
                staged={stagedFiles}
                onStagedChange={setStagedFiles}
                uploaded={isEdit ? (target?.files ?? []) : []}
                disabled={mut.isPending}
              />
            </Box>
          </Box>

          <Box sx={panelSx(tab === 'questions')}>
            <Box sx={{ mt: 1 }}>
              <QuestionnaireEditor
                questions={form.questions}
                onChange={(questions) => setForm((f) => ({ ...f, questions }))}
              />
            </Box>
          </Box>

          <Box sx={panelSx(tab === 'users')}>
            <Box sx={{ mt: 1 }}>
              <AssigneePicker
                value={form.assigneeUserIds}
                onChange={(ids) => setForm((f) => ({ ...f, assigneeUserIds: ids }))}
                firmId={firm?.id}
                branchId={branch?.id}
                branchName={branch?.name}
              />
              {isEdit && (
                <Typography sx={{ fontSize: '0.75rem', color: tokens.muted, mt: 1.5 }}>
                  Unticking someone clears their assignment. Anyone who stays keeps the completion
                  already recorded against them.
                </Typography>
              )}
            </Box>
          </Box>

          {progress && mut.isPending && progress.total > 0 && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress
                variant={progress.phase === 'upload' ? 'determinate' : 'indeterminate'}
                value={progress.percent}
                sx={{ borderRadius: 999, height: 6 }}
              />
              <Typography sx={{ mt: 0.5, fontSize: '0.72rem', color: tokens.muted }}>
                {progress.phase === 'upload'
                  ? `Uploading ${progress.index} of ${progress.total}… ${progress.percent}%`
                  : 'Saving…'}
              </Typography>
            </Box>
          )}

          {!questionsValid && firstQuestionProblem && (
            <Alert severity="warning" sx={{ mt: 2 }}>{firstQuestionProblem}</Alert>
          )}
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>

        <DialogActions>
          <Button onClick={close} disabled={mut.isPending}>Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={isEdit ? <SaveIcon /> : <AddIcon />}
            disabled={mut.isPending || !submittable}
          >
            {mut.isPending ? 'Saving…' : (isEdit ? 'Save' : 'Create course')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
