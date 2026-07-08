import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Chip, CircularProgress, FormControl, IconButton, InputLabel,
  MenuItem, Paper, Select, Stack, Tooltip, Typography,
} from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { fetchDownloadUrl, listDealDocuments } from '../../api/documents.js';

// Configure the pdf.js worker once. Using a CDN keeps us out of Vite bundler config.
pdfjs.GlobalWorkerOptions.workerSrc =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

export function PdfViewerPane({ dealId, selectedDocumentId, onSelectDocument }) {
  const docsQ = useQuery({
    queryKey: ['documents', dealId],
    queryFn: () => listDealDocuments(dealId),
    enabled: Boolean(dealId),
  });

  // Voice notes are played in the Broker notes card above this pane, so keep them out of the
  // "Open document" picker — this viewer only handles previewable files (PDFs / images).
  const documents = (docsQ.data ?? []).filter((d) => d.documentType !== 'VOICE_NOTE');
  const selected = useMemo(
    () => documents.find((d) => d.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId],
  );

  // When the doc list arrives and nothing is selected yet, auto-pick the first PDF.
  useEffect(() => {
    if (!selectedDocumentId && documents.length > 0) {
      const firstViewable = documents.find((d) =>
        d.contentType === 'application/pdf' || IMAGE_TYPES.includes(d.contentType),
      );
      if (firstViewable) onSelectDocument?.(firstViewable.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents.length]);

  return (
    <Paper variant="outlined" sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle1">Documents</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="doc-pick-label">Open document</InputLabel>
          <Select labelId="doc-pick-label" label="Open document"
                  value={selectedDocumentId ?? ''}
                  onChange={(e) => onSelectDocument?.(e.target.value || null)}>
            <MenuItem value=""><em>None</em></MenuItem>
            {documents.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.originalFilename}
                {d.ownershipNodeId && <Chip size="small" sx={{ ml: 1 }} label="node" />}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {docsQ.isError && <Alert severity="error">Failed to load documents.</Alert>}

      {selected ? (
        <DocumentViewer doc={selected} />
      ) : (
        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="text.secondary" variant="body2">
            Select a document from the dropdown to view it here.
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

function DocumentViewer({ doc }) {
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [urlError, setUrlError] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [fitToWidth, setFitToWidth] = useState(true);
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setDownloadUrl(null);
    setUrlError(null);
    setPageNumber(1);
    setNumPages(null);
    fetchDownloadUrl(doc.id)
      .then((res) => { if (!cancelled) setDownloadUrl(res.downloadUrl); })
      .catch((e) => { if (!cancelled) setUrlError(e.response?.data?.message || 'Failed to load file'); });
    return () => { cancelled = true; };
  }, [doc.id]);

  useEffect(() => {
    if (!containerRef.current) return;
    const measure = () => setContainerWidth(containerRef.current?.clientWidth ?? 0);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const isPdf = doc.contentType === 'application/pdf';
  const isImage = IMAGE_TYPES.includes(doc.contentType);

  return (
    <Box ref={containerRef} sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="body2" sx={{ flexGrow: 1 }} noWrap title={doc.originalFilename}>
          <strong>{doc.originalFilename}</strong>
        </Typography>
        {isPdf && numPages && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <IconButton size="small" onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                        disabled={pageNumber <= 1}>
              <NavigateBeforeIcon fontSize="small" />
            </IconButton>
            <Typography variant="caption">{pageNumber} / {numPages}</Typography>
            <IconButton size="small" onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                        disabled={pageNumber >= numPages}>
              <NavigateNextIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}
        {(isPdf || isImage) && (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Zoom out">
              <IconButton size="small" onClick={() => { setFitToWidth(false); setScale((s) => Math.max(0.5, s - 0.2)); }}>
                <ZoomOutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Zoom in">
              <IconButton size="small" onClick={() => { setFitToWidth(false); setScale((s) => Math.min(3, s + 0.2)); }}>
                <ZoomInIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Fit to width">
              <IconButton size="small" onClick={() => { setFitToWidth(true); setScale(1); }}>
                <FitScreenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
        {downloadUrl && (
          <Tooltip title="Open in new tab">
            <IconButton size="small" onClick={() => window.open(downloadUrl, '_blank', 'noopener,noreferrer')}>
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {urlError && <Alert severity="error">{urlError}</Alert>}

      <Box sx={{
        flexGrow: 1, overflow: 'auto', bgcolor: '#444',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start', p: 2,
      }}>
        {!downloadUrl && !urlError && <CircularProgress sx={{ color: 'white', mt: 4 }} />}

        {downloadUrl && isPdf && (
          <Document
            file={downloadUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={() => setUrlError('Unable to render PDF.')}
            loading={<CircularProgress sx={{ color: 'white' }} />}
          >
            <Page
              pageNumber={pageNumber}
              width={fitToWidth ? Math.max(200, containerWidth - 64) : undefined}
              scale={fitToWidth ? undefined : scale}
              renderAnnotationLayer
              renderTextLayer
            />
          </Document>
        )}

        {downloadUrl && isImage && (
          <img src={downloadUrl} alt={doc.originalFilename}
               style={{
                 maxWidth: fitToWidth ? '100%' : undefined,
                 transform: fitToWidth ? undefined : `scale(${scale})`,
                 transformOrigin: 'top center',
               }} />
        )}

        {downloadUrl && !isPdf && !isImage && (
          <Alert severity="info" sx={{ alignSelf: 'center' }}>
            Preview not available for <code>{doc.contentType}</code>. Use the open-in-new-tab icon to download it.
          </Alert>
        )}
      </Box>
    </Box>
  );
}
