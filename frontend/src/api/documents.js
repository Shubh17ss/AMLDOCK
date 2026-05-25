import axios from 'axios';
import { apiClient } from './client.js';

export const DOCUMENT_TYPES = [
  { value: 'DRIVER_LICENCE', label: 'Driver licence' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'TRUST_DEED', label: 'Trust deed' },
  { value: 'COMPANY_CERT', label: 'Company certificate' },
  { value: 'TITLE_DOC', label: 'Title document' },
  { value: 'SALE_AGREEMENT', label: 'Sale agreement' },
  { value: 'OTHER', label: 'Other' },
];

export async function requestUploadUrl({ filename, contentType, sizeBytes, documentType, dealId }) {
  const { data } = await apiClient.post('/documents/upload-url', {
    filename, contentType, sizeBytes, documentType, dealId,
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
export async function uploadToS3({ file, documentType, dealId, onProgress }) {
  onProgress?.({ phase: 'presign', percent: 0 });
  const presigned = await requestUploadUrl({
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    documentType,
    dealId,
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
