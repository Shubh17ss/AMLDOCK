package nz.amldock.audit;

public enum AuditAction {
    USER_LOGIN,
    USER_LOGIN_FAILED,
    USER_LOGOUT,
    USER_OTP_REQUESTED,
    USER_OTP_FAILED,
    USER_CREATED,
    USER_UPDATED,
    USER_DELETED,
    USER_PASSWORD_RESET,
    USER_PASSWORD_CHANGED,
    USER_WELCOME_EMAIL_SENT,
    USER_WELCOME_EMAIL_FAILED,
    ROLE_CHANGED,
    DEAL_CREATED,
    // The lifecycle verbs. One per DealAction, plus the free-comment case. The column has
    // no DB CHECK, but it is mapped @Enumerated(STRING), so a value dropped from this enum
    // throws when an old row is read — V29 and V38 remap the names this set replaced.
    DEAL_SUBMITTED_FOR_REVIEW,
    DEAL_PUT_ON_HOLD,
    DEAL_VERIFIED,
    DEAL_CLOSED,
    DEAL_REVERTED,
    DEAL_NOTE_ADDED,
    DEAL_OVERRIDDEN,
    /**
     * The derived rating moved because something outside the deal changed — today, an ownership
     * node answering one of the risk-raising questions. Deal edits are already covered by
     * DEAL_UPDATED; this exists so a rating that changes with no deal edit still has a cause on
     * the record.
     */
    DEAL_RISK_CHANGED,
    NODE_CREATED,
    NODE_UPDATED,
    NODE_DELETED,
    EDGE_CREATED,
    EDGE_UPDATED,
    EDGE_DELETED,
    DOCUMENT_UPLOADED,
    DOCUMENT_DOWNLOADED,
    DOCUMENT_DELETED,
    DOCUMENT_REVIEW_SET,
    DOCUMENT_REVIEW_COMPLETED,
    FUND_TRANSACTION_CREATED,
    FUND_TRANSACTION_DELETED,
    SUSPICIOUS_ACTIVITY_CREATED,
    SUSPICIOUS_ACTIVITY_DELETED,
    TRAINING_PROVIDER_CREATED,
    TRAINING_PROVIDER_DELETED,
    TRAINING_SESSION_CREATED,
    TRAINING_SESSION_UPDATED,
    TRAINING_SESSION_DELETED,
    TRAINING_SESSION_COMPLETED,
    TRAINING_SESSION_COMPLETION_CLEARED,
    TRAINING_COURSE_CREATED,
    TRAINING_COURSE_UPDATED,
    TRAINING_COURSE_DELETED,
    TRAINING_COURSE_ATTEMPTED,
    TRAINING_COURSE_COMPLETED,
    TRAINING_ASSIGNMENT_EMAIL_SENT,
    TRAINING_ASSIGNMENT_EMAIL_FAILED,
    OCR_COMPLETED,
    OCR_FAILED,
    VERIFICATION_TRIGGERED,
    FIRM_CREATED,
    FIRM_UPDATED,
    BRANCH_CREATED,
    BRANCH_UPDATED,
    BRANCH_DELETED
}
