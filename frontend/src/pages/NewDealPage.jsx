import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Stack, Step, StepLabel, Stepper,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { deleteDeal, handoverDeal } from '../api/deals.js';
import { ID_DOCUMENT_TYPES, listDealDocuments, uploadToS3 } from '../api/documents.js';
import { LoadingOverlay } from '../components/LoadingOverlay.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { useDealDraft } from '../features/deal/create/useDealDraft.js';
import { sectionGaps } from '../features/deal/create/dealDraftModel.js';
import { SectionProgress, SaveStateChip } from '../features/deal/create/SectionShell.jsx';
import { Section1ClientType } from '../features/deal/create/Section1ClientType.jsx';
import { Section2Property } from '../features/deal/create/Section2Property.jsx';
import { Section3Identity } from '../features/deal/create/Section3Identity.jsx';
import { Section4Risk } from '../features/deal/create/Section4Risk.jsx';
import { DealNotesTimeline } from '../features/deal/DealNotesTimeline.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { isDealAuthor, isDealReviewer } from '../auth/roles.js';
import { canEditContent } from '../data/dealStatus.js';
import { tokens } from '../theme/theme.js';

// Deal-status notifications sit top-centre so they read as a prominent, page-level result
// rather than an incidental corner toast.
const TOP_CENTER = { vertical: 'top', horizontal: 'center' };

const SECTIONS = ['Your client', 'The property', 'Client identity', 'Risk & valuation'];

/**
 * The broker's deal-creation form.
 *
 * Four sections, saved to the server as the broker moves through them. The draft is created at
 * the section 2 → 3 boundary because sections 3 and 4 upload documents, which need a dealId to
 * attach to — earlier would leave an orphan draft behind every abandoned page load.
 *
 * Firm and branch aren't asked for: agents may only create deals on the branch they're
 * assigned to, and the API derives it from the caller.
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

  const [section, setSection] = useState(0);
  const [documents, setDocuments] = useState([]);
  const [purposeBlob, setPurposeBlob] = useState(null);
  const [notesBlob, setNotesBlob] = useState(null);
  const [overlay, setOverlay] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showGaps, setShowGaps] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const gaps = sectionGaps(section + 1, form);
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

  const minEvidence = documents.find((d) => d.documentType === 'VALUATION_MIN_EVIDENCE');
  const maxEvidence = documents.find((d) => d.documentType === 'VALUATION_MAX_EVIDENCE');

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
      // Section 2 → 3 is where the deal becomes real, because section 3 uploads.
      if (section === 1) {
        const id = await draft.ensureDraft();
        if (!id) return;
        await flushVoice(purposeBlob, 'VOICE_NOTE_PURPOSE', id).then(() => setPurposeBlob(null));
      } else if (dealId) {
        await draft.saveNow();
      }
      setSection((s) => s + 1);
    } catch {
      // useDealDraft has already surfaced the message; staying put is the right response.
    } finally {
      setBusy(false);
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
      title: 'Handing over',
      subText: 'Saving your answers, uploading attachments and passing the deal to compliance…',
    });
    try {
      const id = await draft.ensureDraft();
      if (!id) return;
      await flushVoice(notesBlob, 'VOICE_NOTE', id);
      setNotesBlob(null);
      await handoverDeal(id);
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      showToast({ severity: 'success', message: 'Deal handed over to compliance', anchorOrigin: TOP_CENTER });
      navigate(`/deals/${id}`);
    } catch (e) {
      const msg = e.response?.data?.message || 'Could not hand the deal over';
      setError(msg);
      showToast({ severity: 'error', message: msg, anchorOrigin: TOP_CENTER });
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
          anchorOrigin: TOP_CENTER,
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
  // firm. Anyone else — or anyone still here after the deal moved on — goes to the read-only
  // view. The exact complement of DealDetailPage's redirect, so the two cannot loop.
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
        <Section1ClientType form={form} setField={setField} locked={Boolean(dealId)} />
      )}
      {section === 1 && (
        <Section2Property
          form={form}
          setField={setField}
          setNested={setNested}
          setGroup={setGroup}
          voiceBlob={purposeBlob}
          onVoiceChange={setPurposeBlob}
        />
      )}
      {section === 2 && (
        <Section3Identity
          form={form}
          setField={setField}
          dealId={dealId}
          idDocuments={idDocuments}
          onUploaded={handleUploaded}
          onRemoved={handleRemoved}
        />
      )}
      {section === 3 && (
        <Section4Risk
          form={form}
          setField={setField}
          dealId={dealId}
          minEvidence={minEvidence}
          maxEvidence={maxEvidence}
          onUploaded={handleUploaded}
          onRemoved={handleRemoved}
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
          Handing over moves <strong>{deal.reference}</strong> to <strong>Handover</strong> and
          locks it from further edits. It's already saved, so you can leave and finish later from{' '}
          <strong>My deals</strong> — and if you hand it over too early you can recall it from the
          deal's page.
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

        <Stack direction="row" spacing={1.5} justifyContent={{ xs: 'stretch', sm: 'flex-end' }}>
          {/* Everything autosaves, so leaving is not losing — an editor needs a way out that
              isn't "hand over" or "delete". */}
          {isEditMode && (
            <Button onClick={() => navigate(`/deals/${resumeDealId}`)} disabled={busy}
                    sx={{ flex: { xs: 1, sm: 'unset' } }}>
              Done
            </Button>
          )}
          <Button onClick={goBack} disabled={section === 0 || busy} sx={{ flex: { xs: 1, sm: 'unset' } }}>
            Back
          </Button>
          <Button
            variant="contained"
            onClick={isLast ? handleSubmit : goNext}
            // Not disabled on incomplete input — clicking says what's missing, which beats a
            // dead button the broker has to reverse-engineer.
            disabled={busy || purchaserBlocked}
            sx={{ flex: { xs: 1, sm: 'unset' } }}
          >
            {busy ? 'Saving…' : isLast ? 'Hand over' : 'Next'}
          </Button>
        </Stack>
      </Stack>

      {/* The reason a deal came back is on its timeline, and the broker needs it in front of
          them while they act on it — not one navigation away. */}
      {isEditMode && dealId && (
        <DealNotesTimeline dealId={dealId} status={deal?.status} />
      )}

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
