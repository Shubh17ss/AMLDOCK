package nz.amldock.audit;

import jakarta.persistence.criteria.Predicate;
import jakarta.servlet.http.HttpServletRequest;
import nz.amldock.audit.dto.AuditLogDto;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.common.web.PageResponse;
import nz.amldock.deal.Deal;
import nz.amldock.deal.DealLifecycleService;
import nz.amldock.deal.DealRepository;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
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
    private final DealRepository deals;
    private final FirmBranchRepository branches;
    private final DealLifecycleService lifecycle;
    private final UserRepository users;

    public AuditService(AuditLogRepository repo,
                        DealRepository deals,
                        FirmBranchRepository branches,
                        DealLifecycleService lifecycle,
                        UserRepository users) {
        this.repo = repo;
        this.deals = deals;
        this.branches = branches;
        this.lifecycle = lifecycle;
        this.users = users;
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

    /**
     * The trail, newest first, narrowed to what the caller may see.
     *
     * audit_log carries no firm column — only the actor — so a firm-level caller is scoped by
     * restricting the actor to the users in their own reporting entity. That is the honest
     * reading of "my firm's activity", with one limitation worth knowing: an action a platform
     * administrator took on this firm's records was performed by a firm-less actor and so does
     * not appear. Only ROOT and AUDIT see those.
     */
    @Transactional(readOnly = true)
    public PageResponse<AuditLogDto> search(Long actorUserId, AuditAction action, String entityType,
                                            Long entityId, Instant from, Instant to,
                                            int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), 200);
        Specification<AuditLog> spec = buildSpec(actorUserId, action, entityType, entityId, from, to)
                .and(visibleActorScope());
        Page<AuditLog> result = repo.findAll(spec,
                PageRequest.of(Math.max(page, 0), safeSize, Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResponse.of(result, AuditLogDto::from);
    }

    /**
     * Restricts the trail to actors the caller is allowed to see.
     *
     * ROOT and AUDIT see the platform. A firm-level caller sees only entries recorded by users
     * of their own reporting entity; if that firm somehow has no users, the disjunction is
     * deliberately impossible rather than absent, so an empty set can never widen the result.
     */
    private Specification<AuditLog> visibleActorScope() {
        UserPrincipal actor = currentPrincipal();
        if (actor == null) {
            return (root, query, cb) -> cb.disjunction();
        }
        if (actor.role().seesAllFirms()) {
            return (root, query, cb) -> cb.conjunction();
        }
        List<Long> firmUserIds = users.findByRealEstateFirmIdOrderByIdAsc(actor.realEstateFirmId())
                .stream().map(User::getId).toList();
        if (firmUserIds.isEmpty()) {
            return (root, query, cb) -> cb.disjunction();
        }
        return (root, query, cb) -> root.get("actorUserId").in(firmUserIds);
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

    /**
     * A deal's audit trail. The controller gates which *roles* may ask; this gates which *deals*
     * they may ask about — without it a firm-level user could read any firm's trail by walking
     * deal ids. Scope is delegated to the same guard every other deal-read path uses.
     */
    @Transactional(readOnly = true)
    public List<AuditLogDto> listForDeal(Long dealId) {
        Deal deal = deals.findById(dealId)
                .orElseThrow(() -> new NotFoundException("Deal " + dealId + " not found"));
        Long firmId = branches.findById(deal.getFirmBranchId())
                .map(FirmBranch::getRealEstateFirmId).orElse(null);
        lifecycle.assertCanRead(deal, currentPrincipal(), firmId);
        return repo.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("Deal", dealId)
                .stream().map(AuditLogDto::from).toList();
    }

    /**
     * Audit trail for a set of entities of one type, newest first. Callers are responsible for
     * scoping the id set (e.g. to the caller's own firm) before handing it here.
     */
    @Transactional(readOnly = true)
    public List<AuditLogDto> listForEntities(String entityType, java.util.Collection<Long> entityIds) {
        if (entityIds == null || entityIds.isEmpty()) return List.of();
        return repo.findAllByEntityTypeAndEntityIdInOrderByCreatedAtDesc(entityType, entityIds)
                .stream().map(AuditLogDto::from).toList();
    }

    private UserPrincipal currentPrincipal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal up) {
            return up;
        }
        throw new ForbiddenException("Not authenticated");
    }

    private String resolveIp(HttpServletRequest req) {
        String fwd = req.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) {
            return fwd.split(",")[0].trim();
        }
        return req.getRemoteAddr();
    }
}
