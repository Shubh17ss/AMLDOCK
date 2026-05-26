package nz.amldock.audit.dto;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditLog;

import java.time.Instant;

public record AuditLogDto(
        Long id,
        Long actorUserId,
        String actorEmail,
        AuditAction action,
        String entityType,
        Long entityId,
        String summary,
        String metadata,
        String ipAddress,
        Instant createdAt
) {
    public static AuditLogDto from(AuditLog a) {
        return new AuditLogDto(
                a.getId(),
                a.getActorUserId(),
                a.getActorEmail(),
                a.getAction(),
                a.getEntityType(),
                a.getEntityId(),
                a.getSummary(),
                a.getMetadata(),
                a.getIpAddress(),
                a.getCreatedAt());
    }
}
