package nz.amldock.ownership.dto;

import nz.amldock.ownership.NodeVerificationStatus;

import java.time.Instant;

/**
 * One verification granted to a person or entity, on one deal.
 *
 * @param currentDeal true for the deal the trail was asked from
 * @param canOpen     whether the viewer may open that deal; the client still links to it and
 *                    shows its not-found view when not
 */
public record VerificationTrailEntryDto(
        Long nodeId,
        Long dealId,
        String dealReference,
        String propertyAddress,
        Long branchId,
        String branchName,
        NodeVerificationStatus verificationStatus,
        Instant verifiedAt,
        String verifiedByName,
        boolean currentDeal,
        boolean canOpen
) {}
