package nz.amldock.user.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * The code from the new address.
 *
 * <p>It carries no email of its own — the address is read from the code that was issued, not from
 * the client. Accepting one here would let a caller spend a code proving they own one address on a
 * move to a different one, which is the whole attack the verification exists to stop.
 */
public record EmailChangeVerifyRequest(
        @NotBlank(message = "Enter the code we sent to your new address")
        String code
) {}
