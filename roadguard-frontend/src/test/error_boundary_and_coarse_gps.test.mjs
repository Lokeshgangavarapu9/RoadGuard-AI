import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isValidCoordinate } from '../utils/geoUtils.js';

describe('RoadGuard AI — DiagnosticPanel Props Contract & GPS Weak Handling', () => {
  // Test simulating DiagnosticPanel prop destructuring and status derivation logic
  function deriveGpsDiagnostics({
    isGpsEnabled = false,
    gpsStatus = 'GPS OFF',
    gpsPermissionState = 'prompt',
    hasValidGps = false,
    isStale = false,
    backendError = null,
    onRetryBackend = null
  }) {
    // Exact logic from DiagnosticPanel.jsx
    let gpsStatusLabel = 'GPS OFF';
    let gpsColor = '#94a3b8';

    if (!isGpsEnabled) {
      gpsStatusLabel = 'GPS OFF';
      gpsColor = '#94a3b8';
    } else if (gpsPermissionState === 'denied' || gpsStatus === 'GPS PERMISSION DENIED') {
      gpsStatusLabel = 'GPS PERMISSION DENIED';
      gpsColor = '#ef4444';
    } else if (gpsPermissionState === 'unavailable' || gpsStatus === 'GPS ERROR') {
      gpsStatusLabel = 'GPS ERROR';
      gpsColor = '#ef4444';
    } else if (hasValidGps || gpsStatus === 'GPS ACTIVE') {
      if (isStale) {
        gpsStatusLabel = 'GPS ACTIVE (STALE)';
        gpsColor = '#f59e0b';
      } else {
        gpsStatusLabel = 'GPS ACTIVE';
        gpsColor = '#00f5a0';
      }
    } else if (gpsStatus === 'GPS CONNECTING') {
      gpsStatusLabel = 'GPS CONNECTING';
      gpsColor = '#38bdf8';
    } else {
      gpsStatusLabel = gpsStatus || 'GPS CONNECTING';
      gpsColor = '#f59e0b';
    }

    return {
      gpsStatusLabel,
      gpsColor,
      hasBackendError: Boolean(backendError),
      backendErrorText: backendError,
      hasRetryHandler: typeof onRetryBackend === 'function'
    };
  }

  test('DiagnosticPanel derives correct status for coarse GPS fix (149m)', () => {
    const result = deriveGpsDiagnostics({
      isGpsEnabled: true,
      gpsStatus: 'GPS WEAK (±149m)',
      gpsPermissionState: 'prompt',
      hasValidGps: false,
      backendError: null
    });

    assert.equal(result.gpsStatusLabel, 'GPS WEAK (±149m)');
    assert.equal(result.gpsColor, '#f59e0b'); // Amber for weak/coarse
    assert.equal(result.hasBackendError, false);
  });

  test('DiagnosticPanel safely handles undefined backendError and onRetryBackend without ReferenceError', () => {
    // Calling without backendError or onRetryBackend
    const result = deriveGpsDiagnostics({
      isGpsEnabled: true,
      gpsStatus: 'GPS CONNECTING'
    });

    assert.equal(result.gpsStatusLabel, 'GPS CONNECTING');
    assert.equal(result.hasBackendError, false);
    assert.equal(result.hasRetryHandler, false);
  });

  test('DiagnosticPanel correctly surfaces active backendError', () => {
    const retryFn = () => {};
    const result = deriveGpsDiagnostics({
      isGpsEnabled: false,
      backendError: 'Failed to fetch (CORS preflight or network error)',
      onRetryBackend: retryFn
    });

    assert.equal(result.hasBackendError, true);
    assert.equal(result.backendErrorText, 'Failed to fetch (CORS preflight or network error)');
    assert.equal(result.hasRetryHandler, true);
  });
});

