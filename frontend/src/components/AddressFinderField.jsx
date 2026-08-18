import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Collapse, Stack, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { AddressCascadingFields } from './AddressCascadingFields.jsx';
import { useAddressFinder, ADDRESSFINDER_KEY } from '../hooks/useAddressFinder.js';
import { mapAddressFinderNz } from '../data/addressFinderNormalise.js';
import { tokens } from '../theme/theme.js';

/**
 * Property address: an AddressFinder lookup over the existing cascading fields.
 *
 * The search box is deliberately **uncontrolled**. The widget writes into `input.value`
 * directly, bypassing React's value tracker, so binding a `value` prop to it desyncs the
 * input on the very first keystroke. It is treated as a pure search box; the parsed result
 * lands in real form state and is rendered by the controlled fields below, which stay the
 * authoritative editable copy. That also makes the manual fallback free — the broker can
 * always open the fields and type, whatever the widget did.
 *
 * Props:
 *   value:  { addressLine1, addressLine2, suburb, district, region, country, postcode }
 *   onChange(nextValue): receives the full address object on any change.
 *   required?: { region?: boolean, district?: boolean }
 */
export function AddressFinderField({ value, onChange, required = {} }) {
  const inputRef = useRef(null);
  const widgetRef = useRef(null);
  const { status, error } = useAddressFinder();
  const [manualOpen, setManualOpen] = useState(false);
  const [picked, setPicked] = useState(null);   // the single-line address last selected
  const [unmatched, setUnmatched] = useState(null);

  // The widget is built once and its callback lives for the component's lifetime, so both the
  // handler and the current address are read through refs. Listing them as effect deps would
  // tear down and rebuild the widget on every keystroke; closing over them directly would hand
  // the callback whatever they were when the widget was created.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (status !== 'ready' || !inputRef.current) return undefined;

    const widget = new window.AddressFinder.Widget(
      inputRef.current,
      ADDRESSFINDER_KEY,
      'NZ',
      { show_locations: false, empty_content: 'No matches — use "Enter address manually" below.' },
    );
    widgetRef.current = widget;

    widget.on('result:select', (fullAddress, meta) => {
      const mapped = mapAddressFinderNz(meta, fullAddress);
      const { unmatched: misses, ...address } = mapped;
      setPicked(fullAddress);
      // A region or district AddressFinder spells differently from our own list still gets
      // stored — the columns are free text. But the matching Select will read as empty, so
      // say so rather than let the broker think the lookup silently failed.
      setUnmatched(Object.keys(misses).length ? misses : null);
      if (Object.keys(misses).length) setManualOpen(true);
      onChangeRef.current({ ...valueRef.current, ...address });
    });

    return () => {
      widget.destroy?.();
      widgetRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const lookupUsable = status === 'ready';
  const summary = [value.addressLine1, value.suburb, value.district, value.region, value.postcode]
    .filter(Boolean).join(', ');

  return (
    <Stack spacing={2}>
      {lookupUsable && (
        <TextField
          // inputRef, not ref: the widget binds to the native <input>, and `ref` would hand it
          // MUI's wrapper div, which it cannot attach to.
          inputRef={inputRef}
          label="Search for the property address"
          placeholder="Start typing a street address…"
          defaultValue=""
          fullWidth
          autoComplete="off"
          InputProps={{
            startAdornment: <SearchIcon sx={{ color: tokens.muted, mr: 1 }} />,
          }}
          helperText="Pick a result to fill the address below, or enter it manually."
        />
      )}

      {status === 'error' && (
        <Alert severity="warning">
          Address lookup is unavailable ({error}). Enter the address manually below.
        </Alert>
      )}

      {picked && (
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <CheckCircleIcon sx={{ color: tokens.approved, fontSize: '1.1rem', mt: '2px' }} />
          <Typography variant="body2" sx={{ color: tokens.muted }}>
            Using <Box component="span" sx={{ color: tokens.ink, fontWeight: 600 }}>{picked}</Box>
          </Typography>
        </Stack>
      )}

      {unmatched && (
        <Alert severity="info">
          We couldn't match{' '}
          {[unmatched.region && `the region "${unmatched.region}"`,
            unmatched.district && `the district "${unmatched.district}"`]
            .filter(Boolean).join(' or ')}{' '}
          to our list. The address is saved, but please pick the closest option below.
        </Alert>
      )}

      {/* The manual fields are the authoritative copy — always reachable, pre-opened when
          nothing has been picked yet so the form never looks empty. */}
      {lookupUsable && (
        <Button
          onClick={() => setManualOpen((o) => !o)}
          startIcon={<EditIcon />}
          size="small"
          sx={{ alignSelf: 'flex-start' }}
        >
          {manualOpen ? 'Hide address fields' : summary ? 'Edit address fields' : 'Enter address manually'}
        </Button>
      )}

      <Collapse in={manualOpen || !lookupUsable} timeout="auto" unmountOnExit>
        <AddressCascadingFields value={value} onChange={onChange} required={required} />
      </Collapse>

      {!manualOpen && lookupUsable && summary && (
        <Typography variant="body2" sx={{ color: tokens.muted }}>{summary}</Typography>
      )}
    </Stack>
  );
}
