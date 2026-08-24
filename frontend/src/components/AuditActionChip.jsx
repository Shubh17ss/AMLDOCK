import { Chip } from '@mui/material';

const COLOR = {
  USER_LOGIN: 'default',
  USER_LOGIN_FAILED: 'error',
  USER_LOGOUT: 'default',
  USER_CREATED: 'info',
  USER_UPDATED: 'info',
  USER_PASSWORD_RESET: 'warning',
  USER_PASSWORD_CHANGED: 'default',
  USER_WELCOME_EMAIL_SENT: 'success',
  USER_WELCOME_EMAIL_FAILED: 'error',
  ROLE_CHANGED: 'warning',
  DEAL_CREATED: 'info',
  DEAL_SUBMITTED_FOR_REVIEW: 'primary',
  DEAL_PUT_ON_HOLD: 'warning',
  DEAL_VERIFIED: 'success',
  DEAL_CLOSED: 'default',
  DEAL_REVERTED: 'warning',
  DEAL_NOTE_ADDED: 'default',
  DEAL_OVERRIDDEN: 'warning',
  NODE_CREATED: 'info',
  NODE_UPDATED: 'default',
  NODE_DELETED: 'error',
  EDGE_CREATED: 'info',
  EDGE_UPDATED: 'default',
  EDGE_DELETED: 'error',
  DOCUMENT_UPLOADED: 'info',
  DOCUMENT_DOWNLOADED: 'default',
  DOCUMENT_DELETED: 'error',
  OCR_COMPLETED: 'success',
  OCR_FAILED: 'error',
  VERIFICATION_TRIGGERED: 'info',
  FIRM_CREATED: 'info',
  FIRM_UPDATED: 'default',
  BRANCH_CREATED: 'info',
  BRANCH_UPDATED: 'default',
  BRANCH_DELETED: 'error',
};

export function AuditActionChip({ action }) {
  return <Chip size="small" label={action} color={COLOR[action] ?? 'default'} variant="outlined" />;
}
