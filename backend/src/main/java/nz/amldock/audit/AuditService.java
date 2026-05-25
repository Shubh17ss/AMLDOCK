package nz.amldock.audit;

import jakarta.servlet.http.HttpServletRequest;
import nz.amldock.user.UserPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

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

    private String resolveIp(HttpServletRequest req) {
        String fwd = req.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) {
            return fwd.split(",")[0].trim();
        }
        return req.getRemoteAddr();
    }
}
