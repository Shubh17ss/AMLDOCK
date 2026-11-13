import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import { updateAssurance } from '../../../api/assurance.js';
import { OptionPill } from '../../../components/OptionPill.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';
import { tokens, fonts } from '../../../theme/theme.js';
import { formatDateTimeNumeric } from '../../../utils/formatters.js';
import { dealName } from '../../../utils/dealName.js';

/*
 * Compliance's assurance verdict on a signed-off deal version: the dialog that records it, the
 * read-only issues view, and the chips both show. Shared by the Assurance register and the deal
 * page, which each pass a deal and one of its versions.
 */

/** A well background: a light grey in light mode, a lifted shade in dark. Used by the issues dialog. */
const VERSIONS_BG = `color-mix(in srgb, ${tokens.muted} 8%, ${tokens.tile})`;

/**
 * How each verdict reads, and in what colour. Null is "not reviewed". Exported for the deal page's
 * Update Assurance button, which wears the current verdict's colours.
 */
export const ASSURANCE_META = {
  ASSURED:         { label: 'Passed',          color: 'success', wash: 'var(--cl-ok-wash)',  ink: tokens.approved },
  ACTION_REQUIRED: { label: 'Action required', color: 'error',   wash: 'var(--cl-err-wash)', ink: tokens.rejected },
};

/**
 * Records the result of an assurance: Passed, or Action required with what was found.
 *
 * <p>Nothing is saved until Update. An action-required result is built up here a finding at a
 * time — the issue, the remediation planned for it, Add — and sent as one list that replaces the
 * stored one. Passing sends no issues, and that is what clears any recorded before.
 */
