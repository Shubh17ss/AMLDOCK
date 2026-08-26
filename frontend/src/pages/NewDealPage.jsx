import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Stack, Step, StepLabel, Stepper,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { deleteDeal, submitDealForReview } from '../api/deals.js';
import { ID_DOCUMENT_TYPES, listDealDocuments, uploadToS3 } from '../api/documents.js';
import { LoadingOverlay } from '../components/LoadingOverlay.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { useDealDraft } from '../features/deal/create/useDealDraft.js';
import { sectionGaps } from '../features/deal/create/dealDraftModel.js';
import { SectionProgress, SaveStateChip } from '../features/deal/create/SectionShell.jsx';
import { Section1ClientType } from '../features/deal/create/Section1ClientType.jsx';
import { Section2Address } from '../features/deal/create/Section2Address.jsx';
import { Section3Details } from '../features/deal/create/Section3Details.jsx';
import { Section4Identity } from '../features/deal/create/Section4Identity.jsx';
import { Section5Risk } from '../features/deal/create/Section5Risk.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { isDealAuthor, isDealReviewer } from '../auth/roles.js';
import { canEditContent } from '../data/dealStatus.js';
import { tokens } from '../theme/theme.js';

const SECTIONS = ['Your client', 'The property', 'Property details', 'Client identity', 'Risk & valuation'];

/** Where section 2's Create button leaves the broker: their own list, with the new deal on it. */
const AFTER_CREATE = '/my-deals';

/** Editing an existing deal opens here — sections 1 and 2 are already answered. */
const FIRST_EDIT_SECTION = 2;

/**
 * The broker's deal-creation form.
 *
 * Five sections, saved to the server as the broker moves through them. The deal is created at
 * the end of section 2, off the client role and the property address alone: that is the least a
 * deal can be identified by, and asking for more before anything is saved is what made brokers
 * abandon the form half-finished. Creating there also means sections 3 onward have a dealId to
 * hang document uploads on.
 *
 * Section 2 therefore ends the *creation* run — the broker is told the deal exists and sent to
 * their list. Coming back to it opens at section 3, which is where the unanswered questions
 * start.
 *
 * The firm isn't asked for, and nor is the branch for most people: branch-level staff may only
 * create deals on the branch they're assigned to, and the API derives it from the caller. Only
 * firm-level staff — a compliance officer or senior manager, who belong to no single branch —
 * are asked, in section 1.
 */
const ID_DOCUMENT_TYPE_VALUES = new Set(ID_DOCUMENT_TYPES.map((t) => t.value));

