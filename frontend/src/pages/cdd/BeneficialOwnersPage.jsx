import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Alert, Button, Stack } from '@mui/material';
import TableViewIcon from '@mui/icons-material/TableView';
import { downloadIndividualsCsv, listIndividuals } from '../../api/individuals.js';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { SearchField } from '../../components/SearchField.jsx';
import { ListPagination, countText } from '../../components/ListPagination.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import { SkeletonTable } from '../../components/SkeletonTable.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { IndividualsTable } from './IndividualsTable.jsx';

const slug = (s) => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Downloads the register as a CSV named for the scope and today. Shared by all three CDD
 * registers.
 *
 * <p>Built on the server from the same filters as the list (`params`), so the file holds every
 * matching row, not just the page on screen. The server picks the columns: the exceptions
 * register (filtered on a verification outcome) dates rows by verification; the others show
 * birth date and residence.
 *
 * <p>`noun` because the registers count different things: this one lists every kind of owner,
 * the overseas one only natural persons, and "Exported 12 people" would be wrong on exactly one
 * of them. `total` is the list's own count, which the file matches.
 */
export async function exportIndividualsCsv({
  params, total, prefix, firm, branch, showToast, noun = ['owner', 'owners'],
}) {
  const name = [prefix, slug(firm?.name), slug(branch?.name), new Date().toISOString().slice(0, 10)]
    .filter(Boolean).join('-');
  try {
    await downloadIndividualsCsv({ ...params, filename: `${name}.csv` });
    showToast({ severity: 'success', message: `Exported ${total} ${total === '1' ? noun[0] : noun[1]}` });
  } catch {
    showToast({ severity: 'error', message: 'The export failed. Try again.' });
  }
}

/**
 * Every owner behind the scoped branch's deals — people and entities alike.
 *
 * <p>The server decides who "every" means: an agent sees the owners on their own deals, a branch
 * admin their branch's, a compliance officer their firm's. This page passes the scope and renders
 * what comes back rather than filtering again.
 */
export function BeneficialOwnersPage() {
  const { firm, branch } = useDashboardScope();
  const { showToast } = useToast();
  const paged = usePagedList({ resetOn: [firm?.id, branch?.id] });
  const query = paged.search;
  const filters = { firmId: firm?.id, branchId: branch?.id, allTypes: true, q: paged.params.q };

  const q = useQuery({
    // A distinct key from the Overseas register's: that one asks for natural persons only, and
    // two different result sets must not share one cache entry.
    queryKey: ['individuals', 'all-types', firm?.id ?? null, branch?.id ?? null, paged.params],
    queryFn: () => listIndividuals({ ...filters, page: paged.page, size: paged.size }),
    placeholderData: keepPreviousData,
  });

  const rows = q.data?.items ?? [];
  const total = q.data?.totalElements ?? 0;

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow={[
          `${countText(q.data)} ${total === 1 ? 'owner' : 'owners'} on record`,
          firm?.name,
          branch?.name,
        ].filter(Boolean).join(' · ')}
        title="Beneficial Owners"
        actions={(
          <Button
            variant="outlined"
            startIcon={<TableViewIcon />}
            disabled={total === 0}
            onClick={() => exportIndividualsCsv({
              params: filters, total: countText(q.data), prefix: 'beneficial-owners', firm, branch, showToast,
            })}
          >
            Download CSV
          </Button>
        )}
      />

      <SearchField value={query} onChange={paged.setSearch} placeholder="Search name, property or deal…" />

      {q.isError && (
        <Alert severity="error">Failed to load the register. Refresh to try again.</Alert>
      )}

      {q.isLoading
        ? <SkeletonTable rows={6} columns={5} />
        : (
          <IndividualsTable
            rows={rows}
            loading={q.isLoading}
            emptyMessage={query.trim()
              ? 'Nobody matches that search.'
              : 'No individuals yet — they appear here as owners are added to this branch’s deals.'}
          />
        )}
      <ListPagination data={q.data} paged={paged} />
    </Stack>
  );
}
