package nz.amldock.ownership.dto;

import nz.amldock.ownership.NodeType;
import nz.amldock.ownership.NodeVerificationStatus;
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

        String nzbn,
        String companyNumber,
        LocalDate incorporationDate,
        String registeredOffice,

        String trustName,
        Long trustDeedDocumentId,
        String settlorName,

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
                n.getNzbn(), n.getCompanyNumber(), n.getIncorporationDate(), n.getRegisteredOffice(),
                n.getTrustName(), n.getTrustDeedDocumentId(), n.getSettlorName(),
                n.getExtraJson(), n.getBeneficialOwnerId(), person,
                n.getPersonRole(), n.getReference(), n.getVerificationStatus(),
                n.getNotes(), n.getVerificationNotes(),
                n.getCreatedAt(), n.getUpdatedAt());
    }
}
