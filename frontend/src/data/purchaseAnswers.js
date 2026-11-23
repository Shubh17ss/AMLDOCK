// The answers a purchase asks in place of the vendor's tenure and reason for selling.
//
// Codes mirror the backend enums SourceOfFunds and ReasonForPurchase (nz.amldock.deal), which
// also hold the risk points. Labels live on both sides because the risk factor carries the
// server's label and the dropdown carries this one; keep them the same. Codes are never renamed,
// only added. Order is the order shown in each dropdown.

export const SOURCES_OF_FUNDS = [
  { value: 'MORTGAGE', label: 'Bank mortgage / finance' },
  { value: 'SAVINGS', label: 'Savings / salary' },
  { value: 'PROPERTY_SALE', label: 'Sale of another property' },
  { value: 'INHERITANCE', label: 'Inheritance' },
  { value: 'BUSINESS_INCOME', label: 'Business income' },
  { value: 'GIFT', label: 'Gift from family or a third party' },
  { value: 'OVERSEAS', label: 'Overseas funds' },
  { value: 'CASH', label: 'Cash' },
  { value: 'OTHER', label: 'Other' },
  { value: 'TBC', label: 'To be confirmed' },
];

// A placeholder list, with placeholder points on the server, until the firm settles its own.
export const REASONS_FOR_PURCHASE = [
  { value: 'OWNER_OCCUPIER', label: 'Owner-occupier / family home' },
  { value: 'FIRST_HOME', label: 'First home' },
  { value: 'INVESTMENT', label: 'Investment / rental' },
  { value: 'BUSINESS_PREMISES', label: 'Business premises' },
  { value: 'DEVELOPMENT', label: 'Development / subdivision' },
  { value: 'LAND_BANKING', label: 'Land banking' },
  { value: 'ON_BEHALF_OF_ANOTHER', label: 'Buying on behalf of another party' },
  { value: 'OTHER', label: 'Other' },
];

const labelIn = (list) => (value) => list.find((o) => o.value === value)?.label ?? value;

export const sourceOfFundsLabel = labelIn(SOURCES_OF_FUNDS);
export const reasonForPurchaseLabel = labelIn(REASONS_FOR_PURCHASE);
