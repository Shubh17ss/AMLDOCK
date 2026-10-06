package nz.amldock.common.web;

import java.util.List;

/**
 * One page of ids, in display order, and how many rows match.
 *
 * @param total how many match, counted up to {@link PageRequests#COUNT_CAP} + 1
 * @param exact false when there are more than {@link PageRequests#COUNT_CAP} matches and
 *              {@code total} is a floor, not a count
 */
public record IdPage(List<Long> ids, long total, boolean exact) {

    public IdPage(List<Long> ids, long total) {
        this(ids, total, true);
    }

    public static IdPage empty() {
        return new IdPage(List.of(), 0, true);
    }
}
