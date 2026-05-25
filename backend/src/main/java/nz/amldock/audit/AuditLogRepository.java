package nz.amldock.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    @Query("SELECT a FROM AuditLog a WHERE " +
            "(:actorUserId IS NULL OR a.actorUserId = :actorUserId) AND " +
            "(:action IS NULL OR a.action = :action) AND " +
            "(:entityType IS NULL OR a.entityType = :entityType) AND " +
            "(:entityId IS NULL OR a.entityId = :entityId) " +
            "ORDER BY a.createdAt DESC")
    Page<AuditLog> search(@Param("actorUserId") Long actorUserId,
                          @Param("action") AuditAction action,
                          @Param("entityType") String entityType,
                          @Param("entityId") Long entityId,
                          Pageable pageable);
}
