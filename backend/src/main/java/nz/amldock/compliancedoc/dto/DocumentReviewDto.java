package nz.amldock.compliancedoc.dto;

import nz.amldock.compliancedoc.ComplianceDocCategory;
import nz.amldock.compliancedoc.DocumentReview;

import java.time.Instant;
import java.time.LocalDate;

/**
 * A register's review schedule for the selected scope. {@code status} is derived from
 * {@code nextReviewDate} so every surface renders the same three-state indicator:
 * UNSET (no date), OVERDUE (past due), or ON_TRACK (due in the future).
 */
public record DocumentReviewDto(
        ComplianceDocCategory category,
        LocalDate nextReviewDate,
        Instant lastCompletedAt,
        String lastCompletedByEmail,
        String status
) {
    public static final String UNSET = "UNSET";
    public static final String OVERDUE = "OVERDUE";
    public static final String ON_TRACK = "ON_TRACK";

    public static String statusFor(LocalDate nextReviewDate, LocalDate today) {
        if (nextReviewDate == null) return UNSET;
        return nextReviewDate.isBefore(today) ? OVERDUE : ON_TRACK;
    }

    public static DocumentReviewDto from(DocumentReview r, LocalDate today, String completedByEmail) {
        return new DocumentReviewDto(
                r.getCategory(),
                r.getNextReviewDate(),
                r.getLastCompletedAt(),
                completedByEmail,
                statusFor(r.getNextReviewDate(), today));
    }

    /** An empty (never-configured) register still reports a concrete UNSET status. */
    public static DocumentReviewDto empty(ComplianceDocCategory category) {
        return new DocumentReviewDto(category, null, null, null, UNSET);
    }
}
