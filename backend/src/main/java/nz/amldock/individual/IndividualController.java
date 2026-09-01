package nz.amldock.individual;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

    /**
     * One individual in full, addressed by node id because that is what a row of the register is.
     *
     * <p>Feeds the owner picker, which copies an existing person onto a new deal. No
     * {@code @PreAuthorize} here for the same reason as {@link #list}: the rule is whether the
     * caller can read the deal this person stands on, and it lives in the service.
     */
    @GetMapping("/{nodeId}")
    public IndividualDetailDto detail(@PathVariable Long nodeId) {
        return individuals.detail(nodeId);
    }
}
