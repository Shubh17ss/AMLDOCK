import { Box, Stack, TextField, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import { SegmentedField } from '../../components/SegmentedField.jsx';
import { tokens } from '../../theme/theme.js';
import { formatVerifiedAt, verificationDisplay } from './verificationDisplay.js';

/**
 * The two verifications a reviewer can grant.
 *
 * <p>Both are a yes. The exception is not a weaker verification — it is the same decision taken
 * despite a gap in the evidence, and the gap is what the note records.
 */
const OUTCOMES = [
  { value: 'VERIFIED', label: 'Verification' },
  { value: 'VERIFIED_WITH_EXCEPTION', label: 'Verification (Exception)' },
];

/**
 * Verifying one owner.
 *
 * <p>Controlled by {@code NodeDrawer}, which owns `{ outcome, notes }` so that the Verify button
 * in its footer can tell whether the form is answered. A tab that held its own state would need
 * the footer to reach into it, which is the same coupling pointed the harder way round.
 *
 * <p>Deliberately one question. Everything that used to be here — a three-way status radio, a
 * free-text note always on show, a voice recorder and the clips it had saved — described the
 * verification process rather than recording a decision, and none of it said who decided.
 */
export function NodeVerificationTab({ node, value, onChange, readOnly = false }) {
  const granted = verificationDisplay(node?.verificationStatus);
  const byline = [node?.verifiedByName, formatVerifiedAt(node?.verifiedAt)]
    .filter(Boolean)
    .join(' · ');

  const isException = value.outcome === 'VERIFIED_WITH_EXCEPTION';

  return (
    <Stack spacing={3} sx={{ minWidth: 0 }}>
      {/*
        * What is already on record, above the question.
        *
        * Before the question rather than after it: someone opening this tab on a verified owner
        * is usually checking what was decided, not deciding again, and making them read past a
        * form to find out invites them to re-grant what is already granted.
        */}
      {granted.verified && (
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            backgroundColor: granted.wash,
            border: `1px solid ${granted.border}`,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="flex-start">
            {granted.exception
              ? <ReportProblemOutlinedIcon sx={{ fontSize: '1.15rem', color: 'var(--cl-warn-text)' }} />
              : <CheckCircleIcon sx={{ fontSize: '1.15rem', color: granted.text }} />}

            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: granted.text }}>
                {granted.exception ? 'Verified with exception' : 'Verified'}
              </Typography>

              {/* The byline. Without it the record is an assertion with nobody behind it. */}
              {byline && (
                <Typography variant="caption" sx={{ color: granted.text, opacity: 0.75 }}>
                  {byline}
                </Typography>
              )}

              {/* The reason the exception was granted, quoted so it reads as the reviewer's
                  words rather than as the system describing itself. */}
              {granted.exception && node?.verificationNotes && (
                <Typography
                  sx={{
                    fontSize: '0.85rem', color: granted.text, fontStyle: 'italic',
                    overflowWrap: 'anywhere',
                  }}
                >
                  “{node.verificationNotes}”
                </Typography>
              )}
            </Stack>
          </Stack>
        </Box>
      )}

      <SegmentedField
        label="What sort of verification do you want to grant?"
        value={value.outcome}
        onChange={(v) => onChange({ ...value, outcome: v })}
        options={OUTCOMES}
        nullable
        disabled={readOnly}
        helper={granted.verified
          ? 'Granting one again replaces what is recorded above.'
          : undefined}
      />

      {/* Only for an exception. A note on a clean verification would be a box asking for a
          reason where there is no departure to explain. */}
      {isException && (
        <TextField
          label="Notes"
          required
          value={value.notes ?? ''}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          multiline
          minRows={4}
          disabled={readOnly}
          placeholder="Why is this owner being cleared despite the gap? What was sighted instead, and who accepted it?"
          helperText="Required. An exception with no reason recorded is the one that cannot be defended later."
        />
      )}

      {readOnly && (
        <Typography variant="caption" sx={{ color: tokens.muted }}>
          You can see what has been verified on this owner, but not change it.
        </Typography>
      )}
    </Stack>
  );
}
