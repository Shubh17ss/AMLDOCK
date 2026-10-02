import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
  Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { getDealSale } from '../../api/deals.js';
import { MoneyField } from '../../components/MoneyField.jsx';
import { SegmentedField } from '../../components/SegmentedField.jsx';
import { useCurrency } from '../../dashboard/useCurrency.js';
import { tokens } from '../../theme/theme.js';

const emptyUnit = () => ({ unitName: '', salePrice: '' });

/** Digits-only string → number, or null for an unanswered field. */
const amount = (digits) => (digits === '' || digits == null ? null : Number(digits));

/**
 * What the deal finished as, asked while closing it.
 *
 * <p>A second dialog rather than another field on the status list: closing is the one move that
 * records an outcome as well as a position, and burying "did it sell, and for how much" among a
 * list of statuses would make it look optional.
 *
 * <p>A development is asked differently because it is sold differently — a subdivision changes
 * hands as units, each with its own name and price, and one figure would either be a sum nobody
 * can break down or the first unit standing in for all of them. The server decides which of the
 * two shapes it will accept from the deal's own property type, so this dialog cannot make a deal
 * answer the wrong question by being wrong about it.
 *
 * <p>Pre-filled from whatever the last close recorded, because reopening a closed deal exists so
 * these answers can be corrected — starting from blank would make a correction a re-entry.
 */
export function CloseDealDialog({ open, dealId, isDevelopment, onClose, onSubmit, submitting }) {
  const money = useCurrency();
  const [sold, setSold] = useState(null);
  const [salePrice, setSalePrice] = useState('');
  const [units, setUnits] = useState([emptyUnit()]);
  const [error, setError] = useState(null);

  // Only while the dialog is open, and only for a deal that could already have been closed.
  const saleQ = useQuery({
    queryKey: ['dealSale', dealId],
    queryFn: () => getDealSale(dealId),
    enabled: open && dealId != null,
  });
  const recorded = saleQ.data;

  useEffect(() => {
    if (!open) return;
    setError(null);
    // Null, not false: an unanswered question shows neither pill lit, so nobody closes a deal
    // having accidentally agreed the property did not sell.
    setSold(recorded?.propertySold ?? null);
    setSalePrice(recorded?.salePrice != null ? String(recorded.salePrice) : '');
    setUnits(recorded?.units?.length
      ? recorded.units.map((u) => ({ unitName: u.unitName, salePrice: String(u.salePrice) }))
      : [emptyUnit()]);
  }, [open, recorded]);

  const patchUnit = (i, patch) =>
    setUnits((rows) => rows.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  const addUnit = () => setUnits((rows) => [...rows, emptyUnit()]);
  const removeUnit = (i) => setUnits((rows) => rows.filter((_, n) => n !== i));

  const filledUnits = useMemo(
    () => units.filter((u) => u.unitName.trim() !== '' && u.salePrice !== ''),
    [units],
  );

  const unitTotal = useMemo(
    () => filledUnits.reduce((t, u) => t + Number(u.salePrice), 0),
    [filledUnits],
  );

  /*
   * The same rules the server enforces, said before they are broken rather than after.
   *
   * A development needs every started row finished, not merely one good row somewhere: a
   * half-typed unit is a figure the reviewer meant to enter, and silently dropping it would
   * close the deal for less than they think.
   */
  const unitsReady = filledUnits.length > 0 && filledUnits.length === units.length;
  const ready = sold === false
    || (sold === true && (isDevelopment ? unitsReady : salePrice !== ''));

  const submit = (e) => {
    e.preventDefault();
    if (!ready || submitting) return;
    setError(null);
    onSubmit({
      propertySold: sold,
      salePrice: sold && !isDevelopment ? amount(salePrice) : null,
      units: sold && isDevelopment
        ? filledUnits.map((u) => ({ unitName: u.unitName.trim(), salePrice: amount(u.salePrice) }))
        : [],
    }).catch((err) => setError(err.response?.data?.message || 'Could not close the deal'));
  };

  const close = () => { if (!submitting) onClose(); };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>Close this deal</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {recorded?.propertySold != null && (
              <Alert severity="info">
                This deal has been closed before. Whatever you record now replaces what is there.
              </Alert>
            )}

            <SegmentedField
              label="Is the property sold?"
              value={sold}
              onChange={setSold}
              nullable
              disabled={submitting}
            />

            {sold === true && !isDevelopment && (
              <MoneyField
                label="Transaction value"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                currencyLabel={money.label}
                required
                disabled={submitting}
              />
            )}

            {sold === true && isDevelopment && (
              <Box>
                <Typography sx={{ fontSize: '0.8rem', color: tokens.ink, mb: 0.25 }}>
                  What each unit sold for
                </Typography>
                {/* A development is sold as flats or lots, so one figure would not describe it. */}
                <Typography variant="caption" sx={{ color: tokens.muted, display: 'block', mb: 1.5 }}>
                  This property is a development, so it is recorded unit by unit.
                </Typography>

                <Stack spacing={1.5}>
                  {units.map((u, i) => (
                    // Keyed by position: the rows carry no id until they are saved, and a close
                    // replaces the whole set rather than editing rows in place.
                    <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                      <TextField
                        label="Unit name"
                        value={u.unitName}
                        onChange={(e) => patchUnit(i, { unitName: e.target.value })}
                        disabled={submitting}
                        sx={{ flex: 1 }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <MoneyField
                          label="Transaction value"
                          value={u.salePrice}
                          onChange={(e) => patchUnit(i, { salePrice: e.target.value })}
                          currencyLabel={money.label}
                          disabled={submitting}
                        />
                      </Box>
                      <Tooltip title={units.length > 1 ? 'Remove this unit' : 'At least one unit is needed'}>
                        {/* A span so the tooltip still shows while the button is disabled. */}
                        <span>
                          <IconButton
                            onClick={() => removeUnit(i)}
                            disabled={submitting || units.length <= 1}
                            sx={{ mt: 1 }}
                            aria-label={`Remove unit ${i + 1}`}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  ))}
                </Stack>

                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.5 }}>
                  <Button startIcon={<AddIcon />} onClick={addUnit} disabled={submitting}>
                    Add unit
                  </Button>
                  {filledUnits.length > 0 && (
                    <Typography variant="caption" sx={{ color: tokens.muted }}>
                      {filledUnits.length} {filledUnits.length === 1 ? 'unit' : 'units'} ·
                      {' '}{money.formatWithCode(unitTotal)}
                    </Typography>
                  )}
                </Stack>
              </Box>
            )}

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={submitting}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={!ready || submitting}>
            {submitting ? 'Closing…' : 'Close deal'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
