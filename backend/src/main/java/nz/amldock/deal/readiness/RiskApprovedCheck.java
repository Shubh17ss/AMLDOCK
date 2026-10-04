package nz.amldock.deal.readiness;

import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * The deal's risk level has been approved.
 *
 * <p>An approval falls away on its own when the score moves or a question goes unanswered
 * ({@code DealRiskService}), so this also catches a deal that was approved and has changed since.
 */
@Component
@Order(20)
public class RiskApprovedCheck implements VerificationCheck {

    @Override
    public List<String> missing(ReadinessContext ctx) {
        return ctx.deal().isRiskApproved() ? List.of() : List.of("Risk level approved");
    }
}
