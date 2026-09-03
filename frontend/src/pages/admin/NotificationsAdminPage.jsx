import { useMemo, useState } from 'react';
import {
  Alert, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { InstantSwitch } from '../../components/InstantSwitch.jsx';
import { DEAL_NOTIFICATION_EVENTS, canWrite, roleLabel } from '../../auth/roles.js';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import {
  listNotificationPreferences, updateUserNotificationPreferences,
} from '../../api/notificationPreferences.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { SearchField, matchesSearch } from '../../components/SearchField.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { tokens } from '../../theme/theme.js';

/**
 * Settings › Notifications — who in this branch is emailed about deal activity.
 *
 * Pivots on the branch already chosen in the sidebar scope, so rows are users and columns are
 * events. The underlying data is user × branch × event; picking the branch up from DashboardScope
 * is what keeps the screen two-dimensional and consistent with every other Settings page, rather
 * than inventing a second branch selector here.
 *
 * Users manage the same rows themselves from Profile › Deal email notifications. This is the
 * override, not a separate store.
 */
export function NotificationsAdminPage() {
  const { user } = useAuth();
  const { branch, scopeComplete } = useDashboardScope();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');

  const mayWrite = canWrite(user?.role);
  const branchId = branch?.id ?? null;

  const gridQ = useQuery({
    queryKey: ['notification-preferences', branchId],
    queryFn: () => listNotificationPreferences(branchId),
    enabled: Boolean(branchId),
  });

  const save = useMutation({
    mutationFn: ({ userId, preferences }) =>
      updateUserNotificationPreferences(userId, preferences),
    onSuccess: async () => {
      // Awaited, so the promise mutateAsync returns does not settle before the grid this switch
      // reads from has been refreshed.
      await qc.invalidateQueries({ queryKey: ['notification-preferences'] });
      showToast({ severity: 'success', message: 'Notification preferences saved' });
    },
    onError: (err) => showToast({
      severity: 'error',
      message: err.response?.data?.message || 'Could not save notification preferences',
    }),
  });

  const rows = useMemo(() => {
    const all = gridQ.data ?? [];
    return all.filter((r) => matchesSearch(search, r.fullName, r.email, roleLabel(r.role)));
  }, [gridQ.data, search]);

  // mutateAsync so InstantSwitch can hold the thumb until the matrix has refetched.
  const toggle = (row, eventType, enabled) =>
    save.mutateAsync({
      userId: row.userId,
      preferences: [{ firmBranchId: branchId, eventType, enabled }],
    });

  const valueFor = (row, eventType) =>
    row.preferences.find((p) => p.eventType === eventType && p.firmBranchId === branchId);

  return (
    <Stack spacing={3}>
      <PageHeader
        eyebrow="Settings"
        title="Notifications"
        subtitle={branch ? `Deal email notifications for ${branch.name}` : undefined}
      />

      {!scopeComplete || !branchId ? (
        <Alert severity="info">Choose a branch to see who it notifies.</Alert>
      ) : (
        <>
          <SearchField value={search} onChange={setSearch} placeholder="Search people…" />

          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Role</TableCell>
                  {DEAL_NOTIFICATION_EVENTS.map((e) => (
                    <TableCell key={e.id} align="center">{e.label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell>
                      <Stack spacing={0}>
                        <Typography variant="body2">{row.fullName}</Typography>
                        <Typography variant="caption" sx={{ color: tokens.muted }}>
                          {row.email}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ color: tokens.muted }}>{roleLabel(row.role)}</TableCell>
                    {DEAL_NOTIFICATION_EVENTS.map((e) => {
                      const pref = valueFor(row, e.id);
                      return (
                        <TableCell key={e.id} align="center">
                          <InstantSwitch
                            size="small"
                            checked={Boolean(pref?.enabled)}
                            // No longer disabled while saving: the switch holds the requested
                            // position itself, and locking it mid-gesture is what made this feel
                            // stuck. The two real reasons to refuse a click remain.
                            disabled={!mayWrite || !pref}
                            onToggle={(enabled) => toggle(row, e.id, enabled)}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}

                {gridQ.isLoading && (
                  <TableRow>
                    <TableCell colSpan={DEAL_NOTIFICATION_EVENTS.length + 2}
                               sx={{ color: tokens.muted }}>
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {gridQ.isError && (
                  <TableRow>
                    <TableCell colSpan={DEAL_NOTIFICATION_EVENTS.length + 2}>
                      <Alert severity="error">Could not load notification preferences.</Alert>
                    </TableCell>
                  </TableRow>
                )}
                {!gridQ.isLoading && !gridQ.isError && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={DEAL_NOTIFICATION_EVENTS.length + 2}
                               sx={{ color: tokens.muted }}>
                      Nobody in this branch can receive deal notifications.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="caption" sx={{ color: tokens.muted }}>
            Everyone is notified by default. A switch here is the same setting the person sees under
            Profile › Deal email notifications, and compliance officers appear once per branch they
            cover.
          </Typography>
        </>
      )}
    </Stack>
  );
}
