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
import { IndividualsTable } from './IndividualsTable.jsx';
import { exportIndividualsCsv } from './BeneficialOwnersPage.jsx';

/**
 * The people on this branch's deals who live somewhere other than the reporting entity does.
 *
 * <p>Same read as the Beneficial Owners register, narrowed here rather than server-side: it is one
 * comparison against a country the client already holds, and two endpoints returning the same rows
 * would be two things to keep in step.
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
  const [query, setQuery] = useState('');

  const q = useQuery({
    // The same key as the Beneficial Owners register, so the two share one fetch and one cache.
    queryKey: ['individuals', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listIndividuals({ firmId: firm?.id, branchId: branch?.id }),
  });

  const all = q.data ?? [];

  // The scope's firm, not useFirmCountry(): scope is guaranteed set, and ROOT can be scoped to a
  // reporting entity that is not their own.
  const homeCountry = firm?.country ?? null;

  const overseas = useMemo(
    () => all.filter((r) => r.countryOfResidence && r.countryOfResidence !== homeCountry),
    [all, homeCountry],
  );
  const unanswered = all.length - all.filter((r) => r.countryOfResidence).length;

  const rows = useMemo(
    () => overseas.filter((r) => matchesSearch(query, r.displayName, r.propertyAddress, r.dealReference)),
    [overseas, query],
  );

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow={[
          `${rows.length} ${rows.length === 1 ? 'person' : 'people'} residing overseas`,
          homeCountry ? `home ${countryName(homeCountry) ?? homeCountry}` : null,
          firm?.name,
          branch?.name,
        ].filter(Boolean).join(' · ')}
        title="Overseas Residents Register"
        actions={(
          <Button
            variant="outlined"
            startIcon={<TableViewIcon />}
            disabled={rows.length === 0}
            onClick={() => exportIndividualsCsv({
              rows, prefix: 'overseas-residents', firm, branch, showToast,
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

      {/* Says what the register cannot see, so an empty table is not mistaken for a clean one. */}
      {!q.isLoading && unanswered > 0 && (
        <Alert severity="info">
          {unanswered} {unanswered === 1 ? 'person has' : 'people have'} no country of residence
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
    </Stack>
  );
}
