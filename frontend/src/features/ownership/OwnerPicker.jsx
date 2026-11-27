import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Stack, TextField, Typography,
} from '@mui/material';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { getIndividual, listIndividuals } from '../../api/individuals.js';
import { useDashboardScope } from '../../dashboard/DashboardScope.jsx';
import { nameLabelFor, nodeTypeLabel, personRolesLabel } from '../../api/ownership.js';
import { visualFor, tintOf } from './nodeTypeVisual.js';
import { countryName } from '../../data/countries.js';
import { formatBytes, formatDate } from '../../utils/formatters.js';
import { verificationDisplay } from './verificationDisplay.js';
import { tokens, fonts, motion } from '../../theme/theme.js';
import { countText } from '../../components/ListPagination.jsx';
import { dealName } from '../../utils/dealName.js';

/** Past this many matches the list stops being a list and starts being a wall. */
const MAX_ROWS = 8;

/** The server ignores shorter search text (PageRequests.MIN_SEARCH_LENGTH). */
const MIN_SEARCH = 3;

/**
 * Names an owner of one type, either by finding one the firm has met before or by typing a new one.
 *
 * <p>Every type is searched, each only among its own kind: adding a trust offers the firm's trusts.
 * An entity, once picked, is copied with everyone beneath it — its shareholders, trustees and so on —
 * by the server ({@code POST /ownership/nodes/copy}); this panel says who that is before anyone
 * commits. An individual is copied as it always was, by the dialog, from the record shown here.
 *
 * <p>The rest of this note was written for individuals and holds for every type.
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
export function OwnerPicker({ nodeType, name, onNameChange, selected, onSelect, onClear, active }) {
  const individual = nodeType === 'INDIVIDUAL';
  const typeLabel = (nodeTypeLabel(nodeType) ?? 'owner').toLowerCase();
  const { firm } = useDashboardScope();
  const [openNodeId, setOpenNodeId] = useState(null);
  const inputRef = useRef(null);

  // Focus on arrival rather than on mount. The panel is mounted behind the type grid the whole
  // time so that a step back and forward does not lose what was typed, and an autoFocus would
  // therefore pull the caret out of a dialog still showing step one.
  useEffect(() => { if (active) inputRef.current?.focus(); }, [active]);

  const query = name.trim();
  // Searched on the server, 300 ms after typing stops, so a name is one request rather than one
  // per letter. It used to download every individual the firm had and filter here.
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Firm, never branch: an individual is on file for the firm, and a reviewer looking for someone
  // onboarded at another office should still find them. The params are advisory anyway — the
  // server narrows by role. Nothing until three characters are typed (the server ignores shorter
  // text, and a trigram search needs three): opening straight into every
  // person the firm has ever onboarded would be a list to scroll, not an answer to a question.
  const searching = Boolean(active) && debounced.length >= MIN_SEARCH;
  const listQ = useQuery({
    queryKey: ['individuals', 'picker', nodeType, firm?.id ?? null, debounced],
    queryFn: () => listIndividuals({ firmId: firm?.id, nodeType, q: debounced, size: MAX_ROWS }),
    enabled: searching,
  });

  const shown = searching ? listQ.data?.items ?? [] : [];
  // How many match in total; only the first MAX_ROWS are fetched.
  const matchCount = searching ? listQ.data?.totalElements ?? 0 : 0;
  const pending = query.length >= MIN_SEARCH && (query !== debounced || listQ.isLoading);

  if (selected) {
    return <Chosen owner={selected} onClear={onClear} />;
  }

  return (
    <Stack spacing={2}>
      <TextField
        fullWidth
        inputRef={inputRef}
        label={nameLabelFor(nodeType)}
        value={name}
        onChange={(e) => { onNameChange(e.target.value); setOpenNodeId(null); }}
        placeholder={`Start typing to search the ${individual ? 'individuals' : `${typeLabel} owners`} on your firm's deals`}
        helperText={individual
          ? 'Pick someone already on file, or keep typing to add a new individual.'
          : `Pick one already on file, or keep typing to add a new ${typeLabel}.`}
      />

      {listQ.isError && (
        <Alert severity="warning">
          Could not search your firm's owners. You can still add a new one by name.
        </Alert>
      )}

      {pending && (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 0.5 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" sx={{ color: tokens.muted }}>Searching…</Typography>
        </Stack>
      )}

      {!pending && matchCount > 0 && (
        <Stack spacing={1}>
          <SectionLabel>
            {matchCount > MAX_ROWS
              ? `Already on file — ${countText(listQ.data)} matches`
              : 'Already on file'}
          </SectionLabel>
          {shown.map((row) => (
            <OwnerRow
              key={row.nodeId}
              row={row}
              open={openNodeId === row.nodeId}
              onToggle={() => setOpenNodeId(openNodeId === row.nodeId ? null : row.nodeId)}
              onUse={onSelect}
            />
          ))}
          {matchCount > shown.length && (
            <Typography variant="caption" sx={{ color: tokens.muted, pl: 0.5 }}>
              {listQ.data?.totalExact === false ? 'Many' : matchCount - shown.length} more — keep typing to narrow it down.
            </Typography>
          )}
        </Stack>
      )}

      {query.length >= 2 && !pending && !listQ.isError && matchCount === 0 && (
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 0.5 }}>
          <PersonAddAltIcon sx={{ fontSize: 18, color: tokens.muted }} />
          <Typography variant="body2" sx={{ color: tokens.muted }}>
            {individual ? 'Nobody' : 'Nothing'} on file by that name. <strong>{query}</strong> will be added as a new {typeLabel}.
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}

/** One match. Collapsed it is a name and where it came from; open it is the whole record. */
function OwnerRow({ row, open, onToggle, onUse }) {
  const individual = row.nodeType === 'INDIVIDUAL';
  const { hue, Icon } = visualFor(row.nodeType);
  // What tells two owners of one name apart: a person's birthday, an entity's country.
  const distinguishing = individual
    ? formatDate(row.dateOfBirth)
    : (row.countryOfResidence ? (countryName(row.countryOfResidence) ?? row.countryOfResidence) : 'Country not recorded');
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
            backgroundColor: tintOf(hue), color: hue,
          }}
        >
          <Icon sx={{ fontSize: 19 }} />
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
            {distinguishing} · {dealName(row.propertyAddress)}
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
              {individual ? <PersonFacts person={detailQ.data} /> : <EntityFacts owner={detailQ.data} />}
              <Button variant="contained" size="small" onClick={() => onUse(detailQ.data)}>
                {individual ? 'Use this person' : `Use this ${(nodeTypeLabel(row.nodeType) ?? 'owner').toLowerCase()}`}
              </Button>
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
}

