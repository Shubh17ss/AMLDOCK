package nz.amldock.individual;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * The natural people on a firm's or branch's deals — what the Beneficial Owners and Overseas
 * Residents registers read.
 *
 * <p>No {@code @PreAuthorize}, matching {@code DealController.list}: the role rule for a list of
 * deals is not a yes/no on the endpoint but a narrowing of what comes back, and it lives in
 * {@code DealService.readableDeals}. An annotation here would be a second, coarser gate that could
 * only disagree with it.
 */
@RestController
@RequestMapping("/api/individuals")
public class IndividualController {

    private final IndividualService individuals;

    public IndividualController(IndividualService individuals) {
        this.individuals = individuals;
    }

    /** Both filters are advisory — the caller's own role narrows them further, or ignores them. */
    @GetMapping
    public List<IndividualRowDto> list(@RequestParam(required = false) Long firmId,
                                       @RequestParam(required = false) Long branchId) {
        return individuals.list(firmId, branchId);
    }
}
