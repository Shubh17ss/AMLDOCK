package nz.amldock.ownership.dto;

import nz.amldock.ownership.NodeType;
import nz.amldock.ownership.NodeVerificationStatus;
import nz.amldock.ownership.NomineeStatus;
import nz.amldock.ownership.TrustHoldingComplexity;
import nz.amldock.ownership.TrustType;
import nz.amldock.ownership.OwnershipNode;
import nz.amldock.ownership.PersonRole;

import java.time.Instant;
import java.time.LocalDate;

/**
 * One node of a deal's ownership structure.
 *
 * @param person the shared record behind an INDIVIDUAL — null for every entity type, and null
 *               for an individual whose person record has been removed out from under it
 *               (the FK is ON DELETE SET NULL). Its fields are shared firm-wide; everything
 *               else on this record belongs to this deal alone.
 */
public record NodeDto(
        Long id,
        Long ownershipStructureId,
        NodeType nodeType,
        String displayName,

        LocalDate dateOfBirth,
        String idDocumentType,
        String idDocumentNumber,
        String idDocumentCountry,

        String businessNumber,
        String companyNumber,
        LocalDate incorporationDate,
        String registeredOffice,

        String trustName,
        Long trustDeedDocumentId,
        String settlorName,

        String jurisdictionCountry,
        Boolean companyHasConstitution,
        NomineeStatus nomineeStatus,
        Boolean companyComplexOwnership,
        Boolean companyPersonalAssets,
        Boolean companyNewDeveloper,

        TrustType trustType,
        Boolean trustDiscretionary,
        TrustHoldingComplexity trustHoldingComplexity,
        String sourceOfFunds,

        String extraJson,
        Long beneficialOwnerId,
        PersonDto person,
        PersonRole personRole,
        String reference,
        NodeVerificationStatus verificationStatus,
        String notes,
        String verificationNotes,
        Instant createdAt,
        Instant updatedAt
) {
    public static NodeDto from(OwnershipNode n) {
        return from(n, null);
    }

    public static NodeDto from(OwnershipNode n, PersonDto person) {
        return new NodeDto(
                n.getId(), n.getOwnershipStructureId(), n.getNodeType(), n.getDisplayName(),
                n.getDateOfBirth(), n.getIdDocumentType(), n.getIdDocumentNumber(), n.getIdDocumentCountry(),
                n.getBusinessNumber(), n.getCompanyNumber(), n.getIncorporationDate(), n.getRegisteredOffice(),
                n.getTrustName(), n.getTrustDeedDocumentId(), n.getSettlorName(),
                n.getJurisdictionCountry(), n.getCompanyHasConstitution(), n.getNomineeStatus(),
                n.getCompanyComplexOwnership(), n.getCompanyPersonalAssets(), n.getCompanyNewDeveloper(),
                n.getTrustType(), n.getTrustDiscretionary(), n.getTrustHoldingComplexity(),
                n.getSourceOfFunds(),
                n.getExtraJson(), n.getBeneficialOwnerId(), person,
                n.getPersonRole(), n.getReference(), n.getVerificationStatus(),
                n.getNotes(), n.getVerificationNotes(),
                n.getCreatedAt(), n.getUpdatedAt());
    }
}
