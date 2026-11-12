import { Backdrop, Box, CircularProgress, Typography } from '@mui/material';
import { keyframes } from '@mui/system';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { tokens } from '../../theme/theme.js';

const pop = keyframes`
  0%   { transform: scale(0.4); opacity: 0; }
  70%  { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1); }
`;
const rise = keyframes`
  from { transform: translateY(6px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
`;

/**
 * Full-screen, blurred hold while the scope changes. `phase` is 'switching' (spinner), 'done'
 * (tick, "Switched to …") or 'failed' (cross, scope left as it was); null hides it.
 */
export function ScopeSwitchOverlay({ phase, branchName, error }) {
  const done = phase === 'done';
  const failed = phase === 'failed';

  return (
    <Backdrop
      open={Boolean(phase)}
      sx={{
        zIndex: (t) => t.zIndex.modal + 1,
        backgroundColor: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(8px) saturate(140%)',
        WebkitBackdropFilter: 'blur(8px) saturate(140%)',
      }}
    >
      <Box role="status" aria-live="polite" sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, px: 3, textAlign: 'center',
      }}>
        <Box sx={{ width: 64, height: 64, display: 'grid', placeItems: 'center' }}>
          {phase === 'switching' && <CircularProgress size={48} thickness={3.6} sx={{ color: tokens.blue }} />}
          {(done || failed) && (
            <Box sx={{
              width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center',
              backgroundColor: done ? tokens.blue : tokens.rejected, color: '#fff',
              boxShadow: done ? '0 10px 30px rgba(27,95,227,0.35)' : '0 10px 30px rgba(200,40,40,0.3)',
              animation: `${pop} 380ms cubic-bezier(.2,.9,.3,1.3) both`,
            }}>
              {done ? <CheckRoundedIcon sx={{ fontSize: 36 }} /> : <CloseRoundedIcon sx={{ fontSize: 34 }} />}
            </Box>
          )}
        </Box>
        <Typography key={phase} sx={{
          fontSize: '1.05rem', fontWeight: 600, color: tokens.ink,
          animation: `${rise} 260ms ease-out both`,
        }}>
          {phase === 'switching' && 'Switching branch'}
          {done && <>Switched to <Box component="span" sx={{ color: tokens.blue }}>{branchName}</Box></>}
          {failed && `Couldn’t switch to ${branchName}`}
        </Typography>
        {failed && error && (
          <Typography sx={{ fontSize: '0.85rem', color: tokens.muted, maxWidth: 340 }}>{error}</Typography>
        )}
      </Box>
    </Backdrop>
  );
}
