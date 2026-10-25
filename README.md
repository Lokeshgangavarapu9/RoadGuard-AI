# RoadGuard AI — Intelligent Road Monitoring & Grievance Management System

**RoadGuard AI** is a mobile-first, AI-assisted road safety and public grievance management platform designed for Andhra Pradesh and National Highway corridors.

It bridges the gap between genuine road defect detection (potholes, alligator cracking, transverse cracks) and government accountability by integrating real-time telemetry, computer vision inference via Microsoft ONNX Runtime, deterministic statutory authority routing, contractor Defect Liability Period (DLP) tracking, and automated legal grievance generation.

---

## Architecture Overview

```text
                      ┌────────────────────────────────────────┐
                      │    Mobile Viewfinder & Leaflet Map     │
                      │        (React 19 + Vite 8)             │
                      └──────────────────┬─────────────────────┘
                                         │ HTTP / REST
                                         ▼
                      ┌────────────────────────────────────────┐
                      │      RoadGuard Spring Boot Backend     │
                      │               (Java 26)                │
                      └────┬─────────────┬─────────────────┬───┘
                           │             │                 │
                           ▼             ▼                 ▼
                     ┌───────────┐ ┌───────────┐     ┌───────────┐
                     │ Flyway/H2 │ │ Evidence  │     │ ONNX AI   │
                     │ Database  │ │ Storage   │     │ Inference │
                     └───────────┘ └───────────┘     └───────────┘
```

### 1. Computer Vision & Inference Pipeline (`InferenceService.java`)

- **Runtime**: Microsoft ONNX Runtime Java (`com.microsoft.onnxruntime:onnxruntime:1.19.0`).
- **Deep Learning Model**: Ultralytics YOLO11s fine-tuned on the multi-national Road Damage Dataset (RDD2022) across 7 countries and Roboflow pavement distress datasets.
- **Repository**: `Kodjaoglanian/pavimentos-yolo11s` on Hugging Face.
- **License**: AGPL-3.0.
- **Tensor Input**: `images` tensor of shape `[1, 3, 512, 512]` in RGB format with floating-point pixel values normalized to `[0.0, 1.0]`.
- **Tensor Output**: `output0` tensor of shape `[1, 9, 5376]` containing center coordinates, width, height, and class probabilities across 5,376 candidate anchors.
- **Defect Classes**:
  - Class 0: `buraco` &rarr; `RoadIssue.DefectClass.POTHOLE`
  - Class 1: `trinca_longitudinal` &rarr; `RoadIssue.DefectClass.ROAD_CRACK`
  - Class 2: `trinca_transversal` &rarr; `RoadIssue.DefectClass.TRANSVERSE_CRACK`
  - Class 3: `trinca_malha` &rarr; `RoadIssue.DefectClass.ALLIGATOR_CRACK`
  - Class 4: `tampa_bueiro` (manhole cover — filtered out as normal utility infrastructure)
- **Post-Processing**: Greedy Non-Maximum Suppression (NMS) with an IoU threshold of 0.45 and configurable confidence threshold (default: 0.25).
- **Temporal Confirmation**: Rolling queue per journey (`windowSize=4`, `minConfirmations=2`) to eliminate transient false positives before creating confirmed `RoadIssue` entities.

### 2. Backend Service (`roadguard-backend`)

- **Runtime & Framework**: Java 26, Spring Boot 3.3.5, Spring Data JPA, Hibernate ORM 6.5.
- **Database & Migration**: Flyway v1 baseline with H2 in-memory mode (Stage A PostgreSQL compatibility dialect).
- **Evidence Integrity**: SHA-256 cryptographic hashing of uploaded frames and privacy-blur watermarking.
- **Geospatial Deduplication**: Haversine spherical distance calculation with a 15-meter spatial clustering threshold.
- **Authority & Tender Investigation Engine**:
  - Deterministic authority resolution for Andhra Pradesh:
    - `NHAI`: National Highways Authority of India (NH-prefix highways)
    - `AP_RNB`: Andhra Pradesh Roads & Buildings Department (State Highways & Major District Roads)
    - `CDMA_ULB`: Urban Local Bodies & Municipal Corporations (Vijayawada, Visakhapatnam, Guntur)
    - `AP_PRED_PMGSY`: Panchayat Raj Engineering Department (Rural PMGSY corridors)
  - Defect Liability Period (DLP) check: Cross-references public tender agreements to determine whether a private contractor is legally bound to repair defects at zero public expense.
