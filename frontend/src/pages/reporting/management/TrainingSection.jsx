import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { fonts, tokens } from '../../../theme/theme.js';
import { roleLabel } from '../../../auth/roles.js';
import { formatDate } from '../../../utils/formatters.js';
import { ledgerSx, Footnote } from './ReportSection.jsx';
import { hours } from './reportPalette.js';

/**
 * Staff training: four figures, then one row per person. Courses are shown as they stand today,
 * since an overdue course is overdue whatever window is chosen; sessions count only those dated
 * inside the window.
 */
export function TrainingSection({ data }) {
  const { summary, people } = data;
  if (people.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: tokens.muted, py: 3 }}>
        No training has been assigned here yet. Courses and sessions are set up in AML Training › Staff Training.
      </Typography>
    );
  }
  const n = (v) => v.toLocaleString('en-NZ');
  const figures = [
    { label: 'People with training', value: n(summary.people) },
    { label: 'Courses passed', value: `${n(summary.coursesPassed)} of ${n(summary.coursesAssigned)}` },
    { label: 'Overdue courses', value: n(summary.coursesOverdue), alert: summary.coursesOverdue > 0 },
    { label: 'Training hours in window', value: hours(summary.minutesAttended) },
  ];

  return (
    <>
      <Box sx={{
        display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
        gap: { xs: 2, md: 3 }, mb: 3,
      }}>
        {figures.map((f) => (
          <Box key={f.label} sx={{ borderTop: `2px solid ${f.alert ? tokens.rejected : tokens.ink}`, pt: 1.25 }}>
            <Typography sx={{
              fontFamily: fonts.display, fontWeight: 500, fontSize: '1.6rem', letterSpacing: '-0.03em',
              lineHeight: 1.15, color: f.alert ? tokens.rejected : tokens.ink, fontVariantNumeric: 'tabular-nums',
            }}>
              {f.value}
            </Typography>
            <Typography variant="caption" sx={{ color: tokens.muted }}>{f.label}</Typography>
          </Box>
        ))}
      </Box>

      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={ledgerSx} aria-label="Training by person">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Branch</TableCell>
              <TableCell align="right">Courses passed</TableCell>
              <TableCell align="right">Overdue</TableCell>
              <TableCell align="right">Sessions attended</TableCell>
              <TableCell align="right">Hours</TableCell>
              <TableCell align="right">Last completed</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {people.map((p) => (
              <TableRow key={p.userId}>
                <TableCell component="th" scope="row">{p.fullName}</TableCell>
                <TableCell sx={{ color: `${tokens.muted} !important` }}>{roleLabel(p.role)}</TableCell>
                <TableCell sx={{ color: `${tokens.muted} !important` }}>{p.branchName ?? 'Firm-level'}</TableCell>
                <TableCell align="right">{p.coursesAssigned ? `${n(p.coursesPassed)} of ${n(p.coursesAssigned)}` : '—'}</TableCell>
                <TableCell align="right" sx={p.coursesOverdue ? { color: `${tokens.rejected} !important`, fontWeight: 600 } : undefined}>
                  {n(p.coursesOverdue)}
                </TableCell>
                <TableCell align="right">{p.sessionsAssigned ? `${n(p.sessionsAttended)} of ${n(p.sessionsAssigned)}` : '—'}</TableCell>
                <TableCell align="right">{hours(p.minutesAttended)}</TableCell>
                <TableCell align="right">{p.lastCompletedAt ? formatDate(p.lastCompletedAt) : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Footnote>
        Courses count as passed once the person meets the pass mark, and as overdue once their due
        date has gone by without a pass. Sessions, attendance and hours count sessions held in the
        window. Last completed is the person's latest pass or attendance at any time.
      </Footnote>
    </>
  );
}
