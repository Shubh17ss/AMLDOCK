import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Button, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { listDealVersions } from '../api/dealVersions.js';
import { SkeletonTable } from '../components/SkeletonTable.jsx';
import { VersionChip } from '../features/deal/assurance/AssuranceDialog.jsx';
import { tokens, fonts } from '../theme/theme.js';
import { formatDateTimeNumeric } from '../utils/formatters.js';

/**
 * CDD Versions: every signed-off version of one deal, newest first.
 *
 * <p>Each row opens that version on the deal page (?version=N), which already renders a snapshot
 * read-only. The deal's address sits in the app bar above, as on the deal page itself.
 */
export function DealVersionsPage() {
  const { id } = useParams();
  const dealId = id;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const dealPath = pathname.replace(/\/versions\/?$/, '');

  const q = useQuery({
    queryKey: ['dealVersions', dealId],
    queryFn: () => listDealVersions(dealId),
    enabled: Boolean(dealId),
  });
  const versions = q.data ?? [];

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(dealPath)} size="small">
          Deal details
        </Button>
      </Stack>

      <Box>
        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: tokens.ink }}>
          CDD Versions
        </Typography>
        <Typography variant="body2" sx={{ color: tokens.muted, mt: 0.5 }}>
          Each time this deal was verified, its file was frozen as a version. Open one to see it as
          it was signed off.
        </Typography>
      </Box>

      {q.isError && <Alert severity="error">Failed to load versions.</Alert>}

      {q.isLoading ? (
        <SkeletonTable rows={4} />
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Version</TableCell>
                <TableCell>Verified by</TableCell>
                <TableCell>Verified at</TableCell>
                <TableCell>Note</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {versions.map((v) => (
                <TableRow
                  key={v.versionNo}
                  hover
                  onClick={() => navigate(`${dealPath}?version=${v.versionNo}`)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell><VersionChip no={v.versionNo} /></TableCell>
                  <TableCell sx={{ fontSize: '0.85rem' }}>
                    {v.verifiedByName ?? v.verifiedByEmail ?? '—'}
                  </TableCell>
                  <TableCell sx={{ fontFamily: fonts.mono, fontSize: '0.8rem' }}>
                    {formatDateTimeNumeric(v.verifiedAt) ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Tooltip title={v.verifyNote ?? ''}>
                      <Box
                        sx={{
                          maxWidth: 320, fontSize: '0.85rem',
                          color: v.verifyNote ? tokens.ink : tokens.muted,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                      >
                        {v.verifyNote || '—'}
                      </Box>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {versions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 5, color: tokens.muted }}>
                    This deal has not been verified yet, so it has no versions.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
