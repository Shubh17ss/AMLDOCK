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
        boolean approved,
        Long approvedByUserId,
        String approvedByEmail,
        Instant approvedAt,
        /** True when nothing is left unanswered, which is what gates approval. */
        boolean complete,
        List<FactorDto> factors,
        List<GapDto> unanswered
) {

    /** One answer that added points, and which owner it came from. Null node = the deal itself. */
    public record FactorDto(String code, String label, int points, Long nodeId, String nodeName) {}

    /** One question that bears on the score and has not been answered. */
    public record GapDto(String code, String label, Long nodeId, String nodeName) {}

    public static RiskAssessmentDto of(Deal deal, RiskAssessment a, String approvedByEmail) {
        return new RiskAssessmentDto(
                deal.getId(),
                a.value(),
                a.rating(),
                deal.getRiskRating(),
                deal.getRiskRatingSource(),
                deal.getRiskOverrideComment(),
                deal.isRiskApproved(),
                deal.getRiskApprovedByUserId(),
                approvedByEmail,
                deal.getRiskApprovedAt(),
                a.complete(),
                a.factors().stream()
                        .map(f -> new FactorDto(f.code(), f.label(), f.points(),
                                f.nodeId(), f.nodeName()))
                        .toList(),
                a.unanswered().stream()
                        .map(g -> new GapDto(g.code(), g.label(), g.nodeId(), g.nodeName()))
                        .toList());
    }
}
