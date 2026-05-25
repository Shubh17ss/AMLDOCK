import { useMemo } from 'react';
import { Autocomplete, FormControl, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import {
  COUNTRIES, districtsForRegion, regionsForCountry, suburbsForDistrict,
} from '../data/nzLocations.js';

/**
 * Cascading NZ address fields:
 *   Country (locked to NZ in MVP-1) → Region → District/City → Suburb (free-typable)
 * Plus address line 1/2 and postcode as free-text.
 *
 * Props:
 *   value:  { addressLine1, addressLine2, suburb, district, region, country, postcode }
 *   onChange(nextValue): receives the full address object on any change.
 *   required?: { region?: boolean, district?: boolean }
 */
export function AddressCascadingFields({ value, onChange, required = {} }) {
  const country = value.country || 'NZ';
  const region = value.region || '';
  const district = value.district || '';

  const regions = useMemo(() => regionsForCountry(country), [country]);
  const districts = useMemo(() => districtsForRegion(region), [region]);
  const suburbs = useMemo(() => suburbsForDistrict(district), [district]);

  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2}>
        <FormControl sx={{ minWidth: 200 }} disabled>
          <InputLabel id="country-label">Country</InputLabel>
          <Select labelId="country-label" label="Country" value={country}>
            {COUNTRIES.map((c) => <MenuItem key={c.code} value={c.code}>{c.name}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl fullWidth required={required.region}>
          <InputLabel id="region-label">Region</InputLabel>
          <Select labelId="region-label" label="Region"
                  value={region}
                  onChange={(e) => set({ region: e.target.value, district: '', suburb: '' })}>
            {regions.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>

      <Stack direction="row" spacing={2}>
        <FormControl fullWidth required={required.district} disabled={!region}>
          <InputLabel id="district-label">District / City</InputLabel>
          <Select labelId="district-label" label="District / City"
                  value={district}
                  onChange={(e) => set({ district: e.target.value, suburb: '' })}>
            {districts.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
          </Select>
        </FormControl>
        <Autocomplete
          fullWidth
          freeSolo
          options={suburbs}
          value={value.suburb || ''}
          onInputChange={(_, newValue) => set({ suburb: newValue })}
          renderInput={(params) => (
            <TextField {...params} label="Suburb" placeholder={district ? 'Pick or type a suburb' : ''} />
          )}
        />
      </Stack>

      <TextField label="Address line 1" value={value.addressLine1 || ''}
                 onChange={(e) => set({ addressLine1: e.target.value })} required />
      <TextField label="Address line 2" value={value.addressLine2 || ''}
                 onChange={(e) => set({ addressLine2: e.target.value })} />
      <TextField label="Postcode" value={value.postcode || ''}
                 onChange={(e) => set({ postcode: e.target.value })} sx={{ maxWidth: 200 }} />
    </Stack>
  );
}
