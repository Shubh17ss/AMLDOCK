package nz.amldock.deal.dto;

import nz.amldock.deal.Deal;
import nz.amldock.deal.DealStatus;
import nz.amldock.deal.TransactionType;

import java.math.BigDecimal;
import java.time.Instant;

public record DealListItemDto(
        Long id,
        String reference,
        DealStatus status,
        TransactionType transactionType,
        BigDecimal transactionValueNzd,
        Long firmBranchId,
        String firmName,
        String branchName,
        String clientDisplayName,
        String propertyAddress,
        Long createdByUserId,
        String createdByEmail,
        Instant createdAt,
        Instant updatedAt
) {
    public static DealListItemDto from(Deal d,
                                       String firmName, String branchName,
                                       String clientName, String propertyAddress,
                                       String createdByEmail) {
        return new DealListItemDto(d.getId(), d.getReference(), d.getStatus(), d.getTransactionType(),
                d.getTransactionValueNzd(), d.getFirmBranchId(), firmName, branchName,
                clientName, propertyAddress, d.getCreatedByUserId(), createdByEmail,
                d.getCreatedAt(), d.getUpdatedAt());
    }
}
