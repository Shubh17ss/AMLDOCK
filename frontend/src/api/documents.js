import axios from 'axios';
import { apiClient } from './client.js';

// Keep in sync with the DocumentType enum in the backend
// (backend/src/main/java/nz/amldock/document/DocumentType.java) and with the
// chk_document_type constraint, which V28 last rebuilt.
export const DOCUMENT_TYPES = [
  { value: 'DRIVER_LICENCE', label: 'Driver licence' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'TRUST_DEED', label: 'Trust deed' },
  { value: 'COMPANY_CERT', label: 'Company certificate' },
  { value: 'TITLE_DOC', label: 'Title document' },
  { value: 'SALE_AGREEMENT', label: 'Sale agreement' },
  { value: 'VOICE_NOTE', label: 'Voice note' },
  { value: 'VOICE_NOTE_PURPOSE', label: 'Voice note — transaction purpose' },
  { value: 'VALUATION_MIN_EVIDENCE', label: 'Valuation evidence — minimum' },
  { value: 'VALUATION_MAX_EVIDENCE', label: 'Valuation evidence — maximum' },
  { value: 'OTHER', label: 'Other' },
];

/** Identity documents scanned in the deal form. These are the OCR-eligible types. */
export const ID_DOCUMENT_TYPES = DOCUMENT_TYPES.filter(
  (t) => t.value === 'DRIVER_LICENCE' || t.value === 'PASSPORT',
);

/** Both audio types, for read surfaces that route to the player rather than a preview. */
export const AUDIO_DOCUMENT_TYPES = ['VOICE_NOTE', 'VOICE_NOTE_PURPOSE'];

/** Display label for a stored document-type code; falls back to the raw value. */
export const documentTypeLabel = (value) =>
  DOCUMENT_TYPES.find((t) => t.value === value)?.label ?? value ?? '—';

export async function requestUploadUrl({ filename, contentType, sizeBytes, documentType, dealId, ownershipNodeId }) {
  const { data } = await apiClient.post('/documents/upload-url', {
    filename, contentType, sizeBytes, documentType, dealId, ownershipNodeId,
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
export async function uploadToS3({ file, documentType, dealId, ownershipNodeId, onProgress }) {
  onProgress?.({ phase: 'presign', percent: 0 });
  const presigned = await requestUploadUrl({
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    documentType,
    dealId,
    ownershipNodeId,
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
