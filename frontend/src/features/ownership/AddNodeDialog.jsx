import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, Slide, Stack, TextField, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBackIosNew';
import { NODE_TYPES, nameLabelFor } from '../../api/ownership.js';
import { IndividualPicker } from './IndividualPicker.jsx';
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
 * Adds an owner: pick a type, name it, done.
 *
 * <p>Two steps, but only for one type. Every entity is named by typing its name, because there is
 * nothing to look up — a company on another deal is a different company on this one. An
 * individual is the exception: the firm has very likely met this person before, and asking a
 * reviewer to re-key a date of birth the file already holds is asking them to introduce a typo.
 * So INDIVIDUAL slides to a search over the firm's own people; the other eleven types keep the
 * name field revealed inline under the grid, exactly as before.
 *
 * <p><strong>Choosing an existing individual copies them, it does not link to them.</strong> The
 * payload carries field values only — never a person id — so {@code OwnershipService.createNode}
 * mints a fresh person record as it always has. That is what keeps a correction made here off the
 * deal the details were copied from.
 *
 * <p>On submit:
 *   1) POST /ownership/nodes — the type, the name, and for a copied individual their details
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
  const [person, setPerson] = useState(null);     // a copied individual's full record, or null
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
    setNodeType(value);
    // A person copied from another deal means nothing once the type is a company, so it goes.
    if (value !== 'INDIVIDUAL') setPerson(null);
    else setStep('person');
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
      personRole: person.personRole ?? null,
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
      },
    };
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!nodeType || !displayName.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const created = await useTree.createNode.mutateAsync(buildPayload());
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
  // Reachable only by stepping back: the type is already Individual, so the button carries on
  // rather than pretending the name can be given here.
  const continueToPerson = !onPerson && isIndividual;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogContent sx={{ pt: 4, pb: 2, overflowX: 'hidden' }}>
          <Stack spacing={1} sx={{ textAlign: 'center', mb: 3 }}>
            <Typography sx={{ fontFamily: fonts.display, fontSize: '1.3rem', color: tokens.ink }}>
              {onPerson ? 'Who is this?' : 'Add owner'}
            </Typography>
            <Typography variant="body2" sx={{ color: tokens.muted }}>
              {onPerson
                ? 'Search the people on your firm’s deals, or type a name to add someone new.'
                : (parentNodeId != null
                  ? <>What sits under <strong>{parentLabel}</strong>?</>
                  : 'What type of owner do you want to add?')}
            </Typography>
          </Stack>

          <Box ref={slideRef} sx={{ position: 'relative' }}>
            {/* Step one slides back in from the left; the individual search comes from the right. */}
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

                {/* The one thing the drawer cannot supply, because an owner has to exist before it
                    can be edited and the name is the only field the database insists on. An
                    individual is named on the next step instead, against the firm's own records. */}
                {nodeType && !isIndividual && (
                  <Box sx={motion.respectful({
                    mt: 3,
                    animation: `nameIn ${motion.swift} ${motion.ease} both`,
                    '@keyframes nameIn': {
                      from: { opacity: 0, transform: 'translateY(-4px)' },
                      to: { opacity: 1, transform: 'none' },
                    },
                  })}>
                    <TextField
                      fullWidth
                      autoFocus
                      label={nameLabelFor(nodeType)}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      helperText="Everything else is filled in on the owner's own panel."
                    />
                  </Box>
                )}
              </Box>
            </Slide>

            <Slide direction="left" in={onPerson} appear={false} container={slideRef.current}>
              <Box sx={panelSx(onPerson)}>
                <IndividualPicker
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
