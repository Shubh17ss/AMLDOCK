import { apiClient } from './client.js';

// Per-register review schedule (next review date + last completion), scoped to the
// firm/branch selected in the sidebar. Drives the review-status indicator on the cards.

export async function listDocumentReviews({ firmId, branchId } = {}) {
  const { data } = await apiClient.get('/document-reviews', {
    params: { firmId: firmId ?? undefined, branchId: branchId ?? undefined },
  });
  return data;
}

export async function setDocumentReviewDate({ category, nextReviewDate, firmId, branchId }) {
  const { data } = await apiClient.put('/document-reviews', {
    category,
    nextReviewDate: nextReviewDate || null,
    realEstateFirmId: firmId ?? null,
    firmBranchId: branchId ?? null,
  });
  return data;
}

export async function completeDocumentReview({ category, firmId, branchId }) {
  const { data } = await apiClient.post('/document-reviews/complete', {
    category,
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
