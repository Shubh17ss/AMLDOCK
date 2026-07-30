import { apiClient } from './client.js';

// Per-module review schedule (next review date + last completion), scoped to the firm/branch
// selected in the sidebar. Drives the review-status indicator on every module card.
//
// `moduleKey` is the module id from navigation/moduleRegistry.jsx (e.g. 'peps').

export async function listDocumentReviews({ firmId, branchId } = {}) {
  const { data } = await apiClient.get('/document-reviews', {
    params: { firmId: firmId ?? undefined, branchId: branchId ?? undefined },
  });
  return data;
}

export async function setDocumentReviewDate({ moduleKey, nextReviewDate, firmId, branchId }) {
  const { data } = await apiClient.put('/document-reviews', {
    moduleKey,
    nextReviewDate: nextReviewDate || null,
    realEstateFirmId: firmId ?? null,
    firmBranchId: branchId ?? null,
  });
  return data;
}

export async function completeDocumentReview({ moduleKey, firmId, branchId }) {
  const { data } = await apiClient.post('/document-reviews/complete', {
    moduleKey,
    realEstateFirmId: firmId ?? null,
    firmBranchId: branchId ?? null,
  });
  return data;
}

// Derive the three-state review status the UI renders. Kept in one place so the section
// and the cards agree. Accepts the DTO's `status` if present, else computes from the date.
export function reviewStatusOf(review) {
  if (!review) return 'UNSET';
  if (review.status) return review.status;
  if (!review.nextReviewDate) return 'UNSET';
  const due = new Date(review.nextReviewDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today ? 'OVERDUE' : 'ON_TRACK';
}
