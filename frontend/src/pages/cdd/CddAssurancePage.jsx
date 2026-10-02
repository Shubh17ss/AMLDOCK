import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, Collapse, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Menu, MenuItem, Paper, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import RemoveModeratorOutlinedIcon from '@mui/icons-material/RemoveModeratorOutlined';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import { assureVersion, listAssurance, unassureVersion } from '../../api/assurance.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { canWrite, isDealReviewer } from '../../auth/roles.js';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { DealStatusChip } from '../../components/DealStatusChip.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { SearchField, matchesSearch } from '../../components/SearchField.jsx';
import { SkeletonTable } from '../../components/SkeletonTable.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { StatusNoteDialog } from '../../features/deal/DecisionDialogs.jsx';
import { tokens, fonts, motion } from '../../theme/theme.js';
import { formatListDate } from './IndividualsTable.jsx';

const COLUMNS = 6;

/** The versions panel's background: a light grey in light mode, a lifted shade in dark. */
const VERSIONS_BG = `color-mix(in srgb, ${tokens.muted} 8%, ${tokens.tile})`;

/** How each assurance position reads, and in what colour. Null is "not reviewed". */
const ASSURANCE_META = {
  ASSURED:   { label: 'Assured',   color: 'success' },
  UNASSURED: { label: 'Unassured', color: 'error' },
};

/**
 * Compliance's second look at deals it has already signed off.
 *
 * <p>One row per verified or closed deal, opening onto its signed-off versions, newest first.
 * Assurance is marked on a version rather than the deal because a sign-off is per version: v2 can
 * be assured while v3, written after a reopen, has not been looked at.
 *
 * <p>Scope is the server's, like every CDD register: the list arrives already narrowed to the
 * firm and branch the dashboard scope names, and to what the caller's role may read.
 */
export function CddAssurancePage() {
  const { firm, branch } = useDashboardScope();
  const [query, setQuery] = useState('');

  const q = useQuery({
    queryKey: ['assurance', firm?.id ?? null, branch?.id ?? null],
    queryFn: () => listAssurance({ firmId: firm?.id, branchId: branch?.id }),
  });

  const all = q.data ?? [];
  const rows = useMemo(
    () => all.filter(({ deal }) => matchesSearch(
      query, deal.propertyAddress, deal.reference, deal.clientDisplayName,
    )),
    [all, query],
  );

  const awaiting = all.filter(({ versions }) => versions[0] && !versions[0].assuranceStatus).length;

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow={[
          `${rows.length} ${rows.length === 1 ? 'deal' : 'deals'} signed off`,
          awaiting > 0 ? `${awaiting} awaiting assurance` : null,
          firm?.name,
          branch?.name,
        ].filter(Boolean).join(' · ')}
        title="Assurance"
      />

      <SearchField value={query} onChange={setQuery} placeholder="Search property, deal or client…" />

      {q.isError && (
        <Alert severity="error">Failed to load the register. Refresh to try again.</Alert>
      )}

      {q.isLoading
        ? <SkeletonTable rows={6} columns={5} />
        : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 48 }} />
                  <TableCell>Property</TableCell>
                  <TableCell>Deal</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Versions</TableCell>
                  <TableCell>Latest version</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => <DealRow key={r.deal.id} deal={r.deal} versions={r.versions} />)}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={COLUMNS} align="center" sx={{ py: 5, color: tokens.muted }}>
                      {query.trim()
                        ? 'No deal matches that search.'
                        : 'No verified or closed deal in scope yet.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
    </Stack>
  );
}

