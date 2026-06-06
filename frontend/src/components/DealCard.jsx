import { Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { DealStatusChip } from './DealStatusChip.jsx';

const NEU_BASE   = '#E0E5EC';
const NEU_FG     = '#3D4852';
const NEU_MUTED  = '#6B7280';
const NEU_ACCENT = '#6C63FF';
const NEU_TEAL   = '#38B2AC';
const EXT        = '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5)';
const EXT_H      = '12px 12px 20px rgb(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6)';
const EXT_SM     = '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)';
const INSET_SM   = 'inset 3px 3px 6px rgb(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5)';

const NZD = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 });

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
}

export function DealCard({ deal, onClaim, onReview, claimPending }) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    if (deal.status === 'UNDER_REVIEW' && onReview) {
      navigate(`/deals/${deal.id}/review`);
    } else {
      navigate(`/deals/${deal.id}`);
    }
  };

  return (
    <Box
      onClick={handleCardClick}
      sx={{
        backgroundColor: NEU_BASE,
        borderRadius: 2,
        boxShadow: EXT,
        p: 2.5,
        cursor: 'pointer',
        transition: 'box-shadow 0.25s ease, transform 0.25s ease',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        '&:active': {
          boxShadow: INSET_SM,
          transform: 'scale(0.99)',
        },
      }}
    >
      {/* Row 1: reference + status */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
        <Typography sx={{
          fontSize: '0.78rem',
          fontWeight: 700,
          color: NEU_MUTED,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          pt: 0.25,
        }}>
          {deal.reference ?? `#${deal.id}`}
        </Typography>
        <DealStatusChip status={deal.status} />
      </Box>

      {/* Row 2: property address */}
      {deal.propertyAddress && (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
          <Box sx={{ mt: '3px', flexShrink: 0 }}>
            <LocationDot />
          </Box>
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: NEU_FG, lineHeight: 1.35 }}>
            {deal.propertyAddress}
          </Typography>
        </Box>
      )}

      {/* Row 3: client */}
      {deal.clientDisplayName && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <PersonDot />
          <Typography sx={{ fontSize: '0.85rem', color: NEU_MUTED }}>
            {deal.clientDisplayName}
          </Typography>
        </Box>
      )}

      {/* Row 4: meta chips */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: onClaim || onReview ? 2 : 0 }}>
        {deal.transactionValueNzd != null && (
          <MetaPill>{NZD.format(deal.transactionValueNzd)}</MetaPill>
        )}
        {deal.transactionType && (
          <MetaPill>{deal.transactionType}</MetaPill>
        )}
        {deal.branchName && (
          <MetaPill>{deal.branchName}</MetaPill>
        )}
        {deal.firmName && (
          <MetaPill>{deal.firmName}</MetaPill>
        )}
        <Box sx={{ ml: 'auto' }}>
          <MetaPill muted>{timeAgo(deal.updatedAt)}</MetaPill>
        </Box>
      </Box>

      {/* Queue actions */}
      {(onClaim || onReview) && (
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{ display: 'flex', gap: 1.5 }}
        >
          {deal.status === 'SUBMITTED' && onClaim && (
            <ActionButton
              onClick={() => onClaim(deal.id)}
              disabled={claimPending}
              accent
            >
              Claim deal →
            </ActionButton>
          )}
          {deal.status === 'UNDER_REVIEW' && onReview && (
            <ActionButton onClick={() => navigate(`/deals/${deal.id}/review`)}>
              Open review →
            </ActionButton>
          )}
          <ActionButton onClick={() => navigate(`/deals/${deal.id}`)}>
            View
          </ActionButton>
        </Box>
      )}
    </Box>
  );
}

function MetaPill({ children, muted }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        px: 1.25,
        py: 0.25,
        fontSize: '0.72rem',
        fontWeight: 600,
        color: muted ? NEU_MUTED : NEU_FG,
        boxShadow: INSET_SM,
        letterSpacing: '0.02em',
      }}
    >
      {children}
    </Box>
  );
}

function ActionButton({ children, onClick, disabled, accent }) {
  return (
    <Box
      component="button"
      onClick={onClick}
      disabled={disabled}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 2.5,
        px: 2,
        py: 1,
        fontSize: '0.8rem',
        fontWeight: 700,
        fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        backgroundColor: accent ? NEU_ACCENT : NEU_BASE,
        color: accent ? '#fff' : NEU_FG,
        boxShadow: EXT_SM,
        transition: 'box-shadow 0.2s ease',
        flex: accent ? 1 : 'none',
        '&:active:not(:disabled)': { boxShadow: INSET_SM },
      }}
    >
      {children}
    </Box>
  );
}

function LocationDot() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5S12.5 9.5 12.5 6c0-2.5-2-4.5-4.5-4.5z"
        fill="rgba(108,99,255,0.15)" stroke="#6C63FF" strokeWidth="1.25" />
      <circle cx="8" cy="6" r="1.5" fill="#6C63FF" />
    </svg>
  );
}

function PersonDot() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.5" r="2.5" stroke="#38B2AC" strokeWidth="1.25" fill="rgba(56,178,172,0.15)" />
      <path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="#38B2AC" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}
