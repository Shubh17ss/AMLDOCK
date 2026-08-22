import { Chip } from '@mui/material';
import { dealStatusColor, dealStatusLabel } from '../data/dealStatus.js';

/** A deal's lifecycle position. Reads "In review", never "UNDER_REVIEW". */
export function DealStatusChip({ status, size = 'small' }) {
  return <Chip size={size} label={dealStatusLabel(status)} color={dealStatusColor(status)} />;
}
