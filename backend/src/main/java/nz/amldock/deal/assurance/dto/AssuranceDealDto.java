package nz.amldock.deal.assurance.dto;

import nz.amldock.deal.dto.DealListItemDto;

import java.util.List;

/**
 * One deal in the assurance register: the same row the deals list shows, plus its signed-off
 * versions, newest first.
 */
public record AssuranceDealDto(
        DealListItemDto deal,
        List<AssuranceVersionDto> versions
) {}
