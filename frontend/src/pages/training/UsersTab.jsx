import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from '@mui/material';
import { listTrainingSessions, listTrainingCourses } from '../../api/training.js';
import { UserTrainingDetailDialog } from './UserTrainingDetailDialog.jsx';
import { CompletionProgress } from '../../components/CompletionProgress.jsx';
import { SearchField, matchesSearch } from '../../components/SearchField.jsx';
import { useAssignableUsers } from '../../hooks/useAssignableUsers.js';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { roleLabel } from '../../auth/roles.js';
import { tokens, fonts } from '../../theme/theme.js';

/**
 * Turn the two "by thing" lists into one "by person" index: for each user, every session and
 * course they are on, paired with their own roster row.
 *
 * Walks each roster once rather than scanning the lists per user, so this stays cheap as a
 * branch's training history grows.
 */
function pivotByUser(sessions, courses) {
  const index = new Map();
  const entry = (userId) => {
    if (!index.has(userId)) index.set(userId, { sessions: [], courses: [] });
    return index.get(userId);
  };

  sessions.forEach((session) => {
    (session.attendees ?? []).forEach((attendee) => {
      entry(attendee.userId).sessions.push({ session, attendee });
    });
  });
  courses.forEach((course) => {
    (course.assignees ?? []).forEach((assignee) => {
      entry(assignee.userId).courses.push({ course, assignee });
    });
  });
  return index;
}

/**
 * AML Training › Users — the training record from the staff member's side.
 *
 * Everything here is a pivot of the same two queries the Sessions and Courses tabs use, under
 * the same keys, so switching tabs renders from cache with no extra round trip. A manager's
 * payload already carries the full roster, so no dedicated endpoint is needed.
 */
export function UsersTab() {
  const { firm, branch } = useDashboardScope();
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);

  const { users, isLoading: usersLoading, empty } = useAssignableUsers(firm?.id, branch?.id);

  const sessionsQ = useQuery({
    queryKey: ['trainingSessions', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listTrainingSessions({ firmId: firm?.id, branchId: branch?.id }),
  });
  const coursesQ = useQuery({
    queryKey: ['trainingCourses', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listTrainingCourses({ firmId: firm?.id, branchId: branch?.id }),
  });

  const byUser = useMemo(
    () => pivotByUser(sessionsQ.data ?? [], coursesQ.data ?? []),
    [sessionsQ.data, coursesQ.data],
  );

  const rows = useMemo(() => {
    return users
      .filter((u) => matchesSearch(search, u.fullName, u.email))
      .map((user) => {
        const { sessions = [], courses = [] } = byUser.get(user.id) ?? {};
        const sessionsDone = sessions.filter((s) => s.attendee.completedAt).length;
        // "Taken" for a course means passed, matching the Done status on My Training — a
        // sat-but-failed course is still outstanding.
        const coursesDone = courses.filter((c) => c.assignee.passed === true).length;
        return {
          user,
          sessions,
          courses,
          sessionsDone,
          coursesDone,
          outstanding: (sessions.length - sessionsDone) + (courses.length - coursesDone),
        };
      });
  }, [users, byUser, search]);

  const isError = sessionsQ.isError || coursesQ.isError;
  const isLoading = usersLoading || sessionsQ.isLoading || coursesQ.isLoading;

  if (empty) {
    return (
      <Paper sx={{ p: 5, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: tokens.ink }}>
          No staff in this branch
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', color: tokens.muted, mt: 0.5 }}>
          Add agents to this branch under Settings › Users, then assign them training.
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={2}>
      {isError && <Alert severity="error">Failed to load the training record. Refresh to try again.</Alert>}

      <SearchField value={search} onChange={setSearch} placeholder="Search staff…" />

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Staff</TableCell>
              <TableCell>Sessions taken</TableCell>
              <TableCell>Courses passed</TableCell>
              <TableCell align="right">Outstanding</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.user.id}
                hover
                onClick={() => setDetail(row)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: tokens.ink }}>
                    {row.user.fullName || row.user.email}
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: tokens.muted }}>
                    {row.user.email}
                  </Typography>
                  <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.66rem', color: tokens.muted }}>
                    {roleLabel(row.user.role)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <CompletionProgress done={row.sessionsDone} total={row.sessions.length} />
                </TableCell>
                <TableCell>
                  <CompletionProgress done={row.coursesDone} total={row.courses.length} />
                </TableCell>
                <TableCell align="right">
                  {row.outstanding > 0 ? (
                    <Chip
                      size="small"
                      label={row.outstanding}
                      sx={{
                        color: tokens.review, backgroundColor: `${tokens.review}14`,
                        fontWeight: 700, fontSize: '0.72rem', minWidth: 34,
                      }}
                    />
                  ) : (
                    <Typography component="span" sx={{ fontSize: '0.78rem', color: tokens.muted }}>
                      —
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  {search ? `No staff match “${search}”.` : 'No staff in this branch.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <UserTrainingDetailDialog
        record={detail}
        branchName={branch?.name}
        onClose={() => setDetail(null)}
      />
    </Stack>
  );
}
