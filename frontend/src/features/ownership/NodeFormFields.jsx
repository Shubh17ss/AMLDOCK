import { FormControl, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import { ID_DOCUMENT_TYPES, NODE_TYPES } from '../../api/ownership.js';

/**
 * Renders the per-type form fields for an ownership node. `value` is the form-state object and
 * `onChange` receives the merged next value. `includeTypeSelector` controls whether the
 * type-picker is rendered (true for create dialogs, false for the edit pane where the user
 * usually shouldn't change a node's type).
 */
export function NodeFormFields({ value, onChange, includeTypeSelector = true }) {
  const set = (patch) => onChange({ ...value, ...patch });

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
      <TextField label="Display name" value={value.displayName ?? ''}
                 onChange={(e) => set({ displayName: e.target.value })} required />

      {value.nodeType === 'NATURAL_PERSON' && (
        <>
          <TextField label="Date of birth" type="date" InputLabelProps={{ shrink: true }}
                     value={value.dateOfBirth ?? ''} onChange={(e) => set({ dateOfBirth: e.target.value })} />
          <Stack direction="row" spacing={2}>
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
                       onChange={(e) => set({ idDocumentCountry: e.target.value })} sx={{ width: 120 }} />
          </Stack>
        </>
      )}

      {value.nodeType === 'NZ_COMPANY' && (
        <>
          <Stack direction="row" spacing={2}>
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

      {/* PARTNERSHIP / OTHER use only display name — no extra fields in MVP-1 */}

      <TextField
        label="Notes"
        value={value.notes ?? ''}
        onChange={(e) => set({ notes: e.target.value })}
        multiline
        minRows={3}
        placeholder="Anything worth knowing about this node — context, exceptions, follow-ups."
      />
    </Stack>
  );
}

export function buildNodePayload(form) {
  // Normalise empty strings to null so the backend's `if not null` patches behave predictably.
  const norm = (v) => (v === '' || v === undefined ? null : v);
  return {
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
    notes: norm(form.notes),
  };
}
