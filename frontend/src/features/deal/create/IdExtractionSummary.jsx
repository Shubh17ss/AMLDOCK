import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { tokens, fonts } from '../../../theme/theme.js';

// Date-only values, so the T00:00:00 guard — without it the browser reads a bare ISO date as
// UTC midnight and renders the previous day for anyone east of Greenwich, which is everyone here.
const fmtDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-NZ', {
    day: '2-digit', month: 'short', year: 'numeric',
  }) : null;

/** Below this, the reading is worth a second look before anyone relies on it. */
const LOW_CONFIDENCE = 0.9;

const FIELDS = [
  { key: 'fullName',    label: 'Name' },
  { key: 'dateOfBirth', label: 'Date of birth', format: fmtDate },
  { key: 'expiryDate',  label: 'Expires',       format: fmtDate },
];

/**
 * What Textract read off one ID scan.
 *
 * <p>Values are shown exactly as extracted and are applied nowhere else — an AML record should
 * not quietly contain a machine guess. A field the scan didn't yield reads "Not detected" rather
 * than being hidden, because a missing date of birth is itself worth seeing.
 */
export function IdExtractionSummary({ document: doc }) {
  const status = doc?.ocrStatus;
  if (!status || status === 'NOT_APPLICABLE') return null;

  if (status === 'PENDING' || status === 'IN_PROGRESS') {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <CircularProgress size={12} thickness={5} sx={{ color: tokens.muted }} />
        <Typography variant="caption" sx={{ color: tokens.muted }}>
          Reading this scan…
        </Typography>
      </Stack>
    );
  }

  if (status === 'FAILED') {
    return (
      <Typography variant="caption" sx={{ color: tokens.muted }}>
        Couldn’t read this scan — the details can still be entered by hand.
      </Typography>
    );
  }

  const parsed = parseFields(doc.ocrFields);

  return (
    <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
      {FIELDS.map(({ key, label, format }) => {
        const entry = parsed[key];
        const raw = entry?.value ?? null;
        const shown = raw && format ? format(raw) : raw;
        const confidence = entry?.confidence ?? null;
        const low = confidence !== null && confidence < LOW_CONFIDENCE;

        return (
          <Box key={key} sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{ color: tokens.muted, display: 'block', fontSize: '0.66rem' }}
            >
              {label}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: fonts.mono, fontSize: '0.78rem',
                color: shown ? tokens.ink : tokens.muted,
              }}
            >
              {shown ?? 'Not detected'}
              {low && (
                <Box component="span" sx={{ color: tokens.muted, fontFamily: fonts.body }}>
                  {` · ${Math.round(confidence * 100)}%`}
                </Box>
              )}
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}

/**
 * ocr_fields is JSONB, and the API hands it back as a string. A malformed or absent payload
 * yields empty rather than throwing — a display component should never take the form down.
 */
function parseFields(raw) {
  if (!raw) return {};
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return {};
  }
}
