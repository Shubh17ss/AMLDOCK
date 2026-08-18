// Bridges AddressFinder's official place names onto the vocabulary in nzLocations.js.
//
// The two disagree in three predictable ways, and every one of them produces the same silent
// failure if ignored: the Region/District Selects find no matching MenuItem, render empty, and
// the broker concludes the lookup did nothing.
//
//   1. Diacritics.  AddressFinder returns "Manawatū-Whanganui"; nzLocations stores
//      "Manawatu-Whanganui" (its header explains why — Windows keyboards, no IME).
//   2. Apostrophes. "Hawke's Bay" vs "Hawkes Bay", in either direction.
//   3. Territorial-authority suffixes. AddressFinder returns the bare "Christchurch";
//      nzLocations stores "Christchurch City". Likewise "Whangarei" vs "Whangarei District".
//
// Matching is therefore done on a folded key rather than on the raw strings, and the value
// returned is always the nzLocations spelling — that is what gets stored and what the Select
// needs to see.

import { NZ_REGIONS, districtsForRegion, NZ_DISTRICTS } from './nzLocations.js';

/**
 * Folds a place name to a comparison key: lowercase, no diacritics, no apostrophes, no
 * territorial-authority suffix, single-spaced.
 */
function fold(raw) {
  if (!raw) return '';
  return String(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // combining marks left behind by NFD
    .replace(/['’]/g, '')          // straight and typographic apostrophes
    .toLowerCase()
    .replace(/\b(district|city|region|territorial authority)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Region names AddressFinder uses that fold to something nzLocations doesn't have. Keyed by
 * folded input, valued with the nzLocations spelling.
 */
const REGION_ALIASES = {
  'wanganui': 'Manawatu-Whanganui',
  'manawatu wanganui': 'Manawatu-Whanganui',
  'manawatu': 'Manawatu-Whanganui',
  'whanganui': 'Manawatu-Whanganui',
  'bay of plenty region': 'Bay of Plenty',
  'auckland region': 'Auckland',
  'wellington region': 'Wellington',
  'nelson marlborough': 'Nelson',
};

const REGION_BY_KEY = new Map(NZ_REGIONS.map((r) => [fold(r.name), r.name]));

/**
 * An AddressFinder region name as nzLocations spells it, or null when there's no match.
 * Null is a real answer — the caller stores the raw string anyway and leaves the Select unset,
 * because dropping the address entirely is worse than showing one the broker can correct.
 */
export function normaliseRegion(raw) {
  const key = fold(raw);
  if (!key) return null;
  return REGION_BY_KEY.get(key) ?? REGION_ALIASES[key] ?? null;
}

/**
 * An AddressFinder city / territorial authority as nzLocations spells it.
 *
 * Searches the given region first, since district names are not unique across regions
 * ("Waitaki District" sits in Canterbury, but a bare "Waimate" could plausibly be read
 * elsewhere). Falls back to a nationwide search when the region is unknown or wrong, so a
 * failed region lookup doesn't cascade into a failed district lookup.
 */
export function normaliseDistrict(raw, region) {
  const key = fold(raw);
  if (!key) return null;

  const inRegion = districtsForRegion(region).find((d) => fold(d) === key);
  if (inRegion) return inRegion;

  for (const districts of Object.values(NZ_DISTRICTS)) {
    const hit = districts.find((d) => fold(d) === key);
    if (hit) return hit;
  }
  return null;
}

/**
 * The region a district belongs to, for when AddressFinder gives a city but no region.
 * Takes an already-normalised district name.
 */
export function regionForDistrict(district) {
  if (!district) return null;
  const key = fold(district);
  for (const [region, districts] of Object.entries(NZ_DISTRICTS)) {
    if (districts.some((d) => fold(d) === key)) return region;
  }
  return null;
}

/**
 * Maps an AddressFinder NZ result onto the property address fields.
 *
 * @param meta        the metadata object AddressFinder passes to result:select
 * @param fullAddress the single-line address string it passes alongside
 * @returns { addressLine1, addressLine2, suburb, district, region, postcode, country,
 *            unmatched: { region?, district? } }
 *
 * `unmatched` names the fields whose official spelling had no local equivalent, so the caller
 * can prompt for a correction instead of silently showing an empty Select.
 */
export function mapAddressFinderNz(meta = {}, fullAddress = '') {
  const rawRegion   = meta.region ?? '';
  const rawDistrict = meta.city ?? meta.territorial_authority ?? '';

  let region   = normaliseRegion(rawRegion);
  const district = normaliseDistrict(rawDistrict, region);
  // AddressFinder plan tiers differ on whether `region` is returned at all, so derive it from
  // the district when it's missing or unrecognised.
  if (!region && district) region = regionForDistrict(district);

  return {
    addressLine1: meta.address_line_1 || String(fullAddress).split(',')[0].trim() || '',
    addressLine2: meta.address_line_2 || '',
    suburb:       meta.suburb || '',
    district:     district || rawDistrict || '',
    region:       region || rawRegion || '',
    postcode:     meta.postcode || '',
    country:      'NZ',
    unmatched: {
      ...(rawRegion && !normaliseRegion(rawRegion) && !region ? { region: rawRegion } : {}),
      ...(rawDistrict && !district ? { district: rawDistrict } : {}),
    },
  };
}
