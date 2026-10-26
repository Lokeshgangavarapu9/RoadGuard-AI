# RoadGuard AI — Government Complaint History Integration Engineering Report

## Executive Summary

This report documents the implementation and verification of the **Government Complaint History Integration** in RoadGuard AI.

The Journey History section has been enhanced with two dedicated tabs:

1. **Inspection Journeys**: Preserves the complete road-monitoring run audit trail (frames, defects, vehicle type, and recording timestamps).
2. **Government Complaints**: Displays confirmed road-damage complaints successfully filed and verified on real government grievance portals.

In accordance with strict anti-fabrication guidelines, this section displays **only** confirmed successful filings where a genuine government receipt or reference ID was returned and persisted. Drafts, pending approvals, active worker jobs, unverified outcomes (`SUBMISSION_UNVERIFIED`), failed submissions, and mock test filings are strictly excluded from the real complaint history.

---

## 1. UI Changes in Journey History

The `HistoryView.jsx` component was updated to provide a tabbed interface adhering to RoadGuard AI's dark theme:

- **Section Navigation**:
  - `[Inspection Journeys]`: Shows the full journey audit table and mobile cards.
  - `[Government Complaints]`: Shows verified complaint cards.
- **Displayed Fields per Confirmed Complaint**:
  1. **Government Portal Name**: Authority or portal name (e.g., *NHAI RajmargYatra*, *AP CDMA Puramithra*).
  2. **Official Government Portal URL**: Hyperlinked with `ExternalLink` icon and clean domain subtitle.
  3. **Official Complaint Reference Number**: Monospace green badge with check icon (e.g., `Ref: NHAI-2026-OCT-88492`).
  4. **Road Damage Category**: Distinct badge (e.g., `POTHOLE`, `ROAD_CRACK`).
  5. **Complaint Description**: Clean summary subject from the complaint dossier.
  6. **Road Name & Coordinates**: GPS coordinates and roadway name with `MapPin` icon.
  7. **Filing Date, Weekday & Time**: Formatted in Indian Standard Time (e.g., `Sunday, 25 October 2026 · 4:12 PM IST`).
  8. **Linked RoadGuard Journey ID**: Clickable badge pointing back to the monitoring run (e.g., `Journey: #12`).
  9. **Evidence Photos**: Thumbnail gallery with full-size interactive modal preview.
  10. **Filing Channel**: Identifies whether filing occurred via `"Automated Playwright Worker"` or `"Citizen Assisted Handoff"`.
- **Empty State**: Clear empty-state container with landmark icon explaining that no confirmed government complaints have been filed yet.

---

## 2. Backend & Database Architecture

### Data Model & Persistence

- **Entity**: [`com.roadguard.api.entity.Complaint`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-backend/src/main/java/com/roadguard/api/entity/Complaint.java)
  - `status`: `ComplaintStatus.SUBMITTED`
  - `officialRefId`: Persisted genuine receipt ID
  - `submittedAt`: Actual timestamp of confirmed filing
  - `roadIssue`: Direct link to defect coordinates, defect class, and parent `Journey`
  - `authority`: Direct link to statutory authority records
- **DTO**: [`com.roadguard.api.dto.ConfirmedComplaintResponse`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-backend/src/main/java/com/roadguard/api/dto/ConfirmedComplaintResponse.java)
- **Repository**: [`com.roadguard.api.repository.ComplaintRepository`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-backend/src/main/java/com/roadguard/api/repository/ComplaintRepository.java)
  - Query: `findByStatusAndOfficialRefIdIsNotNullOrderBySubmittedAtDesc`
- **Controller**: [`com.roadguard.api.controller.ComplaintController`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-backend/src/main/java/com/roadguard/api/controller/ComplaintController.java)
  - Endpoint: `GET /api/v1/complaints/confirmed-history`

---

## 3. Real Filing Confirmation Rule & Mock Separation

A complaint is recognized and displayed in the Government Complaints history **only** if:

1. `status == ComplaintStatus.SUBMITTED`
2. `officialRefId` is non-null and at least 3 characters.
3. `officialRefId` does NOT match mock patterns (`MOCK-`, `SIM-`, `TEST-`, `DEMO-`, `STM-`, `DRAFT-`).
4. The complaint's associated `AutomationJob` (if present) was executed in `LIVE` mode (records with `mode == MOCK` are excluded).

---

## 4. Automation Pipeline & Verified Connections

