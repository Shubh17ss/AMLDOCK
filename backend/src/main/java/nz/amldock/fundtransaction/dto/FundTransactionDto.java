package nz.amldock.fundtransaction.dto;

import nz.amldock.document.DocumentStatus;
import nz.amldock.fundtransaction.InternationalFundTransaction;
import nz.amldock.fundtransaction.TransactionFlow;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record FundTransactionDto(
        Long id,
        String dealReference,
        String listingAddress,
        TransactionFlow transactionFlow,
        LocalDate transactionDate,
        BigDecimal amountNzd,
        String overseasJurisdiction,
        String submissionReference,
        boolean hasDocument,
        String originalFilename,
        Long sizeBytes,
        Long realEstateFirmId,
        Long firmBranchId,
        String branchName,
        String createdByEmail,
        Instant createdAt
) {
    public static FundTransactionDto from(InternationalFundTransaction t, String branchName, String createdByEmail) {
        return new FundTransactionDto(
                t.getId(), t.getDealReference(), t.getListingAddress(), t.getTransactionFlow(),
                t.getTransactionDate(), t.getAmountNzd(), t.getOverseasJurisdiction(),
                t.getSubmissionReference(),
                t.getDocumentStatus() == DocumentStatus.ACTIVE,
                t.getOriginalFilename(), t.getSizeBytes(),
                t.getRealEstateFirmId(), t.getFirmBranchId(), branchName,
                createdByEmail, t.getCreatedAt());
    }
}
