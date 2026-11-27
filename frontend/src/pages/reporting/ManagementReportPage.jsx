import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Box, Button, CircularProgress, LinearProgress, Stack, Typography } from '@mui/material';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { useCurrency } from '../../dashboard/useCurrency.js';
import { useToast } from '../../components/ToastProvider.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { tokens } from '../../theme/theme.js';
import { formatDateTime } from '../../utils/formatters.js';
import {
  getReportOverview, getReportOwners, getReportPropertyTypes, getReportTraining,
} from '../../api/reports.js';
import {
  DEFAULT_PRESET, browserTimeZone, describeWindow, describeWindowSentence, describeWindowShort, resolveWindow,
} from './management/reportWindow.js';
import {
  ASSURANCE_KEYS, RISK_KEYS, assuranceLabel, reportColours, riskLabel,
} from './management/reportPalette.js';
import { ALL_BRANCHES, ReportToolbar } from './management/ReportToolbar.jsx';
import { ReportFigures } from './management/ReportFigures.jsx';
import { ReportSection } from './management/ReportSection.jsx';
import { StatusBarChart } from './management/StatusBarChart.jsx';
import { BreakdownDonut } from './management/BreakdownDonut.jsx';
import { PropertyTypeTable } from './management/PropertyTypeTable.jsx';
import { OwnerTypeTable } from './management/OwnerTypeTable.jsx';
import { TrainingSection } from './management/TrainingSection.jsx';

const FIVE_MINUTES = 5 * 60 * 1000;

const slug = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Reporting › Management Reports: the firm's deals, owners and training over a window of days,
 * for the whole firm or one branch, with a PDF of exactly what is on screen.
 *
 * Four sections, four requests, fired together: each draws as soon as its own answer arrives, so
 * the top of the report is readable while the tables further down are still being counted.
 * Answers are kept for five minutes, so moving between windows and back, or downloading, does not
 * ask again.
 */
