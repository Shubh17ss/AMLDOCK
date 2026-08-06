import { useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext.jsx';
import { roleLabel, canAccessAllModules, canManageReview } from '../auth/roles.js';
import { visibleGroupsFor, isReviewableModule } from '../navigation/moduleRegistry.jsx';
import { ModuleCard } from '../components/dashboard/ModuleCard.jsx';
import { ScopeSelector } from '../components/dashboard/ScopeSelector.jsx';
import { ReviewDialog } from '../components/documents/ReviewDialog.jsx';
import { listDocumentReviews, reviewStatusOf } from '../api/documentReviews.js';
import { useDashboardScope } from '../dashboard/DashboardScope.jsx';
import { greeting, stamp } from './dashboard/greeting.js';
import { tokens, fonts, shadows } from '../theme/theme.js';

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
  let cardIndex = 0;

  return (
    <Stack spacing={{ xs: 3, md: 4 }}>
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

      {/* One boxed panel per section, stacked. A deep-blue identity rail on the left
          (~30%) carries the section's glyph; the module cards sit in a grid beside it. */}
      {groups.map((group, gi) => (
        <Box
          key={group.group}
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            // A section, not a row: ~70% of the canvas with real height, centred to the
            // *viewport* rather than the content column. The column starts after the 260px
            // sidebar, so true centre needs the left margin shrunk by half of that (130px).
            // Margins can't go negative, so on screens too narrow to absorb the shift the
            // panel simply rests at the column's left edge — it can never slide under the
            // sidebar the way an offset could.
            width: { xs: '100%', md: '70%' },
            ml: { xs: 0, md: 'max(0px, calc(15% - 130px))' },
            mr: { xs: 0, md: 'auto' },
            minHeight: { md: 340 },
            borderRadius: '22px',
            overflow: 'hidden',
            border: `1px solid ${tokens.hairline}`,
            boxShadow: shadows.glass,
            // The panel itself is frosted so the ambient canvas wash glows through the
            // card area, matching the bento tiles it contains.
            background: tokens.panelBg,
            backdropFilter: 'blur(18px) saturate(180%)',
            WebkitBackdropFilter: 'blur(18px) saturate(180%)',
            opacity: 0,
            animation: 'panelRise 0.55s cubic-bezier(0.22,1,0.36,1) forwards',
            animationDelay: `${120 + gi * 110}ms`,
            '@keyframes panelRise': {
              from: { opacity: 0, transform: 'translateY(14px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
            '@media (prefers-reduced-motion: reduce)': { opacity: 1, animation: 'none' },
          }}
        >
          {/* ── Identity rail ─────────────────────────────────────────────── */}
          <Box
            component={RouterLink}
            to={group.to}
            aria-label={`Open ${group.title}`}
            sx={{
              position: 'relative',
              width: { xs: '100%', md: '30%' },
              flexShrink: 0,
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              gap: 3,
              p: { xs: 2.5, md: 3.5 },
              minHeight: { md: 340 },
              textDecoration: 'none',
              color: '#fff',
              background: `
                radial-gradient(420px 260px at 110% -20%, rgba(255,255,255,0.20), transparent 60%),
                radial-gradient(360px 240px at -20% 120%, rgba(10,31,55,0.45), transparent 62%),
                linear-gradient(140deg, ${tokens.blue} 0%, ${tokens.blueDark} 100%)
              `,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), inset -1px 0 0 rgba(10,31,55,0.18)',
              transition: 'filter 0.25s ease',
              '&:hover': { filter: 'brightness(1.06)' },
              '&:hover .rail-arrow': { transform: 'translateX(3px)' },
              '&:hover .rail-hero': { transform: 'scale(1.05)' },
            }}
          >
            {/* Header text, top-left. */}
            <Box>
              <Typography sx={{
                fontFamily: fonts.mono, fontSize: '0.62rem', fontWeight: 700,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.72)',
              }}>
                Section {String(gi + 1).padStart(2, '0')} · {String(group.items.length).padStart(2, '0')} module{group.items.length === 1 ? '' : 's'}
              </Typography>
              <Typography sx={{
                mt: 0.75, fontFamily: fonts.display, fontWeight: 800,
                fontSize: { xs: '1.25rem', md: '1.45rem' }, letterSpacing: '-0.02em',
                lineHeight: 1.15, color: '#fff',
              }}>
                {group.title}
              </Typography>
            </Box>

            {/* The section glyph is the hero — centred, sized to the rail's height. */}
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box
                className="rail-hero"
                sx={{
                  width: { xs: 96, md: 96 }, height: { xs: 96, md: 96 },
                  borderRadius: { xs: '24px', md: '32px' },
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.14)',
                  boxShadow: `
                    inset 0 1px 0 rgba(255,255,255,0.38),
                    inset 0 0 0 1px rgba(255,255,255,0.14),
                    0 18px 40px -12px rgba(10,31,55,0.55)
                  `,
                  backdropFilter: 'blur(6px)',
                  transition: 'transform 0.4s cubic-bezier(0.22,1,0.36,1)',
                  '& svg': { fontSize: { xs: 48, md: 48 }, color: '#fff' },
                }}
              >
                {group.icon}
              </Box>
            </Box>

            <Typography sx={{
              position: 'relative',
              fontFamily: fonts.mono, fontSize: '0.68rem', fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.85)',
              display: 'inline-flex', alignItems: 'center', gap: 0.75,
            }}>
              Open section
              <Box component="span" className="rail-arrow"
                   sx={{ transition: 'transform 0.25s ease', fontSize: '1.05em' }}>
                ›
              </Box>
            </Typography>
          </Box>

          {/* ── Module cards ──────────────────────────────────────────────── */}
          <Box sx={{
            flex: 1, minWidth: 0,
            p: { xs: 2, md: 3 },
            display: 'grid',
            gap: { xs: 1.5, md: 2 },
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(250px, 1fr))' },
            // Centred in the tall panel, so a one-row section doesn't pool at the top.
            alignContent: 'center',
          }}>
            {group.items.map((item) => (
              <ModuleCard key={item.id} label={item.label} to={item.to} index={cardIndex++}
                          {...(reviewPropsFor(item) ?? {})} />
            ))}
          </Box>
        </Box>
      ))}

      <ReviewDialog
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        moduleKey={reviewing?.id}
        title={reviewing?.label ?? ''}
        review={reviewing ? reviewByModule[reviewing.id] ?? null : null}
      />
    </Stack>
  );
}