/** The owner the dialog will copy, with the way back out. */
function Chosen({ owner, onClear }) {
  const individual = owner.nodeType === 'INDIVIDUAL';
  const { hue, Icon } = visualFor(owner.nodeType);
  const beneath = owner.beneath?.length ?? 0;
  const from = dealName(owner.propertyAddress);
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
              backgroundColor: tokens.tile, color: hue,
            }}
          >
            <Icon sx={{ fontSize: 19 }} />
          </Box>
          <Typography sx={{ color: tokens.ink, fontSize: '1rem' }}>{owner.displayName}</Typography>
        </Stack>
        {individual ? <PersonFacts person={owner} /> : <EntityFacts owner={owner} />}
      </Box>

      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
        <Typography variant="caption" sx={{ color: tokens.muted }}>
          {individual || beneath === 0
            ? <>These details are copied onto this deal. Changing them here leaves the record on {from} untouched.</>
            : <>{owner.displayName} and the {beneath === 1 ? 'owner' : `${beneath} owners`} beneath it are copied
              {' '}onto this deal. Changing them here leaves the records on {from} untouched.</>}
        </Typography>
        <Button size="small" onClick={onClear} sx={{ flexShrink: 0 }}>
          {individual ? 'Choose someone else' : 'Choose another'}
        </Button>
      </Stack>
    </Stack>
  );
}

/**
 * An entity, laid out the same whether it is being considered or has been chosen: its own facts,
 * then everyone beneath it, since the copy takes them all, then the evidence that travels.
 */
