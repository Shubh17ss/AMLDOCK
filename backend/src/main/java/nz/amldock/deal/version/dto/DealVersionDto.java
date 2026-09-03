package nz.amldock.deal.version.dto;

import nz.amldock.beneficialowner.dto.BeneficialOwnerDto;
import nz.amldock.deal.dto.DealDto;
import nz.amldock.dealnote.dto.DealNoteDto;
import nz.amldock.document.dto.DocumentDto;
import nz.amldock.ownership.dto.TreeDto;

import java.util.List;

/**
 * A whole deal as it stood at one verification.
 *
 * <p>Deliberately the same four payloads the deal screen already fetches from four separate
 * endpoints — {@code DealDto}, {@code TreeDto}, the document list and the people — so that showing
 * a version needs no rendering code of its own. The page swaps its data source and everything
 * downstream draws exactly as it does for the live deal, in the read-only mode it already has.
 *
 * @param summary the sign-off this version records: who verified it, when, on what note
 * @param notes   the timeline as it stood at {@code verifiedAt}. Not copied into the snapshot
 *                tables — {@code deal_note} is append-only, so reading it back to a point in time
 *                is exact.
 */
public record DealVersionDto(
        DealVersionSummaryDto summary,
        DealDto deal,
        TreeDto ownership,
        List<DocumentDto> documents,
        List<BeneficialOwnerDto> beneficialOwners,
        List<DealNoteDto> notes
) {}
