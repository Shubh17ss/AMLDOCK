package nz.amldock.beneficialowner.dto;

import nz.amldock.beneficialowner.BeneficialOwnerFields;
import nz.amldock.beneficialowner.ReviewStatus;

import java.time.Instant;
import java.time.LocalDate;

/**
 * A person as read off an ID.
 *
 * <p>Nulls are meaningful and travel through as nulls: they mean "the scan did not yield this",
 * which the UI renders as "Not detected" rather than hiding. A person whose card could not be
 * read at all still appears — an ID that produced nothing is exactly what a reviewer needs to see.
 *
 * @param idDocumentType which kind of card they were identified from, or null if every scan of
 *                       theirs has since been deleted
 * @param imageCount     1 for a front alone, 2 once the back is captured
 */
public record BeneficialOwnerDto(
        Long id,
        String fullName,
        LocalDate dateOfBirth,
        LocalDate idExpiryDate,
        String extractionConfidence,
        ReviewStatus reviewStatus,
        String idDocumentType,
        int imageCount,
        Instant createdAt) {

    public static BeneficialOwnerDto from(BeneficialOwnerFields o, String idDocumentType, int imageCount) {
        return new BeneficialOwnerDto(
                o.getBeneficialOwnerId(), o.getFullName(), o.getDateOfBirth(), o.getIdExpiryDate(),
                o.getExtractionConfidence(), o.getReviewStatus(),
                idDocumentType, imageCount, o.getCreatedAt());
    }
}
