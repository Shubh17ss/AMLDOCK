import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Collapse, FormControl, InputLabel, MenuItem, Select, Stack, TextField,
  Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { updateDeal, updateDealProperty } from '../../../api/deals.js';
import { AddressFinderField } from '../../../components/AddressFinderField.jsx';
import { CountrySelect } from '../../../components/CountrySelect.jsx';
import { RiskRatingChip } from '../../../components/RiskRatingChip.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';
import { useCurrency } from '../../../dashboard/useCurrency.js';
import { useFirmCountry } from '../../../hooks/useFirmCountry.js';
import { PROPERTY_TYPES, reasonsForPropertyType } from '../../../data/propertyTypes.js';
import { RED_FLAGS } from '../../../data/redFlags.js';
import {
  buildDealDetailsPatch, buildPropertyPatch, dtoToForm, sectionGaps,
} from '../create/dealDraftModel.js';
import { FieldGroup } from '../create/SectionShell.jsx';
import { ValuationField } from '../create/ValuationField.jsx';
import { YesNoField } from '../create/YesNoField.jsx';
import { tokens } from '../../../theme/theme.js';

/**
 * The deal record, open to edit.
 *
 * <p>The same questions the create form asks, minus the ones that are answered elsewhere on this
 * screen: the firm and branch (decided once, at creation) and everything about the client — the
 * ID scans, how they were met, the key contact. Those become the people in the ownership chain,
 * and asking them twice would be two places to disagree.
 *
 * <p>Saving writes the deal and the property and nothing else. The client record is deliberately
 * untouched: {@code clientType} is established by the ownership review, and the only thing that
 * keeps it that way is nobody sending one — the server would write one if it arrived.
 */
