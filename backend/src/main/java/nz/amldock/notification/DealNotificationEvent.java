package nz.amldock.notification;

/**
 * The deal events a user can subscribe to by email.
 *
 * <p>Adding one means: a value here, a widened CHECK on both {@code event_type} columns, an arm in
 * {@link NotificationDefaults}, a template pair under {@code resources/email-templates}, and a call
 * site in {@link DealNotificationEnqueuer}. Nothing structural.
 *
 * <p>The name is persisted as a string in two tables, so renaming a constant is a migration, not a
 * refactor.
 */
public enum DealNotificationEvent {

    /** A broker (or an officer on their behalf) opened a new deal. */
    DEAL_CREATED("deal-created", "New deal"),

    /**
     * A deal moved between {@link nz.amldock.deal.DealStatus} values — submitted, put on hold,
     * verified, closed, reverted, or overridden. One event rather than six: the from/to pair is in
     * the payload, and a subscriber who wants to hear about verification almost always wants to
     * hear about a hold too.
     */
    DEAL_STATUS_CHANGED("deal-status-changed", "Deal status change");

    private final String templateName;
    private final String label;

    DealNotificationEvent(String templateName, String label) {
        this.templateName = templateName;
        this.label = label;
    }

    /**
     * The SES template name, which is also the basename of the template resources on disk.
     * {@link nz.amldock.email.ses.SesTemplateProvisioner} relies on the two matching.
     */
    public String templateName() {
        return templateName;
    }

    /** Human label for the preferences UI and log lines. */
    public String label() {
        return label;
    }
}
