// Property classification and reason-for-selling options for the broker's deal form.
//
// PROPERTY_TYPES mirrors the PropertyType enum in the backend
// (backend/src/main/java/nz/amldock/property/PropertyType.java). The column has no DB CHECK
// constraint (V28), so adding an option here + there needs no migration.
//
// REASONS_FOR_SELLING has no backend enum at all — deliberately. Its valid set depends on the
// property type, which a flat enum cannot express, so the codes are stored as free strings and
// this file is their canonical list. Codes are never renamed, only added; a stored code that
// falls out of the list still renders via reasonForSellingLabel's raw-value fallback.
//
// Order is the order shown in each dropdown.

export const PROPERTY_TYPES = [
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'LIFESTYLE', label: 'Lifestyle' },
  { value: 'COMMERCIAL_SALE', label: 'Commercial sale' },
  { value: 'COMMERCIAL_LEASE', label: 'Commercial lease' },
  { value: 'RURAL', label: 'Rural' },
  { value: 'BUSINESS', label: 'Business' },
];

// The AML-salient reasons — distress, urgency and forced sale — appear in every list. They are
// the reason this question is asked at all, so no property type may quietly omit them.
const DISTRESS = [
  { value: 'FINANCIAL_PRESSURE', label: 'Financial pressure' },
  { value: 'MORTGAGEE_SALE', label: 'Mortgagee sale' },
  { value: 'URGENT_SALE', label: 'Urgent sale' },
];

const RESIDENTIAL = [
  { value: 'DECEASED ESTATE', label: 'Deceased estate' },
  { value: 'DOWNSIZING', label: 'Downsizing' },
  { value: 'DEBT REDUCTION', label: 'Debt reduction' },
  { value: 'RELOCATION DUE TO JOB TRANSFER', label: 'Relocation due to job transfer' },
  { value: 'DOWNSIZING ASSET PORTFOLIO', label: 'Downsizing asset portfolio' },
  { value: 'MORTGAGEE_SALE', label: 'Mortgagee sale' },
  { value: 'LOST INTEREST', label: 'Lost interest' },
  { value: 'RELATIONSHIP SPLIT', label: 'Relationship split' },
  { value: 'PASSIVE INVESTMENT SALE', label: 'Passive investment sale' },
  { value: 'REALISING VALUE OF ASSET', label: 'Realising value of asset' },
  { value: 'RENTAL INVESTMENT SALE', label: 'Rental investment sale' },
  { value: 'RELEASE EQUITY FOR OTHER INVESTMENTS', label: 'Release equity for other investments' },
  { value: 'RETIREMENT', label: 'Retirement' },
  { value: 'RELOCATING', label: 'Relocating' },
  { value: 'SURPLUS TO REQUIREMENTS', label: 'Surplus to requirements' },
  { value: 'SPEC BUILD', label: 'Spec build' },
  { value: 'SUBDIVISION', label: 'Subdivision' },
  { value: 'UPSIZING', label: 'Upsizing' },
  { value: 'OTHER', label: 'Other' },
];

const LIFESTYLE = [
  ...RESIDENTIAL,
  {value : 'MOVING CLOSER TO CITY', label: 'Moving closer to city'},
  {value : 'SUCCESSION PLANNING', label: 'Succession planning'},
]

const RURAL=[
  ...LIFESTYLE
]

