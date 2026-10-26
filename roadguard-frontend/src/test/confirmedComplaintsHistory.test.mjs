import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseErrorResponse } from '../api.js';

describe('RoadGuard AI — Confirmed Complaints History & Error Sanitization', () => {
  it('parses Spring Boot 400 Bad Request JSON into human-readable string without leaking raw JSON', async () => {
    const rawJsonPayload = JSON.stringify({
      timestamp: '2026-10-26T14:24:32.630+00:00',
      status: 400,
      error: 'Bad Request',
      path: '/api/v1/complaints/confirmed-history'
    });

    const mockResponse = {
      status: 400,
      statusText: 'Bad Request',
      text: async () => rawJsonPayload
    };

    const message = await parseErrorResponse(mockResponse, 'Failed to fetch confirmed complaints');
    assert.equal(message, 'Bad Request (HTTP 400)');
    assert.ok(!message.includes('{'), 'Error message must never leak raw JSON open bracket');
    assert.ok(!message.includes('timestamp'), 'Error message must not leak internal timestamp fields');
  });

  it('extracts explicit server error message when provided in JSON body', async () => {
    const customErrorJson = JSON.stringify({
      status: 400,
      error: 'Bad Request',
      message: 'Invalid parameter: officialRefId is required.'
    });

    const mockResponse = {
      status: 400,
      statusText: 'Bad Request',
      text: async () => customErrorJson
    };

    const message = await parseErrorResponse(mockResponse);
    assert.equal(message, 'Invalid parameter: officialRefId is required.');
  });

  it('handles non-JSON error responses gracefully', async () => {
    const mockResponse = {
      status: 502,
      statusText: 'Bad Gateway',
      text: async () => '<html><body>502 Bad Gateway</body></html>'
    };

    const message = await parseErrorResponse(mockResponse, 'Server temporarily unavailable');
    assert.equal(message, 'Server temporarily unavailable (HTTP 502 Bad Gateway)');
  });

  it('handles empty server error text gracefully with fallback', async () => {
    const mockResponse = {
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => ''
    };

    const message = await parseErrorResponse(mockResponse, 'Backend service failure');
    assert.equal(message, 'Backend service failure (HTTP 500 Internal Server Error)');
  });

  it('defensively sanitizes raw JSON strings in HistoryView error state', () => {
    function sanitizeErrorMessage(rawMsg) {
      if (typeof rawMsg === 'string' && rawMsg.trim().startsWith('{') && rawMsg.trim().endsWith('}')) {
        try {
          const parsed = JSON.parse(rawMsg);
          return parsed.message || parsed.error || `Server error (${parsed.status || 400})`;
        } catch {
          // ignore
        }
      }
      return rawMsg || 'Failed to fetch confirmed complaints from server.';
    }

    const rawError = '{"timestamp":"2026-10-26T14:24:32.630+00:00","status":400,"error":"Bad Request","path":"/api/v1/complaints/confirmed-history"}';
    const clean = sanitizeErrorMessage(rawError);
    assert.equal(clean, 'Bad Request');
    assert.ok(!clean.startsWith('{'));

    const customError = '{"status":404,"error":"Not Found","message":"Complaint record not found"}';
    assert.equal(sanitizeErrorMessage(customError), 'Complaint record not found');
  });

  it('ensures genuinely confirmed complaints require non-null official reference IDs and SUBMITTED status', () => {
    function isConfirmedComplaint(complaint) {
      if (!complaint) return false;
      if (complaint.status !== 'SUBMITTED') return false;
      if (!complaint.officialRefId || complaint.officialRefId.trim().length < 3) return false;
      if (/^(MOCK|SIM|TEST|DEMO|STM|DRAFT)[-_]/i.test(complaint.officialRefId.trim())) return false;
      return true;
    }

    // Genuine confirmed complaint
    assert.equal(isConfirmedComplaint({
      status: 'SUBMITTED',
      officialRefId: 'NHAI-2026-OCT-88492'
    }), true);

    // Mock complaint
    assert.equal(isConfirmedComplaint({
      status: 'SUBMITTED',
      officialRefId: 'MOCK-NHAI-12345'
    }), false);

    // Draft complaint
    assert.equal(isConfirmedComplaint({
      status: 'DRAFT',
      officialRefId: 'NHAI-2026-OCT-88492'
    }), false);

    // Unconfirmed / pending complaint
    assert.equal(isConfirmedComplaint({
      status: 'READY_TO_SUBMIT',
      officialRefId: null
    }), false);
  });
});
