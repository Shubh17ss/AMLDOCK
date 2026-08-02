import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Badge, Box, Stack, Tab, Tabs } from '@mui/material';
import { listTrainingSessions, listTrainingCourses } from '../../api/training.js';
import { MySessionsTab } from './MySessionsTab.jsx';
import { MyCoursesTab } from './MyCoursesTab.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ScopeGate } from '../../dashboard/ScopeGate.jsx';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';

/**
 * My Training — the personal view for branch staff, split into the two kinds of training:
 * sessions they attend and courses they work through.
 *
 * Both endpoints are role-aware, so these only ever return the signed-in user's own assignments.
 * The tab badges carry the outstanding count so it's obvious where the work is.
 */
export function MyTrainingPage() {
  const { firm, branch } = useDashboardScope();

  // The tab lives in the URL so assignment emails can link straight to the right one —
  // /my-training?tab=courses. Anything unrecognised falls back to Sessions.
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'courses' ? 'courses' : 'sessions';
  // replace, so flipping tabs doesn't stack up history entries to click back through.
  const setTab = (next) => setSearchParams({ tab: next }, { replace: true });

  const sessionsQ = useQuery({
    queryKey: ['trainingSessions', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listTrainingSessions({ firmId: firm?.id, branchId: branch?.id }),
  });
  const coursesQ = useQuery({
    queryKey: ['trainingCourses', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listTrainingCourses({ firmId: firm?.id, branchId: branch?.id }),
  });

  const sessions = sessionsQ.data ?? [];
  const courses = coursesQ.data ?? [];

  const sessionsOutstanding = sessions.filter((s) => !s.myCompletedAt).length;
  const coursesOutstanding = courses.filter((c) => c.myPassed !== true).length;
  const outstanding = sessionsOutstanding + coursesOutstanding;
  const assigned = sessions.length + courses.length;

  const countBadge = (label, count) => (
    <Badge color="primary" badgeContent={count}
           sx={{ '& .MuiBadge-badge': { right: -12, top: 2 } }}>
      {label}
    </Badge>
  );

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow={[
          assigned === 0 ? 'Nothing assigned' : `${outstanding} outstanding of ${assigned}`,
          branch?.name,
        ].filter(Boolean).join(' · ')}
        title="My Training"
      />

      <ScopeGate what="Training">
        <Stack spacing={2.5}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ alignSelf: 'flex-start' }}>
            <Tab value="sessions" label={countBadge('Sessions', sessionsOutstanding)} />
            <Tab value="courses" label={countBadge('Courses', coursesOutstanding)} />
          </Tabs>

          <Box>
            {tab === 'sessions' && (
              <MySessionsTab
                sessions={sessions}
                isLoading={sessionsQ.isLoading}
                isError={sessionsQ.isError}
              />
            )}
            {tab === 'courses' && (
              <MyCoursesTab
                courses={courses}
                isLoading={coursesQ.isLoading}
                isError={coursesQ.isError}
              />
            )}
          </Box>
        </Stack>
      </ScopeGate>
    </Stack>
  );
}
