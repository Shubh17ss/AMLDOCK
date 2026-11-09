package nz.amldock.deal.version.dto;

import nz.amldock.deal.assurance.AssuranceStatus;
import nz.amldock.deal.assurance.dto.AssuranceVersionDto.IssueDto;

import java.time.Instant;
import java.util.List;

/**
 * One row of the Versions menu: enough to choose between versions without loading any of them.
 *
 * <p>The counts are here because "v2 — 14 Aug" says nothing about whether it is worth opening,
 * whereas "9 nodes, 4 documents" against the version before it does.
 *
 * @param reopenedAt null while this is the version the deal still stands on. Once set, this
 *                   version has been superseded or is being worked past.
 * @param assuranceStatus compliance's verdict on this version; null while nobody has reviewed it
 * @param issues          the findings behind an ACTION_REQUIRED verdict; empty otherwise
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
        int personCount,
        AssuranceStatus assuranceStatus,
        String assuranceByName,
        Instant assuranceAt,
        List<IssueDto> issues
) {}
