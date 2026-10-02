package nz.amldock.deal.assurance;

import jakarta.validation.Valid;
import nz.amldock.deal.assurance.dto.AssuranceDealDto;
import nz.amldock.deal.assurance.dto.AssuranceVersionDto;
import nz.amldock.deal.assurance.dto.UpdateAssuranceRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

/**
 * The assurance register, and the verdict a reviewer records on a signed-off version.
 *
 * <p>The register is compliance's own workspace, so it is not open to every role that can read a
 * deal: an agent has no use for a list of other people's sign-offs. ROOT and AUDIT read it too,
 * because checking that assurance is being done is part of what they are there for.
 */
@RestController
public class AssuranceController {

    private final AssuranceService assurance;

    public AssuranceController(AssuranceService assurance) {
        this.assurance = assurance;
    }

    /**
     * @param from start of the date range, inclusive (an instant — the client sends the start of
     *             its local day)
     * @param to   end of the range, inclusive (the end of the client's local day)
     */
    @GetMapping("/api/assurance")
    @PreAuthorize("hasAnyRole('AML_COMPLIANCE_OFFICER','SENIOR_MANAGER','ROOT','AUDIT')")
    public List<AssuranceDealDto> list(@RequestParam(required = false) Long firmId,
                                       @RequestParam(required = false) Long branchId,
                                       @RequestParam(required = false) Instant from,
                                       @RequestParam(required = false) Instant to) {
        return assurance.list(firmId, branchId, from, to);
    }

    @PutMapping("/api/deals/{dealId}/versions/{versionNo}/assurance")
    @PreAuthorize("hasAnyRole('AML_COMPLIANCE_OFFICER','SENIOR_MANAGER')")
    public AssuranceVersionDto update(@PathVariable Long dealId, @PathVariable Integer versionNo,
                                      @Valid @RequestBody UpdateAssuranceRequest req) {
        return assurance.update(dealId, versionNo, req);
    }
}
