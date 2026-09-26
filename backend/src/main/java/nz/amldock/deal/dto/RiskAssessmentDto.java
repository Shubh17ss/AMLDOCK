package nz.amldock.deal.dto;

import nz.amldock.deal.Deal;
import nz.amldock.deal.DealRiskService.RiskAssessment;
import nz.amldock.deal.RiskRating;
import nz.amldock.deal.RiskRatingSource;

import java.time.Instant;
import java.util.List;

/**
 * Everything the Risk tab needs, in one read.
 *
 * <p>Two ratings, deliberately. {@code calculatedRating} is what the file says on its own;
 * {@code rating} is what the deal currently carries, which differs only while a reviewer has
 * pinned it. Showing one without the other would leave nobody able to tell whether an override
 * is still doing anything — the override dialog puts them side by side for exactly that reason.
 *
 * <p>{@code factors} and {@code unanswered} are the workings. They come from the server rather
 * than being recomputed in the browser: the scale lives in {@code CountryRisk} and
 * {@code DealRiskService}, and a second copy in JavaScript would be free to disagree with the
 * number printed beside it.
 */
public record RiskAssessmentDto(
        Long dealId,
        int riskValue,
        /** The band the score falls in, ignoring any override. */
        RiskRating calculatedRating,
        /** What the deal carries today — the calculated band, or the pinned one. */
        RiskRating rating,
        RiskRatingSource source,
        String overrideComment,
        /**
         * Who pinned the rating by hand, and when. Both null unless the source is OVERRIDE.
         *
         * <p>A name rather than a login: a byline reading "amlco@firm.com" identifies an account,
         * and the question a reviewer is asking of an override is who decided it.
         */
        String overriddenByName,
        Instant overriddenAt,
        boolean approved,
        /** The stable identifier behind {@link #approvedByName}. */
        Long approvedByUserId,
        String approvedByName,
        Instant approvedAt,
        /** True when nothing is left unanswered, which is what gates approval. */
        boolean complete,
        List<FactorDto> factors,
        List<GapDto> unanswered
) {

    /**
     * One answer that added points, and which owner it came from. Null node = the deal itself.
     *
     * <p>{@code label} is the question and {@code value} is the answer, kept apart so the card
     * can lay them out rather than print a sentence the server chose. {@code value} is null on
     * the country factors, which carry {@code countryCode} instead — the tab renders a flag and
     * the country's full name from it.
     *
     * <p>{@code nodeType} keys the frontend's owner-type glyph table directly.
     */
    public record FactorDto(String code, String label, String value, int points,
                            Long nodeId, String nodeName, String nodeType, String countryCode) {}

    /** One question that bears on the score and has not been answered. */
    public record GapDto(String code, String label, Long nodeId, String nodeName,
                         String nodeType) {}

    public static RiskAssessmentDto of(Deal deal, RiskAssessment a,
                                       String approvedByName, String overriddenByName) {
        return new RiskAssessmentDto(
                deal.getId(),
                a.value(),
                a.rating(),
                deal.getRiskRating(),
                deal.getRiskRatingSource(),
                deal.getRiskOverrideComment(),
                overriddenByName,
                deal.getRiskOverriddenAt(),
                deal.isRiskApproved(),
                deal.getRiskApprovedByUserId(),
                approvedByName,
                deal.getRiskApprovedAt(),
                a.complete(),
                a.factors().stream()
                        .map(f -> new FactorDto(f.code(), f.label(), f.value(), f.points(),
                                f.nodeId(), f.nodeName(), f.nodeType(), f.countryCode()))
                        .toList(),
                a.unanswered().stream()
                        .map(g -> new GapDto(g.code(), g.label(), g.nodeId(), g.nodeName(),
                                g.nodeType()))
                        .toList());
    }
}
