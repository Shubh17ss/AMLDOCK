package nz.amldock.ownership.dto;

import jakarta.validation.constraints.NotNull;
import nz.amldock.ownership.NodeVerificationStatus;

/**
 * Granting a verification on one owner.
 *
 * <p>Deliberately not part of {@link UpdateNodeRequest}. A verification carries a byline, and a
 * byline is only worth anything if the server writes it - so the decision needs a verb of its
 * own rather than riding a patch that could name its own verifier.
 *
 * @param outcome  {@code VERIFIED} or {@code VERIFIED_WITH_EXCEPTION}. The other three states
 *                 are set when a node is created and cannot be granted; the service rejects
 *                 them rather than letting this route walk a node backwards.
 * @param notes    why the exception was granted. Required, and required to be non-blank, when
 *                 the outcome is {@code VERIFIED_WITH_EXCEPTION} - an exception with no reason
 *                 is the one record nobody can defend later. Ignored on a plain verification,
 *                 which clears any note left by a previous exception.
 */
public record VerifyNodeRequest(
        @NotNull NodeVerificationStatus outcome,
        String notes
) {
}
