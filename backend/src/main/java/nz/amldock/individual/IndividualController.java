package nz.amldock.individual;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletResponse;
import nz.amldock.common.web.PageRequests;
import nz.amldock.common.web.PageResponse;
import nz.amldock.ownership.NodeVerificationStatus;

import java.io.IOException;

/**
 * The natural people on a firm's or branch's deals — what the Beneficial Owners and Overseas
 * Residents registers read.
 *
 * <p>No {@code @PreAuthorize}, matching {@code DealController.list}: the role rule for a list of
 * deals is not a yes/no on the endpoint but a narrowing of what comes back, and it lives in
 * {@code DealScope}. An annotation here would be a second, coarser gate that could only disagree
 * with it.
 */
@RestController
@RequestMapping("/api/individuals")
public class IndividualController {

    private final IndividualService individuals;

    public IndividualController(IndividualService individuals) {
        this.individuals = individuals;
    }

    /**
     * Both filters are advisory — the caller's own role narrows them further, or ignores them.
     *
     * <p>{@code allTypes} widens the walk from natural persons to every kind of owner, and is
     * <strong>opt-in</strong> rather than the default on purpose. The owner picker shares this
     * endpoint to offer an existing person to copy onto a new INDIVIDUAL node; widening it for
     * everyone would put trusts and companies in that list, where copying one means nothing.
     * The CDD registers ask for the wider set; the picker does not.
     */
    @GetMapping
    public PageResponse<IndividualRowDto> list(@RequestParam(required = false) Long firmId,
                                               @RequestParam(required = false) Long branchId,
                                               @RequestParam(defaultValue = "false") boolean allTypes,
                                               @RequestParam(required = false) String q,
                                               @RequestParam(required = false) IndividualQuery.Residence residence,
                                               @RequestParam(required = false) NodeVerificationStatus verification,
                                               @RequestParam(required = false) Integer page,
                                               @RequestParam(required = false) Integer size) {
        return individuals.list(filter(firmId, branchId, allTypes, q, residence, verification),
                PageRequests.of(page, size));
    }

    /**
     * Every row matching the same filters as {@link #list}, as a CSV attachment. Built on the
     * server so the file holds the whole register, not just the page on screen.
     */
    @GetMapping(value = "/export", produces = "text/csv")
    public void export(@RequestParam(required = false) Long firmId,
                       @RequestParam(required = false) Long branchId,
                       @RequestParam(defaultValue = "false") boolean allTypes,
                       @RequestParam(required = false) String q,
                       @RequestParam(required = false) IndividualQuery.Residence residence,
                       @RequestParam(required = false) NodeVerificationStatus verification,
                       HttpServletResponse response) throws IOException {
        response.setContentType("text/csv;charset=UTF-8");
        response.setHeader("Content-Disposition", "attachment; filename=\"owners.csv\"");
        individuals.export(filter(firmId, branchId, allTypes, q, residence, verification), response.getWriter());
    }

    private static IndividualQuery.Filter filter(Long firmId, Long branchId, boolean allTypes, String q,
                                                 IndividualQuery.Residence residence,
                                                 NodeVerificationStatus verification) {
        return new IndividualQuery.Filter(firmId, branchId, allTypes, q, residence,
                verification == null ? null : verification.name());
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
