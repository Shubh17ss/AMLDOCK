import { useMemo } from 'react';
import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import PublicOffIcon from '@mui/icons-material/PublicOff';
import { COUNTRIES, flagClass } from '../data/countries.js';
import { tokens, fonts } from '../theme/theme.js';

/** Sentinel for "asked, and there is none" — see the deal's foreign-exposure question. */
export const NO_COUNTRY = 'NONE';

/**
 * Searchable country picker showing each country's flag beside its name and ISO code.
 * Value is the ISO 3166-1 alpha-2 code (a string) so it maps straight onto the API field;
 * onChange receives the code or null when cleared.
 *
 * Matching is on name *and* code, so "NZ" and "New Zea" both find New Zealand.
 *
 * With `noneOption`, a "None" entry is pinned to the top and selecting it yields the literal
 * 'NONE'. That is a real answer, distinct from clearing the field: null means the question is
 * unanswered, and a PATCH cannot carry null (the API only writes fields that are present).
 */
export function CountrySelect({
  value,
  onChange,
  label = 'Country',
  required = false,
  disabled = false,
  helperText,
  noneOption = false,
  noneLabel = 'None — no foreign exposure',
}) {
  const options = useMemo(
    () => (noneOption ? [{ code: NO_COUNTRY, name: noneLabel }, ...COUNTRIES] : COUNTRIES),
    [noneOption, noneLabel],
  );
  // Resolved against `options` rather than countryByCode(), which has no knowledge of the
  // sentinel and would report a selected "None" as nothing selected.
  const selected = useMemo(
    () => options.find((c) => c.code === value) ?? null,
    [options, value],
  );

  return (
    <Autocomplete
      options={options}
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
        const isNone = c.code === NO_COUNTRY;
        return (
          <Box component="li" key={key} {...liProps}
               sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            {/* flagClass('NONE') would emit a nonexistent `fi fi-none` class and render as a
                blank box, so the sentinel gets its own glyph. */}
            {isNone ? (
              <PublicOffIcon sx={{ fontSize: '1.15rem', color: tokens.muted, flexShrink: 0 }} />
            ) : (
              <Box component="span" className={flagClass(c.code)}
                   sx={{ fontSize: '1.15rem', borderRadius: '2px', flexShrink: 0 }} />
            )}
            <Typography sx={{ fontSize: '0.875rem', color: tokens.ink, flex: 1, minWidth: 0 }}>
              {c.name}
            </Typography>
            {!isNone && (
              <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.72rem', color: tokens.muted }}>
                {c.code}
              </Typography>
            )}
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
            startAdornment: !selected ? null : selected.code === NO_COUNTRY ? (
              <PublicOffIcon sx={{ fontSize: '1.15rem', ml: 0.75, mr: 0.25, color: tokens.muted }} />
            ) : (
              <Box component="span" className={flagClass(selected.code)}
                   sx={{ fontSize: '1.15rem', ml: 0.75, mr: 0.25, borderRadius: '2px' }} />
            ),
          }}
        />
      )}
      fullWidth
    />
  );
}
