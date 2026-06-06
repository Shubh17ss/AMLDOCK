import { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Stack, Typography } from '@mui/material';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import { fetchDownloadUrl } from '../api/documents.js';

/**
 * Renders a single VOICE_NOTE document as an inline audio player. Lazy-fetches the
 * presigned download URL on mount so each clip can be played without bloating the
 * parent's initial network round-trip.
 *
 * Used on both the deal detail page (per-deal broker voice notes) and the node
 * Verifications tab (per-node compliance voice rationales).
 */
export function VoiceClip({ doc }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchDownloadUrl(doc.id)
      .then((r) => { if (!cancelled) setUrl(r.downloadUrl); })
      .catch((e) => {
        if (!cancelled) setError(e.response?.data?.message || 'Failed to load audio');
      });
    return () => { cancelled = true; };
  }, [doc.id]);

  return (
    <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <GraphicEqIcon fontSize="small" color="primary" />
        <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
          {doc.originalFilename} · {new Date(doc.createdAt).toLocaleString()}
          {doc.uploadedByEmail ? ` · ${doc.uploadedByEmail}` : ''}
        </Typography>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {url && <audio controls src={url} style={{ width: '100%' }} />}
      {!url && !error && <CircularProgress size={20} />}
    </Box>
  );
}
