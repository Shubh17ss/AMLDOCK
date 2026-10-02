package nz.amldock.deal.assurance.dto;

import nz.amldock.deal.assurance.AssuranceStatus;

import java.time.Instant;
import java.util.List;

/**
 * One signed-off version in the assurance register, and where compliance's second look at it
 * stands.
 *
 * @param assuranceStatus null while nobody has reviewed it
 * @param assuranceAt     when the verdict was last changed — the version row's "Last updated"
 * @param issues          the findings behind an ACTION_REQUIRED verdict; empty otherwise
 * @param reopenedAt      set once the deal has been worked past this version
 */
public record AssuranceVersionDto(
        Integer versionNo,
        String verifiedByName,
        Instant verifiedAt,
        String verifyNote,
        Instant reopenedAt,
        AssuranceStatus assuranceStatus,
        String assuranceByName,
        Instant assuranceAt,
        List<IssueDto> issues
) {
    public record IssueDto(String issue, String remediation) {}
}
