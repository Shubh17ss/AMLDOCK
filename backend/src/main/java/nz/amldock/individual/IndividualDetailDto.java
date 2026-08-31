package nz.amldock.individual;

import nz.amldock.document.DocumentType;
import nz.amldock.document.IdSide;
import nz.amldock.ownership.NodeVerificationStatus;
import nz.amldock.ownership.PersonRole;
import nz.amldock.ownership.dto.PersonDto;

import java.time.LocalDate;
import java.util.List;

/**
 * One individual on one deal, in full — everything a reviewer needs to decide "yes, that is the
 * person I mean", and everything worth copying onto a new owner.
 *
 * <p>Separate from {@link IndividualRowDto} rather than folded into it. The row is the register's
 * unit and is fetched by the hundred, twice over, plus a CSV export; this is fetched one at a time
 * for the single row somebody expanded. Widening the row to carry contact details would grow every
 * one of those payloads for data that only ever serves one of them.
 *
 * <p>{@code nodeId} is the identity here for the same reason it is on the row: the thing being
 * described is a person <em>on a deal</em>, and the same human on two deals is two of these.
 */
public record IndividualDetailDto(
        Long nodeId,
        Long dealId,
        String dealReference,
        String propertyAddress,

        String displayName,
        LocalDate dateOfBirth,
        String idDocumentType,
        String idDocumentNumber,
        String idDocumentCountry,
        PersonRole personRole,
        NodeVerificationStatus verificationStatus,

        /** The firm-wide record behind this node. Null if it was deleted out from under it. */
        PersonDto person,

        /**
         * What is on this individual's file, so the picker can say what it is about to copy.
         *
         * <p>Named rather than merely counted: "3 documents" is a number, "Passport (front)" is an
         * answer to whether this is the right person.
         */
        List<DocumentSummary> documents
) {
    /** Just enough of a document to list it. The bytes are fetched from the document endpoints. */
    public record DocumentSummary(
            Long id,
            String originalFilename,
            DocumentType documentType,
            IdSide idSide,
            long sizeBytes) {}
}
