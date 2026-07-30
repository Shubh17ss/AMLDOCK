import { useMemo } from 'react';
import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import { COUNTRIES, countryByCode, flagClass } from '../data/countries.js';
import { tokens, fonts } from '../theme/theme.js';

/**
 * Searchable country picker showing each country's flag beside its name and ISO code.
 * Value is the ISO 3166-1 alpha-2 code (a string) so it maps straight onto the API field;
 * onChange receives the code or null when cleared.
 *
 * Matching is on name *and* code, so "NZ" and "New Zea" both find New Zealand.
 */
export function CountrySelect({
  value,
  onChange,
  label = 'Country',
  required = false,
  disabled = false,
  helperText,
}) {
  const selected = useMemo(() => countryByCode(value), [value]);

  return (
    <Autocomplete
      options={COUNTRIES}
      value={selected}
      disabled={disabled}
      onChange={(_e, option) => onChange(option?.code ?? null)}
      isOptionEqualToValue={(a, b) => a.code === b.code}
      getOptionLabel={(c) => c.name}
      filterOptions={(options, { inputValue }) => {
        const q = inputValue.trim().toLowerCase();
        if (!q) return options;
        return options.filter(
          (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().startsWith(q),
        );
      }}
      renderOption={(props, c) => {
        const { key, ...liProps } = props;
        return (
          <Box component="li" key={key} {...liProps}
               sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box component="span" className={flagClass(c.code)}
                 sx={{ fontSize: '1.15rem', borderRadius: '2px', flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.875rem', color: tokens.ink, flex: 1, minWidth: 0 }}>
              {c.name}
            </Typography>
            <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.72rem', color: tokens.muted }}>
              {c.code}
            </Typography>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            startAdornment: selected ? (
              <Box component="span" className={flagClass(selected.code)}
                   sx={{ fontSize: '1.15rem', ml: 0.75, mr: 0.25, borderRadius: '2px' }} />
            ) : null,
          }}
        />
      )}
      fullWidth
    />
  );
}
