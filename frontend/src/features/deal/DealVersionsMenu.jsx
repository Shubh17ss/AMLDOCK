import { Box, Chip, Divider, ListItemText, Menu, MenuItem, Stack, Typography } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import CheckIcon from '@mui/icons-material/Check';
import { formatDate } from '../../utils/formatters.js';
import { tokens, fonts } from '../../theme/theme.js';

/**
 * The list of a deal's sign-offs, opened from the header.
 *
 * <p>Each row is one verification: who signed it off, when, and the note they left. A version that
 * was later reopened says so and says why, because "v1, 12 Aug" on its own does not tell a reviewer
 * whether it is the one they are looking for — the reason it was taken back usually does.
 *
 * <p>The version chip vocabulary (`v2`) is the one the compliance document register already uses,
 * so the two histories in the product read the same way.
 */
export function DealVersionsMenu({ anchorEl, open, onClose, versions = [], selected, onSelect }) {
  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { maxWidth: 380, mt: 0.5 } } }}
    >
      <Box sx={{ px: 2, pt: 1, pb: 0.5 }}>
        <Typography sx={{ fontFamily: fonts.display, fontSize: '0.8rem', color: tokens.muted }}>
          Signed-off versions
        </Typography>
      </Box>

      {/* Getting back to the live deal is a destination like any other, so it is a row in the same
          list rather than a separate control the reader has to go looking for. */}
      <MenuItem selected={!selected} onClick={() => { onSelect(null); onClose(); }}>
        <CheckIcon sx={{ fontSize: 16, mr: 1, opacity: selected ? 0 : 1, color: tokens.blue }} />
        <ListItemText
          primary="Current"
          secondary="The deal as it stands now"
          primaryTypographyProps={{ fontSize: '0.9rem' }}
          secondaryTypographyProps={{ fontSize: '0.75rem' }}
        />
      </MenuItem>

      <Divider />

      {versions.map((v) => (
        <MenuItem
          key={v.versionNo}
          selected={selected === v.versionNo}
          onClick={() => { onSelect(v.versionNo); onClose(); }}
          sx={{ alignItems: 'flex-start', py: 1 }}
        >
          <CheckIcon sx={{
            fontSize: 16, mr: 1, mt: 0.4,
            opacity: selected === v.versionNo ? 1 : 0, color: tokens.blue,
          }} />
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={`v${v.versionNo}`}
                size="small"
                sx={{ height: 20, fontFamily: fonts.mono, fontSize: '0.7rem' }}
              />
              <Typography sx={{ fontSize: '0.8rem', color: tokens.ink }}>
                {formatDate(v.verifiedAt)}
              </Typography>
            </Stack>

            <Typography sx={{ fontSize: '0.75rem', color: tokens.muted, mt: 0.25 }}>
              Verified by {v.verifiedByName || v.verifiedByEmail || 'a reviewer'}
              {' · '}
              {v.nodeCount} {v.nodeCount === 1 ? 'node' : 'nodes'}
              {', '}
              {v.documentCount} {v.documentCount === 1 ? 'document' : 'documents'}
            </Typography>

            {/* whiteSpace normal: a verify note is a sentence, and MenuItem would otherwise
                truncate it to one line — the sentence is the reason to pick this row. */}
            {v.verifyNote && (
              <Typography sx={{
                fontSize: '0.75rem', color: tokens.ink, mt: 0.5,
                whiteSpace: 'normal', fontStyle: 'italic',
              }}>
                “{v.verifyNote}”
              </Typography>
            )}

            {v.reopenedAt && (
              <Typography sx={{
                fontSize: '0.7rem', color: tokens.muted, mt: 0.5, whiteSpace: 'normal',
              }}>
                Reopened {formatDate(v.reopenedAt)} by {v.reopenedByName || 'a reviewer'}
                {v.reopenNote ? ` — ${v.reopenNote}` : ''}
              </Typography>
            )}
          </Box>
        </MenuItem>
      ))}

      {versions.length === 0 && (
        <MenuItem disabled>
          <ListItemText
            primary="No versions yet"
            secondary="One is saved each time the deal is verified"
            primaryTypographyProps={{ fontSize: '0.85rem' }}
            secondaryTypographyProps={{ fontSize: '0.75rem' }}
          />
        </MenuItem>
      )}
    </Menu>
  );
}

/** The icon the header button carries. Exported so the button and the menu cannot drift apart. */
export const VersionsIcon = HistoryIcon;
