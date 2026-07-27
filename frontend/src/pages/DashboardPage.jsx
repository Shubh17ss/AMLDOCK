import { Box, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext.jsx';
import { roleLabel, canAccessAllModules } from '../auth/roles.js';
import { visibleGroupsFor } from '../navigation/moduleRegistry.jsx';
import { ModuleCard } from '../components/dashboard/ModuleCard.jsx';
import { ScopeSelector } from '../components/dashboard/ScopeSelector.jsx';
import { DOCUMENT_MODULES } from './documents/DocumentModulePage.jsx';
import { listDocumentReviews, reviewStatusOf } from '../api/documentReviews.js';
import { useDashboardScope } from '../dashboard/DashboardScope.jsx';
import { greeting, stamp } from './dashboard/greeting.js';
import { tokens, fonts } from '../theme/theme.js';

// Document module cards carry a review indicator; map each card's route to its category.
const REVIEW_PATH_TO_CATEGORY = Object.fromEntries(DOCUMENT_MODULES.map((m) => [m.path, m.category]));

const cardDateFmt = (iso) =>
  iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/**
 * The workspace hub: a launcher of compliance-module cards grouped by section.
 * Section headers are clickable (the CDD header opens the CDD Register stats view).
 * The firm/branch scope selector sits above the cards.
 */
export function DashboardPage() {
  const { user } = useAuth();
  const { firm, branch } = useDashboardScope();
  const firstName = (user?.fullName || '').trim().split(/\s+/)[0] || null;

  // Review schedules for the current scope, keyed by category, to light up the Documents cards.
  // Only the full-workspace roles see those cards (and may call the API), so skip it otherwise.
  const reviewsQ = useQuery({
    queryKey: ['documentReviews', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listDocumentReviews({ firmId: firm?.id, branchId: branch?.id }),
    enabled: canAccessAllModules(user?.role),
  });
  const reviewByCategory = Object.fromEntries((reviewsQ.data ?? []).map((r) => [r.category, r]));

  // Extra props for a module card if it maps to a document register with a review schedule.
  const reviewPropsFor = (item) => {
    const category = REVIEW_PATH_TO_CATEGORY[item.to];
    if (!category) return null;
    const review = reviewByCategory[category] ?? null;
    return { reviewStatus: reviewStatusOf(review), reviewDate: cardDateFmt(review?.nextReviewDate) };
  };

  const groups = visibleGroupsFor(user?.role);
  let cardIndex = 0;

  return (
    <Stack spacing={{ xs: 4, md: 6 }}>
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

      {groups.map((group, gi) => (
        <Box key={group.group}>
          {/* Header row fades in per section; the hairline draws itself left → right. */}
          <Box sx={{
            mb: 1.5, display: 'flex', alignItems: 'center', gap: 1.25,
            opacity: 0,
            animation: 'sectionIn 0.45s ease forwards',
            animationDelay: `${120 + gi * 90}ms`,
            '@keyframes sectionIn': { from: { opacity: 0 }, to: { opacity: 1 } },
            '@media (prefers-reduced-motion: reduce)': { opacity: 1, animation: 'none' },
          }}>
            <Typography
              component={RouterLink}
              to={group.to}
              sx={{
                fontFamily: fonts.mono, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.16em',
                textTransform: 'uppercase', color: tokens.muted, textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 0.5,
                transition: 'color 0.15s ease',
                '&:hover': { color: tokens.blue },
              }}
            >
              {group.group}
              <Box component="span" sx={{ fontSize: '0.9em', opacity: 0.6 }}>›</Box>
            </Typography>
            {/* Ledger count — how many modules this section holds. */}
            <Typography component="span" sx={{
              fontFamily: fonts.mono, fontSize: '0.64rem', color: tokens.muted, opacity: 0.65, lineHeight: 1,
            }}>
              {String(group.items.length).padStart(2, '0')}
            </Typography>
            <Box sx={{
              flex: 1, height: '1px', transformOrigin: 'left',
              background: `linear-gradient(90deg, ${tokens.hairline2}, rgba(215,222,234,0))`,
              transform: 'scaleX(0)',
              animation: 'hairDraw 0.7s cubic-bezier(0.22,1,0.36,1) forwards',
              animationDelay: `${220 + gi * 90}ms`,
              '@keyframes hairDraw': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
              '@media (prefers-reduced-motion: reduce)': { transform: 'scaleX(1)', animation: 'none' },
            }} />
          </Box>

          <Box sx={{
            display: 'grid',
            gap: { xs: 1.5, md: 2.5 },
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(320px, 1fr))' },
          }}>
            {group.items.map((item) => (
              <ModuleCard key={item.id} label={item.label} to={item.to} index={cardIndex++}
                          {...(reviewPropsFor(item) ?? {})} />
            ))}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
