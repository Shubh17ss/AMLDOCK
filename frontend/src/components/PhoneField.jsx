import { useMemo } from 'react';
import { Autocomplete, Box, Stack, TextField, Typography } from '@mui/material';
import { COUNTRIES, flagClass } from '../data/countries.js';
import { dialCode } from '../data/callingCodes.js';
import { useFirmCountry } from '../hooks/useFirmCountry.js';
import { tokens, fonts } from '../theme/theme.js';

/**
 * A phone number and the country it belongs to.
 *
 * Value is `{ country, number }` — an ISO 3166-1 alpha-2 code and the national significant
 * number as typed. Stored as two fields rather than one E.164 string because the dial code
 * cannot be reversed into a country: +1 is the US, Canada and twenty islands, and the flag has
 * to render something.
 *
 * The number is not validated or reformatted. A CDD record holds what the client gave; a number
 * rejected for looking wrong is a fact lost rather than a mistake prevented.
 *
 * The country defaults to the signed-in user's reporting entity, which is the right guess for
 * most clients of an NZ or AU firm. It is only a display default until the user types — a blank
 * field stays blank rather than silently acquiring a country nobody chose.
 */
export function PhoneField({
  value,
  onChange,
  label = 'Phone number',
  disabled = false,
  helperText,
}) {
  const { country: firmCountry } = useFirmCountry();
  const country = value?.country || firmCountry || null;
  const number = value?.number ?? '';

  const selected = useMemo(
    () => COUNTRIES.find((c) => c.code === country) ?? null,
    [country],
  );

  const emit = (next) => onChange?.({ country: next.country ?? null, number: next.number ?? '' });

  return (
    <Stack direction="row" spacing={1} alignItems="flex-start">
      <Autocomplete
        options={COUNTRIES}
        value={selected}
        disabled={disabled}
        disableClearable
        onChange={(_e, option) => emit({ country: option?.code ?? null, number })}
        isOptionEqualToValue={(a, b) => a.code === b.code}
        // Closed, the field shows the dial code alone — the name would crowd out the number.
        getOptionLabel={(c) => dialCode(c.code) ?? c.code}
        filterOptions={(options, { inputValue }) => {
          const q = inputValue.trim().toLowerCase().replace(/^\+/, '');
          if (!q) return options;
          return options.filter(
            (c) => c.name.toLowerCase().includes(q)
              || c.code.toLowerCase().startsWith(q)
              || (dialCode(c.code) ?? '').replace('+', '').startsWith(q),
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
                {dialCode(c.code)}
              </Typography>
            </Box>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Code"
            InputProps={{
              ...params.InputProps,
              startAdornment: !selected ? null : (
                <Box component="span" className={flagClass(selected.code)}
                     sx={{ fontSize: '1.15rem', ml: 0.75, mr: 0.25, borderRadius: '2px' }} />
              ),
            }}
          />
        )}
        sx={{ width: 150, flexShrink: 0 }}
      />

      <TextField
        label={label}
        value={number}
        disabled={disabled}
        helperText={helperText}
        onChange={(e) => emit({ country, number: e.target.value })}
        // type="tel" rather than "number": leading zeros and spaces are meaningful in a phone
        // number, and a number input silently discards both.
        type="tel"
        fullWidth
      />
    </Stack>
  );
}
