import { Alert, Box, Stack, Typography } from '@mui/material';
import SellIcon from '@mui/icons-material/Sell';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { SectionCard } from './SectionShell.jsx';
import { tokens, fonts, shadows } from '../../../theme/theme.js';

const ROLES = [
  {
    value: 'VENDOR',
    label: 'Vendor',
    blurb: 'Your client is selling the property.',
    Icon: SellIcon,
  },
  {
    value: 'PURCHASER',
    label: 'Purchaser',
    blurb: 'Your client is buying the property.',
    Icon: ShoppingCartIcon,
  },
];

/**
 * Section 1 — who the broker is acting for. This choice decides the rest of the form.
 *
 * The purchaser path isn't built yet. It is blocked here in the UI only: the backend accepts
 * PURCHASE deals exactly as it always has, so shipping that path later touches nothing but
 * this file and section 2.
 */
export function Section1ClientType({ form, setField, locked = false }) {
  return (
    <SectionCard
      title="Who is your client?"
      subtitle="This decides what we ask you next."
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        {ROLES.map(({ value, label, blurb, Icon }) => {
          const selected = form.clientRole === value;
          return (
            <Box
              key={value}
              role="radio"
              aria-checked={selected}
              tabIndex={locked ? -1 : 0}
              onClick={() => !locked && setField('clientRole')(value)}
              onKeyDown={(e) => {
                if (locked) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setField('clientRole')(value);
                }
              }}
              sx={{
                flex: 1, p: 2.5, borderRadius: 3, cursor: locked ? 'default' : 'pointer',
                border: `1.5px solid ${selected ? tokens.blue : tokens.hairline}`,
                backgroundColor: selected ? tokens.blueWash : tokens.tile,
                boxShadow: selected ? shadows.focus : 'none',
                opacity: locked && !selected ? 0.5 : 1,
                transition: 'border-color 0.15s ease, background-color 0.15s ease',
                '&:hover': locked ? {} : { borderColor: tokens.blue },
              }}
            >
              <Icon sx={{ color: selected ? tokens.blue : tokens.muted, fontSize: '1.6rem' }} />
              <Typography sx={{
                fontFamily: fonts.display, fontWeight: 700, fontSize: '1.05rem',
                color: selected ? tokens.blue : tokens.ink, mt: 0.5,
              }}>
                {label}
              </Typography>
              <Typography variant="body2" sx={{ color: tokens.muted }}>{blurb}</Typography>
            </Box>
          );
        })}
      </Stack>

      {form.clientRole === 'PURCHASER' && (
        <Alert severity="info">
          The purchaser flow isn't ready yet — it asks a different set of questions from the
          vendor one. Pick <strong>Vendor</strong> to carry on, or come back for this deal once
          the purchaser path ships.
        </Alert>
      )}

      {locked && (
        <Alert severity="info">
          This is locked because the draft has already been created against it. Discard the
          draft to start a deal for the other side.
        </Alert>
      )}
    </SectionCard>
  );
}
