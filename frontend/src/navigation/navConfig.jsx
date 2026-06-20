import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import InboxIcon from '@mui/icons-material/Inbox';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import HistoryIcon from '@mui/icons-material/History';
import { navProfileFor } from '../auth/roles.js';

export const DASHBOARD_PATH = '/dashboard';

/**
 * Primary navigation items per role. Shared by the sidebar and the dashboard launcher so they
 * never drift. The Dashboard entry points at its own page (a launcher of the other items).
 */
export function navConfigFor(role) {
  switch (navProfileFor(role)) {
    case 'agent':
      return [
        { label: 'Dashboard', to: DASHBOARD_PATH, icon: <DashboardIcon /> },
        { label: 'My deals',  to: '/my-deals', icon: <DescriptionIcon /> },
        { label: 'New deal',  to: '/deals/new', icon: <AddCircleOutlineIcon /> },
      ];
    case 'salesManager':
      return [
        { label: 'Dashboard',   to: DASHBOARD_PATH,  icon: <DashboardIcon /> },
        { label: 'Branch deals', to: '/firm/deals',  icon: <BusinessCenterIcon /> },
        { label: 'Users',       to: '/branch-users', icon: <PeopleIcon />, group: 'Admin' },
      ];
    case 'firmReviewer':
      return [
        { label: 'Dashboard', to: DASHBOARD_PATH,    icon: <DashboardIcon /> },
        { label: 'Queue',     to: '/queue',          icon: <InboxIcon /> },
        { label: 'My firm',   to: '/my-firm',        icon: <BusinessIcon />,  group: 'Admin' },
      ];
    case 'root':
      return [
        { label: 'Dashboard', to: DASHBOARD_PATH,    icon: <DashboardIcon /> },
        { label: 'Queue',     to: '/queue',          icon: <InboxIcon /> },
        { label: 'Firms',     to: '/admin/firms',    icon: <BusinessIcon />,  group: 'Admin' },
        { label: 'Users',     to: '/admin/users',    icon: <PeopleIcon />,    group: 'Admin' },
        { label: 'Audit',     to: '/admin/audit',    icon: <HistoryIcon />,   group: 'Admin' },
      ];
    default:
      return [{ label: 'Dashboard', to: DASHBOARD_PATH, icon: <DashboardIcon /> }];
  }
}
