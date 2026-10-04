package nz.amldock.deal.readiness;

import java.util.List;

/**
 * One condition a deal has to meet before it can be verified.
 *
 * <p>Each is its own Spring bean, collected by {@link VerificationReadinessService}. Adding a rule
 * is adding a class: nothing that runs the checks, and nothing on the screen that lists what is
 * missing, has to change. Order them with {@code @Order} — it is the order the reviewer reads.
 */
public interface VerificationCheck {

    /**
     * What this check finds still outstanding, as short labels a reviewer can act on ("Risk level
     * approved", "Owner Jane Doe verified"). Empty when the condition is met.
     */
    List<String> missing(ReadinessContext ctx);
}
