import { Card, CardContent, Stack, Typography } from '@mui/material';

export function PlaceholderPage({ title, detail }) {
  return (
    <Stack spacing={3}>
      <Typography variant="h4">{title}</Typography>
      <Card>
        <CardContent>
          <Typography color="text.secondary">{detail}</Typography>
        </CardContent>
      </Card>
    </Stack>
  );
}
