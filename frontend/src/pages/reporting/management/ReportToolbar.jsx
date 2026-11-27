import { Alert, Box, MenuItem, TextField, Typography } from '@mui/material';
import { DateField } from '../../../components/DateField.jsx';
import { tokens } from '../../../theme/theme.js';
import { CUSTOM, WINDOW_PRESETS, describeWindowShort, resolveWindow } from './reportWindow.js';

export const ALL_BRANCHES = 'all';

/**
 * What the report covers: a time window (a preset, or two dates of your own) and the whole firm
 * or one branch. Both are the report's own, and leave the sidebar's scope alone.
 */
/** @param status shown at the end of the row, e.g. that the report is being generated */
export function ReportToolbar({ preset, onPreset, custom, onCustom, branchId, onBranch, branches, status }) {
  const inverted = preset === CUSTOM && custom.from && custom.to && custom.from > custom.to;

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
        <TextField
          select
          size="small"
          label="Time window"
          value={preset}
          onChange={(e) => onPreset(e.target.value)}
          sx={{ width: { xs: '100%', sm: 260 } }}
          SelectProps={{
            renderValue: (v) => (v === CUSTOM ? 'Custom range' : WINDOW_PRESETS.find((p) => p.id === v)?.label),
          }}
        >
          {WINDOW_PRESETS.map((p) => (
            <MenuItem key={p.id} value={p.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 3 }}>
              <span>{p.label}</span>
              <Typography component="span" variant="caption" sx={{ color: tokens.muted }}>
                {describeWindowShort(resolveWindow(p.id))}
              </Typography>
            </MenuItem>
          ))}
          <MenuItem value={CUSTOM}>Custom range…</MenuItem>
        </TextField>

        {preset === CUSTOM && (
          <Box sx={{ display: 'flex', gap: 1.5, width: { xs: '100%', sm: 'auto' } }}>
            <Box sx={{ width: { xs: '50%', sm: 180 } }}>
              <DateField label="From" value={custom.from} size="small" fullWidth
                         maxDate={custom.to || undefined}
                         onChange={(from) => onCustom({ ...custom, from })} />
            </Box>
            <Box sx={{ width: { xs: '50%', sm: 180 } }}>
              <DateField label="To" value={custom.to} size="small" fullWidth
                         minDate={custom.from || undefined}
                         onChange={(to) => onCustom({ ...custom, to })} />
            </Box>
          </Box>
        )}

        <TextField
          select
          size="small"
          label="Branch"
          value={branchId}
          onChange={(e) => onBranch(e.target.value)}
          sx={{ width: { xs: '100%', sm: 240 } }}
        >
          <MenuItem value={ALL_BRANCHES}>All branches</MenuItem>
          {branches.map((b) => (
            <MenuItem key={b.id} value={String(b.id)}>
              {b.name}{b.active === false ? ' (deactivated)' : ''}
            </MenuItem>
          ))}
        </TextField>

        <Box aria-live="polite" sx={{ alignSelf: 'center', minWidth: 0 }}>{status}</Box>
      </Box>

      {preset === CUSTOM && (!custom.from || !custom.to) && !inverted && (
        <Typography variant="caption" sx={{ color: tokens.muted, display: 'block', mt: 1 }}>
          Choose both dates to run the report.
        </Typography>
      )}
      {inverted && (
        <Alert severity="warning" sx={{ mt: 1.5 }}>The From date is after the To date. Swap them to run the report.</Alert>
      )}
    </Box>
  );
}
