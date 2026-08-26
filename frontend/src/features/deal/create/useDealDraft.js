import { useCallback, useEffect, useRef, useState } from 'react';
import { createDeal, getDeal, updateDeal, updateDealClient, updateDealProperty } from '../../../api/deals.js';
import {
  EMPTY_FORM, buildClientPatch, buildCreatePayload, buildDealPatch, buildPropertyPatch, dtoToForm,
} from './dealDraftModel.js';
import { useDashboardScope } from '../../../dashboard/DashboardScope.jsx';

/**
 * Owns the deal-creation form's state and its persistence.
 *
 * The draft has to exist on the server partway through the form, because section 3's ID scans
 * and section 4's valuation images attach to a dealId. That is the whole source of difficulty
 * here, and it is what the wizard this replaces got wrong: it created the draft and then only
 * ever re-sent { notes }, so edits made to earlier sections afterwards were silently lost.
 *
 * The fix is structural rather than careful: every save sends the complete payload for all
 * three groups. The API writes only what's present and is idempotent, so a full save costs
 * nothing extra and there is no partial-payload path left in which an edit can go missing.
 *
 *   const { form, setField, setNested, dealId, saveState, error, ensureDraft, saveNow }
 *     = useDealDraft({ resumeDealId });
 */
export function useDealDraft({ resumeDealId = null } = {}) {
  const { branch } = useDashboardScope();
  const [form, setForm] = useState(EMPTY_FORM);
  const [dealId, setDealId] = useState(null);
  const [deal, setDeal] = useState(null);        // last DealDto the server returned
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [error, setError] = useState(null);
  const [loadingResume, setLoadingResume] = useState(Boolean(resumeDealId));

  // Read inside callbacks that must see the latest values without being rebuilt.
  const formRef = useRef(form);
  formRef.current = form;
  const dealIdRef = useRef(dealId);
  dealIdRef.current = dealId;
  // The branch a created deal belongs to, taken from the workspace scope rather than asked for.
  // Through a ref like the two above, deliberately: runSave is a useCallback with empty deps and
  // saveNow/ensureDraft hang off its identity, so closing over the value — or adding it to the
  // dep array — would rebuild the whole chain and re-arm the autosave effect every time the
  // scope changed.
  const branchIdRef = useRef(null);
  branchIdRef.current = branch?.id ?? null;
  // Serialises saves: a debounced autosave and a section advance can fire together, and two
  // concurrent PATCH sequences would race to decide which response is "current".
  const inFlightRef = useRef(Promise.resolve());
  const dirtyRef = useRef(false);

  /* ---------- resume an existing draft ---------- */

  useEffect(() => {
    if (!resumeDealId) return;
    let cancelled = false;
    getDeal(resumeDealId)
      .then((dto) => {
        if (cancelled) return;
        setForm(dtoToForm(dto));
        setDeal(dto);
        setDealId(dto.id);
        dirtyRef.current = false;
      })
      .catch((e) => {
        if (!cancelled) setError(e.response?.data?.message || 'Could not open that draft');
      })
      .finally(() => { if (!cancelled) setLoadingResume(false); });
    return () => { cancelled = true; };
  }, [resumeDealId]);

  /* ---------- field setters (the house pattern) ---------- */

  const setField = useCallback((key) => (eOrValue) => {
    const v = eOrValue?.target ? eOrValue.target.value : eOrValue;
    dirtyRef.current = true;
    setForm((f) => ({ ...f, [key]: v }));
  }, []);

  const setNested = useCallback((group, key) => (eOrValue) => {
    const v = eOrValue?.target ? eOrValue.target.value : eOrValue;
    dirtyRef.current = true;
    setForm((f) => ({ ...f, [group]: { ...f[group], [key]: v } }));
  }, []);

  /** Replaces a whole group at once — used by the address fields, which emit a full object. */
  const setGroup = useCallback((group) => (next) => {
    dirtyRef.current = true;
    setForm((f) => ({ ...f, [group]: { ...f[group], ...next } }));
  }, []);

  /* ---------- persistence ---------- */

  const runSave = useCallback(async () => {
    const current = formRef.current;
    const id = dealIdRef.current;
    setError(null);
    setSaveState('saving');
    try {
      let dto;
      if (!id) {
        dto = await createDeal(buildCreatePayload(current, branchIdRef.current));
        setDealId(dto.id);
        dealIdRef.current = dto.id;
      } else {
        // Sequential, not Promise.all: each call returns a complete DealDto, and the deal
        // patch is sent last so the response held below is the one carrying the freshly
        // derived risk rating.
        await updateDealProperty(id, buildPropertyPatch(current));
        await updateDealClient(id, buildClientPatch(current));
        dto = await updateDeal(id, buildDealPatch(current));
      }
      setDeal(dto);
      dirtyRef.current = false;
      setSaveState('saved');
      return dto;
    } catch (e) {
      const msg = e.response?.data?.message || 'Could not save your progress';
      setError(msg);
      setSaveState('error');
      throw e;
    }
  }, []);

  /** Queues a save behind any in-flight one, so saves never overlap. */
  const saveNow = useCallback(() => {
    const next = inFlightRef.current.catch(() => {}).then(() => runSave());
    inFlightRef.current = next;
    return next;
  }, [runSave]);

  /**
   * Guarantees a persisted deal to attach uploads to. Called at the section 2 → 3 boundary:
   * later than entry, so an abandoned page-load doesn't leave an orphan draft behind, and
   * early enough that section 3 has a dealId the moment it renders.
   */
  const ensureDraft = useCallback(async () => {
    if (dealIdRef.current) {
      await saveNow();
      return dealIdRef.current;
    }
    const dto = await saveNow();
    return dto?.id ?? null;
  }, [saveNow]);

  /* ---------- autosave ---------- */

  // Only once a draft exists — before that, saving would create one, which is ensureDraft's
  // decision to make, not a side effect of typing.
  useEffect(() => {
    if (!dealId || !dirtyRef.current) return undefined;
    const t = setTimeout(() => { saveNow().catch(() => {}); }, 2000);
    return () => clearTimeout(t);
  }, [form, dealId, saveNow]);

  // A save in flight when the tab closes would be abandoned mid-sequence. Nothing can be done
  // about that from here, but a synchronous flush on unmount catches the common case of
  // navigating away within the debounce window.
  useEffect(() => () => {
    if (dealIdRef.current && dirtyRef.current) runSave().catch(() => {});
  }, [runSave]);

  return {
    form,
    setForm,
    setField,
    setNested,
    setGroup,
    dealId,
    deal,
    saveState,
    error,
    setError,
    loadingResume,
    ensureDraft,
    saveNow,
    isDirty: () => dirtyRef.current,
  };
}
