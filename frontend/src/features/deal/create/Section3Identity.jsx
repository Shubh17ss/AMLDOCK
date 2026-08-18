import { Alert, Stack, TextField, Typography } from '@mui/material';
import { IdScanList } from './IdScanList.jsx';
import { SectionCard, FieldGroup } from './SectionShell.jsx';
import { tokens } from '../../../theme/theme.js';

/**
 * Section 3 — the people behind the deal.
 *
 * Two different things, kept apart on purpose. The ID scans are of natural persons and feed
 * identity verification. The key contact is who the firm actually calls about this deal.
 * Neither is the *client* in the compliance sense — the owning entity (company, LLP, trust,
 * individual) is established by admin/AMLCo during the ownership-structure review. Until then
 * the contact's name stands in as the deal's label so lists are readable.
 */
export function Section3Identity({ form, setField, dealId, idDocuments, onUploaded, onRemoved }) {
  return (
    <SectionCard
      title="Client identity"
      subtitle="Scan the IDs you've sighted, and tell us who to contact about this deal."
    >
      <FieldGroup title="Identity documents">
        {!dealId ? (
          <Alert severity="info">Saving your draft so scans have somewhere to go…</Alert>
        ) : (
          <IdScanList
            dealId={dealId}
            documents={idDocuments}
            onUploaded={onUploaded}
            onRemoved={onRemoved}
          />
        )}
      </FieldGroup>

      <FieldGroup title="Key contact for this deal">
        <TextField
          label="Name"
          value={form.contactName}
          onChange={setField('contactName')}
          fullWidth
          required
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Email"
            type="email"
            value={form.contactEmail}
            onChange={setField('contactEmail')}
            fullWidth
          />
          <TextField
            label="Mobile number"
            type="tel"
            inputMode="tel"
            value={form.contactPhone}
            onChange={setField('contactPhone')}
            fullWidth
          />
        </Stack>
        <Typography variant="caption" sx={{ color: tokens.muted }}>
          This name identifies the deal for now. Compliance confirms the owning party — a
          person, company, trust or partnership — when they review the ownership structure.
        </Typography>
      </FieldGroup>
    </SectionCard>
  );
}
