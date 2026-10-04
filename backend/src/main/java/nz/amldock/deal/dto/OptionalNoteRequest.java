package nz.amldock.deal.dto;

import jakarta.validation.constraints.Size;

/**
 * A note a transition may carry but does not need — verifying, since the readiness check took
 * over what a verify note used to vouch for. When present it still has to clear the 3-character
 * floor, which DealLifecycleService checks once the blank case has been set aside.
 */
public record OptionalNoteRequest(
        @Size(max = 4000) String note
) {}
