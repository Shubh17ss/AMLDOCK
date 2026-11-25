import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { useAddressFinder, ADDRESSFINDER_KEY } from '../hooks/useAddressFinder.js';
import { mapAddressFinderResult, formatPropertyAddress } from '../data/addressFinderMeta.js';
import { tokens } from '../theme/theme.js';

/**
 * The property address: a search backed by AddressFinder, with manual entry always reachable.
 *
 * <p>Search mode: the box is deliberately uncontrolled, because the widget writes into
 * `input.value` directly and bypasses React's value tracker, which desyncs a controlled input on
 * the first keystroke. Picking a result fills the structured fields, which are what get saved.
 *
 * <p>Manual mode: a controlled set of structured fields writing straight to the address. It is
 * used when the lookup can't run at all (no key, script blocked, offline, country unknown), and
 * whenever the user chooses it, e.g. the address isn't in the database or the API is failing
 * after the script loaded. The user is never blocked on a third party being reachable.
 *
 * <p>The country only decides which database is searched (and labels Region vs State). The server
 * sets the property's country from the deal's reporting entity regardless of anything sent here.
 *
 * Props:
 *   value:    { addressLine1, addressLine2, suburb, district, region, postcode }
 *   onChange(nextValue): receives the full address object on any change.
 *   country:  'NZ' | 'AU' | null
 */
export function AddressFinderField({ value, onChange, country }) {
  const inputRef = useRef(null);
  // The suggestion list is appended here rather than to <body>, so it can be positioned
  // against the field instead of the page. See styles/addressfinder.css.
  const wrapperRef = useRef(null);
  const { status, error } = useAddressFinder();
  const [picked, setPicked] = useState(null);
  const [manual, setManual] = useState(false);
  // Set when the lookup comes back empty or errors, so the way out is offered, not hidden.
  const [lookupTrouble, setLookupTrouble] = useState(null);

  // The widget is built once per (status, country, mode) and its callback outlives every render
  // in between, so both the handler and the current address are read through refs.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  const lookupUsable = status === 'ready' && Boolean(country);
  const showManual = manual || !lookupUsable;

  useEffect(() => {
    if (showManual || !inputRef.current || !wrapperRef.current) return undefined;

    const widget = new window.AddressFinder.Widget(
      inputRef.current,
      ADDRESSFINDER_KEY,
      country,
      {
        show_locations: false,
        empty_content: 'No matches — keep typing, or enter the address manually below.',
        // Milliseconds of stillness before a lookup fires. The widget's own default is 50,
        // which bills a call per keystroke. At 300 a burst of typing collapses into ~3.
        timeout: 300,
        list_class: 'af_list amldock-af-list',
        item_class: 'af_item amldock-af-item',
        hover_class: 'af_hover amldock-af-hover',
        empty_class: 'af_empty amldock-af-empty',
        container: wrapperRef.current,
      },
    );

    widget.on('result:select', (fullAddress, meta) => {
      setPicked(fullAddress);
      setLookupTrouble(null);
      onChangeRef.current({
        ...valueRef.current,
        ...mapAddressFinderResult(meta, fullAddress, country),
      });
    });
    widget.on('results:update', () => setLookupTrouble(null));
    widget.on('results:empty', () => setLookupTrouble('empty'));
    // Not every widget version emits these; subscribing to an unknown event is harmless.
    widget.on('results:error', () => setLookupTrouble('error'));
    widget.on('error', () => setLookupTrouble('error'));

    return () => widget.destroy?.();
  }, [showManual, country]);

  const enterManually = () => {
    const typed = inputRef.current?.value?.trim();
    if (typed && !value.addressLine1) onChange({ ...value, addressLine1: typed });
    setLookupTrouble(null);
    setManual(true);
  };

  /* ---------- manual entry: structured fields, typed by hand ---------- */

  if (showManual) {
    const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });
    const field = (key, label, props = {}) => (
      <TextField label={label} value={value[key] || ''} onChange={set(key)} fullWidth {...props} />
    );

    return (
      <Stack spacing={1.5}>
        {field('addressLine1', 'Street address', {
          required: true,
          placeholder: 'e.g. 12 Example Street',
          autoComplete: 'address-line1',
        })}
        {field('addressLine2', 'Address line 2', {
          placeholder: 'Unit, level, building (optional)',
          autoComplete: 'address-line2',
        })}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          {field('suburb', 'Suburb')}
          {field('district', 'Town / City', { autoComplete: 'address-level2' })}
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          {field('region', country === 'AU' ? 'State' : 'Region', { autoComplete: 'address-level1' })}
          {field('postcode', 'Postcode', { autoComplete: 'postal-code', inputProps: { inputMode: 'numeric' } })}
        </Stack>

        {lookupUsable ? (
          <Box>
            <Button
              size="small"
              variant="text"
              startIcon={<SearchIcon fontSize="small" />}
              onClick={() => setManual(false)}
              sx={{ px: 0.5 }}
            >
              Search for the address instead
            </Button>
          </Box>
        ) : (
          <Typography variant="caption" sx={{ color: tokens.muted }}>
            {status === 'error'
              ? `Address lookup is unavailable (${error}). Enter the address manually.`
              : 'Address lookup is unavailable — enter the address manually.'}
          </Typography>
        )}
      </Stack>
    );
  }

  /* ---------- search ---------- */

  const summary = formatPropertyAddress(value);

  return (
    <Stack spacing={1}>
      {/* position: relative makes this the offset parent the widget's absolutely-positioned
          list resolves against. */}
      <Box ref={wrapperRef} sx={{ position: 'relative' }}>
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
        />
      </Box>

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

      {lookupTrouble && (
        <Alert
          severity="warning"
          sx={{ py: 0 }}
          action={(
            <Button color="inherit" size="small" onClick={enterManually}>
              Enter manually
            </Button>
          )}
        >
          {lookupTrouble === 'error'
            ? 'The address lookup isn’t responding.'
            : 'No matching address found.'}
        </Alert>
      )}

      {/* A typed-but-unpicked address would leave nothing saved, so say so rather than let the
          user discover it at submission. */}
      {!summary && !lookupTrouble && (
        <Alert severity="info" sx={{ py: 0 }}>
          Choose an address from the suggestions, or enter it manually — typing alone doesn’t save it.
        </Alert>
      )}

      <Box>
        <Button
          size="small"
          variant="text"
          startIcon={<EditOutlinedIcon fontSize="small" />}
          onClick={enterManually}
          sx={{ px: 0.5 }}
        >
          {summary ? 'Edit the address manually' : 'Can’t find the address? Enter it manually'}
        </Button>
      </Box>
    </Stack>
  );
}
