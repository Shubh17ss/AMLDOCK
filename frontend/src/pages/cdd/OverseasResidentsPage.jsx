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
 * The owners on this branch's deals who sit outside the reporting entity's country: people who
 * live elsewhere, and companies, trusts and other entities incorporated or registered elsewhere.
 *
 * <p>The overseas test runs on the server (`residence=OVERSEAS`): the deciding country recorded and
 * different from the deal's reporting-entity country — residence for a person, jurisdiction for an
 * entity (V71). It used to run here over the whole register, which a paged list cannot do.
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
  // Every kind of owner: an entity registered abroad is as much an overseas owner as a person living
  // abroad. Shared with the CSV, so the file holds what the screen does.
  const filters = {
    firmId: firm?.id, branchId: branch?.id, allTypes: true, residence: 'OVERSEAS', q: paged.params.q,
  };

  const q = useQuery({
    // Every owner type here; the "nobody has been asked" count below stays on natural persons.
    queryKey: ['individuals', 'overseas', firm?.id ?? null, branch?.id ?? null, paged.params],
    queryFn: () => listIndividuals({ ...filters, page: paged.page, size: paged.size }),
    placeholderData: keepPreviousData,
  });
  // Only the count is wanted, so one row is enough to read totalElements. People only, as before:
  // the residence question is asked of a person, and counting every entity with no jurisdiction
  // typed in would change what this number has always meant.
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
          `${countText(q.data)} ${total === 1 ? 'owner' : 'owners'} overseas`,
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
              params: filters, total: countText(q.data), prefix: 'overseas-residents', firm, branch, showToast, noun: ['owner', 'owners'],
            })}
          >
            Download CSV
          </Button>
        )}
      />

      <SearchField value={query} onChange={paged.setSearch} placeholder="Search owner name…" />

      {q.isError && (
        <Alert severity="error">Failed to load the register. Refresh to try again.</Alert>
      )}

      {/* Says what the register cannot see, so an empty table is not mistaken for a clean one.
      {!unansweredQ.isLoading && unanswered > 0 && (
        <Alert severity="info">
          {countText(unansweredQ.data)} {unanswered === 1 ? 'person has' : 'people have'} no country of residence
          recorded and {unanswered === 1 ? 'is' : 'are'} not counted here. Set it on the owner’s
          Details tab.
        </Alert>
      )} */}

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
