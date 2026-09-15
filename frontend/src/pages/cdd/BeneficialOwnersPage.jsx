import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Stack } from '@mui/material';
import TableViewIcon from '@mui/icons-material/TableView';
import { listIndividuals } from '../../api/individuals.js';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { SearchField, matchesSearch } from '../../components/SearchField.jsx';
import { SkeletonTable } from '../../components/SkeletonTable.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { countryName } from '../../data/countries.js';
import { buildCsv } from '../../utils/csv.js';
import { IndividualsTable, formatDob } from './IndividualsTable.jsx';
import { nodeTypeLabel } from '../../api/ownership.js';

const slug = (s) => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const csvHeaders = ['Name', 'Type', 'Date of birth', 'Country of residence', 'Property', 'Deal'];
export const csvRowFor = (r) => [
  r.displayName,
  nodeTypeLabel(r.nodeType),
  r.dateOfBirth ?? '',
  r.countryOfResidence ? (countryName(r.countryOfResidence) ?? r.countryOfResidence) : '',
  r.propertyAddress ?? '',
  r.dealReference,
];

/**
 * Downloads `rows` as a CSV named for the scope and today. Shared with the overseas register.
 *
 * <p>`noun` because the two registers count different things: this one lists every kind of owner,
 * that one only natural persons, and "Exported 12 people" would be wrong on exactly one of them.
 * Given as a [singular, plural] pair rather than suffixed, so an irregular plural stays possible.
 */
export function exportIndividualsCsv({
  rows, prefix, firm, branch, showToast, noun = ['owner', 'owners'],
}) {
  const csv = buildCsv(csvHeaders, rows.map(csvRowFor));
  const name = [prefix, slug(firm?.name), slug(branch?.name), new Date().toISOString().slice(0, 10)]
    .filter(Boolean).join('-');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast({ severity: 'success', message: `Exported ${rows.length} ${rows.length === 1 ? noun[0] : noun[1]}` });
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
  const [query, setQuery] = useState('');

  const q = useQuery({
    // A distinct key from the Overseas register's: that one asks for natural persons only, and
    // two different result sets must not share one cache entry.
    queryKey: ['individuals', 'all-types', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listIndividuals({ firmId: firm?.id, branchId: branch?.id, allTypes: true }),
  });

  const all = q.data ?? [];
  const rows = useMemo(
    () => all.filter((r) => matchesSearch(query, r.displayName, r.propertyAddress, r.dealReference)),
    [all, query],
  );

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow={[
          `${rows.length} ${rows.length === 1 ? 'owner' : 'owners'} on record`,
          firm?.name,
          branch?.name,
        ].filter(Boolean).join(' · ')}
        title="Beneficial Owners"
        actions={(
          <Button
            variant="outlined"
            startIcon={<TableViewIcon />}
            disabled={rows.length === 0}
            onClick={() => exportIndividualsCsv({
              rows, prefix: 'beneficial-owners', firm, branch, showToast,
            })}
          >
            Download CSV
          </Button>
        )}
      />

      <SearchField value={query} onChange={setQuery} placeholder="Search name, property or deal…" />

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
    </Stack>
  );
}
