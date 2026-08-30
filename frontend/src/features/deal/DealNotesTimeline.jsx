import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Divider, Stack, TextField, Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import { addDealNote, listDealNotes } from '../../api/deals.js';
import { fetchDownloadUrl } from '../../api/documents.js';
import { DealStatusChip } from '../../components/DealStatusChip.jsx';
import { timeAgo } from '../../utils/formatters.js';
import { tokens, fonts } from '../../theme/theme.js';

/**
 * The deal's conversation: the broker's opening note, every comment, and one entry per state
 * change, oldest first.
 *
 * <p>This is the human record, and it sits alongside — not instead of — the audit log. The audit
 * log says what the system did; this says what people meant by it.
 *
 * @param embedded true when this owns a whole tab, which makes the card and the "Notes" heading
 *                 around it redundant — the tab already said so.
 */
export function DealNotesTimeline({ dealId, status, canComment = true, embedded = false }) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [error, setError] = useState(null);

  const q = useQuery({
    queryKey: ['dealNotes', dealId],
    queryFn: () => listDealNotes(dealId),
    enabled: Boolean(dealId),
  });

  const addMut = useMutation({
    mutationFn: (note) => addDealNote(dealId, note),
    onSuccess: (timeline) => {
      // The endpoint returns the refreshed thread, so seed the cache rather than refetch.
      qc.setQueryData(['dealNotes', dealId], timeline);
      setBody('');
      setError(null);
    },
    onError: (e) => setError(e.response?.data?.message || 'Your note didn’t save. Try again.'),
  });

  const entries = q.data ?? [];

  // One body, two frames. Built as an element rather than a wrapper component: a component
  // declared here would be a new type on every render, and React would remount the whole subtree
  // — taking the half-typed comment in the box below with it.
  const content = (
    <>
        <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 0.5 }}>
          {!embedded && (
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Notes</Typography>
          )}
          {status && <DealStatusChip status={status} />}
        </Stack>
        <Typography variant="caption" sx={{ color: tokens.muted }}>
          Everything said about this deal, in order. Notes can’t be edited or deleted.
        </Typography>

        <Divider sx={{ my: 2 }} />

        {q.isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} /></Box>
        )}
        {q.isError && <Alert severity="error">Couldn’t load the notes for this deal.</Alert>}

        {!q.isLoading && !q.isError && entries.length === 0 && (
          <Typography variant="body2" sx={{ color: tokens.muted, py: 1 }}>
            Nothing here yet.
          </Typography>
        )}

        <Stack spacing={0}>
          {entries.map((e, i) => (
            <TimelineEntry key={e.id ?? `creation-${i}`} entry={e} last={i === entries.length - 1} />
          ))}
        </Stack>

        {canComment && (
          <Box sx={{ mt: 2.5 }}>
            <TextField
              label="Add a note"
              placeholder="Ask a question, or record what you've checked…"
              value={body}
              onChange={(ev) => setBody(ev.target.value)}
              multiline
              minRows={2}
              fullWidth
              size="small"
            />
            {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
              <Button
                variant="contained"
                size="small"
                startIcon={<SendIcon />}
                onClick={() => addMut.mutate(body.trim())}
                disabled={addMut.isPending || body.trim().length < 3}
              >
                {addMut.isPending ? 'Posting…' : 'Post'}
              </Button>
            </Stack>
          </Box>
        )}
    </>
  );

  // Embedded drops the card and the heading; the tab strip above it has already said "Notes".
  if (embedded) return <Box>{content}</Box>;
  return <Card><CardContent>{content}</CardContent></Card>;
}

function TimelineEntry({ entry, last }) {
  const isTransition = entry.kind === 'TRANSITION';
  const isCreation = entry.kind === 'CREATION';

  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'stretch' }}>
      {/* Rail: a dot per entry, joined by a line so the thread reads as one sequence. */}
      <Stack alignItems="center" sx={{ width: 12, flexShrink: 0 }}>
        <Box sx={{
          width: 9, height: 9, borderRadius: '50%', mt: '6px', flexShrink: 0,
          backgroundColor: isTransition ? tokens.blue : tokens.hairline2,
        }} />
        {!last && <Box sx={{ flex: 1, width: '1px', backgroundColor: tokens.hairline, my: 0.5 }} />}
      </Stack>

      <Box sx={{ flex: 1, minWidth: 0, pb: last ? 0 : 2.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 0.4 }}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: tokens.ink }}>
            {entry.authorName || entry.authorEmail || 'Unknown user'}
          </Typography>
          {isCreation && <Label>created the deal</Label>}
          {isTransition && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <DealStatusChip status={entry.statusFrom} />
              <ArrowRightAltIcon sx={{ fontSize: '1rem', color: tokens.muted }} />
              <DealStatusChip status={entry.statusTo} />
            </Stack>
          )}
          <Typography sx={{ fontSize: '0.72rem', color: tokens.muted, ml: 'auto' }}>
            {timeAgo(entry.createdAt)}
          </Typography>
        </Stack>

        {entry.body && (
          <Typography variant="body2" sx={{ color: tokens.ink, whiteSpace: 'pre-wrap' }}>
            {entry.body}
          </Typography>
        )}

        {entry.voiceDocumentId && <TimelineVoiceClip documentId={entry.voiceDocumentId} />}
      </Box>
    </Stack>
  );
}

function Label({ children }) {
  return (
    <Typography sx={{
      fontFamily: fonts.mono, fontSize: '0.62rem', letterSpacing: '0.1em',
      textTransform: 'uppercase', color: tokens.muted,
    }}>
      {children}
    </Typography>
  );
}

/**
 * The broker's recording, played in place.
 *
 * Separate from components/VoiceClip.jsx because that one takes a whole document object from the
 * documents list; here the timeline only carries an id, and fetching the presigned URL lazily
 * keeps a thread of twenty notes from issuing twenty S3 signings on mount.
 */
function TimelineVoiceClip({ documentId }) {
  const q = useQuery({
    queryKey: ['documentUrl', documentId],
    queryFn: () => fetchDownloadUrl(documentId),
    staleTime: 4 * 60 * 1000,   // the backend signs these for 5 minutes
  });

  if (q.isError) {
    return (
      <Typography variant="caption" sx={{ color: tokens.muted }}>
        Voice note unavailable.
      </Typography>
    );
  }
  if (!q.data?.downloadUrl) {
    return <CircularProgress size={14} sx={{ mt: 1 }} />;
  }
  return (
    <Box
      component="audio"
      controls
      src={q.data.downloadUrl}
      sx={{ mt: 1, width: '100%', maxWidth: 320, height: 36 }}
    />
  );
}
