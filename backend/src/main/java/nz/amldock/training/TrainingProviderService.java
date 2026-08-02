package nz.amldock.training;

import nz.amldock.audit.AuditAction;
import nz.amldock.audit.AuditService;
import nz.amldock.common.exception.BadRequestException;
import nz.amldock.common.exception.ForbiddenException;
import nz.amldock.common.exception.NotFoundException;
import nz.amldock.firm.FirmBranch;
import nz.amldock.firm.FirmBranchRepository;
import nz.amldock.training.dto.CreateTrainingProviderRequest;
import nz.amldock.training.dto.TrainingProviderDto;
import nz.amldock.user.Role;
import nz.amldock.user.User;
import nz.amldock.user.UserPrincipal;
import nz.amldock.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Training providers, scoped to a firm and branch. Firm resolution mirrors
 * {@link nz.amldock.suspiciousactivity.SuspiciousActivityService} — ROOT may target any firm,
 * everyone else is pinned to their own.
 */
@Service
public class TrainingProviderService {

    private static final String ENTITY_TYPE = "TrainingProvider";

    private final TrainingProviderRepository providers;
    private final TrainingSessionRepository sessions;
    private final UserRepository users;
    private final FirmBranchRepository branches;
    private final AuditService audit;

    public TrainingProviderService(TrainingProviderRepository providers,
                                   TrainingSessionRepository sessions,
                                   UserRepository users,
                                   FirmBranchRepository branches,
                                   AuditService audit) {
        this.providers = providers;
        this.sessions = sessions;
        this.users = users;
        this.branches = branches;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<TrainingProviderDto> list(Long requestedFirmId, Long branchId) {
        UserPrincipal actor = TrainingScope.currentPrincipal();
        Long firmId = TrainingScope.resolveTargetFirm(actor, requestedFirmId);
        Long resolvedBranch = resolveBranch(branchId, firmId);
        return providers.findAllScoped(firmId, resolvedBranch).stream().map(this::toDto).toList();
    }

    @Transactional
    public TrainingProviderDto create(CreateTrainingProviderRequest req) {
        UserPrincipal actor = TrainingScope.currentPrincipal();
        Long firmId = TrainingScope.resolveTargetFirm(actor, req.realEstateFirmId());
        Long branchId = resolveBranch(req.firmBranchId(), firmId);
        String name = req.name().trim();

        if (providers.existsByRealEstateFirmIdAndFirmBranchIdAndNameIgnoreCase(firmId, branchId, name)) {
            throw new BadRequestException("A provider with that name already exists for this branch");
        }

        TrainingProvider p = new TrainingProvider();
        p.setName(name);
        p.setEmail(trimToNull(req.email()));
        p.setRealEstateFirmId(firmId);
        p.setFirmBranchId(branchId);
        p.setCreatedByUserId(actor.id());
        TrainingProvider saved = providers.save(p);

        audit.record(AuditAction.TRAINING_PROVIDER_CREATED, ENTITY_TYPE, saved.getId(),
                "Added training provider " + saved.getName());
        return toDto(saved);
    }

    /** Deletes are restricted to ROOT and SENIOR_MANAGER (also gated by @PreAuthorize). */
    @Transactional
    public void delete(Long id) {
        TrainingProvider p = providers.findById(id)
                .orElseThrow(() -> new NotFoundException("Provider " + id + " not found"));
        UserPrincipal actor = TrainingScope.currentPrincipal();
        if (actor.role() != Role.ROOT && actor.role() != Role.SENIOR_MANAGER) {
            throw new ForbiddenException("Only ROOT or a senior manager may delete a provider");
        }
        if (actor.role() != Role.ROOT) {
            TrainingScope.assertSameFirm(actor, p.getRealEstateFirmId(), "provider");
        }
        // The FK is ON DELETE RESTRICT — say why rather than letting a constraint error surface.
        if (sessions.existsByTrainingProviderId(p.getId())) {
            throw new BadRequestException(
                    "This provider is used by one or more sessions — remove those sessions first");
        }
        providers.delete(p);
        audit.record(AuditAction.TRAINING_PROVIDER_DELETED, ENTITY_TYPE, id,
                "Deleted training provider " + p.getName());
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

    private TrainingProviderDto toDto(TrainingProvider p) {
        String email = users.findById(p.getCreatedByUserId()).map(User::getEmail).orElse(null);
        String branchName = p.getFirmBranchId() == null
                ? null
                : branches.findById(p.getFirmBranchId()).map(FirmBranch::getName).orElse(null);
        return TrainingProviderDto.from(p, branchName, email);
    }

    private static String trimToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
