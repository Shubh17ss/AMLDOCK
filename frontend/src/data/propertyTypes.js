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
  { value: 'DEVELOPMENT', label: 'Development' },
];

// The AML-salient reasons — distress, urgency and forced sale — appear in every list. They are
// the reason this question is asked at all, so no property type may quietly omit them.
const DISTRESS = [
  { value: 'FINANCIAL_PRESSURE', label: 'Financial pressure' },
  { value: 'MORTGAGEE_SALE', label: 'Mortgagee sale' },
  { value: 'URGENT_SALE', label: 'Urgent sale' },
];

/**
 * A type's own reasons, with the distress three in front of them.
 *
 * <p>They lead rather than trail because they are the answers this question exists to catch; a
 * reviewer scanning the stored value should meet them first.
 *
 * <p>De-duplicated by code, not appended blindly: several lists already carry `MORTGAGEE_SALE`
 * somewhere in the middle, and spreading the trio over the top of one would render the same
 * option twice — twice in the dropdown, and twice under the same React key.
 *
 * <p>`omit` is for a list that already says the same thing under a different code. Commercial
 * sale has `MORTGAGEE_SALE/LIQUIDATION`, which covers the ground `MORTGAGEE_SALE` would, and
 * offering both side by side asks the broker to choose between two spellings of one answer.
 */
const withDistress = (list, omit = []) => {
  const lead = DISTRESS.filter((d) => !omit.includes(d.value));
  const leading = new Set(lead.map((d) => d.value));
  return [...lead, ...list.filter((r) => !leading.has(r.value))];
};

const RESIDENTIAL_BASE = [
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

const LIFESTYLE_BASE = [
  ...RESIDENTIAL_BASE,
  { value: 'MOVING CLOSER TO CITY', label: 'Moving closer to city' },
  { value: 'SUCCESSION PLANNING', label: 'Succession planning' },
];

const RURAL_BASE = [
  ...LIFESTYLE_BASE,
];

const COMMERCIAL_SALE_BASE = [
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
];

const COMMERCIAL_LEASE_BASE = [
  { value: 'EXISTING LEASE DUE TO EXPIRE', label: 'Existing lease due to expire' },
  { value: 'EXISTING TENANT-SUB LEASING', label: 'Existing tenant-sub leasing' },
  { value: 'EXISTING VACANT SPACE', label: 'Existing vacant space' },
  { value: 'NEW COMMERCIAL DEVELOPMENT', label: 'New commercial development' },
  { value: 'SUBDIVIDING THE BUILDING', label: 'Subdividing the building' },
  { value: 'OTHER', label: 'Other' },
];

const BUSINESS_BASE = [
  { value: 'DECEASED ESTATE', label: 'Deceased estate' },
  { value: 'DEBT REDUCTION', label: 'Debt reduction' },
  { value: 'RELATIONSHIP SPLIT', label: 'Relationship split' },
  { value: 'PARTNERSHIP SPLIT', label: 'Partnership split' },
  { value: 'RETIREMENT', label: 'Retirement' },
  { value: 'RELOCATING', label: 'Relocating' },
  { value: 'LOST INTEREST-EXIT', label: 'Lost interest-exit' },
  { value: 'RENTAL INVESTMENT SALE', label: 'Rental investment sale' },
  { value: 'SPEC BUILD', label: 'Spec build' },
  { value: 'SUBDIVISION', label: 'Subdivision' },
  { value: 'TOO MANAGEMENT INTENSIVE', label: 'Too management intensive' },
  { value: 'EXIT - CASHING OUT', label: 'Exit - Cashing out' },
  { value: 'RELEASE EQUITY FOR OTHER INVESTMENTS', label: 'Release equity for other investments' },
  { value: 'LIQUIDATION', label: 'Liquidation' },
  { value: 'SURPLUS TO REQUIREMENTS', label: 'Surplus to requirements' },
  { value: 'OTHER', label: 'Other' },
];

// What is being built, which is what a development is sold as. Its own list rather than the
// residential one: nobody sells a subdivision because they are downsizing.
const DEVELOPMENT_BASE = [
  { value: 'RESIDENTIAL BUILDING', label: 'Residential building' },
  { value: 'TOWNHOUSES', label: 'Townhouses' },
  { value: 'COMMERCIAL BUILDING', label: 'Commercial building' },
  { value: 'INTEGRATED RESIDENTIAL PROJECT', label: 'Integrated residential project' },
  { value: 'MIXED USE DEVELOPMENT', label: 'Mixed use development' },
  { value: 'SUBDIVISION', label: 'Subdivision' },
  { value: 'STANDALONE HOME', label: 'Standalone home' },
];

/**
 * Reason options keyed by property type.
 *
 * <p>Keys are the `value` codes in PROPERTY_TYPES, and have to stay that way — a key that matches
 * no type is a list nothing can reach.
 */
export const REASONS_FOR_SELLING = {
  RESIDENTIAL: withDistress(RESIDENTIAL_BASE),
  LIFESTYLE: withDistress(LIFESTYLE_BASE),
  RURAL: withDistress(RURAL_BASE),
  // Its MORTGAGEE_SALE/LIQUIDATION already covers the forced sale, so the plain code stays out.
  COMMERCIAL_SALE: withDistress(COMMERCIAL_SALE_BASE, ['MORTGAGEE_SALE']),
  COMMERCIAL_LEASE: withDistress(COMMERCIAL_LEASE_BASE),
  BUSINESS: withDistress(BUSINESS_BASE),
  DEVELOPMENT: withDistress(DEVELOPMENT_BASE),
};

/** Reason options for a property type; falls back to the residential list. */
export const reasonsForPropertyType = (type) =>
  REASONS_FOR_SELLING[type] ?? REASONS_FOR_SELLING.RESIDENTIAL;

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
