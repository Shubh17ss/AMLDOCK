package nz.amldock.ownership;

import nz.amldock.ownership.dto.VerificationTrailEntryDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** The verifications granted to an owner on every deal they appear on. Readable with the deal. */
@RestController
@RequestMapping("/api/deals/{dealId}/ownership")
public class VerificationTrailController {

    private final VerificationTrailService trail;

    public VerificationTrailController(VerificationTrailService trail) {
        this.trail = trail;
    }

    @GetMapping("/nodes/{nodeId}/verification-trail")
    public List<VerificationTrailEntryDto> trail(@PathVariable Long dealId, @PathVariable Long nodeId) {
        return trail.trail(dealId, nodeId);
    }
}
