import axios from 'axios';
import { apiClient } from './client.js';

// Keep in sync with the DocumentType enum in the backend
// (backend/src/main/java/nz/amldock/document/DocumentType.java) and with the
// chk_document_type constraint, which V33 last rebuilt.
//
// `identity: true` marks the documents that identify a person. Uploading one creates an
// individual on the deal and queues it for extraction; everything else is filed as supporting
// evidence against people who are already there. The backend decides this for real — see
// DocumentType.isOcrEligible — and this flag exists so the form can offer the right list.
export const DOCUMENT_TYPES = [
  // Travel documents
  { value: 'NZ_PASSPORT',                   label: 'New Zealand passport',            identity: true },
  { value: 'AU_PASSPORT',                   label: 'Australian passport',             identity: true },
  { value: 'OVERSEAS_PASSPORT',             label: 'Overseas passport',               identity: true },
  { value: 'REFUGEE_TRAVEL_DOCUMENT',       label: 'Refugee travel document',         identity: true },

  // Card-shaped IDs
  { value: 'NZ_DRIVER_LICENCE',             label: 'New Zealand driver licence',      identity: true },
  { value: 'AU_DRIVER_LICENCE',             label: 'Australian driver licence',       identity: true },
  { value: 'INTERNATIONAL_DRIVING_PERMIT',  label: 'International driving permit',    identity: true },
  { value: 'NATIONAL_IDENTITY_CARD',        label: 'National identity card',          identity: true },
  { value: 'FOREIGN_IDENTITY_CARD',         label: 'Foreign identity card',           identity: true },
  { value: 'KIWI_ACCESS_CARD',              label: '18+ / Kiwi Access card',          identity: true },

  // Supporting evidence
  { value: 'PROOF_OF_ADDRESS',              label: 'Proof of address' },
  { value: 'BANK_CARD',                     label: 'Bank card' },
  { value: 'BANK_STATEMENT',                label: 'Bank statement' },
  { value: 'CERTIFICATE_OF_CITIZENSHIP',    label: 'Certificate of citizenship' },
  { value: 'FOREIGN_CITIZENSHIP_CERTIFICATE', label: 'Foreign citizenship certificate' },
  { value: 'BIRTH_CERTIFICATE',             label: 'Birth certificate' },
  { value: 'MARRIAGE_CERTIFICATE',          label: 'Marriage certificate' },
  { value: 'DEATH_CERTIFICATE',             label: 'Death certificate' },
  { value: 'GOVERNMENT_CARD',               label: 'Government card' },
  { value: 'GOVERNMENT_STATEMENT',          label: 'Government statement' },
  { value: 'SOURCE_OF_FUNDS_WEALTH',        label: 'Source of funds / wealth' },
  { value: 'TAX_RETURN',                    label: 'Tax return' },
  { value: 'WAGE_SLIP',                     label: 'Wage slip' },
  { value: 'ELECTRONIC_ID_VERIFICATION_RESULT', label: 'Electronic ID verification result' },
  { value: 'BIOMETRIC_VERIFICATION_RESULT', label: 'Biometric verification result' },
  { value: 'ENDURING_POWER_OF_ATTORNEY',    label: 'Enduring power of attorney' },
  { value: 'CERTIFICATE_OF_NON_REVOCATION', label: 'Certificate of non-revocation' },
  { value: 'WEB_SEARCH_RESULT',             label: 'Web search result' },
  { value: 'LETTER_FROM_TRUSTED_REFEREE',   label: 'Letter from trusted referee' },

  // Property and entity documents, from before the CDD catalogue
  { value: 'TRUST_DEED',                    label: 'Trust deed' },
  { value: 'COMPANY_CERT',                  label: 'Company certificate' },
  { value: 'TITLE_DOC',                     label: 'Title document' },
  { value: 'SALE_AGREEMENT',                label: 'Sale agreement' },

  // Produced by the app rather than chosen by a broker
  { value: 'VOICE_NOTE',                    label: 'Voice note' },
  { value: 'VOICE_NOTE_PURPOSE',            label: 'Voice note — transaction purpose' },
  { value: 'VALUATION_MIN_EVIDENCE',        label: 'Valuation evidence — minimum' },
  { value: 'VALUATION_MAX_EVIDENCE',        label: 'Valuation evidence — maximum' },

  { value: 'OTHER',                         label: 'Other' },
];

