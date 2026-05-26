import { Paper, Skeleton, Stack } from '@mui/material';

export function SkeletonTable({ rows = 6, columns = 7 }) {
  return (
    <Paper variant="outlined" sx={{ p: 1 }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={2}>
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} variant="text" width={`${100 / columns}%`} height={32} />
          ))}
        </Stack>
        {Array.from({ length: rows }).map((_, r) => (
          <Stack key={r} direction="row" spacing={2}>
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} variant="rectangular" width={`${100 / columns}%`} height={24} />
            ))}
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
