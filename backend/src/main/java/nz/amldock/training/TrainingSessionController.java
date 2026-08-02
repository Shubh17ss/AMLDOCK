package nz.amldock.training;

import jakarta.validation.Valid;
import nz.amldock.training.dto.CreateTrainingSessionRequest;
import nz.amldock.training.dto.TrainingSessionDto;
import nz.amldock.training.dto.UpdateTrainingSessionRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * AML Training › Sessions.
 *
 * Unlike the providers path this one is NOT locked to the training managers in SecurityConfig:
 * branch staff need GET (their own assignments) and POST /{id}/complete. Every write that
 * belongs to a manager is gated per method below.
 */
@RestController
@RequestMapping("/api/training-sessions")
public class TrainingSessionController {

    private final TrainingSessionService sessions;

    public TrainingSessionController(TrainingSessionService sessions) {
        this.sessions = sessions;
    }

    /** Role-aware: managers get the scope's register, staff get their own assignments. */
    @GetMapping
    public List<TrainingSessionDto> list(@RequestParam(required = false) Long firmId,
                                         @RequestParam(required = false) Long branchId) {
        return sessions.list(firmId, branchId);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER','AML_COMPLIANCE_OFFICER')")
    public TrainingSessionDto create(@Valid @RequestBody CreateTrainingSessionRequest req) {
        return sessions.create(req);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER','AML_COMPLIANCE_OFFICER')")
    public TrainingSessionDto update(@PathVariable Long id,
                                     @Valid @RequestBody UpdateTrainingSessionRequest req) {
        return sessions.update(id, req);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        sessions.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** The signed-in user marks their own attendance complete. */
    @PostMapping("/{id}/complete")
    public TrainingSessionDto complete(@PathVariable Long id) {
        return sessions.complete(id);
    }
}
