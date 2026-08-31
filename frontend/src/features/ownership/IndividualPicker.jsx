import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Stack, TextField, Typography,
} from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import { getIndividual, listIndividuals } from '../../api/individuals.js';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { matchesSearch } from '../../components/SearchField.jsx';
import { personRoleLabel } from '../../api/ownership.js';
import { countryName } from '../../data/countries.js';
import { formatBytes, formatDate } from '../../utils/formatters.js';
import { tokens, fonts, motion } from '../../theme/theme.js';

/** Past this many matches the list stops being a list and starts being a wall. */
const MAX_ROWS = 8;

/**
 * Names an individual, either by finding one the firm has met before or by typing a new one.
 *
 * <p>The single text field is both the filter and the new-person input, because those are the same
 * act: you type who you mean, and either they are already on file or they are not.
 *
 * <p><strong>Picking copies; it never links.</strong> What leaves here is a set of field values,
 * and the node created from them gets its own fresh person record. Two deals never share one, so
 * correcting an address on this deal cannot rewrite the deal it was copied from. Handing back an
 * id instead would undo that in one line, which is why none is exposed.
 *
 * <p>The same human on three deals is three rows, deliberately — two different people can share a
 * name, and merging them on that evidence would be a diligence error. Every row therefore carries
 * the deal and property it belongs to, which is what tells the two apart.
 *
 * Props:
 *   name, onNameChange  — the typed name, owned by the dialog because it is what gets submitted
 *   selected            — the chosen individual's full record, or null
 *   onSelect(detail)    — a person was chosen; the dialog copies from `detail`
 *   onClear()           — back to searching
 *   active              — this panel is on screen; gates the fetch so picking "Trust" costs nothing
 */
