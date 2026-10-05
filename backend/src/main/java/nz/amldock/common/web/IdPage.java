package nz.amldock.common.web;

import java.util.List;

/** One page of ids, in display order, and how many rows match in total. */
public record IdPage(List<Long> ids, long total) {
    public static IdPage empty() {
        return new IdPage(List.of(), 0);
    }
}
