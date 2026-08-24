package nz.amldock.deal.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import nz.amldock.deal.TransactionType;

import java.math.BigDecimal;

/**
 * All fields nullable: DealService.update writes only what is present, so a partial PATCH
 * leaves everything else alone.
 *
 * <p>Consequence worth knowing: null cannot clear a field. String fields go through
 * DealService.blankToNull, so an explicit {@code ""} is how the form clears one. That is why
 * foreignExposureCountry uses a literal {@code "NONE"} sentinel rather than null.
 */
public record UpdateDealRequest(
        Long firmBranchId,
        TransactionType transactionType,
        BigDecimal transactionValue,
        String pocName,
        String pocRole,
        String pocPhone,
        String pocEmail,
        String notes,
        String transactionPurpose,
        Boolean trustInvolved,
        Boolean onSoldQuickly,
        @Pattern(regexp = "NONE|[A-Z]{2}", message = "Must be 'NONE' or an ISO alpha-2 country code")
        String foreignExposureCountry,
        Boolean clientRemote,
        Boolean redFlagPresent,
        String redFlag,
        @PositiveOrZero BigDecimal valuationMin,
        @PositiveOrZero BigDecimal valuationMax
) {}
