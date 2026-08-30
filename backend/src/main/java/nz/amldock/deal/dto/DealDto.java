package nz.amldock.deal.dto;

import nz.amldock.client.dto.ClientDto;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealStatus;
import nz.amldock.deal.RiskRating;
import nz.amldock.deal.RiskRatingSource;
import nz.amldock.deal.TransactionType;
import nz.amldock.property.dto.PropertyDto;

import java.math.BigDecimal;
import java.time.Instant;

public record DealDto(
        Long id,
        String reference,
        DealStatus status,
        TransactionType transactionType,
        BigDecimal transactionValue,
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
        Long decidedByUserId,
        Instant decidedAt,
        Instant createdAt,
        Instant updatedAt,
        // V28 — appended rather than interleaved so the positional constructor calls below
        // stay the only diff.
        String transactionPurpose,
        Boolean trustInvolved,
        Boolean onSoldQuickly,
        String foreignExposureCountry,
        Boolean redFlagPresent,
        String redFlag,
        BigDecimal valuationMin,
        BigDecimal valuationMax,
        RiskRating riskRating,
        RiskRatingSource riskRatingSource,
        // V29
        Boolean clientRemote
) {
    public static DealDto from(Deal d, String firmName, String branchName,
                               PropertyDto property, ClientDto client,
                               String createdByEmail) {
        return new DealDto(
                d.getId(), d.getReference(), d.getStatus(), d.getTransactionType(),
                d.getTransactionValue(), d.getFirmBranchId(), firmName, branchName,
                d.getPocName(), d.getPocRole(), d.getPocPhone(), d.getPocEmail(),
                property, client, d.getNotes(),
                d.getCreatedByUserId(), createdByEmail,
                d.getDecidedByUserId(), d.getDecidedAt(),
                d.getCreatedAt(), d.getUpdatedAt(),
                d.getTransactionPurpose(), d.getTrustInvolved(), d.getOnSoldQuickly(),
                d.getForeignExposureCountry(), d.getRedFlagPresent(), d.getRedFlag(),
                d.getValuationMin(), d.getValuationMax(),
                d.getRiskRating(), d.getRiskRatingSource(),
                d.getClientRemote());
    }
}
