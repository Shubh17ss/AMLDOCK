package nz.amldock.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    @Query("SELECT a FROM AuditLog a WHERE " +
            "(:actorUserId IS NULL OR a.actorUserId = :actorUserId) AND " +
            "(:action IS NULL OR a.action = :action) AND " +
            "(:entityType IS NULL OR a.entityType = :entityType) AND " +
            "(:entityId IS NULL OR a.entityId = :entityId) AND " +
            "(:fromTs IS NULL OR a.createdAt >= :fromTs) AND " +
            "(:toTs IS NULL OR a.createdAt <= :toTs) " +
            "ORDER BY a.createdAt DESC")
    Page<AuditLog> search(@Param("actorUserId") Long actorUserId,
                          @Param("action") AuditAction action,
                          @Param("entityType") String entityType,
                          @Param("entityId") Long entityId,
                          @Param("fromTs") Instant fromTs,
                          @Param("toTs") Instant toTs,
                          Pageable pageable);

    List<AuditLog> findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc(String entityType, Long entityId);
}
