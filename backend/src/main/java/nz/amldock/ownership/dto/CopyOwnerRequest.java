package nz.amldock.ownership.dto;

import jakarta.validation.constraints.NotNull;

/**
 * An owner on another of the firm's deals to copy onto this one, with everyone beneath it.
 *
 * <p>Only the id travels: the server reads every value off the source itself, so a copy is exactly
 * what is on file and nothing a client could edit on the way.
 */
public record CopyOwnerRequest(@NotNull Long sourceNodeId) {
}
