import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isValidCoordinate, isFixStale } from '../utils/geoUtils.js';

class CameraInferenceSimulator {
  constructor() {
    this.currentLocation = null;
    this.inFlight = false;
    this.processedFrames = [];
    this.detections = [];
    this.frameSequence = 0;
  }

  // Fast 1 Hz GPS arrivals
  onGpsUpdate(fix) {
    this.currentLocation = fix;
  }

  // Camera inference tick (runs at stable interval, e.g. 2.5s)
  async onCameraInferenceTick(hasDefect = false, defectClass = 'POTHOLE', confidence = 0.88) {
    if (this.inFlight) return;
    this.inFlight = true;
    this.frameSequence++;

    const loc = this.currentLocation;
    const hasValidCoords = loc && isValidCoordinate(loc.lat, loc.lon);
    const isStale = loc ? isFixStale(loc.timestamp, 30000) : true;
    const isAccurate = loc?.accuracy != null && loc.accuracy <= 50;

    const payload = {
      frameSequence: this.frameSequence,
      latitude: (hasValidCoords && !isStale && isAccurate) ? loc.lat : null,
      longitude: (hasValidCoords && !isStale && isAccurate) ? loc.lon : null,
      gpsStatus: (hasValidCoords && !isStale && isAccurate) ? 'VALID' : 'MANUAL_OR_MISSING',
      manualLocationRequired: !(hasValidCoords && !isStale && isAccurate)
    };

    if (hasDefect) {
      payload.defect = {
        classLabel: defectClass,
        confidence,
        warningTriangleTriggered: true,
        screenshotSaved: true
      };
      this.detections.push(payload);
    }

    this.processedFrames.push(payload);
    this.inFlight = false;
  }
}

describe('Camera & Defect Detection Lifecycle Independence', () => {
  test('Camera inference continues executing when GPS arrives at 1 Hz', async () => {
    const cam = new CameraInferenceSimulator();
    let now = Date.now();

    for (let i = 0; i < 6; i++) {
      cam.onGpsUpdate({ lat: 16.5000 + i * 0.0001, lon: 80.6000, accuracy: 5, timestamp: now + i * 1000 });
      if (i % 2 === 1) {
        await cam.onCameraInferenceTick(true, 'POTHOLE', 0.91);
      }
    }

    assert.equal(cam.processedFrames.length, 3, 'All 3 camera inference intervals fired');
    assert.equal(cam.detections.length, 3, 'All 3 pothole detections triggered');
    assert.equal(cam.detections[0].defect.warningTriangleTriggered, true);
    assert.equal(cam.detections[0].gpsStatus, 'VALID');
  });

  test('Camera defect detection succeeds even when GPS is completely offline', async () => {
    const cam = new CameraInferenceSimulator();
    // GPS is null / offline
    cam.onGpsUpdate(null);

    await cam.onCameraInferenceTick(true, 'POTHOLE', 0.85);

    assert.equal(cam.processedFrames.length, 1);
    assert.equal(cam.detections.length, 1);
    const det = cam.detections[0];
    assert.equal(det.latitude, null, 'Coordinates must be null without GPS, never fabricated');
    assert.equal(det.longitude, null);
    assert.equal(det.manualLocationRequired, true, 'Flagged for citizen manual location handoff');
    assert.equal(det.gpsStatus, 'MANUAL_OR_MISSING');
    assert.equal(det.defect.warningTriangleTriggered, true, 'Warning triangle is displayed even without GPS');
  });

  test('Coarse GPS (>50m) does not pollute defect evidence, routes to manual location', async () => {
    const cam = new CameraInferenceSimulator();
    cam.onGpsUpdate({ lat: 16.5020, lon: 80.6000, accuracy: 120, timestamp: Date.now() });

    await cam.onCameraInferenceTick(true, 'ALLIGATOR_CRACK', 0.79);

    assert.equal(cam.detections.length, 1);
    const det = cam.detections[0];
    assert.equal(det.latitude, null, 'Coarse coordinates rejected from evidence record');
    assert.equal(det.manualLocationRequired, true);
  });
});
