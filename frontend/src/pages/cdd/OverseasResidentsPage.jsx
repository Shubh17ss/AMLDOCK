import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Alert, Button, Stack } from '@mui/material';
import TableViewIcon from '@mui/icons-material/TableView';
import { listIndividuals } from '../../api/individuals.js';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { SearchField } from '../../components/SearchField.jsx';
import { ListPagination, countText } from '../../components/ListPagination.jsx';
import { usePagedList } from '../../hooks/usePagedList.js';
import { SkeletonTable } from '../../components/SkeletonTable.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { countryName } from '../../data/countries.js';
import { IndividualsTable } from './IndividualsTable.jsx';
import { exportIndividualsCsv } from './BeneficialOwnersPage.jsx';

/**
 * The people on this branch's deals who live somewhere other than the reporting entity does.
 *
 * <p>The overseas test runs on the server (`residence=OVERSEAS`): residence recorded and different
 * from the deal's reporting-entity country. It used to run here over the whole register, which a
 * paged list cannot do. This register asks for natural persons, where the Beneficial Owners one
 * asks for every kind of owner.
 *
 * <p><strong>Someone with no residence recorded is not listed.</strong> Not being asked is not
 * evidence of living abroad, and a register that treated it as such would accuse people of an
 * enhanced-diligence trigger on the strength of an empty field. The count of those unanswered rows
 * is surfaced instead, because "nobody is overseas" and "nobody has been asked" look identical
 * otherwise, and only one of them is finished work.
 */
export function OverseasResidentsPage() {
  const { firm, branch } = useDashboardScope();
  const { showToast } = useToast();
  const paged = usePagedList({ resetOn: [firm?.id, branch?.id] });
  const query = paged.search;
  const filters = { firmId: firm?.id, branchId: branch?.id, residence: 'OVERSEAS', q: paged.params.q };

  const q = useQuery({
    // Natural persons only — deliberately NOT the Beneficial Owners register's wider fetch, which
    // now carries companies and trusts too. This register is about where a person lives, and an
    // entity has no country of residence at all: every one of them would land in the "nobody has
    // been asked" count below and read as unfinished diligence that does not exist. The narrower
    // request keeps that impossible rather than merely filtered, so the two cannot drift.
    queryKey: ['individuals', 'overseas', firm?.id ?? null, branch?.id ?? null, paged.params],
    queryFn: () => listIndividuals({ ...filters, page: paged.page, size: paged.size }),
    placeholderData: keepPreviousData,
  });
  // Only the count is wanted, so one row is enough to read totalElements.
  const unansweredQ = useQuery({
    queryKey: ['individuals', 'unanswered', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listIndividuals({ firmId: firm?.id, branchId: branch?.id, residence: 'UNANSWERED', size: 1 }),
  });

  // The scope's firm, not useFirmCountry(): scope is guaranteed set, and ROOT can be scoped to a
  // reporting entity that is not their own.
  const homeCountry = firm?.country ?? null;

  const rows = q.data?.items ?? [];
  const total = q.data?.totalElements ?? 0;
  const unanswered = unansweredQ.data?.totalElements ?? 0;

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow={[
          `${countText(q.data)} ${total === 1 ? 'person' : 'people'} residing overseas`,
          homeCountry ? `home ${countryName(homeCountry) ?? homeCountry}` : null,
          firm?.name,
          branch?.name,
        ].filter(Boolean).join(' · ')}
        title="Overseas Residents Register"
        actions={(
          <Button
            variant="outlined"
            startIcon={<TableViewIcon />}
            disabled={total === 0}
            onClick={() => exportIndividualsCsv({
              params: filters, total: countText(q.data), prefix: 'overseas-residents', firm, branch, showToast, noun: ['person', 'people'],
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

      {/* Says what the register cannot see, so an empty table is not mistaken for a clean one. */}
      {!unansweredQ.isLoading && unanswered > 0 && (
        <Alert severity="info">
          {countText(unansweredQ.data)} {unanswered === 1 ? 'person has' : 'people have'} no country of residence
          recorded and {unanswered === 1 ? 'is' : 'are'} not counted here. Set it on the owner’s
          Details tab.
        </Alert>
      )}

      {q.isLoading
        ? <SkeletonTable rows={6} columns={5} />
        : (
          <IndividualsTable
            rows={rows}
            loading={q.isLoading}
            emptyMessage={query.trim()
              ? 'Nobody matches that search.'
              : 'Nobody on this branch’s deals is recorded as living outside '
                + `${countryName(homeCountry) ?? 'the reporting entity’s country'}.`}
          />
        )}
      <ListPagination data={q.data} paged={paged} />
    </Stack>
  );
}
