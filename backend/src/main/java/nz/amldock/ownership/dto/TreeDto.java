package nz.amldock.ownership.dto;

import java.util.List;

public record TreeDto(
        Long ownershipStructureId,
        Long dealId,
        Long rootNodeId,
        String notes,
        List<NodeDto> nodes,
        List<EdgeDto> edges
) {}
