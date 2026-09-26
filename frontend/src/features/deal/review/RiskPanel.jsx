import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, CircularProgress, Stack, Tooltip, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { approveDealRisk, getDealRisk, overrideDealRisk } from '../../../api/risk.js';
import { useToast } from '../../../components/ToastProvider.jsx';
import { countryName, flagClass } from '../../../data/countries.js';
import { visualFor } from '../../ownership/nodeTypeVisual.js';
import { tokens, fonts, motion } from '../../../theme/theme.js';
import { RiskOverrideDialog } from './RiskOverrideDialog.jsx';
import { BANDS, bandOf } from './riskBands.js';

/**
 * A tint at some strength of the deal's red, over whatever is behind it.
 *
 * <p>Mixing the *foreground* red into transparent rather than hard-coding pink hexes is what
 * makes one declaration work in both themes: over the white tile it lands on light pinks, over
 * the dark tile on muted dark reds, with no second set of values to keep in step.
 */
const mixRed = (pct) => `color-mix(in srgb, ${tokens.rejected} ${pct}%, transparent)`;

/**
 * How loudly a factor card reads, by what it contributed.
 *
 * <p>The per-attribute points used to be printed on each row. They are gone, so the tint is what
 * is left to say that a nominee director mattered more than a European country of incorporation
 * — without it every card would shout equally and the section would be a flat list again.
 *
 * <p>Three strengths of one red, rather than red/amber/blue as this first shipped. Amber and blue
 * read as different *kinds* of finding; these are lesser versions of the same one, and the ramp
 * says so.
 *
 * <p>Thresholds are the point values the server actually emits: 6 for the headline answers
 * (nominee, unascertainable trust holdings, a top-band country, a short tenure), 3-4 for the
 * middle, 1-2 for the mildest. They are display bands, not the rating bands — those are the
 * deal's total and live in RiskRating.forValue.
 */
const FACTOR_TINTS = [
  { min: 6, bg: mixRed(16),  border: mixRed(42) },
  { min: 3, bg: mixRed(9),   border: mixRed(26) },
  { min: 0, bg: mixRed(4.5), border: mixRed(15) },
];

const tintFor = (points) => FACTOR_TINTS.find((t) => points >= t.min) ?? FACTOR_TINTS[2];

/**
 * Unanswered questions get no fill at all, deliberately.
 *
 * <p>A question nobody has answered has contributed nothing, and a washed card would put it in
 * the same visual family as the findings above — two tinted columns competing for the same
 * attention. The alert is carried by a single red mark on the right instead, which makes the
 * section read as a checklist rather than as a second pile of findings.
 *
 * <p>`tile` is white in light mode and the dark card colour in dark, so this holds in both from
 * one declaration. `hairline2` rather than `hairline`: with no fill, the border is the only thing
 * separating the card from the canvas behind it.
 */
const GAP_TINT = { bg: tokens.tile, border: tokens.hairline2 };

/**
 * Every card is the same height whether or not it has a second line, so a column of them reads
 * as a grid rather than as ragged prose.
 */
