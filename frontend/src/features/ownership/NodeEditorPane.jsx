import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, Divider, FormControl, FormControlLabel, FormLabel,
  Radio, RadioGroup, Stack, TextField, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ACCEPTED_DOCUMENT_TYPES } from '../../api/ownership.js';
import { listNodeDocuments, uploadToS3 } from '../../api/documents.js';
import { NodeFormFields, buildNodePayload } from './NodeFormFields.jsx';
import { DocumentUploader } from '../../components/DocumentUploader.jsx';
import { VoiceRecorderField } from '../../components/VoiceRecorderField.jsx';
import { VoiceClip } from '../../components/VoiceClip.jsx';
import { DocumentViewerDialog } from '../../components/DocumentViewerDialog.jsx';
import { DealDocumentList } from '../deal/review/DealDocumentList.jsx';
import { ParkedPanel } from '../deal/review/ParkedPanel.jsx';
import { tokens } from '../../theme/theme.js';

// Three user-facing manual states mapped onto the existing backend enum.
const VERIFICATION_OPTIONS = [
  { value: 'VERIFIED',    label: 'Verified',          tone: 'success' },
  { value: 'IN_PROGRESS', label: 'Under verification', tone: 'info' },
  { value: 'FAILED',      label: 'Not verified',       tone: 'error' },
];

/**
 * Editor for a selected ownership node. Lets the user:
 *   - rename / patch type-specific fields
 *   - inspect the incoming edge and edit its percentage / role
 *   - delete the node (with cascade confirm if it has edges)
 * Documents and Verifications tabs are placeholders for M8 / M9.
 */
