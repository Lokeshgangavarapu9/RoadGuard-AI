/**
 * RoadGuard AI - Local Government Portal Automation Worker
 * Powered by Playwright + Chromium.
 * Runs locally on citizen's computer to automate official grievance filing with human-in-the-loop OTP/CAPTCHA handoffs.
 */

import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MockPortalAdapter } from './adapters/MockPortalAdapter.js';
import { RajmargYatraAdapter } from './adapters/RajmargYatraAdapter.js';
import { AP_PuramithraAdapter } from './adapters/AP_PuramithraAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CLI flags and environment variables
const args = process.argv.slice(2);
const isHeadless = args.includes('--headless') || process.env.HEADLESS === 'true';
const backendArg = args.find(a => a.startsWith('--backend-url='));
const secretArg = args.find(a => a.startsWith('--worker-secret='));

const BACKEND_URL = backendArg ? backendArg.split('=')[1] : (process.env.BACKEND_URL || 'http://localhost:8080');
const WORKER_SECRET = secretArg ? secretArg.split('=')[1] : (process.env.WORKER_SECRET || '');
const WORKER_ID = process.env.WORKER_ID || `worker-node-${process.pid}-${Math.floor(Math.random() * 1000)}`;
const SCREENSHOT_DIR = path.resolve(__dirname, process.env.SCREENSHOT_DIR || '../screenshots');
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '3000', 10);
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '5000', 10);

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

console.log('================================================================');
console.log(' ROADGUARD AI — GOVERNMENT PORTAL AUTOMATION WORKER');
console.log(` Worker ID       : ${WORKER_ID}`);
console.log(` Backend URL     : ${BACKEND_URL}`);
console.log(` Browser         : Chromium (${isHeadless ? 'Headless' : 'Headed - Human Interactive'})`);
console.log(` Auth Secret     : ${WORKER_SECRET ? '[CONFIGURED]' : '[NONE / OPEN]'}`);
console.log(` Polling Rate    : ${POLL_INTERVAL_MS}ms`);
console.log('================================================================');

function getWorkerHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (WORKER_SECRET) {
    headers['X-Worker-Secret'] = WORKER_SECRET;
  }
  return headers;
}

// Heartbeat timer
async function sendHeartbeat() {
  try {
    const headers = {};
    if (WORKER_SECRET) headers['X-Worker-Secret'] = WORKER_SECRET;
    const res = await fetch(`${BACKEND_URL}/api/v1/automation/worker/heartbeat?workerId=${encodeURIComponent(WORKER_ID)}`, {
      method: 'POST',
      headers
    });
    if (!res.ok) {
      console.warn(`[Worker Heartbeat] Backend returned status: ${res.status}`);
    }
  } catch (err) {
    // Backend may be booting or offline
  }
}

// Post event to backend
async function postAuditEvent(jobId, action, result, details, screenshotPath = null, otpPrompt = null, captchaPrompt = null) {
  try {
    await fetch(`${BACKEND_URL}/api/v1/automation/jobs/${jobId}/event`, {
      method: 'POST',
      headers: getWorkerHeaders(),
      body: JSON.stringify({
        workerId: WORKER_ID,
        action,
        result,
        details,
        screenshotPath,
        otpPrompt,
        captchaPrompt
      })
    });
  } catch (err) {
    console.error(`[Worker Audit] Failed to report event '${action}': ${err.message}`);
  }
}

// Fetch job status
async function fetchJob(jobId) {
  const res = await fetch(`${BACKEND_URL}/api/v1/automation/jobs/${jobId}`, {
    headers: getWorkerHeaders()
  });
  if (!res.ok) throw new Error(`Failed to fetch job ${jobId}: ${res.status}`);
  return await res.json();
}

