import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Stack, Tooltip, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { approveDealRisk, getDealRisk, overrideDealRisk } from '../../../api/risk.js';
import { useToast } from '../../../components/ToastProvider.jsx';
import { tokens, fonts, motion } from '../../../theme/theme.js';
import { RiskOverrideDialog } from './RiskOverrideDialog.jsx';

/**
 * The three bands, in the order a reviewer reads them off the control: worst first, matching
 * the mockup. Colours are the ones RiskRatingChip uses, so the tab and the header chip cannot
 * disagree about what "high" looks like.
 */
const BANDS = [
  { value: 'HIGH', label: 'High', fg: tokens.rejected, bg: 'var(--cl-err-wash)' },
  { value: 'MEDIUM', label: 'Medium', fg: tokens.review, bg: 'var(--cl-warn-wash)' },
  { value: 'LOW', label: 'Low', fg: tokens.approved, bg: 'var(--cl-ok-wash)' },
];

/**
 * The deal's risk position, and the workings behind it.
 *
 * <p>Three things live here, in the order they are needed: what the rating is and what may be
 * done about it, what pushed it there, and what has not been answered yet. The last of those is
 * not a nicety — approval is refused while anything on it remains, so a reviewer who cannot see
 * the list cannot act on it.
 *
 * <p>Everything is read from the server. The score, the bands and the country scale live in
 * {@code DealRiskService} and {@code CountryRisk}; recomputing any of it here would be a second
 * implementation free to disagree with the number printed beside it.
 *
 * @param canDecide whether this viewer may approve or override — a firm reviewer, on the live
 *                  deal. Everyone else reads the same workings without the controls.
 * @param onSelectNode opens the owner a factor or gap belongs to, so a gap is one click from
 *                     the field that fills it.
 */
export function RiskPanel({ dealId, canDecide = false, onSelectNode }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [override, setOverride] = useState(null);   // the band being set, or null

  const riskQ = useQuery({
    queryKey: ['deals', dealId, 'risk'],
    queryFn: () => getDealRisk(dealId),
    enabled: Boolean(dealId),
  });

  // Both writes move the deal's own riskRating/riskApproved, which the header chip and every
  // deal list read, so the deal goes stale alongside the assessment.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['deals'] });
    qc.invalidateQueries({ queryKey: ['audit', 'deal', dealId] });
  };

  const approveMut = useMutation({
    mutationFn: () => approveDealRisk(dealId),
    onSuccess: (dto) => {
      qc.setQueryData(['deals', dealId, 'risk'], dto);
      invalidate();
      showToast({ severity: 'success', message: 'Risk level approved' });
    },
    onError: (e) => showToast({
      severity: 'error',
      message: e.response?.data?.message || 'Could not approve the risk level',
    }),
  });

  const overrideMut = useMutation({
    mutationFn: ({ rating, comment }) => overrideDealRisk(dealId, rating, comment),
    onSuccess: (dto) => {
      qc.setQueryData(['deals', dealId, 'risk'], dto);
      invalidate();
      setOverride(null);
      showToast({
        severity: 'warning',
        message: dto.source === 'OVERRIDE'
          ? `Risk set to ${dto.rating} by hand`
          : 'Risk override released',
      });
    },
    // Left to the dialog, which shows it inline beside the comment box rather than in a toast
    // that disappears while the reviewer is still reading the form.
  });

  if (riskQ.isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }
  if (riskQ.isError) {
    return <Alert severity="error">Failed to load the risk assessment.</Alert>;
  }

  const risk = riskQ.data;
  const pinned = risk.source === 'OVERRIDE';
  const working = approveMut.isPending || overrideMut.isPending;

  return (
    <Stack spacing={2.5}>
      {/* ── The rating, and what may be done about it ───────────────────── */}
      <Box
        sx={{
          border: `1px solid ${tokens.hairline}`,
          borderRadius: '16px',
          backgroundColor: tokens.tile,
          p: 2.5,
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', md: 'center' }}
        >
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography sx={{ fontFamily: fonts.display, fontSize: '1.05rem', color: tokens.ink }}>
              Client risk
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: tokens.muted }}>
              {canDecide
                ? 'Set the risk level for this deal'
                : 'The risk level for this deal, and how it was reached'}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            {BANDS.map((b) => (
              <BandButton
                key={b.value}
                band={b}
                selected={risk.rating === b.value}
                calculated={risk.calculatedRating === b.value}
                disabled={!canDecide || working}
                onClick={() => setOverride(b.value)}
              />
            ))}

            {canDecide && (
              <Tooltip
                title={risk.complete
                  ? ''
                  : 'Answer every question below that affects the risk first'}
              >
                {/* A disabled button swallows pointer events, so the tooltip needs a live
                    wrapper to hang off — otherwise the reason never appears. */}
                <Box component="span">
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<TaskAltIcon />}
                    disabled={!risk.complete || risk.approved || working}
                    onClick={() => approveMut.mutate()}
                  >
                    {risk.approved ? 'Risk approved' : 'Approve risk level'}
                  </Button>
                </Box>
              </Tooltip>
            )}
          </Stack>
        </Stack>

        {/* The score, spelled out. A band on its own is not something anyone can check. */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            label={`Score ${risk.riskValue}`}
            sx={{
              fontFamily: fonts.mono, fontSize: '0.68rem', letterSpacing: '0.04em',
              color: tokens.ink, backgroundColor: tokens.hover,
            }}
          />
          <Typography variant="caption" sx={{ color: tokens.muted }}>
            Low 0–2 · Medium 3–5 · High 6+
          </Typography>
        </Stack>

        {pinned && (
          <Alert severity="warning" sx={{ mt: 2, py: 0.5 }}>
            Set by hand to <strong>{risk.rating}</strong>, against a calculated{' '}
            <strong>{risk.calculatedRating}</strong>.
            {risk.overrideComment ? ` “${risk.overrideComment}”` : null}
            {canDecide && ` Choosing ${risk.calculatedRating} releases it.`}
          </Alert>
        )}

        {risk.approved && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
            <CheckCircleIcon sx={{ fontSize: '1.05rem', color: tokens.approved }} />
            <Typography variant="caption" sx={{ color: tokens.muted }}>
              Approved{risk.approvedByEmail ? ` by ${risk.approvedByEmail}` : ''}
              {risk.approvedAt ? ` on ${new Date(risk.approvedAt).toLocaleDateString()}` : ''}.
              Changing any answer that affects the score withdraws this.
            </Typography>
          </Stack>
        )}
      </Box>

      {/* ── What raised it ──────────────────────────────────────────────── */}
      <Section
        title="What raised this risk"
        empty="Nothing on this deal adds to the score."
        rows={risk.factors}
        renderRow={(f, i) => (
          <Row
            key={`${f.code}-${f.nodeId ?? 'deal'}-${i}`}
            label={f.label}
            owner={f.nodeName}
            onOpen={f.nodeId && onSelectNode ? () => onSelectNode(f.nodeId) : undefined}
            trailing={(
              <Typography
                sx={{
                  fontFamily: fonts.mono, fontSize: '0.78rem', fontWeight: 700,
                  color: tokens.rejected,
                }}
              >
                +{f.points}
              </Typography>
            )}
          />
        )}
      />

      {/* ── What is still missing ───────────────────────────────────────── */}
      <Section
        title="Still to answer"
        empty="Every question that affects the risk has been answered."
        rows={risk.unanswered}
        subtitle="The risk level cannot be approved until these are answered."
        renderRow={(g, i) => (
          <Row
            key={`${g.code}-${g.nodeId ?? 'deal'}-${i}`}
            label={g.label}
            owner={g.nodeName}
            onOpen={g.nodeId && onSelectNode ? () => onSelectNode(g.nodeId) : undefined}
          />
        )}
      />

      <RiskOverrideDialog
        open={override != null}
        calculatedRating={risk.calculatedRating}
        currentRating={risk.rating}
        targetRating={override}
        onClose={() => setOverride(null)}
        onSubmit={(rating, comment) => overrideMut.mutateAsync({ rating, comment })}
        submitting={overrideMut.isPending}
      />
    </Stack>
  );
}

