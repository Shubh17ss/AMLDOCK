import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutlined';
import CancelIcon from '@mui/icons-material/CancelOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { CompletionProgress } from '../../components/CompletionProgress.jsx';
import { roleLabel } from '../../auth/roles.js';
import { tokens, fonts } from '../../theme/theme.js';

const dateFmt = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const pastDue = (dueDate) =>
  Boolean(dueDate) && new Date(dueDate) < new Date(new Date().toDateString());

/** Mono uppercase section label, matching the detail dialogs on the other training tabs. */
function SectionLabel({ children }) {
  return (
    <Typography sx={{
      fontFamily: fonts.mono, fontSize: '0.68rem', letterSpacing: '0.08em',
      textTransform: 'uppercase', color: tokens.muted, mb: 1,
    }}>
      {children}
    </Typography>
  );
}

/** One training item: title, a muted meta line, and a right-aligned status block. */
function ItemRow({ title, meta, status, overdue }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: tokens.ink }}>
            {title}
          </Typography>
          {overdue && (
            <Chip size="small" label="Overdue" sx={{
              color: tokens.rejected, backgroundColor: `color-mix(in srgb, ${tokens.rejected} 8%, transparent)`,
              fontWeight: 700, fontSize: '0.66rem',
            }} />
          )}
        </Stack>
        <Typography sx={{ fontSize: '0.75rem', color: tokens.muted }}>{meta}</Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>{status}</Box>
    </Stack>
  );
}

function Status({ icon, label, colour, detail }) {
  return (
    <>
      <Stack direction="row" spacing={0.6} alignItems="center" justifyContent="flex-end">
        {icon}
        <Typography sx={{ fontSize: '0.78rem', color: colour, whiteSpace: 'nowrap' }}>
          {label}
        </Typography>
      </Stack>
      {detail && (
        <Typography sx={{
          fontFamily: fonts.mono, fontSize: '0.68rem', color: tokens.muted, whiteSpace: 'nowrap',
        }}>
          {detail}
        </Typography>
      )}
    </>
  );
}

const Nothing = ({ children }) => (
  <Typography sx={{ fontSize: '0.85rem', color: tokens.muted }}>{children}</Typography>
);

/**
 * Everything one staff member has been assigned and what they did with it.
 *
 * `record` is a row from UsersTab — the user plus their already-paired session and course
 * entries, so this component does no fetching of its own.
 */
export function UserTrainingDetailDialog({ record, branchName, onClose }) {
  const open = Boolean(record);
  if (!open) return null;

  const { user, sessions, courses, sessionsDone, coursesDone } = record;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>{user.fullName || user.email}</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Typography sx={{ fontSize: '0.8rem', color: tokens.muted }}>
            {[user.email, roleLabel(user.role), branchName].filter(Boolean).join(' · ')}
          </Typography>

          <Stack direction="row" spacing={4}>
            <Box>
              <SectionLabel>Sessions taken</SectionLabel>
              <CompletionProgress done={sessionsDone} total={sessions.length} />
            </Box>
            <Box>
              <SectionLabel>Courses passed</SectionLabel>
              <CompletionProgress done={coursesDone} total={courses.length} />
            </Box>
          </Stack>

          <Box>
            <SectionLabel>Sessions</SectionLabel>
            {sessions.length === 0 ? (
              <Nothing>No sessions assigned.</Nothing>
            ) : (
              <Stack spacing={1.5}>
                {sessions.map(({ session, attendee }) => {
                  const done = Boolean(attendee.completedAt);
                  return (
                    <ItemRow
                      key={session.id}
                      title={session.name}
                      overdue={!done && pastDue(session.sessionDate)}
                      meta={[
                        session.providerName,
                        session.location,
                        dateFmt(session.sessionDate),
                      ].filter(Boolean).join(' · ')}
                      status={done ? (
                        <Status
                          icon={<CheckCircleIcon sx={{ fontSize: 16, color: tokens.approved }} />}
                          label={`Completed ${dateFmt(attendee.completedAt)}`}
                          colour={tokens.approved}
                        />
                      ) : (
                        <Status
                          icon={<RadioButtonUncheckedIcon sx={{ fontSize: 16, color: tokens.muted }} />}
                          label="Not yet"
                          colour={tokens.muted}
                        />
                      )}
                    />
                  );
                })}
              </Stack>
            )}
          </Box>

          <Box>
            <SectionLabel>Courses</SectionLabel>
            {courses.length === 0 ? (
              <Nothing>No courses assigned.</Nothing>
            ) : (
              <Stack spacing={1.5}>
                {courses.map(({ course, assignee }) => {
                  const passed = assignee.passed === true;
                  const attempted = assignee.scorePercent != null;
                  // Attempts aren't on the roster DTO, so the score line reports what we hold:
                  // the latest result.
                  const scoreLine = attempted
                    ? `${assignee.scorePercent}% · pass mark ${course.passMarkPercent}%`
                    : null;

                  return (
                    <ItemRow
                      key={course.id}
                      title={course.name}
                      overdue={!passed && pastDue(course.dueDate)}
                      meta={[
                        course.dueDate ? `Due ${dateFmt(course.dueDate)}` : null,
                        `${course.questions?.length ?? 0} question${(course.questions?.length ?? 0) === 1 ? '' : 's'}`,
                        `pass mark ${course.passMarkPercent}%`,
                      ].filter(Boolean).join(' · ')}
                      status={passed ? (
                        <Status
                          icon={<CheckCircleIcon sx={{ fontSize: 16, color: tokens.approved }} />}
                          label={`Passed ${dateFmt(assignee.completedAt)}`}
                          colour={tokens.approved}
                          detail={scoreLine}
                        />
                      ) : attempted ? (
                        <Status
                          icon={<CancelIcon sx={{ fontSize: 16, color: tokens.rejected }} />}
                          label="Failed"
                          colour={tokens.rejected}
                          detail={scoreLine}
                        />
                      ) : (
                        <Status
                          icon={<RadioButtonUncheckedIcon sx={{ fontSize: 16, color: tokens.muted }} />}
                          label="Not attempted"
                          colour={tokens.muted}
                        />
                      )}
                    />
                  );
                })}
              </Stack>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
