import {
  Box, Divider, FormControl, FormControlLabel, FormLabel, InputLabel, MenuItem, Radio,
  RadioGroup, Select, Stack, TextField, Typography,
} from '@mui/material';
import {
  ID_DOCUMENT_TYPES, NODE_TYPES, NOMINEE_OPTIONS, PERSON_ROLES,
  TRUST_HOLDING_COMPLEXITY, TRUST_TYPES,
} from '../../api/ownership.js';
import { CountrySelect } from '../../components/CountrySelect.jsx';
import { PhoneField } from '../../components/PhoneField.jsx';
import { tokens } from '../../theme/theme.js';

/** The registration number's name changes with the jurisdiction; the field does not. */
function businessNumberLabel(country) {
  if (country === 'NZ') return 'New Zealand business number (NZBN)';
  if (country === 'AU') return 'Australian business number (ABN)';
  return 'Registration number';
}

const YES_NO = [{ value: true, label: 'Yes' }, { value: false, label: 'No' }];

/** What the node's display name is called, per type. It is the same column either way. */
const NAME_LABEL = {
  INDIVIDUAL: 'Name',
  PRIVATE_COMPANY: 'Company name',
  LISTED_COMPANY: 'Company name',
  TRUSTEE_COMPANY: 'Company name',
  TRUST: 'Trust name',
  PARTNERSHIP: 'Partnership name',
  LIMITED_PARTNERSHIP: 'Partnership name',
  INCORPORATED_SOCIETY: 'Society name',
  CHARITY: 'Charity name',
  GOVERNMENT_AGENCY: 'Agency name',
  DECEASED_ESTATE: 'Estate name',
};

/**
 * Types whose only extra field is where they are governed from.
 *
 * They are asked for a jurisdiction rather than a country of incorporation: none of them is
 * incorporated, and a deceased estate least of all.
 */
const JURISDICTION_ONLY = ['INCORPORATED_SOCIETY', 'CHARITY', 'GOVERNMENT_AGENCY', 'DECEASED_ESTATE'];

/** Types that carry a free-text Reference. The rest have no use the user has named. */
const WITH_REFERENCE = ['INDIVIDUAL', 'PARTNERSHIP'];

/**
 * One yes/no question, rendered inline.
 *
 * Takes `options` for the one question that has three answers — nominee director/shareholder,
 * where "Not asked" is the default because a YES carries a risk consequence and a defaulted NO
 * would be a negative answer nobody gave.
 */
function YesNoField({ label, value, onChange, options = YES_NO, helper }) {
  const isTriState = options !== YES_NO;
  // Radio values cross the DOM as strings, so booleans have to be mapped back on the way out.
  const toValue = (raw) => (isTriState ? raw : raw === 'true');
  const current = value === undefined || value === null
    ? (isTriState ? options[0].value : false)
    : value;

  return (
    <FormControl>
      <FormLabel sx={{ fontSize: '0.875rem' }}>{label}</FormLabel>
      <RadioGroup row value={String(current)} onChange={(e) => onChange(toValue(e.target.value))}>
        {options.map((o) => (
          <FormControlLabel key={String(o.value)} value={String(o.value)}
                            control={<Radio size="small" />} label={o.label} />
        ))}
      </RadioGroup>
      {helper && (
        <Typography variant="caption" sx={{ color: tokens.muted, mt: -0.5 }}>{helper}</Typography>
      )}
    </FormControl>
  );
}

/**
 * The per-type fields of an ownership node. `value` is the form-state object and `onChange`
 * receives the merged next value; `includeTypeSelector` is true on create dialogs and false in
 * the edit pane, where changing a node's type is rarely what someone means to do.
 *
 * <p>An individual's form spans two records, and the caption says so out loud. Contact details,
 * occupation and source of funds belong to the <em>person</em> and are shared with every deal
 * they appear on; type, notes and reference are what this deal says about them. An officer who
 * does not know which is which will eventually edit a closed deal's evidence by accident.
 */
