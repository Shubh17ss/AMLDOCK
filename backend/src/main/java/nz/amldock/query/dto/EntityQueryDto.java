package nz.amldock.query.dto;

import nz.amldock.query.EntityQuery;
import nz.amldock.query.EntityQueryStatus;

import java.time.Instant;

/** One change request as ROOT's Queries screen shows it, with the entity named. */
public record EntityQueryDto(
        Long id,
        Long realEstateFirmId,
        String realEstateFirmPublicId,
        String realEstateFirmName,
        String raisedByName,
        String raisedByEmail,
        String message,
        EntityQueryStatus status,
        Instant createdAt,
        Instant resolvedAt
) {
    public static EntityQueryDto from(EntityQuery q, String firmPublicId, String firmName) {
        return new EntityQueryDto(q.getId(), q.getRealEstateFirmId(), firmPublicId, firmName,
                q.getRaisedByName(), q.getRaisedByEmail(),
                q.getMessage(), q.getStatus(), q.getCreatedAt(), q.getResolvedAt());
    }
}
