import { Card, CardContent, Stack, Typography } from '@mui/material';
import { tokens } from '../theme/theme.js';

export function PlaceholderPage({ title, detail }) {
  return (
    <Stack spacing={3}>
      <Typography variant="h4">{title}</Typography>
      <Card>
        <CardContent>
          <Typography sx={{ color: tokens.muted }}>{detail}</Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}
