import { TablePagination } from '@mui/material';

/**
 * Pager for lists the server pages (the `PageResponse` shape: `{ items, totalElements, totalExact,
 * ... }`). Pairs with `usePagedList`. Renders nothing while there is a single short page, so small
 * registers look as they did before paging.
 *
 * Above 1,000 matches the server stops counting (`totalExact: false`, so counting stays cheap at
 * any data size): the pager then says "of more than 1,000" and keeps Next enabled until a page
 * comes back short.
 */
export function ListPagination({ data, paged, rowsPerPageOptions = [25, 50, 100], sx }) {
  const total = data?.totalElements ?? 0;
  const exact = data?.totalExact !== false;
  if (exact && total <= Math.min(paged.size, rowsPerPageOptions[0])) return null;
  const lastPage = !exact && (data?.items?.length ?? 0) < paged.size;
  return (
    <TablePagination
      component="div"
      count={exact ? total : lastPage ? paged.page * paged.size + (data?.items?.length ?? 0) : -1}
      page={paged.page}
      rowsPerPage={paged.size}
      onPageChange={(_, p) => paged.setPage(p)}
      rowsPerPageOptions={rowsPerPageOptions}
      onRowsPerPageChange={(e) => paged.setSize(Number(e.target.value))}
      labelDisplayedRows={({ from, to, count }) =>
        `${from}\u2013${to} of ${count === -1 ? 'more than 1,000' : count.toLocaleString()}`}
      sx={sx}
    />
  );
}

/**
 * A list's total for headers and messages: the exact number, or "1,000+" when the server stopped
 * counting at the cap.
 */
export function countText(data) {
  const total = data?.totalElements ?? 0;
  return data?.totalExact === false ? '1,000+' : total.toLocaleString();
}
