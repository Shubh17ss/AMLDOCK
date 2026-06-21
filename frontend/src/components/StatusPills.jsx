import { Box, Typography } from '@mui/material';
import { tokens } from '../theme/theme.js';

const NEU_ACCENT = tokens.blue;
const NEU_MUTED  = tokens.muted;

const STATUS_DOTS = {
  ALL:          tokens.muted,
  DRAFT:        tokens.draft,
  SUBMITTED:    tokens.submitted,
  UNDER_REVIEW: tokens.review,
  APPROVED:     tokens.approved,
  REJECTED:     tokens.rejected,
};

export function StatusPills({ value, onChange, options }) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        overflowX: 'auto',
        pb: 0.5,
        // Hide scrollbar cross-browser
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        msOverflowStyle: 'none',
      }}
    >
      {options.map((opt) => {
        const active = value === opt;
        return (
          <Box
            key={opt}
            component="button"
            onClick={() => onChange(opt)}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              borderRadius: 999,
              border: 'none',
              px: 2,
              py: 0.9,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              fontFamily: 'inherit',
              backgroundColor: active ? tokens.blueWash : tokens.tile,
              border: `1px solid ${active ? 'transparent' : tokens.hairline}`,
              transition: 'background-color 0.2s ease, border-color 0.2s ease',
              '&:hover': { borderColor: active ? 'transparent' : tokens.hairline2 },
            }}
          >
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: STATUS_DOTS[opt] ?? NEU_MUTED,
                flexShrink: 0,
                opacity: active ? 1 : 0.6,
              }}
            />
            <Typography sx={{
              fontSize: '0.75rem',
              fontWeight: active ? 700 : 500,
              color: active ? NEU_ACCENT : NEU_MUTED,
              letterSpacing: '0.02em',
              lineHeight: 1,
            }}>
              {opt === 'ALL' ? 'All' :
               opt === 'UNDER_REVIEW' ? 'In review' :
               opt.charAt(0) + opt.slice(1).toLowerCase()}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
