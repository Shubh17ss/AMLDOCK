import axios from 'axios';
import { apiClient } from './client.js';

// AML Training > Staff Training. Providers and sessions are scoped to the firm and branch
// selected in the sidebar; a session's roster may only contain branch-level staff of that
// branch, which the server enforces.

/* ---------- providers ---------- */

export async function listTrainingProviders({ firmId, branchId } = {}) {
  const { data } = await apiClient.get('/training-providers', {
    params: { firmId: firmId ?? undefined, branchId: branchId ?? undefined },
  });
  return data;
}

export async function createTrainingProvider({ name, email, realEstateFirmId, firmBranchId }) {
  const { data } = await apiClient.post('/training-providers', {
    name,
    email: email || null,
    realEstateFirmId: realEstateFirmId ?? null,
    firmBranchId: firmBranchId ?? null,
  });
  return data;
}

export async function deleteTrainingProvider(id) {
  await apiClient.delete(`/training-providers/${id}`);
}

/* ---------- sessions ---------- */

/** Role-aware server-side: managers get the whole scope, staff get their own assignments. */
export async function listTrainingSessions({ firmId, branchId } = {}) {
  const { data } = await apiClient.get('/training-sessions', {
    params: { firmId: firmId ?? undefined, branchId: branchId ?? undefined },
  });
  return data;
}

export async function createTrainingSession({
  name, location, url, trainingProviderId, dueDate, totalMinutes, certifiedMinutes,
  assigneeUserIds, realEstateFirmId, firmBranchId,
}) {
  const { data } = await apiClient.post('/training-sessions', {
    name,
    location,
    url: url || null,
    trainingProviderId,
    dueDate: dueDate || null,
    totalMinutes: Number(totalMinutes),
    certifiedMinutes: Number(certifiedMinutes),
    assigneeUserIds: assigneeUserIds ?? [],
    realEstateFirmId: realEstateFirmId ?? null,
    firmBranchId: firmBranchId ?? null,
  });
  return data;
}

/** Partial edit — omitted fields are left alone. A supplied roster replaces the old one. */
export async function updateTrainingSession(id, {
  name, location, url, trainingProviderId, dueDate, totalMinutes, certifiedMinutes, assigneeUserIds,
}) {
  const { data } = await apiClient.patch(`/training-sessions/${id}`, {
    name,
    location,
    url: url ?? '',
    trainingProviderId,
    dueDate: dueDate || null,
    totalMinutes: totalMinutes == null ? null : Number(totalMinutes),
    certifiedMinutes: certifiedMinutes == null ? null : Number(certifiedMinutes),
    assigneeUserIds,
  });
  return data;
}

export async function deleteTrainingSession(id) {
  await apiClient.delete(`/training-sessions/${id}`);
}

/** The signed-in user marks their own attendance complete. */
export async function completeTrainingSession(id) {
  const { data } = await apiClient.post(`/training-sessions/${id}/complete`);
  return data;
}

/* ---------- courses ---------- */

/** Role-aware server-side, same as sessions. */
export async function listTrainingCourses({ firmId, branchId } = {}) {
  const { data } = await apiClient.get('/training-courses', {
    params: { firmId: firmId ?? undefined, branchId: branchId ?? undefined },
  });
  return data;
}

export async function createTrainingCourse({
  name, description, dueDate, passMarkPercent, questions, assigneeUserIds,
  realEstateFirmId, firmBranchId,
}) {
  const { data } = await apiClient.post('/training-courses', {
    name,
    description: description || null,
    dueDate: dueDate || null,
    passMarkPercent: Number(passMarkPercent),
    questions: questions ?? [],
    assigneeUserIds: assigneeUserIds ?? [],
    realEstateFirmId: realEstateFirmId ?? null,
    firmBranchId: firmBranchId ?? null,
  });
  return data;
}

/** Partial edit. A supplied `questions` or `assigneeUserIds` replaces that whole set. */
export async function updateTrainingCourse(id, {
  name, description, dueDate, passMarkPercent, questions, assigneeUserIds,
}) {
  const { data } = await apiClient.patch(`/training-courses/${id}`, {
    name,
    description: description ?? '',
    dueDate: dueDate || null,
    passMarkPercent: passMarkPercent == null ? null : Number(passMarkPercent),
    questions,
    assigneeUserIds,
  });
  return data;
}

export async function deleteTrainingCourse(id) {
  await apiClient.delete(`/training-courses/${id}`);
}

/**
 * Sit (or re-sit) a course assessment.
 *
 * Only the picked option ids go up — the answer key never comes down, so the server does the
 * marking and returns a score with no per-question detail. A material-only course is submitted
 * with an empty list; that is the "mark as done" path.
 */
export async function submitCourseAttempt(courseId, answers = []) {
  const { data } = await apiClient.post(`/training-courses/${courseId}/attempt`, { answers });
  return data;
}

/* ---------- course content files ---------- */

export async function requestCourseFileUploadUrl(courseId, { filename, contentType, sizeBytes }) {
  const { data } = await apiClient.post(`/training-courses/${courseId}/files/upload-url`, {
    filename, contentType, sizeBytes,
  });
  return data;
}

export async function confirmCourseFileUpload(courseId, fileId) {
  const { data } = await apiClient.post(`/training-courses/${courseId}/files/${fileId}/confirm`);
  return data;
}

export async function fetchCourseFileDownloadUrl(courseId, fileId) {
  const { data } = await apiClient.get(`/training-courses/${courseId}/files/${fileId}/download-url`);
  return data;
}

export async function deleteCourseFile(courseId, fileId) {
  await apiClient.delete(`/training-courses/${courseId}/files/${fileId}`);
}

/**
 * Attach one file to an existing course: presign → PUT the bytes to S3 → confirm.
 *
 * Course material is unrestricted by type, so the content type is whatever the browser reports,
 * falling back to the generic octet-stream when it can't tell.
 */
export async function uploadCourseFile(courseId, file, onProgress) {
  const presigned = await requestCourseFileUploadUrl(courseId, {
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
  });

  // Bare axios for S3 — apiClient's cookie/refresh interceptors would break the signed PUT.
  await axios.put(presigned.uploadUrl, file, {
    headers: { 'Content-Type': presigned.requiredContentType },
    onUploadProgress: (evt) => {
      if (!evt.total) return;
      onProgress?.(Math.round((evt.loaded / evt.total) * 100));
    },
  });

  return confirmCourseFileUpload(courseId, presigned.documentId);
}

/**
 * Create a course, then upload whatever material was staged in the dialog — the course row has
 * to exist before a file can hang off it, so the two can't be one request.
 *
 * The course is saved regardless, so a failed upload never loses the authoring work.
 * Calls onProgress({ phase, percent, index, total }) when supplied.
 */
export async function createTrainingCourseWithFiles({ files = [], onProgress, ...fields }) {
  onProgress?.({ phase: 'saving', percent: 0, index: 0, total: files.length });
  const created = await createTrainingCourse(fields);

  for (let i = 0; i < files.length; i++) {
    onProgress?.({ phase: 'upload', percent: 0, index: i + 1, total: files.length });
    // Sequential on purpose: parallel presigned PUTs of large media would fight for bandwidth
    // and make the per-file progress meaningless.
    await uploadCourseFile(created.id, files[i], (percent) => {
      onProgress?.({ phase: 'upload', percent, index: i + 1, total: files.length });
    });
  }

  onProgress?.({ phase: 'done', percent: 100, index: files.length, total: files.length });
  return created;
}
