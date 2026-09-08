package nz.amldock.ownership.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * The new top-to-bottom order of one owner's children, or of the top-level owners.
 *
 * @param parentNodeId the owner whose children are being arranged, or null for the nodes at the top
 *                     of the chain, which have no owner and so no edge to carry a position
 * @param childNodeIds every one of that parent's children, in the order they should be drawn — the
 *                     complete set, not a subset. A reorder writes a dense 0..n-1 over the whole
 *                     sibling group, so a partial list would leave the rest unpositioned and
 *                     sorting ahead of it. Requiring the full set also means a caller working from
 *                     a stale tree — one that has gained a sibling since it was loaded — is told
 *                     so, rather than silently rearranging around a row it cannot see.
 */
public record ReorderRequest(
        Long parentNodeId,
        @NotEmpty List<Long> childNodeIds
) {}
