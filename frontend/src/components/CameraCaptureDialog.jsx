import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Stack, Typography,
} from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckIcon from '@mui/icons-material/Check';

/**
 * Live-camera capture modal for the document uploader. Streams the device camera into
 * a `<video>` element via `getUserMedia`, lets the broker preview a snap, and emits a
 * JPEG `File` to the parent. The parent feeds it through the same S3 upload path as a
 * picked file — keeps the doc-type, size limit, and progress handling unified.
 *
 * Prefers the rear-facing camera (`facingMode: 'environment'`) for document capture but
 * falls back to whatever is available. Stream is torn down on close to free the camera.
 */
export function CameraCaptureDialog({ open, onClose, onCapture, suggestedName = 'document' }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const [snapshot, setSnapshot] = useState(null); // { dataUrl, blob }

  // Start / stop the media stream alongside the dialog's open state.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setError(null);
    setReady(false);
    setSnapshot(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera capture is not supported in this browser.');
      return undefined;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e?.name === 'NotAllowedError'
          ? 'Camera permission denied. Allow access and try again.'
          : e?.name === 'NotFoundError'
            ? 'No camera was found on this device.'
            : e?.message || 'Could not start the camera.';
        setError(msg);
      });

    return () => {
      cancelled = true;
      const stream = streamRef.current;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  const handleSnap = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('Failed to capture frame.');
          return;
        }
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
    const filename = `${safe}-${Date.now()}.jpg`;
    const file = new File([snapshot.blob], filename, { type: 'image/jpeg' });
    onCapture?.(file);
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Capture document with camera</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="caption" color="text.secondary">
            Frame the document inside the viewport and tap <strong>Capture</strong>. You can retake
            before using the shot.
          </Typography>
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
            {!ready && !snapshot && !error && (
              <Box sx={{ position: 'absolute', color: 'common.white', display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={20} color="inherit" />
                <Typography variant="body2">Starting camera…</Typography>
              </Box>
            )}
          </Box>
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {snapshot ? (
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
            disabled={!ready || Boolean(error)}
          >
            Capture
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
