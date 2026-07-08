import { useEffect, useState } from 'react';
import { Box, Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import { AudioRecorder } from 'react-audio-voice-recorder';
import { palette, tokens } from '../theme/theme.js';

/**
 * Wraps react-audio-voice-recorder's `<AudioRecorder>`. Stopping a take (its built-in disk
 * icon) only *finishes* the recording into a local preview — it does NOT attach it to the
 * deal. The broker then reviews the clip and presses an explicit "Save recording" button to
 * commit it up to the parent via `onChange(blob)`. This removes the ambiguity of the
 * recorder's own save/download icon.
 *
 * `value` is the committed Blob (or null); pass it down so the field rehydrates on tab
 * switches inside the wizard. Object URLs are created only when previewing and revoked on
 * cleanup to avoid leaks.
 */
export function VoiceRecorderField({
  value,
  onChange,
  label = 'Voice note',
  helper = 'Tap the mic to record. When you stop, review the clip and press "Save recording" to attach it — it only uploads when you save or submit the deal.',
}) {
  // A finished-but-not-yet-attached take. Takes precedence over `value` for preview so the
  // broker can review before committing.
  const [pendingBlob, setPendingBlob] = useState(null);
  const [objectUrl, setObjectUrl] = useState(null);

  const previewBlob = pendingBlob ?? value ?? null;

  // Refresh / revoke the playback URL when the previewed Blob changes.
  useEffect(() => {
    if (!previewBlob) {
      setObjectUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(previewBlob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewBlob]);

  const handleRecordingComplete = (blob) => {
    // Hold locally — attach to the deal only when the broker explicitly saves.
    setPendingBlob(blob);
  };

  const handleSaveRecording = () => {
    if (!pendingBlob) return;
    onChange?.(pendingBlob);
    setPendingBlob(null);
  };

  const handleDiscard = () => {
    setPendingBlob(null);
    onChange?.(null);
  };

  const isPending = Boolean(pendingBlob);
  const isSaved = !isPending && Boolean(value);

  return (
    <Stack spacing={1.25}>
      <Stack direction="row" spacing={1} alignItems="center">
        <GraphicEqIcon fontSize="small" sx={{ color: palette.trust[500] }} />
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>{label}</Typography>
        {(isPending || isSaved) && (
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
          flexWrap: 'wrap',
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
        {previewBlob && objectUrl && (
          <Box sx={{ flexGrow: 1, minWidth: 200 }}>
            <audio controls src={objectUrl} style={{ width: '100%' }} />
            <Typography variant="caption" color="text.secondary">
              {(previewBlob.size / 1024).toFixed(1)} KB · {isSaved ? 'saved — uploads on submit' : 'not saved yet'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Explicit save/discard for a finished-but-unattached take. */}
      {isPending && (
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            size="small"
            variant="contained"
            startIcon={<CheckCircleOutlineIcon />}
            onClick={handleSaveRecording}
          >
            Save recording
          </Button>
          <Button size="small" color="inherit" onClick={handleDiscard}>
            Discard
          </Button>
        </Stack>
      )}

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
