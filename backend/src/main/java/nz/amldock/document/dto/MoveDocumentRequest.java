package nz.amldock.document.dto;

import jakarta.validation.constraints.Size;
import nz.amldock.document.DocumentType;

/**
 * Where a document is moved to on its deal: one owner, or — when {@code targetNodeId} is null —
 * the property, meaning the deal's own documents.
 *
 * <p>{@code documentType} and {@code filename} are optional and keep the current value when null:
 * a passport can only reach the property once it is filed as something the property takes, so the
 * new type travels with the move rather than in a second call that would have to come first.
 */
public record MoveDocumentRequest(
        Long targetNodeId,
        DocumentType documentType,
        @Size(max = 255) String filename
) {}
