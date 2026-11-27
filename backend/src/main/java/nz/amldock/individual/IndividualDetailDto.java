package nz.amldock.individual;

import nz.amldock.document.DocumentType;
import nz.amldock.document.IdSide;
import nz.amldock.ownership.NodeType;
import nz.amldock.ownership.NodeVerificationStatus;
import nz.amldock.ownership.OwnershipSubtree;
import nz.amldock.ownership.PersonRole;
import nz.amldock.ownership.TrustType;
import nz.amldock.ownership.dto.PersonDto;

import java.time.LocalDate;
import java.util.Set;
import java.util.List;

/**
 * One owner on one deal, in full — everything a reviewer needs to decide "yes, that is the person
 * (or company, or trust) I mean", and everything worth copying onto a new owner. Named for the
 * individuals it was first built for; it now describes any type.
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
        /** The deal's public id. */
        String dealId,
        String dealReference,
        String propertyAddress,

        String displayName,
        LocalDate dateOfBirth,
        String idDocumentType,
        String idDocumentNumber,
        String idDocumentCountry,
        Set<PersonRole> personRoles,
        NodeVerificationStatus verificationStatus,

        /** The firm-wide record behind this node. Null if it was deleted out from under it. */
        PersonDto person,

        /**
         * What is on this individual's file, so the picker can say what it is about to copy.
         *
         * <p>Named rather than merely counted: "3 documents" is a number, "Passport (front)" is an
         * answer to whether this is the right person.
         */
        List<DocumentSummary> documents,

        /** What kind of owner this is. The picker shows a person's facts or an entity's by it. */
        NodeType nodeType,

        /** An entity's own facts. All null for an individual. */
        EntityFacts entity,

        /**
         * Everyone beneath this owner, in the order the structure shows them, each once. Copying an
         * entity copies all of them, so the picker lists them before anyone commits. Empty for an
         * individual, who owns nothing.
         */
        List<OwnershipSubtree.Line> beneath,

        /** How many documents those owners beneath hold between them, which the copy takes too. */
        int documentsBeneath
) {
    /** The identifying facts of a company, trust, partnership or other entity. */
    public record EntityFacts(
            String companyNumber,
            /** NZBN in New Zealand, ABN in Australia. */
            String businessNumber,
            /** ISO 3166-1 alpha-2, where it is incorporated or registered. */
            String jurisdictionCountry,
            LocalDate incorporationDate,
            String registeredOffice,
            String trustName,
            TrustType trustType,
            String settlorName) {}

    /** Just enough of a document to list it. The bytes are fetched from the document endpoints. */
    public record DocumentSummary(
            Long id,
            String originalFilename,
            DocumentType documentType,
            IdSide idSide,
            long sizeBytes) {}
}