/** A deal, and — once opened — its signed-off versions under it. */
function DealRow({ deal, versions }) {
  const [open, setOpen] = useState(false);
  const latest = versions[0];
  const label = deal.propertyAddress ?? deal.reference;
  const expandable = versions.length > 0;
  const toggle = () => setOpen((o) => !o);

  return (
    <>
      {/* The whole row toggles, since the chevron alone is a small target on a wide row. The
          chevron stays the control for the keyboard and screen readers; the row's own click is
          only a larger pointer target for the same action. */}
      <TableRow
        hover
        onClick={expandable ? toggle : undefined}
        sx={{
          cursor: expandable ? 'pointer' : 'default',
          '& > td': { borderBottom: open ? 'none' : undefined },
        }}
      >
        <TableCell>
          <IconButton
            size="small"
            aria-label={`${open ? 'Hide' : 'Show'} versions of ${label}`}
            aria-expanded={open}
            // Stopped here, or the row's own handler would toggle it straight back.
            onClick={(e) => { e.stopPropagation(); toggle(); }}
            disabled={!expandable}
          >
            <KeyboardArrowDownIcon
              fontSize="small"
              sx={motion.respectful({
                transform: open ? 'rotate(180deg)' : 'none',
                transition: `transform ${motion.swift} ease`,
              })}
            />
          </IconButton>
        </TableCell>
        <TableCell>
          <Tooltip title={deal.propertyAddress ?? ''}>
            <Box
              component={RouterLink}
              to={`/deals/${deal.id}`}
              // Opening the deal is not expanding the row.
              onClick={(e) => e.stopPropagation()}
              // The Listing Register's link treatment: ink at rest, blue and underlined on hover.
              sx={{
                display: 'inline-block', maxWidth: 380, verticalAlign: 'bottom',
                fontWeight: 700, color: tokens.ink, textDecoration: 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                '&:hover': { color: tokens.blue, textDecoration: 'underline' },
              }}
            >
              {label}
            </Box>
          </Tooltip>
        </TableCell>
        <TableCell sx={{ fontFamily: fonts.mono, fontSize: '0.8rem', color: tokens.muted }}>
          {deal.reference}
        </TableCell>
        <TableCell><DealStatusChip status={deal.status} /></TableCell>
        <TableCell sx={{ fontFamily: fonts.mono, fontSize: '0.8rem' }}>{versions.length}</TableCell>
        <TableCell>
          {latest
            ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <VersionChip no={latest.versionNo} />
                <AssuranceChip status={latest.assuranceStatus} />
              </Stack>
            )
            // Verified before versions existed: nothing was frozen, so there is nothing to assure.
            : <Typography variant="caption" sx={{ color: tokens.muted }}>No signed-off version</Typography>}
        </TableCell>
      </TableRow>

      <TableRow>
        {/* A grey well under the deal, so its versions read as belonging to it rather than as
            more rows of the register. Mixed from the theme's own tokens so it flips with dark
            mode; --cl-hover would have been the obvious grey, but it is the row-hover colour. */}
        <TableCell
          colSpan={COLUMNS}
          sx={{
            p: 0,
            borderBottom: open ? undefined : 'none',
            backgroundColor: VERSIONS_BG,
          }}
        >
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ px: { xs: 1, sm: 7 }, py: 1.5 }}>
              <Table size="small" aria-label={`Versions of ${label}`}>
                <TableHead>
                  <TableRow
                    sx={{
                      // Transparent, or the theme's table-head tint paints a white strip across the well.
                      '& th': { color: tokens.muted, fontSize: '0.72rem', backgroundColor: 'transparent' },
                    }}
                  >
                    <TableCell>Version</TableCell>
                    <TableCell>Signed off</TableCell>
                    <TableCell>Assurance</TableCell>
                    <TableCell>Marked by</TableCell>
                    <TableCell align="right" sx={{ width: 56 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {versions.map((v) => <VersionRow key={v.versionNo} deal={deal} version={v} />)}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function VersionRow({ deal, version: v }) {
  return (
    <TableRow sx={{ '&:last-child td': { borderBottom: 'none' } }}>
      <TableCell><VersionChip no={v.versionNo} /></TableCell>
      <TableCell>
        <Byline name={v.verifiedByName} at={v.verifiedAt} />
      </TableCell>
      <TableCell>
        {/* The note is the reason behind the verdict, so it hangs off the verdict itself. */}
        <Tooltip title={v.assuranceNote ? `“${v.assuranceNote}”` : ''}>
          <Box component="span"><AssuranceChip status={v.assuranceStatus} /></Box>
        </Tooltip>
      </TableCell>
      <TableCell>
        {v.assuranceStatus
          ? <Byline name={v.assuranceByName} at={v.assuranceAt} />
          : <Typography variant="caption" sx={{ color: tokens.muted }}>—</Typography>}
      </TableCell>
      <TableCell align="right">
        <VersionMenu deal={deal} version={v} />
      </TableCell>
    </TableRow>
  );
}

/**
 * What can be done to one version, behind one button.
 *
 * <p>Same shape as the deals list's row menu: items that do not apply are hidden rather than
 * disabled, so the menu says what you can do. Assured offers only Unassured and the other way
 * round, because marking a version with the verdict it already has would only overwrite the note
 * and byline of the decision that is actually standing.
 */
function VersionMenu({ deal, version: v }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [anchor, setAnchor] = useState(null);
  const [marking, setMarking] = useState(null); // 'ASSURED' | 'UNASSURED' | null
  const [notesOpen, setNotesOpen] = useState(false);

  const mayMark = isDealReviewer(user?.role) && canWrite(user?.role);
  const assured = v.assuranceStatus === 'ASSURED';

  const mut = useMutation({
    mutationFn: ({ target, note }) => (target === 'ASSURED'
      ? assureVersion(deal.id, v.versionNo, note)
      : unassureVersion(deal.id, v.versionNo, note)),
    onSuccess: (_, { target }) => {
      qc.invalidateQueries({ queryKey: ['assurance'] });
      qc.invalidateQueries({ queryKey: ['dealVersions', deal.id] });
      setMarking(null);
      showToast({
        severity: 'success',
        message: `v${v.versionNo} of ${deal.reference} marked ${target === 'ASSURED' ? 'assured' : 'unassured'}`,
      });
    },
  });

  const close = () => setAnchor(null);

  return (
    <>
      <Tooltip title="Actions">
        <IconButton
          size="small"
          aria-label={`Actions for v${v.versionNo} of ${deal.reference}`}
          onClick={(e) => setAnchor(e.currentTarget)}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Menu open={Boolean(anchor)} anchorEl={anchor} onClose={close}>
        {/* The deal screen reads ?version= and renders the snapshot read-only. */}
        <MenuItem component={RouterLink} to={`/deals/${deal.id}?version=${v.versionNo}`} onClick={close}>
          <VisibilityOutlinedIcon fontSize="small" sx={{ mr: 1 }} /> View
        </MenuItem>

        {/* Reading, not marking, so it is not gated on mayMark: an auditor checking the register
            needs the reason behind an assurance as much as the reviewer who gave it. */}
        {assured && (
          <MenuItem onClick={() => { close(); setNotesOpen(true); }}>
            <StickyNote2OutlinedIcon fontSize="small" sx={{ mr: 1 }} /> Show notes
          </MenuItem>
        )}

        {mayMark && !assured && (
          <MenuItem onClick={() => { close(); setMarking('ASSURED'); }}>
            <VerifiedOutlinedIcon fontSize="small" sx={{ mr: 1, color: tokens.approved }} /> Mark as Assured
          </MenuItem>
        )}

        {mayMark && assured && (
          <MenuItem sx={{ color: 'error.main' }} onClick={() => { close(); setMarking('UNASSURED'); }}>
            <RemoveModeratorOutlinedIcon fontSize="small" sx={{ mr: 1 }} /> Mark as Unassured
          </MenuItem>
        )}
      </Menu>

      <AssuranceNoteDialog
        open={notesOpen}
        deal={deal}
        version={v}
        onClose={() => setNotesOpen(false)}
      />

      <StatusNoteDialog
        open={marking != null}
        title={marking === 'ASSURED'
          ? `Assure v${v.versionNo} of ${deal.reference}?`
          : `Mark v${v.versionNo} of ${deal.reference} as unassured?`}
        prompt={marking === 'ASSURED'
          ? 'Confirm this signed-off version holds up on review. The note is kept with the '
            + 'assurance, separate from the deal’s timeline.'
          : 'Withdraw assurance from this version. Say what does not hold up — the note is kept '
            + 'with the assurance, separate from the deal’s timeline.'}
        confirmLabel={marking === 'ASSURED' ? 'Mark as Assured' : 'Mark as Unassured'}
        confirmColor={marking === 'ASSURED' ? 'primary' : 'error'}
        onClose={() => setMarking(null)}
        submitting={mut.isPending}
        onSubmit={(note) => mut.mutateAsync({ target: marking, note })}
      />
    </>
  );
}

/**
 * The note left with a version's assurance, read-only, with who left it and when.
 *
 * <p>Only the current note exists: the version keeps its standing verdict, not a history of them
 * (the audit log has that). So this is one note, not a timeline.
 */
function AssuranceNoteDialog({ open, deal, version: v, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle component="div" sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box component="span">Assurance note</Box>
          <VersionChip no={v.versionNo} />
          <AssuranceChip status={v.assuranceStatus} />
        </Stack>
        <Typography sx={{ fontSize: '0.85rem', color: tokens.muted, mt: 0.5 }}>
          {deal.propertyAddress ?? deal.reference}
          {deal.propertyAddress ? ` · ${deal.reference}` : ''}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            p: 2, borderRadius: '12px',
            backgroundColor: VERSIONS_BG,
            border: `1px solid ${tokens.hairline}`,
          }}
        >
          {/* pre-wrap keeps the reviewer's own line breaks; anywhere stops a pasted URL from
              pushing the dialog sideways. */}
          <Typography
            sx={{
              fontSize: '0.92rem', color: tokens.ink,
              whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
            }}
          >
            {v.assuranceNote || '—'}
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ display: 'block', mt: 1.25, color: tokens.muted }}>
          {[v.assuranceByName ? `Assured by ${v.assuranceByName}` : 'Assured', formatListDate(v.assuranceAt)]
            .join(' · ')}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} variant="contained">Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function VersionChip({ no }) {
  return (
    <Chip
      size="small"
      label={`v${no}`}
      variant="outlined"
      sx={{ fontFamily: fonts.mono, fontSize: '0.72rem', height: 22 }}
    />
  );
}

function AssuranceChip({ status }) {
  const meta = ASSURANCE_META[status];
  return meta
    ? <Chip size="small" label={meta.label} color={meta.color} />
    : <Chip size="small" label="Not reviewed" variant="outlined" sx={{ color: tokens.muted }} />;
}

/** Who and when, on one line, or a dash when neither survived. */
function Byline({ name, at }) {
  return (
    <Stack spacing={0}>
      <Typography sx={{ fontSize: '0.85rem', color: tokens.ink }}>{name ?? '—'}</Typography>
      <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.72rem', color: tokens.muted }}>
        {formatListDate(at)}
      </Typography>
    </Stack>
  );
}
