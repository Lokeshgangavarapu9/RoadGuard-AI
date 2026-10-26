# RoadGuard AI — GPS-Independent Road Detection & Manual Location Pipeline

## 1. Executive Summary

RoadGuard AI decouples road defect vision from device geolocation telemetry. In previous versions, missing or uncalibrated GPS could stall camera frame capture, pause inference, or inject misleading fallback coordinates.

In this architecture:
1. **GPS Never Blocks AI Detection**: Frame capture, ONNX YOLO11s defect inference, incident creation, and evidence storage run completely uninterrupted regardless of GPS state.
2. **Explicit GPS Lifecycle Control**: GPS is `OFF` by default upon page load and requires explicit citizen activation. It never auto-starts or requests browser permissions unprompted.
3. **No Synthetic / Fallback Coordinates**: When GPS is absent, coarse (>50m), or stale (>30s), coordinates are strictly stored as `null`. Fabricated fallbacks (such as Vijayawada coordinates) have been eliminated.
4. **Transparent Location Provenance**: Defects detected without valid GPS are recorded with `locationSource = 'MANUAL_LOCATION_REQUIRED'`. Citizens can review and provide accurate civic location details (`MANUAL_ENTRY`) before filing complaints with government authorities.
5. **Government Redressal Safeguards**: Complaint filing is blocked until location details are supplied, preventing invalid submissions to statutory portals (NHAI Rajmargyatra or AP CDMA).

---

## 2. Core Subsystem Architecture

```
+-----------------------------------------------------------------------------------+
|                              CITIZEN DASHBOARD (React)                           |
+-----------------------------------------------------------------------------------+
       |                                                               |
  [GPS ON/OFF]                                                    [START CAMERA]
       |                                                               |
       v                                                               v
+----------------------+                                      +---------------------+
| Geolocation Watcher  |                                      | Camera Viewfinder   |
| (Disabled by default)|                                      | & Frame Capture     |
+----------------------+                                      +---------------------+
       |                                                               |
       | (lat/lon if accurate <=50m & fresh <30s, else null)          | (1 frame/sec)
       +-------------------------------+-------------------------------+
                                       |
                                       v
                     +-----------------------------------+
                     |      Backend Inference Service    |
                     |         (Spring Boot 3.3.5)       |
                     +-----------------------------------+
                                       |
                       +---------------+---------------+
                       |                               |
                   [GPS Present]                 [GPS Absent / Null]
                       |                               |
                       v                               v
             latitude = lat, lon             latitude = null, lon = null
             locationSource =                locationSource =
             'GPS_TELEMETRY'                 'MANUAL_LOCATION_REQUIRED'
                       \                               /
                        \                             /
                         v                           v
                       +-------------------------------+
                       |       Database (H2 / PG)      |
                       |       road_issues table       |
                       +-------------------------------+
                                       |
                       +---------------+---------------+
                       |                               |
                       v                               v
              [GPS Verified Defect]           [Manual Location Form]
              Ready for immediate             Requires Road Name,
              jurisdiction routing.           City, District, State.
                       |                               |
                       |                     PUT /api/v1/issues/{id}/location
                       |                               |
                       |                               v
                       |                      locationSource =
                       |                      'MANUAL_ENTRY'
                       \                               /
                        \                             /
                         v                           v
                       +-------------------------------+
                       |  Statutory Complaint Redressal|
                       | (NHAI / AP CDMA / Playwright) |
                       +-------------------------------+
```

---

## 3. GPS State Machine Specifications

The GPS tracking system transitions across 5 clearly delineated states:

