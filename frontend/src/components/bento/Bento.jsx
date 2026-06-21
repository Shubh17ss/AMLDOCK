import { Box, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { tokens, fonts } from '../../theme/theme.js';
import { BentoTile, Eyebrow } from './BentoTile.jsx';

export { BentoTile, Eyebrow };

/** Deal-status → tile colour + human label (single source for dashboard tiles). */
export const STATUS_META = {
  DRAFT:        { c: tokens.draft,     label: 'Draft' },
  SUBMITTED:    { c: tokens.submitted, label: 'Submitted' },
  UNDER_REVIEW: { c: tokens.review,    label: 'In review' },
  APPROVED:     { c: tokens.approved,  label: 'Approved' },
  REJECTED:     { c: tokens.rejected,  label: 'Rejected' },
};

/** Responsive bento grid: 2 cols on mobile, 4 on desktop, dense flow. */
export function Bento({ children, sx }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: { xs: 1.5, md: 2 },
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        gridAutoRows: { xs: '142px', md: '150px' },
        gridAutoFlow: 'dense',
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

/** A single metric: ledger eyebrow on top, big numeral + label at the base. */
export function StatTile({ eyebrow, dot, value, label, color, mono, to, onClick, index, cols = 1, rows = 1 }) {
  return (
    <BentoTile cols={cols} rows={rows} index={index} to={to} onClick={onClick} ariaLabel={label}>
      <Eyebrow dot={dot}>{eyebrow}</Eyebrow>
      <Box sx={{ mt: 'auto' }}>
        <Typography
          sx={{
            fontFamily: mono ? fonts.mono : fonts.display,
            fontWeight: mono ? 500 : 800,
            fontSize: mono ? 'clamp(1.4rem, 3vw, 1.9rem)' : 'clamp(1.9rem, 4vw, 2.6rem)',
            lineHeight: 1,
            letterSpacing: mono ? '-0.01em' : '-0.03em',
            color: color || tokens.ink,
          }}
        >
          {value}
        </Typography>
        <Typography sx={{ mt: 0.75, fontSize: '0.82rem', color: tokens.muted, lineHeight: 1.25 }}>
          {label}
        </Typography>
      </Box>
    </BentoTile>
  );
}

/** The role command moment — oversized clearance numeral + a primary action. */
export function HeroTile({ eyebrow, value, label, caption, action, footer, index, cols = 2, rows = 2 }) {
  return (
    <BentoTile cols={cols} rows={rows} index={index} variant="accent">
      {/* faint ledger watermark */}
      <Box aria-hidden sx={{
        position: 'absolute', inset: 0, opacity: 0.10, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)',
        backgroundSize: '22px 22px',
      }} />
      <Eyebrow light>{eyebrow}</Eyebrow>
      <Box sx={{ mt: 'auto', position: 'relative' }}>
        <Typography sx={{
          fontFamily: fonts.display, fontWeight: 800,
          fontSize: 'clamp(2.6rem, 6vw, 4.4rem)', lineHeight: 0.95, letterSpacing: '-0.04em',
        }}>
          {value}
        </Typography>
        <Typography sx={{ mt: 1, fontSize: '1.02rem', fontWeight: 600, color: 'rgba(255,255,255,0.95)' }}>
          {label}
        </Typography>
        {caption && (
          <Typography sx={{ mt: 0.25, fontSize: '0.82rem', color: 'rgba(255,255,255,0.72)' }}>
            {caption}
          </Typography>
        )}
        {action && <Box sx={{ mt: 2 }}>{action}</Box>}
        {footer}
      </Box>
    </BentoTile>
  );
}

/** A scrollable list tile (recent deals, queue, activity). */
export function ListTile({ eyebrow, title, to, viewAllLabel = 'View all', items, renderItem, empty, index, cols = 2, rows = 2 }) {
  const has = items && items.length > 0;
  return (
    <BentoTile cols={cols} rows={rows} index={index}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
        <Box>
          <Eyebrow>{eyebrow}</Eyebrow>
          {title && <Typography sx={{ mt: 0.5, fontWeight: 700, fontSize: '0.98rem', color: tokens.ink }}>{title}</Typography>}
        </Box>
        {to && (
          <Typography
            component={RouterLink}
            to={to}
            sx={{
              fontSize: '0.78rem', fontWeight: 600, color: tokens.blue, textDecoration: 'none',
              whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' },
            }}
          >
            {viewAllLabel}
          </Typography>
        )}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', mx: -0.5, px: 0.5,
        scrollbarWidth: 'thin' }}>
        {has
          ? items.map((it, i) => <Box key={it.id ?? i}>{renderItem(it, i)}</Box>)
          : <EmptyInline>{empty}</EmptyInline>}
      </Box>
    </BentoTile>
  );
}

