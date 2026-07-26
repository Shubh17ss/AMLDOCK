import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { tokens } from '../../theme/theme.js';

/**
 * Shared three-state review-status presentation so every surface (the register section
 * and the module cards) renders the same icon + colour:
 *   ON_TRACK → green check · OVERDUE → red alert · UNSET → orange exclamation.
 */
export const REVIEW_META = {
  ON_TRACK: { Icon: CheckCircleRoundedIcon,   color: tokens.approved, label: 'On track' },
  OVERDUE:  { Icon: ErrorRoundedIcon,         color: tokens.rejected, label: 'Overdue' },
  UNSET:    { Icon: WarningAmberRoundedIcon,  color: tokens.review,   label: 'No review date' },
};

export const reviewMetaFor = (status) => REVIEW_META[status] ?? REVIEW_META.UNSET;
