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
        // The list shows who filed the deal by name; the email stays as the fallback for a user
        // row that has since gone. Both come off the User the service already holds.
        String createdByName,
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
                                       String createdByEmail, String createdByName) {
        return new DealListItemDto(d.getId(), d.getReference(), d.getStatus(), d.getTransactionType(),
                d.getTransactionValue(), d.getFirmBranchId(), firmName, branchName,
                clientName, propertyAddress, d.getCreatedByUserId(), createdByEmail, createdByName,
                d.getCreatedAt(), d.getUpdatedAt(),
                d.getRiskRating(), d.getValuationMin(), d.getValuationMax());
    }
}
