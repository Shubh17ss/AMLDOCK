import { useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Dialog, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckIcon from '@mui/icons-material/Check';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import NoPhotographyIcon from '@mui/icons-material/NoPhotography';

/**
 * Full-bleed camera capture. Streams the device camera, lets the broker preview a snap, then
 * emits a JPEG File to the parent.
 *
 * <p>Chromeless on purpose: a viewfinder is its own instruction, and the shape below — shutter
 * centred at the bottom, close top right — is the one every phone camera already uses. The only
 * text is on the error path, where there is no viewfinder to look at and an unlabelled folder
 * icon on a black screen would be undiscoverable.
 *
 * <p>Requires a secure context (HTTPS or localhost); falls back to a file picker so the broker
 * is never fully blocked.
 */
export function CameraCaptureDialog({ open, onClose, onCapture, suggestedName = 'document' }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
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

    // getUserMedia is blocked on plain HTTP away from localhost.
    if (!window.isSecureContext) {
      setError('The camera needs a secure (HTTPS) connection.');
      return undefined;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser can’t open the camera.');
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
        return 'Camera permission denied. Allow access in your browser settings.';
      if (n === 'NotFoundError' || n === 'DevicesNotFoundError')
        return 'No camera found on this device.';
      if (n === 'NotReadableError' || n === 'TrackStartError')
        return 'The camera is in use by another app.';
      return e?.message || 'The camera didn’t start.';
    };

    // Prefer the rear camera; fall back to any available one, since the environment constraint
    // is overconstrained on most desktops.
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
        if (!blob) { setError('Couldn’t capture that frame.'); return; }
        setSnapshot({ dataUrl: canvas.toDataURL('image/jpeg', 0.92), blob });
      },
      'image/jpeg',
      0.92,
    );
  };

  const handleUse = () => {
    if (!snapshot) return;
    const safe = (suggestedName || 'document').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
    onCapture?.(new File([snapshot.blob], `${safe}-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    onClose?.();
  };

  const handleFallbackFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onCapture?.(file);
    onClose?.();
  };

  return (
    // MUI's own fullScreen rather than hand-rolled 100vw/100vh — it handles mobile browser
    // chrome and safe areas, which a raw viewport unit does not.
    <Dialog open={open} onClose={onClose} fullScreen PaperProps={{ sx: { bgcolor: 'common.black' } }}>
      <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'common.black' }}>

        {/* Viewfinder / preview */}
        {!error && (
          <>
            {!snapshot && (
              <Box component="video" ref={videoRef} autoPlay playsInline muted
                   sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
            )}
            {snapshot && (
              <Box component="img" src={snapshot.dataUrl} alt="Captured preview"
                   sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
            )}
            {!ready && !snapshot && (
              // A black screen with nothing on it is indistinguishable from a broken camera, so
              // the spinner stays — it is a status indicator, not an instruction.
              <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <CircularProgress size={28} sx={{ color: 'common.white' }} />
              </Box>
            )}
          </>
        )}

        {/* The one place text earns its keep: with no viewfinder, there is nothing else to go on. */}
        {error && (
          <Stack spacing={2} alignItems="center" justifyContent="center"
                 sx={{ position: 'absolute', inset: 0, px: 4, textAlign: 'center' }}>
            <NoPhotographyIcon sx={{ fontSize: '2.5rem', color: 'rgba(255,255,255,0.5)' }} />
            <Typography sx={{ color: 'common.white', fontSize: '0.95rem', maxWidth: 320 }}>
              {error}
            </Typography>
            <Button
              variant="outlined"
              startIcon={<FolderOpenIcon />}
              onClick={() => fallbackRef.current?.click()}
              sx={{
                color: 'common.white', borderColor: 'rgba(255,255,255,0.6)',
                '&:hover': { borderColor: 'common.white', bgcolor: 'rgba(255,255,255,0.08)' },
              }}
            >
              Choose a file
            </Button>
          </Stack>
        )}

        <input ref={fallbackRef} type="file" hidden accept="image/*,application/pdf"
               onChange={handleFallbackFile} />

        {/* Close — the stream is torn down by the effect cleanup */}
        <IconButton
          onClick={onClose}
          aria-label="Close camera"
          sx={{
            position: 'absolute', right: 12, zIndex: 2,
            top: 'calc(12px + env(safe-area-inset-top, 0px))',
            color: 'common.white', bgcolor: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(6px)',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.55)' },
          }}
        >
          <CloseIcon />
        </IconButton>

        {/* Shutter row */}
        {!error && (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="center"
            spacing={5}
            sx={{
              position: 'absolute', left: 0, right: 0, zIndex: 2,
              bottom: 'calc(28px + env(safe-area-inset-bottom, 0px))',
            }}
          >
            {snapshot ? (
              <>
                <IconButton onClick={() => setSnapshot(null)} aria-label="Retake"
                            sx={{ color: 'common.white' }}>
                  <RefreshIcon sx={{ fontSize: '1.75rem' }} />
                </IconButton>
                <Shutter onClick={handleUse} ariaLabel="Use photo">
                  <CheckIcon sx={{ fontSize: '2rem', color: 'common.black' }} />
                </Shutter>
                {/* Balances the retake button so the shutter stays centred. */}
                <Box sx={{ width: 40 }} />
              </>
            ) : (
              <Shutter onClick={handleSnap} ariaLabel="Capture" disabled={!ready} />
            )}
          </Stack>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </Box>
    </Dialog>
  );
}

/** The white circle. Same shape whether it takes the photo or accepts it. */
function Shutter({ onClick, ariaLabel, disabled, children }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      sx={{
        width: 72, height: 72, borderRadius: '50%',
        border: 'none', p: 0, cursor: disabled ? 'default' : 'pointer',
        bgcolor: 'common.white',
        display: 'grid', placeItems: 'center',
        boxShadow: '0 0 0 4px rgba(255,255,255,0.35)',
        opacity: disabled ? 0.35 : 1,
        transition: 'transform 0.12s ease, opacity 0.2s ease',
        '&:active:not(:disabled)': { transform: 'scale(0.93)' },
      }}
    >
      {children}
    </Box>
  );
}
