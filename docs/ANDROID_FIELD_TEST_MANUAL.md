# RoadGuard AI — Safe Android Field-Testing & Sensor Verification Manual

**Document Version:** 1.0.0  
**Target Platform:** Android Chrome / Edge Mobile Browser (HTTPS or localhost port-forwarding)  
**Safety Protocol:** Passenger or stationary operator ONLY. Never operate while driving.

---

## 1. Network & Origin Requirements for Mobile Geolocation & Camera

Modern mobile browsers (Chrome / Android WebView) enforce strict security policies:

1. **Secure Origin Required**:
   - `navigator.mediaDevices.getUserMedia` and `navigator.geolocation` are **blocked on insecure HTTP origins** (e.g. `http://192.168.1.x:5173`).
   - For local field testing on an Android phone, use either:
     - **Option A (Recommended for Local Dev)**: Chrome USB Remote Debugging with Port Forwarding (`chrome://inspect/#devices` -> forward port `5173` to `localhost:5173` on phone). On the phone, navigate to `http://localhost:5173`. Android treats `localhost` as a secure origin!
     - **Option B (Recommended for Real Driving)**: Deployed HTTPS instance (e.g. Vercel / Render with valid SSL certificate).

---

## 2. Test Plan A — GPS Geolocation & Map Marker Truthfulness

### Test Plan A Objective

Verify that RoadGuard AI acquires genuine browser GPS coordinates, validates them, rejects fake fallback markers, and displays stale status truthfully.

### Test Plan A Procedure

1. **Grant Permission**:
   - Open RoadGuard AI on Android Chrome.
   - When prompted, tap **"Allow while using app"** for Location.

2. **Side-by-Side Verification with Google Maps**:
   - Open Google Maps in split-screen or switch back and forth.
   - Note the blue dot position in Google Maps (e.g. near Ravela, Andhra Pradesh: ~`16.425° N, 80.451° E`).
   - In RoadGuard AI, check the **System Diagnostics & Telemetry** panel:
     - **GPS Receiver Status**: Should show `LOCKED (±Xm)`.
     - **Coordinates**: Must match your real location within reported accuracy (e.g. `16.425xx°N, 80.451xx°E`).
     - **Current Marker**: Leaflet vehicle icon must be placed directly at your real GPS coordinate, NOT at Vijayawada corridor (`16.5062, 80.6480`).

3. **Stationary Jitter & Movement Test**:
   - While stationary, observe the speed chip: should read `-- km/h` or `0 km/h`.
   - Walk or drive a short distance (safely operated by passenger):
     - The vehicle icon must rotate towards your heading.
     - Breadcrumb trail must update without jumping or creating erratic zig-zags (Haversine filter suppresses jumps >500m and noise <2m).

4. **Failure & Timeout Simulation**:
   - Go into Android Settings -> Disable Location Services (or revoke location permission in Chrome Site Settings).
   - In RoadGuard AI:
     - The GPS status must transition to `DENIED` or `UNAVAILABLE`.
     - A non-blocking banner must appear: `"Location permission denied"` or `"Searching for GPS satellite lock"`.
     - **CRITICAL CHECK**: Verify that NO fake or mock vehicle location marker is invented. The map displays the area with an explicit notice: `"Awaiting genuine GPS fix • Default corridor viewport shown"`.

5. **Freshness & Stale Fix Test**:
   - Re-enable GPS and acquire lock.
   - Enter an underground basement or elevator where GPS drops.
   - After 20 seconds without satellite updates:
     - The marker transitions to amber/yellow.
     - Popup and HUD chip show `"Stale GPS Position (Xs ago)"` instead of claiming live fix.

---

## 3. Test Plan B — Camera Lifecycle & Stop Control

### Test Plan B Objective

Verify that the camera starts smoothly, stops immediately on demand, releases hardware tracks, and can be restarted without reloading the page.

### Test Plan B Procedure

1. **Start Camera**:
   - In the Live Road Camera panel or the Drive Controls bar, tap **Start Camera**.
   - Tap **"Allow"** on the browser camera permission dialog.
   - **Verification**:
     - Viewfinder changes from dark card to live video feed from the rear environment camera.
     - Status badge turns green: `LIVE CAMERA ACTIVE`.
     - Prominent red **Stop Camera** button appears in the HUD and drive bar.

2. **Stop Camera (Single Tap)**:
   - Tap **Stop Camera**.
   - **Verification**:
     - Live video feed disappears immediately.
     - Phone camera indicator light / dot in Android status bar turns OFF immediately.
     - Hardware tracks are stopped; video element is paused and set to null.
     - Status updates cleanly to `CAMERA OFF` / `Live Dashcam Viewfinder`.
     - No frame capture or upload requests are sent in the network tab.

3. **Restart Camera Without Reloading**:
   - Tap **Start Camera** again.
   - **Verification**:
     - Live camera stream starts right away without needing to refresh or reload the web page.

4. **Stop During Permission Prompt (Race Condition Guard)**:
   - Tap **Start Camera**.
   - While the browser is showing the permission dialog or before video plays, tap **Cancel** or **Stop Camera**.
   - **Verification**:
     - The camera stream is discarded upon resolution. The camera hardware is released immediately and does NOT remain open in the background.

---

## 4. Test Plan C — Driving Mode & Camera Independence

### Test Plan C Objective

Verify that Driving Mode and Camera are decoupled: the user can start driving with or without camera, stop the camera while driving, and stop Driving Mode cleanly.

### Test Plan C Procedure

1. **Start Drive Mode Without Camera**:
   - With camera OFF, tap **Start Drive Mode**.
   - **Verification**:
     - Drive Mode starts successfully in GPS-only route tracking mode.
     - Status displays: `"Drive Mode Active: Journey #X • GPS Route Tracking active (Camera is stopped)"`.
     - Distance and elapsed time increment as the vehicle moves.

2. **Start Camera While Driving**:
   - While Drive Mode is running, tap **Start Camera** in the Drive Controls bar.
   - **Verification**:
     - Camera starts and displays rear road view.
     - ONNX defect detection activates automatically.
     - Status banner updates: `"REC • LIVE CAMERA"`.

3. **Stop Camera While Driving**:
   - Tap **Stop Camera** in the Drive Controls bar.
   - **Verification**:
     - Camera hardware shuts down, viewfinder displays `"Driving Mode active — Camera stopped"`.
     - Inference stops immediately (no new frames captured or sent).
     - **GPS tracking continues undisturbed**: distance counter keeps accumulating, GPS breadcrumbs continue drawing on the map.

4. **Stop Drive Mode**:
   - Tap **Stop Drive Mode**.
   - **Verification**:
     - Drive Mode stops cleanly.
     - Journey completion banner appears with verified distance and frame counts.
     - Summary report is saved to backend.

---

## 5. Driver Safety & Compliance Rules

> [!CAUTION]
> **ROAD SAFETY DIRECTIVE**:
>
> 1. Never interact with the device while operating a moving motorcycle, car, or truck.
> 2. Mount the device in a secure phone holder before driving.
> 3. All start/stop actions must be performed while parked safely on the shoulder or by a designated passenger/co-driver.
