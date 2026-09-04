import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { formatDate } from '../../utils/formatters.js';
import { tokens, fonts } from '../../theme/theme.js';

/**
 * Says, unmistakably, that the page is not showing the live deal.
 *
 * <p>Everything below it renders in the same components the live deal uses, so without this a
 * reviewer could read a two-month-old ownership structure believing it current. That is the one
 * genuinely dangerous failure mode of the whole feature, which is why the banner is a persistent
 * warning rather than a subtle marker, and why the way back out sits inside it.
 */
export function DealVersionBanner({ summary, onBackToCurrent }) {
  if (!summary) return null;

  return (
    <Alert
      severity="warning"
      icon={false}
      sx={{ py: 0.75, borderLeft: `3px solid ${tokens.review}` }}
      action={(
        <Button size="small" onClick={onBackToCurrent} sx={{ whiteSpace: 'nowrap' }}>
          Back to current
        </Button>
      )}
    >
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Chip
          label={`v${summary.versionNo}`}
          size="small"
          sx={{ height: 20, fontFamily: fonts.mono, fontSize: '0.7rem' }}
        />
        <Typography sx={{ fontSize: '0.85rem', color: tokens.ink }}>
          Viewing this deal <strong>as it was signed off</strong> on {formatDate(summary.verifiedAt)}
          {' by '}{summary.verifiedByName || summary.verifiedByEmail || 'a reviewer'}. It is
          read-only, and nothing done to the deal since has changed it.
        </Typography>
      </Stack>

      {summary.verifyNote && (
        <Box sx={{ mt: 0.5 }}>
          <Typography sx={{ fontSize: '0.8rem', color: tokens.ink, fontStyle: 'italic' }}>
            “{summary.verifyNote}”
          </Typography>
        </Box>
      )}

      {summary.reopenedAt && (
        <Typography sx={{ fontSize: '0.75rem', color: tokens.muted, mt: 0.5 }}>
          Reopened {formatDate(summary.reopenedAt)} by {summary.reopenedByName || 'a reviewer'}
          {summary.reopenNote ? ` — ${summary.reopenNote}` : ''}
        </Typography>
      )}
    </Alert>
  );
}