/**
 * Superseded by the country-specific types and deliberately absent from DOCUMENT_TYPES, so no
 * new ones can be created. Still labelled, because rows written before V33 carry these values
 * and have to render somewhere.
 */
const LEGACY_LABELS = {
  DRIVER_LICENCE: 'Driver licence (unspecified)',
  PASSPORT: 'Passport (unspecified)',
};

/** Identity documents scanned in the deal form. One of these creates an individual. */
export const ID_DOCUMENT_TYPES = DOCUMENT_TYPES.filter((t) => t.identity);

/**
 * Identity types that have a second side worth capturing. Passports carry everything on the
 * photo page, so asking for a back would be asking for a blank sheet.
 */
export const TYPES_WITH_BACK = new Set([
  'NZ_DRIVER_LICENCE', 'AU_DRIVER_LICENCE', 'INTERNATIONAL_DRIVING_PERMIT',
  'NATIONAL_IDENTITY_CARD', 'FOREIGN_IDENTITY_CARD', 'KIWI_ACCESS_CARD',
]);

/** Both audio types, for read surfaces that route to the player rather than a preview. */
export const AUDIO_DOCUMENT_TYPES = ['VOICE_NOTE', 'VOICE_NOTE_PURPOSE'];

/** Display label for a stored document-type code; falls back to the raw value. */
export const documentTypeLabel = (value) =>
  DOCUMENT_TYPES.find((t) => t.value === value)?.label ?? LEGACY_LABELS[value] ?? value ?? '—';

export async function requestUploadUrl({
  filename, contentType, sizeBytes, documentType, dealId, ownershipNodeId,
  beneficialOwnerId, idSide,
}) {
  const { data } = await apiClient.post('/documents/upload-url', {
    filename, contentType, sizeBytes, documentType, dealId, ownershipNodeId,
    beneficialOwnerId, idSide,
  });
  return data;
}

export async function confirmUpload(documentId) {
  const { data } = await apiClient.post('/documents/confirm', { documentId });
  return data;
}

export async function listDealDocuments(dealId) {
  const { data } = await apiClient.get('/documents', { params: { dealId } });
  return data;
}

export async function listNodeDocuments(nodeId) {
  const { data } = await apiClient.get('/documents', { params: { nodeId } });
  return data;
}

export async function fetchDocument(id) {
  const { data } = await apiClient.get(`/documents/${id}`);
  return data;
}

export async function fetchDownloadUrl(id) {
  const { data } = await apiClient.get(`/documents/${id}/download-url`);
  return data;
}

export async function deleteDocument(id) {
  await apiClient.delete(`/documents/${id}`);
}

/**
 * Upload a single File to S3 using the presigned PUT flow:
 *   1) request presigned URL    (backend → S3)
 *   2) PUT bytes directly       (browser → S3)
 *   3) confirm                  (backend HEADs S3, marks ACTIVE)
 * Calls onProgress({ phase, percent }) when supplied.
 */
/**
 * `beneficialOwnerId` decides whether an identity scan starts a new individual or joins one:
 * pass null for a front, and the existing owner's id to attach that card's back to the same
 * person. `idSide` is 'FRONT' or 'BACK'; the server defaults a missing side to FRONT.
 */
export async function uploadToS3({
  file, documentType, dealId, ownershipNodeId, beneficialOwnerId, idSide, onProgress,
}) {
  onProgress?.({ phase: 'presign', percent: 0 });
  const presigned = await requestUploadUrl({
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    documentType,
    dealId,
    ownershipNodeId,
    beneficialOwnerId,
    idSide,
  });

  // Use a bare axios instance for S3 — our apiClient appends cookies / refresh interceptors
  // that would interfere with the signed PUT.
  await axios.put(presigned.uploadUrl, file, {
    headers: { 'Content-Type': presigned.requiredContentType },
    onUploadProgress: (evt) => {
      if (!evt.total) return;
      onProgress?.({ phase: 'upload', percent: Math.round((evt.loaded / evt.total) * 100) });
    },
  });

  onProgress?.({ phase: 'confirm', percent: 100 });
  const doc = await confirmUpload(presigned.documentId);
  onProgress?.({ phase: 'done', percent: 100 });
  return doc;
}
