package nz.amldock.deal.assurance;

/**
 * Where compliance's second look at a signed-off version stands.
 *
 * <p>There is no NOT_REVIEWED value: a version nobody has looked at carries a null, so the
 * database cannot hold a "not reviewed" that somebody wrote a note and a byline against.
 */
public enum AssuranceStatus {
    ASSURED,
    UNASSURED
}
