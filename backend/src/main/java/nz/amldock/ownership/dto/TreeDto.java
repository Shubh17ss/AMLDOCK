package nz.amldock.ownership.dto;

import java.util.List;

public record TreeDto(
        Long ownershipStructureId,
        // The internal id — kept off the wire, where deals are named by their public id.
        @com.fasterxml.jackson.annotation.JsonIgnore Long dealId,
        Long rootNodeId,
        String notes,
        List<NodeDto> nodes,
        List<EdgeDto> edges
) {}
