import axios from 'axios';
import { apiClient } from './client.js';

// Monitoring > Suspicious Activity Register. Entries are scoped to the firm and branch
// selected in the sidebar. The supporting PDF is optional and follows the same presigned S3
// flow as compliance documents, attached after the entry exists.

export async function listSuspiciousActivities({ firmId, branchId } = {}) {
  const { data } = await apiClient.get('/suspicious-activities', {
    params: { firmId: firmId ?? undefined, branchId: branchId ?? undefined },
  });
  return data;
}

export async function createSuspiciousActivity({
  suspicionType, amountNzd, name, dateOfSuspicion, redFlag, reference, description,
  actionTaken, realEstateFirmId, firmBranchId,
}) {
  const { data } = await apiClient.post('/suspicious-activities', {
    suspicionType,
    // An amount only belongs to a transaction — the server rejects one without it and
    // discards one sent for an activity.
    amountNzd: suspicionType === 'TRANSACTION' ? amountNzd : null,
    name,
    dateOfSuspicion,
    redFlag,
    reference: reference || null,
    description,
    actionTaken: actionTaken || null,
    realEstateFirmId: realEstateFirmId ?? null,
    firmBranchId: firmBranchId ?? null,
  });
  return data;
}

export async function requestSuspiciousActivityUploadUrl(id, { filename, contentType, sizeBytes }) {
  const { data } = await apiClient.post(`/suspicious-activities/${id}/upload-url`, {
    filename, contentType, sizeBytes,
  });
  return data;
}

export async function confirmSuspiciousActivityUpload(id) {
  const { data } = await apiClient.post(`/suspicious-activities/${id}/confirm`);
  return data;
}

export async function fetchSuspiciousActivityDownloadUrl(id) {
  const { data } = await apiClient.get(`/suspicious-activities/${id}/download-url`);
  return data;
}

export async function deleteSuspiciousActivity(id) {
  await apiClient.delete(`/suspicious-activities/${id}`);
}

/**
 * Create one register entry, then attach its PDF if one was picked: create → presign →
 * PUT bytes to S3 → confirm. The entry is saved regardless, so a failed or skipped upload
 * never loses the record.
 * Calls onProgress({ phase, percent }) when supplied.
 */
export async function createSuspiciousActivityWithDocument({ file, onProgress, ...fields }) {
  onProgress?.({ phase: 'saving', percent: 0 });
  const created = await createSuspiciousActivity(fields);
  if (!file) {
    onProgress?.({ phase: 'done', percent: 100 });
    return created;
  }

  onProgress?.({ phase: 'presign', percent: 0 });
  const presigned = await requestSuspiciousActivityUploadUrl(created.id, {
    filename: file.name,
    contentType: file.type || 'application/pdf',
    sizeBytes: file.size,
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
  const confirmed = await confirmSuspiciousActivityUpload(created.id);
  onProgress?.({ phase: 'done', percent: 100 });
  return confirmed;
}