export function NodeEditorPane({
  tree, selectedNodeId, useTree, onCleared, dealId,
  /** Which panel to show. Owned by NodeDrawer, which draws the tab strip. */
  tab = 'details',
}) {
  const [form, setForm] = useState(null);
  const [edgeForm, setEdgeForm] = useState({ percentage: '' });
  const [verification, setVerification] = useState({ status: 'IN_PROGRESS', notes: '' });
  const [verificationVoice, setVerificationVoice] = useState(null); // Blob | null
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [verificationSaved, setVerificationSaved] = useState(false);
  // The document open in the viewer, or null. Held whole rather than by id: both lists
  // already have the row in hand, and re-finding it would mean each knowing about the other.
  const [viewingDoc, setViewingDoc] = useState(null);
  const qc = useQueryClient();

  const selected = useMemo(
    () => tree?.nodes?.find((n) => n.id === selectedNodeId) ?? null,
    [tree, selectedNodeId],
  );

  const incomingEdge = useMemo(
    () => tree?.edges?.find((e) => e.childNodeId === selectedNodeId) ?? null,
    [tree, selectedNodeId],
  );

  // Hydrate the form when selection changes
  useEffect(() => {
    if (selected) {
      setForm({
        nodeType: selected.nodeType,
        displayName: selected.displayName,
        dateOfBirth: selected.dateOfBirth ?? '',
        idDocumentType: selected.idDocumentType ?? '',
        idDocumentNumber: selected.idDocumentNumber ?? '',
        idDocumentCountry: selected.idDocumentCountry ?? '',
        businessNumber: selected.businessNumber ?? '',
        jurisdictionCountry: selected.jurisdictionCountry ?? null,
        companyHasConstitution: selected.companyHasConstitution ?? false,
        nomineeStatus: selected.nomineeStatus ?? 'NOT_ASKED',
        sourceOfFunds: selected.sourceOfFunds ?? '',
        companyComplexOwnership: selected.companyComplexOwnership ?? false,
        companyPersonalAssets: selected.companyPersonalAssets ?? false,
        companyNewDeveloper: selected.companyNewDeveloper ?? false,
        companyNumber: selected.companyNumber ?? '',
        incorporationDate: selected.incorporationDate ?? '',
        registeredOffice: selected.registeredOffice ?? '',
        trustType: selected.trustType ?? '',
        trustDiscretionary: selected.trustDiscretionary ?? false,
        trustHoldingComplexity: selected.trustHoldingComplexity ?? '',
        personRole: selected.personRole ?? '',
        reference: selected.reference ?? '',
        notes: selected.notes ?? '',
        // The shared record behind an individual. Absent on every entity type.
        person: selected.person
          ? {
            email: selected.person.email ?? '',
            phoneCountry: selected.person.phoneCountry ?? null,
            phoneNumber: selected.person.phoneNumber ?? '',
            occupation: selected.person.occupation ?? '',
            sourceOfFunds: selected.person.sourceOfFunds ?? '',
          }
          : null,
      });
      setVerification({
        status: selected.verificationStatus ?? 'IN_PROGRESS',
        notes: selected.verificationNotes ?? '',
      });
      setVerificationVoice(null);
      setError(null);
      setVerificationSaved(false);
    } else {
      setForm(null);
    }
  }, [selected?.id]);

  // Existing per-node voice notes for the Verifications tab.
  const nodeDocsQ = useQuery({
    queryKey: ['documents', 'node', selectedNodeId],
    queryFn: () => listNodeDocuments(selectedNodeId),
    enabled: Boolean(selectedNodeId) && tab === 'verification',
  });
  const nodeVoiceNotes = (nodeDocsQ.data ?? []).filter((d) => d.documentType === 'VOICE_NOTE');

  useEffect(() => {
    setEdgeForm({ percentage: incomingEdge?.percentage ?? '' });
  }, [incomingEdge?.id]);

  if (!selected || !form) return null;

  const saveDetails = async () => {
    setError(null);
    try {
      // The deal is refetched too — useOwnershipTree invalidates it on every node write, since
      // the answers on this form feed its risk rating.
      await useTree.updateNode.mutateAsync({ nodeId: selected.id, payload: buildNodePayload(form) });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    }
  };

  const saveVerification = async () => {
    setError(null);
    setVerificationSaved(false);
    try {
      // 1) Status + text notes
      await useTree.updateNode.mutateAsync({
        nodeId: selected.id,
        payload: {
          verificationStatus: verification.status,
          // Empty string normalises to null on the backend's `if not null` patch — but the
          // backend treats null as "leave alone". Send "" so admins can clear notes if needed.
          verificationNotes: verification.notes ?? '',
        },
      });

      // 2) Voice note (if recorded). Upload via the standard presigned-PUT pipeline,
      //    attached to this node so it surfaces alongside the existing per-node docs.
      if (verificationVoice) {
        const filename = `verification-voice-${Date.now()}.webm`;
        const file = new File([verificationVoice], filename, {
          type: verificationVoice.type || 'audio/webm',
        });
        await uploadToS3({
          file,
          documentType: 'VOICE_NOTE',
          dealId,
          ownershipNodeId: selected.id,
        });
        setVerificationVoice(null);
        // Refresh the per-node + per-deal document lists so the new clip appears below.
        qc.invalidateQueries({ queryKey: ['documents', 'node', selected.id] });
        if (dealId) qc.invalidateQueries({ queryKey: ['documents', dealId] });
      }

      setVerificationSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update verification');
    }
  };

  const saveEdge = async () => {
    if (!incomingEdge) return;
    setError(null);
    try {
      await useTree.updateEdge.mutateAsync({
        edgeId: incomingEdge.id,
        // No role in the payload. updateEdge reads a null role as "leave alone", so a role
        // captured before this field went away stays on the edge rather than being cleared by an
        // unrelated save.
        payload: {
          percentage: edgeForm.percentage === '' ? null : Number(edgeForm.percentage),
        },
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update edge');
    }
  };

  const detachFromParent = async () => {
    if (!incomingEdge) return;
    try {
      await useTree.deleteEdge.mutateAsync(incomingEdge.id);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to detach');
    }
  };

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      // Try without force first.
      await useTree.deleteNode.mutateAsync({ nodeId: selected.id, force: false });
      onCleared?.();
    } catch (err) {
      const message = err.response?.data?.message || '';
      if (/edges/i.test(message)) {
        if (window.confirm('This node has edges. Delete it anyway? Edges will also be removed.')) {
          try {
            await useTree.deleteNode.mutateAsync({ nodeId: selected.id, force: true });
            onCleared?.();
          } catch (err2) {
            setError(err2.response?.data?.message || 'Failed to force-delete');
          }
        }
      } else {
        setError(message || 'Failed to delete');
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* None of the tabs below scrolls on its own. This pane used to be a fixed-height panel and
          kept the scrolling; inside the drawer the body already scrolls, and an `overflow` box here
          clips whatever sits above its content edge — which is exactly where an outlined field
          draws its floating label. That was the chopped heading on each tab's first field. */}
      {tab === 'details' && (
        <Stack spacing={3}>
          <NodeFormFields value={form} onChange={setForm} includeTypeSelector={false} />

          {incomingEdge && (
            <>
              <Divider />
              <Typography variant="subtitle2">Link from parent</Typography>
              {/* Percentage only. The edge used to carry a Link role as well, which was a second
                  answer to the question Type already asks on the node itself. */}
              <TextField label="Percentage" type="number" inputProps={{ min: 0, max: 100, step: 0.01 }}
                         value={edgeForm.percentage}
                         onChange={(e) => setEdgeForm((p) => ({ ...p, percentage: e.target.value }))}
                         sx={{ width: 180 }} />
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" onClick={saveEdge}
                        disabled={useTree.updateEdge.isPending}>Save link</Button>
                <Button size="small" color="error" onClick={detachFromParent}
                        disabled={useTree.deleteEdge.isPending}>Detach from parent</Button>
              </Stack>
            </>
          )}

          <Divider />
          <Stack direction="row" spacing={1} alignItems="center">
            <Button variant="contained" startIcon={<SaveIcon />} onClick={saveDetails}
                    disabled={useTree.updateNode.isPending}>
              {useTree.updateNode.isPending ? 'Saving…' : 'Save details'}
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button size="small" color="error" startIcon={<DeleteOutlineIcon />}
                    onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Removing…' : 'Remove from structure'}
            </Button>
          </Stack>
        </Stack>
      )}

      {tab === 'documents' && (
        <Stack spacing={1.5}>
          {/* The list below includes the ID scans the broker captured — those are linked to the
              person, not to this node, and were invisible here until now. */}
          {selected.nodeType === 'INDIVIDUAL' && (
            <Typography variant="caption" sx={{ color: tokens.muted }}>
              Includes the ID scans captured for this person. Anything added here is filed as
              evidence against this node — an ID uploaded here is not read automatically, and
              does not create a second individual.
            </Typography>
          )}
          <DocumentUploader
            dealId={dealId}
            ownershipNodeId={selected.id}
            allowedTypes={ACCEPTED_DOCUMENT_TYPES[selected.nodeType]}
            compact
            title={`Documents on ${selected.displayName}`}
            onViewDocument={(id) => {
              // The node's own rows open the same viewer as the deal list below. One viewer,
              // two ways in — the alternative is two that drift.
              const found = (nodeDocsQ.data ?? []).find((d) => d.id === id);
              if (found) setViewingDoc(found);
            }}
          />

          {/* The deal's whole document set. It used to have a third of the review screen to
              itself and opened on whichever file happened to be first; now it is a list, and
              reading one is a deliberate act. */}
          <Divider />
          <DealDocumentList dealId={dealId} onOpen={setViewingDoc} />
        </Stack>
      )}

      {(tab === 'echecks' || tab === 'pep') && (
        <ParkedPanel title={tab === 'echecks' ? 'Electronic checks' : 'Politically exposed person'}>
          {tab === 'echecks'
            ? 'Identity and address verification against external registers will run from here, with each result kept against this node as evidence.'
            : 'PEP and sanctions screening for this party will show here, along with what was matched and who cleared it.'}
        </ParkedPanel>
      )}

      <DocumentViewerDialog
        open={Boolean(viewingDoc)}
        doc={viewingDoc}
        onClose={() => setViewingDoc(null)}
      />

      {tab === 'verification' && (
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Manual verification</Typography>
            <Typography variant="caption" sx={{ color: tokens.muted }}>
              Mark this node's status while automated checks (LINZ / NZBN / IDV) are wired up.
              The status badge in the tree updates as soon as you save.
            </Typography>
          </Box>

          <FormControl>
            <FormLabel id="verification-status-label">Status</FormLabel>
            <RadioGroup
              aria-labelledby="verification-status-label"
              value={verification.status}
              onChange={(e) => { setVerification((v) => ({ ...v, status: e.target.value })); setVerificationSaved(false); }}
            >
              {VERIFICATION_OPTIONS.map((opt) => (
                <FormControlLabel
                  key={opt.value}
                  value={opt.value}
                  control={<Radio color={opt.tone} />}
                  label={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>{opt.label}</span>
                      {verification.status === opt.value && (
                        <Chip size="small" color={opt.tone} label="current" variant="outlined" />
                      )}
                    </Stack>
                  }
                />
              ))}
            </RadioGroup>
          </FormControl>

          <TextField
            label="Verification notes"
            value={verification.notes ?? ''}
            onChange={(e) => { setVerification((v) => ({ ...v, notes: e.target.value })); setVerificationSaved(false); }}
            multiline
            minRows={4}
            placeholder="What did you check? Which document or call confirmed it? Anything that should be defensible later."
          />

          <VoiceRecorderField
            value={verificationVoice}
            onChange={(blob) => { setVerificationVoice(blob); setVerificationSaved(false); }}
            label="Voice rationale (optional)"
            helper="Record a short voice note. Uploaded on Save verification — until then it stays local."
          />

          {verificationSaved && (
            <Alert severity="success" onClose={() => setVerificationSaved(false)}>
              Verification updated.
            </Alert>
          )}

          <Box>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={saveVerification}
              disabled={useTree.updateNode.isPending}
            >
              {useTree.updateNode.isPending ? 'Saving…' : 'Save verification'}
            </Button>
          </Box>

          {nodeVoiceNotes.length > 0 && (
            <>
              <Divider />
              <Typography variant="subtitle2">Saved voice notes</Typography>
              <Stack spacing={1.5}>
                {nodeVoiceNotes.map((doc) => <VoiceClip key={doc.id} doc={doc} />)}
              </Stack>
            </>
          )}
        </Stack>
      )}
    </Box>
  );
}
