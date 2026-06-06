package nz.amldock.deal.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;
import nz.amldock.client.dto.ClientInput;
import nz.amldock.deal.TransactionType;
import nz.amldock.property.dto.PropertyInput;

import java.math.BigDecimal;

public record CreateDealRequest(
        @NotNull Long firmBranchId,
        @NotNull TransactionType transactionType,
        BigDecimal transactionValueNzd,
        String pocName,
        String pocRole,
        String pocPhone,
        @Email String pocEmail,
        /** General broker notes captured in the wizard's review step. */
        String notes,
        @Valid PropertyInput property,
        @Valid ClientInput client
) {}
