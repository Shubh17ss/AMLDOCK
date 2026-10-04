package nz.amldock.deal.assurance.dto;

import nz.amldock.deal.dto.DealListItemDto;

import java.time.Instant;
import java.util.List;

/**
 * One deal in the assurance register: the same row the deals list shows, plus its signed-off
 * versions, newest first.
 *
 * @param lastAssuredAt the latest assurance change across those versions — the deal row's
 *                      "Last updated". Null while none of them has been reviewed.
 */
public record AssuranceDealDto(
        DealListItemDto deal,
        Instant lastAssuredAt,
        List<AssuranceVersionDto> versions
) {}
