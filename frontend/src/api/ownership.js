import { apiClient } from './client.js';
import { ID_DOCUMENT_TYPES as CATALOGUE_ID_TYPES } from './documents.js';

/**
 * The kinds of owner a structure is built from. Any may sit above or below any other, except
 * INDIVIDUAL, which is always a leaf — see `isLeafOnly` on the server's NodeType.
 *
 * Keep in sync with `nz.amldock.ownership.NodeType` and `chk_ownership_node_type` (V34).
 */
export const NODE_TYPES = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'PRIVATE_COMPANY', label: 'Private company' },
  { value: 'LISTED_COMPANY', label: 'Listed company' },
  { value: 'TRUSTEE_COMPANY', label: 'Trustee company' },
  { value: 'TRUST', label: 'Trust' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
  { value: 'LIMITED_PARTNERSHIP', label: 'Limited partnership' },
  { value: 'INCORPORATED_SOCIETY', label: 'Incorporated society' },
  { value: 'CHARITY', label: 'Charity' },
  { value: 'GOVERNMENT_AGENCY', label: 'Government agency' },
  { value: 'DECEASED_ESTATE', label: 'Deceased estate' },
  { value: 'OTHER', label: 'Other entity' },
];

/** Superseded by PRIVATE_COMPANY in V34, kept so any stored value still renders a name. */
const LEGACY_NODE_LABELS = { NZ_COMPANY: 'Private company' };

export const nodeTypeLabel = (value) =>
  NODE_TYPES.find((t) => t.value === value)?.label
  ?? LEGACY_NODE_LABELS[value]
  ?? value
  ?? '—';

/**
 * What a node's display name is called, per type. It is the same column either way — only the
 * question changes, and asking a trust for a "display name" is asking nobody's question.
 */
const NAME_LABEL = {
  INDIVIDUAL: 'Name',
  PRIVATE_COMPANY: 'Company name',
  LISTED_COMPANY: 'Company name',
  TRUSTEE_COMPANY: 'Company name',
  TRUST: 'Trust name',
  PARTNERSHIP: 'Partnership name',
  LIMITED_PARTNERSHIP: 'Partnership name',
  INCORPORATED_SOCIETY: 'Society name',
  CHARITY: 'Charity name',
  GOVERNMENT_AGENCY: 'Agency name',
  DECEASED_ESTATE: 'Estate name',
};

export const nameLabelFor = (nodeType) => NAME_LABEL[nodeType] ?? 'Display name';

/** An individual never owns anything, so the tree offers no way to give one children. */
export const isLeafOnlyType = (value) => value === 'INDIVIDUAL';

/**
 * The capacity an individual appears in on one deal. An edge between two nodes carries the
 * ownership percentage; this is the answer to what the person is, and the only role the UI sets.
 *
 * Keep in sync with `nz.amldock.ownership.PersonRole` and `chk_ownership_node_person_role`.
 */
export const PERSON_ROLES = [
  { value: 'OWNER_25_PLUS', label: '25%+ ownership' },
  { value: 'TRUSTEE', label: 'Trustee' },
  { value: 'SETTLOR', label: 'Settlor' },
  { value: 'EFFECTIVE_CONTROLLER', label: 'Effective controller (director)' },
  { value: 'ACTING_ON_BEHALF_OF_CLIENT', label: 'Acting on behalf of client' },
  { value: 'APPOINTER', label: 'Appointer' },
  { value: 'EXECUTOR', label: 'Executor' },
  { value: 'PARTNER', label: 'Partner' },
  { value: 'PROTECTOR', label: 'Protector' },
  { value: 'GUARANTOR', label: 'Guarantor' },
];

export const personRoleLabel = (value) =>
  PERSON_ROLES.find((r) => r.value === value)?.label ?? value ?? '—';

/**
 * What a node of each type will accept on its Documents tab.
 *
 * A type absent from this map has no restriction. Mirrors `NodeType.acceptedDocumentTypes()`,
 * which is where it is enforced — this only narrows the picker.
 */
