package nz.amldock.ownership.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import nz.amldock.ownership.EdgeRole;

import java.math.BigDecimal;

public record UpdateEdgeRequest(
        @DecimalMin(value = "0.00", inclusive = true)
        @DecimalMax(value = "100.00", inclusive = true)
        BigDecimal percentage,
        EdgeRole role
) {}
