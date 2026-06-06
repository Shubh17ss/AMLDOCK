package nz.amldock.deal.dto;

import nz.amldock.deal.TransactionType;

import java.math.BigDecimal;

public record UpdateDealRequest(
        Long firmBranchId,
        TransactionType transactionType,
        BigDecimal transactionValueNzd,
        String pocName,
        String pocRole,
        String pocPhone,
        String pocEmail,
        String notes
) {}
