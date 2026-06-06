package nz.amldock.deal.dto;

import nz.amldock.client.dto.ClientDto;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealStatus;
import nz.amldock.deal.TransactionType;
import nz.amldock.property.dto.PropertyDto;

import java.math.BigDecimal;
import java.time.Instant;

public record DealDto(
        Long id,
        String reference,
        DealStatus status,
        TransactionType transactionType,
        BigDecimal transactionValueNzd,
        Long firmBranchId,
        String firmName,
        String branchName,
        String pocName,
        String pocRole,
        String pocPhone,
        String pocEmail,
        PropertyDto property,
        ClientDto client,
        String notes,
        Long createdByUserId,
        String createdByEmail,
        Long assignedComplianceUserId,
        String decisionNotes,
        Long decidedByUserId,
        Instant decidedAt,
        Instant createdAt,
        Instant updatedAt
) {
    public static DealDto from(Deal d, String firmName, String branchName,
                               PropertyDto property, ClientDto client,
                               String createdByEmail) {
        return new DealDto(
                d.getId(), d.getReference(), d.getStatus(), d.getTransactionType(),
                d.getTransactionValueNzd(), d.getFirmBranchId(), firmName, branchName,
                d.getPocName(), d.getPocRole(), d.getPocPhone(), d.getPocEmail(),
                property, client, d.getNotes(),
                d.getCreatedByUserId(), createdByEmail,
                d.getAssignedComplianceUserId(), d.getDecisionNotes(),
                d.getDecidedByUserId(), d.getDecidedAt(),
                d.getCreatedAt(), d.getUpdatedAt());
    }
}