export function DealDetailsForm({ deal, dealId, form, setForm, dirty, onSaved, readOnly = false }) {
  const qc = useQueryClient();
  const money = useCurrency();
  const { country: firmCountry } = useFirmCountry();
  const { showToast } = useToast();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showGaps, setShowGaps] = useState(false);

  // `form` is owned by the drawer, not by this component. The drawer's body is keyed on the tab
  // so each panel gets its entrance animation, which means this remounts every time the reviewer
  // looks at Notes — state held here would be wiped by the round trip.

  const setField = (key) => (eOrValue) => {
    const v = eOrValue?.target ? eOrValue.target.value : eOrValue;
    setForm((f) => ({ ...f, [key]: v }));
  };

  const setNested = (group, key) => (eOrValue) => {
    const v = eOrValue?.target ? eOrValue.target.value : eOrValue;
    setForm((f) => ({ ...f, [group]: { ...f[group], [key]: v } }));
  };

  /** The address field emits the whole property object at once. */
  const setProperty = (next) => {
    setForm((f) => ({ ...f, property: { ...f.property, ...next } }));
  };

  const propertyType = form.property.propertyType;
  const reasons = reasonsForPropertyType(propertyType);

  // A reason belongs to a property type, so one that no longer fits has to go. '' rather than
  // null: the API reads an empty string as "clear this" and would ignore null.
  useEffect(() => {
    if (!form.property.reasonForSelling) return;
    if (reasons.some((r) => r.value === form.property.reasonForSelling)) return;
    setNested('property', 'reasonForSelling')('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyType]);

  // Sections 2, 3 and 5 are exactly this form's field set. Section 4 is excluded by not asking
  // for it, rather than by filtering its answers back out.
  const gaps = useMemo(
    () => [...sectionGaps(2, form), ...sectionGaps(3, form), ...sectionGaps(5, form)],
    [form],
  );

  const handleSave = async () => {
    if (gaps.length > 0) { setShowGaps(true); return; }
    setSaving(true);
    setError(null);
    try {
      // Property first: the deal patch is answered with a fresh DealDto carrying the risk rating
      // the server has just re-derived, so it has to be the later of the two.
      await updateDealProperty(dealId, buildPropertyPatch(form));
      const dto = await updateDeal(dealId, buildDealDetailsPatch(form));
      // Seeded rather than refetched: the response is the same DealDto shape getDeal returns, so
      // the header chips and the property band update without a flash.
      qc.setQueryData(['deals', dealId], dto);
      // A save is auditable. The notes thread is not touched from here: this form no longer
      // carries the deal's opening note, precisely so that saving these fields cannot rewrite it.
      qc.invalidateQueries({ queryKey: ['audit', 'deal', dealId] });
      // The prefix, not ['deals','list']: the dashboards keep their own deals queries and were
      // left stale by naming only the register's key.
      qc.invalidateQueries({ queryKey: ['deals'] });
      // The mirror of useOwnershipTree's invalidate, which busts the deal on every node write.
      // The traffic runs the other way too now: answering yes to a trust in the beneficial
      // ownership puts a TRUST node on the structure, and this form sits on top of the tree that
      // would otherwise go on showing the state before the answer.
      qc.invalidateQueries({ queryKey: ['ownership', dealId] });
      onSaved?.(dto);
      showToast({ severity: 'success', message: 'Deal updated' });
    } catch (e) {
      setError(e.response?.data?.message || 'Could not save these details');
    } finally {
      setSaving(false);
    }
  };

  const min = form.valuationMin === '' ? null : Number(form.valuationMin);
  const max = form.valuationMax === '' ? null : Number(form.valuationMax);
  const rangeInverted = min != null && max != null && max < min;

  return (
    <Stack spacing={3}>
      {readOnly && (
        <Alert severity="info" sx={{ py: 0.5 }}>
          Read-only — this deal is not open to changes from you.
        </Alert>
      )}

      {/* A disabled <fieldset> disables every control inside it natively, which reaches the
          address finder's own inputs without threading a prop through each one. */}
      <Stack
        spacing={3}
        component="fieldset"
        disabled={readOnly}
        sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
      >
        <FieldGroup title="Address">
          <AddressFinderField
            value={form.property}
            onChange={setProperty}
            country={form.property.country || firmCountry}
          />
        </FieldGroup>

        <FieldGroup title="Classification">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl fullWidth required>
              <InputLabel id="deal-property-type-label">Property type</InputLabel>
              <Select
                labelId="deal-property-type-label"
                label="Property type"
                value={propertyType || ''}
                onChange={setNested('property', 'propertyType')}
              >
                {PROPERTY_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required disabled={readOnly || !propertyType}>
              <InputLabel id="deal-reason-label">Reason for selling</InputLabel>
              <Select
                labelId="deal-reason-label"
                label="Reason for selling"
                // Clamped, not just cleared by the effect above: the effect runs after the
                // render that changed the type, and MUI warns about an out-of-range value in
                // the frame between the two.
                value={reasons.some((r) => r.value === form.property.reasonForSelling)
                  ? form.property.reasonForSelling
                  : ''}
                onChange={setNested('property', 'reasonForSelling')}
              >
                {reasons.map((r) => (
                  <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </FieldGroup>

        <FieldGroup title="Transaction purpose">
          <TextField
            label="Transaction purpose"
            value={form.transactionPurpose}
            onChange={setField('transactionPurpose')}
            multiline
            minRows={3}
            fullWidth
            helperText="In your client's own words, as far as you can tell it."
          />
        </FieldGroup>

        <FieldGroup title="Compliance checks">
          <YesNoField
            label="Is there a trust involved in the beneficial ownership?"
            value={form.trustInvolved}
            onChange={setField('trustInvolved')}
            required
          />
          <YesNoField
            label="Is the property being on-sold quickly?"
            value={form.onSoldQuickly}
            onChange={setField('onSoldQuickly')}
            required
            warnOnYes="This raises the deal's risk rating to High."
          />
          <CountrySelect
            label="Foreign exposure"
            value={form.foreignExposureCountry || null}
            onChange={(code) => setField('foreignExposureCountry')(code ?? '')}
            noneOption
            required
          />
        </FieldGroup>

        <FieldGroup title="Red flag">
          <YesNoField
            label="Is there a red flag on this deal?"
            value={form.redFlagPresent}
            onChange={setField('redFlagPresent')}
            required
            warnOnYes="Say which one below — compliance reads it first."
          />
          <Collapse in={form.redFlagPresent === true} unmountOnExit>
            <FormControl fullWidth>
              <InputLabel id="deal-red-flag-label">Which red flag</InputLabel>
              <Select
                labelId="deal-red-flag-label"
                label="Which red flag"
                value={form.redFlag || ''}
                onChange={setField('redFlag')}
              >
                {RED_FLAGS.map((f) => (
                  <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Collapse>
        </FieldGroup>

        <FieldGroup title="Property value">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <ValuationField
              label="Minimum value"
              value={form.valuationMin}
              onChange={setField('valuationMin')}
              currencyLabel={money.label}
            />
            <ValuationField
              label="Maximum value"
              value={form.valuationMax}
              onChange={setField('valuationMax')}
              currencyLabel={money.label}
              helperText={rangeInverted ? 'Must be at or above the minimum' : undefined}
            />
          </Stack>
        </FieldGroup>
      </Stack>

      {/* The server owns this — it is re-derived on every save, and shown here so the effect of
          the on-sold answer is visible where the answer is given. */}
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="caption" sx={{ color: tokens.muted }}>Risk rating</Typography>
        <RiskRatingChip rating={deal.riskRating} />
      </Stack>

      {showGaps && gaps.length > 0 && (
        <Alert severity="warning" onClose={() => setShowGaps(false)}>
          Still needed before this can be saved:
          <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
            {gaps.map((g) => <li key={g}>{g}</li>)}
          </Box>
        </Alert>
      )}

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {!readOnly && (
        <Box>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            // Not gated on `gaps`: pressing it says what is missing, which beats a dead button
            // the reviewer has to reverse-engineer.
            disabled={saving || !dirty}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </Box>
      )}
    </Stack>
  );
}
