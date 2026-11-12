package nz.amldock.query;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.email.EmailService;
import nz.amldock.email.EntityQueryEmail;
import nz.amldock.firm.RealEstateFirm;
import nz.amldock.firm.RealEstateFirmRepository;
import nz.amldock.query.dto.EntityQueryDto;
import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Change requests from a reporting entity's staff to the AMLDOCK admin team. Raised by the
 * entity's compliance officer or senior manager, about their own entity only; listed, resolved and
 * deleted by ROOT. The controller gates the roles; the entity is taken from the session here.
 */
@Service
public class EntityQueryService {

    static final int MAX_MESSAGE = 4000;

    private final EntityQueryRepository queries;
    private final RealEstateFirmRepository firms;
    private final UserRepository users;
    private final EmailService email;
    private final EntityQueryEmail queryEmail;
    private final AuditService audit;

    public EntityQueryService(EntityQueryRepository queries, RealEstateFirmRepository firms,
                              UserRepository users, EmailService email, EntityQueryEmail queryEmail,
                              AuditService audit) {
        this.queries = queries;
        this.firms = firms;
        this.users = users;
        this.email = email;
        this.queryEmail = queryEmail;
        this.audit = audit;
    }

    @Transactional
    public EntityQueryDto raise(String message) {
        UserPrincipal actor = currentPrincipal();
        if (actor.realEstateFirmId() == null) {
            throw new ForbiddenException("Your account is not linked to a reporting entity");
        }
        String text = message == null ? "" : message.trim();
        if (text.isEmpty()) throw new BadRequestException("Describe the change you need");
        if (text.length() > MAX_MESSAGE) {
            throw new BadRequestException("Keep the request under " + MAX_MESSAGE + " characters");
        }
        RealEstateFirm firm = firms.findById(actor.realEstateFirmId())
                .orElseThrow(() -> new NotFoundException("Reporting entity not found"));
        User raiser = users.findById(actor.id()).orElse(null);

        EntityQuery q = new EntityQuery();
        q.setRealEstateFirmId(firm.getId());
        q.setRaisedByUserId(actor.id());
        q.setRaisedByName(raiser == null ? null : raiser.getFullName());
        q.setRaisedByEmail(actor.email());
        q.setMessage(text);
        q = queries.save(q);

        audit.record(AuditAction.ENTITY_QUERY_RAISED, "EntityQuery", q.getId(),
                "Change request for " + firm.getName());

        // Fire-and-forget: EmailService swallows and logs its own failures, so a mail outage
        // never loses the request the user just made.
        for (User root : users.findByRoleAndActiveTrue(Role.ROOT)) {
            email.send(queryEmail.render(root.getEmail(), firm.getName(),
                    q.getRaisedByName(), q.getRaisedByEmail(), text));
        }
        return EntityQueryDto.from(q, firm.getPublicId(), firm.getName());
    }

    @Transactional(readOnly = true)
    public List<EntityQueryDto> list() {
        List<EntityQuery> rows = queries.findAllByOrderByCreatedAtDesc();
        Map<Long, RealEstateFirm> firmById = firms.findAllById(
                        rows.stream().map(EntityQuery::getRealEstateFirmId).distinct().toList())
                .stream().collect(Collectors.toMap(RealEstateFirm::getId, Function.identity()));
        return rows.stream().map(q -> {
            RealEstateFirm f = firmById.get(q.getRealEstateFirmId());
            return EntityQueryDto.from(q, f == null ? null : f.getPublicId(), f == null ? null : f.getName());
        }).toList();
    }

    @Transactional
    public void resolve(Long id) {
        EntityQuery q = mustFind(id);
        if (q.getStatus() == EntityQueryStatus.RESOLVED) return;
        q.setStatus(EntityQueryStatus.RESOLVED);
        q.setResolvedAt(Instant.now());
        q.setResolvedByUserId(currentPrincipal().id());
        audit.record(AuditAction.ENTITY_QUERY_RESOLVED, "EntityQuery", q.getId(),
                "Resolved change request from " + q.getRaisedByEmail());
    }

    /** Removes the row outright. The audit trail keeps the fact that it existed. */
    @Transactional
    public void delete(Long id) {
        EntityQuery q = mustFind(id);
        queries.delete(q);
        audit.record(AuditAction.ENTITY_QUERY_DELETED, "EntityQuery", id,
                "Deleted change request from " + q.getRaisedByEmail());
    }

    private EntityQuery mustFind(Long id) {
        return queries.findById(id).orElseThrow(() -> new NotFoundException("Query " + id + " not found"));
    }

    private static UserPrincipal currentPrincipal() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal up) return up;
        throw new BadRequestException("No authenticated user");
    }
}
