import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Button, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tooltip,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import TableViewIcon from '@mui/icons-material/TableView';
import { listIndividuals } from '../../api/individuals.js';
import { nodeTypeLabel } from '../../api/ownership.js';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { SearchField, matchesSearch } from '../../components/SearchField.jsx';
import { SkeletonTable } from '../../components/SkeletonTable.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { tokens, fonts } from '../../theme/theme.js';
import { formatListDate } from './IndividualsTable.jsx';
import { exportIndividualsCsv } from './BeneficialOwnersPage.jsx';

const csvHeaders = ['Name', 'Type', 'Verified', 'Property', 'Deal'];
const csvRowFor = (r) => [
  r.displayName,
  nodeTypeLabel(r.nodeType),
  r.verifiedAt ?? '',
  r.propertyAddress ?? '',
  r.dealReference,
];

/**
 * Every owner cleared on an exception, across the deals in scope.
 *
 * <p>An exception is a decision to accept an owner despite a gap in the evidence. Recorded on the
 * owner, it is only visible to somebody who already thought to open that owner on that deal —
 * which is no use to the person who has to answer what the branch has accepted and why. This is
 * that list.
 *
 * <p>The filter is client-side, like the overseas register's: the rows are the Beneficial Owners
 * fetch, under the same query key, so the two screens share one cache entry and moving between
 * them costs nothing. The <em>scope</em> is the server's, as always — `listIndividuals` returns
 * only owners behind deals the caller may read, so an agent sees their own deals here and a
 * compliance officer the whole firm.
 *
 * <p>Every owner type, not just people: an exception can be granted on a company or a trust just
 * as easily, and leaving entities out would make the register quietly incomplete.
 */
export function CddExceptionsPage() {
  const { firm, branch } = useDashboardScope();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');

  const q = useQuery({
    // Deliberately the Beneficial Owners key. It is the same request, and giving it a key of its
    // own would fetch the identical rows a second time to show a subset of them.
    queryKey: ['individuals', 'all-types', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listIndividuals({ firmId: firm?.id, branchId: branch?.id, allTypes: true }),
  });

  const all = q.data ?? [];

  const exceptions = useMemo(
    () => all.filter((r) => r.verificationStatus === 'VERIFIED_WITH_EXCEPTION'),
    [all],
  );

  const rows = useMemo(
    () => exceptions.filter((r) => matchesSearch(query, r.displayName, r.propertyAddress, r.dealReference)),
    [exceptions, query],
  );

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow={[
          `${rows.length} ${rows.length === 1 ? 'owner' : 'owners'} cleared by exception`,
          firm?.name,
          branch?.name,
        ].filter(Boolean).join(' · ')}
        title="CDD Exceptions"
        actions={(
          <Button
            variant="outlined"
            startIcon={<TableViewIcon />}
            disabled={rows.length === 0}
            onClick={() => exportIndividualsCsv({
              rows, prefix: 'cdd-exceptions', firm, branch, showToast,
              headers: csvHeaders, rowFor: csvRowFor,
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
        ? <SkeletonTable rows={6} columns={4} />
        : (
          <ExceptionsTable
            rows={rows}
            emptyMessage={query.trim()
              ? 'No exception matches that search.'
              : 'No owner on this branch’s deals has been cleared by exception.'}
          />
        )}
    </Stack>
  );
}

/**
 * The four columns the register answers with.
 *
 * <p>Its own table rather than a wider `IndividualsTable`: that one is shared by the two people
 * registers and is person-shaped — date of birth, country of residence — where this one is about
 * a decision. Bending it into both with a columns prop would make three screens share one
 * component and agree on none of it.
 */
function ExceptionsTable({ rows, emptyMessage }) {
  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Verified</TableCell>
            <TableCell>Property</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.nodeId} hover>
              <TableCell>{r.displayName}</TableCell>
              <TableCell sx={{ color: tokens.muted }}>{nodeTypeLabel(r.nodeType)}</TableCell>
              <TableCell sx={{ fontFamily: fonts.mono, fontSize: '0.8rem' }}>
                {formatListDate(r.verifiedAt)}
              </TableCell>
              <TableCell>
                {/* The address is the way through to the file. The register is where a reviewer
                    notices an exception; the deal is where they can do anything about it. */}
                <Tooltip title={r.propertyAddress ?? ''}>
                  <Box
                    component={RouterLink}
                    to={`/deals/${r.dealId}`}
                    sx={{
                      display: 'block', maxWidth: 420, color: tokens.blue,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {r.propertyAddress ?? r.dealReference}
                  </Box>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} align="center" sx={{ py: 5, color: tokens.muted }}>
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
