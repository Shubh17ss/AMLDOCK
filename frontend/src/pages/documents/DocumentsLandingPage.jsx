import { Box, Stack, Typography } from '@mui/material';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import { PageHeader } from '../../components/PageHeader.jsx';
import { BentoTile } from '../../components/bento/BentoTile.jsx';
import { DOCUMENT_MODULES } from './DocumentModulePage.jsx';
import { tokens } from '../../theme/theme.js';

const BLURBS = {
  RISK_ASSESSMENT:      'Upload risk assessment revisions and keep every past version on record.',
  COMPLIANCE_PROGRAMME: 'Keep your AML compliance programme current with a full version history.',
  ANNUAL_REPORT:        'File each year’s annual report and track prior submissions.',
};

/** Documents landing — one card per register, each opening its upload + history view. */
export function DocumentsLandingPage() {
  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow="3 registers · versioned uploads"
        title="Documents"
      />

      <Box sx={{
        display: 'grid',
        gap: { xs: 1.5, md: 2 },
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(280px, 1fr))' },
      }}>
        {DOCUMENT_MODULES.map((m, i) => (
          <BentoTile key={m.path} index={i} to={m.path} ariaLabel={m.title} sx={{ p: 2.75 }}>
            <Box sx={{
              width: 44, height: 44, borderRadius: '13px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: tokens.blueWash, color: tokens.blue, mb: 2,
            }}>
              <FileUploadOutlinedIcon />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1.02rem', color: tokens.ink }}>
              {m.title}
            </Typography>
            <Typography sx={{ mt: 0.75, fontSize: '0.84rem', color: tokens.muted, lineHeight: 1.45 }}>
              {BLURBS[m.category]}
            </Typography>
            <Typography sx={{
              mt: 'auto', pt: 2, fontSize: '0.8rem', fontWeight: 600, color: tokens.blue,
              display: 'inline-flex', alignItems: 'center', gap: 0.5,
            }}>
              Open register
              <Box component="span" aria-hidden sx={{ fontSize: '1em' }}>→</Box>
            </Typography>
          </BentoTile>
        ))}
      </Box>
    </Stack>
  );
}
