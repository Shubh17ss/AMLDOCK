import { Chip } from '@mui/material';

/** Read-only Active / Deactivated label for a reporting entity or branch. */
export function ActiveStatusChip({ active }) {
  return active
    ? <Chip size="small" variant="outlined" color="success" label="Active" />
    : <Chip size="small" variant="outlined" color="default" label="Deactivated" />;
}