const CARD_MIN_HEIGHT = 62;

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
      // No "released" case: every override is an override, including one that picks the band
      // the engine already reached, so dto.source is always OVERRIDE here.
      showToast({ severity: 'warning', message: `Risk set to ${dto.rating} by hand` });
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
    <Stack spacing={2.5} sx={{pb:6}}>
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
              Deal risk
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
                // Clicking the band already in force is a no-op, not an override. Opening the
                // dialog for it would invite a comment and a byline recording a change that
                // did not happen, and withdraw the approval on the way.
                onClick={() => (risk.rating === b.value
                  ? showToast({ severity: 'info', message: `Risk level already set to ${b.value}` })
                  : setOverride(b.value))}
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

        {/* The score and the band thresholds used to be printed here. The number is the
            engine's business, not the reviewer's: the band is the answer, the cards below are
            the reasons, and the CALCULATED marker on the buttons says what was derived. */}

        {/* Coloured by the rating actually in force, not by a fixed warning tone. A box that
            says "Manually overridden to LOW" in amber is contradicting its own sentence.
            Reading risk.rating rather than assuming the pinned one keeps it correct if this is
            ever shown in a state other than OVERRIDE. */}
        {pinned && (() => {
          const band = bandOf(risk.rating);
          return (
            <Box
              sx={{
                mt: 2, p: 1.75, borderRadius: '12px',
                backgroundColor: band.bg,
                border: `1px solid ${band.border}`,
              }}
            >
              <Stack direction="row" spacing={1.25}>
                {/* Not "this is dangerous" — "this rating is not what the rules produced",
                    which is worth flagging whichever band it landed on. */}
                <ReportProblemOutlinedIcon
                  sx={{ fontSize: '1.1rem', color: band.text, mt: '1px' }}
                />
                <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.85rem', color: band.text }}>
                    Manually overridden to <strong>{risk.rating}.</strong>
                  </Typography>

                  {/* Its own line. Run together with the sentence above, a reviewer's words read
                      as part of the system's description of itself rather than as a quotation. */}
                  {risk.overrideComment && (
                    <Typography
                      sx={{
                        fontSize: '0.85rem', color: band.text, fontStyle: 'italic',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      “{risk.overrideComment}”
                    </Typography>
                  )}

                  {/* The byline. Without it the comment is an assertion with nobody behind it.
                      Faded rather than greyed, so it recedes without leaving the band's colour. */}
                  {(risk.overriddenByName || risk.overriddenAt) && (
                    <Typography variant="caption" sx={{ color: band.text, opacity: 0.75 }}>
                      {[risk.overriddenByName, formatStamp(risk.overriddenAt)]
                        .filter(Boolean)
                        .join(' · ')}
                    </Typography>
                  )}
                </Stack>
              </Stack>
            </Box>
          );
        })()}

        {risk.approved && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
            <CheckCircleIcon sx={{ fontSize: '1.05rem', color: tokens.approved }} />
            <Typography variant="caption" sx={{ color: tokens.muted }}>
              Approved{risk.approvedByName ? ` by ${risk.approvedByName}` : ''}
              {risk.approvedAt ? ` on ${new Date(risk.approvedAt).toLocaleDateString()}` : ''}.
              Changing any answer that affects the score withdraws this.
            </Typography>
          </Stack>
        )}
      </Box>

      {/* ── What raised it ──────────────────────────────────────────────── */}
      <Section title="What raised this risk" empty="Nothing on this deal adds to the score.">
        {risk.factors.map((f, i) => (
          <Card
            key={`${f.code}-${f.nodeId ?? 'deal'}-${i}`}
            tint={tintFor(f.points)}
            label={f.label}
            value={valueOf(f)}
            owner={ownerOf(f)}
            onOpen={f.nodeId && onSelectNode ? () => onSelectNode(f.nodeId) : undefined}
          />
        ))}
      </Section>

      {/* ── What is still missing ───────────────────────────────────────────
          Absent rather than empty when there is nothing outstanding. A panel saying "nothing to
          do here" is a standing instruction to ignore a section that only ever matters when it
          has content in it. */}
      {risk.unanswered.length > 0 && (
        <Section
          title="Still to answer"
          subtitle="The risk level cannot be approved until these are answered."
          // A wide gap on purpose: this is a checklist of work outstanding, not a continuation
          // of the findings above it, and at a smaller value the two columns of cards read as
          // one long list.
          //
          // `&&` rather than a plain `mt`, and it is load-bearing. The parent Stack sets its
          // spacing from above — `& > :not(style) ~ :not(style) { margin-top: … }` — and that
          // selector outranks this element's own single sx class, so a plain `mt` here is
          // silently overridden by the Stack's 2.5. Doubling the ampersand emits the class
          // twice and wins the specificity contest.
          sx={{ '&&': { mt: 6 } }}
        >
          {risk.unanswered.map((g, i) => (
            <Card
              key={`${g.code}-${g.nodeId ?? 'deal'}-${i}`}
              tint={GAP_TINT}
              label={g.label}
              owner={ownerOf(g)}
              icon={<ErrorIcon sx={{ fontSize: '1.15rem', color: tokens.rejected }} />}
              onOpen={g.nodeId && onSelectNode ? () => onSelectNode(g.nodeId) : undefined}
            />
          ))}
        </Section>
      )}

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
        // All three carry their colour all the time, so High reads as red and Low as green
        // without having to be selected first. The current one is the one with a border, a
        // full-strength wash and bold text.
        //
        // The unselected border is transparent rather than absent: removing it outright would
        // shrink the box by 2px and make the row jump every time the selection moves.
        border: `1px solid ${selected ? band.fg : 'transparent'}`,
        backgroundColor: selected
          ? band.bg
          : `color-mix(in srgb, ${band.bg} 50%, transparent)`,
        color: band.fg,
        fontSize: '0.82rem',
        fontWeight: selected ? 700 : 400,
        // Kept now that every button is coloured: without it a read-only viewer would be looking
        // at three live-seeming buttons, none of which they may press.
        opacity: disabled && !selected ? 0.65 : 1,
        transition: `background-color ${motion.swift} ease, border-color ${motion.swift} ease`,
        '&:hover': disabled ? {} : { backgroundColor: band.bg },
        '&:focus-visible': { outline: `2px solid ${tokens.blue}`, outlineOffset: 2 },
      })}
    >
      <Box
        component="span"
        sx={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          backgroundColor: band.fg,
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

/**
 * A heading over a stack of cards.
 *
 * <p>No container border or dividers: each card carries its own tinted border now, and a box
 * drawn around them would be a second frame fighting the first.
 */
function Section({ title, subtitle, empty, children, sx }) {
  const cards = Array.isArray(children) ? children : [children];
  const isEmpty = cards.filter(Boolean).length === 0;

  return (
    <Box sx={sx}>
      <Typography sx={{ fontFamily: fonts.display, fontSize: '0.95rem', color: tokens.ink }}>
        {title}
      </Typography>
      {subtitle && !isEmpty && (
        <Typography variant="caption" sx={{ color: tokens.muted, display: 'block', mt: 0.25 }}>
          {subtitle}
        </Typography>
      )}
      {isEmpty ? (
        <Typography
          sx={{
            mt: 1, p: 2, fontSize: '0.85rem', color: tokens.muted,
            border: `1px solid ${tokens.hairline}`, borderRadius: '14px',
            backgroundColor: tokens.tileRaised,
          }}
        >
          {empty}
        </Typography>
      ) : (
        <Stack spacing={1} sx={{ mt: 1 }}>{children}</Stack>
      )}
    </Box>
  );
}

/**
 * One attribute, as a tinted card.
 *
 * <p>Two lines, always the same height. The first is the question and the answer given to it;
 * the second is the owner it came from and nothing else, so a column of cards can be scanned
 * down either the answers or the owners without the two interleaving.
 *
 * <p>A deal's own answers have no owner, so their second line stays reserved but empty rather
 * than being filled with a placeholder — that is what keeps every card the same height without
 * inventing a label nobody asked for.
 */
function Card({ tint, label, value, owner, icon, onOpen }) {
  return (
    <Box
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onOpen) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); }
      }}
      sx={motion.respectful({
        // A row, so the icon centres itself against a two-line card. The text keeps its own
        // column inside, which is what preserves the reserved second line and the fixed height.
        display: 'flex', alignItems: 'center', gap: 1.5,
        minHeight: CARD_MIN_HEIGHT,
        px: 1.75, py: 1.25,
        borderRadius: '12px',
        backgroundColor: tint.bg,
        border: `1px solid ${tint.border}`,
        cursor: onOpen ? 'pointer' : 'default',
        transition: `filter ${motion.swift} ease`,
        '&:hover': onOpen ? { filter: 'brightness(0.97)' } : {},
        '&:focus-visible': { outline: `2px solid ${tokens.blue}`, outlineOffset: 2 },
      })}
    >
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography
          component="div"
          sx={{
            fontSize: '0.875rem', color: tokens.ink,
            display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap',
          }}
        >
          {/* The question, then the answer weighted up — the answer is what the eye is
              looking for, and the label is only there to say what it answers. */}
          <Box component="span">{label}{value ? ':' : null}</Box>
          {value && <Box component="span" sx={{ fontWeight: 700 }}>{value}</Box>}
        </Typography>
        <Typography
          variant="caption"
          component="div"
          sx={{
            color: tokens.muted, display: 'flex', alignItems: 'center', gap: 0.6,
            minHeight: '1.25em',   // reserved even when empty, which is what keeps heights equal
          }}
        >
          {owner}
        </Typography>
      </Box>
      {icon && <Box sx={{ display: 'flex', flexShrink: 0 }}>{icon}</Box>}
    </Box>
  );
}

