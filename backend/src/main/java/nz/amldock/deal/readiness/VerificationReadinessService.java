package nz.amldock.deal.readiness;

import nz.amldock.common.exception.BadRequestException;
import nz.amldock.deal.Deal;
import nz.amldock.ownership.OwnershipNodeRepository;
import nz.amldock.ownership.OwnershipStructureRepository;
import nz.amldock.property.PropertyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Whether a deal has everything compliance needs before it can be verified.
 *
 * <p>The rules themselves are the {@link VerificationCheck} beans; this only runs them, in their
 * {@code @Order}, and collects what they find. Spring injects the list, so a new rule is a new
 * class and nothing here changes.
 *
 * <p>Enforced on the server at every way into VERIFIED — the verify transition and a senior
 * manager's override alike — and exposed read-only so the status dialog can say what is missing
 * before anyone presses the button.
 */
@Service
public class VerificationReadinessService {

    /** The line the dialog shows above the list, and the start of the server's refusal. */
    public static final String MESSAGE = "Please provide all the mandatory information";

    private final List<VerificationCheck> checks;
    private final PropertyRepository properties;
    private final OwnershipStructureRepository structures;
    private final OwnershipNodeRepository nodes;

    public VerificationReadinessService(List<VerificationCheck> checks, PropertyRepository properties,
                                        OwnershipStructureRepository structures,
                                        OwnershipNodeRepository nodes) {
        this.checks = checks;
        this.properties = properties;
        this.structures = structures;
        this.nodes = nodes;
    }

    @Transactional(readOnly = true)
    public Readiness assess(Deal deal) {
        ReadinessContext ctx = new ReadinessContext(deal, properties, structures, nodes);
        List<String> missing = new ArrayList<>();
        for (VerificationCheck check : checks) missing.addAll(check.missing(ctx));
        return Readiness.of(missing);
    }

    /** Refuses with the list of what is missing, so an API caller gets the same answer the dialog does. */
    public void assertReady(Deal deal) {
        Readiness r = assess(deal);
        if (!r.ready()) {
            throw new BadRequestException(MESSAGE + ": " + String.join("; ", r.missing()));
        }
    }
}
