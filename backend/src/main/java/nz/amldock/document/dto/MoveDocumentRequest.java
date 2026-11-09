package nz.amldock.document.dto;

/**
 * Where a document is moved to on its deal: one owner, or — when {@code targetNodeId} is null —
 * the property, meaning the deal's own documents.
 */
public record MoveDocumentRequest(Long targetNodeId) {}
