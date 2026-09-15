import { useState } from 'react';
import { Stack, Typography } from '@mui/material';
import { DEAL_DOCUMENT_TYPES } from '../../../api/documents.js';
import { DocumentUploader } from '../../../components/DocumentUploader.jsx';
import { DocumentViewerDialog } from '../../../components/DocumentViewerDialog.jsx';
import { tokens } from '../../../theme/theme.js';

/**
 * The deal's own documents — the title, the agreement, what the property was valued at.
 *
 * <p>The counterpart to a node's Documents tab, and deliberately the same component underneath.
 * The deal used to have no document surface of its own: its whole file was bolted onto the bottom
 * of <em>every</em> party's tab as "Documents in this deal", so a reviewer reading about one owner
 * was shown everything on the deal, and a title document had nowhere of its own to go.
 *
 * <p>Scoped with `dealOnly`, which is what keeps the two surfaces from being the same list twice.
 * A party's evidence belongs on that party; what is left over is the deal's.
 *
 * @param version set when the screen is showing a past version: `{ dealId, versionNo, documents }`.
 *                The list is then the snapshot's rather than the live deal's, uploading is off —
 *                a file added into a version now was not part of the moment it records — and the
 *                viewer fetches through the version, which is the only route that still serves a
 *                document deleted from the live deal since.
 */
export function DealDocumentsPanel({ dealId, readOnly = false, version = null }) {
  // Held whole rather than by id: the uploader already has the row in hand when a viewer is asked
  // for, so re-finding it here would mean keeping a second copy of the list to find it in.
  const [viewingDoc, setViewingDoc] = useState(null);

  return (
    <Stack spacing={1.5}>
      <Typography variant="caption" sx={{ color: tokens.muted }}>
        Files that belong to the deal itself rather than to any one party. A party's own evidence
        is filed against them, in the ownership structure.
      </Typography>

      <DocumentUploader
        dealId={dealId}
        dealOnly
        allowedTypes={DEAL_DOCUMENT_TYPES}
        // The drawer is 560–640px, and MUI's breakpoints watch the viewport rather than the
        // container — without this the table runs off the edge on a wide screen.
        compact
        canUpload={!readOnly}
        // `dealOnly` narrows this the same way it narrows the live list, so a version shows the
        // deal's own files rather than the whole snapshot.
        frozenDocuments={version?.documents ?? null}
        title="Documents on this deal"
        onViewDocument={setViewingDoc}
      />

      <DocumentViewerDialog
        open={Boolean(viewingDoc)}
        doc={viewingDoc}
        onClose={() => setViewingDoc(null)}
        version={version}
      />
    </Stack>
  );
}
