package nz.amldock.audit;

import jakarta.persistence.criteria.Predicate;
import jakarta.servlet.http.HttpServletRequest;
import nz.amldock.audit.dto.AuditLogDto;
import nz.amldock.common.web.PageResponse;
import nz.amldock.user.UserPrincipal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class AuditService {

    private final AuditLogRepository repo;

    public AuditService(AuditLogRepository repo) {
        this.repo = repo;
    }

    @Transactional
    public void record(AuditAction action, String entityType, Long entityId, String summary) {
        record(action, entityType, entityId, summary, null);
    }

    @Transactional
    public void record(AuditAction action, String entityType, Long entityId, String summary, String metadataJson) {
        AuditLog log = new AuditLog();
        log.setAction(action);
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        log.setSummary(summary);
        log.setMetadata(metadataJson);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal up) {
            log.setActorUserId(up.id());
            log.setActorEmail(up.email());
        }

        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs != null) {
            HttpServletRequest req = attrs.getRequest();
            log.setIpAddress(resolveIp(req));
        }

        repo.save(log);
    }

    @Transactional
    public void recordForUser(Long userId, String userEmail, AuditAction action, String entityType,
                              Long entityId, String summary) {
        AuditLog log = new AuditLog();
        log.setActorUserId(userId);
        log.setActorEmail(userEmail);
        log.setAction(action);
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        log.setSummary(summary);

        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs != null) {
            log.setIpAddress(resolveIp(attrs.getRequest()));
        }
        repo.save(log);
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditLogDto> search(Long actorUserId, AuditAction action, String entityType,
                                            Long entityId, Instant from, Instant to,
                                            int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), 200);
        Specification<AuditLog> spec = buildSpec(actorUserId, action, entityType, entityId, from, to);
        Page<AuditLog> result = repo.findAll(spec,
                PageRequest.of(Math.max(page, 0), safeSize, Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResponse.of(result, AuditLogDto::from);
    }

    private static Specification<AuditLog> buildSpec(Long actorUserId, AuditAction action, String entityType,
                                                     Long entityId, Instant from, Instant to) {
        return (root, query, cb) -> {
            List<Predicate> preds = new ArrayList<>();
            if (actorUserId != null) preds.add(cb.equal(root.get("actorUserId"), actorUserId));
            if (action != null) preds.add(cb.equal(root.get("action"), action));
            if (entityType != null && !entityType.isBlank()) preds.add(cb.equal(root.get("entityType"), entityType));
            if (entityId != null) preds.add(cb.equal(root.get("entityId"), entityId));
            if (from != null) preds.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
            if (to != null) preds.add(cb.lessThanOrEqualTo(root.get("createdAt"), to));
            return preds.isEmpty() ? cb.conjunction() : cb.and(preds.toArray(new Predicate[0]));
        };
    }

    @Transactional(readOnly = true)
    public List<AuditLogDto> listForDeal(Long dealId) {
        return repo.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("Deal", dealId)
                .stream().map(AuditLogDto::from).toList();
    }

    private String resolveIp(HttpServletRequest req) {
        String fwd = req.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) {
            return fwd.split(",")[0].trim();
        }
        return req.getRemoteAddr();
    }
}
