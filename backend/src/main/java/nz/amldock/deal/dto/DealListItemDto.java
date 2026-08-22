package nz.amldock.deal.dto;

import nz.amldock.deal.Deal;
import nz.amldock.deal.DealStatus;
import nz.amldock.deal.RiskRating;
import nz.amldock.deal.TransactionType;

import java.math.BigDecimal;
import java.time.Instant;

public record DealListItemDto(
        Long id,
        String reference,
        DealStatus status,
        TransactionType transactionType,
        BigDecimal transactionValue,
        Long firmBranchId,
        String firmName,
        String branchName,
        String clientDisplayName,
        String propertyAddress,
        Long createdByUserId,
        String createdByEmail,
        Instant createdAt,
        Instant updatedAt,
        // V28 — list rows show the risk chip and the valuation range. All three come off the
        // Deal that DealService.list already holds, so this costs no extra queries.
        RiskRating riskRating,
        BigDecimal valuationMin,
        BigDecimal valuationMax
) {
    public static DealListItemDto from(Deal d,
                                       String firmName, String branchName,
                                       String clientName, String propertyAddress,
                                       String createdByEmail) {
        return new DealListItemDto(d.getId(), d.getReference(), d.getStatus(), d.getTransactionType(),
                d.getTransactionValue(), d.getFirmBranchId(), firmName, branchName,
                clientName, propertyAddress, d.getCreatedByUserId(), createdByEmail,
                d.getCreatedAt(), d.getUpdatedAt(),
                d.getRiskRating(), d.getValuationMin(), d.getValuationMax());
    }
}