export function NewDealPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { id: routeDealId } = useParams();
  const [params] = useSearchParams();
  // Either entry point resumes the same way. The route param is the real one; the query form is
  // kept because it costs nothing and is a valid way to link to a half-finished deal.
  const resumeDealId = routeDealId ?? params.get('dealId');
  const isEditMode = Boolean(routeDealId);

  const draft = useDealDraft({ resumeDealId });
  const { form, setField, setNested, setGroup, dealId, deal, saveState, error, setError } = draft;

  // A resumed deal opens at section 3: sections 1 and 2 are what created it, and re-asking
  // them is exactly the friction this split removes. They stay reachable with Back.
  const [section, setSection] = useState(resumeDealId ? FIRST_EDIT_SECTION : 0);
  const [documents, setDocuments] = useState([]);
  const [purposeBlob, setPurposeBlob] = useState(null);
  const [notesBlob, setNotesBlob] = useState(null);
  const [overlay, setOverlay] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showGaps, setShowGaps] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Firm-level staff have no branch for the server to derive, so section 1 asks them for one and
  // will not let them past without it.
  const branchRequired = Boolean(user && !user.firmBranchId && user.realEstateFirmId);
  const gaps = sectionGaps(section + 1, form, { branchRequired });
  const purchaserBlocked = form.clientRole === 'PURCHASER';
  const canAdvance = gaps.length === 0 && !purchaserBlocked;

  // Each section change returns the broker to the top — the page scrolls via the window in
  // AppShell, so a new section would otherwise open halfway down.
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [section]);
  useEffect(() => { setShowGaps(false); }, [section]);

  /* ---------- documents ---------- */

  // Refetched whenever a draft appears, so a resumed draft shows the scans already attached.
  useEffect(() => {
    if (!dealId) return;
    listDealDocuments(dealId).then(setDocuments).catch(() => {});
  }, [dealId]);

  const handleUploaded = (doc) => setDocuments((ds) => [doc, ...ds]);
  const handleRemoved = (id) => setDocuments((ds) => ds.filter((d) => d.id !== id));

  const idDocuments = useMemo(
    // Identity documents only — supporting evidence is filed elsewhere and never creates a person.
    () => documents.filter((d) => ID_DOCUMENT_TYPE_VALUES.has(d.documentType)),
    [documents],
  );
  // Extraction runs server-side off the request thread, so nothing pushes the result back here.
  // Poll only while a scan is actually in flight — once every ID reads DONE or FAILED this stops
  // on its own, so an idle form makes no requests.
  const extractionInFlight = useMemo(
    () => idDocuments.some((d) => d.ocrStatus === 'PENDING' || d.ocrStatus === 'IN_PROGRESS'),
    [idDocuments],
  );

  useEffect(() => {
    if (!dealId || !extractionInFlight) return undefined;
    const timer = setInterval(() => {
      listDealDocuments(dealId).then(setDocuments).catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [dealId, extractionInFlight]);

  /**
   * Voice blobs live in browser state until their section is left — VoiceRecorderField hands
   * over a Blob and leaves uploading to the caller. Flushing at the section boundary rather
   * than at submit means a broker who abandons the form still has their recording saved.
   */
  const flushVoice = async (blob, documentType, id) => {
    if (!blob || !id) return;
    const ext = blob.type?.includes('webm') ? 'webm' : 'audio';
    const file = new File([blob], `${documentType.toLowerCase()}-${Date.now()}.${ext}`, {
      type: blob.type || 'audio/webm',
    });
    const doc = await uploadToS3({ file, documentType, dealId: id });
    handleUploaded(doc);
  };

  /* ---------- navigation ---------- */

  const goNext = async () => {
    if (!canAdvance) { setShowGaps(true); return; }
    setBusy(true);
    setError(null);
    try {
      // Nothing here creates a deal - that is section 2's Create button and nowhere else, so
      // stepping past section 1 on a fresh form leaves no record behind.
      if (dealId) await draft.saveNow();
      // The purpose recorder lives in section 3, so its blob flushes on the way out of it.
      if (section === 2) {
        await flushVoice(purposeBlob, 'VOICE_NOTE_PURPOSE', dealId).then(() => setPurposeBlob(null));
      }
      setSection((s) => s + 1);
    } catch {
      // useDealDraft has already surfaced the message; staying put is the right response.
    } finally {
      setBusy(false);
    }
  };

  /**
   * Section 2's primary action, on a form that has not created its deal yet.
   *
   * The deal is created and the broker leaves — they are told it exists and sent to their list,
   * rather than being walked through four more sections before anything is theirs to come back
   * to. Everything after this is editing a real record.
   */
  const handleCreate = async () => {
    if (!canAdvance) { setShowGaps(true); return; }
    setOverlay({ title: 'Creating the deal', subText: 'Saving the property and opening the file…' });
    try {
      const id = await draft.ensureDraft();
      if (!id) return;
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      showToast({ severity: 'success', message: 'Deal created — open it to carry on' });
      navigate(AFTER_CREATE);
    } catch (e) {
      const msg = e.response?.data?.message || 'Could not create the deal';
      setError(msg);
      showToast({ severity: 'error', message: msg });
    } finally {
      setOverlay(null);
    }
  };

  // Going back saves too. The wizard this replaces only ever saved going forward, which is
  // half of why edits went missing.
  const goBack = async () => {
    setBusy(true);
    try {
      if (dealId) await draft.saveNow();
    } catch {
      /* let them move regardless — the autosave will retry */
    } finally {
      setBusy(false);
      setSection((s) => Math.max(0, s - 1));
    }
  };

  const handleSubmit = async () => {
    if (!canAdvance) { setShowGaps(true); return; }
    setOverlay({
      title: 'Submitting for review',
      subText: 'Saving your answers, uploading attachments and passing the deal to compliance…',
    });
    try {
      const id = await draft.ensureDraft();
      if (!id) return;
      await flushVoice(notesBlob, 'VOICE_NOTE', id);
      setNotesBlob(null);
      await submitDealForReview(id);
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      showToast({ severity: 'success', message: 'Deal submitted for review' });
      navigate(`/deals/${id}`);
    } catch (e) {
      const msg = e.response?.data?.message || 'Could not submit the deal for review';
      setError(msg);
      showToast({ severity: 'error', message: msg });
    } finally {
      setOverlay(null);
    }
  };

  /**
   * Discarding always asks first. It deletes a real deal from the server — with whatever ID
   * scans are already attached to it — and the button sits next to Back on a form used
   * one-handed on a phone, where a mis-tap is not a remote possibility.
   *
   * The one case that skips the dialog is an untouched form: no draft on the server and nothing
   * typed, so there is nothing to lose and a prompt would only be in the way.
   */
  const requestDiscard = () => {
    if (!dealId && !draft.isDirty()) { navigate('/my-deals'); return; }
    setConfirmDelete(true);
  };

  const handleDiscard = async () => {
    setConfirmDelete(false);
    // A deal that exists on the server is genuinely deleted, not just navigated away from.
    if (dealId) {
      setOverlay({ title: isEditMode ? 'Deleting deal' : 'Discarding draft' });
      try {
        await deleteDeal(dealId);
        queryClient.invalidateQueries({ queryKey: ['deals'] });
      } catch (e) {
        showToast({
          severity: 'error',
          message: e.response?.data?.message
            || (isEditMode ? 'Could not delete the deal' : 'Could not discard the draft'),
        });
        setOverlay(null);
        return;
      }
      setOverlay(null);
    }
    navigate('/my-deals');
  };

  if (draft.loadingResume) {
    return <LoadingOverlay open title="Opening your draft…" />;
  }

  // Editing is only possible while a deal is NEW, and only by its broker or a reviewer of the
  // firm. Anyone else — or anyone still here after the deal moved on — goes to the deal page.
  //
  // Deliberately wider than DealReviewScreen's redirect, which now sends only the owning broker
  // here. A reviewer is no longer routed to this form, but is not turned away from it either: the
  // form is still the only place the sections behind the deal's creation can be revisited, and
  // because the redirect no longer reaches for reviewers, admitting them here cannot loop.
  const isOwnerAgent = isDealAuthor(user?.role) && user?.userId === deal?.createdByUserId;
  // Status and role together: a reviewer may still open a handed-over deal, its author may
  // not. Checking the status alone sent reviewers to the read-only view on every deal they
  // were actually meant to be working on.
  const mayEdit = (isOwnerAgent || isDealReviewer(user?.role))
    && canEditContent(deal?.status, user?.role);
  if (isEditMode && deal && !mayEdit) {
    return <Navigate to={`/deals/${resumeDealId}`} replace />;
  }

  const isLast = section === SECTIONS.length - 1;
  // Section 2 ends the creation run, but only on a form that has not created its deal yet.
  // Once one exists — in edit mode, or after stepping back — it is an ordinary Next, so the
  // address stays correctable without creating a second deal.
  const isCreateStep = section === 1 && !dealId;

  return (
    <Stack spacing={3}>
      <LoadingOverlay open={Boolean(overlay)} title={overlay?.title} subText={overlay?.subText} />

      <PageHeader
        eyebrow={`section ${section + 1} of ${SECTIONS.length}`}
        title={isEditMode ? `Editing ${deal?.reference ?? 'deal'}` : 'New deal'}
        actions={<SaveStateChip state={saveState} hasDraft={Boolean(dealId)} />}
      />

      <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
        <Stepper activeStep={section} alternativeLabel>
          {SECTIONS.map((label) => (
            <Step key={label}>
              <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '0.72rem', fontWeight: 600, mt: 0.5 } }}>
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>
      <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
        <SectionProgress index={section} total={SECTIONS.length} label={SECTIONS[section]} />
      </Box>

      {section === 0 && (
        <Section1ClientType
          form={form}
          setField={setField}
          locked={Boolean(dealId)}
          branchRequired={branchRequired}
          firmId={user?.realEstateFirmId ?? null}
        />
      )}
      {section === 1 && (
        <Section2Address form={form} setGroup={setGroup} />
      )}
      {section === 2 && (
        <Section3Details
          form={form}
          setField={setField}
          setNested={setNested}
          voiceBlob={purposeBlob}
          onVoiceChange={setPurposeBlob}
        />
      )}
      {section === 3 && (
        <Section4Identity
          form={form}
          setField={setField}
          dealId={dealId}
          idDocuments={idDocuments}
          onUploaded={handleUploaded}
          onRemoved={handleRemoved}
        />
      )}
      {section === 4 && (
        <Section5Risk
          form={form}
          setField={setField}
          voiceBlob={notesBlob}
          onVoiceChange={setNotesBlob}
        />
      )}

      {showGaps && gaps.length > 0 && (
        <Alert severity="warning" onClose={() => setShowGaps(false)}>
          Still needed before you can continue:
          <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
            {gaps.map((g) => <li key={g}>{g}</li>)}
          </Box>
        </Alert>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {isLast && deal?.reference && (
        <Alert severity="info">
          Submitting moves <strong>{deal.reference}</strong> to <strong>In review</strong> and
          locks it from further edits. It's already saved, so you can leave and finish later from{' '}
          <strong>My deals</strong> — once it is with compliance, only they can send it back.
        </Alert>
      )}

      <Stack
        direction={{ xs: 'column-reverse', sm: 'row' }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        {/* Padding rather than margin for the mobile gap: the parent Stack's `spacing` sets a
            margin on each direct child, which would override the button's own `mt`. */}
        <Box sx={{ width: { xs: '100%', sm: 'auto' }, pt: { xs: 4, sm: 0 } }}>
          {/* Named for what it does. In edit mode the broker arrived from a deal page, where
              "Discard" would read as "cancel my edits" rather than "delete this deal". */}
          <Button
            onClick={requestDiscard}
            disabled={busy}
            startIcon={<DeleteOutlineIcon />}
            sx={{
              width: { xs: '100%', sm: 'auto' },
              color: tokens.rejected,
              '&:hover': { backgroundColor: 'var(--cl-err-wash)', color: tokens.rejected },
            }}
          >
            {isEditMode ? 'Delete deal' : 'Discard'}
          </Button>
        </Box>

        {/* Back and the primary action, and nothing else. On the last section the two share a
            two-column grid so "Submit for review" carries the same weight as Back rather than
            reading as the longer of two options. `inline-grid` rather than `grid`: the main
            column has no maxWidth, so a stretching grid would make both buttons half a screen
            wide on a desktop. */}
        <Box
          sx={{
            display: { xs: 'grid', sm: isLast ? 'inline-grid' : 'flex' },
            gridTemplateColumns: '1fr 1fr',
            gap: 1.5,
            justifyContent: { sm: 'flex-end' },
          }}
        >
          <Button onClick={goBack} disabled={section === 0 || busy}>
            Back
          </Button>
          <Button
            variant="contained"
            onClick={isLast ? handleSubmit : isCreateStep ? handleCreate : goNext}
            // Not disabled on incomplete input — clicking says what's missing, which beats a
            // dead button the broker has to reverse-engineer.
            disabled={busy || purchaserBlocked}
          >
            {busy ? 'Saving…' : isLast ? 'Submit for review' : isCreateStep ? 'Create' : 'Next'}
          </Button>
        </Box>
      </Stack>

      {/* fullWidth + xs so the card is the same centred shape on a phone as on a desktop, rather
          than a narrow box shrink-wrapped to whichever sentence it happens to be showing. */}
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        fullWidth
        maxWidth="xs"
        aria-labelledby="confirm-discard-title"
      >
        <DialogTitle id="confirm-discard-title">
          {isEditMode ? 'Delete this deal?' : 'Discard this draft?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {isEditMode ? (
              <>
                <strong>{deal?.reference ?? `#${dealId}`}</strong> will be removed permanently,
                along with its property and client records. This cannot be undone.
              </>
            ) : dealId ? (
              // Said plainly because it surprises people: the draft is already on the server by
              // section 3, and the ID scans uploaded into it go with it.
              <>
                This draft is already saved, so discarding deletes it — along with any ID scans
                you have uploaded. This cannot be undone.
              </>
            ) : (
              <>Nothing has been saved yet. What you have entered on this form will be lost.</>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          {/* Cancel is the resting choice: it holds the focus, so a stray Enter backs out
              rather than deleting. */}
          <Button onClick={() => setConfirmDelete(false)} autoFocus>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDiscard} disabled={busy}>
            {isEditMode ? 'Delete' : 'Discard'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
