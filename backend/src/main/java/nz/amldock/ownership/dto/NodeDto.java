package nz.amldock.ownership.dto;

import nz.amldock.ownership.NodeType;
import nz.amldock.ownership.NodeVerificationStatus;
import nz.amldock.ownership.OwnershipNode;

import java.time.Instant;
import java.time.LocalDate;

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
        NodeVerificationStatus verificationStatus,
        String notes,
        String verificationNotes,
        Instant createdAt,
        Instant updatedAt
) {
    public static NodeDto from(OwnershipNode n) {
        return new NodeDto(
                n.getId(), n.getOwnershipStructureId(), n.getNodeType(), n.getDisplayName(),
                n.getDateOfBirth(), n.getIdDocumentType(), n.getIdDocumentNumber(), n.getIdDocumentCountry(),
                n.getNzbn(), n.getCompanyNumber(), n.getIncorporationDate(), n.getRegisteredOffice(),
                n.getTrustName(), n.getTrustDeedDocumentId(), n.getSettlorName(),
                n.getExtraJson(), n.getVerificationStatus(),
                n.getNotes(), n.getVerificationNotes(),
                n.getCreatedAt(), n.getUpdatedAt());
    }
}
