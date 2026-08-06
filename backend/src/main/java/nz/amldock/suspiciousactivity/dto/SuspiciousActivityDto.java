package nz.amldock.suspiciousactivity.dto;

import nz.amldock.document.DocumentStatus;
import nz.amldock.suspiciousactivity.RedFlag;
import nz.amldock.suspiciousactivity.SuspiciousActivity;
import nz.amldock.suspiciousactivity.SuspicionType;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record SuspiciousActivityDto(
        Long id,
        SuspicionType suspicionType,
        BigDecimal amount,
        String name,
        LocalDate dateOfSuspicion,
        RedFlag redFlag,
        String reference,
        String description,
        String actionTaken,
        boolean hasDocument,
        String originalFilename,
        Long sizeBytes,
        Long realEstateFirmId,
        Long firmBranchId,
        String branchName,
        String createdByEmail,
        Instant createdAt
) {
    public static SuspiciousActivityDto from(SuspiciousActivity s, String branchName, String createdByEmail) {
        return new SuspiciousActivityDto(
                s.getId(), s.getSuspicionType(), s.getAmount(), s.getName(),
                s.getDateOfSuspicion(), s.getRedFlag(), s.getReference(),
                s.getDescription(), s.getActionTaken(),
                s.getDocumentStatus() == DocumentStatus.ACTIVE,
                s.getOriginalFilename(), s.getSizeBytes(),
                s.getRealEstateFirmId(), s.getFirmBranchId(), branchName,
                createdByEmail, s.getCreatedAt());
    }
}
