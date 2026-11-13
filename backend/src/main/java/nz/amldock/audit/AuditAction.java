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
    // Suspension used to be an indistinguishable USER_UPDATED. It is the one user change that
    // takes someone's access away, so it earns its own name in the trail.
    USER_ACTIVATED,
    USER_DEACTIVATED,
    // An existing account given a membership in another reporting entity, and a session moved
    // between entities. See MembershipService.
    USER_ADDED_TO_ENTITY,
    ENTITY_SWITCHED,
    // An email is the sign-in credential here, so a change of one is a change of credential.
    // Split three ways because they answer different questions: who asked, who confirmed it from
    // the new address, and who set one administratively without that confirmation.
    USER_EMAIL_CHANGE_REQUESTED,
    USER_EMAIL_CHANGED,
    USER_EMAIL_SET_BY_ADMIN,
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
    /** An on-hold deal was taken back into review by compliance. */
    DEAL_RESUMED,
    /** A verified owner's details or documents changed, so their verification was withdrawn. */
    NODE_VERIFICATION_CLEARED,
    DEAL_VERIFIED,
    DEAL_CLOSED,
    DEAL_REVERTED,
    DEAL_REOPENED,
    /** A closed deal was taken back to verified so its sale detail could be corrected. */
    DEAL_UNCLOSED,
    DEAL_NOTE_ADDED,
    DEAL_OVERRIDDEN,
    /**
     * An agent was let onto, or taken off, a deal they did not create. Recorded against the deal
     * rather than the user: the question anyone comes back with is who could see this file, and
     * when.
     */
    DEAL_USER_ADDED,
    DEAL_USER_REMOVED,
    /**
     * The derived rating moved because something outside the deal changed — today, an ownership
     * node answering one of the risk-raising questions. Deal edits are already covered by
     * DEAL_UPDATED; this exists so a rating that changes with no deal edit still has a cause on
     * the record.
     */
    DEAL_RISK_CHANGED,
    /** A reviewer signed off the deal's risk position. */
    DEAL_RISK_APPROVED,
    /**
     * A sign-off fell away on its own, because the score moved or because the deal gained a
     * question nobody has answered. Nothing a person did, which is exactly why it needs a line:
     * an approval that disappears silently is the kind of change an auditor asks about.
     */
    DEAL_RISK_APPROVAL_WITHDRAWN,
    /** A reviewer manually overrode the risk band, whether overruling the engine or agreeing with it. */
    DEAL_RISK_OVERRIDDEN,
    /** Someone recorded that CDD on the transaction is being delayed. */
    DEAL_CDD_DELAYED,
    /** A CDD delay was undone while the deal was still being worked. */
    DEAL_CDD_DELAY_UNDONE,
    /** A reviewer assured a signed-off version of a deal: they looked again and it holds up. */
    DEAL_VERSION_ASSURED,
    /** A reviewer found a signed-off version needs action, and recorded the issues and remediation. */
    DEAL_VERSION_ACTION_REQUIRED,
    NODE_CREATED,
    NODE_UPDATED,
    NODE_DELETED,
    /**
     * An owner was cleared, outright or by exception. Its own action rather than a NODE_UPDATED:
     * a verification is the one node write somebody is personally accountable for, and it should
     * be findable in the trail without reading every field edit on the deal.
     */
    NODE_VERIFIED,
    EDGE_CREATED,
    EDGE_UPDATED,
    EDGE_DELETED,
    STRUCTURE_REORDERED,
    DOCUMENT_UPLOADED,
    DOCUMENT_DOWNLOADED,
    DOCUMENT_DELETED,
    /** A document filed on one owner was moved to another owner on the same deal. */
    DOCUMENT_MOVED,
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
    DEAL_NOTIFICATION_EMAIL_SENT,
    DEAL_NOTIFICATION_EMAIL_FAILED,
    NOTIFICATION_PREFERENCE_UPDATED,
    OCR_COMPLETED,
    OCR_FAILED,
    VERIFICATION_TRIGGERED,
    FIRM_CREATED,
    FIRM_UPDATED,
    BRANCH_CREATED,
    BRANCH_UPDATED,
    BRANCH_DELETED,
    BRANCH_DEACTIVATED,
    BRANCH_ACTIVATED,
    FIRM_DEACTIVATED,
    FIRM_ACTIVATED,
    FIRM_DELETED,
    ENTITY_QUERY_RAISED,
    ENTITY_QUERY_RESOLVED,
    ENTITY_QUERY_DELETED
}
