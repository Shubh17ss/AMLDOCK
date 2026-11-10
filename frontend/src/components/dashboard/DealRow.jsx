import { Box, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { tokens, fonts } from '../../theme/theme.js';
import { DealStatusChip } from '../DealStatusChip.jsx';
import { useCurrency } from '../../dashboard/useCurrency.js';
import { dealName } from '../../utils/dealName.js';

/** Compact deal row for dashboard list tiles: the address, status + value. */
export function DealRow({ deal, to }) {
  const money = useCurrency();
  return (
    <Box
      component={RouterLink}
      to={to ?? `/deals/${deal.id}`}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        py: 1, px: 0.75, textDecoration: 'none',
        borderRadius: '10px', borderBottom: `1px solid ${tokens.hairline}`,
        transition: 'background-color 0.15s ease',
        '&:hover': { backgroundColor: tokens.hover },
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography noWrap sx={{ fontSize: '0.86rem', fontWeight: 600, color: tokens.ink }}>
          {dealName(deal.propertyAddress)}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <DealStatusChip status={deal.status} />
        <Typography sx={{ mt: 0.4, fontFamily: fonts.mono, fontSize: '0.72rem', color: tokens.muted }}>
          {money.dealRangeCompact(deal)}
        </Typography>
      </Box>
    </Box>
  );
}
