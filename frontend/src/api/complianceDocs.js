import axios from 'axios';
import { apiClient } from './client.js';

// Firm-level compliance documents (Risk Assessment / Compliance Programme / Annual
// Report). Versioned per firm + category; same presigned S3 flow as deal documents.

export async function listComplianceDocs(category, { firmId, branchId } = {}) {
  const { data } = await apiClient.get('/compliance-documents', {
    params: { category, firmId: firmId ?? undefined, branchId: branchId ?? undefined },
  });
  return data;
}

export async function requestComplianceUploadUrl({
  category, name, changeNotes, filename, contentType, sizeBytes, realEstateFirmId, firmBranchId,
}) {
  const { data } = await apiClient.post('/compliance-documents/upload-url', {
    category, name, changeNotes, filename, contentType, sizeBytes,
    realEstateFirmId: realEstateFirmId ?? null,
    firmBranchId: firmBranchId ?? null,
  });
  return data;
}

export async function confirmComplianceUpload(documentId) {
  const { data } = await apiClient.post('/compliance-documents/confirm', { documentId });
  return data;
}

export async function fetchComplianceDownloadUrl(id) {
  const { data } = await apiClient.get(`/compliance-documents/${id}/download-url`);
  return data;
}

export async function deleteComplianceDoc(id) {
  await apiClient.delete(`/compliance-documents/${id}`);
}

/**
 * Upload one revision: presign → PUT bytes directly to S3 → confirm.
 * Calls onProgress({ phase, percent }) when supplied.
 */
export async function uploadComplianceDoc({
  category, name, changeNotes, file, realEstateFirmId, firmBranchId, onProgress,
}) {
  onProgress?.({ phase: 'presign', percent: 0 });
  const presigned = await requestComplianceUploadUrl({
    category,
    name,
    changeNotes,
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    realEstateFirmId,
    firmBranchId,
  });

  // Bare axios for S3 — apiClient's cookie/refresh interceptors would break the signed PUT.
  await axios.put(presigned.uploadUrl, file, {
    headers: { 'Content-Type': presigned.requiredContentType },
    onUploadProgress: (evt) => {
      if (!evt.total) return;
      onProgress?.({ phase: 'upload', percent: Math.round((evt.loaded / evt.total) * 100) });
    },
  });

  onProgress?.({ phase: 'confirm', percent: 100 });
  const doc = await confirmComplianceUpload(presigned.documentId);
  onProgress?.({ phase: 'done', percent: 100 });
  return doc;
}
