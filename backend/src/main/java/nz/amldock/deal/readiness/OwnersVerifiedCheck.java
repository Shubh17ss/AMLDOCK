package nz.amldock.deal.readiness;

import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Every owner on the structure is cleared, outright or by exception.
 *
 * <p>Every node, of every type, detached ones and the placeholder trust included: a node on the
 * structure is a claim about who owns the client, and an unverified claim is exactly what a
 * sign-off must not rest on. A deal with no owners at all has no claim to clear, and may be
 * verified.
 */
@Component
@Order(30)
public class OwnersVerifiedCheck implements VerificationCheck {

    @Override
    public List<String> missing(ReadinessContext ctx) {
        return ctx.nodes().stream()
                .filter(n -> n.getVerificationStatus() == null || !n.getVerificationStatus().isVerified())
                .map(n -> "Owner " + (n.getDisplayName() == null || n.getDisplayName().isBlank()
                        ? "#" + n.getId() : n.getDisplayName()) + " verified")
                .toList();
    }
}
