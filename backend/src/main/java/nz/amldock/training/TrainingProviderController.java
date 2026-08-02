package nz.amldock.training;

import jakarta.validation.Valid;
import nz.amldock.training.dto.CreateTrainingProviderRequest;
import nz.amldock.training.dto.TrainingProviderDto;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * AML Training › Providers. The whole path is restricted to the training managers in
 * SecurityConfig — branch staff never need the provider list, they see the provider's name
 * resolved onto their session.
 */
@RestController
@RequestMapping("/api/training-providers")
public class TrainingProviderController {

    private final TrainingProviderService providers;

    public TrainingProviderController(TrainingProviderService providers) {
        this.providers = providers;
    }

    @GetMapping
    public List<TrainingProviderDto> list(@RequestParam(required = false) Long firmId,
                                          @RequestParam(required = false) Long branchId) {
        return providers.list(firmId, branchId);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER','AML_COMPLIANCE_OFFICER')")
    public TrainingProviderDto create(@Valid @RequestBody CreateTrainingProviderRequest req) {
        return providers.create(req);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        providers.delete(id);
        return ResponseEntity.noContent().build();
    }
}
