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

// Text a user typed (an IFT listing address, a reference) must never run as a formula in the
// spreadsheet of whoever opens the export. Same three rules as the server's owners export
// (backend IndividualCsv.escape):
//  1. A formula character (= + - @) right after a separator (, ; | tab, line break, then optional
//     spaces) gets an apostrophe. Otherwise "x;=HYPERLINK(...)" splits into a live formula in a
//     spreadsheet that separates on ';' (security scan F10).
//  2. A cell that would open as a formula (leading = + - @, even after spaces, or a leading tab or
//     CR) gets an apostrophe, so it opens as text (C-14).
//  3. Every cell is quoted, so no separator inside a value can split it.
// A plain number, even a negative one or one already formatted as a string (amounts arrive via
// toFixed), cannot be a formula and must stay a number, so rules 1–2 skip it. It is still quoted,
// and spreadsheets read a quoted plain number as a number.
const AFTER_SEPARATOR = /([,;\t|\r\n]\s*)([=+\-@])/g;
const FORMULA_LEAD = /^[\t\r]|^\s*[=+\-@]/;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

export function escapeCsv(value) {
  let s = String(value ?? '');
  if (!PLAIN_NUMBER.test(s)) {
    s = s.replace(AFTER_SEPARATOR, "$1'$2");
    if (FORMULA_LEAD.test(s)) s = `'${s}`;
  }
  return `"${s.replace(/"/g, '""')}"`;
}

/** Build a CSV string from a header array and an array of row arrays. */
export function buildCsv(headers, rows) {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) lines.push(row.map(escapeCsv).join(','));
  return lines.join('\n');
}
