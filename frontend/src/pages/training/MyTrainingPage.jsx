import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Box, Stack, Tab, Tabs } from '@mui/material';
import { listTrainingSessions, listTrainingCourses } from '../../api/training.js';
import { MySessionsTab } from './MySessionsTab.jsx';
import { MyCoursesTab } from './MyCoursesTab.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ScopeGate } from '../../dashboard/ScopeGate.jsx';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';

/**
 * My Training — the personal view, split into the two kinds of training: sessions they attend
 * and courses they work through.
 *
 * Both queries pass `mine`, which returns the signed-in user's own assignments whatever their
 * role and **across every branch**: compliance officers and senior managers sit in no branch and
 * can be assigned training in several, so this page is scoped to the firm, not a branch. Each
 * card names its own branch instead. The tab badges carry the outstanding count so it's obvious
 * where the work is.
 */
/** "Sessions · 3" — the count only when there is something outstanding to count. */
const countLabel = (label, count) => (count > 0 ? `${label} · ${count}` : label);

export function MyTrainingPage() {
  const { firm } = useDashboardScope();

  // The tab lives in the URL so assignment emails can link straight to the right one —
  // /my-training?tab=courses. Anything unrecognised falls back to Sessions.
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'courses' ? 'courses' : 'sessions';
  // replace, so flipping tabs doesn't stack up history entries to click back through.
  const setTab = (next) => setSearchParams({ tab: next }, { replace: true });

  // Distinct keys from the manager tabs: no branch, and a different shape of payload (own row
  // only, no answer key). The mutations on both tabs invalidate these as well as the manager keys.
  const sessionsQ = useQuery({
    queryKey: ['myTrainingSessions', firm?.id ?? null],
    queryFn: () => listTrainingSessions({ firmId: firm?.id, mine: true }),
  });
  const coursesQ = useQuery({
    queryKey: ['myTrainingCourses', firm?.id ?? null],
    queryFn: () => listTrainingCourses({ firmId: firm?.id, mine: true }),
  });

  const sessions = sessionsQ.data ?? [];
  const courses = coursesQ.data ?? [];

  const sessionsOutstanding = sessions.filter((s) => !s.myCompletedAt).length;
  const coursesOutstanding = courses.filter((c) => c.myPassed !== true).length;
  const outstanding = sessionsOutstanding + coursesOutstanding;
  const assigned = sessions.length + courses.length;

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow={[
          assigned === 0 ? 'Nothing assigned' : `${outstanding} outstanding of ${assigned}`,
          firm?.name,
        ].filter(Boolean).join(' · ')}
        title="My Training"
      />

      <ScopeGate what="Training" requireBranch={false}>
        <Stack spacing={2.5}>
          {/* Two controls, one track. The theme already renders MuiTabs as a segmented pill with a
              sliding indicator (theme.js › MuiTabs), which is the control this screen wants and
              which StaffTrainingPage already uses — so this stays Tabs rather than a hand-rolled
              button pair, and keeps arrow-key navigation and the tab/tabpanel semantics with it.

              The track stretches on a phone, where the two halves need to be real touch targets,
              and sizes to its labels on a desktop, where a control stretched across a 1400px page
              would read as a banner rather than as a choice between two things. Done with `sx`
              rather than `variant="fullWidth"` because the variant applies at every breakpoint —
              which is exactly how it ended up spanning the desktop page.

              The outstanding count is folded into the label rather than hung off a Badge: the
              badge's `right: -12` overlaps the track edge once the tabs stretch, and a count
              reading "0" is an alarm about nothing. */}
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              alignSelf: { xs: 'stretch', md: 'flex-start' },
              '& .MuiTab-root': { flex: { xs: 1, md: '0 0 auto' } },
            }}
          >
            <Tab value="sessions" label={countLabel('Sessions', sessionsOutstanding)} />
            <Tab value="courses" label={countLabel('Courses', coursesOutstanding)} />
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
