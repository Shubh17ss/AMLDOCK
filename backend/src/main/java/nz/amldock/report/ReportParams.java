package nz.amldock.report;

/**
 * The query string every report section takes.
 *
 * @param firmId   required of ROOT and AUDIT; anyone else is pinned to their own firm
 * @param branchId null for the whole firm
 * @param from     first day of the window, {@code YYYY-MM-DD}, inclusive; blank for "all time"
 * @param to       last day of the window, inclusive; blank for today
 * @param tz       the viewer's IANA time zone, which decides where each day starts; blank falls
 *                 back to the firm's country
 */
public record ReportParams(Long firmId, Long branchId, String from, String to, String tz) {
}
