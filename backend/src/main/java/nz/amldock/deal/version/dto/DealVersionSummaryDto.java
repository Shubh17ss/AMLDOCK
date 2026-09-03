package nz.amldock.deal.version.dto;

import java.time.Instant;

/**
 * One row of the Versions menu: enough to choose between versions without loading any of them.
 *
 * <p>The counts are here because "v2 — 14 Aug" says nothing about whether it is worth opening,
 * whereas "9 nodes, 4 documents" against the version before it does.
 *
 * @param reopenedAt null while this is the version the deal still stands on. Once set, this
 *                   version has been superseded or is being worked past.
 */
public record DealVersionSummaryDto(
        Integer versionNo,
        Long verifiedByUserId,
        String verifiedByName,
        String verifiedByEmail,
        Instant verifiedAt,
        String verifyNote,
        Long reopenedByUserId,
        String reopenedByName,
        Instant reopenedAt,
        String reopenNote,
        int nodeCount,
        int documentCount,
        int personCount
) {}
