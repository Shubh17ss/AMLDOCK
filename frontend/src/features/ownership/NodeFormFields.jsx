import { Box, Divider, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { ID_DOCUMENT_TYPES, NODE_TYPES, PERSON_ROLES } from '../../api/ownership.js';
import { PhoneField } from '../../components/PhoneField.jsx';
import { tokens } from '../../theme/theme.js';

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
      <TextField label={value.nodeType === 'INDIVIDUAL' ? 'Name' : 'Display name'}
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
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="NZBN" value={value.nzbn ?? ''}
                       onChange={(e) => set({ nzbn: e.target.value })} fullWidth />
            <TextField label="Company number" value={value.companyNumber ?? ''}
                       onChange={(e) => set({ companyNumber: e.target.value })} fullWidth />
          </Stack>
          <TextField label="Incorporation date" type="date" InputLabelProps={{ shrink: true }}
                     value={value.incorporationDate ?? ''}
                     onChange={(e) => set({ incorporationDate: e.target.value })} />
          <TextField label="Registered office" value={value.registeredOffice ?? ''}
                     onChange={(e) => set({ registeredOffice: e.target.value })} multiline minRows={2} />
        </>
      )}

      {value.nodeType === 'TRUST' && (
        <>
          <TextField label="Trust name" value={value.trustName ?? ''}
                     onChange={(e) => set({ trustName: e.target.value })} />
          <TextField label="Settlor name" value={value.settlorName ?? ''}
                     onChange={(e) => set({ settlorName: e.target.value })} />
          <TextField label="Trust deed document ID" type="number" value={value.trustDeedDocumentId ?? ''}
                     onChange={(e) => set({ trustDeedDocumentId: e.target.value ? Number(e.target.value) : null })}
                     helperText="The trust deed PDF's id (link UI lands in M8)" />
        </>
      )}

      {/* The remaining entity types carry display name and notes for now. Their own detail
          forms follow the individual's shape — this one is the worked example. */}

      <TextField
        label="Notes"
        value={value.notes ?? ''}
        onChange={(e) => set({ notes: e.target.value })}
        multiline
        minRows={3}
        placeholder="Anything worth knowing about this node — context, exceptions, follow-ups."
        helperText="Kept on this node. Not posted to the deal's timeline."
      />

      <TextField
        label="Reference"
        value={value.reference ?? ''}
        onChange={(e) => set({ reference: e.target.value })}
        placeholder="Link to previous deal"
      />
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
    nzbn: norm(form.nzbn),
    companyNumber: norm(form.companyNumber),
    incorporationDate: norm(form.incorporationDate),
    registeredOffice: norm(form.registeredOffice),
    trustName: norm(form.trustName),
    trustDeedDocumentId: norm(form.trustDeedDocumentId),
    settlorName: norm(form.settlorName),
    personRole: norm(form.personRole),
    reference: form.reference ?? '',
    notes: form.notes ?? '',
  };

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
