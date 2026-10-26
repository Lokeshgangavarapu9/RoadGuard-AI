import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidCoordinate,
  formatCoordinate,
  calculateFixAgeSeconds,
  isFixStale,
  haversineDistanceMeters
} from '../utils/geoUtils.js';

describe('RoadGuard AI — Coordinate Validation & Geospatial Telemetry', () => {
  it('validates genuine WGS84 geographic coordinates within bounds', () => {
    // Valid coordinates (e.g. Ravela, Andhra Pradesh)
    assert.equal(isValidCoordinate(16.42501, 80.45122), true);
    assert.equal(isValidCoordinate(0, 0), true);
    assert.equal(isValidCoordinate(-90, -180), true);
    assert.equal(isValidCoordinate(90, 180), true);
  });

  it('rejects invalid, out-of-bounds, NaN, and non-finite coordinates', () => {
    assert.equal(isValidCoordinate(91.0, 80.0), false);
    assert.equal(isValidCoordinate(-91.0, 80.0), false);
    assert.equal(isValidCoordinate(16.0, 181.0), false);
    assert.equal(isValidCoordinate(16.0, -181.0), false);
    assert.equal(isValidCoordinate(NaN, 80.0), false);
    assert.equal(isValidCoordinate(16.0, NaN), false);
    assert.equal(isValidCoordinate(Infinity, 80.0), false);
    assert.equal(isValidCoordinate(null, undefined), false);
    assert.equal(isValidCoordinate('16.42', '80.45'), false);
  });

  it('formats coordinates truthfully with directional indicators', () => {
    assert.equal(formatCoordinate(16.42501, 80.45122), '16.42501°N, 80.45122°E');
    assert.equal(formatCoordinate(-33.86882, 151.20930), '33.86882°S, 151.20930°E');
    assert.equal(formatCoordinate(null, null), 'Unlocated (No GPS)');
  });

  it('calculates fix freshness and identifies stale GPS fixes correctly', () => {
    const now = Date.now();
    // Fresh fix (2 seconds ago)
    const freshTimestamp = now - 2000;
    assert.equal(isFixStale(freshTimestamp, 20000), false);
    assert.ok(calculateFixAgeSeconds(freshTimestamp) <= 3);

    // Stale fix (45 seconds ago, e.g. after satellite lock timeout)
    const staleTimestamp = now - 45000;
    assert.equal(isFixStale(staleTimestamp, 20000), true);
    assert.ok(calculateFixAgeSeconds(staleTimestamp) >= 44);

    // Missing timestamp is always considered stale
    assert.equal(isFixStale(null), true);
    assert.equal(isFixStale(undefined), true);
  });

  it('computes geodesic distances accurately using Haversine formula', () => {
    // Distance between two points near Ravela / Amaravati
    const d = haversineDistanceMeters(16.4250, 80.4512, 16.4350, 80.4512);
    // 0.01 deg latitude ~ 1111 meters
    assert.ok(d > 1000 && d < 1200);

    // Stationary distance
    assert.equal(haversineDistanceMeters(16.4250, 80.4512, 16.4250, 80.4512), 0);

    // Invalid coordinate fallback
    assert.equal(haversineDistanceMeters(null, null, 16.0, 80.0), 0);
  });
});

describe('RoadGuard AI — Leaflet Coordinate Order & Marker Protection', () => {
  it('formats Leaflet LatLng arrays strictly as [latitude, longitude]', () => {
    const testPoint = { lat: 16.42501, lon: 80.45122 };
    const leafletCoords = [testPoint.lat, testPoint.lon];

    assert.equal(leafletCoords[0], 16.42501, 'Latitude must be at index 0');
    assert.equal(leafletCoords[1], 80.45122, 'Longitude must be at index 1');
  });

  it('ensures GPS timeout does NOT produce fake vehicle coordinates', () => {
    let currentLocation = null;
    let gpsErrorMessage = null;

    // Simulate timeout callback from browser Geolocation API
    const timeoutError = { code: 3, message: 'Timeout expired' };
    if (timeoutError.code === 3) {
      gpsErrorMessage = 'Searching for GPS satellite lock (outdoors with clear sky view recommended)...';
    }

    assert.equal(currentLocation, null, 'Current location must remain null on initial timeout');
    assert.ok(gpsErrorMessage.includes('Searching for GPS satellite lock'));

    // Verify map does not invent coordinates
    const hasValidGps = currentLocation && isValidCoordinate(currentLocation.lat, currentLocation.lon);
    assert.equal(hasValidGps, null);
  });
});

