package nz.amldock.deal.readiness;

import nz.amldock.ownership.OwnershipNode;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Every owner on the structure is cleared, outright or by exception.
 *
 * <p>Every node, of every type, detached ones and the placeholder trust included: a node on the
 * structure is a claim about who owns the client, and an unverified claim is exactly what a
 * sign-off must not rest on. A deal with no structure at all has nobody verified, so it is not
 * ready either.
 */
@Component
@Order(30)
public class OwnersVerifiedCheck implements VerificationCheck {

    @Override
    public List<String> missing(ReadinessContext ctx) {
        List<OwnershipNode> nodes = ctx.nodes();
        if (nodes.isEmpty()) return List.of("Ownership structure");
        return nodes.stream()
                .filter(n -> n.getVerificationStatus() == null || !n.getVerificationStatus().isVerified())
                .map(n -> "Owner " + (n.getDisplayName() == null || n.getDisplayName().isBlank()
                        ? "#" + n.getId() : n.getDisplayName()) + " verified")
                .toList();
    }
}
