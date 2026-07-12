import { useState } from 'react';
import {
  Box, Card, CardContent, Collapse, Divider, Grid, IconButton, Stack, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { tokens, fonts } from '../../theme/theme.js';

const NZD = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 });

const TXN_LABEL = { PURCHASE: 'Purchase', SALE: 'Sale' };
const CLIENT_TYPE_LABEL = { INDIVIDUAL: 'Individual', ENTITY: 'Entity' };

/**
 * The deal information a broker captured, laid out group-by-group in the same shape the
 * New Deal wizard collects it (Firm & transaction · Point of contact · Property · Client).
 * Every field is shown — blanks render as "—" so a reviewer can see what wasn't provided.
 * Collapsible so it doesn't crowd the reviewer's workspace.
 */
export function DealCapturedInfo({ deal, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const p = deal.property ?? {};
  const c = deal.client ?? {};

  const glance = [c.displayName, [p.addressLine1, p.suburb, p.district].filter(Boolean).join(', '), deal.firmName]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{
              fontFamily: fonts.mono, fontSize: '0.64rem', letterSpacing: '0.14em',
              textTransform: 'uppercase', color: tokens.muted,
            }}>
              Captured by broker
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.ink }}>
              Deal information
            </Typography>
          </Box>
          <IconButton
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Collapse deal information' : 'Expand deal information'}
            aria-expanded={open}
            sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }}
          >
            <ExpandMoreIcon />
          </IconButton>
        </Stack>

        {/* Glance line when collapsed — keeps the quick summary a reviewer had before */}
        {!open && (
          <Typography variant="body2" sx={{ color: tokens.muted, mt: 0.5 }} noWrap>
            {glance || '—'}
          </Typography>
        )}

        <Collapse in={open} timeout="auto" unmountOnExit>
          <Divider sx={{ my: 1.5 }} />
          <Grid container spacing={{ xs: 2, md: 3 }} rowSpacing={{ xs: 2.5, md: 3 }}>
            <Group title="Firm & transaction">
              <Row label="Reporting entity" value={deal.firmName} />
              <Row label="Branch"      value={deal.branchName} />
              <Row label="Transaction" value={TXN_LABEL[deal.transactionType] ?? deal.transactionType} />
              <Row label="Value"       value={deal.transactionValueNzd != null ? NZD.format(deal.transactionValueNzd) : null} />
            </Group>

            <Group title="Point of contact">
              <Row label="Name"  value={deal.pocName} />
              <Row label="Role"  value={deal.pocRole} />
              <Row label="Phone" value={deal.pocPhone} />
              <Row label="Email" value={deal.pocEmail} />
            </Group>

            <Group title="Property">
              <Row label="Address"     value={p.addressLine1} />
              <Row label="Address 2"   value={p.addressLine2} />
              <Row label="Suburb"      value={p.suburb} />
              <Row label="District"    value={p.district} />
              <Row label="Region"      value={p.region} />
              <Row label="Country"     value={p.country} />
              <Row label="Postcode"    value={p.postcode} />
              <Row label="Title ref"   value={p.titleReference} />
              <Row label="Land area"   value={p.landAreaSqm != null ? `${p.landAreaSqm} m²` : null} />
              <Row label="Legal desc." value={p.legalDescription} />
            </Group>

            <Group title="Client">
              <Row label="Name"  value={c.displayName} />
              <Row label="Type"  value={CLIENT_TYPE_LABEL[c.clientType] ?? c.clientType} />
              <Row label="Email" value={c.email} />
              <Row label="Phone" value={c.phone} />
            </Group>
          </Grid>
        </Collapse>
      </CardContent>
    </Card>
  );
}

function Group({ title, children }) {
  return (
    <Grid item xs={12} md={6}>
      <Typography sx={{
        fontFamily: fonts.mono, fontSize: '0.62rem', letterSpacing: '0.12em',
        textTransform: 'uppercase', color: tokens.muted, mb: 0.75,
      }}>
        {title}
      </Typography>
      <Stack>{children}</Stack>
    </Grid>
  );
}

function Row({ label, value }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0, sm: 1 }} sx={{ py: 0.4 }}>
      <Typography variant="body2" sx={{ minWidth: 104, fontWeight: 600, color: tokens.muted, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ color: tokens.ink, wordBreak: 'break-word' }}>
        {value || '—'}
      </Typography>
    </Stack>
  );
}
