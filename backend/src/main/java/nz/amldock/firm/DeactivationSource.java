package nz.amldock.firm;

/**
 * What switched a branch or membership off. Switching the cause back on restores only the rows it
 * switched off itself. See V69__offboarding.sql.
 */
public enum DeactivationSource {
    /** Someone switched this row off directly. */
    MANUAL,
    /** A membership switched off because its branch was deactivated. */
    BRANCH,
    /** A branch switched off because its entity was deactivated. */
    FIRM
}
