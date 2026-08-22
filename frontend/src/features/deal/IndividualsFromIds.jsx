import { useQuery } from '@tanstack/react-query';
import { Box, Stack, Typography } from '@mui/material';
import { listDealBeneficialOwners } from '../../api/beneficialOwners.js';
import { documentTypeLabel } from '../../api/documents.js';
import { tokens, fonts } from '../../theme/theme.js';

const fmtDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-NZ', {
    day: '2-digit', month: 'short', year: 'numeric',
  }) : null;

const typeLabel = (t) => (t ? documentTypeLabel(t).toLowerCase() : null);

/**
 * The natural persons identified from a deal's scanned IDs.
 *
 * <p>Sits beneath the Client rows rather than replacing them, because the two answer different
 * questions: the client is the <em>entity</em> — company, trust, individual — which stays
 * "Pending review" until compliance classifies it, while these are the people whose cards were
 * actually photographed. They are the evidence for whatever the entity turns out to be.
 *
 * <p>One entry per identity document, plus anyone added by hand in the ownership structure. Two
 * IDs naming the same human show as two people; nothing here merges them, because that is a
 * judgement rather than an extraction result.
 *
 * <p>A person whose card could not be read still appears, reading "Not yet read". An ID that
 * yielded nothing is precisely what a reviewer needs to notice.
 */
export function IndividualsFromIds({ dealId, dense = false }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['deals', dealId, 'beneficial-owners'],
    queryFn: () => listDealBeneficialOwners(dealId),
    enabled: Boolean(dealId),
  });

  if (isLoading || isError) return null;

  const people = data ?? [];

  return (
    <Box sx={{ mt: dense ? 1 : 1.5 }}>
      <Typography
        variant="caption"
        sx={{ color: tokens.muted, fontWeight: 700, display: 'block', mb: 0.5 }}
      >
        Individuals{people.length ? ` (${people.length})` : ''}
      </Typography>

      {people.length === 0 ? (
        <Typography variant="body2" sx={{ color: tokens.muted }}>
          None yet
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {people.map((p) => {
            const dob = fmtDate(p.dateOfBirth);
            const type = typeLabel(p.idDocumentType);
            // Sides captured is worth surfacing: a licence recorded front-only is a known gap.
            // Only for people who came from a scan — someone added by hand in the ownership
            // structure has no images, and "front only" would read as a missing back.
            const sides = p.imageCount >= 2 ? 'front + back' : 'front only';
            const detail = [
              dob && `DOB ${dob}`,
              type ? `${type}, ${sides}` : (p.imageCount === 0 ? 'added by hand' : null),
            ].filter(Boolean).join(' · ');

            return (
              <Stack key={p.id} direction="row" spacing={1} alignItems="baseline" flexWrap="wrap">
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: fonts.mono, fontSize: '0.8rem',
                    color: p.fullName ? tokens.ink : tokens.muted,
                  }}
                >
                  {p.fullName ?? 'Not yet read'}
                </Typography>
                {detail && (
                  <Typography variant="caption" sx={{ color: tokens.muted }}>
                    {detail}
                  </Typography>
                )}
              </Stack>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
