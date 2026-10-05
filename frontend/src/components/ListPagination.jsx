import { TablePagination } from '@mui/material';

/**
 * Pager for lists the server pages (the `PageResponse` shape: `{ items, totalElements, ... }`).
 * Pairs with `usePagedList`. Renders nothing while there is a single short page, so small
 * registers look as they did before paging.
 */
export function ListPagination({ data, paged, rowsPerPageOptions = [25, 50, 100], sx }) {
  const total = data?.totalElements ?? 0;
  if (total <= Math.min(paged.size, rowsPerPageOptions[0])) return null;
  return (
    <TablePagination
      component="div"
      count={total}
      page={paged.page}
      rowsPerPage={paged.size}
      onPageChange={(_, p) => paged.setPage(p)}
      rowsPerPageOptions={rowsPerPageOptions}
      onRowsPerPageChange={(e) => paged.setSize(Number(e.target.value))}
      sx={sx}
    />
  );
}
