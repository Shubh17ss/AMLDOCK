package nz.amldock.common.web;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/**
 * @param totalExact false when the list has more than {@link PageRequests#COUNT_CAP} matches: then
 *                   {@code totalElements} is a floor ({@code COUNT_CAP + 1}) and the UI shows
 *                   "more than 1,000"; {@code totalPages} is computed from that floor
 */
public record PageResponse<T>(
        List<T> items,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean totalExact
) {
    public static <S, T> PageResponse<T> of(Page<S> page, Function<S, T> mapper) {
        return new PageResponse<>(
                page.getContent().stream().map(mapper).toList(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                true);
    }

    /** For pages assembled by hand: an id query gave the slice and the total, a mapper the rows. */
    public static <T> PageResponse<T> of(List<T> items, PageRequests paging, long totalElements) {
        return of(items, paging, totalElements, true);
    }

    public static <T> PageResponse<T> of(List<T> items, PageRequests paging, long totalElements, boolean exact) {
        int totalPages = (int) ((totalElements + paging.size() - 1) / paging.size());
        return new PageResponse<>(items, paging.page(), paging.size(), totalElements, totalPages, exact);
    }
}