export const ACCEPTED_DOCUMENT_TYPES = {
  TRUSTEE_COMPANY: ['COMPANY_CERT', 'COMPANY_EXTRACT', 'OTHER'],
  LIMITED_PARTNERSHIP: [
    'COMPANY_CERT', 'LIMITED_PARTNERSHIP_EXTRACT', 'PARTNERSHIP_STRUCTURE',
    'PARTNERSHIP_AGREEMENT', 'BANK_STATEMENT', 'SOURCE_OF_FUNDS_WEALTH',
    'FINANCIAL_STATEMENTS', 'REGISTRY_SEARCH_RESULT', 'WEB_SEARCH_RESULT', 'TAX_RETURN',
    'PROOF_OF_ADDRESS', 'OTHER',
  ],
  PARTNERSHIP: [
    'COMPANY_CERT', 'PARTNERSHIP_STRUCTURE', 'PARTNERSHIP_AGREEMENT', 'BANK_STATEMENT',
    'SOURCE_OF_FUNDS_WEALTH', 'FINANCIAL_STATEMENTS', 'REGISTRY_SEARCH_RESULT',
    'WEB_SEARCH_RESULT', 'TAX_RETURN', 'PROOF_OF_ADDRESS', 'OTHER',
  ],
  LISTED_COMPANY: [
    'COMPANY_CERT', 'EXCHANGE_REGISTRATION_SEARCH_RESULT', 'GOVERNMENT_STATEMENT', 'OTHER',
  ],
  INCORPORATED_SOCIETY: [
    'SOCIETY_RULES', 'BANK_STATEMENT', 'SOURCE_OF_FUNDS_WEALTH', 'FINANCIAL_STATEMENTS',
    'REGISTRY_SEARCH_RESULT', 'OTHER',
  ],
  CHARITY: [
    'CHARITIES_REGISTER_INFORMATION', 'BANK_STATEMENT', 'SOURCE_OF_FUNDS_WEALTH',
    'FINANCIAL_STATEMENTS', 'OTHER',
  ],
  GOVERNMENT_AGENCY: ['REGISTRY_SEARCH_RESULT', 'OTHER'],
  DECEASED_ESTATE: ['PROBATE_OR_WILL', 'OTHER'],
  TRUST: [
    'TRUST_DEED', 'AMENDMENTS_OR_VARIATIONS', 'TRUSTEES_RESOLUTION', 'BANK_STATEMENT',
    'SOURCE_OF_FUNDS_WEALTH', 'FINANCIAL_STATEMENTS', 'REGISTRY_SEARCH_RESULT',
    'WEB_SEARCH_RESULT', 'OTHER',
  ],
  PRIVATE_COMPANY: [
    'COMPANY_CERT', 'COMPANY_EXTRACT', 'OWNERSHIP_STRUCTURE', 'COMPANY_CONSTITUTION',
    'BANK_STATEMENT', 'SOURCE_OF_FUNDS_WEALTH', 'FINANCIAL_STATEMENTS', 'REGISTRY_SEARCH_RESULT',
    'WEB_SEARCH_RESULT', 'TAX_RETURN', 'PROOF_OF_ADDRESS', 'OTHER',
  ],
};

/**
 * What a trust was set up to do. Risk-relevant in its own right, but nothing here changes
 * the deal's rating — only TRUST_HOLDING_COMPLEXITY does that.
 */
export const TRUST_TYPES = [
  { value: 'FAMILY', label: 'Family trust' },
  { value: 'CHARITABLE', label: 'Charitable trust' },
  { value: 'INVESTMENT', label: 'Investment trust' },
  { value: 'TESTAMENTARY', label: 'Testamentary trust' },
  { value: 'ASSET_PROTECTION', label: 'Asset protection trust' },
  { value: 'SUPERANNUATION', label: 'Superannuation trust' },
  { value: 'INHERITANCE_DEFINED_INTEREST', label: 'Inheritance / defined interest trust' },
];

export const trustTypeLabel = (value) =>
  TRUST_TYPES.find((t) => t.value === value)?.label ?? value ?? '';

/** How much the trust holds. The third band sets the deal to High. */
export const TRUST_HOLDING_COMPLEXITY = [
  { value: 'SINGLE_PROPERTY_ASSET', label: 'Single property asset' },
  { value: 'MORE_THAN_ONE_PROPERTY_ASSET', label: 'More than one property asset' },
  { value: 'EXTENSIVE_DIVERSE_PORTFOLIO', label: 'Extensive / diverse asset portfolio' },
];

/** The nominee question's three states — the only tri-state answer on the company form. */
export const NOMINEE_OPTIONS = [
  { value: 'NOT_ASKED', label: 'Not asked' },
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
];

// The same catalogue the deal form scans from — a node's ID type and a scanned document's type
// name the same thing, so they must not drift into two lists.
export const ID_DOCUMENT_TYPES = CATALOGUE_ID_TYPES;

export async function getTree(dealId) {
  const { data } = await apiClient.get(`/deals/${dealId}/ownership`);
  return data;
}

export async function createNode(dealId, payload) {
  const { data } = await apiClient.post(`/deals/${dealId}/ownership/nodes`, payload);
  return data;
}

export async function updateNode(dealId, nodeId, payload) {
  const { data } = await apiClient.patch(`/deals/${dealId}/ownership/nodes/${nodeId}`, payload);
  return data;
}

export async function deleteNode(dealId, nodeId, { force = false } = {}) {
  await apiClient.delete(`/deals/${dealId}/ownership/nodes/${nodeId}`, {
    params: force ? { force: true } : undefined,
  });
}

export async function createEdge(dealId, payload) {
  const { data } = await apiClient.post(`/deals/${dealId}/ownership/edges`, payload);
  return data;
}

export async function updateEdge(dealId, edgeId, payload) {
  const { data } = await apiClient.patch(`/deals/${dealId}/ownership/edges/${edgeId}`, payload);
  return data;
}

export async function deleteEdge(dealId, edgeId) {
  await apiClient.delete(`/deals/${dealId}/ownership/edges/${edgeId}`);
}

export async function setRoot(dealId, nodeId) {
  const { data } = await apiClient.post(`/deals/${dealId}/ownership/root`, { nodeId });
  return data;
}
