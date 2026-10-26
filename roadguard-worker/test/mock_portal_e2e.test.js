/**
 * RoadGuard AI - Mock Government Portal Playwright Automation End-to-End Test
 * Verifies full citizen handoff lifecycle: Login -> OTP -> CAPTCHA -> Form Fill -> Submit -> Official Reference Extraction -> Status Tracking.
 */

import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { MockPortalAdapter } from '../src/adapters/MockPortalAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('End-to-End Playwright Automation against Mock Government Portal', async (t) => {
  console.log('[Test] Starting mock portal server...');

  // 1. Start mock portal server in background process
  const serverPath = path.resolve(__dirname, '../src/mock-portal/server.js');
  const serverProcess = spawn('node', [serverPath], {
    env: { ...process.env, MOCK_PORTAL_PORT: '8089' },
    stdio: 'inherit'
  });

  // Wait 1.5 seconds for mock portal server to boot
  await new Promise(r => setTimeout(r, 1500));

  let browser;
  try {
    // 2. Launch headless Chromium
    console.log('[Test] Launching Playwright Chromium...');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext();
    const page = await context.newPage();
    const adapter = new MockPortalAdapter('http://127.0.0.1:8089/mock-portal');

    // Step 1: Open Portal
    console.log('[Test Step 1] Opening portal...');
    await adapter.openPortal(page, context);
    assert.match(page.url(), /login/, 'Should navigate to login page');

    // Step 2: Citizen mobile login
    console.log('[Test Step 2] Submitting mobile authentication...');
    await adapter.startAuthentication(page, { phone: '+91 98765 43210', name: 'Citizen Tester' });
    assert.match(page.url(), /otp/, 'Should navigate to OTP page');

    // Step 3: Detect OTP Required
    console.log('[Test Step 3] Detecting OTP requirement...');
    const auth1 = await adapter.detectAuthenticationRequired(page);
    assert.strictEqual(auth1.otpRequired, true, 'OTP should be detected as required');
    assert.strictEqual(auth1.captchaRequired, false, 'CAPTCHA not required yet');

    // Step 4: Supply OTP (simulate citizen handoff)
    console.log('[Test Step 4] Supplying citizen OTP...');
    await adapter.submitOtp(page, '582914');
    assert.match(page.url(), /captcha/, 'Should navigate to CAPTCHA page after OTP');

    // Step 5: Detect CAPTCHA Required
    console.log('[Test Step 5] Detecting CAPTCHA challenge...');
    const auth2 = await adapter.detectAuthenticationRequired(page);
    assert.strictEqual(auth2.captchaRequired, true, 'CAPTCHA should be detected as required');

    // Step 6: Complete CAPTCHA
    console.log('[Test Step 6] Completing CAPTCHA verification...');
    await adapter.solveCaptcha(page, '19');
    assert.match(page.url(), /complaint-form/, 'Should navigate to grievance registration form');

    // Step 7: Fill Form telemetry & description
    console.log('[Test Step 7] Filling grievance form telemetry...');
    await adapter.fillLocation(page, {
      roadName: 'National Highway 16 (Vijayawada Bypass)',
      latitude: 16.5062,
      longitude: 80.6480,
      landmark: 'Near Benz Circle Flyover km 354'
    });

    await adapter.fillDescription(page, 'Hazardous deep road pothole detected by RoadGuard AI vehicular sensors at 16.5062°N, 80.6480°E. Presents severe hazard to two-wheeler riders. Immediate asphalt patching requested under IRC:82-2015.');

    // Step 8: Review & Submit
    console.log('[Test Step 8] Reviewing and submitting complaint...');
    await adapter.reviewComplaint(page);
    await adapter.submitComplaint(page);
    assert.match(page.url(), /acknowledgment/, 'Should navigate to acknowledgment page');

    // Step 9: Detect Confirmation & Extract Genuine Reference
    console.log('[Test Step 9] Detecting official receipt and extracting reference...');
    const conf = await adapter.detectSubmissionConfirmation(page);
    assert.strictEqual(conf.confirmed, true, 'Submission confirmation should be detected');

    const officialRef = await adapter.extractOfficialReferenceNumber(page);
    console.log(`[Test Result] Successfully extracted official reference: ${officialRef}`);
    assert.match(officialRef, /^MOCK-NHAI-2026-\d{6}$/, 'Official reference must match standard format');

    // Step 10: Official Status Tracking
    console.log('[Test Step 10] Checking official grievance status...');
    const statusResult = await adapter.getStatusWhenSupported(page, officialRef);
    assert.strictEqual(statusResult.status, 'INSPECTION_SCHEDULED', 'Official status should be retrieved');

    console.log('[Test Passed] Complete end-to-end automation workflow verified successfully!');

    await context.close();
  } finally {
    if (browser) {
      await browser.close();
    }
    // Kill mock portal server
    serverProcess.kill('SIGTERM');
  }
});
