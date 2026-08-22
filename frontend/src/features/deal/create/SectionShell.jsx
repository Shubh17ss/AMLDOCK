import { Box, Card, CardContent, Divider, Stack, Typography } from '@mui/material';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import { tokens, fonts, shadows } from '../../../theme/theme.js';

/** Mobile-first progress bar — the desktop Stepper is too wide for a phone. */
export function SectionProgress({ index, total, label }) {
  return (
    <Box>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography sx={{
          fontFamily: fonts.mono, fontSize: '0.66rem', fontWeight: 700, color: tokens.muted,
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          Section {index + 1} of {total}
        </Typography>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: tokens.blue }}>
          {label}
        </Typography>
      </Stack>
      <Box sx={{ height: 6, borderRadius: 999, backgroundColor: tokens.hover, overflow: 'hidden' }}>
        <Box sx={{
          height: '100%',
          width: `${((index + 1) / total) * 100}%`,
          backgroundColor: tokens.blue,
          borderRadius: 999,
          transition: 'width 0.4s cubic-bezier(0.34, 1.2, 0.64, 1)',
        }} />
      </Box>
    </Box>
  );
}

/**
 * Whether the broker's progress is on the server yet.
 *
 * Worth showing plainly: this form saves as they go and they can leave and come back, but
 * only once a draft exists. Silence would leave them guessing which state they're in.
 */
export function SaveStateChip({ state, hasDraft }) {
  if (!hasDraft) {
    return (
      <Typography variant="caption" sx={{ color: tokens.muted }}>
        Not saved yet — your draft is created when you reach section 3
      </Typography>
    );
  }
  const map = {
    saving: { Icon: CloudSyncIcon, text: 'Saving…', color: tokens.muted },
    saved:  { Icon: CloudDoneIcon, text: 'Draft saved', color: tokens.approved },
    error:  { Icon: CloudOffIcon,  text: 'Not saved — retrying', color: tokens.rejected },
    idle:   { Icon: CloudDoneIcon, text: 'Draft saved', color: tokens.muted },
  };
  const { Icon, text, color } = map[state] ?? map.idle;
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Icon sx={{ fontSize: '1rem', color }} />
      <Typography variant="caption" sx={{ color }}>{text}</Typography>
    </Stack>
  );
}

/** The card each section's fields sit in — one heading, one hairline, one stack. */
export function SectionCard({ title, subtitle, children }) {
  return (
    <Card sx={{ boxShadow: shadows.sm }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontFamily: fonts.display, fontWeight: 700 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: tokens.muted, mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
        <Divider sx={{ my: 2 }} />
        <Stack spacing={2.5}>{children}</Stack>
      </CardContent>
    </Card>
  );
}

/** A labelled group of related questions inside a section. */
export function FieldGroup({ title, children }) {
  return (
    <Box>
      <Typography sx={{
        fontFamily: fonts.mono, fontSize: '0.62rem', letterSpacing: '0.12em',
        textTransform: 'uppercase', color: tokens.muted, mb: 1.25,
      }}>
        {title}
      </Typography>
      <Stack spacing={2.5}>{children}</Stack>
    </Box>
  );
}
