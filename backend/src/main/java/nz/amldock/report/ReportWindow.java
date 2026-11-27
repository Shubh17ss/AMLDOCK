package nz.amldock.report;

import nz.amldock.common.exception.BadRequestException;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;

/**
 * The report's date window: whole calendar days in the viewer's time zone, inclusive at both ends.
 *
 * <p>Days rather than instants because a report is read in days. A deal created at 23:30 on
 * 30 June in Auckland belongs to that AML year, even though it is already 1 July in UTC. So the
 * client sends dates and its zone, and the bounds are worked out here as the half-open instant
 * range {@code [fromTs, toTs)} the timestamp columns are compared against.
 *
 * @param from  first day, or null for "since the beginning"
 * @param to    last day (inclusive)
 * @param today today in {@code zone}: what "overdue" is measured against
 */
record ReportWindow(LocalDate from, LocalDate to, ZoneId zone, LocalDate today) {

    /** Start of {@code from}, or null when the window is open-ended. */
    Instant fromTs() {
        return from == null ? null : from.atStartOfDay(zone).toInstant();
    }

    /** Start of the day after {@code to}: the exclusive upper bound. */
    Instant toTs() {
        return to.plusDays(1).atStartOfDay(zone).toInstant();
    }

    /**
     * @param tz       an IANA zone id such as {@code Pacific/Auckland}; blank falls back to
     *                 {@code fallback}
     * @param to       blank means today
     */
    static ReportWindow parse(String from, String to, String tz, ZoneId fallback) {
        ZoneId zone;
        if (tz == null || tz.isBlank()) {
            zone = fallback;
        } else {
            try {
                zone = ZoneId.of(tz.trim());
            } catch (DateTimeException e) {
                throw new BadRequestException("Unknown time zone: " + tz);
            }
        }
        LocalDate today = LocalDate.now(zone);
        LocalDate start = date(from, "from");
        LocalDate end = to == null || to.isBlank() ? today : date(to, "to");
        if (start != null && start.isAfter(end)) {
            throw new BadRequestException("The start of the report window is after its end");
        }
        return new ReportWindow(start, end, zone, today);
    }

    /** Parsed here rather than bound as a LocalDate, so a malformed date is a 400, not a 500. */
    private static LocalDate date(String value, String name) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException e) {
            throw new BadRequestException("'" + name + "' must be a date in the form YYYY-MM-DD");
        }
    }
}
