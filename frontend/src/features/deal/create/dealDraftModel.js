// The shape of the deal-creation form, and the translations between it and the API.
//
// One rule governs this file: **every builder emits every field it owns, every time.**
//
// The wizard this replaces built a different payload for create than for update — it created
// the draft with the full form, then only ever re-sent { notes }. Anything the broker changed
// after that point was silently dropped. Since the API writes only the fields present in a
// PATCH and is idempotent, always sending the whole group is cheap and makes that class of bug
// impossible to reintroduce.
//
// Blank strings are sent deliberately. The API reads "" as "clear this field" and null as
// "leave it alone", so clearing an answer requires the empty string to travel.

/** VENDOR / PURCHASER as the broker thinks of it → the stored TransactionType. */
export const TRANSACTION_TYPE_BY_CLIENT_ROLE = {
  VENDOR: 'SALE',
  PURCHASER: 'PURCHASE',
};

export const CLIENT_ROLE_BY_TRANSACTION_TYPE = {
  SALE: 'VENDOR',
  PURCHASE: 'PURCHASER',
};

export const EMPTY_FORM = {
  // Section 1
  clientRole: '',            // 'VENDOR' | 'PURCHASER'

  // Section 2
  property: {
    addressLine1: '', addressLine2: '', suburb: '', district: '', region: '',
    postcode: '',
    propertyType: '', reasonForSelling: '',
  },
  transactionPurpose: '',
  trustInvolved: null,       // null = unanswered, distinct from false
  onSoldQuickly: null,
  foreignExposureCountry: '', // '' = unanswered, 'NONE' = asked and there is none

  // Section 3
  clientRemote: null,       // null = unanswered, distinct from "no"
  contactName: '',
  contactEmail: '',
  contactPhone: '',

  // Section 4
  redFlagPresent: null,
  valuationMin: '',
  valuationMax: '',
  notes: '',
};

const num = (v) => (v === '' || v == null ? null : Number(v));

/** Everything stored on the deal itself. */
export function buildDealPatch(form) {
  return {
    transactionType: TRANSACTION_TYPE_BY_CLIENT_ROLE[form.clientRole] ?? null,
    transactionPurpose: form.transactionPurpose,
    trustInvolved: form.trustInvolved,
    onSoldQuickly: form.onSoldQuickly,
    foreignExposureCountry: form.foreignExposureCountry,
    clientRemote: form.clientRemote,
    redFlagPresent: form.redFlagPresent,
    valuationMin: num(form.valuationMin),
    valuationMax: num(form.valuationMax),
    notes: form.notes,
    // The key contact is the deal's point of contact. Role is left alone — the form doesn't
    // ask, and the API would otherwise blank whatever the branch prefilled.
    pocName: form.contactName,
    pocEmail: form.contactEmail,
    pocPhone: form.contactPhone,
  };
}

/** Everything stored on the property. */
export function buildPropertyPatch(form) {
  const p = form.property;
  return {
    addressLine1: p.addressLine1,
    addressLine2: p.addressLine2,
    suburb: p.suburb,
    district: p.district,
    region: p.region,
    postcode: p.postcode,
    propertyType: p.propertyType || null,
    reasonForSelling: p.reasonForSelling,
  };
}

/**
 * Everything stored on the client.
 *
 * The client is provisional at this stage: the broker scans IDs of natural persons and names
 * a key contact, but the entity that owns the property is established later by admin/AMLCo.
 * So the contact's name seeds displayName — enough for deal lists to read — and clientType is
 * left unset rather than guessed, which the UI shows as "Pending review".
 */
export function buildClientPatch(form) {
  return {
    displayName: form.contactName,
    email: form.contactEmail,
    phone: form.contactPhone,
  };
}

/** The create payload: the same three groups, in the shape POST /deals expects. */
export function buildCreatePayload(form) {
  const { pocName, pocEmail, pocPhone, ...deal } = buildDealPatch(form);
  return {
    ...deal,
    pocName,
    pocEmail,
    pocPhone,
    property: buildPropertyPatch(form),
    client: buildClientPatch(form),
  };
}

/** Rehydrates the form from a DealDto, for resuming a draft. */
export function dtoToForm(dto) {
  const p = dto.property ?? {};
  return {
    ...EMPTY_FORM,
    clientRole: CLIENT_ROLE_BY_TRANSACTION_TYPE[dto.transactionType] ?? '',
    property: {
      addressLine1: p.addressLine1 ?? '',
      addressLine2: p.addressLine2 ?? '',
      suburb: p.suburb ?? '',
      district: p.district ?? '',
      region: p.region ?? '',
      country: p.country ?? 'NZ',
      postcode: p.postcode ?? '',
      propertyType: p.propertyType ?? '',
      reasonForSelling: p.reasonForSelling ?? '',
    },
    transactionPurpose: dto.transactionPurpose ?? '',
    trustInvolved: dto.trustInvolved ?? null,
    onSoldQuickly: dto.onSoldQuickly ?? null,
    foreignExposureCountry: dto.foreignExposureCountry ?? '',
    clientRemote: dto.clientRemote ?? null,
    contactName: dto.pocName ?? '',
    contactEmail: dto.pocEmail ?? '',
    contactPhone: dto.pocPhone ?? '',
    redFlagPresent: dto.redFlagPresent ?? null,
    valuationMin: dto.valuationMin ?? '',
    valuationMax: dto.valuationMax ?? '',
    notes: dto.notes ?? '',
  };
}

/**
 * What the broker still owes before a section will let them past.
 *
 * Returns a list of human-readable gaps rather than a boolean, so the form can say what is
 * missing instead of just disabling the button and leaving them to guess.
 */
export function sectionGaps(section, form) {
  const gaps = [];
  if (section === 1) {
    if (!form.clientRole) gaps.push('Choose whether your client is the vendor or the purchaser');
  }
  if (section === 2) {
    const p = form.property;
    if (!p.addressLine1) gaps.push('Property address');
    if (!p.propertyType) gaps.push('Property type');
    if (!p.reasonForSelling) gaps.push('Reason for selling');
    if (form.trustInvolved == null) gaps.push('Whether a trust is involved in beneficial ownership');
    if (form.onSoldQuickly == null) gaps.push('Whether the property is being on-sold quickly');
    if (!form.foreignExposureCountry) gaps.push('Foreign exposure (choose "None" if there is none)');
  }
  if (section === 3) {
    if (form.clientRemote == null) gaps.push('Whether the client is remote');
    if (!form.contactName) gaps.push('Key contact name');
  }
  if (section === 4) {
    if (form.redFlagPresent == null) gaps.push('Whether there is a red flag');
    const min = num(form.valuationMin);
    const max = num(form.valuationMax);
    if (min != null && max != null && max < min) {
      gaps.push('Maximum property value must be at or above the minimum');
    }
  }
  return gaps;
}

/**
 * The risk rating the server will derive from these answers.
 *
 * A preview only — the server owns the real value and echoes it back on every save. It exists
 * so the broker sees the consequence of the on-sold answer as they make it, rather than
 * discovering it on the deal page afterwards.
 */
export function previewRiskRating(form) {
  if (form.onSoldQuickly == null) return null;
  return form.onSoldQuickly ? 'HIGH' : 'LOW';
}
