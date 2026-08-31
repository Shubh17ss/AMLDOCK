import { InputAdornment, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/SearchOutlined';
import { tokens } from '../theme/theme.js';

/**
 * The register filter box, shared by the training tabs so they all search the same way.
 *
 * `sx` merges last, so a caller can override the 320px cap — a phone wants the field at the width
 * of the rows it filters, not at a desktop measure.
 */
export function SearchField({ value, onChange, placeholder = 'Search…', width = 320, sx }) {
  return (
    <TextField
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      size="small"
      sx={{ maxWidth: width, ...sx }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon sx={{ fontSize: 18, color: tokens.muted }} />
          </InputAdornment>
        ),
      }}
    />
  );
}

/** Case-insensitive "does any of these fields contain the query" test. */
export const matchesSearch = (query, ...fields) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (f ?? '').toString().toLowerCase().includes(q));
};