| State | UI Display | Indicator | Trigger | System Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **`GPS OFF`** | `GPS: OFF` | Slate `#94a3b8` | Default on load, or user toggled off | Active watcher cleared (`navigator.geolocation.clearWatch`); coordinates cleared; zero coordinate polling. |
| **`GPS CONNECTING`** | `GPS: CONNECTING` | Sky Blue `#38bdf8` | User clicked `GPS: OFF` button | Browser permission requested; single watcher started (`watchPosition`); high accuracy enabled. |
| **`GPS ACTIVE`** | `GPS: ACTIVE` | Neon Emerald `#00f5a0` | Satellite lock acquired with accuracy $\le 50\text{ m}$ | Coordinates attached to captured frames; vehicle position rendered on map; accuracy circle displayed. |
| **`GPS ACTIVE (STALE)`** | `GPS: ACTIVE (STALE)` | Amber `#f59e0b` | Fix older than 20 seconds | Map marker indicates stale status; accuracy circle warning; frames tagged with `null` if $>30\text{ s}$. |
| **`GPS ERROR` / `DENIED`**| `GPS: ERROR` / `DENIED` | Crimson `#ef4444` | Permission denied or hardware timeout | Notification displayed; camera and detection continue unaffected in manual location mode. |

---

## 4. Coordinate Sanitization & Accuracy Standards

To protect against faulty GPS multipath, urban canyon errors, and misleading location reports:

1. **Max Permissible Inaccuracy**: $50\text{ meters}$.
   - If `position.coords.accuracy > 50`, coordinates are discarded from defect tagging (`sanitizedLat = null`, `sanitizedLon = null`).
2. **Staleness Threshold**: $30\text{ seconds}$.
   - If the last GPS fix timestamp is $>30,000\text{ ms}$ old, coordinates are treated as expired and set to `null`.
3. **WGS84 Boundary Checks**:
   - $\text{Latitude} \in [-90.0, 90.0]$
   - $\text{Longitude} \in [-180.0, 180.0]$
   - Coordinates failing numeric bounds, `NaN`, or `null` are rejected.

---

## 5. Manual Location Workflow & Provenance

When road defects are detected while GPS is offline, RoadGuard AI guarantees complete civic traceability:

### Backend Schema (`road_issues` table)
- `latitude`: `DOUBLE PRECISION NULL` (nullable per Flyway migration `V7`)
- `longitude`: `DOUBLE PRECISION NULL` (nullable per Flyway migration `V7`)
- `location_source`: `VARCHAR(40)` (`GPS_TELEMETRY`, `MANUAL_LOCATION_REQUIRED`, `MANUAL_ENTRY`)
- `road_name`: `VARCHAR(255)`
- `city_or_town`: `VARCHAR(100)`
- `district`: `VARCHAR(100)`
- `state`: `VARCHAR(100)`
- `pincode`: `VARCHAR(10)`

### REST API Endpoints
- **Update Defect Location**: `PUT /api/v1/issues/{id}/location`
  ```json
  {
    "roadName": "NH-16 Benz Circle Flyover",
    "cityOrTown": "Vijayawada",
    "district": "NTR District",
    "state": "Andhra Pradesh",
    "pincode": "520010",
    "latitude": 16.5062,
    "longitude": 80.6480
  }
  ```
- **Response**: Returns updated issue with `locationSource: "MANUAL_ENTRY"` and recalculated authority jurisdiction (e.g. `NHAI` for national highways, `AP_CDMA` for municipal corridors).

---

## 6. Verification and Test Proof

| Test Domain | Target Suite | Status | Proof |
| :--- | :--- | :--- | :--- |
| **Database Migrations** | `DatabaseMigrationTest` | **PASSED** | 9/9 unit tests passed; Flyway applied `V1` through `V7` cleanly. |
| **Frontend Unit Tests** | `node --test src/test/*.test.mjs` | **PASSED** | 17/17 unit tests passed across 6 test suites with 0 failures. |
| **Production Build** | `npm run build` (Vite) | **PASSED** | 2,190 modules transformed; bundle generated cleanly in `10.51s`. |
| **Location Validation** | `gpsIndependentDetection.test.mjs` | **PASSED** | Validated coordinate sanitization, boundary limits, and provenance states. |
