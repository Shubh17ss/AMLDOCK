package nz.amldock.beneficialowner.dto;

import nz.amldock.beneficialowner.BeneficialOwner;
import nz.amldock.beneficialowner.ReviewStatus;

import java.time.Instant;
import java.time.LocalDate;

/**
 * A person as read off an ID.
 *
 * <p>Nulls are meaningful and travel through as nulls: they mean "the scan did not yield this",
 * which the UI renders as "Not detected" rather than hiding.
 */
public record BeneficialOwnerDto(
        Long id,
        String fullName,
        LocalDate dateOfBirth,
        LocalDate idExpiryDate,
        String extractionConfidence,
        ReviewStatus reviewStatus,
        Long sourceDocumentId,
        Instant createdAt) {

    public static BeneficialOwnerDto from(BeneficialOwner o, Long sourceDocumentId) {
        return new BeneficialOwnerDto(
                o.getId(), o.getFullName(), o.getDateOfBirth(), o.getIdExpiryDate(),
                o.getExtractionConfidence(), o.getReviewStatus(), sourceDocumentId, o.getCreatedAt());
    }
}
