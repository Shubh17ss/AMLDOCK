import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

const ISO = 'YYYY-MM-DD';

/**
 * A date input that reads and types day-first — DD/MM/YYYY — whatever the browser's locale.
 *
 * <p>Replaces `<TextField type="date">`, whose display order is the operating system's choice:
 * on a machine set to US English it shows 09/26/2026, which here reads as the 9th of the 26th
 * month. The value is unchanged from the native input — a `yyyy-mm-dd` string, '' when empty —
 * so nothing behind a form that switches to this has to change.
 *
 * Props:
 *   value: 'yyyy-mm-dd' or ''
 *   onChange: (value) => void — the same string shape; '' when cleared or not yet a whole date
 *   label, required, helperText, fullWidth, disabled, minDate, maxDate ('yyyy-mm-dd')
 */
export function DateField({
  value, onChange, label, required = false, helperText, fullWidth = false, disabled = false,
  minDate, maxDate, size,
}) {
  // The picker's own value, kept here so a half-typed date survives: the parent hears '' until
  // the date is whole, and handing that back as null would wipe what is being typed.
  const [inner, setInner] = useState(() => toDay(value));
  useEffect(() => {
    const current = inner && inner.isValid() ? inner.format(ISO) : '';
    if ((value || '') !== current) setInner(toDay(value));
    // Only an outside change of value should resync; our own edits already match it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <DatePicker
      label={label}
      format="DD/MM/YYYY"
      value={inner}
      onChange={(d) => {
        setInner(d);
        onChange(d && d.isValid() ? d.format(ISO) : '');
      }}
      disabled={disabled}
      minDate={minDate ? dayjs(minDate) : undefined}
      maxDate={maxDate ? dayjs(maxDate) : undefined}
      slotProps={{
        textField: { required, helperText, fullWidth, size },
        field: { clearable: !required },
      }}
    />
  );
}

function toDay(value) {
  if (!value) return null;
  const d = dayjs(value);
  return d.isValid() ? d : null;
}