export function AssuranceDialog({ open, deal, version: v, onClose }) {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [result, setResult] = useState(null); // 'ASSURED' | 'ACTION_REQUIRED' | null
  const [issues, setIssues] = useState([]);
  const [issue, setIssue] = useState('');
  const [remediation, setRemediation] = useState('');
  const [error, setError] = useState(null);

  // Opens on where the version stands, so amending an action-required list starts from it.
  useEffect(() => {
    if (!open) return;
    setResult(v.assuranceStatus ?? null);
    setIssues((v.issues ?? []).map((i) => ({ ...i })));
    setIssue('');
    setRemediation('');
    setError(null);
  }, [open, v]);

  const mut = useMutation({
    mutationFn: () => updateAssurance(deal.id, v.versionNo, {
      status: result,
      issues: result === 'ACTION_REQUIRED' ? issues : [],
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assurance'] });
      qc.invalidateQueries({ queryKey: ['dealVersions', deal.id] });
      showToast({
        severity: 'success',
        message: `v${v.versionNo} of ${dealName(deal.propertyAddress)} marked `
          + (result === 'ASSURED' ? 'passed' : 'action required'),
      });
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'That didn’t go through. Try again.'),
  });

  const canAdd = issue.trim().length >= 3 && remediation.trim().length >= 3;
  const addIssue = () => {
    if (!canAdd) return;
    setIssues((list) => [...list, { issue: issue.trim(), remediation: remediation.trim() }]);
    setIssue('');
    setRemediation('');
  };

  const ready = result === 'ASSURED' || (result === 'ACTION_REQUIRED' && issues.length > 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle component="div" sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box component="span">Update assurance</Box>
          <VersionChip no={v.versionNo} />
          {/* Where the version stands now — the saved verdict, not the pill being picked below. */}
          {v.assuranceStatus && <AssuranceChip status={v.assuranceStatus} />}
        </Stack>
        <Typography sx={{ fontSize: '0.85rem', color: tokens.muted, mt: 0.5 }}>
          {dealName(deal.propertyAddress)}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: tokens.ink, mb: 1.25 }}>
          What is the result of your assurance?
        </Typography>
        {/* Two equal halves, as in the design; the same pill the status dialog uses. */}
        <Stack direction="row" spacing={1.5} role="radiogroup" aria-label="Assurance result">
          <OptionPill
            label="Action required"
            fg={tokens.rejected}
            bg="var(--cl-err-wash)"
            selected={result === 'ACTION_REQUIRED'}
            onSelect={() => { setResult('ACTION_REQUIRED'); setError(null); }}
            sx={{ flex: 1, justifyContent: 'center', py: 1.25, fontSize: '0.9rem' }}
          />
          <OptionPill
            label="Passed"
            fg={tokens.approved}
            bg="var(--cl-ok-wash)"
            selected={result === 'ASSURED'}
            onSelect={() => { setResult('ASSURED'); setError(null); }}
            sx={{ flex: 1, justifyContent: 'center', py: 1.25, fontSize: '0.9rem' }}
          />
        </Stack>

        {result === 'ASSURED' && (
          <Typography variant="body2" sx={{ color: tokens.muted, mt: 2.5 }}>
            {v.issues?.length
              ? 'Marking it passed removes the issues recorded against this version.'
              : 'This signed-off version holds up on review. No note is needed.'}
          </Typography>
        )}

        {result === 'ACTION_REQUIRED' && (
          <Stack spacing={2} sx={{ mt: 2.5 }}>
            <TextField
              label="Identified issue"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              fullWidth
              autoFocus
            />
            <TextField
              label="Planned remediation"
              value={remediation}
              onChange={(e) => setRemediation(e.target.value)}
              multiline
              minRows={3}
              fullWidth
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={addIssue}
              disabled={!canAdd}
              fullWidth
            >
              Add identified issue
            </Button>

            <Box sx={{ pt: 1, borderTop: `1px solid ${tokens.hairline}` }}>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: tokens.ink, mb: 1 }}>
                Identified issues
              </Typography>
              <IssueList
                issues={issues}
                onRemove={(idx) => setIssues((list) => list.filter((_, i) => i !== idx))}
              />
            </Box>
          </Stack>
        )}

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={mut.isPending}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!ready || mut.isPending}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? 'Working…' : 'Update'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** The recorded findings on an action-required version, read-only. */
export function IssuesDialog({ open, deal, version: v, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle component="div" sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box component="span">Identified issues</Box>
          <VersionChip no={v.versionNo} />
          <AssuranceChip status={v.assuranceStatus} />
        </Stack>
        <Typography sx={{ fontSize: '0.85rem', color: tokens.muted, mt: 0.5 }}>
          {dealName(deal.propertyAddress)}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <IssueList issues={v.issues ?? []} />
        <Typography variant="caption" sx={{ display: 'block', mt: 1.25, color: tokens.muted }}>
          {[v.assuranceByName ? `Recorded by ${v.assuranceByName}` : 'Recorded',
            formatDateTimeNumeric(v.assuranceAt)].filter(Boolean).join(' · ')}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} variant="contained">Close</Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Issue / remediation pairs, numbered. Scrolls past a cap so a long list does not stretch the
 * dialog. With `onRemove`, each row gets a delete button.
 */
function IssueList({ issues, onRemove }) {
  if (issues.length === 0) {
    return (
      <Box
        sx={{
          py: 2, textAlign: 'center', borderRadius: '10px',
          border: `1px solid ${tokens.hairline}`, color: tokens.muted, fontSize: '0.88rem',
        }}
      >
        No issues identified yet
      </Box>
    );
  }
  return (
    <Stack
      spacing={1}
      sx={{ maxHeight: 280, overflowY: 'auto', pr: 0.5 }}
      tabIndex={0}
      aria-label="Identified issues"
    >
      {issues.map((it, idx) => (
        <Stack
          // Position is the identity here: two findings can share wording.
          // eslint-disable-next-line react/no-array-index-key
          key={idx}
          direction="row"
          spacing={1.25}
          alignItems="flex-start"
          sx={{
            p: 1.5, borderRadius: '10px',
            backgroundColor: VERSIONS_BG, border: `1px solid ${tokens.hairline}`,
          }}
        >
          <Typography sx={{ fontFamily: fonts.mono, fontSize: '0.75rem', color: tokens.muted, pt: 0.25 }}>
            {idx + 1}.
          </Typography>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: tokens.ink, overflowWrap: 'anywhere' }}>
              {it.issue}
            </Typography>
            <Typography
              sx={{ fontSize: '0.85rem', color: tokens.muted, mt: 0.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
            >
              <Box component="span" sx={{ fontWeight: 600 }}>Remediation: </Box>
              {it.remediation}
            </Typography>
          </Box>
          {onRemove && (
            <Tooltip title="Remove">
              <IconButton size="small" aria-label={`Remove issue ${idx + 1}`} onClick={() => onRemove(idx)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ))}
    </Stack>
  );
}

/** `v3`, in the ledger face. With `onClick` it becomes a button that opens that version. */
export function VersionChip({ no, onClick }) {
  const chip = (
    <Chip
      size="small"
      label={`v${no}`}
      variant="outlined"
      onClick={onClick}
      sx={{ fontFamily: fonts.mono, fontSize: '0.72rem', height: 22 }}
    />
  );
  return onClick ? <Tooltip title={`Open v${no}`}>{chip}</Tooltip> : chip;
}

/** The verdict as a chip. With `onClick` it becomes a button — the register opens the issues. */
export function AssuranceChip({ status, onClick, title }) {
  const meta = ASSURANCE_META[status];
  if (!meta) return <Chip size="small" label="Not reviewed" variant="outlined" sx={{ color: tokens.muted }} />;
  // Clickable, MUI floods the chip with the dark palette shade on hover. A slightly deeper wash is
  // enough to say "this opens something" without the chip changing colour.
  const hover = `color-mix(in srgb, ${meta.wash} 88%, ${meta.ink})`;
  const chip = (
    <Chip
      size="small"
      label={meta.label}
      color={meta.color}
      onClick={onClick}
      sx={onClick ? {
        '&:hover, &.Mui-focusVisible': { backgroundColor: hover },
        '&:active': { boxShadow: 'none' },
      } : undefined}
    />
  );
  return onClick && title ? <Tooltip title={title}>{chip}</Tooltip> : chip;
}
