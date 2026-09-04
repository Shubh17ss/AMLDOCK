import { apiClient } from './client.js';

// Past versions of a deal — what it looked like each time compliance signed it off.
//
// Verifying a deal copies it server-side, so these read from a snapshot rather than from the deal.
// The payloads are deliberately the same ones the live screen already draws (DealDto, TreeDto, the
// document list, the people), which is what lets DealReviewScreen render a version with the
// components and the read-only mode it already has.

/** Newest first. Empty for a deal that has never been verified. */
export async function listDealVersions(dealId) {
  const { data } = await apiClient.get(`/deals/${dealId}/versions`);
  return data;
}

/** One version, as the whole deal it was: { summary, deal, ownership, documents, beneficialOwners, notes }. */
export async function getDealVersion(dealId, versionNo) {
  const { data } = await apiClient.get(`/deals/${dealId}/versions/${versionNo}`);
  return data;
}

/**
 * A download URL for one of a version's documents.
 *
 * Separate from the live `/documents/{id}/download`, which serves only ACTIVE rows. A document
 * deleted from the deal after this version was signed off is not active any more and still has to
 * be readable here — the server keeps its bytes for exactly this reason.
 */
export async function presignVersionDocumentDownload(dealId, versionNo, documentId) {
  const { data } = await apiClient.get(
    `/deals/${dealId}/versions/${versionNo}/documents/${documentId}/download`);
  return data;
}
