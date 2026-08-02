package nz.amldock.training;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.training.dto.CreateTrainingSessionRequest;
import nz.amldock.training.dto.TrainingAttendeeDto;
import nz.amldock.training.dto.TrainingSessionDto;
import nz.amldock.training.dto.UpdateTrainingSessionRequest;
import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Training sessions and their rosters.
 *
 * The list endpoint is role-aware in the same spirit as
 * {@link nz.amldock.user.UserService#findVisible}: training managers (ROOT, compliance officer,
 * senior manager) see every session in the selected scope, while branch staff see only the
 * sessions they have been assigned to — and only their own attendee row within them.
 */
@Service
public class TrainingSessionService {

    private static final String ENTITY_TYPE = "TrainingSession";

    private final TrainingSessionRepository sessions;
    private final TrainingSessionAttendeeRepository attendees;
    private final TrainingProviderRepository providers;
    private final UserRepository users;
    private final FirmBranchRepository branches;
    private final AuditService audit;
    private final TrainingNotifier notifier;

    public TrainingSessionService(TrainingSessionRepository sessions,
                                  TrainingSessionAttendeeRepository attendees,
                                  TrainingProviderRepository providers,
                                  UserRepository users,
                                  FirmBranchRepository branches,
                                  AuditService audit,
                                  TrainingNotifier notifier) {
        this.sessions = sessions;
        this.attendees = attendees;
        this.providers = providers;
        this.users = users;
        this.branches = branches;
        this.audit = audit;
        this.notifier = notifier;
    }

    /** Training managers get the scope's whole register; everyone else gets their own assignments. */
    @Transactional(readOnly = true)
    public List<TrainingSessionDto> list(Long requestedFirmId, Long branchId) {
        UserPrincipal actor = TrainingScope.currentPrincipal();

        List<TrainingSession> rows;
        if (isTrainingManager(actor.role())) {
            Long firmId = TrainingScope.resolveTargetFirm(actor, requestedFirmId);
            Long resolvedBranch = resolveBranch(branchId, firmId);
            rows = sessions.findAllScoped(firmId, resolvedBranch);
        } else {
            Set<Long> mine = attendees.findAllByUserId(actor.id()).stream()
                    .map(TrainingSessionAttendee::getTrainingSessionId)
                    .collect(Collectors.toSet());
            rows = mine.isEmpty() ? List.of() : sessions.findAllByIdInOrdered(mine);
        }
        return toDtos(rows, actor);
    }

    @Transactional
    public TrainingSessionDto create(CreateTrainingSessionRequest req) {
        UserPrincipal actor = TrainingScope.currentPrincipal();
        Long firmId = TrainingScope.resolveTargetFirm(actor, req.realEstateFirmId());
        Long branchId = resolveBranch(req.firmBranchId(), firmId);
        assertMinutes(req.totalMinutes(), req.certifiedMinutes());

        TrainingSession s = new TrainingSession();
        s.setName(req.name().trim());
        s.setLocation(req.location().trim());
        s.setUrl(trimToNull(req.url()));
        s.setTrainingProviderId(resolveProvider(req.trainingProviderId(), firmId, branchId));
        s.setDueDate(req.dueDate());
        s.setTotalMinutes(req.totalMinutes());
        s.setCertifiedMinutes(req.certifiedMinutes());
        s.setRealEstateFirmId(firmId);
        s.setFirmBranchId(branchId);
        s.setCreatedByUserId(actor.id());
        TrainingSession saved = sessions.save(s);

        // A brand-new session has no existing roster, so everyone added is newly assigned.
        List<Long> newlyAssigned = replaceRoster(saved, req.assigneeUserIds());
        notifyNewlyAssigned(saved, newlyAssigned);

        audit.record(AuditAction.TRAINING_SESSION_CREATED, ENTITY_TYPE, saved.getId(),
                "Created training session " + saved.getName() + " for " + newlyAssigned.size() + " staff");
        return toDtos(List.of(saved), actor).get(0);
    }