- **Statutory Grievance Formulator**: Auto-drafts formal citizen petitions with exact legal grounds:
  - Section 133 of the Code of Criminal Procedure (Public Nuisance & Road Hazard Removal)
  - IRC:82-2015 & IRC:SP:84 Guidelines for Highway Maintenance
  - Stage A Simulated Watermark receipt: `SIM-AP-PGRS-2026-XXXXX`

### 3. Mobile-First Frontend (`roadguard-frontend`)

- **Stack**: React 19, Vite 8, Leaflet, MapLibre GL JS, jsPDF, Lucide React, Canvas Confetti.
- **Mobile HUD Viewfinder**:
  - Dual-mode operation: **Live Mobile Camera (`getUserMedia`)** or **NH-16 Synthetic Demo Replay**.
  - Heads-Up Display (HUD): Speedometer (km/h or mph), compass heading, GPS accuracy, and real-time ONNX bounding box overlays.
  - *Browser Limitation Note*: Mobile browsers throttle or suspend camera and GPS background execution when tabs are hidden or the screen locks. Continuous monitoring requires an active foreground tab (Screen Wake Lock API integrated for mobile field runs).
- **Interactive Geospatial Map (2D Leaflet)**:
  - OpenStreetMap standard raster tiles with `© OpenStreetMap contributors` attribution (clean, no broken watermark).
  - Live user location marker with pulsating radar halo, heading indicator, and GPS accuracy radius circle.
  - Start ('S', green) and End ('E', red) journey markers.
  - Persistent real-time route polyline connecting recorded GPS coordinates.
  - Geodesic noise filtering: ignores stationary jitter (<2m) and implausible glitches (>500m).
  - Floating auto-follow & recenter button.
  - Color-coded defect pins: Potholes (Crimson), Cracks (Amber), Waterlogging (Cyan).
- **Lightweight 3D Route Visualisation (MapLibre GL JS)**:
  - Optional 3D tilt (60° pitch) and camera rotation in Journey Reports view.
  - WebGL hardware-accelerated route trace and defect markers without heavyweight 3D engine overhead.
  - Seamless fallback to 2D Leaflet map if WebGL is unavailable.
- **Dedicated Journey Reports & PDF Export**:
  - Full audit trail of completed journeys: start/end timestamps, coordinates, total distance, duration, frames analyzed, and defect counts.
  - Interactive defect timeline linked to actual stored evidence photos.
  - One-click PDF Journey Report export with official `SIMULATED DEMONSTRATION` disclaimer.
- **6-Destination Hamburger Navigation Drawer**:
  1. `New Map / Live Monitoring` (`dashboard`)
  2. `Detected Road Issues` (`issues`)
  3. `Journey History` (`journeys`)
  4. `Journey Reports` (`reports`)
  5. `Settings` (`settings`)
  6. `Help & About` (`about`)
- **Subsystem Diagnostics Strip**:
  - Real-time separate status indicators for Backend, Database (H2), AI Vision (YOLO11s ONNX), GPS Sensors, Road Camera, and Maps Engine (Leaflet + OSM).
- **Settings & Preference Persistence**:
  - Configurable parameters persisted via browser `localStorage`: Speed/Distance units (`METRIC` / `IMPERIAL`), interface theme, frame interval, stationary pause grace period, GPS accuracy threshold, and local UI cache reset.

---

## Configuration & Setup

### Model Weights Installation

The pretrained YOLO ONNX model weights (`37.8 MB`) are placed in `roadguard-backend/models/road_damage_yolo.onnx`:

```powershell
# 1. Create models directory
New-Item -ItemType Directory -Force -Path "roadguard-backend\models"

# 2. Download verified model from Hugging Face
Invoke-WebRequest -Uri "https://huggingface.co/Kodjaoglanian/pavimentos-yolo11s/resolve/main/best.onnx" `
    -OutFile "roadguard-backend\models\road_damage_yolo.onnx"