export function NodeFormFields({ value, onChange, includeTypeSelector = true }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const setPerson = (patch) => onChange({ ...value, person: { ...(value.person ?? {}), ...patch } });
  const person = value.person ?? {};

  return (
    <Stack spacing={2}>
      {includeTypeSelector && (
        <FormControl required>
          <InputLabel id="node-type-label">Node type</InputLabel>
          <Select labelId="node-type-label" label="Node type"
                  value={value.nodeType ?? ''}
                  onChange={(e) => set({ nodeType: e.target.value })}>
            {NODE_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
          </Select>
        </FormControl>
      )}
      <TextField label={NAME_LABEL[value.nodeType] ?? 'Display name'}
                 value={value.displayName ?? ''}
                 onChange={(e) => set({ displayName: e.target.value })} required />

      {value.nodeType === 'INDIVIDUAL' && (
        <>
          <FormControl>
            <InputLabel id="person-role-label">Type</InputLabel>
            <Select labelId="person-role-label" label="Type"
                    value={value.personRole ?? ''}
                    onChange={(e) => set({ personRole: e.target.value || null })}>
              <MenuItem value=""><em>Not stated</em></MenuItem>
              {PERSON_ROLES.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
            </Select>
          </FormControl>

          <Divider />
          <Box>
            <Typography variant="subtitle2">About this person</Typography>
            <Typography variant="caption" sx={{ color: tokens.muted }}>
              Shared with every deal this person appears on — editing here changes what those
              deals show.
            </Typography>
          </Box>

          <TextField label="Email address" type="email" value={person.email ?? ''}
                     onChange={(e) => setPerson({ email: e.target.value })} />

          <PhoneField
            value={{ country: person.phoneCountry ?? null, number: person.phoneNumber ?? '' }}
            onChange={({ country, number }) =>
              setPerson({ phoneCountry: country, phoneNumber: number })}
          />

          <TextField label="Occupation" value={person.occupation ?? ''}
                     onChange={(e) => setPerson({ occupation: e.target.value })} />

          <TextField label="Source of wealth / funds" value={person.sourceOfFunds ?? ''}
                     onChange={(e) => setPerson({ sourceOfFunds: e.target.value })}
                     multiline minRows={2}
                     placeholder="Salary, sale of a property, inheritance — and how it was evidenced." />

          <Divider />

          {/* The node's own column, not the person's. Extraction keeps the two in step through
              refreshExtractedIndividual, and reading one while writing the other would make an
              edit look like it had not taken. */}
          <TextField label="Date of birth" type="date" InputLabelProps={{ shrink: true }}
                     value={value.dateOfBirth ?? ''}
                     onChange={(e) => set({ dateOfBirth: e.target.value })} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel id="id-doc-type-label">ID document type</InputLabel>
              <Select labelId="id-doc-type-label" label="ID document type"
                      value={value.idDocumentType ?? ''}
                      onChange={(e) => set({ idDocumentType: e.target.value || null })}>
                <MenuItem value=""><em>None</em></MenuItem>
                {ID_DOCUMENT_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="ID document number" value={value.idDocumentNumber ?? ''}
                       onChange={(e) => set({ idDocumentNumber: e.target.value })} fullWidth />
            <TextField label="Country" placeholder="NZ" value={value.idDocumentCountry ?? ''}
                       onChange={(e) => set({ idDocumentCountry: e.target.value })}
                       sx={{ width: { sm: 120 } }} />
          </Stack>
        </>
      )}

      {value.nodeType === 'PRIVATE_COMPANY' && (
        <>
          <CountrySelect
            label="Country of incorporation"
            value={value.jurisdictionCountry ?? null}
            onChange={(code) => set({ jurisdictionCountry: code })}
          />

          <TextField label="Incorporation number" value={value.companyNumber ?? ''}
                     onChange={(e) => set({ companyNumber: e.target.value })} />

          {/* One field, three names. The number a company is registered under is called
              something different in each jurisdiction, but it is the same fact and the same
              column — only the label follows the country. */}
          <TextField label={businessNumberLabel(value.jurisdictionCountry)}
                     value={value.businessNumber ?? ''}
                     onChange={(e) => set({ businessNumber: e.target.value })} />

          <YesNoField
            label="Does the company have a constitution?"
            value={value.companyHasConstitution}
            onChange={(v) => set({ companyHasConstitution: v })}
          />

          <YesNoField
            label="Nominee director / shareholder?"
            value={value.nomineeStatus ?? 'NOT_ASKED'}
            onChange={(v) => set({ nomineeStatus: v })}
            options={NOMINEE_OPTIONS}
            helper="Answering yes sets this deal's risk to High."
          />

          <YesNoField
            label="Complex ownership structure?"
            value={value.companyComplexOwnership}
            onChange={(v) => set({ companyComplexOwnership: v })}
            helper="Answering yes sets this deal's risk to High."
          />

          <YesNoField
            label="Used for personal assets?"
            value={value.companyPersonalAssets}
            onChange={(v) => set({ companyPersonalAssets: v })}
          />

          <YesNoField
            label="Is a new developer?"
            value={value.companyNewDeveloper}
            onChange={(v) => set({ companyNewDeveloper: v })}
          />
        </>
      )}

      {value.nodeType === 'TRUST' && (
        <>
          <FormControl>
            <InputLabel id="trust-type-label">Trust type</InputLabel>
            <Select labelId="trust-type-label" label="Trust type"
                    value={value.trustType ?? ''}
                    onChange={(e) => set({ trustType: e.target.value || null })}>
              <MenuItem value=""><em>Not stated</em></MenuItem>
              {TRUST_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </Select>
          </FormControl>

          <YesNoField
            label="Is the trust a discretionary trust?"
            value={value.trustDiscretionary}
            onChange={(v) => set({ trustDiscretionary: v })}
          />

          <FormControl>
            <InputLabel id="trust-holding-label">Trust holding complexity</InputLabel>
            <Select labelId="trust-holding-label" label="Trust holding complexity"
                    value={value.trustHoldingComplexity ?? ''}
                    onChange={(e) => set({ trustHoldingComplexity: e.target.value || null })}>
              <MenuItem value=""><em>Not stated</em></MenuItem>
              {TRUST_HOLDING_COMPLEXITY.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </Select>
            <Typography variant="caption" sx={{ color: tokens.muted, mt: 0.5 }}>
              An extensive / diverse asset portfolio sets this deal's risk to High.
            </Typography>
          </FormControl>
        </>
      )}

      {value.nodeType === 'TRUSTEE_COMPANY' && (
        <>
          <TextField label="Incorporation number" value={value.companyNumber ?? ''}
                     onChange={(e) => set({ companyNumber: e.target.value })} />
          {/* No country is asked of a trustee company, so the label cannot follow one. */}
          <TextField label="NZBN or ABN" value={value.businessNumber ?? ''}
                     onChange={(e) => set({ businessNumber: e.target.value })} />
        </>
      )}

      {value.nodeType === 'LIMITED_PARTNERSHIP' && (
        <>
          <CountrySelect
            label="Country of incorporation"
            value={value.jurisdictionCountry ?? null}
            onChange={(code) => set({ jurisdictionCountry: code })}
          />
          {/* The same stored answer a company gives about a nominee director or shareholder:
              one question about whether an intermediary stands in for the real party. */}
          <YesNoField
            label="Nominee limited partner?"
            value={value.nomineeStatus ?? 'NOT_ASKED'}
            onChange={(v) => set({ nomineeStatus: v })}
            options={NOMINEE_OPTIONS}
            helper="Answering yes sets this deal's risk to High."
          />
        </>
      )}

      {value.nodeType === 'PARTNERSHIP' && (
        <TextField label="Source of funds" value={value.sourceOfFunds ?? ''}
                   onChange={(e) => set({ sourceOfFunds: e.target.value })}
                   multiline minRows={2}
                   placeholder="Where the partnership's money comes from, and how it was evidenced." />
      )}

      {value.nodeType === 'LISTED_COMPANY' && (
        <>
          <CountrySelect
            label="Country of incorporation"
            value={value.jurisdictionCountry ?? null}
            onChange={(code) => set({ jurisdictionCountry: code })}
          />
          <TextField label="Incorporation number" value={value.companyNumber ?? ''}
                     onChange={(e) => set({ companyNumber: e.target.value })} />
        </>
      )}

      {JURISDICTION_ONLY.includes(value.nodeType) && (
        <CountrySelect
          label="Jurisdiction"
          value={value.jurisdictionCountry ?? null}
          onChange={(code) => set({ jurisdictionCountry: code })}
        />
      )}

      <TextField
        label="Notes"
        value={value.notes ?? ''}
        onChange={(e) => set({ notes: e.target.value })}
        multiline
        minRows={3}
        placeholder="Anything worth knowing about this node — context, exceptions, follow-ups."
        helperText="Kept on this node. Not posted to the deal's timeline."
      />

      {WITH_REFERENCE.includes(value.nodeType) && (
        <TextField
          label="Reference"
          value={value.reference ?? ''}
          onChange={(e) => set({ reference: e.target.value })}
          placeholder="Link to previous deal"
        />
      )}
    </Stack>
  );
}

/**
 * Form state → API payload. Empty strings become null so the backend's "apply if not null"
 * patching behaves predictably.
 *
 * The person block is sent as a nested object and only when the node is an individual: it is the
 * one part of this payload that leaves the deal, and a shape that shows that is harder to misuse
 * than a flat one.
 */
export function buildNodePayload(form) {
  const norm = (v) => (v === '' || v === undefined ? null : v);
  const payload = {
    nodeType: form.nodeType,
    displayName: form.displayName,
    dateOfBirth: norm(form.dateOfBirth),
    idDocumentType: norm(form.idDocumentType),
    idDocumentNumber: norm(form.idDocumentNumber),
    idDocumentCountry: norm(form.idDocumentCountry),
    companyNumber: norm(form.companyNumber),
    incorporationDate: norm(form.incorporationDate),
    registeredOffice: norm(form.registeredOffice),
    personRole: norm(form.personRole),
    notes: form.notes ?? '',
  };

  // Both blocks are gated on the type that owns them. Sending the company answers for an
  // individual would stamp "not asked" on a question nobody was ever going to pose to them.
  if (form.nodeType === 'PRIVATE_COMPANY') {
    payload.jurisdictionCountry = norm(form.jurisdictionCountry);
    payload.businessNumber = norm(form.businessNumber);
    payload.companyHasConstitution = form.companyHasConstitution ?? false;
    payload.nomineeStatus = form.nomineeStatus || 'NOT_ASKED';
    payload.companyComplexOwnership = form.companyComplexOwnership ?? false;
    payload.companyPersonalAssets = form.companyPersonalAssets ?? false;
    payload.companyNewDeveloper = form.companyNewDeveloper ?? false;
  }

  if (form.nodeType === 'TRUSTEE_COMPANY') {
    payload.businessNumber = norm(form.businessNumber);
  }

  if (form.nodeType === 'LIMITED_PARTNERSHIP') {
    payload.jurisdictionCountry = norm(form.jurisdictionCountry);
    payload.nomineeStatus = form.nomineeStatus || 'NOT_ASKED';
  }

  if (form.nodeType === 'PARTNERSHIP') {
    payload.sourceOfFunds = form.sourceOfFunds ?? '';
  }

  if (form.nodeType === 'LISTED_COMPANY') {
    payload.jurisdictionCountry = norm(form.jurisdictionCountry);
  }

  if (JURISDICTION_ONLY.includes(form.nodeType)) {
    payload.jurisdictionCountry = norm(form.jurisdictionCountry);
  }

  if (WITH_REFERENCE.includes(form.nodeType)) {
    payload.reference = form.reference ?? '';
  }

  if (form.nodeType === 'TRUST') {
    payload.trustType = norm(form.trustType);
    payload.trustDiscretionary = form.trustDiscretionary ?? false;
    payload.trustHoldingComplexity = norm(form.trustHoldingComplexity);
  }

  if (form.nodeType === 'INDIVIDUAL') {
    const p = form.person ?? {};
    // Sent as '' rather than null where blank, so clearing a field actually clears it — the
    // backend reads null as "leave alone".
    payload.person = {
      fullName: form.displayName,
      email: p.email ?? '',
      phoneCountry: p.phoneCountry ?? '',
      phoneNumber: p.phoneNumber ?? '',
      occupation: p.occupation ?? '',
      sourceOfFunds: p.sourceOfFunds ?? '',
    };
  }
  return payload;
}
