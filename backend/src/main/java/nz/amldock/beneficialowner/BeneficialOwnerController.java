package nz.amldock.beneficialowner;

import nz.amldock.beneficialowner.dto.BeneficialOwnerDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * The people identified from a deal's scanned IDs.
 *
 * <p>Read-only for now. These records are produced by extraction and reviewed through the
 * ownership structure; there is no endpoint to create one by hand, because a beneficial owner
 * without a source document has no evidence behind it.
 *
 * <p>Scoping is the deal's own: {@code listForDeal} runs the same {@code assertCanRead} every
 * other deal-scoped read goes through, so an agent sees their deals and firm roles see theirs.
 */
@RestController
@RequestMapping("/api/deals")
public class BeneficialOwnerController {

    private final BeneficialOwnerService owners;

    public BeneficialOwnerController(BeneficialOwnerService owners) {
        this.owners = owners;
    }

    @GetMapping("/{dealId}/beneficial-owners")
    public List<BeneficialOwnerDto> listForDeal(@PathVariable Long dealId) {
        return owners.listForDeal(dealId);
    }
}
