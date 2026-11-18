package nz.amldock.query.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** A change request. The entity is the raiser's own, taken from their session, never from here. */
public record RaiseEntityQueryRequest(
        @NotBlank @Size(max = 4000) String message
) {}
