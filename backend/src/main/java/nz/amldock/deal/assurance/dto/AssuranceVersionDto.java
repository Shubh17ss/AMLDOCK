package nz.amldock.deal.assurance.dto;

import nz.amldock.deal.assurance.AssuranceStatus;

import java.time.Instant;

/**
 * One signed-off version in the assurance register, and where compliance's second look at it
 * stands.
 *
 * @param assuranceStatus null while nobody has reviewed it
 * @param reopenedAt      set once the deal has been worked past this version
 */
public record AssuranceVersionDto(
        Integer versionNo,
        String verifiedByName,
        Instant verifiedAt,
        String verifyNote,
        Instant reopenedAt,
        AssuranceStatus assuranceStatus,
        String assuranceNote,
        String assuranceByName,
        Instant assuranceAt
) {}
