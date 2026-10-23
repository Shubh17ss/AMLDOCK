package nz.amldock.user;

/**
 * The two facts about a user that decide whether an access token issued to them still holds:
 * its {@code tv} claim must equal {@code tokenVersion}, and the user must be active.
 */
public record TokenState(int tokenVersion, boolean active) {}
