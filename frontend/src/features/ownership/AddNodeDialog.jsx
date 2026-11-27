import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, Slide, Stack, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBackIosNew';
import { NODE_TYPES, nodeTypeLabel } from '../../api/ownership.js';
import { OwnerPicker } from './OwnerPicker.jsx';
import { visualFor, tintOf } from './nodeTypeVisual.js';
import { tokens, fonts, motion } from '../../theme/theme.js';

/**
 * What the picker offers. `OTHER` is a real stored type and still renders everywhere else, but
 * nobody should be choosing it: an owner nobody could classify is a gap in the file, not a kind
 * of owner.
 */
const PICKABLE = NODE_TYPES.filter((t) => t.value !== 'OTHER');

/**
 * The step that isn't showing is taken out of the layout but stays mounted, so moving between
 * them never loses what has already been typed. Same device as AddSuspiciousActivityDialog.
 */
const panelSx = (active) => (active
  ? { position: 'relative' }
  : { position: 'absolute', top: 0, left: 0, right: 0 });

/**
 * Adds an owner: pick a type, then find it on the firm's other deals or name a new one.
 *
 * <p>Every type slides to a search over the firm's own owners of that type. The firm has very
 * likely met this person, company or trust before, and asking a reviewer to re-key what the file
 * already holds is asking them to introduce a typo. Typing a name nobody has on file adds a new,
 * blank owner, exactly as before.
 *
 * <p><strong>Choosing an existing owner copies it, it never links to it.</strong> A correction made
 * here stays off the deal it was copied from:
 *   - an individual is copied by this dialog, from field values only — never a person id — so
 *     {@code OwnershipService.createNode} mints a fresh person record;
 *   - an entity is copied by the server with everyone beneath it — shareholders, trustees, and
 *     theirs — their documents and how they hold one another ({@code OwnershipService.copyOwner}).
 *
 * <p>On submit:
 *   1) POST /ownership/nodes (new, or a copied individual) or /ownership/nodes/copy (an entity)
 *   2) (if parentNodeId) POST /ownership/edges — no percentage; the drawer sets that
 *
 * Props:
 *   open, onClose
 *   parentNodeId: number | null — if set, the new owner is linked under that parent
 *   parentLabel: string — the parent's name, named in the subtitle
 *   useTree: result of useOwnershipTree(dealId)
 *   onCreated: (nodeId) => void — the review screen opens the drawer on it
 */