export function IndividualPicker({ name, onNameChange, selected, onSelect, onClear, active }) {
  const { firm } = useDashboardScope();
  const [openNodeId, setOpenNodeId] = useState(null);
  const inputRef = useRef(null);

  // Focus on arrival rather than on mount. The panel is mounted behind the type grid the whole
  // time so that a step back and forward does not lose what was typed, and an autoFocus would
  // therefore pull the caret out of a dialog still showing step one.
  useEffect(() => { if (active) inputRef.current?.focus(); }, [active]);

  // Firm, never branch: an individual is on file for the firm, and a reviewer looking for someone
  // onboarded at another office should still find them. Shares the registers' cache entry exactly
  // when no branch is selected. The params are advisory anyway — the server narrows by role.
  const listQ = useQuery({
    queryKey: ['individuals', firm?.id ?? null, null],
    queryFn: () => listIndividuals({ firmId: firm?.id }),
    enabled: Boolean(active),
  });

  const query = name.trim();
  const all = listQ.data ?? [];

  // Nothing until something is typed. Opening straight into every person the firm has ever
  // onboarded would be a list to scroll, not an answer to a question.
  const matches = useMemo(
    () => (query ? all.filter((r) => matchesSearch(query, r.displayName)) : []),
    [all, query],
  );
  const shown = matches.slice(0, MAX_ROWS);

  if (selected) {
    return <ChosenPerson person={selected} onClear={onClear} />;
  }

  return (
    <Stack spacing={2}>
      <TextField
        fullWidth
        inputRef={inputRef}
        label="Name"
        value={name}
        onChange={(e) => { onNameChange(e.target.value); setOpenNodeId(null); }}
        placeholder="Start typing to search individuals on your firm's deals"
        helperText="Pick someone already on file, or keep typing to add a new individual."
      />

      {listQ.isError && (
        <Alert severity="warning">
          Could not load your firm's individuals. You can still add a new one by name.
        </Alert>
      )}

      {query && listQ.isLoading && (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 0.5 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" sx={{ color: tokens.muted }}>Searching…</Typography>
        </Stack>
      )}

      {query && !listQ.isLoading && matches.length > 0 && (
        <Stack spacing={1}>
          <SectionLabel>
            {matches.length > MAX_ROWS
              ? `Already on file — ${matches.length} matches`
              : 'Already on file'}
          </SectionLabel>
          {shown.map((row) => (
            <PersonRow
              key={row.nodeId}
              row={row}
              open={openNodeId === row.nodeId}
              onToggle={() => setOpenNodeId(openNodeId === row.nodeId ? null : row.nodeId)}
              onUse={onSelect}
            />
          ))}
          {matches.length > shown.length && (
            <Typography variant="caption" sx={{ color: tokens.muted, pl: 0.5 }}>
              {matches.length - shown.length} more — keep typing to narrow it down.
            </Typography>
          )}
        </Stack>
      )}

      {query && !listQ.isLoading && !listQ.isError && matches.length === 0 && (
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 0.5 }}>
          <PersonAddAltIcon sx={{ fontSize: 18, color: tokens.muted }} />
          <Typography variant="body2" sx={{ color: tokens.muted }}>
            Nobody on file by that name. <strong>{query}</strong> will be added as a new individual.
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}

/** One match. Collapsed it is a name and where it came from; open it is the whole record. */
function PersonRow({ row, open, onToggle, onUse }) {
  // Fetched only for the row someone actually opened — the register list carries no contact
  // details, and widening it would grow two register pages and a CSV export to serve this.
  const detailQ = useQuery({
    queryKey: ['individual', row.nodeId],
    queryFn: () => getIndividual(row.nodeId),
    enabled: open,
  });

  return (
    <Box
      sx={{
        borderRadius: '12px',
        border: `1.5px solid ${open ? tokens.blue : tokens.hairline}`,
        backgroundColor: open ? tokens.blueWash : tokens.tile,
        overflow: 'hidden',
        transition: `border-color ${motion.swift} ease, background-color ${motion.swift} ease`,
      }}
    >
      <Box
        component="button"
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.25,
          width: '100%', px: 1.5, py: 1.25,
          background: 'none', border: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer',
          '&:hover': { backgroundColor: open ? 'transparent' : tokens.hover },
          '&:focus-visible': { outline: `2px solid ${tokens.blue}`, outlineOffset: -2 },
        }}
      >
        <Box
          sx={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            display: 'grid', placeItems: 'center',
            backgroundColor: tokens.blueWash, color: tokens.blue,
          }}
        >
          <PersonOutlineIcon sx={{ fontSize: 19 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ color: tokens.ink, fontSize: '0.9rem', lineHeight: 1.3 }}>
            {row.displayName}
          </Typography>
          {/* The line that separates two people who share a name. Not decoration. */}
          <Typography
            sx={{
              fontFamily: fonts.mono, fontSize: '0.68rem', color: tokens.muted,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {formatDate(row.dateOfBirth)} · {row.dealReference}
            {row.propertyAddress ? ` · ${row.propertyAddress}` : ''}
          </Typography>
        </Box>
      </Box>

      {open && (
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <Divider sx={{ mb: 1.5 }} />
          {detailQ.isLoading && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CircularProgress size={16} />
              <Typography variant="body2" sx={{ color: tokens.muted }}>Loading details…</Typography>
            </Stack>
          )}
          {detailQ.isError && (
            <Alert severity="error">Could not load these details. Try again in a moment.</Alert>
          )}
          {detailQ.data && (
            <Stack spacing={1.5}>
              <PersonFacts person={detailQ.data} />
              <Button variant="contained" size="small" onClick={() => onUse(detailQ.data)}>
                Use this person
              </Button>
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
}

/** The person the dialog will copy, with the way back out. */
function ChosenPerson({ person, onClear }) {
  return (
    <Stack spacing={2}>
      <Box
        sx={{
          borderRadius: '12px',
          border: `1.5px solid ${tokens.blue}`,
          backgroundColor: tokens.blueWash,
          px: 1.75, py: 1.5,
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
          <Box
            sx={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              display: 'grid', placeItems: 'center',
              backgroundColor: tokens.tile, color: tokens.blue,
            }}
          >
            <PersonOutlineIcon sx={{ fontSize: 19 }} />
          </Box>
          <Typography sx={{ color: tokens.ink, fontSize: '1rem' }}>{person.displayName}</Typography>
        </Stack>
        <PersonFacts person={person} />
      </Box>

      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
        <Typography variant="caption" sx={{ color: tokens.muted }}>
          These details are copied onto this deal. Changing them here leaves
          {' '}{person.dealReference} untouched.
        </Typography>
        <Button size="small" onClick={onClear} sx={{ flexShrink: 0 }}>Choose someone else</Button>
      </Stack>
    </Stack>
  );
}

/** The record itself, laid out the same whether it is being considered or has been chosen. */
function PersonFacts({ person }) {
  const p = person.person ?? {};
  const phone = [p.phoneCountry, p.phoneNumber].filter(Boolean).join(' ');
  const country = p.countryOfResidence
    ? (countryName(p.countryOfResidence) ?? p.countryOfResidence)
    : null;

  return (
    <Stack spacing={0.75}>
      <Fact label="Born" value={person.dateOfBirth ? formatDate(person.dateOfBirth) : null} />
      <Fact label="Country" value={country} />
      <Fact label="Email" value={p.email} />
      <Fact label="Phone" value={phone} />
      <Fact label="Occupation" value={p.occupation} />
      <Fact label="Source of funds" value={p.sourceOfFunds} />
      <Fact label="Role" value={person.personRole ? personRoleLabel(person.personRole) : null} />
      <Fact
        label="From"
        value={person.dealReference
          + (person.propertyAddress ? ` · ${person.propertyAddress}` : '')}
      />
      <CopiedDocuments documents={person.documents ?? []} />
      {/* Carried across with the rest, and said out loud: a status reached on another file is
          worth knowing about on this one. */}
      {person.verificationStatus && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 0.25 }}>
          <FactLabel>Verification</FactLabel>
          <Chip
            size="small"
            label={String(person.verificationStatus).replace(/_/g, ' ').toLowerCase()}
            sx={{ height: 20, fontSize: '0.68rem', textTransform: 'capitalize' }}
          />
        </Stack>
      )}
    </Stack>
  );
}

/**
 * What is about to be duplicated, named before anyone commits to it.
 *
 * <p>Each of these becomes a new object in the bucket under a new key, never a second reference to
 * the original — deleting one deal's copy must not reach into the other's evidence. Naming them is
 * what makes the copy automatic rather than a checkbox: nobody is surprised by what they asked for
 * once they have read it.
 *
 * <p>An empty file is said out loud too. An individual arriving already marked verified with
 * nothing behind them on this deal is exactly the thing a reviewer should notice.
 */
function CopiedDocuments({ documents }) {
  if (documents.length === 0) {
    return (
      <Stack direction="row" spacing={1} alignItems="baseline">
        <FactLabel>Documents</FactLabel>
        <Typography sx={{ fontSize: '0.82rem', color: tokens.muted }}>
          Nothing on file — none will be copied.
        </Typography>
      </Stack>
    );
  }

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="baseline">
        <FactLabel>Documents</FactLabel>
        <Typography sx={{ fontSize: '0.82rem', color: tokens.ink }}>
          {documents.length === 1
            ? '1 document will be copied onto this deal'
            : `${documents.length} documents will be copied onto this deal`}
        </Typography>
      </Stack>
      {/* Indented to the value column, so the list reads as detail under the sentence above it. */}
      <Stack spacing={0.25} sx={{ pl: '116px', pt: 0.5 }}>
        {documents.map((d) => (
          <Typography
            key={d.id}
            sx={{
              fontFamily: fonts.mono, fontSize: '0.68rem', color: tokens.muted,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {d.originalFilename}
            {d.idSide ? ` (${d.idSide.toLowerCase()})` : ''}
            {d.sizeBytes ? ` · ${formatBytes(d.sizeBytes)}` : ''}
          </Typography>
        ))}
      </Stack>
    </Box>
  );
}

function Fact({ label, value }) {
  if (!value) return null;
  return (
    <Stack direction="row" spacing={1} alignItems="baseline">
      <FactLabel>{label}</FactLabel>
      <Typography
        sx={{ fontSize: '0.82rem', color: tokens.ink, minWidth: 0, wordBreak: 'break-word' }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

function FactLabel({ children }) {
  return (
    <Typography
      sx={{
        fontFamily: fonts.mono, fontSize: '0.62rem', letterSpacing: '0.08em',
        textTransform: 'uppercase', color: tokens.muted,
        width: 108, flexShrink: 0,
      }}
    >
      {children}
    </Typography>
  );
}

function SectionLabel({ children }) {
  return (
    <Typography
      sx={{
        fontFamily: fonts.mono, fontSize: '0.62rem', letterSpacing: '0.12em',
        textTransform: 'uppercase', color: tokens.muted, pl: 0.5,
      }}
    >
      {children}
    </Typography>
  );
}
