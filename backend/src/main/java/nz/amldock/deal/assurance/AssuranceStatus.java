package nz.amldock.deal.assurance;

/**
 * The result of compliance's second look at a signed-off version.
 *
 * <p>There is no NOT_REVIEWED value: a version nobody has looked at carries a null, so "not
 * reviewed" can never be stamped with a byline as though somebody decided it.
 */
public enum AssuranceStatus {
    /** Passed: the sign-off holds up. */
    ASSURED,
    /** Issues were found; each is recorded with its planned remediation. */
    ACTION_REQUIRED
}