```

Verify model integrity:

- **File size**: 37,873,634 bytes
- **SHA-256**: `E5284300D75F57890487C52A0428578B9A6803DF1FD0A1B9F83A30CB3972D0CA`

### Application Configuration (`application.properties`)

```properties
# AI Inference
roadguard.inference.mode=ONNX
roadguard.inference.onnx.model-path=./models/road_damage_yolo.onnx
roadguard.inference.confidence-threshold=0.25
roadguard.inference.temporal.window-size=4
roadguard.inference.temporal.min-confirmations=2

# Deduplication
roadguard.geospatial.dedup-radius-metres=15.0
```

If the ONNX model file is missing at startup, the system gracefully logs `MODEL NOT CONFIGURED` and reports `"modelStatus": "MODEL NOT CONFIGURED"` via `/api/v1/health`.

---

## Startup Commands

### 1. Run the Spring Boot Backend

```powershell
cd "C:\Users\LOKESH\java project 2026\roadguard-backend"
$env:JAVA_HOME = "C:\Program Files\Java\jdk-26.0.1"
.\mvnw.cmd spring-boot:run
```

- API Base: `http://localhost:8080/api/v1`
- Health Check: `http://localhost:8080/api/v1/health`
- H2 Console: `http://localhost:8080/h2-console` (JDBC URL: `jdbc:h2:mem:roadguarddb`, User: `sa`)

### 2. Run the Frontend Development Server

```powershell
cd "C:\Users\LOKESH\java project 2026\roadguard-frontend"
npm run dev
```

