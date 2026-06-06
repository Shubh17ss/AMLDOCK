import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';
import { listDealDocuments } from '../../api/documents.js';
import { VoiceClip } from '../../components/VoiceClip.jsx';

/**
 * Shows broker-authored context attached to a deal — the free-text notes captured in the
 * wizard's review step plus any voice memos uploaded as VOICE_NOTE documents.
 *
 * Rendered on both the broker's deal detail page and the compliance/manager review screen
 * so reviewers can read the broker's framing before deciding.
 */
export function BrokerNotesCard({ deal }) {
  const docsQ = useQuery({
    queryKey: ['documents', deal.id],
    queryFn: () => listDealDocuments(deal.id),
  });
  const voiceNotes = (docsQ.data ?? []).filter((d) => d.documentType === 'VOICE_NOTE');

  if (!deal.notes && voiceNotes.length === 0) return null;

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>Broker notes</Typography>
            <Chip
              size="small"
              label={`${voiceNotes.length} voice ${voiceNotes.length === 1 ? 'note' : 'notes'}`}
              variant="outlined"
            />
          </Stack>
          <Divider />
          {deal.notes && (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{deal.notes}</Typography>
          )}
          {voiceNotes.length > 0 && (
            <Stack spacing={1.5}>
              {voiceNotes.map((doc) => <VoiceClip key={doc.id} doc={doc} />)}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
