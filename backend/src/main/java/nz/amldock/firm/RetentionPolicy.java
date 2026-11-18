package nz.amldock.firm;

import java.time.Instant;
import java.time.ZoneOffset;

/**
 * How long a deactivated entity's or branch's records must be kept before ROOT may delete them:
 * 5 years for an NZ entity, 7 for an AU one, counted from deactivation. A branch takes its
 * entity's country.
 *
 * <p>An active entity or branch may be deleted outright (a client that never went live). A
 * deactivated one is locked until its hold has passed.
 */
public final class RetentionPolicy {

    static final int NZ_YEARS = 5;
    static final int AU_YEARS = 7;

    private RetentionPolicy() {}

    public static int holdYears(String country) {
        return switch (country) {
            case "NZ" -> NZ_YEARS;
            case "AU" -> AU_YEARS;
            default -> throw new IllegalArgumentException("Unknown jurisdiction: " + country);
        };
    }

    /** When a row deactivated at {@code deactivatedAt} becomes deletable; null while it is active. */
    public static Instant deletionEligibleAt(String country, Instant deactivatedAt) {
        if (deactivatedAt == null) return null;
        return deactivatedAt.atZone(ZoneOffset.UTC).plusYears(holdYears(country)).toInstant();
    }

    public static boolean isDeletable(boolean active, Instant deactivatedAt, String country, Instant now) {
        if (active) return true;
        // Inactive with no recorded date cannot be placed on the clock, so it stays locked.
        if (deactivatedAt == null) return false;
        return !now.isBefore(deletionEligibleAt(country, deactivatedAt));
    }
}
