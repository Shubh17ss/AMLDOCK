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
  DEAL_RESUMED: 'primary',
  DEAL_VERIFIED: 'success',
  DEAL_CLOSED: 'default',
  DEAL_REVERTED: 'warning',
  DEAL_NOTE_ADDED: 'default',
  DEAL_OVERRIDDEN: 'warning',
  NODE_CREATED: 'info',
  NODE_UPDATED: 'default',
  NODE_VERIFICATION_CLEARED: 'warning',
  NODE_DELETED: 'error',
  EDGE_CREATED: 'info',
  EDGE_UPDATED: 'default',
  EDGE_DELETED: 'error',
  STRUCTURE_REORDERED: 'default',
  DOCUMENT_UPLOADED: 'info',
  DOCUMENT_DOWNLOADED: 'default',
  DOCUMENT_DELETED: 'error',
  DOCUMENT_MOVED: 'info',
  OCR_COMPLETED: 'success',
  OCR_FAILED: 'error',
  VERIFICATION_TRIGGERED: 'info',
  FIRM_CREATED: 'info',
  FIRM_UPDATED: 'default',
  FIRM_DEACTIVATED: 'warning',
  FIRM_ACTIVATED: 'success',
  FIRM_DELETED: 'error',
  BRANCH_CREATED: 'info',
  BRANCH_UPDATED: 'default',
  BRANCH_DELETED: 'error',
  BRANCH_DEACTIVATED: 'warning',
  BRANCH_ACTIVATED: 'success',
  ENTITY_QUERY_RAISED: 'info',
  ENTITY_QUERY_RESOLVED: 'success',
  ENTITY_QUERY_DELETED: 'error',
};

/** `DEAL_SUBMITTED_FOR_REVIEW` → "Deal submitted for review". The stored value is unchanged. */
export function auditActionLabel(action) {
  if (!action) return '';
  const text = action.toLowerCase().replace(/_/g, ' ').replace(/\bocr\b/, 'OCR');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function AuditActionChip({ action }) {
  return <Chip size="small" label={auditActionLabel(action)} color={COLOR[action] ?? 'default'} variant="outlined" />;
}
