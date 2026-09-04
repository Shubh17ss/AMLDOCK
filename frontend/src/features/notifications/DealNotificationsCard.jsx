import { useMemo, useState } from 'react';
import {
  Alert, Card, CardContent, Divider, FormControlLabel, Paper, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { InstantSwitch } from '../../components/InstantSwitch.jsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import {
  DEAL_NOTIFICATION_EVENTS, canReceiveDealNotifications, choosesNotificationsPerBranch,
} from '../../auth/roles.js';
import {
  getMyNotificationPreferences, updateMyNotificationPreferences,
} from '../../api/notificationPreferences.js';
import { SearchField, matchesSearch } from '../../components/SearchField.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { tokens } from '../../theme/theme.js';

/**
 * The signed-in user's own deal email toggles, for the Profile page.
 *
 * Two shapes from one payload. Branch-level staff have exactly one branch, so they get a switch per
 * event and never see the word "branch". Compliance officers and senior managers have no branch of
 * their own and see deals across the whole firm, so they choose branch by branch — a firm can hold
 * up to a hundred, hence the search box and the select-all row.
 */
export function DealNotificationsCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');

  const eligible = canReceiveDealNotifications(user?.role);
  const perBranch = choosesNotificationsPerBranch(user?.role);

  const prefsQ = useQuery({
    queryKey: ['notification-preferences', 'me'],
    queryFn: getMyNotificationPreferences,
    enabled: eligible,
  });

  const save = useMutation({
    mutationFn: updateMyNotificationPreferences,
    onSuccess: (data) => {
      qc.setQueryData(['notification-preferences', 'me'], data);
      // The Settings matrix reads the same rows, so it must not keep a stale copy.
      qc.invalidateQueries({ queryKey: ['notification-preferences'] });
      showToast({ severity: 'success', message: 'Notification preferences saved' });
    },
    onError: (err) => showToast({
      severity: 'error',
      message: err.response?.data?.message || 'Could not save notification preferences',
    }),
  });

  const preferences = prefsQ.data?.preferences ?? [];

  // One row per branch, columns keyed by event — the shape both layouts render from.
  const branches = useMemo(() => {
    const byBranch = new Map();
    for (const p of preferences) {
      if (!byBranch.has(p.firmBranchId)) {
        byBranch.set(p.firmBranchId, { id: p.firmBranchId, name: p.branchName, events: {} });
      }
      byBranch.get(p.firmBranchId).events[p.eventType] = p;
    }
    return [...byBranch.values()];
  }, [preferences]);

  const visible = useMemo(
    () => branches.filter((b) => matchesSearch(search, b.name)),
    [branches, search],
  );

  // mutateAsync rather than mutate: InstantSwitch holds the thumb where the user put it until this
  // resolves, and onSuccess above seeds the cache from the response, so by then `checked` is right.
  const toggle = (branchId, eventType, enabled) =>
    save.mutateAsync([{ firmBranchId: branchId, eventType, enabled }]);

  /** Sets one event across every branch currently in view, in a single request. */
  const toggleAll = (eventType, enabled) =>
    save.mutateAsync(visible.map((b) => ({ firmBranchId: b.id, eventType, enabled })));

  if (!eligible) {
    return (
      <Section>
        <Typography variant="body2" sx={{ color: tokens.muted }}>
          Deal notifications go to the people working a deal — brokers, branch staff, and compliance
          officers. Your role does not receive them.
        </Typography>
      </Section>
    );
  }

  if (prefsQ.isLoading) {
    return <Section><Typography variant="body2" sx={{ color: tokens.muted }}>Loading…</Typography></Section>;
  }

  if (prefsQ.isError) {
    return <Section><Alert severity="error">Could not load your notification preferences.</Alert></Section>;
  }

  if (branches.length === 0) {
    return (
      <Section>
        <Typography variant="body2" sx={{ color: tokens.muted }}>
          No active branch is linked to your account yet, so there is nothing to be notified about.
        </Typography>
      </Section>
    );
  }

  // ── Branch-level staff: one switch per event, no branch dimension to show ──
  if (!perBranch) {
    const only = branches[0];
    return (
      <Section subtitle={`Deals at ${only.name}`}>
        <Stack spacing={1}>
          {DEAL_NOTIFICATION_EVENTS.map((e) => (
            <FormControlLabel
              key={e.id}
              control={(
                <InstantSwitch
                  checked={Boolean(only.events[e.id]?.enabled)}
                  onToggle={(enabled) => toggle(only.id, e.id, enabled)}
                />
              )}
              label={e.label}
            />
          ))}
        </Stack>
      </Section>
    );
  }

  // ── Firm-level staff: a branch × event grid ──
  return (
    <Section subtitle="You see deals across the whole entity, so choose branch by branch.">
      <Stack spacing={2}>
        {branches.length > 8 && (
          <SearchField value={search} onChange={setSearch} placeholder="Filter branches…" />
        )}
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Branch</TableCell>
                {DEAL_NOTIFICATION_EVENTS.map((e) => (
                  <TableCell key={e.id} align="center">{e.label}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Select-all, scoped to what the filter is showing rather than to every branch —
                  otherwise it would silently change rows the user cannot see. */}
              <TableRow>
                <TableCell sx={{ color: tokens.muted }}>
                  All {search ? 'matching ' : ''}branches
                </TableCell>
                {DEAL_NOTIFICATION_EVENTS.map((e) => {
                  const on = visible.filter((b) => b.events[e.id]?.enabled).length;
                  return (
                    <TableCell key={e.id} align="center">
                      <InstantSwitch
                        checked={visible.length > 0 && on === visible.length}
                        indeterminate={on > 0 && on < visible.length}
                        disabled={visible.length === 0}
                        onToggle={(enabled) => toggleAll(e.id, enabled)}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
              {visible.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.name}</TableCell>
                  {DEAL_NOTIFICATION_EVENTS.map((e) => (
                    <TableCell key={e.id} align="center">
                      <InstantSwitch
                        checked={Boolean(b.events[e.id]?.enabled)}
                        onToggle={(enabled) => toggle(b.id, e.id, enabled)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={DEAL_NOTIFICATION_EVENTS.length + 1}
                             sx={{ color: tokens.muted }}>
                    No branch matches that filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Section>
  );
}

function Section({ subtitle, children }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Deal email notifications</Typography>
        <Divider sx={{ mb: 2 }} />
        {subtitle && (
          <Typography variant="body2" sx={{ color: tokens.muted, mb: 2 }}>{subtitle}</Typography>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