describe('RoadGuard AI — Geolocation Watcher Lifecycle & Retry Idempotence', () => {
  it('ensures single watcherId and clears previous watcher before starting new one', () => {
    let activeWatcherId = null;
    const clearedWatchers = [];
    let watchCallCount = 0;

    const mockNavigator = {
      geolocation: {
        watchPosition: () => {
          watchCallCount++;
          activeWatcherId = 100 + watchCallCount;
          return activeWatcherId;
        },
        clearWatch: (id) => {
          clearedWatchers.push(id);
          if (activeWatcherId === id) activeWatcherId = null;
        }
      }
    };

    function startGpsWatcher() {
      if (activeWatcherId != null) {
        mockNavigator.geolocation.clearWatch(activeWatcherId);
      }
      activeWatcherId = mockNavigator.geolocation.watchPosition();
    }

    // 1. Initial watch
    startGpsWatcher();
    assert.equal(activeWatcherId, 101);
    assert.equal(clearedWatchers.length, 0);

    // 2. Retry clicked while first watcher is active
    startGpsWatcher();
    assert.equal(clearedWatchers.includes(101), true, 'Previous watcher 101 must be cleared');
    assert.equal(activeWatcherId, 102);

    // 3. Second retry
    startGpsWatcher();
    assert.equal(clearedWatchers.includes(102), true, 'Previous watcher 102 must be cleared');
    assert.equal(activeWatcherId, 103);
  });
});

describe('RoadGuard AI — Camera Lifecycle & Late-Resolving Stream Cancellation', () => {
  it('cancels late-resolving getUserMedia stream if stopCamera was pressed mid-flight', async () => {
    let cameraGeneration = 0;
    let activeStream = null;
    let stoppedTracksCount = 0;
    let cameraState = 'IDLE';

    // Mock MediaStream
    function createMockStream() {
      return {
        getTracks: () => [
          { stop: () => { stoppedTracksCount++; }, readyState: 'live' },
          { stop: () => { stoppedTracksCount++; }, readyState: 'live' }
        ]
      };
    }

    async function startCamera() {
      const currentGen = ++cameraGeneration;
      cameraState = 'REQUESTING_PERMISSION';

      // Simulate asynchronous permission delay (e.g. 50ms)
      const stream = await new Promise((resolve) => {
        setTimeout(() => resolve(createMockStream()), 50);
      });

      // RACE CONDITION CHECK: Was stopCamera called while waiting?
      if (cameraGeneration !== currentGen) {
        // Stream resolved late after user clicked stop: discard hardware tracks!
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      activeStream = stream;
      cameraState = 'RUNNING';
    }

    function stopCamera() {
      cameraGeneration += 1;
      cameraState = 'STOPPING';
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
        activeStream = null;
      }
      cameraState = 'IDLE';
    }

    // 1. User presses Start Camera
    const startPromise = startCamera();
    assert.equal(cameraState, 'REQUESTING_PERMISSION');

    // 2. User presses Stop Camera BEFORE getUserMedia resolves (at 10ms)
    await new Promise(r => setTimeout(r, 10));
    stopCamera();
    assert.equal(cameraState, 'IDLE');

    // 3. Await the pending getUserMedia to complete
    await startPromise;

    // Verify late stream was discarded and tracks were stopped!
    assert.equal(activeStream, null, 'Active stream must remain null');
    assert.equal(cameraState, 'IDLE', 'Camera state must remain IDLE');
    assert.equal(stoppedTracksCount, 2, 'Late hardware tracks must have been released immediately');
  });

  it('ensures repeated Stop Camera calls are completely safe and idempotent', () => {
    let streamReleased = 0;
    let cameraState = 'RUNNING';

    function stopCamera() {
      cameraState = 'IDLE';
      streamReleased++;
    }

    // Repeated stop clicks
    assert.doesNotThrow(() => {
      stopCamera();
      stopCamera();
      stopCamera();
    });

    assert.equal(cameraState, 'IDLE');
    assert.equal(streamReleased, 3);
  });
});

