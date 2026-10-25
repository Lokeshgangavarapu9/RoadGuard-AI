// Configurable backend URL: uses VITE_API_BASE_URL in production (e.g. on Vercel),
// or empty string in local development (falling back to Vite proxy at /api/v1).
export const BACKEND_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api/v1` : '/api/v1';

/**
 * Resolves an asset path (e.g. /uploads/... evidence images) to a full URL in production.
 */
export function getAssetUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return BACKEND_URL ? `${BACKEND_URL}${cleanPath}` : cleanPath;
}

export async function getHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function getStats() {
  const res = await fetch(`${API_BASE}/stats`);
  return res.json();
}

export async function createJourney(data) {
  const res = await fetch(`${API_BASE}/journeys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function stopJourney(id, data = {}) {
  const res = await fetch(`${API_BASE}/journeys/${id}/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listJourneys() {
  const res = await fetch(`${API_BASE}/journeys`);
  return res.json();
}

export async function getJourney(id) {
  const res = await fetch(`${API_BASE}/journeys/${id}`);
  return res.json();
}

export async function sendGpsBatch(journeyId, points) {
  const res = await fetch(`${API_BASE}/journeys/${journeyId}/gps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points }),
  });
  return res.json();
}

export async function getJourneyGps(journeyId) {
  const res = await fetch(`${API_BASE}/journeys/${journeyId}/gps`);
  return res.json();
}

export async function uploadEvidenceFrame(journeyId, file, { latitude, longitude, capturedAt, frameSequence }) {
  const formData = new FormData();
  formData.append('file', file);
  if (latitude != null) formData.append('latitude', latitude);
  if (longitude != null) formData.append('longitude', longitude);
  if (capturedAt) formData.append('capturedAt', capturedAt);
  if (frameSequence != null) formData.append('frameSequence', frameSequence);

  const res = await fetch(`${API_BASE}/journeys/${journeyId}/frames`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  const frame = await res.json();
  if (frame && frame.storageUrl) {
    frame.storageUrl = getAssetUrl(frame.storageUrl);
  }
  return frame;
}

export async function getJourneyFrames(journeyId) {
  const res = await fetch(`${API_BASE}/journeys/${journeyId}/frames`);
  const data = await res.json();
  if (Array.isArray(data)) {
    return data.map((f) => ({
      ...f,
      storageUrl: getAssetUrl(f.storageUrl),
    }));
  }
  return data;
}

export async function listIssues(journeyId = null) {
  const url = journeyId ? `${API_BASE}/issues?journeyId=${journeyId}` : `${API_BASE}/issues`;
  const res = await fetch(url);
  return res.json();
}

export async function getIssue(id) {
  const res = await fetch(`${API_BASE}/issues/${id}`);
  return res.json();
}

export async function investigateIssue(id) {
  const res = await fetch(`${API_BASE}/issues/${id}/investigate`, { method: 'POST' });
  return res.json();
}

export async function autoDraftComplaint(issueId, { name, email, phone }) {
  const params = new URLSearchParams({ issueId });
  if (name) params.append('complainantName', name);
  if (email) params.append('complainantEmail', email);
  if (phone) params.append('complainantPhone', phone);

  const res = await fetch(`${API_BASE}/complaints/auto-draft?${params.toString()}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function simulateSubmission(complaintId) {
  const res = await fetch(`${API_BASE}/complaints/${complaintId}/simulate`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listAuthorities() {
  const res = await fetch(`${API_BASE}/authorities`);
  return res.json();
}

export async function getUserProfile() {
  const res = await fetch(`${API_BASE}/profile`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateUserProfile(data) {
  const res = await fetch(`${API_BASE}/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getConnectedPortals() {
  const res = await fetch(`${API_BASE}/profile/connected-services`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function refreshPortalStatus(portalId) {
  const res = await fetch(`${API_BASE}/profile/connected-services/${portalId}/test-connection`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
