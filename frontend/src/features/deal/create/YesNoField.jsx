import { Box, FormControlLabel, FormLabel, Radio, RadioGroup, Stack, Typography } from '@mui/material';
import { tokens } from '../../../theme/theme.js';

/**
 * A yes/no compliance question.
 *
 * `value` is a tri-state: true, false, or null for unanswered. That distinction matters here —
 * "no trust is involved" and "nobody has asked yet" are different compliance facts, and only
 * the first is an answer. Neither radio is selected while the value is null.
 */
export function YesNoField({ value, onChange, label, help, required = false, warnOnYes = null }) {
  return (
    <Box>
      <FormLabel
        sx={{
          fontSize: '0.9rem', fontWeight: 600, color: tokens.ink,
          '&.Mui-focused': { color: tokens.ink },
        }}
      >
        {label}{required && <Box component="span" sx={{ color: tokens.rejected, ml: 0.5 }}>*</Box>}
      </FormLabel>
      {help && (
        <Typography variant="caption" sx={{ display: 'block', color: tokens.muted, mt: 0.25 }}>
          {help}
        </Typography>
      )}
      <RadioGroup
        row
        // '' rather than null: MUI treats null as uncontrolled and warns on the first click.
        value={value == null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === 'true')}
        sx={{ mt: 0.5, gap: 3 }}
      >
        <FormControlLabel value="true" control={<Radio size="small" />} label="Yes" />
        <FormControlLabel value="false" control={<Radio size="small" />} label="No" />
      </RadioGroup>
      {warnOnYes && value === true && (
        <Stack
          direction="row"
          spacing={1}
          sx={{
            mt: 0.5, px: 1.5, py: 1, borderRadius: 2,
            backgroundColor: 'var(--cl-warn-wash)', color: tokens.review,
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 600 }}>{warnOnYes}</Typography>
        </Stack>
      )}
    </Box>
  );
}
