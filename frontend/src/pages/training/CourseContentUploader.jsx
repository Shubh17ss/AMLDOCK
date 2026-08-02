import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, IconButton, LinearProgress, Paper, Stack, Tooltip, Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/CloseRounded';
import {
  uploadCourseFile, deleteCourseFile, fetchCourseFileDownloadUrl,
} from '../../api/training.js';
import { useToast } from '../../components/ToastProvider.jsx';
import { tokens, fonts } from '../../theme/theme.js';

// Matches the server cap (S3_MAX_BYTES default) and DocumentUploader.jsx.
const MAX_BYTES = 25 * 1024 * 1024;

export const formatBytes = (bytes) => {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/**
 * Course material — any file type. This is the one upload path in the app with no MIME filter:
 * slides, spreadsheets, images and video are all legitimate training content, so only the size
 * cap applies.
 *
 * Two modes, because a file needs a course row to hang off:
 *   create — files are staged in local state and uploaded once the course exists
 *   edit   — the course is already there, so each file uploads as soon as it's picked
 */
export function CourseContentUploader({
  courseId = null,
  staged = [],
  onStagedChange,
  uploaded = [],
  onUploaded,
  disabled = false,
}) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // { name, percent }

  const isEdit = Boolean(courseId);

  const uploadMut = useMutation({
    mutationFn: async (fileList) => {
      for (const file of fileList) {
        setBusy({ name: file.name, percent: 0 });
        // Sequential — parallel presigned PUTs of large media make progress meaningless.
        await uploadCourseFile(courseId, file, (percent) => setBusy({ name: file.name, percent }));
      }
    },
    onSuccess: () => {
      setBusy(null);
      qc.invalidateQueries({ queryKey: ['trainingCourses'] });
      onUploaded?.();
    },
    onError: (e) => {
      setBusy(null);
      setError(e.response?.data?.message || 'Upload failed. Try again.');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (f) => deleteCourseFile(courseId, f.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trainingCourses'] });
      onUploaded?.();
    },
    onError: (e) => setError(e.response?.data?.message || 'Could not remove the file.'),
  });

  const accept = (fileList) => {
    const picked = Array.from(fileList ?? []);
    if (picked.length === 0) return;

    const tooBig = picked.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      setError(`${tooBig.name} exceeds the ${formatBytes(MAX_BYTES)} limit.`);
      return;
    }
    setError(null);
    if (isEdit) uploadMut.mutate(picked);
    else onStagedChange([...staged, ...picked]);
  };

  const download = async (f) => {
    try {
      const { downloadUrl } = await fetchCourseFileDownloadUrl(courseId, f.id);
      window.open(downloadUrl, '_blank', 'noopener');
    } catch {
      showToast({ severity: 'error', message: 'Could not get a download link. Try again.' });
    }
  };

  const rows = isEdit ? uploaded : staged;

  return (
    <Stack spacing={2}>
      <Typography sx={{ fontSize: '0.85rem', color: tokens.muted }}>
        Slides, handouts, recordings — any file type, up to {formatBytes(MAX_BYTES)} each.
        {!isEdit && ' Files upload once the course is saved.'}
      </Typography>

      <Box
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) accept(e.dataTransfer.files);
        }}
        sx={{
          border: `1.5px dashed ${dragOver ? tokens.blue : tokens.hairline2}`,
          borderRadius: '14px',
          backgroundColor: dragOver ? tokens.blueWash : '#FBFCFE',
          p: 4, textAlign: 'center', cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'border-color 0.15s ease, background-color 0.15s ease',
        }}
      >
        {/* No `accept` — course material is deliberately unrestricted by type. */}
        <input
          ref={inputRef}
          type="file"
          hidden
          multiple
          onChange={(e) => { accept(e.target.files); e.target.value = ''; }}
        />
        <UploadFileIcon sx={{ fontSize: 34, color: tokens.muted }} />
        <Typography sx={{ mt: 1, fontWeight: 600, fontSize: '0.9rem', color: tokens.ink }}>
          Drag and drop files here or click to browse
        </Typography>
        <Button
          size="small"
          variant="contained"
          sx={{ mt: 1.5 }}
          disabled={disabled}
          onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
        >
          Select files
        </Button>
      </Box>

      {busy && (
        <Box>
          <LinearProgress variant="determinate" value={busy.percent}
                          sx={{ borderRadius: 999, height: 6 }} />
          <Typography sx={{ mt: 0.5, fontSize: '0.72rem', color: tokens.muted }}>
            Uploading {busy.name}… {busy.percent}%
          </Typography>
        </Box>
      )}

      {rows.length > 0 && (
        <Stack spacing={1}>
          {rows.map((f, index) => (
            <Paper
              key={isEdit ? f.id : `${f.name}-${index}`}
              variant="outlined"
              sx={{ px: 1.5, py: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{
                  fontSize: '0.85rem', color: tokens.ink,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {isEdit ? f.originalFilename : f.name}
                </Typography>
                <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.7rem', color: tokens.muted }}>
                  {formatBytes(isEdit ? f.sizeBytes : f.size)}
                  {!isEdit && ' · not uploaded yet'}
                </Typography>
              </Box>

              {isEdit ? (
                <>
                  <Tooltip title="Download">
                    <IconButton size="small" onClick={() => download(f)}>
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Remove from course">
                    <span>
                      <IconButton size="small" disabled={deleteMut.isPending}
                                  onClick={() => deleteMut.mutate(f)}>
                        <DeleteOutlineIcon fontSize="small" sx={{ color: tokens.rejected }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </>
              ) : (
                <Tooltip title="Remove">
                  <IconButton
                    size="small"
                    onClick={() => onStagedChange(staged.filter((_, i) => i !== index))}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Paper>
          ))}
        </Stack>
      )}

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
    </Stack>
  );
}
