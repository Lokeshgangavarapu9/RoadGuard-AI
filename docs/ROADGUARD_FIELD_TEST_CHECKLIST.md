# RoadGuard AI — Practical Real-Road Field Test Checklist

## Safety Rules (Mandatory Before Starting)

> [!CAUTION]
> **SAFETY FIRST — NEVER INTERACT WITH APP WHILE OPERATING A VEHICLE**
>
> 1. Phone must be securely attached to a windshield or dashboard mount before driving.
> 2. The driver must NEVER touch, operate, or look at the phone screen while the vehicle is in motion.
> 3. Start drive mode while parked. If adjustments are needed, safely pull over and park first, or have a front-seat passenger/co-driver operate the interface.
> 4. Comply with all local traffic laws and Motor Vehicles Act provisions.

---

## 1. Pre-Drive Verification (Stationary / Parked)

- [ ] **Device Mounting**: Secure device firmly on phone mount facing road forward through the swept area of the windshield wipers.
- [ ] **Power & Battery**: Connect device to vehicle USB charger (camera and GPS inference will drain battery quickly).
- [ ] **Network Connectivity**: Confirm mobile data (4G/5G) is active. Hotspot latency <= 250ms.
- [ ] **Backend Health**: Verify top banner shows `Backend: Online` (`http://localhost:8080/api/v1/health` or Render production endpoint).
- [ ] **GPS Satellite Lock**:
  - [ ] Device location enabled in Android/iOS settings.
  - [ ] Browser location permission granted.
  - [ ] GPS accuracy indicator shows `<= 25m` (green pill).
  - [ ] If accuracy is `> 50m`, wait for satellite lock; do NOT start driving until accuracy is within safety threshold.
- [ ] **Camera Readiness**:
  - [ ] Camera permission granted.
  - [ ] Dashcam viewfinder shows live forward road surface clearly (lens clean, no dashboard glare/obstruction).
  - [ ] Rear camera selected (`facingMode: environment`).
- [ ] **Profile Setup**:
  - [ ] Citizen name, mobile number, and target municipality/ULB saved under `My Profile`.
  - [ ] Profile Readiness shows `Ready` or `Partially Ready` for local authority.

---

## 2. In-Drive Monitoring (Passenger Observed / Hands-Free)

- [ ] **Start Drive Mode**: Tap `Start Drive Mode` while vehicle is parked.
- [ ] **HUD Telemetry Verification**:
  - [ ] Top-left pill switches to `REC • LIVE ROAD CAMERA (X frames)`.
  - [ ] GPS speed chip tracks vehicle speedometer (e.g. `42 km/h`).
  - [ ] Compass heading chip updates dynamically during turns.
- [ ] **AI Defect Detection**:
  - [ ] Observe bounding boxes on potholes (`buraco`) or pavement cracks (`trinca_malha`).
  - [ ] Observe defect detection chime / status update: `Detected: Pothole (X%) — Frame #Y`.
  - [ ] Verify that clean road segments do NOT trigger false detections.
- [ ] **Network Interruption Resilience**:
  - [ ] Drive through a mobile blind spot or low-connectivity zone.
  - [ ] Verify frontend does NOT crash or lose existing journey points.
  - [ ] Verify in-flight requests gracefully back off and resume when cellular signal returns.

---

## 3. Post-Drive Review & Verification (Safely Parked)

- [ ] **Stop Drive Mode**: Tap `Stop Drive Mode` after coming to a complete stop.
- [ ] **Journey Report Audit**:
  - [ ] Confirm journey saved with total distance, elapsed duration, and analyzed frame count.
  - [ ] Review detected road issues list. Verify defect photo quality, GPS coordinates, and road name.
- [ ] **Grievance Preparation**:
  - [ ] Tap `Review Grievance Dossier` on a verified defect.
  - [ ] Verify routing authority matches road jurisdiction (e.g., NHAI for National Highways, Municipal Corporation for city streets).
  - [ ] Verify that citizen residential address is NOT included for highway complaints.
  - [ ] Confirm that vehicle registration number is NOT included for municipal complaints.
- [ ] **Human-in-the-Loop Submission**:
  - [ ] Confirm RoadGuard AI does NOT automatically submit without explicit citizen click.
  - [ ] For automated mock filing: Test OTP handoff (`582914`) and CAPTCHA resolution.
  - [ ] Verify complaint reference ID is captured truthfully and recorded in `Government Complaints` history tab.

---

## 4. STOP CONDITIONS (Immediately Abort Field Test If)

If any of the following occur, stop the field test immediately:

1. **Safety Risk**: Any distraction to the vehicle operator.
2. **False Success Claim**: App reports a complaint as "Submitted" or "Confirmed" when no genuine receipt was received.
3. **Data Loss**: Inspection frames or GPS points disappear without error notification.
4. **Incorrect Jurisdiction**: App attempts to route an urban municipal defect to NHAI or vice-versa.
5. **PII Leakage**: Sensitive credentials, passwords, or personal addresses appear in network logs or worker payloads.
6. **Duplicate Submission**: System attempts to re-submit an existing complaint after network timeout.
