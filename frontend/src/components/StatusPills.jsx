import { Box, Typography } from '@mui/material';

const NEU_BASE   = '#E0E5EC';
const NEU_ACCENT = '#6C63FF';
const NEU_MUTED  = '#6B7280';
const EXT_SM     = '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)';
const INSET_SM   = 'inset 3px 3px 6px rgb(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5)';

const STATUS_DOTS = {
  ALL:          '#6B7280',
  DRAFT:        '#9CA3AF',
  SUBMITTED:    '#6C63FF',
  UNDER_REVIEW: '#F59E0B',
  APPROVED:     '#38B2AC',
  REJECTED:     '#EF4444',
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
              backgroundColor: NEU_BASE,
              boxShadow: active ? INSET_SM : EXT_SM,
              transition: 'box-shadow 0.2s ease',
              '&:active': { boxShadow: INSET_SM },
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
