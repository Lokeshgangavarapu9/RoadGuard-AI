// Configurable backend URL:
// 1. Explicit VITE_API_BASE_URL (from build environment or .env.production)
// 2. Production fallback: when running on Vercel or any remote non-localhost domain,
//    default directly to the deployed Render backend so API requests never fail with 405s on static hosting.
// 3. Localhost fallback: empty string (routes through Vite dev server proxy at /api/v1).
const envBackendUrl = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '').trim().replace(/\/+$/, '');
const isBrowser = typeof window !== 'undefined';
const isLocalhost = isBrowser && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '0.0.0.0'
);

export const BACKEND_URL = envBackendUrl || (
  isBrowser && !isLocalhost
    ? 'https://roadguard-ai-tael.onrender.com'
    : ''
);
const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api/v1` : '/api/v1';

export const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Universal fetch wrapper with AbortController timeout protection (15s default)
 * and automatic X-Session-ID propagation for multi-user isolation.
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(options.headers || {});
  if (typeof window !== 'undefined') {
    let sessionId = null;
    try {
      sessionId = localStorage.getItem('roadguard_session_id');
      if (!sessionId) {
        sessionId = 'sess_' + Math.random().toString(36).substring(2, 12);
        localStorage.setItem('roadguard_session_id', sessionId);
      }
    } catch (_) {}
    if (sessionId && !headers.has('X-Session-ID')) {
      headers.set('X-Session-ID', sessionId);
    }
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });
    return res;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s (${url})`);
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

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

export async function getHealth(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const res = await fetchWithTimeout(`${API_BASE}/health`, {}, timeoutMs);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Invalid non-JSON response from backend (${res.status}): ${text.slice(0, 120)}`);
  }
  if (!res.ok) {
    throw new Error(`Health check failed with HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Polling helper that retries GET /api/v1/health every 4s (up to 60s total)
 * to gracefully handle Render free-tier container cold start wake-up.
 */
export async function wakeUpBackend(onProgress = null) {
  const maxAttempts = 15; // 15 attempts * 4s = 60s
  const intervalMs = 4000;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (onProgress) {
      onProgress({
        attempt,
        maxAttempts,
        elapsedSec: (attempt - 1) * 4,
        message: `Waking cloud backend (Render cold start) — attempt ${attempt} of ${maxAttempts}...`,
      });
    }

    try {
      const health = await getHealth(8000); // 8s timeout per probe
      if (health && health.status === 'UP') {
        return health;
      }
    } catch (err) {
      lastError = err;
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error(
    `Cloud backend failed to wake up after 60s: ${lastError?.message || 'Connection timed out'}`
  );
}

export async function getStats() {
  const res = await fetchWithTimeout(`${API_BASE}/stats`);
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok || !contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Stats fetch failed (${res.status}): ${text.slice(0, 120)}`);
  }
  return res.json();
}

export async function createJourney(data) {
  const res = await fetchWithTimeout(`${API_BASE}/journeys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Journey creation failed (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!contentType.includes('application/json')) {
    throw new Error('Journey creation returned non-JSON response from server');
  }
  return res.json();
}

export async function stopJourney(id, data = {}) {
  const res = await fetchWithTimeout(`${API_BASE}/journeys/${id}/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listJourneys() {
  const res = await fetchWithTimeout(`${API_BASE}/journeys`);
  return res.json();
}

export async function getJourney(id) {
  const res = await fetchWithTimeout(`${API_BASE}/journeys/${id}`);
  return res.json();
}

export async function sendGpsBatch(journeyId, points) {
  const res = await fetchWithTimeout(`${API_BASE}/journeys/${journeyId}/gps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points }),
  });
  return res.json();
}

export async function getJourneyGps(journeyId) {
  const res = await fetchWithTimeout(`${API_BASE}/journeys/${journeyId}/gps`);
  return res.json();
}

export async function uploadEvidenceFrame(
  journeyId,
  file,
  { latitude, longitude, capturedAt, frameSequence, gpsAccuracy, accuracy, heading, speed, clientSha256, sha256 } = {}
) {
  const formData = new FormData();
  formData.append('file', file);
  if (latitude != null) formData.append('latitude', latitude);
  if (longitude != null) formData.append('longitude', longitude);
  if (capturedAt) formData.append('capturedAt', capturedAt);
  if (frameSequence != null) formData.append('frameSequence', frameSequence);

  // Send both accuracy and gpsAccuracy to avoid Spring Boot parameter mismatch
  const effectiveAcc = accuracy != null ? accuracy : gpsAccuracy;
  if (effectiveAcc != null) {
    formData.append('gpsAccuracy', effectiveAcc);
    formData.append('accuracy', effectiveAcc);
  }

  if (heading != null) formData.append('heading', heading);
  if (speed != null) formData.append('speed', speed);

  // Send both sha256 and clientSha256
  const effectiveHash = sha256 || clientSha256;
  if (effectiveHash) {
    formData.append('clientSha256', effectiveHash);
    formData.append('sha256', effectiveHash);
  }

  const endpoint = journeyId ? `${API_BASE}/journeys/${journeyId}/frames` : `${API_BASE}/journeys/quick-scan-frame`;
  const res = await fetchWithTimeout(endpoint, {
    method: 'POST',
    body: formData,
  }, 20000); // 20s for multipart upload
  if (!res.ok) throw new Error(await res.text());
  const frame = await res.json();
  if (frame && frame.storageUrl) {
    frame.storageUrl = getAssetUrl(frame.storageUrl);
  }
  return frame;
}

