import { useEffect, useRef, useState } from 'react';
import { Box, Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MicIcon from '@mui/icons-material/Mic';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import { useAudioRecorder } from 'react-audio-voice-recorder';
import { palette, tokens } from '../theme/theme.js';

function formatTime(totalSeconds) {
  const s = Math.floor((totalSeconds ?? 0) % 60).toString().padStart(2, '0');
  const m = Math.floor((totalSeconds ?? 0) / 60).toString();
  return `${m}:${s}`;
}

/**
 * Voice-note recorder built on react-audio-voice-recorder's `useAudioRecorder` hook so we
 * render our own controls — the packaged `<AudioRecorder>` widget exposed a disk/file icon
 * that read as "download" rather than "save", and could overflow its container.
 *
 * Flow: Record → (live timer, Pause/Resume, an explicit "Save recording" button, Cancel) →
 * on Save the finished Blob is committed to the parent via `onChange(blob)`. Nothing uploads
 * here — the caller uploads when the wider deal is saved/submitted.
 *
 * `value` is the committed Blob (or null); pass it down so the field rehydrates a saved clip
 * on wizard tab switches. Object URLs are created only for playback and revoked on cleanup.
 */
export function VoiceRecorderField({
  value,
  onChange,
  label = 'Voice note',
  helper = 'Tap Record to start. Press "Save recording" to attach it — it only uploads when you save or submit the deal.',
}) {
  const {
    startRecording,
    stopRecording,
    togglePauseResume,
    recordingBlob,
    isRecording,
    isPaused,
    recordingTime,
  } = useAudioRecorder(
    { noiseSuppression: true, echoCancellation: true },
    (err) => console.warn('Microphone not available', err),
    { audioBitsPerSecond: 96000 },
  );

  const [objectUrl, setObjectUrl] = useState(null);
  // Captures whether the just-stopped take should be attached ('save') or dropped ('discard').
  const intentRef = useRef(null);

  // Playback URL for the committed value.
  useEffect(() => {
    if (!value) {
      setObjectUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(value);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  // The hook hands back the Blob asynchronously after stopRecording(); honour the intent
  // captured when the button was pressed.
  useEffect(() => {
    if (!recordingBlob) return;
    if (intentRef.current === 'save') onChange?.(recordingBlob);
    intentRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingBlob]);

  const handleSave = () => { intentRef.current = 'save'; stopRecording(); };
  const handleCancel = () => { intentRef.current = 'discard'; stopRecording(); };
  const handleDiscardSaved = () => { onChange?.(null); };

  const isSaved = Boolean(value) && !isRecording;

  return (
    <Stack spacing={1.25} sx={{ width: '100%', minWidth: 0 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <GraphicEqIcon fontSize="small" sx={{ color: palette.trust[500] }} />
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>{label}</Typography>
        {isSaved && (
          <Tooltip title="Discard recording">
            <IconButton size="small" color="error" onClick={handleDiscardSaved}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary">{helper}</Typography>

      <Box
        sx={{
          p: 1.5,
          borderRadius: 1.5,
          border: `1px solid ${palette.ink[200]}`,
          bgcolor: palette.ink[50],
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {/* Idle */}
        {!isRecording && !isSaved && (
          <Button variant="contained" startIcon={<MicIcon />} onClick={startRecording}>
            Record voice note
          </Button>
        )}

        {/* Recording / paused */}
        {isRecording && (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: tokens.rejected,
                  flexShrink: 0,
                  '@keyframes voicePulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
                  animation: isPaused ? 'none' : 'voicePulse 1.2s ease-in-out infinite',
                }}
              />
              <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 42, fontVariantNumeric: 'tabular-nums' }}>
                {formatTime(recordingTime)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {isPaused ? 'Paused' : 'Recording…'}
              </Typography>
            </Stack>

            <Box sx={{ flexGrow: 1 }} />

            <Button
              size="small"
              color="inherit"
              startIcon={isPaused ? <PlayArrowIcon /> : <PauseIcon />}
              onClick={togglePauseResume}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<CheckCircleOutlineIcon />}
              onClick={handleSave}
            >
              Save recording
            </Button>
            <Button size="small" color="error" onClick={handleCancel}>
              Cancel
            </Button>
          </Stack>
        )}

        {/* Saved — playback */}
        {isSaved && objectUrl && (
          <Stack spacing={0.5} sx={{ width: '100%', minWidth: 0 }}>
            <Box component="audio" controls src={objectUrl} sx={{ width: '100%', maxWidth: '100%' }} />
            <Typography variant="caption" color="text.secondary">
              {(value.size / 1024).toFixed(1)} KB · saved — uploads on submit
            </Typography>
          </Stack>
        )}
      </Box>

      {isSaved && (
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: tokens.approved }}>
          <TaskAltIcon sx={{ fontSize: 16 }} />
          <Typography variant="caption" sx={{ color: tokens.approved, fontWeight: 600 }}>
            Recording saved — it uploads when you save or submit the deal.
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}