    @Transactional
    public TrainingSessionDto update(Long id, UpdateTrainingSessionRequest req) {
        TrainingSession s = sessions.findById(id)
                .orElseThrow(() -> new NotFoundException("Session " + id + " not found"));
        UserPrincipal actor = TrainingScope.currentPrincipal();
        TrainingScope.assertSameFirm(actor, s.getRealEstateFirmId(), "session");

        if (req.name() != null && !req.name().isBlank()) s.setName(req.name().trim());
        if (req.location() != null && !req.location().isBlank()) s.setLocation(req.location().trim());
        if (req.url() != null) s.setUrl(trimToNull(req.url()));
        if (req.dueDate() != null) s.setDueDate(req.dueDate());
        if (req.trainingProviderId() != null) {
            s.setTrainingProviderId(resolveProvider(
                    req.trainingProviderId(), s.getRealEstateFirmId(), s.getFirmBranchId()));
        }
        if (req.totalMinutes() != null) s.setTotalMinutes(req.totalMinutes());
        if (req.certifiedMinutes() != null) s.setCertifiedMinutes(req.certifiedMinutes());
        assertMinutes(s.getTotalMinutes(), s.getCertifiedMinutes());

        // A supplied roster replaces the old one; omitting it leaves assignments untouched.
        // Only the people this adds get an email — anyone already on the session is left alone.
        if (req.assigneeUserIds() != null) {
            notifyNewlyAssigned(s, replaceRoster(s, req.assigneeUserIds()));
        }

        audit.record(AuditAction.TRAINING_SESSION_UPDATED, ENTITY_TYPE, s.getId(),
                "Updated training session " + s.getName());
        return toDtos(List.of(s), actor).get(0);
    }

    /** Deletes are restricted to ROOT and SENIOR_MANAGER (also gated by @PreAuthorize). */
    @Transactional
    public void delete(Long id) {
        TrainingSession s = sessions.findById(id)
                .orElseThrow(() -> new NotFoundException("Session " + id + " not found"));
        UserPrincipal actor = TrainingScope.currentPrincipal();
        if (actor.role() != Role.ROOT && actor.role() != Role.SENIOR_MANAGER) {
            throw new ForbiddenException("Only ROOT or a senior manager may delete a session");
        }
        if (actor.role() != Role.ROOT) {
            TrainingScope.assertSameFirm(actor, s.getRealEstateFirmId(), "session");
        }
        // Attendee rows cascade in the DB; clear them here so the JPA context agrees.
        attendees.deleteAllByTrainingSessionId(s.getId());
        sessions.delete(s);
        audit.record(AuditAction.TRAINING_SESSION_DELETED, ENTITY_TYPE, id,
                "Deleted training session " + s.getName());
    }

    /** The caller marks their own attendance complete. Idempotent. */
    @Transactional
    public TrainingSessionDto complete(Long id) {
        TrainingSession s = sessions.findById(id)
                .orElseThrow(() -> new NotFoundException("Session " + id + " not found"));
        UserPrincipal actor = TrainingScope.currentPrincipal();

        TrainingSessionAttendee row = attendees
                .findByTrainingSessionIdAndUserId(s.getId(), actor.id())
                .orElseThrow(() -> new ForbiddenException("You are not assigned to this session"));

        if (row.getCompletedAt() == null) {
            row.setCompletedAt(Instant.now());
            audit.record(AuditAction.TRAINING_SESSION_COMPLETED, ENTITY_TYPE, s.getId(),
                    actor.email() + " completed training session " + s.getName());
        }
        return toDtos(List.of(s), actor).get(0);
    }

    /* ---------- helpers ---------- */

    static boolean isTrainingManager(Role role) {
        return role == Role.ROOT || role == Role.AML_COMPLIANCE_OFFICER || role == Role.SENIOR_MANAGER;
    }