export async function uploadQuickScanFrame(file, metadata = {}) {
  return uploadEvidenceFrame(null, file, metadata);
}

export async function getJourneyFrames(journeyId) {
  const res = await fetchWithTimeout(`${API_BASE}/journeys/${journeyId}/frames`);
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
  const res = await fetchWithTimeout(url);
  return res.json();
}

export async function getIssue(id) {
  const res = await fetchWithTimeout(`${API_BASE}/issues/${id}`);
  return res.json();
}

export async function investigateIssue(id) {
  const res = await fetchWithTimeout(`${API_BASE}/issues/${id}/investigate`, { method: 'POST' });
  return res.json();
}

export async function updateIssueManualLocation(issueId, locationData) {
  const res = await fetchWithTimeout(`${API_BASE}/issues/${issueId}/location`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(locationData),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function autoDraftComplaint(issueId, { name, email, phone }) {
  const params = new URLSearchParams({ issueId });
  if (name) params.append('complainantName', name);
  if (email) params.append('complainantEmail', email);
  if (phone) params.append('complainantPhone', phone);

  const res = await fetchWithTimeout(`${API_BASE}/complaints/auto-draft?${params.toString()}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function initiatePortalHandoff(complaintId) {
  const res = await fetchWithTimeout(`${API_BASE}/complaints/${complaintId}/initiate-handoff`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function recordOfficialReceipt(complaintId, { officialRefId, notes }) {
  const res = await fetchWithTimeout(`${API_BASE}/complaints/${complaintId}/record-receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ officialRefId, notes }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * @deprecated Use initiatePortalHandoff + recordOfficialReceipt for truthful citizen portal submission.
 */
export async function simulateSubmission(complaintId) {
  return initiatePortalHandoff(complaintId);
}

export async function listAuthorities() {
  const res = await fetchWithTimeout(`${API_BASE}/authorities`);
  return res.json();
}

export async function getUserProfile() {
  const res = await fetchWithTimeout(`${API_BASE}/profile`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateUserProfile(data) {
  const res = await fetchWithTimeout(`${API_BASE}/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getConnectedPortals() {
  const res = await fetchWithTimeout(`${API_BASE}/profile/connected-services`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function refreshPortalStatus(portalId) {
  const res = await fetchWithTimeout(`${API_BASE}/profile/connected-services/${portalId}/test-connection`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Government Portal Automation Worker APIs ──

export async function getWorkerStatus() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/automation/worker/status`, {}, 4000);
    if (!res.ok) return { connected: false, activeWorkerCount: 0 };
    return await res.json();
  } catch {
    return { connected: false, activeWorkerCount: 0 };
  }
}

export async function approveComplaint(complaintId) {
  const res = await fetchWithTimeout(`${API_BASE}/complaints/${complaintId}/approve`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function dispatchAutomationJob(complaintId, { mode = 'MOCK', portalId = 'MOCK_PORTAL' } = {}) {
  const res = await fetchWithTimeout(
    `${API_BASE}/automation/complaints/${complaintId}/dispatch?mode=${encodeURIComponent(mode)}&portalId=${encodeURIComponent(portalId)}`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getAutomationJob(complaintId) {
  const res = await fetchWithTimeout(`${API_BASE}/automation/complaints/${complaintId}/job`);
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getFilingAuditTrail(complaintId) {
  const res = await fetchWithTimeout(`${API_BASE}/automation/complaints/${complaintId}/audit`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function supplyAutomationOtp(jobId, otpCode) {
  const res = await fetchWithTimeout(`${API_BASE}/automation/jobs/${jobId}/otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otpCode }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function confirmAutomationCaptcha(jobId) {
  const res = await fetchWithTimeout(`${API_BASE}/automation/jobs/${jobId}/captcha-solved`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Safely extracts a clean, human-readable error message from an HTTP error response.
 * Strictly prevents leaking raw JSON strings or HTML payloads into UI error states.
 */
export async function parseErrorResponse(res, fallbackMessage = 'Server request failed') {
  const status = res.status;
  const statusText = res.statusText || 'Error';
  let message = `${fallbackMessage} (HTTP ${status} ${statusText})`;

  try {
    const text = await res.text();
    if (text && text.trim()) {
      const trimmed = text.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === 'object') {
            if (typeof parsed.message === 'string' && parsed.message.trim()) {
              message = parsed.message.trim();
            } else if (typeof parsed.error === 'string' && parsed.error.trim()) {
              message = `${parsed.error} (HTTP ${status})`;
            }
          }
        } catch {
          // ignore parse error and use default
        }
      } else if (!trimmed.startsWith('<') && trimmed.length < 200) {
        message = trimmed;
      }
    }
  } catch {
    // Keep default message
  }

  return message;
}

/**
 * Retrieves confirmed government complaints history.
 * Excludes drafts, unapproved, failed, SUBMISSION_UNVERIFIED, and mock submissions.
 */
export async function getConfirmedComplaintsHistory() {
  const res = await fetchWithTimeout(`${API_BASE}/complaints/confirmed-history`);
  if (!res.ok) {
    const errorMsg = await parseErrorResponse(res, 'Failed to fetch confirmed complaints from server');
    throw new Error(errorMsg);
  }
  return res.json();
}

/**
 * Retrieves the citizen profile readiness and portal requirements evaluation.
 */
export async function getProfileReadiness() {
  const res = await fetchWithTimeout(`${API_BASE}/profile/readiness`);
  if (!res.ok) {
    const errorMsg = await parseErrorResponse(res, 'Failed to fetch profile readiness evaluation');
    throw new Error(errorMsg);
  }
  return res.json();
}


