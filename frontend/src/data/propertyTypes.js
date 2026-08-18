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
  { value: 'RESIDENTIAL_HOUSE', label: 'Residential house' },
  { value: 'APARTMENT',         label: 'Apartment' },
  { value: 'TOWNHOUSE',         label: 'Townhouse / unit' },
  { value: 'LIFESTYLE_BLOCK',   label: 'Lifestyle block' },
  { value: 'VACANT_LAND',       label: 'Vacant land / section' },
  { value: 'RURAL_FARM',        label: 'Rural / farm' },
  { value: 'COMMERCIAL',        label: 'Commercial' },
  { value: 'INDUSTRIAL',        label: 'Industrial' },
  { value: 'RETAIL',            label: 'Retail' },
  { value: 'OTHER',             label: 'Other' },
];

// The AML-salient reasons — distress, urgency and forced sale — appear in every list. They are
// the reason this question is asked at all, so no property type may quietly omit them.
const DISTRESS = [
  { value: 'FINANCIAL_PRESSURE', label: 'Financial pressure' },
  { value: 'MORTGAGEE_SALE',     label: 'Mortgagee sale' },
  { value: 'URGENT_SALE',        label: 'Urgent sale' },
];

const RESIDENTIAL = [
  { value: 'DOWNSIZING',            label: 'Downsizing' },
  { value: 'UPSIZING',              label: 'Upsizing' },
  { value: 'RELOCATION_WITHIN_NZ',  label: 'Relocating within New Zealand' },
  { value: 'RELOCATION_OVERSEAS',   label: 'Relocating overseas' },
  { value: 'RETIREMENT_OR_CARE',    label: 'Retirement or moving into care' },
  { value: 'RELATIONSHIP_CHANGE',   label: 'Relationship change' },
  { value: 'DECEASED_ESTATE',       label: 'Deceased estate' },
  { value: 'INVESTMENT_EXIT',       label: 'Exiting an investment' },
  { value: 'TRUST_RESTRUCTURE',     label: 'Trust restructure' },
  ...DISTRESS,
  { value: 'OTHER',                 label: 'Other' },
];

const RURAL = [
  { value: 'RETIREMENT_FROM_FARMING', label: 'Retiring from farming' },
  { value: 'SUCCESSION_TO_FAMILY',    label: 'Succession to family' },
  { value: 'FARM_RESTRUCTURE',        label: 'Farm restructure' },
  { value: 'DOWNSIZING',              label: 'Downsizing' },
  { value: 'RELOCATION',              label: 'Relocating' },
  { value: 'DECEASED_ESTATE',         label: 'Deceased estate' },
  ...DISTRESS,
  { value: 'OTHER',                   label: 'Other' },
];

const LAND = [
  { value: 'DEVELOPMENT_ABANDONED', label: 'Development no longer proceeding' },
  { value: 'SUBDIVISION_SALE',      label: 'Selling a subdivided lot' },
  { value: 'CONSENT_LAPSED',        label: 'Resource consent lapsed' },
  { value: 'INVESTMENT_EXIT',       label: 'Exiting an investment' },
  { value: 'DECEASED_ESTATE',       label: 'Deceased estate' },
  ...DISTRESS,
  { value: 'OTHER',                 label: 'Other' },
];

const BUSINESS = [
  { value: 'BUSINESS_CLOSURE',    label: 'Business closing' },
  { value: 'BUSINESS_RELOCATION', label: 'Business relocating' },
  { value: 'PORTFOLIO_REBALANCE', label: 'Rebalancing a portfolio' },
  { value: 'LEASE_EXPIRY',        label: 'Lease expiry' },
  { value: 'INVESTMENT_EXIT',     label: 'Exiting an investment' },
  { value: 'RECEIVERSHIP',        label: 'Receivership / liquidation' },
  ...DISTRESS,
  { value: 'OTHER',               label: 'Other' },
];

/** Reason options keyed by property type. */
export const REASONS_FOR_SELLING = {
  RESIDENTIAL_HOUSE: RESIDENTIAL,
  APARTMENT:         RESIDENTIAL,
  TOWNHOUSE:         RESIDENTIAL,
  LIFESTYLE_BLOCK:   RURAL,
  RURAL_FARM:        RURAL,
  VACANT_LAND:       LAND,
  COMMERCIAL:        BUSINESS,
  INDUSTRIAL:        BUSINESS,
  RETAIL:            BUSINESS,
  OTHER:             RESIDENTIAL,
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
