package nz.amldock.fundtransaction.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import nz.amldock.fundtransaction.TransactionFlow;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateFundTransactionRequest(
        String dealReference,
        @NotBlank String listingAddress,
        @NotNull TransactionFlow transactionFlow,
        @NotNull LocalDate transactionDate,
        @NotNull @PositiveOrZero BigDecimal amount,
        @NotBlank @Size(min = 2, max = 2) String overseasJurisdiction,
        String submissionReference,
        Long realEstateFirmId,
        Long firmBranchId) {}
