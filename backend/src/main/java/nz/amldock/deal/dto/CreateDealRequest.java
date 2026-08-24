package nz.amldock.deal.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import nz.amldock.client.dto.ClientInput;
import nz.amldock.deal.TransactionType;
import nz.amldock.property.dto.PropertyInput;

import java.math.BigDecimal;

public record CreateDealRequest(
        /**
         * Optional — defaults to the caller's own branch. Agents may only create deals on the
         * branch they are assigned to (DealService.create enforces this), so requiring the
         * client to send back a value it has no freedom over was ceremony.
         */
        Long firmBranchId,
        @NotNull TransactionType transactionType,
        BigDecimal transactionValue,
        String pocName,
        String pocRole,
        String pocPhone,
        @Email String pocEmail,
        /** General broker notes captured in section 4. */
        String notes,

        /* ---------- section 2: transaction context ---------- */

        String transactionPurpose,
        Boolean trustInvolved,
        Boolean onSoldQuickly,
        /** "NONE" or an ISO alpha-2 code. Null passes — it means the question is unanswered. */
        @Pattern(regexp = "NONE|[A-Z]{2}", message = "Must be 'NONE' or an ISO alpha-2 country code")
        String foreignExposureCountry,

        /* ---------- section 3: client identity ---------- */

        /** Not met face to face. Drives remote identity verification later, not the risk rating. */
        Boolean clientRemote,

        /* ---------- section 4: risk and valuation ---------- */

        Boolean redFlagPresent,
        String redFlag,
        @PositiveOrZero BigDecimal valuationMin,
        @PositiveOrZero BigDecimal valuationMax,

        @Valid PropertyInput property,
        @Valid ClientInput client
) {}