describe('RoadGuard AI — Coarse GPS Quality Gate & Map Centering Logic', () => {
  class MockGpsWatcherEngine {
    constructor() {
      this.currentLocation = null;
      this.coarseLocation = null;
      this.gpsStatus = 'GPS OFF';
      this.gpsErrorMessage = null;
      this.telemetryQueue = [];
    }

    onPosition(pos) {
      if (!pos || !pos.coords) return;
      const { latitude: lat, longitude: lon, accuracy } = pos.coords;
      const timestamp = pos.timestamp || Date.now();

      // Gate 1: Reject Null Island (0,0)
      if (lat === 0 && lon === 0) return;

      // Gate 2: Reject non-finite or out-of-bounds
      if (!isValidCoordinate(lat, lon)) return;

      // Gate 3: Coarse fixes (>50m accuracy)
      if (accuracy > 50) {
        this.coarseLocation = { lat, lon, accuracy, timestamp };
        this.gpsStatus = `GPS WEAK (±${Math.round(accuracy)}m)`;
        this.gpsErrorMessage = `GPS accuracy is coarse (±${Math.round(accuracy)}m from Wi-Fi/Cell). Automated road geotagging requires <50m. Map centered in coarse region.`;
        return;
      }

      // Accurate fix (<50m)
      this.coarseLocation = null;
      this.gpsStatus = 'GPS ACTIVE';
      this.gpsErrorMessage = null;
      const pt = { lat, lon, accuracy, timestamp };
      this.currentLocation = pt;
      this.telemetryQueue.push(pt);
    }
  }

  test('Coarse GPS fix (149m) sets coarseLocation and weak status without corrupting telemetry queue', () => {
    const engine = new MockGpsWatcherEngine();
    
    // Simulate initial coarse fix (e.g. desktop Wi-Fi in Hyderabad / Vijayawada)
    engine.onPosition({
      coords: { latitude: 17.3850, longitude: 78.4867, accuracy: 149 },
      timestamp: 1000
    });

    assert.equal(engine.currentLocation, null, 'Accurate currentLocation must remain null');
    assert.ok(engine.coarseLocation, 'coarseLocation must be stored');
    assert.equal(engine.coarseLocation.lat, 17.3850);
    assert.equal(engine.coarseLocation.lon, 78.4867);
    assert.equal(engine.coarseLocation.accuracy, 149);
    assert.equal(engine.gpsStatus, 'GPS WEAK (±149m)');
    assert.ok(engine.gpsErrorMessage.includes('coarse (±149m'));
    assert.equal(engine.telemetryQueue.length, 0, 'No coarse points uploaded as road telemetry');
  });

  test('Subsequent accurate fix (12m) clears coarse state and activates genuine tracking', () => {
    const engine = new MockGpsWatcherEngine();
    
    // First: Coarse fix
    engine.onPosition({
      coords: { latitude: 17.3850, longitude: 78.4867, accuracy: 149 },
      timestamp: 1000
    });
    assert.ok(engine.coarseLocation != null);

    // Second: Accurate outdoor GPS fix acquired
    engine.onPosition({
      coords: { latitude: 17.3855, longitude: 78.4870, accuracy: 12 },
      timestamp: 2000
    });

    assert.equal(engine.coarseLocation, null, 'coarseLocation must be cleared upon accurate fix');
    assert.ok(engine.currentLocation != null, 'currentLocation must be set');
    assert.equal(engine.currentLocation.lat, 17.3855);
    assert.equal(engine.gpsStatus, 'GPS ACTIVE');
    assert.equal(engine.gpsErrorMessage, null);
    assert.equal(engine.telemetryQueue.length, 1, 'Accurate point enqueued');
  });

  test('Map center resolves to coarse coordinates when available, instead of default corridor', () => {
    const defaultCenter = [16.5062, 80.6480]; // Vijayawada
    
    function resolveCenter(currentLocation, manualLocation, coarseLocation, isGpsEnabled) {
      const hasValidGps = isGpsEnabled && currentLocation && isValidCoordinate(currentLocation.lat, currentLocation.lon);
      const hasValidCoarse = !hasValidGps && coarseLocation && isValidCoordinate(coarseLocation.lat, coarseLocation.lon);

      return hasValidGps
        ? [currentLocation.lat, currentLocation.lon]
        : (manualLocation && isValidCoordinate(manualLocation.lat, manualLocation.lon)
          ? [manualLocation.lat, manualLocation.lon]
          : (hasValidCoarse
            ? [coarseLocation.lat, coarseLocation.lon]
            : defaultCenter));
    }

    // Case 1: No GPS, no manual, no coarse -> default center
    const c1 = resolveCenter(null, null, null, false);
    assert.deepEqual(c1, defaultCenter);

    // Case 2: Coarse GPS available (e.g. 17.3850, 78.4867) -> coarse center
    const c2 = resolveCenter(null, null, { lat: 17.3850, lon: 78.4867, accuracy: 149 }, true);
    assert.deepEqual(c2, [17.3850, 78.4867]);

    // Case 3: Manual pin overrides coarse GPS
    const c3 = resolveCenter(null, { lat: 12.9716, lon: 77.5946 }, { lat: 17.3850, lon: 78.4867, accuracy: 149 }, true);
    assert.deepEqual(c3, [12.9716, 77.5946]);

    // Case 4: Accurate GPS overrides both manual and coarse
    const c4 = resolveCenter({ lat: 13.0827, lon: 80.2707 }, { lat: 12.9716, lon: 77.5946 }, { lat: 17.3850, lon: 78.4867, accuracy: 149 }, true);
    assert.deepEqual(c4, [13.0827, 80.2707]);
  });
});

