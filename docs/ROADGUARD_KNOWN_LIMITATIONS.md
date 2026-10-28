# RoadGuard AI — Known Limitations & Field Testing Requirements

**Date**: 28 October 2026  
**Auditor**: Antigravity Core Engineering

---

## 1. Physical Hardware & Outdoor Limitations

1. **Browser Geolocation vs. Physical Satellite GNSS**:
   * Modern browser `navigator.geolocation` relies on OS-level location services. While `enableHighAccuracy: true` requests GPS hardware, indoor environments or low battery modes may silently fall back to Wi-Fi BSSID or cellular trilateration (20m–150m accuracy).
   * **Field Requirement**: A real outdoor mobile test mounted on a vehicle windshield with an open sky view is mandatory to achieve satellite lock with `<15m` accuracy.

2. **WebRTC & HTTPS Security Origin**:
   * Camera hardware access (`navigator.mediaDevices.getUserMedia`) is strictly blocked by modern browsers on insecure origins.
   * **Field Requirement**: The application must be served over `https://` (or `http://localhost` during development).

3. **Screen WakeLock API**:
   * Continuous dashcam recording requires the device screen to remain on. `navigator.wakeLock.request('screen')` is implemented, but if the device OS enters low-power battery-saver mode, the OS may throttle background timer intervals to 1 per minute.
   * **Field Requirement**: The driver must keep the RoadGuard PWA in the active foreground tab while driving.

---

## 2. Machine Learning & Detection Model Limitations

1. **Crowdsensed Road Damage Dataset (RDD2022)**:
   * RoadGuard's embedded model (`road_damage_yolo.onnx`) is trained to recognize standard road defect classes (D00: longitudinal crack, D10: lateral crack, D20: alligator crack, D40: pothole).
   * **Limitation**: Dark shadows, wet road surfaces reflecting sunlight, tree canopy patterns, and night driving without headlights can produce false positives. Claims of "100% field accuracy" are unscientific; edge real-time mAP across diverse lighting typically ranges from 68% to 84%.
   * **Mitigation**: Implemented human citizen review before any complaint can be submitted to an external authority.

2. **Temporal IoU Confirmation**:
   * To prevent a single pothole from creating multiple duplicate incident records across consecutive video frames (e.g. at 30 FPS or 2.5s intervals), a 3-second deduplication window is enforced.

---

## 3. Civic & Government Portal Integration Limitations

1. **External Authority Portals (e.g. AP Spandana, CPGRAMS, NHAI)**:
   * Government grievance portals do not expose open, unauthenticated REST APIs for third-party automated bot submissions. They enforce CAPTCHA, SMS OTP, and Aadhaar/citizen identity verification to prevent denial-of-service spam.
   * **System Safeguard**: RoadGuard prepares an official, standardized citizen grievance dossier with geotagged photo evidence, timestamp, and road jurisdiction details. The citizen approves and completes the final OTP/CAPTCHA step on the official portal.