/**
 * The answer a factor records, for the first line.
 *
 * <p>A country arrives as an ISO code and is rendered as a flag and its full name — "IN" is not
 * something a reviewer should have to translate, and the same helpers back the country picker
 * everywhere else in the app. Every other answer is already a word the server chose.
 */
function valueOf(factor) {
  if (factor.countryCode) {
    return (
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        <Box component="span" className={flagClass(factor.countryCode)}
             sx={{ fontSize: '1rem', borderRadius: '2px' }} />
        {countryName(factor.countryCode)}
      </Box>
    );
  }
  return factor.value ?? null;
}

/**
 * The owner an entry came from, for the second line: its type's glyph, then its name.
 *
 * <p>The glyph and its colour come from `nodeTypeVisual.js`, the same table the ownership tree
 * and the Add owner picker read — so a trust is the same mark here as it is on the Structure
 * tab, which is the point of looking it up rather than keeping a second list.
 *
 * <p>Null for the deal's own answers, which have no owner behind them.
 */
function ownerOf(entry) {
  if (!entry.nodeName) return null;
  const { Icon, hue } = visualFor(entry.nodeType);

  return (
    <>
      <Icon sx={{ fontSize: '0.95rem', color: hue, flexShrink: 0 }} />
      <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap' }}>
        {entry.nodeName}
      </Box>
    </>
  );
}

/** "26 Sep 2026, 12:04" — the local rendering of an override timestamp. */
function formatStamp(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
