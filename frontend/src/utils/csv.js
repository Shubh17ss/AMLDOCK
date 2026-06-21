// Tiny CSV helpers — avoids pulling in a dependency for a simple, known schema.

/**
 * Minimal RFC-4180-ish parser. Handles quoted fields, embedded commas/newlines and ""
 * escapes, and normalises CRLF/CR. Returns an array of string[] rows (header row included).
 */
export function parseCsvRows(text) {
  const s = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Header name → canonical key (case/spacing tolerant).
const HEADER_ALIASES = {
  fullname: 'fullName', 'full name': 'fullName', name: 'fullName',
  email: 'email', 'email address': 'email',
  role: 'role',
  branch: 'branch', 'branch name': 'branch', branchname: 'branch',
};

/**
 * Parse the user-import CSV into normalised row objects: { fullName, email, role, branch }.
 * Blank lines are skipped. The first non-empty line is treated as the header.
 */
export function parseUsersCsv(text) {
  const raw = parseCsvRows(text).filter((r) => r.some((c) => c.trim() !== ''));
  if (raw.length === 0) return [];

  const header = raw[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? h.trim().toLowerCase());
  return raw.slice(1).map((cells) => {
    const obj = {};
    header.forEach((key, idx) => { obj[key] = (cells[idx] ?? '').trim(); });
    return {
      fullName: obj.fullName ?? '',
      email: obj.email ?? '',
      role: obj.role ?? '',
      branch: obj.branch ?? '',
    };
  });
}

function escapeCsv(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV string from a header array and an array of row arrays. */
export function buildCsv(headers, rows) {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) lines.push(row.map(escapeCsv).join(','));
  return lines.join('\n');
}