    private static void assertMinutes(Integer total, Integer certified) {
        if (total == null || certified == null) {
            throw new BadRequestException("Total and certified minutes are both required");
        }
        if (certified > total) {
            throw new BadRequestException("Certified minutes cannot exceed total minutes");
        }
    }

    /** The provider must exist in the same firm and branch the session is being filed under. */
    private Long resolveProvider(Long providerId, Long firmId, Long branchId) {
        TrainingProvider p = providers.findById(providerId)
                .orElseThrow(() -> new BadRequestException("Provider " + providerId + " not found"));
        boolean sameFirm = firmId == null
                ? p.getRealEstateFirmId() == null
                : firmId.equals(p.getRealEstateFirmId());
        boolean sameBranch = branchId == null
                ? p.getFirmBranchId() == null
                : branchId.equals(p.getFirmBranchId());
        if (!sameFirm || !sameBranch) {
            throw new BadRequestException("That provider belongs to a different branch");
        }
        return p.getId();
    }

    /**
     * Replace the session's roster, preserving completion for anyone who stays assigned.
     *
     * Every id is checked against the role model rather than trusted: an assignee must be
     * branch-level staff (sales manager, agent, agent PA, branch admin) sitting in this
     * session's branch. Firm-level compliance staff run training and are never assigned to it —
     * and {@code GET /api/users?branchId=} deliberately returns them, so filtering in the UI
     * alone would not be a boundary.
     */
    private List<Long> replaceRoster(TrainingSession session, List<Long> requestedUserIds) {
        Set<Long> wanted = requestedUserIds == null
                ? Set.of()
                : new LinkedHashSet<>(requestedUserIds.stream().filter(java.util.Objects::nonNull).toList());

        TrainingScope.assertAssignable(users, session.getRealEstateFirmId(),
                session.getFirmBranchId(), wanted);

        List<TrainingSessionAttendee> existing = attendees.findAllByTrainingSessionId(session.getId());
        Set<Long> existingIds = existing.stream()
                .map(TrainingSessionAttendee::getUserId).collect(Collectors.toSet());

        // Drop the people who are no longer on the roster.
        List<TrainingSessionAttendee> removed = existing.stream()
                .filter((a) -> !wanted.contains(a.getUserId())).toList();
        if (!removed.isEmpty()) attendees.deleteAll(removed);

        // Add the newcomers; everyone already there keeps their completedAt.
        List<TrainingSessionAttendee> added = new ArrayList<>();
        for (Long userId : wanted) {
            if (existingIds.contains(userId)) continue;
            TrainingSessionAttendee a = new TrainingSessionAttendee();
            a.setTrainingSessionId(session.getId());
            a.setUserId(userId);
            added.add(a);
        }
        if (!added.isEmpty()) attendees.saveAll(added);

        // The newly-inserted user ids, which is exactly who should be emailed: on create that's
        // everyone, and on edit it's only the people who weren't already on the roster.
        return added.stream().map(TrainingSessionAttendee::getUserId).toList();
    }

