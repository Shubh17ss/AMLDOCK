import { useEffect, useState } from 'react';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import { AudioRecorder } from 'react-audio-voice-recorder';
import { palette } from '../theme/theme.js';

/**
 * Wraps react-audio-voice-recorder's `<AudioRecorder>` so it returns a Blob to the parent
 * via `onChange(blob | null)`. The Blob is held by the parent — we never auto-upload —
 * which lets the caller upload only when the wider form persists.
 *
 * `value` is the Blob (or null). Pass it down so the field rehydrates on tab switches
 * inside the wizard. The component creates an objectURL only when needed and revokes it
 * on cleanup to avoid memory leaks.
 */
export function VoiceRecorderField({
  value,
  onChange,
  label = 'Voice note',
  helper = 'Tap the mic to start. We only upload when you save or submit the deal.',
}) {
  const [objectUrl, setObjectUrl] = useState(null);

  // Refresh / revoke the playback URL when the Blob changes.
  useEffect(() => {
    if (!value) {
      setObjectUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(value);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const handleRecordingComplete = (blob) => {
    onChange?.(blob);
  };

  const handleDiscard = () => {
    onChange?.(null);
  };

  return (
    <Stack spacing={1.25}>
      <Stack direction="row" spacing={1} alignItems="center">
        <GraphicEqIcon fontSize="small" sx={{ color: palette.trust[500] }} />
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>{label}</Typography>
        {value && (
          <Tooltip title="Discard recording">
            <IconButton size="small" color="error" onClick={handleDiscard}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary">{helper}</Typography>

      <Box
        sx={{
          // Pad the recorder controls inside a soft card so they don't look detached.
          p: 1.5,
          borderRadius: 1.5,
          border: `1px solid ${palette.ink[200]}`,
          bgcolor: palette.ink[50],
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          minHeight: 56,
        }}
      >
        <AudioRecorder
          onRecordingComplete={handleRecordingComplete}
          onNotAllowedOrFound={(err) => console.warn('Microphone not available', err)}
          audioTrackConstraints={{ noiseSuppression: true, echoCancellation: true }}
          downloadOnSavePress={false}
          downloadFileExtension="webm"
          showVisualizer={true}
          mediaRecorderOptions={{ audioBitsPerSecond: 96000 }}
        />
        {value && objectUrl && (
          <Box sx={{ flexGrow: 1 }}>
            <audio controls src={objectUrl} style={{ width: '100%' }} />
            <Typography variant="caption" color="text.secondary">
              {(value.size / 1024).toFixed(1)} KB · not yet uploaded
            </Typography>
          </Box>
        )}
      </Box>
    </Stack>
  );
}