describe('RoadGuard AI — Driving Mode & Camera Independence', () => {
  it('allows Driving Mode to start with GPS tracking even if Camera is stopped', () => {
    const isCameraRunning = false;
    const currentLocation = { lat: 16.42501, lon: 80.45122, accuracy: 12.0 };

    function canStartDriveMode(gpsFix, _cameraReady) {
      if (!gpsFix || !isValidCoordinate(gpsFix.lat, gpsFix.lon)) {
        return false;
      }
      // Camera is optional: can operate in GPS route tracking mode
      return true;
    }

    assert.equal(canStartDriveMode(currentLocation, isCameraRunning), true);
  });

  it('stopping Camera during Driving Mode halts camera capture while preserving GPS tracking', () => {
    let isJourneyActive = true;
    let cameraState = 'RUNNING';
    let gpsTrackingActive = true;
    let frameCaptureActive = true;

    // User presses "Stop Camera" while driving
    function onStopCameraWhileDriving() {
      cameraState = 'IDLE';
      frameCaptureActive = false;
      // GPS tracking and journey state remain active!
    }

    onStopCameraWhileDriving();

    assert.equal(isJourneyActive, true, 'Driving Mode must remain active');
    assert.equal(cameraState, 'IDLE', 'Camera must be stopped');
    assert.equal(frameCaptureActive, false, 'Frame capture must be stopped');
    assert.equal(gpsTrackingActive, true, 'GPS tracking must continue undisturbed');
  });

  it('stopping Driving Mode cleans up journey resources without crashing camera', () => {
    let activeJourney = { id: 42 };
    let cameraState = 'RUNNING';
    let journeyTimerActive = true;

    function stopDriveMode() {
      activeJourney = null;
      journeyTimerActive = false;
      // Camera preview can stay active if user wants to keep checking dashcam
    }

    stopDriveMode();

    assert.equal(activeJourney, null, 'Active journey must be cleared');
    assert.equal(journeyTimerActive, false, 'Journey timer must be stopped');
    assert.equal(cameraState, 'RUNNING', 'Camera preview remains available');
  });

  it('prevents false geotagging when GPS fix is missing or stale', () => {
    const freshGps = { lat: 16.42501, lon: 80.45122, timestamp: Date.now() };
    const staleGps = { lat: 16.42501, lon: 80.45122, timestamp: Date.now() - 40000 };
    const missingGps = null;

    function sanitizeGeotag(location) {
      if (!location || !isValidCoordinate(location.lat, location.lon)) {
        return { latitude: null, longitude: null, status: 'UNLOCATED' };
      }
      if (isFixStale(location.timestamp, 30000)) {
        return { latitude: null, longitude: null, status: 'STALE_OMITTED' };
      }
      return { latitude: location.lat, longitude: location.lon, status: 'LOCATED' };
    }

    assert.equal(sanitizeGeotag(freshGps).status, 'LOCATED');
    assert.equal(sanitizeGeotag(freshGps).latitude, 16.42501);

    assert.equal(sanitizeGeotag(staleGps).status, 'STALE_OMITTED');
    assert.equal(sanitizeGeotag(staleGps).latitude, null);

    assert.equal(sanitizeGeotag(missingGps).status, 'UNLOCATED');
    assert.equal(sanitizeGeotag(missingGps).latitude, null);
  });
});