    /**
     * Email the people just added to this session — after the transaction commits.
     *
     * The send is @Async, so dispatching inline would let mail escape a rollback and tell staff
     * about a session that no longer exists. The recipients and provider name are resolved here,
     * while the persistence context is still open.
     */
    private void notifyNewlyAssigned(TrainingSession session, List<Long> newUserIds) {
        if (newUserIds.isEmpty()) return;
        List<User> recipients = users.findAllById(newUserIds);
        if (recipients.isEmpty()) return;
        String providerName = session.getTrainingProviderId() == null ? null
                : providers.findById(session.getTrainingProviderId())
                        .map(TrainingProvider::getName).orElse(null);

        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            notifier.notifySessionAssigned(session, providerName, recipients);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                notifier.notifySessionAssigned(session, providerName, recipients);
            }
        });
    }

    /** A branch tag must belong to the target firm; null means firm-wide. */
    private Long resolveBranch(Long branchId, Long firmId) {
        if (branchId == null) return null;
        if (firmId == null) throw new BadRequestException("A branch requires a firm");
        FirmBranch branch = branches.findById(branchId)
                .orElseThrow(() -> new BadRequestException("Branch " + branchId + " not found"));
        if (!firmId.equals(branch.getRealEstateFirmId())) {
            throw new BadRequestException("Branch does not belong to this firm");
        }
        return branch.getId();
    }

    /**
     * Assemble DTOs for a page of sessions with a fixed number of queries — one for every
     * roster, one for the users in them, one for the providers, one for the branches.
     */
    private List<TrainingSessionDto> toDtos(List<TrainingSession> rows, UserPrincipal actor) {
        if (rows.isEmpty()) return List.of();
        boolean manager = isTrainingManager(actor.role());

        List<Long> sessionIds = rows.stream().map(TrainingSession::getId).toList();
        Map<Long, List<TrainingSessionAttendee>> rosters = attendees
                .findAllByTrainingSessionIdIn(sessionIds).stream()
                .collect(Collectors.groupingBy(TrainingSessionAttendee::getTrainingSessionId));

        Set<Long> userIds = new HashSet<>();
        rosters.values().forEach((list) -> list.forEach((a) -> userIds.add(a.getUserId())));
        rows.forEach((s) -> userIds.add(s.getCreatedByUserId()));
        Map<Long, User> userById = userIds.isEmpty() ? Map.of()
                : users.findAllById(userIds).stream().collect(Collectors.toMap(User::getId, Function.identity()));

        Set<Long> providerIds = rows.stream()
                .map(TrainingSession::getTrainingProviderId).filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, TrainingProvider> providerById = providerIds.isEmpty() ? Map.of()
                : providers.findAllById(providerIds).stream()
                        .collect(Collectors.toMap(TrainingProvider::getId, Function.identity()));

        Set<Long> branchIds = rows.stream()
                .map(TrainingSession::getFirmBranchId).filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, FirmBranch> branchById = branchIds.isEmpty() ? Map.of()
                : branches.findAllById(branchIds).stream()
                        .collect(Collectors.toMap(FirmBranch::getId, Function.identity()));

        List<TrainingSessionDto> out = new ArrayList<>(rows.size());
        for (TrainingSession s : rows) {
            List<TrainingSessionAttendee> roster = rosters.getOrDefault(s.getId(), List.of());
            int assigned = roster.size();
            int completed = (int) roster.stream().filter((a) -> a.getCompletedAt() != null).count();

            Optional<TrainingSessionAttendee> mine = roster.stream()
                    .filter((a) -> a.getUserId().equals(actor.id())).findFirst();

            // Staff see only their own row — the roster is a manager's view.
            List<TrainingSessionAttendee> visible = manager ? roster : mine.map(List::of).orElse(List.of());
            List<TrainingAttendeeDto> attendeeDtos = visible.stream()
                    .map((a) -> {
                        User u = userById.get(a.getUserId());
                        return TrainingAttendeeDto.attendance(a.getUserId(),
                                u == null ? null : u.getFullName(),
                                u == null ? null : u.getEmail(),
                                u == null ? null : u.getRole(),
                                a.getCompletedAt());
                    })
                    .sorted(Comparator.comparing(
                            (TrainingAttendeeDto d) -> d.fullName() == null ? "" : d.fullName(),
                            String.CASE_INSENSITIVE_ORDER))
                    .toList();

            TrainingProvider p = providerById.get(s.getTrainingProviderId());
            FirmBranch b = s.getFirmBranchId() == null ? null : branchById.get(s.getFirmBranchId());
            User creator = userById.get(s.getCreatedByUserId());

            out.add(TrainingSessionDto.from(s,
                    p == null ? null : p.getName(),
                    b == null ? null : b.getName(),
                    creator == null ? null : creator.getEmail(),
                    attendeeDtos, assigned, completed,
                    mine.isPresent(), mine.map(TrainingSessionAttendee::getCompletedAt).orElse(null)));
        }
        return out;
    }

    private static String trimToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