function EntityFacts({ owner }) {
  const e = owner.entity ?? {};
  const country = e.jurisdictionCountry ? (countryName(e.jurisdictionCountry) ?? e.jurisdictionCountry) : null;
  const beneath = owner.beneath ?? [];
  const docsBeneath = owner.documentsBeneath ?? 0;
  return (
    <Stack spacing={0.75}>
      <Fact label="Type" value={nodeTypeLabel(owner.nodeType)} />
      <Fact label="Country" value={country} />
      <Fact label="Company no." value={e.companyNumber} />
      <Fact label="NZBN / ABN" value={e.businessNumber} />
      <Fact label="Incorporated" value={e.incorporationDate ? formatDate(e.incorporationDate) : null} />
      <Fact label="Registered office" value={e.registeredOffice} />
      <Fact label="Trust name" value={e.trustName !== owner.displayName ? e.trustName : null} />
      <Fact label="Settlor" value={e.settlorName} />
      <Fact label="From" value={dealName(owner.propertyAddress)} />

      <Stack direction="row" spacing={1} alignItems="baseline" sx={{ pt: 0.25 }}>
        <FactLabel>Owners beneath</FactLabel>
        <Typography sx={{ fontSize: '0.82rem', color: beneath.length ? tokens.ink : tokens.muted }}>
          {beneath.length === 0
            ? 'None recorded — only this owner is copied.'
            : `${beneath.length} ${beneath.length === 1 ? 'owner is' : 'owners are'} copied with it`}
        </Typography>
      </Stack>
      {beneath.length > 0 && (
        <Stack spacing={0.4} sx={{ pl: '116px' }}>
          {beneath.map((b) => {
            const { hue, Icon } = visualFor(b.nodeType);
            const share = [b.percentage != null ? `${Number(b.percentage)}%` : null,
              b.role ? b.role.charAt(0) + b.role.slice(1).toLowerCase() : null].filter(Boolean).join(' · ');
            return (
              <Stack key={b.nodeId} direction="row" spacing={0.75} alignItems="center"
                     sx={{ pl: `${(b.depth - 1) * 14}px`, minWidth: 0 }}>
                <Icon sx={{ fontSize: 14, color: hue, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.8rem', color: tokens.ink, whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {b.displayName}
                </Typography>
                {share && (
                  <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.66rem', color: tokens.muted, flexShrink: 0 }}>
                    {share}
                  </Typography>
                )}
              </Stack>
            );
          })}
        </Stack>
      )}

      <CopiedDocuments documents={owner.documents ?? []} />
      {docsBeneath > 0 && (
        <Typography sx={{ fontSize: '0.78rem', color: tokens.muted, pl: '116px' }}>
          …and {docsBeneath === 1 ? '1 document' : `${docsBeneath} documents`} held by the owners beneath it.
        </Typography>
      )}
      <VerificationFact status={owner.verificationStatus} />
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
      <Fact label="Address" value={p.physicalAddress} />
      {/* "Type" rather than "Role", matching what the form that captured it calls the field. */}
      <Fact label="Type" value={personRolesLabel(person.personRoles)} />
      <Fact
        label="From"
        value={dealName(person.propertyAddress)}
      />
      <CopiedDocuments documents={person.documents ?? []} />
      {/* Carried across with the rest, and said out loud: a status reached on another file is
          worth knowing about on this one. */}
      <VerificationFact status={person.verificationStatus} />
    </Stack>
  );
}

/**
 * A status reached on another file, said out loud: worth knowing about on this one. The same
 * three states, and the same colours, as the tree row this owner will become. A plain grey chip
 * here saying "verified" next to a green one there is the same fact told two ways, which is how a
 * reviewer ends up trusting neither.
 */
function VerificationFact({ status }) {
  if (!status) return null;
  const v = verificationDisplay(status);
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 0.25 }}>
      <FactLabel>Verification</FactLabel>
      <Chip
        size="small"
        icon={v.exception
          ? <ErrorOutlineIcon sx={{ fontSize: '0.8rem !important' }} />
          : undefined}
        label={v.label}
        sx={{
          height: 20, fontSize: '0.68rem',
          color: v.text,
          backgroundColor: v.wash,
          border: `1px solid ${v.border}`,
          '& .MuiChip-icon': { color: 'var(--cl-warn-text)', ml: 0.5, mr: -0.25 },
        }}
      />
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
