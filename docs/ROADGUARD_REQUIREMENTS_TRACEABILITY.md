# RoadGuard AI — Requirements Traceability Matrix (RTM)

**Audit Date**: 28 October 2026  
**Baseline Git Commit**: `a58f174`  
**Target Environment**: GitHub Main, Vercel (`https://roadguard-frontend.vercel.app`), Render (`https://roadguard-ai-tael.onrender.com`)

---

## 1. Traceability Matrix

| Req ID | Requirement Description | User Persona | Frontend Component | Backend Service / Endpoint | DB Entity / Migration | Test Case | Status | Evidence / Notes |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **REQ-01** | **GPS Telemetry Interval Stability**: 1 Hz GPS arrivals must not restart the 2.5s batching timer. | Driver / Citizen | `roadguard-frontend/src/App.jsx` | `JourneyController.java` (`POST /api/v1/journeys/{id}/gps`) | `gps_points`, `V1__init_roadguard_schema.sql` | `gps_tracking_reproduction.test.mjs` (Scenario 1) | **PASS** | Decoupled interval effect using `[activeJourney?.id]` and `currentLocationRef`. |
| **REQ-02** | **Camera Inference Independence**: Frame capture and ONNX detection loop must continue executing independently of GPS arrivals. | Driver / Citizen | `roadguard-frontend/src/components/CameraViewfinder.jsx` | `EvidenceFrameController.java` (`POST /api/v1/journeys/{id}/frames`) | `evidence_frames`, `road_issues` | `camera_inference_stability.test.mjs` (Scenario 1) | **PASS** | `currentLocation` removed from camera effect dependencies; reads `currentLocationRef.current`. |
| **REQ-03** | **Truthful GPS Quality Gates**: Reject Null Island (0,0), coarse cell fixes (>50m), non-finite, and out-of-order packets. | Driver / Citizen | `roadguard-frontend/src/App.jsx` | `geoUtils.js` | N/A | `gps_tracking_reproduction.test.mjs` (Scenarios 4, 5, 6) | **PASS** | Gated inside `watchPosition`; sets `maximumAge: 0`. |
| **REQ-04** | **Underpass & Long Gap Recovery**: Moving >500m during an underpass must auto-recover and advance anchor instead of permanent route freeze. | Driver / Field Engineer | `roadguard-frontend/src/App.jsx` | `JourneyController.java` | `journeys`, `gps_points` | `gps_tracking_reproduction.test.mjs` (Scenario 3) | **PASS** | Speed-based velocity check (`stepDist / dtSec > 45 m/s`) distinguishes multipath spikes from real travel. |
| **REQ-05** | **Point 0 Persistence & Retry Buffer**: Initial location must be dispatched immediately; offline points buffered in bounded retry queue. | Driver / Citizen | `roadguard-frontend/src/App.jsx` | `JourneyController.java` | `gps_points` | `gps_tracking_reproduction.test.mjs` (Scenarios 8, 9, 10) | **PASS** | Point 0 pushed and flushed on first tick; queue bounded to 500 items. |
| **REQ-06** | **No-GPS Defect Detection**: Defect detection (warning triangle & screenshot) must operate even without GPS, flagging manual location required. | Citizen / Inspector | `roadguard-frontend/src/components/CameraViewfinder.jsx` | `RoadIssueController.java` | `V7__allow_manual_and_unlocated_issues.sql` | `camera_inference_stability.test.mjs` (Scenario 2) | **PASS** | Passes `null` coordinates and flags `manualLocationRequired: true`; never fabricates fake coordinates. |
| **REQ-07** | **Confirmed Complaints History Route**: `GET /api/v1/complaints/confirmed-history` returns HTTP 200 with `[]` when empty, avoiding regex collision with `/{id}`. | Citizen / Auditor | `roadguard-frontend/src/components/HistoryView.jsx` | `ComplaintController.java` | `complaints`, `automation_jobs` | `confirmedComplaintsHistory.test.mjs`, `ComplaintControllerTest.java` | **PASS** | `@GetMapping("/{id:[0-9]+}")` constrains numeric IDs; `/confirmed-history` mapped explicitly. |
| **REQ-08** | **Preserve Manual Map Recenter**: Manual Recenter button at zoom 16 must remain; auto-follow uses `panTo` to protect user zoom state. | Driver / Citizen | `roadguard-frontend/src/components/MapViewer.jsx` | N/A (Leaflet) | N/A | Manual UI audit & Leaflet tests | **PASS** | Preserved `handleRecenter` calling `setView([lat, lon], 16)`; background follow uses `panTo`. |
| **REQ-09** | **Truthful Government Portal Messaging**: No false claims of verified external government sessions; citizen OTP handoff explicitly stated. | Citizen / Legal | `roadguard-frontend/src/components/ProfileView.jsx` | `UserProfileController.java` | `user_profiles`, `V4__purge_demo_profile_and_align_portal_status.sql` | `ProfileView.jsx` source audit | **PASS** | Replaced "Status Verified & Retained" with "Portal Config Refreshed (Manual citizen OTP handoff required)". |
| **REQ-10** | **Multi-Tenant User Isolation & Safe Migrations**: Profile and journey data scoped strictly by user identity; no global `deleteAll()`; V1–V7 Flyway chain preserved. | DevOps / DBA | `roadguard-backend/.../service` | `UserProfileService.java`, `JourneyService.java` | `V1`–`V7` in `resources/db/migration/` | Flyway migration chain inspection | **PASS** | Rejected old foreign V3 migration; preserved V1–V7 history. |

---

## 2. Status Key
* **PASS**: Code implementation verified with automated tests and production build.
* **NOT TESTED**: Requires physical outdoor mobile drive with real satellite GNSS lock on public roads.
* **BLOCKED**: N/A (all previous platform/hook blockers resolved).
