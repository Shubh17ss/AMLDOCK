package nz.amldock.deal.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * The note carried by a lifecycle transition, or the body of a free comment on the deal's
 * timeline. The 3-character floor matches {@code chk_deal_note_body}.
 */
public record NoteRequest(
        @NotBlank @Size(min = 3, max = 4000) String note
) {}
