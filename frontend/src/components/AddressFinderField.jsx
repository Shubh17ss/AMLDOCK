import { useEffect, useRef, useState } from 'react';
import { Alert, Stack, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useAddressFinder, ADDRESSFINDER_KEY } from '../hooks/useAddressFinder.js';
import { mapAddressFinderResult, formatPropertyAddress } from '../data/addressFinderMeta.js';
import { tokens } from '../theme/theme.js';

/**
 * The property address: one input, backed by AddressFinder.
 *
 * <p>Two modes, one box. When the lookup is available the box is a *search* — deliberately
 * uncontrolled, because the widget writes into `input.value` directly and bypasses React's value
 * tracker, which desyncs a controlled input on the first keystroke. Picking a result fills the
 * structured fields underneath, which are what actually get saved.
 *
 * <p>When the lookup can't run — no key configured, script blocked, offline, or the firm's
 * country not resolved yet — the same box becomes a plain controlled text field writing to
 * `addressLine1`. The broker is never blocked on a third party being reachable.
 *
 * <p>The country only decides which database is searched. The server sets the property's country
 * from the deal's reporting entity regardless of anything sent from here.
 *
 * Props:
 *   value:    { addressLine1, addressLine2, suburb, district, region, postcode }
 *   onChange(nextValue): receives the full address object on any change.
 *   country:  'NZ' | 'AU' | null
 */
export function AddressFinderField({ value, onChange, country }) {
  const inputRef = useRef(null);
  const { status, error } = useAddressFinder();
  const [picked, setPicked] = useState(null);

  // The widget is built once per (status, country) and its callback outlives every render in
  // between, so both the handler and the current address are read through refs. Listing them as
  // effect deps would tear the widget down on every keystroke; closing over them directly would
  // hand the callback whatever they were when it was created.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  const lookupUsable = status === 'ready' && Boolean(country);

  useEffect(() => {
    if (!lookupUsable || !inputRef.current) return undefined;

    const widget = new window.AddressFinder.Widget(
      inputRef.current,
      ADDRESSFINDER_KEY,
      country,
      { show_locations: false, empty_content: 'No matches — keep typing, or type the address in full.' },
    );

    widget.on('result:select', (fullAddress, meta) => {
      setPicked(fullAddress);
      onChangeRef.current({
        ...valueRef.current,
        ...mapAddressFinderResult(meta, fullAddress, country),
      });
    });

    return () => widget.destroy?.();
  }, [lookupUsable, country]);

  /* ---------- fallback: the same box, typed by hand ---------- */

  if (!lookupUsable) {
    return (
      <Stack spacing={1}>
        <TextField
          label="Property address"
          placeholder="Street, suburb, city, postcode"
          value={value.addressLine1 || ''}
          onChange={(e) => onChange({ ...value, addressLine1: e.target.value })}
          fullWidth
          required
          multiline
          minRows={2}
        />
        <Typography variant="caption" sx={{ color: tokens.muted }}>
          {status === 'error'
            ? `Address lookup is unavailable (${error}). Type the full address.`
            : 'Address lookup is unavailable — type the full address.'}
        </Typography>
      </Stack>
    );
  }

  const summary = formatPropertyAddress(value);

  return (
    <Stack spacing={1}>
      <TextField
        // inputRef, not ref: the widget binds to the native <input>, and `ref` would hand it
        // MUI's wrapper div, which it cannot attach to.
        inputRef={inputRef}
        label="Property address"
        placeholder="Start typing a street address…"
        defaultValue={summary}
        fullWidth
        required
        autoComplete="off"
        InputProps={{ startAdornment: <SearchIcon sx={{ color: tokens.muted, mr: 1 }} /> }}
      />

      {picked ? (
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <CheckCircleIcon sx={{ color: tokens.approved, fontSize: '1.05rem', mt: '2px' }} />
          <Typography variant="body2" sx={{ color: tokens.muted }}>
            {picked}
          </Typography>
        </Stack>
      ) : summary ? (
        <Typography variant="body2" sx={{ color: tokens.muted }}>{summary}</Typography>
      ) : (
        <Typography variant="caption" sx={{ color: tokens.muted }}>
          Pick a result to confirm the address.
        </Typography>
      )}

      {/* A typed-but-unpicked address would leave nothing saved, so say so rather than let the
          broker discover it at handover. */}
      {!summary && (
        <Alert severity="info" sx={{ py: 0 }}>
          Choose an address from the suggestions — typing alone doesn’t save it.
        </Alert>
      )}
    </Stack>
  );
}
