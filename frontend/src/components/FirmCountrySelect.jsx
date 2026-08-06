import { Box, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { FIRM_COUNTRIES, flagClass } from '../data/countries.js';
import { tokens } from '../theme/theme.js';

/**
 * The country a reporting entity is registered in — New Zealand or Australia, with its flag.
 *
 * A plain Select rather than the searchable `CountrySelect`: that one is an Autocomplete over the
 * full world list, which is the wrong affordance for two fixed options. Value is the ISO
 * alpha-2 code, so it maps straight onto the API field.
 */
export function FirmCountrySelect({
  value,
  onChange,
  label = 'Country',
  required = false,
  disabled = false,
  helperText,
}) {
  const labelId = 'firm-country-label';

  return (
    <FormControl fullWidth required={required} disabled={disabled}>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        label={label}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        renderValue={(code) => <CountryLine code={code} />}
      >
        {FIRM_COUNTRIES.map((c) => (
          <MenuItem key={c.code} value={c.code}>
            <CountryLine code={c.code} name={c.name} />
          </MenuItem>
        ))}
      </Select>
      {helperText && (
        <Box sx={{ fontSize: '0.75rem', color: tokens.muted, mt: 0.5, ml: 1.75 }}>
          {helperText}
        </Box>
      )}
    </FormControl>
  );
}

/** Flag then name. The name is looked up when not passed, so renderValue stays a one-liner. */
function CountryLine({ code, name }) {
  const country = name ?? FIRM_COUNTRIES.find((c) => c.code === code)?.name ?? code;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Box component="span" className={flagClass(code)}
           sx={{ fontSize: '1.15rem', borderRadius: '2px', flexShrink: 0 }} />
      <span>{country}</span>
    </Box>
  );
}
