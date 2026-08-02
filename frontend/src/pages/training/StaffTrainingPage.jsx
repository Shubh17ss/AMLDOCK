import { useEffect, useState } from 'react';
import { Box, Button, Stack, Tab, Tabs } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CoPresentIcon from '@mui/icons-material/CoPresentOutlined';
import MenuBookIcon from '@mui/icons-material/MenuBookOutlined';
import BusinessIcon from '@mui/icons-material/BusinessOutlined';
import PeopleAltIcon from '@mui/icons-material/PeopleAltOutlined';
import { SessionsTab } from './SessionsTab.jsx';
import { CoursesTab } from './CoursesTab.jsx';
import { ProvidersTab } from './ProvidersTab.jsx';
import { UsersTab } from './UsersTab.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ScopeGate } from '../../dashboard/ScopeGate.jsx';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { TRAINING_MANAGER_ROLES, canManageTraining } from '../../auth/roles.js';

// Tabs as data so role restrictions are a filter rather than a thicket of conditionals.
// Providers and Users are for the people who run training; Sessions and Courses are general.
const TABS = [
  { value: 'sessions',  label: 'Sessions',  icon: <CoPresentIcon /> },
  { value: 'courses',   label: 'Courses',   icon: <MenuBookIcon /> },
  { value: 'providers', label: 'Providers', icon: <BusinessIcon />,  roles: TRAINING_MANAGER_ROLES },
  { value: 'users',     label: 'Users',     icon: <PeopleAltIcon />, roles: TRAINING_MANAGER_ROLES },
];

/**
 * AML Training › Staff Training. Four tabs over one branch's training record.
 *
 * Scope-gated: the whole workspace is per-branch, so nothing renders until a firm and a branch
 * are selected. Staff who only attend training use the separate My Training page instead.
 */
export function StaffTrainingPage() {
  const { user } = useAuth();
  const { firm, branch } = useDashboardScope();
  const [tab, setTab] = useState('sessions');
  const [createOpen, setCreateOpen] = useState(false);
  const [courseOpen, setCourseOpen] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);

  const visibleTabs = TABS.filter((t) => !t.roles || t.roles.includes(user?.role));
  const mayManage = canManageTraining(user?.role);

  // MUI warns when `value` matches no rendered Tab — keep the selection inside what's visible.
  // Keyed on the role rather than the derived array, which is a new object every render.
  useEffect(() => {
    setTab((current) => (visibleTabs.some((t) => t.value === current)
      ? current
      : visibleTabs[0]?.value ?? 'sessions'));
  }, [user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow={[firm?.name, branch?.name].filter(Boolean).join(' · ') || 'No scope selected'}
        title="Staff Training"
      />

      <ScopeGate what="Training">
        <Stack spacing={2.5}>
          {/* Actions live on the tab row rather than the header — each tab has its own. */}
          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 2, flexWrap: 'wrap',
          }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
              {visibleTabs.map((t) => (
                <Tab
                  key={t.value}
                  value={t.value}
                  label={t.label}
                  icon={t.icon}
                  iconPosition="start"
                />
              ))}
            </Tabs>

            {mayManage && tab === 'sessions' && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
                Create session
              </Button>
            )}
            {mayManage && tab === 'courses' && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCourseOpen(true)}>
                Create course
              </Button>
            )}
            {mayManage && tab === 'providers' && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setProviderOpen(true)}>
                Add provider
              </Button>
            )}
          </Box>

          {tab === 'sessions' && (
            <SessionsTab createOpen={createOpen} onCloseCreate={() => setCreateOpen(false)} />
          )}
          {tab === 'courses' && (
            <CoursesTab createOpen={courseOpen} onCloseCreate={() => setCourseOpen(false)} />
          )}
          {tab === 'providers' && (
            <ProvidersTab addOpen={providerOpen} onCloseAdd={() => setProviderOpen(false)} />
          )}
          {tab === 'users' && <UsersTab />}
        </Stack>
      </ScopeGate>
    </Stack>
  );
}
