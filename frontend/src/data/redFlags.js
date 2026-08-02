// Red-flag indicators for the Suspicious Activity Register.
//
// Keep in sync with the RedFlag enum in the backend
// (backend/src/main/java/nz/amldock/suspiciousactivity/RedFlag.java). The column has no DB
// CHECK constraint, so adding an option here + there needs no migration.
//
// Add new options to this list — order is the order shown in the dropdown.
export const RED_FLAGS = [
  { value: 'ANONYMITY', label: 'Anonymity' },
  { value: 'CASH_BUSINESS', label: 'Cash Business' },
  { value: 'SPLIT_CASH_PAYMENTS', label: 'Split Cash Payments' },
  { value: 'CHANGING_PARTIES', label: 'Changing Parties' },
  { value: 'COMPLEX_STRUCTURE_TRANSACTION', label: 'Complex Structure / Transaction' },
  { value: 'CDD_QUESTIONS_PROCESS', label: 'CDD Questions Process' },
  { value: 'CDD_RELUCTANCE', label: 'CDD Reluctance' },
  { value: 'WILLING_TO_ACCEPT_LOWER_VALUES', label: 'Willing to Accept Lower Values' },
  { value: 'HIGH_RISK_JURISDICTION', label: 'High Risk Jurisdiction' },
  { value: 'LINKS_TO_CRIME_GROUPS', label: 'Links to Crime Groups' },
  { value: 'MAKE_AN_OFFER_WITHOUT_INSPECTING_PROPERTY', label: 'Make an Offer without Inspecting Property' },
  { value: 'AVOID_FACE_TO_FACE_MEETINGS', label: 'Avoid Face-to-Face Meetings' },
  { value: 'OFF_MARKET', label: 'Off Market' },
  { value: 'OVERSEAS_PEP', label: 'Overseas PEP' },
  { value: 'QUESTIONABLE_MEANS', label: 'Questionable Means' },
  { value: 'REMOTE', label: 'Remote' },
  { value: 'THIRD_PARTY_INVOLVEMENT', label: 'Third-Party Involvement' },
  { value: 'UNTRACABLE_PAYMENTS', label: 'Untraceable Payments' },
  { value: 'UNUSUAL_ACTIVITY', label: 'Unusual Activity' },
  { value: 'URGENCY', label: 'Urgency' },
];

/** Display label for a stored red-flag code; falls back to the raw value. */
export const redFlagLabel = (value) =>
  RED_FLAGS.find((f) => f.value === value)?.label ?? value ?? '—';
