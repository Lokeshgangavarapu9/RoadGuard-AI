# RoadGuard AI — Government Portal Automation Completion & Verification Report

**Date:** 2026-10-25  
**Workspace:** `C:\Users\LOKESH\java project 2026`  
**Repository:** [https://github.com/Lokeshgangavarapu9/RoadGuard-AI](https://github.com/Lokeshgangavarapu9/RoadGuard-AI)  
**Branch:** `main`

---

## 1. Executive Summary & Root Cause Analysis

### Identified Architectural Limitations & Root Causes

1. **Browser Same-Origin Policy (SOP) Constraint**:
   - *Problem*: A cloud-hosted React application on Vercel cannot script, manipulate, or extract DOM elements from third-party government websites (`nhai.gov.in`, `cdma.ap.gov.in`) across browser tabs due to Same-Origin Policy and sandboxing.
   - *Resolution*: Implemented a dedicated local automation worker (`roadguard-worker`) powered by Playwright and Chromium that runs on the citizen's computer, connecting securely to the Spring Boot backend.

2. **Anti-Bot & Human Verification Protections**:
   - *Problem*: Government grievance redressal systems mandate citizen identity verification via One-Time Passwords (SMS OTP) and visual/math CAPTCHAs. Automated attempts to bypass or defeat these mechanisms are illegal, fragile, and contrary to civic policy.
   - *Resolution*: Implemented a formal **Human-in-the-Loop State Machine**. The worker pauses whenever OTP or CAPTCHA is challenged, presents a prompt in RoadGuard UI (`REQUEST_OTP`, `REQUEST_CAPTCHA`), allows the citizen to complete the verification in a headed Chromium browser session, and resumes automation upon input.

3. **Receipt Ambiguity & Duplicate Prevention**:
   - *Problem*: If a portal form is submitted but network timeouts or DOM latency prevent immediate confirmation detection, blind retry could create duplicate complaints on official records.
   - *Resolution*: Introduced the `SUBMISSION_UNVERIFIED` state. If the submit button was clicked but receipt extraction is ambiguous, the system halts without retry and warns the citizen.

4. **Worker Concurrency & Lease Abandonment**:
   - *Problem*: Multiple local worker processes polling simultaneously could claim the same job, or a crashed worker could leave a job stuck in `RUNNING`.
   - *Resolution*: Added synchronized claim locking (`IllegalStateException` on double claim) and lease timeout recovery (jobs whose heartbeat expires after `lease-timeout-seconds` are automatically recovered to `PENDING`).

5. **API Security & Data Privacy**:
   - *Problem*: Public worker polling endpoints on cloud-hosted backends must not be abused by unauthorized scrapers or leak credentials.
   - *Resolution*: Added optional `X-Worker-Secret` header authentication, ephemeral OTP wipe (OTP is purged from the database immediately after use), and strict exclusion of credentials from AI models and persistent logs.

---

## 2. Test Execution & Verification Results

### A. Java Backend Test Suite (`roadguard-backend`)

- **Command**: `.\mvnw.cmd test`
- **Total Tests**: **39 passed** (including unit, integration, and lifecycle tests)
- **Failures**: **0**
- **Errors**: **0**
- **Skipped**: **0**
- **Build Outcome**: **`BUILD SUCCESS`**
- **Targeted Automation Tests**:
  - `testAutomationWorkerLifecycle`: Verified full 8-step lifecycle (Job dispatch → worker claim → OTP challenge → citizen OTP input → CAPTCHA challenge → citizen solution → official receipt extraction → audit trail recording).
  - `testConcurrentClaimPrevention`: Verified that concurrent workers attempting to claim the same job are rejected with an exception.
  - `testSubmissionUnverifiedHandling`: Verified that ambiguous portal outcomes transition the complaint to `SUBMISSION_UNVERIFIED` without saving a fake reference.

### B. React Frontend Production Build (`roadguard-frontend`)

- **Command**: `npm run build`
- **Output**:

  ```text
  vite v8.3.5 building client environment for production...
  ✓ 2188 modules transformed.
  dist/index.html                          1.57 kB
  dist/assets/index-BbjqyqtC.css          75.83 kB
  dist/assets/index-BRcxlTZ2.js        2,022.58 kB
  ✓ built in 11.72s
  ```

- **Result**: **0 syntax errors, 0 broken imports, clean production bundle.**

### C. Local Automation Worker Test Suite (`roadguard-worker`)

- **Command**: `npm test` (`node --test test/mock_portal_e2e.test.js`)
- **Browser**: Playwright Chromium (headed & headless tested)
- **Total Tests**: **1**
- **Passes**: **1**
- **Failures**: **0**
- **Duration**: **14.48s**
- **Verified Workflow**:
  - Step 1: Mock portal launched on `127.0.0.1:8089/mock-portal`.
  - Step 2: Playwright launches Chromium and navigates to citizen login.
  - Step 3: Submits mobile number and detects OTP challenge (`582914`).
  - Step 4: Supplies OTP and detects CAPTCHA challenge (`12 + 7 = 19`).
  - Step 5: Completes CAPTCHA and enters grievance form telemetry (GPS, road name, description).
  - Step 6: Submits complaint, detects official acknowledgment, and extracts reference (`MOCK-NHAI-2026-564578`).
  - Step 7: Verifies tracking status page with extracted reference.

---

## 3. Files Created & Modified

### Backend (`roadguard-backend`)

1. [`V5__government_portal_automation_worker.sql`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-backend/src/main/resources/db/migration/V5__government_portal_automation_worker.sql): Flyway migration creating `automation_jobs` and `filing_audit_logs` tables and expanding `complaints_status_chk` to include all 12 state machine statuses.
2. [`AutomationJob.java`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-backend/src/main/java/com/roadguard/api/entity/AutomationJob.java): JPA Entity for worker jobs with lease heartbeats and ephemeral OTP storage.
3. [`FilingAuditLog.java`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-backend/src/main/java/com/roadguard/api/entity/FilingAuditLog.java): Immutable audit trail entity recording action, result, details, timestamp, and screenshot paths.
4. [`AutomationWorkerService.java`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-backend/src/main/java/com/roadguard/api/service/AutomationWorkerService.java): Service handling job dispatching, concurrency claim locking, lease timeout recovery, OTP/CAPTCHA handoffs, and official receipt extraction.
5. [`AutomationWorkerController.java`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-backend/src/main/java/com/roadguard/api/controller/AutomationWorkerController.java): REST API endpoints for worker polling, claiming, heartbeat, events, OTP submission, and audit logs. Protected with `X-Worker-Secret`.
6. [`application.properties`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-backend/src/main/resources/application.properties): Configured worker secret, lease timeout, and retry settings.
7. [`AutomationWorkerServiceTest.java`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-backend/src/test/java/com/roadguard/api/AutomationWorkerServiceTest.java): Comprehensive test suite verifying lifecycle, concurrency locking, and unverified submission handling.

### Local Automation Worker (`roadguard-worker`)

1. [`package.json`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-worker/package.json): Standalone Node.js project configuration with Playwright `^1.50.0`.
2. [`.env.example`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-worker/.env.example): Documented configuration template for backend URL, worker secret, and browser mode.
3. [`src/worker.js`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-worker/src/worker.js): Polling loop, Playwright Chromium manager, OTP/CAPTCHA pause coordinator, graceful SIGINT/SIGTERM shutdown, and audit screenshot logger.
4. [`src/GovernmentPortalAdapter.js`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-worker/src/GovernmentPortalAdapter.js): Base adapter interface defining all required portal lifecycle methods.
5. [`src/adapters/MockPortalAdapter.js`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-worker/src/adapters/MockPortalAdapter.js): Implementation driving the local mock portal for safe local testing.
6. [`src/adapters/RajmargYatraAdapter.js`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-worker/src/adapters/RajmargYatraAdapter.js): Implementation targeting official NHAI Rajmargyatra portal.
7. [`src/adapters/AP_PuramithraAdapter.js`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-worker/src/adapters/AP_PuramithraAdapter.js): Implementation targeting official AP CDMA Puramithra / Mee Kosam portal.
8. [`src/mock-portal/server.js`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-worker/src/mock-portal/server.js): Standalone HTTP mock portal reproducing mobile login, SMS OTP, math CAPTCHA, telemetry form, evidence upload, and acknowledgment receipt.
9. [`test/mock_portal_e2e.test.js`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-worker/test/mock_portal_e2e.test.js): End-to-end automated Playwright test runner.

### Frontend (`roadguard-frontend`)

1. [`api.js`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-frontend/src/api.js): Added worker communication and job tracking functions.
2. [`GrievanceModal.jsx`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-frontend/src/components/GrievanceModal.jsx): Real-time state machine tracker, worker connectivity banner, interactive OTP and CAPTCHA handoff dialogs, `SUBMISSION_UNVERIFIED` warning banner, verified official receipt slip, and audit trail timeline.
3. [`ProfileView.jsx`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-frontend/src/components/ProfileView.jsx): Replaced single button with 3 action buttons: `[Prepare Complaint]`, `[File on Government Portal]`, `[Check Official Status]`.

---

## 4. Portal-by-Portal Capabilities & Limitations

| Feature | Local Mock Portal | NHAI RajmargYatra | AP CDMA / Puramithra |
| :--- | :--- | :--- | :--- |
| **Portal Base URL** | `http://127.0.0.1:8089/mock-portal` | `https://rajmargyatra.nhai.gov.in/` | `https://cdma.ap.gov.in/services/grievances/` |
| **Authentication Method** | Mobile number + fixed test OTP (`582914`) | 10-digit mobile number + SMS OTP | 10-digit mobile number + SMS OTP |
| **OTP Handling** | Automated in test mode or citizen prompt | **Citizen Handshake Required** (via UI prompt) | **Citizen Handshake Required** (via UI prompt) |
| **CAPTCHA Handling** | Solved in test mode or citizen prompt | **Citizen Solves in Chromium Browser Window** | **Citizen Solves in Chromium Browser Window** |
| **Form Telemetry** | Road, GPS, landmark, description, photo | Road/Highway, GPS coordinates, description, photo | Street, Municipality, Ward, description, photo |
| **Confirmation Detection** | DOM receipt parsing (`MOCK-NHAI-2026-XXXXXX`) | DOM receipt regex (`NHAI-[A-Z0-9]+` / Ref ID) | DOM receipt regex (`PGRS-[A-Z0-9]+` / Ref ID) |
| **Public REST API** | Not applicable (Local mock) | **None Officially Exposed for 3rd Parties** | **None Officially Exposed for 3rd Parties** |
| **Testing Scope** | Fully automated end-to-end verified | Non-filing selector & diagnostic inspection only | Non-filing selector & diagnostic inspection only |

---

## 5. End-to-End Workflow for Genuine Citizen Filing

```text
1. Citizen drives & detects road damage (ONNX model produces defect class & bounding box)
                             ↓
2. Evidence saved with verified GPS telemetry & sharpness quality score (CLEAR)
                             ↓
3. Citizen opens Road Issues or Profile → clicks [Prepare Complaint]
                             ↓
4. AI Complaint Engine generates factual dossier without fabricating facts (AWAITING_CITIZEN_APPROVAL)
                             ↓
5. Citizen inspects authority match, GPS, photos, and edits text → clicks [Approve & Submit]
                             ↓
6. Spring Boot queues AutomationJob in READY_TO_SUBMIT state
                             ↓
7. Local worker claims job → launches headed Chromium browser on citizen desktop
                             ↓
8. Portal challenges for SMS OTP → Worker pauses → RoadGuard displays OTP input prompt
                             ↓
9. Citizen inputs OTP → Worker types OTP into portal → Resumes automation
                             ↓
10. Portal challenges for CAPTCHA → Worker pauses → Citizen completes CAPTCHA in browser
                             ↓
11. Worker inputs road damage telemetry, GPS coordinates, and uploads verified photo
                             ↓
12. Worker clicks Submit → Waits for official acknowledgment page
                             ↓
13. Worker extracts genuine official reference ID from DOM → sends to backend
                             ↓
14. Backend stores reference ID & receipt screenshot → marks complaint SUBMITTED
```

---

## 6. How to Run the Worker Locally

### Step 1: Install Dependencies

```powershell
cd "c:\Users\LOKESH\java project 2026\roadguard-worker"
npm install
npx playwright install chromium
```

### Step 2: Configure Environment

Copy `.env.example` to `.env`:

```powershell
cp .env.example .env
```

Default `.env` settings:

```properties
BACKEND_URL=http://localhost:8080
HEADLESS=false
WORKER_SECRET=roadguard-worker-local-dev-token
POLL_INTERVAL_MS=3000
```

### Step 3: Start the Local Worker

```powershell
npm start
```

*(To test against the local mock portal, run `npm run mock-portal` in a separate terminal).*
