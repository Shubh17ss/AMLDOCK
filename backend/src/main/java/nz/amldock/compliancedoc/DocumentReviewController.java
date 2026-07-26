package nz.amldock.compliancedoc;

import jakarta.validation.Valid;
import nz.amldock.compliancedoc.dto.CompleteReviewRequest;
import nz.amldock.compliancedoc.dto.DocumentReviewDto;
import nz.amldock.compliancedoc.dto.SetReviewDateRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/document-reviews")
public class DocumentReviewController {

    private final DocumentReviewService reviews;

    public DocumentReviewController(DocumentReviewService reviews) {
        this.reviews = reviews;
    }

    /** Review status for every register in the selected scope (readable by any signed-in user). */
    @GetMapping
    public List<DocumentReviewDto> list(@RequestParam(required = false) Long firmId,
                                        @RequestParam(required = false) Long branchId) {
        return reviews.list(firmId, branchId);
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER','AML_COMPLIANCE_OFFICER')")
    public DocumentReviewDto setReviewDate(@Valid @RequestBody SetReviewDateRequest req) {
        return reviews.setReviewDate(req);
    }

    @PostMapping("/complete")
    @PreAuthorize("hasAnyRole('ROOT','SENIOR_MANAGER','AML_COMPLIANCE_OFFICER')")
    public DocumentReviewDto markComplete(@Valid @RequestBody CompleteReviewRequest req) {
        return reviews.markComplete(req);
    }
}
