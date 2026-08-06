import axios from 'axios';
import { apiClient } from './client.js';

// Monitoring > International Fund Transaction Register. Entries are scoped to the firm and
// branch selected in the sidebar. The supporting PDF is optional and follows the same
// presigned S3 flow as compliance documents, attached after the entry exists.

export async function listFundTransactions({ firmId, branchId } = {}) {
  const { data } = await apiClient.get('/international-fund-transactions', {
    params: { firmId: firmId ?? undefined, branchId: branchId ?? undefined },
  });
  return data;
}

export async function createFundTransaction({
  dealReference, listingAddress, transactionFlow, transactionDate, amount,
  overseasJurisdiction, submissionReference, realEstateFirmId, firmBranchId,
}) {
  const { data } = await apiClient.post('/international-fund-transactions', {
    dealReference: dealReference || null,
    listingAddress,
    transactionFlow,
    transactionDate,
    amount,
    overseasJurisdiction,
    submissionReference: submissionReference || null,
    realEstateFirmId: realEstateFirmId ?? null,
    firmBranchId: firmBranchId ?? null,
  });
  return data;
}

export async function requestFundTransactionUploadUrl(id, { filename, contentType, sizeBytes }) {
  const { data } = await apiClient.post(`/international-fund-transactions/${id}/upload-url`, {
    filename, contentType, sizeBytes,
  });
  return data;
}

export async function confirmFundTransactionUpload(id) {
  const { data } = await apiClient.post(`/international-fund-transactions/${id}/confirm`);
  return data;
}

export async function fetchFundTransactionDownloadUrl(id) {
  const { data } = await apiClient.get(`/international-fund-transactions/${id}/download-url`);
  return data;
}

export async function deleteFundTransaction(id) {
  await apiClient.delete(`/international-fund-transactions/${id}`);
}

/**
 * Create one register entry, then attach its PDF if one was picked: create → presign →
 * PUT bytes to S3 → confirm. The entry is saved regardless, so a failed or skipped upload
 * never loses the record.
 * Calls onProgress({ phase, percent }) when supplied.
 */
export async function createFundTransactionWithDocument({ file, onProgress, ...fields }) {
  onProgress?.({ phase: 'saving', percent: 0 });
  const created = await createFundTransaction(fields);
  if (!file) {
    onProgress?.({ phase: 'done', percent: 100 });
    return created;
  }

  onProgress?.({ phase: 'presign', percent: 0 });
  const presigned = await requestFundTransactionUploadUrl(created.id, {
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
  const confirmed = await confirmFundTransactionUpload(created.id);
  onProgress?.({ phase: 'done', percent: 100 });
  return confirmed;
}
