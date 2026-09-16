import { useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext.jsx';
import { roleLabel, canAccessAllModules, canManageReview, isBroker } from '../auth/roles.js';
import { BrokerMobileHome } from './dashboard/BrokerMobileHome.jsx';
import { visibleGroupsFor, isReviewableModule } from '../navigation/moduleRegistry.jsx';
import { SectionTile } from '../components/dashboard/SectionTile.jsx';
import { SectionOverlay } from '../components/dashboard/SectionOverlay.jsx';
import { ScopeSelector } from '../components/dashboard/ScopeSelector.jsx';
import { ReviewDialog } from '../components/documents/ReviewDialog.jsx';
import { listDocumentReviews, reviewStatusOf } from '../api/documentReviews.js';
import { useDashboardScope } from '../dashboard/DashboardScope.jsx';
import { greeting, stamp } from './dashboard/greeting.js';
import { tokens, fonts } from '../theme/theme.js';

// Tile edge, and the page's measure with it — three of these across is the widest the grid
// ever gets, so the greeting and the grid share one right edge at every width above a phone.
//
// Five sections wrap to two rows, and two rows plus the greeting still land inside a laptop
// viewport without scrolling.
const TILE = 230;
const COLS = 3;

const cardDateFmt = (iso) =>
  iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/**
 * The workspace hub — a launcher, and nothing more.
 *
 * <p>One square tile per compliance section, in a centred grid that fits on a screen. Clicking a
 * tile opens it: the section's modules arrive in a panel that grows out of the tile, over a
 * frosted page. The sections used to be full-width stacked panels, which meant scrolling past
 * four of them to reach Settings and a card row that clipped its own last card.
 *
 * <p>A tile carries a dot when something inside wants attention. Everything else it might say —
 * counts, review dates, which section number it is — belongs to the modules and waits inside.
 */
export function DashboardPage() {
  const { user } = useAuth();
  const { firm, branch } = useDashboardScope();
  const firstName = (user?.fullName || '').trim().split(/\s+/)[0] || null;
  const [reviewing, setReviewing] = useState(null);

  // Review schedules for the current scope, keyed by module, to light up every compliance
  // card. Only the full-workspace roles may call the API, so skip it otherwise.
  const reviewsQ = useQuery({
    queryKey: ['documentReviews', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listDocumentReviews({ firmId: firm?.id, branchId: branch?.id }),
    enabled: canAccessAllModules(user?.role),
  });
  const reviewByModule = Object.fromEntries((reviewsQ.data ?? []).map((r) => [r.moduleKey, r]));

  const mayReview = canManageReview(user?.role);

  // Extra props for a module card that carries a review schedule (everything but Settings).
  const reviewPropsFor = (item) => {
    if (!isReviewableModule(item.id)) return null;
    const review = reviewByModule[item.id] ?? null;
    return {
      reviewStatus: reviewStatusOf(review),
      reviewDate: cardDateFmt(review?.nextReviewDate),
      onReview: mayReview ? () => setReviewing(item) : null,
    };
  };

  const groups = visibleGroupsFor(user?.role);
  const cols = Math.min(groups.length, COLS);

  // Which tile is open, and the tile element it was opened from — the panel scales out of that
  // rect, so the movement says where it came from.
  const [open, setOpen] = useState(null);
  const openSection = (group, el) => setOpen({ group, rect: el?.getBoundingClientRect() ?? null });

  // One dot per section, drawn only when it means something. The three states are the ones
  // reviewStatusOf already returns; there is no fourth "due soon" to invent.
  const attentionOf = (group) => {
    const states = group.items
      .filter((i) => isReviewableModule(i.id))
      .map((i) => reviewStatusOf(reviewByModule[i.id] ?? null));
    if (states.includes('OVERDUE')) return { color: tokens.rejected, label: 'A review is overdue' };
    if (states.includes('UNSET')) return { color: tokens.review, label: 'A review date is not set' };
    return null;
  };

  // On a phone a broker gets their own home instead of the module carousel — see BrokerMobileHome.
  // Swapped with `display` rather than by branching the render, which is how every other mobile
  // alternative in this app is expressed. It costs nothing to leave the desktop tree mounted here:
  // the only query on this page is already disabled for these roles.
  const broker = isBroker(user?.role);

  return (
    <>
    {broker && (
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <BrokerMobileHome />
      </Box>
    )}
    {/* The page's measure. AppShell's <main> sets none, so without this the greeting runs the
        full width of the canvas while the tiles sit in the middle of it — two different centres.
        Capping here keeps the greeting and the grid on one axis. */}
    <Stack
      spacing={{ xs: 3, md: 4 }}
      sx={{
        width: '100%',
        maxWidth: COLS * TILE + (COLS - 1) * 16,
        mx: 'auto',
        ...(broker ? { display: { xs: 'none', md: 'flex' } } : {}),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        {/* Greeting leads the load choreography; cards follow with their own stagger. */}
        <Box sx={{
          opacity: 0,
          animation: 'heroRise 0.6s cubic-bezier(0.22,1,0.36,1) forwards',
          '@keyframes heroRise': {
            from: { opacity: 0, transform: 'translateY(10px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
          '@media (prefers-reduced-motion: reduce)': { opacity: 1, animation: 'none' },
        }}>
          <Typography sx={{
            fontFamily: fonts.mono, fontSize: '0.68rem', letterSpacing: '0.16em',
            color: tokens.muted, textTransform: 'uppercase', mb: 0.75,
          }}>
            {stamp()} . {roleLabel(user?.role)}
          </Typography>
          <Typography variant="h4" sx={{
            fontFamily: fonts.display, fontWeight: 800, letterSpacing: '-0.035em',
            color: tokens.ink, lineHeight: 1.12,
          }}>
            {greeting()}{firstName ? `, ${firstName}` : ''}
            {/* The clearance stamp — one blue full stop. */}
            <Box component="span" sx={{ color: tokens.blue }}>.</Box>
          </Typography>
        </Box>
        {/* Mobile only — on desktop the scope selector lives in the sidebar. */}
        <Box sx={{ display: { xs: 'block', md: 'none' } }}>
          <ScopeSelector />
        </Box>
      </Box>

      {/* Five things, one screen. The grid centres itself rather than being nudged toward the
          viewport's midpoint with a negative-ish margin — the sidebar is part of the page, and
          content belongs in the middle of the space it is actually given. */}
      <Box sx={{
        display: 'grid',
        gap: 2,
        // Three across at most, one on a phone. Stated outright rather than left to auto-fit,
        // which sized a track nobody could see and shrank every tile to pay for it. The width
        // then follows from the tile size, so the grid's right edge lands on the greeting's.
        gridTemplateColumns: {
          xs: 'repeat(1, minmax(0, 1fr))',
          sm: `repeat(${cols}, minmax(0, 1fr))`,
        },
        maxWidth: cols * TILE + (cols - 1) * 16,
      }}>
        {groups.map((group, i) => (
          <SectionTile
            key={group.slug}
            group={group}
            index={i}
            attention={attentionOf(group)}
            onOpen={openSection}
          />
        ))}
      </Box>

      <SectionOverlay
        open={Boolean(open)}
        group={open?.group ?? null}
        originRect={open?.rect ?? null}
        onClose={() => setOpen(null)}
        reviewPropsFor={reviewPropsFor}
      />

      <ReviewDialog
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        moduleKey={reviewing?.id}
        title={reviewing?.label ?? ''}
        review={reviewing ? reviewByModule[reviewing.id] ?? null : null}
      />
    </Stack>
    </>
  );
}
