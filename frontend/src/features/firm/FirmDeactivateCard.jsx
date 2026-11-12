import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { tokens } from '../../theme/theme.js';

// Shades of the theme's red, mixed rather than hard-coded so they follow light and dark mode:
// deeper for the entity's name, the base red for the heading, softer for the explanation.
const RED_DEEP = 'color-mix(in srgb, var(--cl-rejected) 78%, var(--cl-ink))';
const RED_SOFT = 'color-mix(in srgb, var(--cl-rejected) 72%, transparent)';

/**
 * The boxed deactivate section at the foot of ROOT's reporting entity page, naming the entity it
 * acts on. The button is placed now; deactivation itself is wired up in the next phase.
 */
export function FirmDeactivateCard({ firm }) {
  return (
    <Card variant="outlined" sx={{ borderColor: tokens.rejected, borderStyle: 'solid' }}>
      <CardContent>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.rejected }}>
              Deactivate reporting entity
            </Typography>
            <Typography variant="body2" sx={{ color: RED_SOFT, mt: 0.5, overflowWrap: 'anywhere' }}>
              <Box component="span" sx={{ fontWeight: 700, color: RED_DEEP }}>{firm?.name}</Box>
              {' '}— deactivating stops its users from working in AMLDOCK.
            </Typography>
          </Box>
          {/* Next phase: deactivate the entity. */}
          <Button
            disableElevation
            sx={{
              flexShrink: 0,
              px: 2.5,
              fontWeight: 700,
              color: tokens.rejected,
              backgroundColor: 'var(--cl-err-wash)',
              '&:hover': { backgroundColor: 'var(--cl-err-wash)', filter: 'brightness(0.96)' },
            }}
          >
            Deactivate
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
