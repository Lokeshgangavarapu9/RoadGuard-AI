/**
 * RoadGuard AI - Local Mock Government Grievance Portal
 * Simulates official portals (NHAI RajmargYatra / AP PGRS) for safe local end-to-end testing.
 * Implements: Login -> Mobile SMS OTP challenge -> CAPTCHA challenge -> Form -> Photo Upload -> Acknowledgment Receipt.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.MOCK_PORTAL_PORT || 8089;
const HOST = '127.0.0.1';

// Ephemeral server state
const sessionState = {
  mobile: '',
  expectedOtp: '582914', // Test OTP displayed on page for convenient automated testing
  otpVerified: false,
  captchaVerified: false,
  lastComplaint: null
};

function parseFormBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      const params = new URLSearchParams(body);
      const data = {};
      for (const [k, v] of params.entries()) {
        data[k] = v;
      }
      resolve(data);
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const pathname = url.pathname;

  // Set standard HTML response headers
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  // 1. Root redirect
  if (pathname === '/' || pathname === '/mock-portal') {
    res.writeHead(302, { Location: '/mock-portal/login' });
    return res.end();
  }

  // 2. Citizen Mobile Login
  if (pathname === '/mock-portal/login') {
    if (req.method === 'POST') {
      const data = await parseFormBody(req);
      sessionState.mobile = data.mobile || '9876543210';
      sessionState.otpVerified = false;
      sessionState.captchaVerified = false;
      res.writeHead(302, { Location: '/mock-portal/otp' });
      return res.end();
    }

    return res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Mock Government Grievance Portal - Login</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
          .card { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 32px; width: 440px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          .gov-badge { background: #0284c7; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; display: inline-block; margin-bottom: 12px; }
          h2 { margin: 0 0 8px; font-size: 20px; color: #38bdf8; }
          p { color: #94a3b8; font-size: 13px; line-height: 1.5; margin-bottom: 24px; }
          label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px; color: #cbd5e1; }
          input { width: 100%; box-sizing: border-box; padding: 10px 14px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white; font-size: 14px; margin-bottom: 20px; }
          button { width: 100%; padding: 12px; background: #0284c7; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; }
          button:hover { background: #0369a1; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="gov-badge">Official Citizen Redressal System (MOCK)</div>
          <h2>Citizen Authentication</h2>
          <p>Please enter your registered 10-digit Indian mobile number to receive a One-Time Password (OTP) for filing road defect grievances.</p>
          <form method="POST" action="/mock-portal/login">
            <label for="mobile">Mobile Number (10 digits)</label>
            <input type="tel" id="mobile" name="mobile" placeholder="e.g. 9876543210" required pattern="[0-9]{10}" value="${sessionState.mobile || '9876543210'}" />
            <button type="submit" id="btn-request-otp">Send Mobile OTP</button>
          </form>
        </div>
      </body>
      </html>
    `);
  }

  // 3. OTP Verification
  if (pathname === '/mock-portal/otp') {
    let errorNotice = '';
    if (req.method === 'POST') {
      const data = await parseFormBody(req);
      if (data.otp === sessionState.expectedOtp) {
        sessionState.otpVerified = true;
        res.writeHead(302, { Location: '/mock-portal/captcha' });
        return res.end();
      } else {
        errorNotice = `<div style="color: #ef4444; font-size: 12px; margin-bottom: 16px;">Invalid OTP entered. Please try again.</div>`;
      }
    }

    return res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Mock Government Grievance Portal - OTP Verification</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
          .card { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 32px; width: 440px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          .gov-badge { background: #eab308; color: #713f12; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; display: inline-block; margin-bottom: 12px; }
          h2 { margin: 0 0 8px; font-size: 20px; color: #38bdf8; }
          p { color: #94a3b8; font-size: 13px; line-height: 1.5; margin-bottom: 20px; }
          .hint { background: rgba(56, 189, 248, 0.1); border: 1px dashed #38bdf8; border-radius: 6px; padding: 8px 12px; font-size: 12px; color: #38bdf8; margin-bottom: 20px; }
          label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px; color: #cbd5e1; }
          input { width: 100%; box-sizing: border-box; padding: 10px 14px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white; font-size: 16px; letter-spacing: 4px; margin-bottom: 20px; text-align: center; }
          button { width: 100%; padding: 12px; background: #0284c7; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="gov-badge">Government OTP Required</div>
          <h2>Enter One-Time Password</h2>
          <p>A 6-digit verification code has been dispatched via SMS to <strong>+91 ${sessionState.mobile || '9876543210'}</strong>.</p>
          <div class="hint">Test Environment Notice: Current verification OTP is <strong>${sessionState.expectedOtp}</strong></div>
          ${errorNotice}
          <form method="POST" action="/mock-portal/otp">
            <label for="otp-input">6-Digit SMS OTP</label>
            <input type="text" id="otp-input" name="otp" maxlength="6" placeholder="______" required autofocus />
            <button type="submit" id="btn-verify-otp">Verify OTP &amp; Proceed</button>
          </form>
        </div>
      </body>
      </html>
    `);
  }

  // 4. Human CAPTCHA Challenge
  if (pathname === '/mock-portal/captcha') {
    let errorNotice = '';
    if (req.method === 'POST') {
      const data = await parseFormBody(req);
      if (data.captcha_answer === '19' || data.captcha_checkbox === 'on') {
        sessionState.captchaVerified = true;
        res.writeHead(302, { Location: '/mock-portal/complaint-form' });
        return res.end();
      } else {
        errorNotice = `<div style="color: #ef4444; font-size: 12px; margin-bottom: 16px;">Incorrect CAPTCHA answer. Please solve correctly.</div>`;
      }
    }

    return res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Mock Government Grievance Portal - Human Verification</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
          .card { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 32px; width: 440px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          .gov-badge { background: #a855f7; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; display: inline-block; margin-bottom: 12px; }
          h2 { margin: 0 0 8px; font-size: 20px; color: #38bdf8; }
          p { color: #94a3b8; font-size: 13px; line-height: 1.5; margin-bottom: 20px; }
          .captcha-box { background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 16px; margin-bottom: 20px; text-align: center; }
          .captcha-challenge { font-family: monospace; font-size: 22px; font-weight: 700; color: #a855f7; letter-spacing: 2px; }
          label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px; color: #cbd5e1; }
          input[type="text"] { width: 100%; box-sizing: border-box; padding: 10px 14px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white; font-size: 14px; margin-bottom: 20px; }
          button { width: 100%; padding: 12px; background: #a855f7; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="gov-badge">Security Verification</div>
          <h2>Human Verification (CAPTCHA)</h2>
          <p>Government cybersecurity policies require human-in-the-loop CAPTCHA verification before opening the grievance form.</p>
          ${errorNotice}
          <form method="POST" action="/mock-portal/captcha">
            <div class="captcha-box">
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 6px;">Solve math puzzle:</div>
              <div class="captcha-challenge" id="captcha-question">12 + 7 = ?</div>
            </div>
            <label for="captcha-answer">Your Answer</label>
            <input type="text" id="captcha-answer" name="captcha_answer" placeholder="Enter sum (e.g. 19)" required />
            <button type="submit" id="btn-submit-captcha">Complete CAPTCHA</button>
          </form>
        </div>
      </body>
      </html>
    `);
  }

  // 5. Grievance Registration Form
  if (pathname === '/mock-portal/complaint-form') {
    if (req.method === 'POST') {
      const data = await parseFormBody(req);
      const randNum = Math.floor(100000 + Math.random() * 900000);
      const officialRef = `MOCK-NHAI-2026-${randNum}`;
      sessionState.lastComplaint = {
        referenceNumber: officialRef,
        category: data.category || 'Pothole / Road Depression',
        roadName: data.road_name || 'National Highway 16',
        latitude: data.latitude || '16.5062',
        longitude: data.longitude || '80.6480',
        description: data.description || 'Hazardous road defect detected.',
        submittedAt: new Date().toISOString()
      };
      res.writeHead(302, { Location: '/mock-portal/acknowledgment' });
      return res.end();
    }

    return res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Mock Government Grievance Portal - Register Grievance</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px 20px; margin: 0; display: flex; justify-content: center; }
          .container { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 36px; width: 620px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          .gov-badge { background: #10b981; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; display: inline-block; margin-bottom: 12px; }
          h2 { margin: 0 0 6px; font-size: 22px; color: #38bdf8; }
          p { color: #94a3b8; font-size: 13px; line-height: 1.5; margin-bottom: 24px; }
          .form-group { margin-bottom: 18px; }
          label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px; color: #cbd5e1; }
          input, select, textarea { width: 100%; box-sizing: border-box; padding: 10px 14px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white; font-size: 13px; outline: none; }
          input:focus, select:focus, textarea:focus { border-color: #38bdf8; }
          .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
          button { width: 100%; padding: 14px; background: linear-gradient(135deg, #10b981 0%, #0284c7 100%); color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 10px; }
          button:hover { opacity: 0.95; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="gov-badge">Grievance Redressal Portal Form</div>
          <h2>File Road Pavement Hazard Grievance</h2>
          <p>Authenticated as Citizen Mobile <strong>+91 ${sessionState.mobile || '9876543210'}</strong>. Enter verifiable telemetry and upload photographic evidence.</p>
          <form method="POST" action="/mock-portal/complaint-form" id="complaint-form">
            <div class="form-group">
              <label for="category">Defect Classification *</label>
              <select id="category" name="category" required>
                <option value="Pothole / Road Depression">Pothole / Road Surface Depression (buraco)</option>
                <option value="Longitudinal / Pavement Cracking">Longitudinal / Transverse Asphalt Cracking (trinca)</option>
                <option value="Alligator / Mesh Pavement Distress">Alligator / Mesh Fatigue Distress (trinca_malha)</option>
                <option value="Damaged Manhole / Drain Grate">Damaged / Open Manhole Cover (tampa_bueiro)</option>
              </select>
            </div>

            <div class="form-group">
              <label for="road_name">Corridor / Highway Name *</label>
              <input type="text" id="road_name" name="road_name" placeholder="e.g. NH-16 Chennai-Kolkata Highway" required />
            </div>

            <div class="row">
              <div class="form-group">
                <label for="latitude">GPS Latitude (°N) *</label>
                <input type="text" id="latitude" name="latitude" placeholder="e.g. 16.5062" required />
              </div>
              <div class="form-group">
                <label for="longitude">GPS Longitude (°E) *</label>
                <input type="text" id="longitude" name="longitude" placeholder="e.g. 80.6480" required />
              </div>
            </div>

            <div class="form-group">
              <label for="landmark">Nearest Landmark / Chainage</label>
              <input type="text" id="landmark" name="landmark" placeholder="e.g. Near Benz Circle Flyover km 354" />
            </div>

            <div class="form-group">
              <label for="description">Factual Pavement Grievance Description *</label>
              <textarea id="description" name="description" rows="5" placeholder="Enter objective defect observations..." required></textarea>
            </div>

            <div class="form-group">
              <label for="photo-file">Upload Photographic Evidence</label>
              <input type="file" id="photo-file" name="evidence" accept="image/*" />
            </div>

            <button type="submit" id="submit-complaint-btn">Submit Grievance to Jurisdictional Authority</button>
          </form>
        </div>
      </body>
      </html>
    `);
  }

  // 6. Official Acknowledgment Receipt
  if (pathname === '/mock-portal/acknowledgment') {
    const c = sessionState.lastComplaint || {
      referenceNumber: `MOCK-NHAI-2026-${Math.floor(100000 + Math.random() * 900000)}`,
      category: 'Pothole / Road Depression',
      roadName: 'National Highway 16',
      latitude: '16.5062',
      longitude: '80.6480',
      submittedAt: new Date().toISOString()
    };

    return res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Mock Government Grievance Portal - Grievance Acknowledgment</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; }
          .card { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 36px; width: 560px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          .success-badge { background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #10b981; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 16px; }
          h2 { margin: 0 0 6px; font-size: 22px; color: #f8fafc; }
          p { color: #94a3b8; font-size: 13px; line-height: 1.5; margin-bottom: 24px; }
          .receipt-box { background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 20px; margin-bottom: 24px; }
          .ref-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px; margin-bottom: 12px; }
          .ref-label { font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; }
          .ref-number { font-family: monospace; font-size: 18px; font-weight: 700; color: #38bdf8; }
          .detail-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; color: #cbd5e1; }
          .detail-label { color: #64748b; }
          .status-badge { background: #0369a1; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="success-badge">✓ Grievance Registered Successfully</div>
          <h2>Official Grievance Acknowledgment</h2>
          <p>Your road pavement defect complaint has been officially registered and forwarded to the designated executive engineer.</p>
          
          <div class="receipt-box" id="acknowledgment-slip">
            <div class="ref-row">
              <span class="ref-label">Official Grievance Reference</span>
              <span class="ref-number" id="official-reference-id">${c.referenceNumber}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Authority:</span>
              <span>National Highways Authority of India (PIU Vijayawada)</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Classification:</span>
              <span>${c.category}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Road Corridor:</span>
              <span>${c.roadName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Coordinates:</span>
              <span>${c.latitude}°N, ${c.longitude}°E</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Filing Timestamp:</span>
              <span>${c.submittedAt}</span>
            </div>
            <div class="detail-row" style="margin-top: 12px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.08);">
              <span class="detail-label">Official Status:</span>
              <span class="status-badge" id="official-status">UNDER_INVESTIGATION</span>
            </div>
          </div>
          
          <div style="font-size: 11px; color: #64748b; text-align: center;">
            Please record your official reference number <strong>${c.referenceNumber}</strong> for statutory compliance and RTI tracking.
          </div>
        </div>
      </body>
      </html>
    `);
  }

  // 7. Grievance Status Lookup Page
  if (pathname === '/mock-portal/status') {
    const ref = url.searchParams.get('ref') || 'MOCK-NHAI-2026-984321';
    return res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Mock Government Grievance Portal - Status Tracking</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
          .card { background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 32px; width: 480px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          h2 { margin: 0 0 12px; font-size: 20px; color: #38bdf8; }
          .status-item { padding: 12px; background: #0f172a; border-radius: 8px; margin-bottom: 10px; font-size: 13px; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Official Grievance Status</h2>
          <div class="status-item">
            <span style="color:#64748b;">Reference ID:</span>
            <span id="status-ref" style="font-weight:700; color:#38bdf8;">${ref}</span>
          </div>
          <div class="status-item">
            <span style="color:#64748b;">Current Stage:</span>
            <span id="status-value" style="color:#10b981; font-weight:700;">INSPECTION_SCHEDULED</span>
          </div>
          <div class="status-item">
            <span style="color:#64748b;">Assigned Officer:</span>
            <span>Executive Engineer (NH-16 Maintenance Division)</span>
          </div>
        </div>
      </body>
      </html>
    `);
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, HOST, () => {
  console.log(`[RoadGuard Mock Portal] Running at http://${HOST}:${PORT}/mock-portal`);
});
