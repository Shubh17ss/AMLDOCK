import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Divider, Stack, TextField, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { ACCEPTED_DOCUMENT_TYPES } from '../../api/ownership.js';
import { NodeFormFields, buildNodePayload } from './NodeFormFields.jsx';
import { DocumentUploader } from '../../components/DocumentUploader.jsx';
import { DocumentViewerDialog } from '../../components/DocumentViewerDialog.jsx';
import { useToast } from '../../components/ToastProvider.jsx';
import { ParkedPanel } from '../deal/review/ParkedPanel.jsx';
import LinkOffIcon from '@mui/icons-material/LinkOff';

/**
 * Editor for a selected ownership node. Lets the user:
 *   - rename / patch type-specific fields
 *   - inspect the incoming edge and edit its percentage / role
 *   - delete the node (with cascade confirm if it has edges)
 * Documents is a placeholder for M8. Verification has its own component - the drawer renders
 * NodeVerificationTab instead of this pane on that tab, because its action lives in the
 * drawer footer rather than inline like every save here.
 */
export function NodeEditorPane({
  tree, selectedNodeId, useTree, onRequestDelete, dealId,
  /** Which panel to show. Owned by NodeDrawer, which draws the tab strip. */
  tab = 'details',
  /**
   * Read-only viewers still see the whole owner — what has been recorded about them and what
   * evidence is filed — they just cannot change any of it.
   */
  readOnly = false,
  /**
   * Set when the screen is showing a past version of the deal: `{ dealId, versionNo, documents }`.
   * Everything document-shaped below then reads from the snapshot rather than from the live deal,
   * so a version does not quietly show files added — or hide files deleted — since it was signed
   * off. Null on the live deal.
   */
  version = null,
}) {
  const [form, setForm] = useState(null);
  const [edgeForm, setEdgeForm] = useState({ percentage: '' });
  const [error, setError] = useState(null);
  const { showToast } = useToast();
  // The document open in the viewer, or null. Held whole rather than by id: both lists
  // already have the row in hand, and re-finding it would mean each knowing about the other.
  const [viewingDoc, setViewingDoc] = useState(null);

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
        // null, not false: these four feed the risk score, and a defaulted No is a negative
        // answer nobody gave sitting in a record that says the risk was assessed. The Risk tab
        // lists an unanswered one as outstanding and refuses the approval until it is answered.
        companyComplexOwnership: selected.companyComplexOwnership ?? null,
        companyPersonalAssets: selected.companyPersonalAssets ?? null,
        companyNewDeveloper: selected.companyNewDeveloper ?? null,
        companyNumber: selected.companyNumber ?? '',
        incorporationDate: selected.incorporationDate ?? '',
        registeredOffice: selected.registeredOffice ?? '',
        trustType: selected.trustType ?? '',
        trustDiscretionary: selected.trustDiscretionary ?? null,
        trustHoldingComplexity: selected.trustHoldingComplexity ?? '',
        personRoles: selected.personRoles ?? [],
        propertyPercentage: selected.propertyPercentage ?? '',
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
            countryOfResidence: selected.person.countryOfResidence ?? null,
            physicalAddress: selected.person.physicalAddress ?? '',
          }
          : null,
      });
      setError(null);
    } else {
      setForm(null);
    }
  }, [selected?.id]);

  // A version carries the deal's whole document set; this node's share of it is that set filtered
  // the way the server filters the live one — the node's own files, plus the ID scans of the
  // person behind it, which hang off the person rather than the node. Null on the live deal,
  // where DocumentUploader fetches for itself.
  const versionNodeDocs = version && selected
    ? (version.documents ?? []).filter((d) => d.ownershipNodeId === selected.id
        || (selected.beneficialOwnerId != null && d.beneficialOwnerId === selected.beneficialOwnerId))
    : null;

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
      showToast({ severity: 'success', message: 'Deal updated' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
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
      showToast({ severity: 'success', message: 'Deal updated' });
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

  // Hands off to the same dialog the row's kebab opens, rather than deleting from here.
  //
  // This used to attempt the delete, read the server's "node has N edges" refusal, and escalate to
  // a window.confirm offering to force it. That warned about the wrong thing: the edges were never
  // the cost, the nodes underneath were — and forcing it left them behind as orphans anyway. The
  // dialog counts what is actually going before anything is attempted.
  const handleDelete = () => onRequestDelete?.(selected.id);

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* None of the tabs below scrolls on its own. This pane used to be a fixed-height panel and
          kept the scrolling; inside the drawer the body already scrolls, and an `overflow` box here
          clips whatever sits above its content edge — which is exactly where an outlined field
          draws its floating label. That was the chopped heading on each tab's first field. */}
      {tab === 'details' && (
        // A disabled <fieldset> natively disables every control inside it. That reaches
        // NodeFormFields' inputs without threading a `disabled` prop through each of them, and
        // it cannot be got around by a control this file does not know about.
        <Stack
          spacing={3}
          component="fieldset"
          disabled={readOnly}
          sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
        >
          <NodeFormFields
            value={form}
            onChange={setForm}
            includeTypeSelector={false}
            // Top of the chain — nothing owns it, so its share is of the property itself.
            showPropertyShare={!incomingEdge}
          />

          {incomingEdge && (
            <>
              <Divider />
              {/* Named for what it records rather than for the edge that holds it: the share
                  this node holds in the parent above. "Link from parent" described the data
                  model, which is not the question anyone is answering here. */}
              <Typography variant="subtitle2">Voting Rights / Shareholding</Typography>
              {/* Percentage only. The edge used to carry a Link role as well, which was a second
                  answer to the question Type already asks on the node itself. */}
              <TextField label="Percentage" type="number" inputProps={{ min: 0, max: 100, step: 0.01 }}
                value={edgeForm.percentage}
                onChange={(e) => setEdgeForm((p) => ({ ...p, percentage: e.target.value }))}
                sx={{ width: 180 }} />
              {/* Same shape as the Update / Remove pair at the foot of this tab: two equal
                  buttons filling the row, the destructive one bordered rather than solid. Both
                  default size, so the heights and the 12px radius match. */}
              <Stack direction="row" justifyContent="space-between">
                <Button variant="outlined" color="error" onClick={detachFromParent}
                  disabled={useTree.deleteEdge.isPending} sx={{ width: '45%' }}>
                  <LinkOffIcon fontSize="small" sx={{ mr: 1 }} />
                  Detach from parent
                </Button>
                <Button variant="contained" onClick={saveEdge}
                  disabled={useTree.updateEdge.isPending} sx={{ width: '45%' }}>
                  Save link
                </Button>
              </Stack>
            </>
          )}

          {!readOnly && (
            <>
              <Divider />
              <Stack direction="row" justifyContent="space-between">
                <Button variant="outlined" color="error" startIcon={<DeleteOutlineIcon />}
                  onClick={handleDelete} sx={{ width: '45%' }}>
                  Remove from structure
                </Button>
                <Button variant="contained" onClick={saveDetails}
                  disabled={useTree.updateNode.isPending} sx={{ width: '45%' }}>
                  {useTree.updateNode.isPending ? 'Saving…' : 'Update'}
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      )}

      {tab === 'documents' && (
        <Stack spacing={1.5}>
          {/* This tab is the node's own file and nothing else. The deal's whole document set used
              to sit underneath it, which meant reading about one party showed you every file on
              the deal; it now lives on the deal, where a reader already goes to ask what the deal
              is. The ID scans below are the exception that proves the rule — they are linked to
              the person rather than to this node, and they are still this node's evidence. */}
          <DocumentUploader
            dealId={dealId}
            ownershipNodeId={selected.id}
            allowedTypes={ACCEPTED_DOCUMENT_TYPES[selected.nodeType]}
            compact
            canUpload={!readOnly}
            frozenDocuments={versionNodeDocs}
            title={`Documents on ${selected.displayName}`}
            onViewDocument={setViewingDoc}
          />
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
        version={version}
      />

    </Box>
  );
}
