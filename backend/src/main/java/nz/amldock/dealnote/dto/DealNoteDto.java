package nz.amldock.dealnote.dto;

import nz.amldock.deal.DealStatus;

import java.time.Instant;

/**
 * One rendered timeline entry.
 *
 * <p>{@code id} is null on the synthesised opening entry — it is built from the deal itself
 * rather than a {@code deal_note} row, so there is nothing to identify. The frontend keys off
 * {@code kind} instead.
 *
 * @param kind        CREATION | COMMENT | TRANSITION — derived server-side so the client never
 *                    has to infer it from which fields happen to be null
 * @param voiceDocumentId the broker's VOICE_NOTE attached to the opening entry, if any
 */
public record DealNoteDto(
        Long id,
        String kind,
        Long authorUserId,
        String authorName,
        String authorEmail,
        String body,
        DealStatus statusFrom,
        DealStatus statusTo,
        Long voiceDocumentId,
        Instant createdAt
) {
    public static final String CREATION = "CREATION";
    public static final String COMMENT = "COMMENT";
    public static final String TRANSITION = "TRANSITION";
}
