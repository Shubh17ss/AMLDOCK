package nz.amldock.ownership.dto;

import nz.amldock.ownership.EdgeRole;
import nz.amldock.ownership.OwnershipEdge;

import java.math.BigDecimal;
import java.time.Instant;

public record EdgeDto(
        Long id,
        Long parentNodeId,
        Long childNodeId,
        BigDecimal percentage,
        EdgeRole role,
        Instant createdAt
) {
    public static EdgeDto from(OwnershipEdge e) {
        return new EdgeDto(e.getId(), e.getParentNodeId(), e.getChildNodeId(),
                e.getPercentage(), e.getRole(), e.getCreatedAt());
    }
}