/** One band in the segmented control, with a marker on the one the score produced. */
function BandButton({ band, selected, calculated, disabled, onClick }) {
  return (
    <Box
      role="radio"
      aria-checked={selected}
      aria-label={`${band.label} risk${calculated ? ', calculated' : ''}`}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      }}
      sx={motion.respectful({
        display: 'inline-flex', alignItems: 'center', gap: 0.75,
        px: 1.75, py: 0.75, borderRadius: '10px',
        cursor: disabled ? 'default' : 'pointer',
        userSelect: 'none',
        border: `1px solid ${selected ? band.fg : tokens.hairline}`,
        backgroundColor: selected ? band.bg : 'transparent',
        color: selected ? band.fg : tokens.muted,
        fontSize: '0.82rem',
        fontWeight: selected ? 700 : 500,
        opacity: disabled && !selected ? 0.65 : 1,
        transition: `background-color ${motion.swift} ease, border-color ${motion.swift} ease`,
        '&:hover': disabled ? {} : { backgroundColor: selected ? band.bg : tokens.hover },
        '&:focus-visible': { outline: `2px solid ${tokens.blue}`, outlineOffset: 2 },
      })}
    >
      <Box
        component="span"
        sx={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          backgroundColor: selected ? band.fg : tokens.hairline2,
        }}
      />
      {band.label}
      {calculated && (
        <Typography
          component="span"
          sx={{
            fontFamily: fonts.mono, fontSize: '0.58rem', letterSpacing: '0.06em',
            color: tokens.muted,
          }}
        >
          CALCULATED
        </Typography>
      )}
    </Box>
  );
}

function Section({ title, subtitle, rows, empty, renderRow }) {
  return (
    <Box>
      <Typography sx={{ fontFamily: fonts.display, fontSize: '0.95rem', color: tokens.ink }}>
        {title}
      </Typography>
      {subtitle && rows.length > 0 && (
        <Typography variant="caption" sx={{ color: tokens.muted, display: 'block', mt: 0.25 }}>
          {subtitle}
        </Typography>
      )}
      <Box
        sx={{
          mt: 1,
          border: `1px solid ${tokens.hairline}`,
          borderRadius: '14px',
          backgroundColor: tokens.tileRaised,
          overflow: 'hidden',
        }}
      >
        {rows.length === 0 ? (
          <Typography sx={{ p: 2, fontSize: '0.85rem', color: tokens.muted }}>{empty}</Typography>
        ) : (
          rows.map((r, i) => (
            <Box key={i}>
              {i > 0 && <Divider sx={{ borderColor: tokens.hairline }} />}
              {renderRow(r, i)}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}

function Row({ label, owner, trailing, onOpen }) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      onClick={onOpen}
      sx={motion.respectful({
        px: 2, py: 1.25,
        cursor: onOpen ? 'pointer' : 'default',
        transition: `background-color ${motion.swift} ease`,
        '&:hover': onOpen ? { backgroundColor: tokens.hover } : {},
      })}
    >
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.875rem', color: tokens.ink }}>{label}</Typography>
        {owner && (
          <Typography variant="caption" sx={{ color: tokens.muted }}>{owner}</Typography>
        )}
      </Box>
      {trailing}
    </Stack>
  );
}
