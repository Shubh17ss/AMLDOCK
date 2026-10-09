package nz.amldock.deal.assurance.dto;

import nz.amldock.deal.dto.DealListItemDto;


/**
 * One deal in the assurance register: the same row the deals list shows, plus the version the
 * deal currently stands on. Older versions are history and are read from the deal's version tab.
 *
 * @param latestVersion null for a verified or closed deal that has no signed-off version
 */
public record AssuranceDealDto(
        DealListItemDto deal,
        AssuranceVersionDto latestVersion
) {}
