import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Stack, Typography,
} from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckIcon from '@mui/icons-material/Check';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

/**
 * Live-camera capture modal. Streams the device camera via getUserMedia, lets the
 * user preview a snap, then emits a JPEG File to the parent.
 *
 * Requires a secure context (HTTPS or localhost). Falls back gracefully with a
 * "pick file instead" button so the broker is never fully blocked.
 */
export function CameraCaptureDialog({ open, onClose, onCapture, suggestedName = 'document' }) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const fallbackRef = useRef(null);
  const [error,    setError]    = useState(null);
  const [ready,    setReady]    = useState(false);
  const [snapshot, setSnapshot] = useState(null); // { dataUrl, blob }

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setError(null);
    setReady(false);
    setSnapshot(null);

    // Secure context check — getUserMedia is blocked on plain HTTP non-localhost.
    if (!window.isSecureContext) {
      setError(
        'Camera requires a secure (HTTPS) connection. ' +
        'Use "Pick file instead" to choose a photo from your device.',
      );
      return undefined;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not supported in this browser. Use "Pick file instead".');
      return undefined;
    }

    const attach = (stream) => {
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => { if (!cancelled) setReady(true); };
      }
    };

    const mapError = (e) => {
      const n = e?.name;
      if (n === 'NotAllowedError' || n === 'PermissionDeniedError')
        return 'Camera permission denied. Allow access in your browser settings, then try again.';
      if (n === 'NotFoundError' || n === 'DevicesNotFoundError')
        return 'No camera found on this device. Use "Pick file instead".';
      if (n === 'NotReadableError' || n === 'TrackStartError')
        return 'Camera is in use by another app. Close it and try again.';
      return e?.message || 'Could not start the camera.';
    };

    // Prefer rear-facing camera; fall back to any available camera if the
    // environment constraint is overconstrained (common on desktops).
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(attach)
      .catch(() =>
        navigator.mediaDevices
          .getUserMedia({ video: true, audio: false })
          .then(attach)
          .catch((e) => { if (!cancelled) setError(mapError(e)); }),
      );

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  const handleSnap = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) { setError('Failed to capture frame.'); return; }
        setSnapshot({ dataUrl: canvas.toDataURL('image/jpeg', 0.92), blob });
      },
      'image/jpeg',
      0.92,
    );
  };

  const handleRetake = () => setSnapshot(null);

  const handleUse = () => {
    if (!snapshot) return;
    const safe = (suggestedName || 'document').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
    const file = new File([snapshot.blob], `${safe}-${Date.now()}.jpg`, { type: 'image/jpeg' });
    onCapture?.(file);
    onClose?.();
  };

  // Fallback: let the broker pick from the gallery / file system when camera fails.
  const handleFallbackFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onCapture?.(file);
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Capture document with camera</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          {error ? (
            <Stack spacing={1.5}>
              <Alert severity="error">{error}</Alert>
              <Button
                variant="outlined"
                startIcon={<FolderOpenIcon />}
                onClick={() => fallbackRef.current?.click()}
                fullWidth
              >
                Pick file instead
              </Button>
              <input
                ref={fallbackRef}
                type="file"
                hidden
                accept="image/*,application/pdf"
                onChange={handleFallbackFile}
              />
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Frame the document inside the viewport and tap <strong>Capture</strong>. You can retake
              before using the shot.
            </Typography>
          )}

          {!error && (
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                minHeight: 240,
                bgcolor: 'common.black',
                borderRadius: 1,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {!snapshot && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', maxHeight: '60vh', display: 'block' }}
                />
              )}
              {snapshot && (
                <img
                  src={snapshot.dataUrl}
                  alt="Captured preview"
                  style={{ width: '100%', maxHeight: '60vh', display: 'block', objectFit: 'contain' }}
                />
              )}
              {!ready && !snapshot && (
                <Box sx={{ position: 'absolute', color: 'common.white', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} color="inherit" />
                  <Typography variant="body2">Starting camera…</Typography>
                </Box>
              )}
            </Box>
          )}

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {!error && (
          snapshot ? (
            <>
              <Button startIcon={<RefreshIcon />} onClick={handleRetake}>Retake</Button>
              <Button variant="contained" startIcon={<CheckIcon />} onClick={handleUse}>
                Use photo
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              startIcon={<CameraAltIcon />}
              onClick={handleSnap}
              disabled={!ready}
            >
              Capture
            </Button>
          )
        )}
      </DialogActions>
    </Dialog>
  );
}
