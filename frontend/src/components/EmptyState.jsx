import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';

export function EmptyState({ icon = <InboxIcon sx={{ fontSize: 48, color: 'text.disabled' }} />,
                             title, description, action, secondaryAction }) {
  return (
    <Paper variant="outlined" sx={{ py: 6, px: 4 }}>
      <Stack spacing={2} alignItems="center">
        <Box>{icon}</Box>
        <Typography variant="h6">{title}</Typography>
        {description && (
          <Typography color="text.secondary" variant="body2" sx={{ textAlign: 'center', maxWidth: 480 }}>
            {description}
          </Typography>
        )}
        <Stack direction="row" spacing={1}>
          {action}
          {secondaryAction}
        </Stack>
      </Stack>
    </Paper>
  );
}
