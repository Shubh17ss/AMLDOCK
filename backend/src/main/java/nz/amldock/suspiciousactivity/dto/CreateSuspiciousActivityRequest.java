package nz.amldock.suspiciousactivity.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import nz.amldock.suspiciousactivity.RedFlag;
import nz.amldock.suspiciousactivity.SuspicionType;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A new Suspicious Activity Register entry.
 *
 * {@code amountNzd} is only meaningful when {@code suspicionType} is TRANSACTION — the service
 * requires it there and nulls it out for an ACTIVITY, a cross-field rule Bean Validation can't
 * express on its own.
 */
public record CreateSuspiciousActivityRequest(
        @NotNull SuspicionType suspicionType,
        @PositiveOrZero BigDecimal amountNzd,
        @NotBlank String name,
        @NotNull LocalDate dateOfSuspicion,
        @NotNull RedFlag redFlag,
        String reference,
        @NotBlank String description,
        String actionTaken,
        Long realEstateFirmId,
        Long firmBranchId) {
}