const COMMERCIAL_SALE=[
  { value: 'DECEASED ESTATE', label: 'Deceased estate' },
  { value: 'DOWNSIZING ASSET PORTFOLIO', label: 'Downsizing Asset Portfolio' },
  { value: 'DEBT REDUCTION', label: 'Debt reduction' },
  { value: 'MORTGAGEE_SALE/LIQUIDATION', label: 'Mortgagee sale/Liquidation' },
  { value: 'IMMINENT CAPITAL REQUIREMENT', label: 'Imminent capital requirement' },
  { value: 'PASSIVE INVESTMENT SALE', label: 'Passive investment sale' },
  { value: 'PREMISES BECOMING VACANT', label: 'Premises becoming vacant' },
  { value: 'RELOCATION', label: 'Relocation' },
  { value: 'RENTAL INVESTMENT SALE', label: 'Rental investment sale' },
  { value: 'RELATIONSHIP SPLIT', label: 'Relationship split' },
  { value: 'RETIREMENT', label: 'Retirement' },
  { value: 'REALISING VALUE OF ASSET', label: 'Realising value of asset' },
  { value: 'RELEASE EQUITY FOR OTHER INVESTMENTS', label: 'Release equity for other investments' },
  { value: 'SALE UNDER INSTRUCTION OF COURT', label: 'Sale under instruction of court' },
  { value: 'SALE AND LEASEBACK', label: 'Sale and leaseback' },
  { value: 'SPARE LAND SURPLUS TO REQUIREMENTS', label: 'Spare land surplus to requirements' },
  { value: 'SURPLUS TO REQUIREMENTS', label: 'Surplus to requirements' },
  { value: 'TOO MANAGEMENT INTENSIVE', label: 'Too management intensive' },
  { value: 'SPEC BUILD', label: 'Spec build' },
  { value: 'SUBDIVISION', label: 'Subdivision' },
  { value: 'UPSIZING', label: 'Upsizing' },
  { value: 'OTHER', label: 'Other' },
]

const COMMERCIAL_LEASE=[
  {value : 'EXISTING LEASE DUE TO EXPIRE', label: 'Existing lease due to expire'},
  {value : 'EXISTING TENANT-SUB LEASING', label: 'Existing tenant-sub leasing'},
  {value : 'EXISTING VACANT SPACE', label: 'Existing vacant space'},
  {value : 'NEW COMMERCIAL DEVELOPMENT', label: 'New commercial development'},
  {value : 'SUBDIVIDING THE BUILDING', label: 'Subdividing the building'},
  {value : 'OTHER', label: 'Other'},
]

const BUSINESS=[
  {value:'DECEASED ESTATE', label: 'Deceased estate'},
  {value:'DEBT REDUCTION', label: 'Debt reduction'},
  {value:'RELATIONSHIP SPLIT', label: 'Relationship split'},
  {value:'PARTNERSHIP SPLIT', label: 'Partnership split'},
  {value:'RETIREMENT', label: 'Retirement'},
  {value:'RELOCATING', label: 'Relocating'},
  {value:'LOST INTEREST-EXIT', label: 'Lost interest-exit'},
  {value:'RENTAL INVESTMENT SALE', label: 'Rental investment sale'},
  {value:'SPEC BUILD', label: 'Spec build'},
  {value:'SUBDIVISION', label: 'Subdivision'},
  {value:'TOO MANAGEMENT INTENSIVE', label: 'Too management intensive'},
  {value:'EXIT - CASHING OUT', label: 'Exit - Cashing out'},
  {value:'RELEASE EQUITY FOR OTHER INVESTMENTS', label: 'Release equity for other investments'},
  {value:'LIQUIDATION', label: 'Liquidation'},
  {value:'SURPLUS TO REQUIREMENTS', label: 'Surplus to requirements'},
  {value:'OTHER', label: 'Other'},
]

/** Reason options keyed by property type. */
export const REASONS_FOR_SELLING = {
  RESIDENTIAL_HOUSE: RESIDENTIAL,
  LIFESTYLE: LIFESTYLE,
  RURAL: RURAL,
  COMMERIAL_SALE: COMMERCIAL_SALE,
  COMMERCIAL_LEASE: COMMERCIAL_LEASE,
  BUSINESS: BUSINESS,
};

/** Reason options for a property type; falls back to the residential list. */
export const reasonsForPropertyType = (type) => REASONS_FOR_SELLING[type] ?? RESIDENTIAL;

/** Display label for a stored property-type code; falls back to the raw value. */
export const propertyTypeLabel = (value) =>
  PROPERTY_TYPES.find((t) => t.value === value)?.label ?? value ?? '—';

/**
 * Display label for a stored reason code. Needs the property type because the same code can
 * carry a different label between lists; searches every list if the type is unknown, so a
 * reason still reads correctly when its type has been cleared.
 */
export const reasonForSellingLabel = (type, value) => {
  if (!value) return '—';
  const inType = reasonsForPropertyType(type).find((r) => r.value === value);
  if (inType) return inType.label;
  for (const list of Object.values(REASONS_FOR_SELLING)) {
    const hit = list.find((r) => r.value === value);
    if (hit) return hit.label;
  }
  return value;
};
