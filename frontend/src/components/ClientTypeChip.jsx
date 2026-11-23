import { Box } from '@mui/material';
import { clientRoleLabel, clientSideOf } from '../data/dealStatus.js';
import { tokens } from '../theme/theme.js';

/**
 * Which side our client is on — Vendor in green, Purchaser in the blue accent. The green is the
 * theme's success pair (the same one `Chip color="success"` uses), so it follows dark mode.
 *
 * `uppercase` is the louder form, for the top bar of a deal where it stands in for the title.
 */
export function ClientTypeChip({ transactionType, uppercase = false }) {
  const purchaser = clientSideOf(transactionType) === 'PURCHASER';
  return (
    <Box component="span" sx={{
      // Squared-off 8px corners, matching the chips on the ownership structure's cards.
      display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start',
      borderRadius: '8px', px: 1.25, py: 0.6,
      fontSize: '0.75rem', fontWeight: 600,
      color: purchaser ? tokens.blue : tokens.approved,
      backgroundColor: purchaser ? tokens.blueWash : 'var(--cl-ok-wash)',
      ...(uppercase && { textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }),
    }}>
      {clientRoleLabel(transactionType)}
    </Box>
  );
}
