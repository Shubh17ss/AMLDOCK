package nz.amldock.deal.assurance;

import jakarta.validation.Valid;
import nz.amldock.deal.assurance.dto.AssuranceDealDto;
import nz.amldock.deal.assurance.dto.AssuranceVersionDto;
import nz.amldock.deal.dto.NoteRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * The assurance register, and the two marks a reviewer can put on a signed-off version.
 *
 * <p>The register is compliance's own workspace, so it is not open to every role that can read a
 * deal: an agent has no use for a list of other people's sign-offs. ROOT and AUDIT read it too,
 * because checking that assurance is being done is part of what they are there for.
 */
@RestController
public class AssuranceController {

    private static final String REVIEWER_ROLES =
            "hasAnyRole('AML_COMPLIANCE_OFFICER','SENIOR_MANAGER')";

    private final AssuranceService assurance;

    public AssuranceController(AssuranceService assurance) {
        this.assurance = assurance;
    }

    @GetMapping("/api/assurance")
    @PreAuthorize("hasAnyRole('AML_COMPLIANCE_OFFICER','SENIOR_MANAGER','ROOT','AUDIT')")
    public List<AssuranceDealDto> list(@RequestParam(required = false) Long firmId,
                                       @RequestParam(required = false) Long branchId) {
        return assurance.list(firmId, branchId);
    }

    @PostMapping("/api/deals/{dealId}/versions/{versionNo}/assure")
    @PreAuthorize(REVIEWER_ROLES)
    public AssuranceVersionDto assure(@PathVariable Long dealId, @PathVariable Integer versionNo,
                                      @Valid @RequestBody NoteRequest req) {
        return assurance.mark(dealId, versionNo, AssuranceStatus.ASSURED, req.note());
    }

    @PostMapping("/api/deals/{dealId}/versions/{versionNo}/unassure")
    @PreAuthorize(REVIEWER_ROLES)
    public AssuranceVersionDto unassure(@PathVariable Long dealId, @PathVariable Integer versionNo,
                                        @Valid @RequestBody NoteRequest req) {
        return assurance.mark(dealId, versionNo, AssuranceStatus.UNASSURED, req.note());
    }
}
