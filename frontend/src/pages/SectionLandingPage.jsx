import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader.jsx';
import { BentoTile, Eyebrow } from '../components/bento/BentoTile.jsx';
import { ReviewDialog } from '../components/documents/ReviewDialog.jsx';
import { reviewMetaFor } from '../components/documents/reviewStatus.jsx';
import { listDocumentReviews, reviewStatusOf } from '../api/documentReviews.js';
import { isReviewableModule } from '../navigation/moduleRegistry.jsx';
import { useDashboardScope } from '../dashboard/DashboardScope.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { canManageReview } from '../auth/roles.js';
import { tokens, fonts } from '../theme/theme.js';

const dateFmt = (iso) =>
  iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/**
 * The landing page behind every menu section header: one card per module in the section,
 * each showing its review status and due date, with a Review action for the roles that may
 * manage it. Replaces the old "Coming soon" placeholder on the group routes.
 *
 * Driven entirely by the module registry, so a new module appears here automatically.
 */
export function SectionLandingPage({ group }) {
  const { user } = useAuth();
  const { firm, branch } = useDashboardScope();
  const [reviewing, setReviewing] = useState(null);

  const mayReview = canManageReview(user?.role);
  const sectionHasReviews = group.items.some((i) => isReviewableModule(i.id));

  // One fetch for the whole section; every card reads its own row out of the result.
  const reviewsQ = useQuery({
    queryKey: ['documentReviews', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listDocumentReviews({ firmId: firm?.id, branchId: branch?.id }),
    enabled: sectionHasReviews,
  });
  const reviewByModule = Object.fromEntries((reviewsQ.data ?? []).map((r) => [r.moduleKey, r]));

  const count = group.items.length;

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow={[
          `${count} ${count === 1 ? 'module' : 'modules'}`,
          firm?.name,
          branch?.name,
        ].filter(Boolean).join(' · ')}
        title={group.title}
      />

      <Box sx={{
        display: 'grid',
        gap: { xs: 1.5, md: 2 },
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(280px, 1fr))' },
      }}>
        {group.items.map((item, i) => {
          const reviewable = isReviewableModule(item.id);
          const review = reviewable ? reviewByModule[item.id] ?? null : null;
          const meta = reviewable ? reviewMetaFor(reviewStatusOf(review)) : null;
          const StatusIcon = meta?.Icon;

          return (
            <BentoTile key={item.id} index={i} sx={{ p: 2.75 }}>
              {/* Icon + review status */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 2 }}>
                <Box sx={{
                  width: 44, height: 44, borderRadius: '13px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: tokens.blueWash, color: tokens.blue,
                }}>
                  {item.icon}
                </Box>
                {meta && (
                  <Tooltip title={meta.label}>
                    <Box sx={{
                      width: 30, height: 30, borderRadius: '10px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: `color-mix(in srgb, ${meta.color} 11%, transparent)`,
                      boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${meta.color} 15%, transparent)`,
                    }}>
                      <StatusIcon sx={{ fontSize: 18, color: meta.color }} />
                    </Box>
                  </Tooltip>
                )}
              </Box>

              <Typography sx={{ fontWeight: 700, fontSize: '1.02rem', color: tokens.ink }}>
                {item.label}
              </Typography>
              <Typography sx={{ mt: 0.75, fontSize: '0.84rem', color: tokens.muted, lineHeight: 1.45 }}>
                {item.blurb}
              </Typography>

              <Typography
                component={RouterLink}
                to={item.to}
                sx={{
                  mt: 'auto', pt: 2, fontSize: '0.8rem', fontWeight: 600, color: tokens.blue,
                  display: 'inline-flex', alignItems: 'center', gap: 0.5, textDecoration: 'none',
                  alignSelf: 'flex-start',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                Open module
                <Box component="span" aria-hidden sx={{ fontSize: '1em' }}>→</Box>
              </Typography>

              {/* Review footer — date, plus the action for roles that may manage it */}
              {reviewable && (
                <Box sx={{
                  mt: 1.75, pt: 1.25, borderTop: `1px solid ${tokens.hairline}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1,
                }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Eyebrow>Review Date</Eyebrow>
                    <Typography sx={{
                      mt: 0.4, fontFamily: fonts.mono, fontSize: '0.78rem', whiteSpace: 'nowrap',
                      color: meta.color, fontWeight: 700,
                    }}>
                      {dateFmt(review?.nextReviewDate)}
                    </Typography>
                  </Box>
                  {mayReview && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<StatusIcon sx={{ color: `${meta.color} !important` }} />}
                      onClick={() => setReviewing(item)}
                      sx={{ flexShrink: 0 }}
                    >
                      Review
                    </Button>
                  )}
                </Box>
              )}
            </BentoTile>
          );
        })}
      </Box>

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
