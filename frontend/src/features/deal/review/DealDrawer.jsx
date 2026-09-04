import { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Drawer, IconButton, Stack, Tab, Tabs, Tooltip, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { DealDetailsForm } from './DealDetailsForm.jsx';
import { DealNotesTimeline } from '../DealNotesTimeline.jsx';
import { DealAuditPanel } from '../DealAuditPanel.jsx';
import { dtoToForm } from '../create/dealDraftModel.js';
import { formatPropertyAddress } from '../../../data/addressFinderMeta.js';
import { tokens, fonts, motion } from '../../../theme/theme.js';

/** The three faces of the deal record itself, as opposed to the chain of owners behind it. */
const TABS = [
  { value: 'details', label: 'Details' },
  { value: 'notes', label: 'Notes' },
  { value: 'audit', label: 'Audit trail' },
];

/**
 * The deal itself, opened from the property at the head of the structure.
 *
 * <p>Sibling to NodeDrawer, and deliberately the same shape: the structure is the subject of this
 * screen, so everything you open from it arrives the same way. These three used to be tabs on the
 * page, sitting as peers beside Structure and eChecks — which made the page answer two questions
 * at once. The property is where a reader already looks for "what is this deal", so that is where
 * it now lives.
 *
 * <p>Nothing here is committed by closing. Details has its own Save, and will say so if it is
 * dismissed with unsaved work.
 */
export function DealDrawer({ open, deal, dealId, onClose, readOnly = false, canComment = true,
                            frozenNotes = null }) {
  const [tab, setTab] = useState('details');

  // The audit trail is a live event log about the deal, not part of any snapshot, so a version
  // does not offer it. Showing it under a banner reading "as it was signed off" would be the one
  // thing on the screen quietly contradicting that.
  const tabs = frozenNotes ? TABS.filter((t) => t.value !== 'audit') : TABS;
  // Switching to a version while the audit tab is open would leave Tabs pointing at a tab that is
  // no longer there, which MUI renders as no selection at all.
  const current = tabs.some((t) => t.value === tab) ? tab : 'details';

  /*
   * The Details form's state lives here rather than in the form.
   *
   * The body below is keyed on the tab so each panel gets its own entrance, which means every
   * panel remounts when the tab changes. State held inside the form would be thrown away by a
   * glance at the Notes tab — so it is held above the key and handed down.
   */
  const [form, setForm] = useState(() => (deal ? dtoToForm(deal) : null));
  const [baseline, setBaseline] = useState(form);

  // Seeded when the panel opens and when the subject changes — deliberately not on every `deal`
  // change. Ownership edits invalidate the deal query, and a refetch landing mid-sentence would
  // overwrite what the reviewer is typing.
  useEffect(() => {
    if (!open || !deal) return;
    const seeded = dtoToForm(deal);
    setForm(seeded);
    setBaseline(seeded);
    setTab('details');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dealId]);

  // Compared rather than flagged: typing a character and deleting it again should not leave the
  // reviewer being asked about unsaved changes they no longer have.
  const dirty = useMemo(
    () => Boolean(form) && JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline],
  );

  const address = deal ? (formatPropertyAddress(deal.property ?? {}) || 'This deal') : '';

  const [confirmDiscard, setConfirmDiscard] = useState(false);

  /**
   * Nothing here autosaves, so a dismissal is the one way a reviewer could lose work they cannot
   * get back. Asked rather than prevented — they may well mean it. Guarded whichever tab is
   * showing: edits can be made on Details and the drawer dismissed from Notes.
   */
  const requestClose = () => {
    if (dirty) { setConfirmDiscard(true); return; }
    onClose();
  };

  const discardAndClose = () => {
    setConfirmDiscard(false);
    setForm(baseline);
    onClose();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={requestClose}
      transitionDuration={{ enter: parseInt(motion.enter, 10), exit: 200 }}
      slotProps={{
        backdrop: { sx: { backgroundColor: 'rgba(15, 23, 42, 0.32)' } },
      }}
      PaperProps={{
        sx: motion.respectful({
          width: { xs: '100%', sm: 560, md: 640 },
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: tokens.tile,
          backgroundImage: 'none',
          borderLeft: `1px solid ${tokens.hairline}`,
          transitionTimingFunction: motion.ease,
        }),
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Stack
        direction="row"
        alignItems="flex-start"
        spacing={1}
        sx={{ px: 2.5, pt: 2.5, pb: 1.5 }}
      >
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography
            sx={{
              fontFamily: fonts.mono,
              fontSize: '0.62rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: tokens.blue,
            }}
          >
            {deal?.reference ?? 'This deal'}
          </Typography>
          <Typography
            sx={{
              fontFamily: fonts.display,
              fontSize: '1.25rem',
              lineHeight: 1.25,
              color: tokens.ink,
              wordBreak: 'break-word',
            }}
          >
            {address}
          </Typography>
        </Box>
        <Tooltip title="Close">
          <IconButton onClick={requestClose} size="small" aria-label="Close deal panel">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <Tabs
        value={current}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons={false}
        sx={{
          px: 1,
          borderBottom: `1px solid ${tokens.hairline}`,
          // No minHeight here or on the tab — see NodeDrawer: the theme's track carries its own
          // padding around the pill, and overriding half of that sum de-centres it.
          '& .MuiTab-root': {
            textTransform: 'none',
            fontSize: '0.78rem',
            fontFamily: fonts.body,
            minWidth: 0,
            px: 1.25,
          },
        }}
      >
        {tabs.map((t) => (
          <Tab key={t.value} value={t.value} label={t.label} id={`deal-drawer-tab-${t.value}`} />
        ))}
      </Tabs>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <Box
        sx={motion.respectful({
          flexGrow: 1,
          overflowY: 'auto',
          px: 2.5,
          pt: 4,
          pb: 2.5,
          animation: `dealPanelIn ${motion.swift} ${motion.ease} both`,
          '@keyframes dealPanelIn': {
            from: { opacity: 0, transform: 'translateY(4px)' },
            to: { opacity: 1, transform: 'none' },
          },
        })}
        key={current}
      >
        {deal && form && current === 'details' && (
          <DealDetailsForm
            deal={deal}
            dealId={dealId}
            form={form}
            setForm={setForm}
            dirty={dirty}
            // Re-baselined from the server's own answer, not from the form: the normalisation it
            // applies on the way in (blank → null) belongs in the baseline too, or the button
            // stays lit after a successful save.
            onSaved={(dto) => setBaseline(dtoToForm(dto))}
            readOnly={readOnly}
          />
        )}
        {deal && current === 'notes' && (
          // No status chip: the page header already carries one a couple of inches away.
          <DealNotesTimeline
            dealId={dealId}
            canComment={canComment}
            frozenEntries={frozenNotes}
            embedded
          />
        )}
        {current === 'audit' && !frozenNotes && <DealAuditPanel dealId={dealId} embedded />}
      </Box>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          borderTop: `1px solid ${tokens.hairline}`,
          backgroundColor: tokens.tileRaised,
        }}
      >
        <Button fullWidth variant="outlined" onClick={requestClose}>Close</Button>
      </Box>
      {/* fullWidth + xs so the card is the same centred shape on a phone as on a desktop —
          the same shape NewDealPage's discard confirmation uses. */}
      <Dialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        fullWidth
        maxWidth="xs"
        aria-labelledby="confirm-discard-deal-title"
      >
        <DialogTitle id="confirm-discard-deal-title">Discard your changes?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Nothing on this panel has been saved yet. Closing it now leaves the deal as it was.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
          <Button color="error" variant="contained" onClick={discardAndClose}>
            Discard changes
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
}
