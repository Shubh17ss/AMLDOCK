import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';
import { listDealDocuments } from '../../api/documents.js';
import { VoiceClip } from '../../components/VoiceClip.jsx';
import { tokens, fonts } from '../../theme/theme.js';

/**
 * Broker-authored context attached to a deal, so reviewers can read the broker's framing
 * before deciding.
 *
 * A deal carries two separate recordings and they are not interchangeable: the transaction
 * purpose is the client's stated reason for the deal (section 2), while the deal note is the
 * broker's own message to compliance (section 4). They're kept apart by document type rather
 * than run together, because a reviewer weighing intent needs to know which is which.
 */
export function BrokerNotesCard({ deal }) {
  const docsQ = useQuery({
    queryKey: ['documents', deal.id],
    queryFn: () => listDealDocuments(deal.id),
  });
  const docs = docsQ.data ?? [];
  const purposeClips = docs.filter((d) => d.documentType === 'VOICE_NOTE_PURPOSE');
  const noteClips = docs.filter((d) => d.documentType === 'VOICE_NOTE');
  const clipCount = purposeClips.length + noteClips.length;

  const hasPurpose = Boolean(deal.transactionPurpose) || purposeClips.length > 0;
  const hasNotes = Boolean(deal.notes) || noteClips.length > 0;
  if (!hasPurpose && !hasNotes) return null;

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>Broker notes</Typography>
            {clipCount > 0 && (
              <Chip
                size="small"
                label={`${clipCount} voice ${clipCount === 1 ? 'note' : 'notes'}`}
                variant="outlined"
              />
            )}
          </Stack>
          <Divider />

          {hasPurpose && (
            <Stack spacing={1.5}>
              <Label>Transaction purpose</Label>
              {deal.transactionPurpose && (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {deal.transactionPurpose}
                </Typography>
              )}
              {purposeClips.map((doc) => <VoiceClip key={doc.id} doc={doc} />)}
            </Stack>
          )}

          {hasPurpose && hasNotes && <Divider />}

          {hasNotes && (
            <Stack spacing={1.5}>
              <Label>Notes for compliance</Label>
              {deal.notes && (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{deal.notes}</Typography>
              )}
              {noteClips.map((doc) => <VoiceClip key={doc.id} doc={doc} />)}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function Label({ children }) {
  return (
    <Typography sx={{
      fontFamily: fonts.mono, fontSize: '0.62rem', letterSpacing: '0.12em',
      textTransform: 'uppercase', color: tokens.muted,
    }}>
      {children}
    </Typography>
  );
}