/** A compact stack of quick actions, each a row that navigates. Height grows with the count. */
export function ActionTile({ eyebrow = 'Quick actions', actions, index, cols = 2, rows }) {
  const span = rows ?? (actions.length > 2 ? 2 : 1);
  return (
    <BentoTile cols={cols} rows={span} index={index}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.25, flex: 1, justifyContent: 'center' }}>
        {actions.map((a) => (
          <Box
            key={a.to}
            component={RouterLink}
            to={a.to}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.25,
              px: 1, py: 0.6, borderRadius: '12px', textDecoration: 'none',
              color: tokens.ink, transition: 'background-color 0.15s ease',
              '&:hover': { backgroundColor: '#F2F5FA' },
            }}
          >
            <Box sx={{
              width: 28, height: 28, borderRadius: '9px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: a.primary ? tokens.blue : tokens.blueWash,
              color: a.primary ? '#fff' : tokens.blue,
            }}>
              {a.icon}
            </Box>
            <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, flex: 1, minWidth: 0 }}>{a.label}</Typography>
            <ChevronRight />
          </Box>
        ))}
      </Box>
    </BentoTile>
  );
}

/** A labelled distribution bar (e.g. ROOT deal-status mix). */
export function DistributionTile({ eyebrow, title, segments, total, index, cols = 2, rows = 1 }) {
  const real = segments.filter((s) => s.value > 0);
  return (
    <BentoTile cols={cols} rows={rows} index={index}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.8rem', fontWeight: 700, color: tokens.ink }}>
          {total}
        </Typography>
      </Box>
      <Box sx={{ mt: 'auto' }}>
        <Box sx={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', backgroundColor: '#EEF1F6' }}>
          {real.map((s) => (
            <Box key={s.label} title={`${s.label}: ${s.value}`}
                 sx={{ width: `${total ? (s.value / total) * 100 : 0}%`, backgroundColor: s.c }} />
          ))}
        </Box>
        <Box sx={{ mt: 1.25, display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
          {segments.map((s) => (
            <Box key={s.label} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: s.c }} />
              <Typography sx={{ fontSize: '0.72rem', color: tokens.muted }}>
                {s.label} <Box component="span" sx={{ fontWeight: 700, color: tokens.ink, fontFamily: fonts.mono }}>{s.value}</Box>
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </BentoTile>
  );
}

/** Placeholder tiles shown while a dashboard's data loads. */
export function SkeletonTiles({ count = 8 }) {
  const spans = [[2, 2], [1, 1], [1, 1], [2, 1], [2, 2], [1, 1], [1, 1], [2, 1]];
  return spans.slice(0, count).map(([cols, rows], i) => (
    <BentoTile key={i} cols={cols} rows={rows} index={i}>
      <Box sx={{ width: '40%', height: 10, borderRadius: 999, backgroundColor: '#EAEEF4' }} />
      <Box sx={{ mt: 'auto', width: '60%', height: 26, borderRadius: 2, backgroundColor: '#EEF1F6' }} />
      <Box sx={{ mt: 1, width: '45%', height: 10, borderRadius: 999, backgroundColor: '#EEF1F6' }} />
    </BentoTile>
  ));
}

function EmptyInline({ children }) {
  return (
    <Box sx={{ height: '100%', minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', color: tokens.muted, fontSize: '0.82rem', px: 1 }}>
      {children}
    </Box>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.45 }}>
      <path d="M9 6l6 6-6 6" stroke={tokens.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
