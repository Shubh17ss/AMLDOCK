import { Box, FormLabel, Typography } from '@mui/material';
import { tokens, motion } from '../theme/theme.js';

/** The answers to the question almost every segmented field here asks. */
export const YES_NO = [{ value: true, label: 'Yes' }, { value: false, label: 'No' }];

/**
 * One question as a segmented control.
 *
 * <p>Buttons in a track rather than radios: the answer stays legible at arm's length, which
 * matters on the phone a reviewer is often holding, and the whole control is a single tap target
 * per option rather than a dot to hit.
 *
 * <p>Lives in components rather than beside the ownership form because it is not about ownership
 * — the Verification tab asks its one question the same way, and a second implementation of the
 * same pills would drift from this one the first time either was touched.
 *
 * <p>Takes `options` for questions whose answers are not yes and no: the nominee
 * director/shareholder question, where "Not asked" is the default because a YES carries a risk
 * consequence and a defaulted NO would be a negative answer nobody gave; and the verification
 * question, whose two answers are both a kind of yes.
 *
 * <p>`nullable` means no segment is selected while the answer is null, so a question nobody has
 * put reads as unanswered rather than as the first option. Used on every question that feeds the
 * risk score — the Risk tab lists the unanswered ones and will not let the risk be approved
 * until they are gone, which only works if "not stated" is reachable — and on the verification
 * question, where nothing should be lit until the reviewer picks.
 */
export function SegmentedField({ label, value, onChange, options = YES_NO, helper, nullable = false,
                                 disabled = false }) {
  const isTriState = options !== YES_NO;
  const unset = value === undefined || value === null;
  // `nullable` outranks the options default. Without that order a caller passing its own options
  // could never show an unanswered question — the first option would always be lit — and the
  // whole point of nullable is that "nobody has answered" is a state the control can show.
  const current = unset
    ? (nullable ? null : (isTriState ? options[0].value : false))
    : value;

  return (
    <Box>
      <FormLabel
        component="legend"
        sx={{ fontSize: '0.8rem', color: tokens.ink, display: 'block', mb: 0.75 }}
      >
        {label}
      </FormLabel>
      <Box
        role="radiogroup"
        aria-label={label}
        sx={{
          display: 'inline-flex',
          p: 0.375,
          gap: 0.375,
          borderRadius: 2,
          border: `1px solid ${tokens.hairline}`,
          backgroundColor: tokens.tileRaised,
          maxWidth: '100%',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        {options.map((o) => {
          const selected = current !== null && String(o.value) === String(current);
          return (
            <Box
              key={String(o.value)}
              role="radio"
              aria-checked={selected}
              aria-disabled={disabled || undefined}
              tabIndex={disabled ? -1 : 0}
              onClick={() => { if (!disabled) onChange(o.value); }}
              onKeyDown={(e) => {
                if (disabled) return;
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(o.value); }
              }}
              sx={motion.respectful({
                px: 2.5,
                py: 0.75,
                borderRadius: 1.5,
                cursor: disabled ? 'default' : 'pointer',
                userSelect: 'none',
                fontSize: '0.85rem',
                fontWeight: selected ? 600 : 400,
                color: selected ? '#fff' : tokens.muted,
                backgroundColor: selected ? tokens.blue : 'transparent',
                transition: `background-color ${motion.swift} ease, color ${motion.swift} ease`,
                '&:hover': {
                  backgroundColor: selected ? tokens.blue : (disabled ? undefined : tokens.hover),
                },
                '&:focus-visible': { outline: `2px solid ${tokens.blue}`, outlineOffset: 2 },
              })}
            >
              {o.label}
            </Box>
          );
        })}
      </Box>
      {helper && (
        <Typography variant="caption" sx={{ color: tokens.muted, display: 'block', mt: 0.5 }}>
          {helper}
        </Typography>
      )}
    </Box>
  );
}