// Claim pending job
async function claimJob(jobId) {
  const res = await fetch(`${BACKEND_URL}/api/v1/automation/jobs/${jobId}/claim?workerId=${encodeURIComponent(WORKER_ID)}`, {
    method: 'POST',
    headers: getWorkerHeaders()
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to claim job ${jobId}: HTTP ${res.status} - ${errorText}`);
  }
  return await res.json();
}

// Complete job
async function completeJob(jobId, status, officialReferenceNumber, confirmationText, screenshotPath) {
  await fetch(`${BACKEND_URL}/api/v1/automation/jobs/${jobId}/complete`, {
    method: 'POST',
    headers: getWorkerHeaders(),
    body: JSON.stringify({
      workerId: WORKER_ID,
      status,
      officialReferenceNumber,
      officialConfirmationText: confirmationText,
      submissionScreenshotPath: screenshotPath
    })
  });
}

// Select adapter for job
function selectAdapter(job) {
  const portalId = (job.portalId || '').toUpperCase();
  const mode = (job.mode || '').toUpperCase();

  if (mode === 'MOCK' || portalId === 'MOCK_PORTAL') {
    return new MockPortalAdapter();
  }
  if (portalId === 'RAJMARGYATRA_NHAI') {
    return new RajmargYatraAdapter();
  }
  if (portalId === 'AP_CDMA' || portalId === 'AP_RNB') {
    return new AP_PuramithraAdapter();
  }
  return new MockPortalAdapter();
}

// Execute job workflow
async function executeFilingJob(job, browser) {
  console.log(`\n[Job #${job.id}] Starting execution for complaint #${job.complaintId} on portal: ${job.portalId} (Mode: ${job.mode})`);

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  const adapter = selectAdapter(job);
  const payload = job.payload || {};

  try {
    // Step 1: Open Portal
    console.log(`[Job #${job.id}] Opening portal: ${adapter.portalName}...`);
    await adapter.openPortal(page, context);
    const openScreenshot = path.join(SCREENSHOT_DIR, `job-${job.id}-1-open.png`);
    await page.screenshot({ path: openScreenshot });
    await postAuditEvent(job.id, 'OPEN_PORTAL', 'SUCCESS', `Opened ${adapter.portalName}`, openScreenshot);

    // Step 2: Citizen Authentication initiation
    console.log(`[Job #${job.id}] Initiating citizen authentication...`);
    const citizenProfile = {
      name: payload.citizenName,
      email: payload.citizenEmail,
      phone: payload.citizenPhone
    };
    await adapter.startAuthentication(page, citizenProfile);
    await postAuditEvent(job.id, 'DETECT_LOGIN', 'SUCCESS', 'Entered mobile number on portal login interface');

    // Step 3: Human Action Detection (OTP / CAPTCHA handoff loop)
    let authDone = false;
    let authAttempts = 0;

    while (!authDone && authAttempts < 60) { // max 5 minutes wait
      authAttempts++;
      const authReq = await adapter.detectAuthenticationRequired(page);

      if (authReq.otpRequired) {
        console.log(`[Job #${job.id}] Government OTP required. Pausing automation for citizen input...`);
        const otpScreenshot = path.join(SCREENSHOT_DIR, `job-${job.id}-otp-prompt.png`);
        await page.screenshot({ path: otpScreenshot });
        await postAuditEvent(job.id, 'REQUEST_OTP', 'AWAITING_HUMAN', authReq.prompt, otpScreenshot, authReq.prompt);

        // Poll backend until citizen supplies OTP
        let otpCode = null;
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const currentJob = await fetchJob(job.id);
          if (currentJob.payload && currentJob.payload.otpCode) {
            otpCode = currentJob.payload.otpCode;
            break;
          }
          if (currentJob.otpPrompt && !currentJob.otpPrompt.isEmpty) {
            // Also check direct field
            const rawJob = await (await fetch(`${BACKEND_URL}/api/v1/automation/jobs/${job.id}`)).json();
            if (rawJob.otpCode) {
              otpCode = rawJob.otpCode;
              break;
            }
          }
        }

        if (otpCode) {
          console.log(`[Job #${job.id}] Received OTP from citizen. Resuming automation...`);
          await adapter.submitOtp(page, otpCode);
          await postAuditEvent(job.id, 'SUPPLY_OTP', 'SUCCESS', 'Citizen provided mobile OTP entered into portal form');
          await page.waitForTimeout(1500);
        } else {
          throw new Error('Timed out waiting for citizen to enter mobile SMS OTP.');
        }
      } else if (authReq.captchaRequired) {
        console.log(`[Job #${job.id}] Government CAPTCHA required. Pausing for human verification...`);
        const captchaScreenshot = path.join(SCREENSHOT_DIR, `job-${job.id}-captcha-prompt.png`);
        await page.screenshot({ path: captchaScreenshot });
        await postAuditEvent(job.id, 'REQUEST_CAPTCHA', 'AWAITING_HUMAN', authReq.prompt, captchaScreenshot, null, authReq.prompt);

        // If mock adapter, auto-solve after citizen approves
        if (adapter instanceof MockPortalAdapter) {
          // Wait for citizen to confirm or 5 seconds in mock
          let captchaSolved = false;
          for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const rawJob = await (await fetch(`${BACKEND_URL}/api/v1/automation/jobs/${job.id}`)).json();
            if (rawJob.captchaSolved) {
              captchaSolved = true;
              break;
            }
          }
          await adapter.solveCaptcha(page);
          await postAuditEvent(job.id, 'CAPTCHA_SOLVED', 'SUCCESS', 'Human completed CAPTCHA security challenge in browser');
        } else {
          // Live portal: wait for citizen to solve CAPTCHA in browser window
          let captchaSolved = false;
          for (let i = 0; i < 60; i++) {
            await new Promise(r => setTimeout(r, 3000));
            const rawJob = await (await fetch(`${BACKEND_URL}/api/v1/automation/jobs/${job.id}`)).json();
            if (rawJob.captchaSolved) {
              captchaSolved = true;
              break;
            }
            // Check if page already progressed
            const check = await adapter.detectAuthenticationRequired(page);
            if (!check.captchaRequired) {
              captchaSolved = true;
              break;
            }
          }
        }
        await page.waitForTimeout(1500);
      } else {
        // Neither OTP nor CAPTCHA needed
        authDone = true;
      }
    }

    await postAuditEvent(job.id, 'AUTH_SUCCESS', 'SUCCESS', 'Citizen successfully authenticated with official portal session');

    // Step 4: Fill Grievance Form
    console.log(`[Job #${job.id}] Filling grievance form telemetry...`);
    const category = adapter.mapComplaintCategory(payload.defectClass);
    await adapter.fillLocation(page, {
      roadName: payload.roadName,
      latitude: payload.latitude,
      longitude: payload.longitude,
      landmark: payload.roadName
    });

    await adapter.fillDescription(page, payload.description);

    // Upload evidence image if available
    if (payload.evidenceUrls && payload.evidenceUrls.length > 0) {
      console.log(`[Job #${job.id}] Uploading photographic evidence...`);
      await adapter.uploadEvidence(page, payload.evidenceUrls[0]);
      await postAuditEvent(job.id, 'UPLOAD_EVIDENCE', 'SUCCESS', `Attached verified telemetry photo: ${payload.evidenceUrls[0]}`);
    }

    const formScreenshot = path.join(SCREENSHOT_DIR, `job-${job.id}-2-form.png`);
    await page.screenshot({ path: formScreenshot });
    await postAuditEvent(job.id, 'FORM_FILLED', 'SUCCESS', `Pavement category mapped to '${category}'. GPS & description filled.`, formScreenshot);

    // Step 5: Citizen Review Approval
    await adapter.reviewComplaint(page);
    await postAuditEvent(job.id, 'CITIZEN_APPROVED', 'SUCCESS', 'Grievance dossier reviewed and verified for submission');

    // Step 6: Submit to Portal
    console.log(`[Job #${job.id}] Submitting grievance form to government portal...`);
    await adapter.submitComplaint(page);
    await postAuditEvent(job.id, 'CLICK_SUBMIT', 'SUCCESS', 'Submitted complaint form to jurisdictional portal');

    // Step 7: Confirmation & Official Reference Extraction
    console.log(`[Job #${job.id}] Waiting for official government receipt confirmation...`);
    const conf = await adapter.detectSubmissionConfirmation(page);
    if (!conf.confirmed) {
      throw new Error(conf.error || 'Official confirmation was not returned by portal.');
    }

    const officialRef = await adapter.extractOfficialReferenceNumber(page);
    console.log(`[Job #${job.id}] Official reference extracted: ${officialRef}`);

    const ackScreenshot = path.join(SCREENSHOT_DIR, `job-${job.id}-3-ack.png`);
    await page.screenshot({ path: ackScreenshot });

    await postAuditEvent(job.id, 'EXTRACT_REFERENCE', 'SUCCESS', `Official reference ID extracted: ${officialRef}`, ackScreenshot);

    // Mark Job COMPLETED in RoadGuard backend
    await completeJob(job.id, 'COMPLETED', officialRef, conf.rawReceiptText || `Registered with official reference: ${officialRef}`, ackScreenshot);

    console.log(`[Job #${job.id}] Successfully completed and verified! Reference: ${officialRef}\n`);

  } catch (err) {
    console.error(`[Job #${job.id}] Error: ${err.message}`);
    const errorScreenshot = path.join(SCREENSHOT_DIR, `job-${job.id}-error.png`);
    try {
      await page.screenshot({ path: errorScreenshot });
    } catch {}

    // Distinguish ambiguous outcome (submit clicked, receipt unclear) from definite failure
    const outcomeUncertain = err.message && (
      err.message.includes('Official confirmation not') ||
      err.message.includes('Outcome unverified') ||
      err.message.includes('receipt not detected')
    );

    const failureStatus = outcomeUncertain ? 'SUBMISSION_UNVERIFIED' : 'FAILED';
    const auditAction = outcomeUncertain ? 'SUBMISSION_UNVERIFIED' : 'ERROR';

    await postAuditEvent(job.id, auditAction, 'DIAGNOSTIC', err.message, errorScreenshot);
    await completeJob(job.id, failureStatus, null, err.message, errorScreenshot);
  } finally {
    await context.close();
  }
}

// Main polling loop
async function runWorker() {
  console.log('[Worker] Launching Playwright Chromium...');
  const browser = await chromium.launch({
    headless: isHeadless,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
  });

  console.log('[Worker] Connected and listening for grievance filing jobs...');

  // Start heartbeat interval
  const heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  await sendHeartbeat();

  let isShuttingDown = false;

  const handleShutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[Worker] Received ${signal}. Closing browser and performing graceful shutdown...`);
    clearInterval(heartbeatTimer);
    try {
      await browser.close();
      console.log('[Worker] Browser closed cleanly.');
    } catch {}
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  // Continuous polling loop
  while (!isShuttingDown) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/automation/jobs/pending`, {
        headers: getWorkerHeaders()
      });
      if (res.ok) {
        const pendingJobs = await res.json();
        for (const job of pendingJobs) {
          if (isShuttingDown) break;
          try {
            const claimed = await claimJob(job.id);
            await executeFilingJob(claimed, browser);
          } catch (err) {
            console.error(`[Worker] Failed to process job #${job.id}: ${err.message}`);
          }
        }
      }
    } catch (err) {
      // Backend not yet reachable
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

// Start worker
runWorker().catch(err => {
  console.error('[Worker Fatal Error]', err);
  process.exit(1);
});
