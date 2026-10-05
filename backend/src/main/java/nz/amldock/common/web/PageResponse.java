package nz.amldock.common.web;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

public record PageResponse<T>(
        List<T> items,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
    public static <S, T> PageResponse<T> of(Page<S> page, Function<S, T> mapper) {
        return new PageResponse<>(
                page.getContent().stream().map(mapper).toList(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages());
    }

    /** For pages assembled by hand: an id query gave the slice and the total, a mapper the rows. */
    public static <T> PageResponse<T> of(List<T> items, PageRequests paging, long totalElements) {
        int totalPages = (int) ((totalElements + paging.size() - 1) / paging.size());
        return new PageResponse<>(items, paging.page(), paging.size(), totalElements, totalPages);
    }
}
