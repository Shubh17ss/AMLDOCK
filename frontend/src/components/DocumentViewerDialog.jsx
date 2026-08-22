import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, CircularProgress, Dialog, DialogContent, IconButton, Stack, Tooltip, Typography,
} from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { fetchDownloadUrl, documentTypeLabel } from '../api/documents.js';
import { tokens, fonts } from '../theme/theme.js';

// Configure the pdf.js worker once. Using a CDN keeps us out of Vite bundler config.
pdfjs.GlobalWorkerOptions.workerSrc =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

/** Whether this document is something the viewer can actually put on screen. */
export const isViewable = (doc) =>
  doc?.contentType === 'application/pdf' || IMAGE_TYPES.includes(doc?.contentType);

/**
 * One document, opened over whatever you were doing.
 *
 * <p>A centred dialog rather than an inline panel: reading a scan is a whole-attention task, and
 * the panel it used to live in was a third of a screen that a reviewer wanted for the ownership
 * structure. It opens above the node drawer, so it has to be larger than the drawer to be worth
 * opening at all.
 */
export function DocumentViewerDialog({ open, doc, onClose }) {
  return (
    <Dialog
      open={open && Boolean(doc)}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { height: '90vh', maxHeight: '90vh' } }}
    >
      {doc && <ViewerBody doc={doc} onClose={onClose} />}
    </Dialog>
  );
}

function ViewerBody({ doc, onClose }) {
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [urlError, setUrlError] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [fitToWidth, setFitToWidth] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef(null);

  // Everything resets with the document, rotation included: carrying a turn over would put the
  // next scan on its side for no reason the reader could see.
  useEffect(() => {
    let cancelled = false;
    setDownloadUrl(null);
    setUrlError(null);
    setPageNumber(1);
    setNumPages(null);
    setRotation(0);
    setScale(1);
    setFitToWidth(true);
    fetchDownloadUrl(doc.id)
      .then((res) => { if (!cancelled) setDownloadUrl(res.downloadUrl); })
      .catch((e) => { if (!cancelled) setUrlError(e.response?.data?.message || 'Could not open this file'); });
    return () => { cancelled = true; };
  }, [doc.id]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const measure = () => setContainerWidth(containerRef.current?.clientWidth ?? 0);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const isPdf = doc.contentType === 'application/pdf';
  const isImage = IMAGE_TYPES.includes(doc.contentType);
  // One direction, in 90° steps. Four presses is a full turn, which is why there is no reset.
  const rotateClockwise = () => setRotation((r) => (r + 90) % 360);
  // A quarter turn swaps an image's axes. react-pdf needs no such help — it rotates during
  // render, so `width` already means the width of what you end up looking at.
  const quarterTurned = rotation === 90 || rotation === 270;

  return (
    <>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${tokens.hairline}` }}
      >
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography
            sx={{
              fontFamily: fonts.display, fontSize: '0.98rem', color: tokens.ink,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
            title={doc.originalFilename}
          >
            {doc.originalFilename}
          </Typography>
          <Typography variant="caption" sx={{ color: tokens.muted }}>
            {documentTypeLabel(doc.documentType)}
          </Typography>
        </Box>

        {isPdf && numPages > 1 && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <IconButton size="small" aria-label="Previous page"
                        onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                        disabled={pageNumber <= 1}>
              <NavigateBeforeIcon fontSize="small" />
            </IconButton>
            <Typography variant="caption" sx={{ fontFamily: fonts.mono }}>
              {pageNumber} / {numPages}
            </Typography>
            <IconButton size="small" aria-label="Next page"
                        onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                        disabled={pageNumber >= numPages}>
              <NavigateNextIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}

        {(isPdf || isImage) && (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Rotate clockwise">
              <IconButton size="small" onClick={rotateClockwise} aria-label="Rotate clockwise">
                <RotateRightIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Zoom out">
              <IconButton size="small" aria-label="Zoom out"
                          onClick={() => { setFitToWidth(false); setScale((s) => Math.max(0.5, s - 0.2)); }}>
                <ZoomOutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Zoom in">
              <IconButton size="small" aria-label="Zoom in"
                          onClick={() => { setFitToWidth(false); setScale((s) => Math.min(3, s + 0.2)); }}>
                <ZoomInIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Fit to width">
              <IconButton size="small" aria-label="Fit to width"
                          onClick={() => { setFitToWidth(true); setScale(1); }}>
                <FitScreenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}

        {downloadUrl && (
          <Tooltip title="Open in a new tab">
            <IconButton size="small" aria-label="Open in a new tab"
                        onClick={() => window.open(downloadUrl, '_blank', 'noopener,noreferrer')}>
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Close">
          <IconButton size="small" onClick={onClose} aria-label="Close document">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <DialogContent
        ref={containerRef}
        sx={{
          p: 0,
          bgcolor: '#3f3f46',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          overflow: 'auto',
        }}
      >
        {urlError && <Alert severity="error" sx={{ m: 3 }}>{urlError}</Alert>}
        {!downloadUrl && !urlError && <CircularProgress sx={{ color: 'white', mt: 6 }} />}

        {downloadUrl && isPdf && (
          <Box sx={{ py: 3 }}>
            <Document
              file={downloadUrl}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              onLoadError={() => setUrlError('This PDF could not be rendered.')}
              loading={<CircularProgress sx={{ color: 'white' }} />}
            >
              {/* react-pdf rotates during render, so the text layer turns with the page rather
                  than staying flat under a CSS transform. */}
              <Page
                pageNumber={pageNumber}
                rotate={rotation}
                width={fitToWidth ? Math.max(240, containerWidth - 96) : undefined}
                scale={fitToWidth ? undefined : scale}
                renderAnnotationLayer
                renderTextLayer
              />
            </Document>
          </Box>
        )}

        {downloadUrl && isImage && (
          <Box sx={{ py: 3, display: 'flex', justifyContent: 'center', width: '100%' }}>
            <img
              src={downloadUrl}
              alt={doc.originalFilename}
              style={{
                // CSS rotation leaves the layout box where it was, so a quarter-turned image is
                // bounded by what its *height* will become — hence a viewport-height cap on the
                // pre-rotation width.
                maxWidth: fitToWidth ? (quarterTurned ? '78vh' : '100%') : undefined,
                transform: `rotate(${rotation}deg)${fitToWidth ? '' : ` scale(${scale})`}`,
                transformOrigin: 'center center',
                transition: 'transform 180ms cubic-bezier(0.32, 0.72, 0, 1)',
              }}
            />
          </Box>
        )}

        {downloadUrl && !isPdf && !isImage && (
          <Alert severity="info" sx={{ m: 3, alignSelf: 'center' }}>
            There is no preview for <code>{doc.contentType}</code>. Open it in a new tab to
            download it.
          </Alert>
        )}
      </DialogContent>
    </>
  );
}