export function AddNodeDialog({
  open, onClose, parentNodeId, parentLabel, useTree, onCreated,
}) {
  const [step, setStep] = useState('type');       // 'type' | 'person'
  const [nodeType, setNodeType] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [person, setPerson] = useState(null);     // the chosen existing owner's full record, or null
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const slideRef = useRef(null);

  useEffect(() => {
    if (open) {
      setStep('type');
      setNodeType(null);
      setDisplayName('');
      setPerson(null);
      setError(null);
    }
  }, [open]);

  const isIndividual = nodeType === 'INDIVIDUAL';

  const pickType = (value) => {
    // An owner chosen as one type means nothing once the type changes, so it goes.
    if (value !== nodeType) setPerson(null);
    setNodeType(value);
    setStep('person');
  };

  const choosePerson = (detail) => {
    setPerson(detail);
    setDisplayName(detail.displayName ?? '');
  };

  /**
   * Field values, never `beneficialOwnerId`. The server creates this node its own person record;
   * passing an id would make two deals share one, and an edit on either would rewrite both.
   */
  const buildPayload = () => {
    const base = { nodeType, displayName: displayName.trim() };
    if (!isIndividual || !person) return base;

    const p = person.person ?? {};
    return {
      ...base,
      dateOfBirth: person.dateOfBirth ?? null,
      idDocumentType: person.idDocumentType ?? null,
      idDocumentNumber: person.idDocumentNumber ?? null,
      idDocumentCountry: person.idDocumentCountry ?? null,
      personRoles: person.personRoles ?? [],
      // Carried across, and now so is the evidence behind it — see below.
      verificationStatus: person.verificationStatus ?? null,
      // The node to copy documents from. Each becomes a new object under a new key on this deal,
      // so neither deal can delete the other's evidence. The server checks the caller may read
      // that deal before it copies anything.
      copyDocumentsFromNodeId: person.nodeId,
      person: {
        fullName: displayName.trim(),
        email: p.email ?? null,
        phoneCountry: p.phoneCountry ?? null,
        phoneNumber: p.phoneNumber ?? null,
        occupation: p.occupation ?? null,
        sourceOfFunds: p.sourceOfFunds ?? null,
        countryOfResidence: p.countryOfResidence ?? null,
        physicalAddress: p.physicalAddress ?? null,
      },
    };
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!nodeType || !displayName.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      // An entity is copied whole on the server; an individual and a new owner go through create.
      const created = person && !isIndividual
        ? await useTree.copyOwner.mutateAsync(person.nodeId)
        : await useTree.createNode.mutateAsync(buildPayload());
      if (parentNodeId != null) {
        await useTree.createEdge.mutateAsync({
          parentNodeId,
          childNodeId: created.id,
          percentage: null,
        });
      }
      onClose();
      onCreated?.(created.id);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not add this owner');
    } finally {
      setSubmitting(false);
    }
  };

  const onPerson = step === 'person';
  // Reachable only by stepping back: a type is already chosen, so the button carries on to the
  // search rather than pretending the name can be given here.
  const continueToPerson = !onPerson && Boolean(nodeType);
  const typeLabel = (nodeTypeLabel(nodeType) ?? 'owner').toLowerCase();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogContent sx={{ pt: 4, pb: 2, overflowX: 'hidden' }}>
          <Stack spacing={1} sx={{ textAlign: 'center', mb: 3 }}>
            <Typography sx={{ fontFamily: fonts.display, fontSize: '1.3rem', color: tokens.ink }}>
              {onPerson ? (isIndividual ? 'Who is this?' : `Which ${typeLabel}?`) : 'Add owner'}
            </Typography>
            <Typography variant="body2" sx={{ color: tokens.muted }}>
              {onPerson
                ? (isIndividual
                  ? 'Search the people on your firm’s deals, or type a name to add someone new.'
                  : `Search the ${typeLabel} owners on your firm’s deals, or type a name to add a new one.`)
                : (parentNodeId != null
                  ? <>What sits under <strong>{parentLabel}</strong>?</>
                  : 'What type of owner do you want to add?')}
            </Typography>
          </Stack>

          <Box ref={slideRef} sx={{ position: 'relative' }}>
            {/* Step one slides back in from the left; the search comes from the right. */}
            <Slide direction="right" in={!onPerson} appear={false} container={slideRef.current}>
              <Box sx={panelSx(!onPerson)}>
                <Box
                  sx={{
                    display: 'grid',
                    // Four across where there is room, two on a phone. A CSS grid rather than
                    // MUI's, which is mid-migration between two APIs and not worth the argument.
                    gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
                    gap: 1.25,
                  }}
                >
                  {PICKABLE.map((t) => (
                    <TypeCard
                      key={t.value}
                      type={t}
                      selected={nodeType === t.value}
                      onSelect={() => pickType(t.value)}
                    />
                  ))}
                </Box>
              </Box>
            </Slide>

            <Slide direction="left" in={onPerson} appear={false} container={slideRef.current}>
              <Box sx={panelSx(onPerson)}>
                <OwnerPicker
                  nodeType={nodeType}
                  name={displayName}
                  onNameChange={setDisplayName}
                  selected={person}
                  onSelect={choosePerson}
                  onClear={() => setPerson(null)}
                  active={onPerson}
                />
              </Box>
            </Slide>
          </Box>

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          {onPerson ? (
            <Button
              onClick={() => setStep('type')}
              disabled={submitting}
              startIcon={<ArrowBackIcon sx={{ fontSize: 13 }} />}
            >
              Type
            </Button>
          ) : (
            <Button onClick={onClose} disabled={submitting}>Cancel</Button>
          )}
          <Box sx={{ flex: 1 }} />
          {continueToPerson ? (
            <Button type="button" variant="contained" onClick={() => setStep('person')}>
              Continue
            </Button>
          ) : (
            <Button
              type="submit"
              variant="contained"
              disabled={submitting || !nodeType || !displayName.trim()}
            >
              {submitting ? 'Adding…' : 'Add owner'}
            </Button>
          )}
        </DialogActions>
      </Box>
    </Dialog>
  );
}

/** One owner type: its colour, its glyph, its name. */
function TypeCard({ type, selected, onSelect }) {
  const { hue, Icon } = visualFor(type.value);

  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      sx={motion.respectful({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 2,
        cursor: 'pointer',
        borderRadius: 3,
        backgroundColor: selected ? tokens.blueWash : tokens.tile,
        // One border that changes colour rather than a border plus a ring: an outline added on
        // selection would shift every neighbouring card by a pixel.
        border: `1.5px solid ${selected ? tokens.blue : tokens.hairline}`,
        font: 'inherit',
        transition: `background-color ${motion.swift} ease, border-color ${motion.swift} ease`,
        '&:hover': { backgroundColor: selected ? tokens.blueWash : tokens.hover },
        '&:focus-visible': { outline: `2px solid ${tokens.blue}`, outlineOffset: 2 },
      })}
    >
      <Box
        sx={{
          width: 48, height: 48, borderRadius: '50%',
          display: 'grid', placeItems: 'center',
          backgroundColor: tintOf(hue),
          color: hue,
        }}
      >
        <Icon sx={{ fontSize: 26 }} />
      </Box>
      <Typography
        variant="caption"
        sx={{ color: tokens.ink, lineHeight: 1.25, textAlign: 'center' }}
      >
        {type.label}
      </Typography>
    </Box>
  );
}
