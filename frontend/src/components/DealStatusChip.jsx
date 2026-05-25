import { Chip } from '@mui/material';

const COLOR_BY_STATUS = {
  DRAFT: 'default',
  SUBMITTED: 'info',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
};

export function DealStatusChip({ status }) {
  return <Chip size="small" label={status} color={COLOR_BY_STATUS[status] ?? 'default'} />;
}