export function ManagementReportPage() {
  const { user } = useAuth();
  const { firm, branchOptions } = useDashboardScope();
  const money = useCurrency();
  const { showToast } = useToast();
  const colours = useMemo(() => reportColours(), []);
  const tz = useMemo(browserTimeZone, []);

  const [preset, setPreset] = useState(DEFAULT_PRESET);
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [branchId, setBranchId] = useState(ALL_BRANCHES);
  const [exporting, setExporting] = useState(false);

  // Another entity has other branches: start again from the whole firm.
  useEffect(() => { setBranchId(ALL_BRANCHES); }, [firm?.id]);

  const win = useMemo(() => resolveWindow(preset, custom), [preset, custom]);
  const branch = branchId === ALL_BRANCHES
    ? null
    : (branchOptions.find((b) => String(b.id) === branchId) ?? null);
  const params = win && firm?.id
    ? { firmId: firm.id, branchId: branch?.id, from: win.from, to: win.to, tz }
    : null;

  const section = (key, fetcher) => ({
    queryKey: ['report', key, params],
    queryFn: () => fetcher(params),
    enabled: Boolean(params),
    staleTime: FIVE_MINUTES,
    placeholderData: keepPreviousData,
  });
  const overviewQ = useQuery(section('overview', getReportOverview));
  const propertyQ = useQuery(section('property-types', getReportPropertyTypes));
  const ownersQ = useQuery(section('owners', getReportOwners));
  const trainingQ = useQuery(section('training', getReportTraining));
  const queries = [overviewQ, propertyQ, ownersQ, trainingQ];

  const generating = queries.some((q) => q.isFetching);
  const complete = queries.every((q) => q.data && !q.isPlaceholderData);
  const branchName = branch ? branch.name : 'All branches';
  const windowLong = describeWindow(win);
  const windowShort = describeWindowShort(win);

  async function downloadPdf() {
    setExporting(true);
    try {
      const { exportReportPdf } = await import('./management/exportReportPdf.jsx');
      const fileName = ['management-report', slug(firm?.name), branch && slug(branch.name),
        win.from ?? 'all-time', win.to].filter(Boolean).join('-') + '.pdf';
      await exportReportPdf({
        meta: {
          firmName: firm?.name ?? '',
          branchName,
          windowSentence: describeWindowSentence(win),
          windowShort,
          country: firm?.country,
          generatedBy: user?.fullName ?? user?.email ?? '',
          generatedAt: formatDateTime(new Date().toISOString()),
        },
        overview: overviewQ.data,
        propertyTypes: propertyQ.data,
        owners: ownersQ.data,
        training: trainingQ.data,
        // Resolved again at export, in case the theme has changed since the page drew.
        colours: reportColours(),
      }, fileName);
      showToast({ severity: 'success', message: 'Report downloaded' });
    } catch (err) {
      // The toast cannot say why; the console can, for whoever is asked to look into it.
      console.error('Management report PDF failed', err);
      showToast({ severity: 'error', message: 'The PDF could not be created. Refresh the page and download again.' });
    } finally {
      setExporting(false);
    }
  }

  return (
    <Stack spacing={2.5}>
      <PageHeader
        title="Management report"
        subtitle={win ? `${firm?.name ?? ''}, ${branch ? branch.name : 'all branches'}. ${windowLong}.` : (firm?.name ?? '')}
        actions={(
          <Button
            variant="contained"
            onClick={downloadPdf}
            disabled={!complete || generating || exporting}
            startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <FileDownloadOutlinedIcon />}
          >
            {exporting ? 'Preparing PDF…' : 'Download PDF'}
          </Button>
        )}
      />

      <ReportToolbar
        preset={preset}
        onPreset={setPreset}
        custom={custom}
        onCustom={setCustom}
        branchId={branchId}
        onBranch={setBranchId}
        branches={branchOptions}
        status={generating && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <LinearProgress sx={{ width: 96, height: 3, borderRadius: 2 }} />
            <Typography variant="caption" sx={{ color: tokens.muted, whiteSpace: 'nowrap' }}>Generating report…</Typography>
          </Box>
        )}
      />

      {/* With an unfinished custom range, the last report stays up, faded, until there is a new one. */}
      <Stack spacing={2.5} sx={{ opacity: params ? 1 : 0.45, transition: 'opacity 180ms ease' }}>
        <ReportFigures query={overviewQ} colours={colours} windowText={windowLong} />

        <Box sx={{
          display: 'grid', gap: 2.5,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: '1.5fr 1fr 1fr' },
        }}>
          <ReportSection
            id="report-status" index={1} query={overviewQ}
            title="Deals created, by status"
            description="Where each deal created in the window stands now."
            sx={{ gridColumn: { md: '1 / -1', lg: 'auto' } }}
          >
            {(o) => <StatusBarChart overview={o} colours={colours} />}
          </ReportSection>
          <ReportSection
            id="report-risk" index={2} query={overviewQ}
            title="Risk rating"
            description="The current rating of each deal created in the window."
          >
            {(o) => (
              <BreakdownDonut
                ariaTitle="Deals created by risk rating"
                unit={['deal', 'deals']}
                track={colours.track}
                slices={RISK_KEYS.map((k) => ({
                  key: k, label: riskLabel(k), value: o.byRisk?.[k] ?? 0, colour: colours.risk[k],
                }))}
              />
            )}
          </ReportSection>
          <ReportSection
            id="report-assurance" index={3} query={overviewQ}
            title="Assurance"
            description="Deals from the window that have been signed off, by compliance's second look."
          >
            {(o) => (
              <BreakdownDonut
                ariaTitle="Signed-off deals by assurance"
                unit={['signed-off deal', 'signed-off deals']}
                track={colours.track}
                slices={ASSURANCE_KEYS.map((k) => ({
                  key: k, label: assuranceLabel(k), value: o.byAssurance?.[k] ?? 0, colour: colours.assurance[k],
                }))}
              />
            )}
          </ReportSection>
        </Box>

        <ReportSection
          id="report-property-types" index={4} query={propertyQ}
          title="Deals by property type"
          description="Activity in the window beside where the whole book stands, with what closed deals sold for."
        >
          {(d) => <PropertyTypeTable data={d} money={money} windowShort={windowShort} />}
        </ReportSection>

        <ReportSection
          id="report-owners" index={5} query={ownersQ}
          title="Owners by type"
          description="The owners recorded on deals created in the window."
        >
          {(d) => <OwnerTypeTable data={d} />}
        </ReportSection>

        <ReportSection
          id="report-training" index={6} query={trainingQ}
          title="Staff training"
          description={branch
            ? `Courses and sessions run for ${branch.name}.`
            : 'Courses and sessions across the firm, its branches included.'}
        >
          {(d) => <TrainingSection data={d} />}
        </ReportSection>
      </Stack>
    </Stack>
  );
}
