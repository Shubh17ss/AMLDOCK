// AddressFinder result metadata → our property columns, for NZ and AU.
//
// Best-effort by design: addressLine1 always gets a value (the widget's line 1, or the first
// comma-segment of the one-line address), and everything else is enrichment. A metadata key that
// differs from what's documented costs a region, not the address.
//
// No name folding. Its predecessor mapped AddressFinder's official spellings onto the local
// nzLocations vocabulary purely so the cascading Select boxes found a matching MenuItem. With a
// single free-form input there are no options to match, and the official spelling
// ("Manawatū-Whanganui", "Hawke's Bay") is the one worth keeping on a compliance record.

/** The first line of a one-line address, for when the widget gives no structured line 1. */
function firstSegment(fullAddress) {
  return String(fullAddress || '').split(',')[0].trim();
}

/**
 * @param meta        the metadata object AddressFinder passes to `result:select`
 * @param fullAddress the single-line address string it passes alongside
 * @param country     'NZ' | 'AU' — which vocabulary the metadata uses
 * @returns the property address fields; keys always present, values possibly empty
 */
export function mapAddressFinderResult(meta = {}, fullAddress = '', country = 'NZ') {
  const addressLine1 = meta.address_line_1 || firstSegment(fullAddress);
  const addressLine2 = meta.address_line_2 || '';
  const postcode = meta.postcode || '';

  if (country === 'AU') {
    // AU has no district tier of its own; the locality is the closest equivalent, and the state
    // takes the region slot. Storing the locality in both keeps `district` populated for the
    // read surfaces that show it, rather than leaving a visible gap for Australian deals.
    const locality = meta.locality_name || '';
    return {
      addressLine1, addressLine2,
      suburb: locality,
      district: locality,
      region: meta.state_territory || '',
      postcode,
    };
  }

  return {
    addressLine1, addressLine2,
    suburb: meta.suburb || '',
    // NZ "city" is the territorial authority, which is what our district column holds (see V4).
    district: meta.city || meta.territorial_authority || '',
    region: meta.region || '',
    postcode,
  };
}

/** A property's address on one line, for display. Skips whatever is missing. */
export function formatPropertyAddress(p) {
  if (!p) return '';
  return [p.addressLine1, p.addressLine2, p.suburb, p.district, p.region, p.postcode]
    .filter(Boolean)
    .join(', ');
}
