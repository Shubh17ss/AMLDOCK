import { useQuery } from '@tanstack/react-query';
import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import { getVerificationTrail } from '../../api/ownership.js';
import { tokens, fonts } from '../../theme/theme.js';
import { formatVerifiedAt, verificationDisplay } from './verificationDisplay.js';
import { dealName } from '../../utils/dealName.js';

/**
 * The verifications granted to this owner on every deal they have been picked onto.
 *
 * <p>Other deals only — this deal's verification is the card above. Absent when there are none.
 * Each deal opens its latest state; one the viewer cannot read still links, and the deal screen
 * answers with its not-found view.
 */
export function VerificationTrail({ dealId, nodeId, onOpenDeal }) {
  const q = useQuery({
    queryKey: ['verificationTrail', dealId, nodeId],
    queryFn: () => getVerificationTrail(dealId, nodeId),
    enabled: Boolean(dealId && nodeId),
  });
  const entries = (q.data ?? []).filter((e) => !e.currentDeal);
  if (entries.length === 0) return null;

  return (
    <Box>
      <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: tokens.ink, mb: 1 }}>
        Verification trail
      </Typography>
      {/* <Typography variant="caption" sx={{ display: 'block', color: tokens.muted, mb: 1.25 }}>
        This owner has been verified on other deals too.
      </Typography> */}
      <Stack spacing={1}>
        {entries.map((e) => (
          <TrailRow key={e.nodeId} entry={e} onOpen={() => onOpenDeal?.(e.dealId)} />
        ))}
      </Stack>
    </Box>
  );
}

function TrailRow({ entry: e, onOpen }) {
  const display = verificationDisplay(e.verificationStatus);
  const stamp = [e.verifiedByName && `by ${e.verifiedByName}`, formatVerifiedAt(e.verifiedAt)]
    .filter(Boolean).join(' · ');

  const body = (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ width: '100%', minWidth: 0 }}>
      <Box sx={{ flexGrow: 1, minWidth: 0, textAlign: 'left' }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: '0.88rem', fontWeight: 600, color: tokens.ink,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {dealName(e.propertyAddress)}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: display.text }}>
            {display.label}
          </Typography>
          {display.exception && (
            <ReportProblemOutlinedIcon sx={{ fontSize: '0.9rem', color: 'var(--cl-warn-text)' }} />
          )}
          {stamp && (
            <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.72rem', color: tokens.muted }}>
              {stamp}
            </Typography>
          )}
        </Stack>
      </Box>
      <ChevronRightIcon fontSize="small" sx={{ color: tokens.muted }} />
    </Stack>
  );

  return (
    <ButtonBase
      onClick={onOpen}
      sx={{
        display: 'flex', width: '100%', p: 1.25, borderRadius: '10px',
        border: `1px solid ${tokens.hairline}`,
        '&:hover': { borderColor: tokens.blue, backgroundColor: tokens.blueWash },
      }}
      aria-label={`Open ${dealName(e.propertyAddress)}`}
    >
      {body}
    </ButtonBase>
  );
}
