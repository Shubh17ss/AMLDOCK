import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Chip, CircularProgress, InputAdornment, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { AUDIO_DOCUMENT_TYPES, documentTypeLabel, listDealDocuments } from '../../../api/documents.js';
import { isViewable } from '../../../components/DocumentViewerDialog.jsx';
import { tokens, fonts, motion } from '../../../theme/theme.js';

const formatBytes = (n) => {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

/**
 * Everything filed against the deal, wherever it was filed from.
 *
 * <p>A list rather than a rendered document. The panel this replaces opened straight into
 * whichever file happened to be first, which is a document nobody chose — and it cost a third of
 * the review screen to show it. Reading one is now a deliberate act: pick it, and it opens over
 * the top.
 *
 * <p>Voice notes are left out. This list exists to open things in a viewer, and audio is not one
 * of them; the deal's recordings are played where they were recorded.
 */
export function DealDocumentList({ dealId, onOpen }) {
  const [query, setQuery] = useState('');

  const q = useQuery({
    // The same key the uploader invalidates, so a file added above appears here without a
    // second request or a stale list.
    queryKey: ['documents', dealId],
    queryFn: () => listDealDocuments(dealId),
    enabled: Boolean(dealId),
  });

  const all = useMemo(
    () => (q.data ?? []).filter((d) => !AUDIO_DOCUMENT_TYPES.includes(d.documentType)),
    [q.data],
  );

  const trimmed = query.trim();
  const rows = useMemo(() => {
    if (!trimmed) return all;
    const needle = trimmed.toLowerCase();
    return all.filter((d) => (d.originalFilename ?? '').toLowerCase().includes(needle));
  }, [all, trimmed]);

  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="subtitle1">Documents in this deal</Typography>
        <Typography variant="caption" sx={{ color: tokens.muted }}>
          Everything filed against the deal, including files on other parties
        </Typography>
      </Box>

      <TextField
        size="small"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by file name"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" sx={{ color: tokens.muted }} />
            </InputAdornment>
          ),
        }}
      />

      {q.isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={22} />
        </Box>
      )}
      {q.isError && <Alert severity="error">Could not load this deal's documents.</Alert>}

      {q.data && rows.length === 0 && (
        <Typography variant="body2" sx={{ color: tokens.muted, py: 2, textAlign: 'center' }}>
          {trimmed
            ? `No file name matches "${trimmed}".`
            : 'Nothing has been filed against this deal yet.'}
        </Typography>
      )}

      {rows.length > 0 && (
        <Box
          sx={{
            maxHeight: 340,
            overflowY: 'auto',
            border: `1px solid ${tokens.hairline}`,
            borderRadius: 2,
          }}
        >
          {rows.map((d, i) => (
            <DocumentRow
              key={d.id}
              doc={d}
              first={i === 0}
              onOpen={() => onOpen?.(d)}
            />
          ))}
        </Box>
      )}
    </Stack>
  );
}

function DocumentRow({ doc, first, onOpen }) {
  const viewable = isViewable(doc);

  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="center"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); }
      }}
      sx={motion.respectful({
        px: 1.5,
        py: 1.25,
        cursor: 'pointer',
        borderTop: first ? 'none' : `1px solid ${tokens.hairline}`,
        transition: `background-color ${motion.swift} ease`,
        '&:hover': { backgroundColor: tokens.hover },
        '&:focus-visible': { outline: `2px solid ${tokens.blue}`, outlineOffset: -2 },
      })}
    >
      <InsertDriveFileOutlinedIcon sx={{ fontSize: '1.1rem', color: tokens.muted, flexShrink: 0 }} />

      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography
          variant="body2"
          sx={{ color: tokens.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={doc.originalFilename}
        >
          {doc.originalFilename}
        </Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
          <Typography variant="caption" sx={{ color: tokens.muted }}>
            {documentTypeLabel(doc.documentType)}
          </Typography>
          <Typography variant="caption" sx={{ color: tokens.muted, fontFamily: fonts.mono }}>
            {formatBytes(doc.sizeBytes)}
          </Typography>
        </Stack>
      </Box>

      {/* Which files belong to a party rather than the deal at large — the same signal the old
          picker carried, and the reason a reviewer can tell one Passport.jpg from another. */}
      {doc.ownershipNodeId && (
        <Chip size="small" variant="outlined" label="party" sx={{ fontSize: '0.62rem', flexShrink: 0 }} />
      )}
      {!viewable && (
        <Tooltip title="No preview for this file type — it opens as a download">
          <Chip size="small" label="download" sx={{ fontSize: '0.62rem', flexShrink: 0 }} />
        </Tooltip>
      )}
    </Stack>
  );
}
