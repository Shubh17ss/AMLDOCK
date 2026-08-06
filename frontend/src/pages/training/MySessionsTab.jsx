import { Alert, Box, Chip, Link, Paper, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutlined';
import PendingIcon from '@mui/icons-material/PendingOutlined';
import PlaceIcon from '@mui/icons-material/PlaceOutlined';
import EventIcon from '@mui/icons-material/EventOutlined';
import SchoolIcon from '@mui/icons-material/SchoolOutlined';
import BusinessIcon from '@mui/icons-material/BusinessOutlined';
import { tokens, fonts } from '../../theme/theme.js';

const dateFmt = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

// The session date has passed and it still hasn't been marked off.
const isOverdue = (s) =>
  Boolean(s.sessionDate) && !s.myCompletedAt
  && new Date(s.sessionDate) < new Date(new Date().toDateString());

/** One line of session metadata with a leading glyph. */
function Meta({ icon, children }) {
  if (!children) return null;
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box sx={{ display: 'inline-flex', color: tokens.muted, '& svg': { fontSize: 16 } }}>{icon}</Box>
      <Typography sx={{ fontSize: '0.82rem', color: tokens.muted }}>{children}</Typography>
    </Stack>
  );
}

/**
 * My Training › Sessions — instructor-led training the user attends.
 *
 * Read-only by design: attendance is recorded by whoever ran the session, from Staff Training ›
 * Sessions, so there is nothing to self-declare here. The page fetches with `mine`, so this only
 * ever receives their own assignments, and for firm-level staff those can come from more than one
 * branch — hence the branch on each card.
 */
export function MySessionsTab({ sessions, isLoading, isError }) {
  return (
    <Stack spacing={2}>
      {isError && <Alert severity="error">Failed to load your sessions. Refresh to try again.</Alert>}

      {sessions.map((s) => {
        const done = Boolean(s.myCompletedAt);
        const overdue = isOverdue(s);
        return (
          <Paper
            key={s.id}
            sx={{
              p: 2.5,
              borderLeft: `3px solid ${done ? tokens.approved : (overdue ? tokens.rejected : tokens.blue)}`,
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              alignItems={{ xs: 'stretch', sm: 'center' }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: tokens.ink }}>
                    {s.name}
                  </Typography>
                  {overdue && (
                    <Chip size="small" label="Overdue" sx={{
                      color: tokens.rejected, backgroundColor: `${tokens.rejected}14`,
                      fontWeight: 700, fontSize: '0.68rem',
                    }} />
                  )}
                </Stack>

                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                  <Meta icon={<SchoolIcon />}>{s.providerName}</Meta>
                  <Meta icon={<PlaceIcon />}>{s.location}</Meta>
                  <Meta icon={<EventIcon />}>{dateFmt(s.sessionDate)}</Meta>
                  <Meta icon={<BusinessIcon />}>{s.branchName}</Meta>
                </Stack>

                {s.description && (
                  <Typography sx={{
                    fontSize: '0.85rem', color: tokens.ink, whiteSpace: 'pre-wrap', mt: 1,
                  }}>
                    {s.description}
                  </Typography>
                )}

                <Typography sx={{
                  fontFamily: fonts.mono, fontSize: '0.75rem', color: tokens.muted, mt: 1,
                }}>
                  {s.totalMinutes} min
                </Typography>

                {s.url && (
                  <Link href={s.url} target="_blank" rel="noopener"
                        sx={{ fontSize: '0.82rem', mt: 1, display: 'inline-block', wordBreak: 'break-all' }}>
                    Open course link
                  </Link>
                )}
              </Box>

              {/* Status only — your compliance team records attendance, you don't. */}
              <Box sx={{ flexShrink: 0 }}>
                {done ? (
                  <Chip
                    icon={<CheckCircleIcon sx={{ fontSize: 16, color: `${tokens.approved} !important` }} />}
                    label={`Attended ${dateFmt(s.myCompletedAt)}`}
                    sx={{
                      color: tokens.approved, backgroundColor: `${tokens.approved}14`,
                      fontWeight: 600, fontSize: '0.75rem',
                    }}
                  />
                ) : (
                  <Chip
                    icon={<PendingIcon sx={{ fontSize: 16, color: `${tokens.review} !important` }} />}
                    label="Attendance not recorded"
                    sx={{
                      color: tokens.review, backgroundColor: `${tokens.review}14`,
                      fontWeight: 600, fontSize: '0.75rem',
                    }}
                  />
                )}
              </Box>
            </Stack>
          </Paper>
        );
      })}

      {!isLoading && sessions.length === 0 && (
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: tokens.ink }}>
            No sessions assigned
          </Typography>
          <Typography sx={{ fontSize: '0.875rem', color: tokens.muted, mt: 0.5 }}>
            Sessions assigned to you by your compliance team will appear here.
          </Typography>
        </Paper>
      )}
    </Stack>
  );
}