- Web Application: `http://localhost:5173`
- Mapping Provider: OpenStreetMap Standard Raster (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`)
- Responsive Navigation: 6-destination drawer (Live Monitoring, Detected Issues, Journey History, Journey Reports, Settings, Help & About)

### 3. Run Automated End-to-End Validation

```powershell
cd "C:\Users\LOKESH\java project 2026"
powershell.exe -ExecutionPolicy Bypass -File .\test_full_verification.ps1
```

---

## Primary API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Returns service status, active `inferenceMode`, and `modelStatus` (`LOADED` / `MODEL NOT CONFIGURED`) |
| `GET` | `/api/v1/stats` | System metrics (total frames, potholes, cracks, filings) |
| `POST` | `/api/v1/journeys` | Start a new road monitoring journey |
| `POST` | `/api/v1/journeys/{id}/stop` | Stop an active journey, save final coordinates and calculate Haversine distance |
| `GET` | `/api/v1/journeys/{id}` | Retrieve completed journey details with persisted distance and defect counts |
| `POST` | `/api/v1/journeys/{id}/gps` | Ingest batched GPS telemetry points |
| `GET` | `/api/v1/journeys/{id}/gps` | Retrieve complete recorded GPS trace for route polyline |
| `POST` | `/api/v1/journeys/{id}/frames` | Multipart upload of camera evidence frames; executes ONNX inference and returns detected bounding boxes |
| `GET` | `/uploads/evidence/...` | Direct HTTP 200 static image serving with SHA-256 verification |
| `GET` | `/api/v1/issues` | List confirmed, deduplicated road defects with coordinates for Leaflet map markers |
| `POST` | `/api/v1/issues/{id}/investigate` | Resolve responsible authority and contractor DLP |
| `POST` | `/api/v1/complaints/auto-draft` | Auto-generate legal grievance petition |
| `POST` | `/api/v1/complaints/{id}/simulate` | Simulate Stage A submission with regulatory receipt and disclaimer |
| `GET` | `/api/v1/authorities` | List Andhra Pradesh road maintenance authorities |

---

## Real vs. Simulated Subsystem Summary

| Subsystem | Status | Details |
| --- | --- | --- |
| **Defect Detection** | **VERIFIED WORKING** | YOLO11s ONNX model running in Java (`models/road_damage_yolo.onnx`); genuine bounding boxes, 100% precision, F1: 72.7%. |
| **Evidence Storage** | **VERIFIED WORKING** | True image decoding, bilinear tensor conversion, SHA-256 digest computation, filesystem persistence, static HTTP 200 image serving. |
| **Temporal Confirmation** | **VERIFIED WORKING** | Evaluates consecutive genuine ONNX observations (2 of 4 frames required). |
| **GPS Telemetry & Route** | **VERIFIED WORKING** | Ingested via REST, persisted in H2, rendered as progressive polyline, geodesic distance computed. |
| **2D Map & Geolocation** | **VERIFIED WORKING** | Leaflet with OpenStreetMap raster tiles, browser geolocation watcher, accuracy circle, recenter/auto-follow. |
| **3D Route Visualisation** | **VERIFIED WORKING** | MapLibre GL JS with 60° tilt and rotation in Journey Reports view. |
| **PDF Report Generation**| **VERIFIED WORKING** | jsPDF dynamic generation with summary, defect list, GPS summary, and disclaimer. |
| **Settings & Units** | **VERIFIED WORKING** | Persisted in `localStorage`; dynamically formats speed/distance in Metric or Imperial. |
| **Geospatial Deduplication** | **VERIFIED WORKING** | Haversine formula within 15-meter clustering radius. |
| **Authority Jurisdiction** | **HEURISTIC** | Route name substring matching against 4 Andhra Pradesh road agencies. |
| **Grievance Redressal** | **SIMULATED** | Pre-formulated legal notice; simulated submission reference number; **NO real government submission** during testing. |

---

## Model Licensing & Restrictions

- **Model License**: `AGPL-3.0 License (https://ultralytics.com/license)`
- **License Restrictions**:
  - The model was trained with Ultralytics YOLO11 software and exported under the GNU Affero General Public License v3.0 (AGPL-3.0).
  - **Network Copyleft Requirement**: If RoadGuard AI is hosted over a network or provided as a SaaS/cloud service, the complete corresponding source code (including backend inference logic) must be made available to network users under AGPL-3.0, unless a commercial enterprise license is acquired from Ultralytics.
  - Commercial closed-source redistribution without code disclosure is prohibited under AGPL-3.0.

---

## Verification Audit Matrix (PASS / FAIL / NOT VERIFIED)

| Section | Audit Criteria | Result | Notes |
| --- | --- | --- | --- |
| **1. Model Verification** | Model file exists, size (37,873,634 bytes), SHA-256 `E5284300D75F...` verified | **PASS** | ONNX Runtime loads and executes; input: `[1,3,512,512]`, output: `[1,9,5376]`, AGPL-3.0 documented. |
| **2. Threshold & Post-Processing** | 0.25 production threshold verified; class-aware NMS | **PASS** | Evaluated in `OnnxInferenceRunnerTest`. Potholes pass at 49.9%, 40.1%, 31.8%. |
| **3. 9-Image Evaluation Benchmark** | Dimensions, SHA-256, defect ground-truth verified across 9 authentic images | **PASS** | Clean: 2, Potholes: 3, Cracks: 4 from Wikimedia Commons, DarshanM0di, and Kodjaoglanian datasets. |
| **4. Empirical Detection Metrics** | Precision, recall, and F1 measured under production 0.25 threshold | **PASS** | Precision: **100.0%**, Clean Specificity: **100.0%**, Pothole Recall: **66.7%**, Crack Recall: **50.0%**, Overall F1: **72.7%**. |
| **5. REST API Live Inference** | Real upload returns genuine ONNX detections; dynamic `/api/v1/health` status | **PASS** | `POST /api/v1/journeys/{id}/frames` with `eval_potholes_road.jpg` returned 2 potholes (`REAL_ONNX`). |
| **6. Distance & End State** | Distance and end coordinates persisted on stop | **PASS** | `distance_meters`, `end_latitude`, `end_longitude` added to DB and returned on `GET /api/v1/journeys/{id}`. |
| **7. Multi-Frame Temporal Window** | Sequential frames confirm defects over rolling window | **PASS** | Verified via `testVideoFrameSequenceTemporalConfirmation` (4-frame window, 2 min hits). |
| **8. Real Browser Automation Suite** | Automated Edge browser execution across all 12 flows via `playwright-core` | **PASS** | All 12 browser suites passed: console clean, OSM tiles loaded, 6 nav destinations, PDF exported, responsive layouts verified. |
| **9. Journey Reports & 3D Map** | 2D/3D map review and PDF download | **PASS** | Verified in `JourneyReportsView.jsx` with Leaflet, MapLibre GL, and jsPDF (`RoadGuard_Journey_Report_21.pdf`, 6,780 bytes). |
| **10. Navigation & UI Consistency** | 6-destination responsive drawer, dark dashboard | **PASS** | All 6 destinations wired; developer labels removed from header; mobile drawer accessible. |
| **11. Settings Persistence** | Settings affect behavior and persist across reloads | **PASS** | Persisted in `localStorage`; unit switching (Metric/Imperial) dynamically formats distance displays. |
| **12. Grievance Workflow** | Simulated references (`SIM-AP-PGRS-2026-XXXXX`); visible watermark disclaimer preserved | **PASS** | Warning: `SIMULATED DEMONSTRATION — NOT SUBMITTED TO ANY GOVERNMENT AUTHORITY`. |
| **13. Mobile Viewport Layout** | Desktop (1280x800) and Mobile (390x844) viewport responsiveness | **PASS** | Verified in real browser automation: zero horizontal overflow on both desktop and iPhone 13 viewports. |
| **14. Mobile Background Sensors** | Background frame capture while phone locked | **NOT VERIFIED (Browser Limitation)** | Mobile operating systems throttle background JS and camera streams. Foreground mode required. |
| **15. Physical Hardware GPS Drive** | Moving vehicle on physical highway with hardware satellite fix | **NOT VERIFIED (Physical Hardware Required)** | Tested deterministically with recorded NH-16 GPS trace; genuine outdoor vehicle drive test requires physical hardware. |
| **16. Production Database Store** | In-memory H2 database vs durable PostGIS store | **STAGE A IN-MEMORY** | H2 in-memory resets on restart; PostGIS migration planned for Stage B. |

---

## Complete Documentation Index

* [Portal Research & Government Channels](file:///c:/Users/LOKESH/java%20project%202026/docs/PORTAL_RESEARCH.md) — Live inspection of NHAI Rajmargyatra, AP CDMA, and AP Mee Kosam PGRS.
* [Open-Source Components & License Audits](file:///c:/Users/LOKESH/java%20project%202026/docs/OPEN_SOURCE_REUSE.md) — Reuse analysis for `pothole-reporter`, Leaflet, MapLibre GL, OSRM, Nominatim, and YOLO11s.
* [Camera & GPS Verification Protocol](file:///c:/Users/LOKESH/java%20project%202026/docs/CAMERA_GPS_VERIFICATION.md) — Real sensor acquisition, noise filtering, and 10-step outdoor Android checklist.
* [Statutory Complaint Submission Workflow](file:///c:/Users/LOKESH/java%20project%202026/docs/COMPLAINT_SUBMISSION_WORKFLOW.md) — Section 133 CrPC / IRC:82-2015 grounds, evidence dossier, and citizen assisted handoff.
* [System Status & Verification Audit Report](file:///c:/Users/LOKESH/java%20project%202026/PROJECT_STATUS.md) — Full verification matrix, benchmark metrics, and browser automation test results.

---

## Running RoadGuard AI Locally

### Prerequisites
* **Java 21+** (Tested with Java 26.0.1 HotSpot 64-Bit)
* **Node.js 18+** (Tested with Node.js v24)
* **Microsoft Edge** or **Google Chrome** (for browser testing)

### 1. Start the Java Spring Boot Backend (Port 8080)
```powershell
cd "c:\Users\LOKESH\java project 2026\roadguard-backend"
$env:JAVA_HOME = "C:\Program Files\Java\jdk-26.0.1"
.\mvnw.cmd spring-boot:run
```
* Health Endpoint: `http://localhost:8080/api/v1/health`
* H2 Database Console: `http://localhost:8080/h2-console` (JDBC URL: `jdbc:h2:mem:roadguarddb`, User: `sa`, Password: empty)

### 2. Start the React + Vite Frontend (Port 5173)
```powershell
cd "c:\Users\LOKESH\java project 2026\roadguard-frontend"
npm run dev -- --host
```
* Web Dashboard: `http://localhost:5173/`

### 3. Run Automated Test & Verification Suites
```powershell
# A. Java Backend JUnit & Benchmark Tests
cd "c:\Users\LOKESH\java project 2026\roadguard-backend"
$env:JAVA_HOME = "C:\Program Files\Java\jdk-26.0.1"
.\mvnw.cmd test

# B. Frontend Production Build
cd "..\roadguard-frontend"
npm run build

# C. Automated Real Browser Verification Suite (Playwright on Microsoft Edge)
node test_browser_comprehensive.cjs

# D. Full End-to-End REST API Test Suite
cd ".."
powershell.exe -ExecutionPolicy Bypass -File .\test_full_verification.ps1
```