```text
Inspection Journey (GPS + Camera)
       ↓
AI Defect Vision (YOLO11s ONNX)
       ↓
Evidence Frame Persistence & Temporal Confirmation
       ↓
Complaint Preparation & Dossier Generation
       ↓
Authority Routing (NHAI / AP CDMA / Mee Kosam)
       ↓
Citizen Review & Explicit Approval
       ↓
Automation Job Creation (LIVE mode)
       ↓
Local Playwright Worker Job Claim (lease-locked)
       ↓
Government Portal Adapter Execution
       ↓
Human-in-the-Loop OTP / CAPTCHA Handoff
       ↓
Official Portal Submission & Receipt Extraction
       ↓
Backend Persistence & Audit Logging
       ↓
Government Complaints History Tab (React Frontend)
```

---

## 5. Security and Reliability Checks

- **No Credentials Logged**: OTP codes and CAPTCHA solutions are never stored in audit logs or persistent storage.
- **Worker Authentication**: Shared secret authentication via `X-Worker-Secret` prevents rogue worker connections.
- **Lease Timeout Recovery**: Abandoned worker jobs are automatically recovered after lease expiry without duplicating submissions.
- **Ambiguous State Isolation**: Ambiguous submissions are marked `SUBMISSION_UNVERIFIED` and never retried blindly.

---

## 6. Files Changed

### Backend (`roadguard-backend`)

- [`ComplaintController.java`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-backend/src/main/java/com/roadguard/api/controller/ComplaintController.java) — Added `GET /api/v1/complaints/confirmed-history` with anti-mock filtering and evidence photo assembly.
- [`ComplaintRepository.java`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-backend/src/main/java/com/roadguard/api/repository/ComplaintRepository.java) — Added `findByStatusAndOfficialRefIdIsNotNullOrderBySubmittedAtDesc`.
- [`ConfirmedComplaintResponse.java`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-backend/src/main/java/com/roadguard/api/dto/ConfirmedComplaintResponse.java) — New response DTO.
- [`AutomationWorkerServiceTest.java`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-backend/src/test/java/com/roadguard/api/AutomationWorkerServiceTest.java) — Added test verifying genuine filing retrieval and strict exclusion of mocks, drafts, and unverified filings.

### Frontend (`roadguard-frontend`)

- [`api.js`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-frontend/src/api.js) — Exported `getConfirmedComplaintsHistory()`.
- [`HistoryView.jsx`](file:///c:/Users/LOKESH/java%20project%202026/roadguard-frontend/src/components/HistoryView.jsx) — Added tab toggle (`Inspection Journeys` vs `Government Complaints`), complaint cards, timestamp formatting with weekdays, and evidence preview modal.

---

## 7. Verification Tests and Results

### Backend Maven Test Suite

Command: `.\mvnw.cmd test`

- **Result**: `BUILD SUCCESS`
- **Tests run**: 42, **Failures**: 0, **Errors**: 0, **Skipped**: 0
- **Time elapsed**: 6 min 51 s
- **Confirmed History Test**: Passed (`testConfirmedComplaintsHistoryExcludesMocksAndUnverified`).

### Frontend Production Build

Command: `npm run build`

- **Result**: `✓ built in 25.73s`
- **Zero build or syntax errors**.

### Playwright Worker Test Suite

Command: `npm test`

- **Result**: `✔ End-to-End Playwright Automation against Mock Government Portal (24558.5242ms)`
- **Tests**: 1 passed, 0 failed.

---

## IMPLEMENTED

- Tabbed interface in Journey History separating Inspection Journeys from Government Complaints.
- Backend API endpoint `GET /api/v1/complaints/confirmed-history`.
- Strict anti-mock and anti-fabrication filters.
- Formatted timestamp with weekday and IST timezone.
- Evidence photo thumbnails and full-size modal viewer.
- Full end-to-end integration and automated unit/integration tests.

## TESTS PASSED

- `AutomationWorkerServiceTest` (4/4 passed including mock exclusion test).
- Complete backend test suite (42/42 passed).
- Frontend production Vite build (`npm run build`).
- Worker Playwright test suite (`npm test`).

## TESTS FAILED

- None.

## NOT VERIFIED

- Live submission against real government portals in production with active citizen mobile numbers (requires real-world citizen SIM authentication).

## DEPLOYMENT STATUS

- Local codebase is fully updated, compiled, and verified.
- Production deployment has **not** been pushed (awaiting user explicit approval).

## USER ACTION REQUIRED

- None. All changes are committed locally and ready for review.
