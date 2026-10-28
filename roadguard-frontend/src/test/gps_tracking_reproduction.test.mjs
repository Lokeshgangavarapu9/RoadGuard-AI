import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { haversineDistanceMeters, isValidCoordinate } from '../utils/geoUtils.js';

class GpsTelemetrySimulator {
  constructor(options = {}) {
    this.latestGps = null;
    this.lastRecordedGps = null;
    this.gpsPath = [];
    this.pendingQueue = [];
    this.sentBatches = [];
    this.distanceMeters = 0;
    this.networkFails = options.networkFails || false;
    this.maxQueueSize = options.maxQueueSize || 500;
  }

  // Simulated watchPosition callback with Quality Gates
  onWatchPositionFix(pos) {
    if (!pos || !pos.coords) return;
    const { latitude, longitude, accuracy } = pos.coords;
    const timestamp = pos.timestamp || Date.now();

    // Gate 1: Null Island
    if (latitude === 0 && longitude === 0) return;
    // Gate 2: Non-finite / out of bounds
    if (!isValidCoordinate(latitude, longitude)) return;
    // Gate 3: Coarse fix
    if (accuracy > 50) return;
    // Gate 4: Monotonic timestamp
    if (this.latestGps && timestamp <= this.latestGps.timestamp) return;

    this.latestGps = {
      lat: latitude,
      lon: longitude,
      accuracy,
      speed: pos.coords.speed ?? null,
      heading: pos.coords.heading ?? null,
      timestamp
    };
  }

  // Simulated 2.5s telemetry interval tick
  onIntervalTick() {
    const pt = this.latestGps;
    if (!pt || pt.lat == null) return;

    if (!this.lastRecordedGps) {
      // First point of journey (Point 0)
      this.lastRecordedGps = pt;
      this.gpsPath.push(pt);
      this.enqueuePoint(pt);
      this.flushQueue();
      return;
    }

    const stepDist = haversineDistanceMeters(
      this.lastRecordedGps.lat,
      this.lastRecordedGps.lon,
      pt.lat,
      pt.lon
    );

    const dtSec = Math.max(0.5, (pt.timestamp - this.lastRecordedGps.timestamp) / 1000.0);
    const impliedSpeedMps = stepDist / dtSec;

    // Reject stationary jitter (<2m)
    if (stepDist < 2.0) return;

    // Reject implausible multipath spikes (>500m in <10s with speed > 45 m/s = 162 km/h)
    if (stepDist > 500.0 && impliedSpeedMps > 45.0) {
      return;
    }

    // Valid movement step
    this.distanceMeters += stepDist;
    this.lastRecordedGps = pt;
    this.gpsPath.push(pt);
    this.enqueuePoint(pt);
    this.flushQueue();
  }

  enqueuePoint(pt) {
    if (this.pendingQueue.length < this.maxQueueSize) {
      this.pendingQueue.push({
        latitude: pt.lat,
        longitude: pt.lon,
        speed: pt.speed,
        heading: pt.heading,
        accuracy: pt.accuracy,
        timestamp: new Date(pt.timestamp).toISOString()
      });
    }
  }

  flushQueue() {
    if (this.networkFails || this.pendingQueue.length === 0) return;
    const batch = [...this.pendingQueue];
    this.sentBatches.push(batch);
    this.pendingQueue = this.pendingQueue.slice(batch.length);
  }
}

describe('Deterministic 10-Scenario GPS Tracking & Telemetry Matrix', () => {
  test('Scenario 1: 1 Hz updates do NOT starve the 2.5s batching timer', () => {
    const sim = new GpsTelemetrySimulator();
    let time = 1000;
    // 10 seconds of 1 Hz GPS arrivals (vehicle traveling at ~11 m/s = 40 km/h)
    for (let i = 0; i < 10; i++) {
      time += 1000;
      sim.onWatchPositionFix({
        coords: { latitude: 16.5000 + i * 0.0001, longitude: 80.6000, accuracy: 5, speed: 11.1 },
        timestamp: time
      });
      // Telemetry interval fires every 2500ms (at ~2.5s, 5s, 7.5s, 10s)
      if (i === 2 || i === 5 || i === 7 || i === 9) {
        sim.onIntervalTick();
      }
    }
    assert.ok(sim.gpsPath.length >= 4, `Expected at least 4 batches, got ${sim.gpsPath.length}`);
    assert.ok(sim.distanceMeters > 50, 'Distance was accumulated continuously');
  });

  test('Scenario 2: Single >500m multipath spike is rejected', () => {
    const sim = new GpsTelemetrySimulator();
    sim.onWatchPositionFix({
      coords: { latitude: 16.5000, longitude: 80.6000, accuracy: 5, speed: 10 },
      timestamp: 1000
    });
    sim.onIntervalTick();
    assert.equal(sim.gpsPath.length, 1);

    // Sudden 800m jump in 2 seconds (400 m/s > 45 m/s threshold)
    sim.onWatchPositionFix({
      coords: { latitude: 16.5072, longitude: 80.6000, accuracy: 5, speed: 10 },
      timestamp: 3000
    });
    sim.onIntervalTick();
    assert.equal(sim.gpsPath.length, 1, 'Multipath jump was rejected without advancing anchor');
  });

  test('Scenario 3: >500m genuine movement in underpass auto-recovers without deadlock', () => {
    const sim = new GpsTelemetrySimulator();
    sim.onWatchPositionFix({
      coords: { latitude: 16.5000, longitude: 80.6000, accuracy: 5, speed: 15 },
      timestamp: 1000
    });
    sim.onIntervalTick();
    assert.equal(sim.gpsPath.length, 1);

    // 40 seconds underpass/flyover: vehicle moves 600m (implied speed = 600/40 = 15 m/s <= 45 m/s)
    sim.onWatchPositionFix({
      coords: { latitude: 16.5054, longitude: 80.6000, accuracy: 8, speed: 15 },
      timestamp: 41000
    });
    sim.onIntervalTick();
    assert.equal(sim.gpsPath.length, 2, 'Legitimate travel after GPS gap auto-recovered cleanly');
    assert.ok(sim.distanceMeters > 550, 'Accumulated underpass distance');
  });

  test('Scenario 4: Coarse cell-tower fixes (>50m accuracy) are rejected', () => {
    const sim = new GpsTelemetrySimulator();
    sim.onWatchPositionFix({
      coords: { latitude: 16.5000, longitude: 80.6000, accuracy: 6 },
      timestamp: 1000
    });
    assert.equal(sim.latestGps.accuracy, 6);

    // Fallback to coarse 120m cell-tower fix
    sim.onWatchPositionFix({
      coords: { latitude: 16.5020, longitude: 80.6000, accuracy: 120 },
      timestamp: 2000
    });
    assert.equal(sim.latestGps.accuracy, 6, 'Coarse 120m fix was blocked');
  });

  test('Scenario 5: Out-of-order and stale timestamps are rejected', () => {
    const sim = new GpsTelemetrySimulator();
    sim.onWatchPositionFix({
      coords: { latitude: 16.5000, longitude: 80.6000, accuracy: 5 },
      timestamp: 5000
    });
    assert.equal(sim.latestGps.timestamp, 5000);

    // Stale fix with timestamp 4000 arrives late
    sim.onWatchPositionFix({
      coords: { latitude: 16.5002, longitude: 80.6000, accuracy: 5 },
      timestamp: 4000
    });
    assert.equal(sim.latestGps.timestamp, 5000, 'Stale timestamp fix was discarded');
  });

  test('Scenario 6: Null Island (0,0) coordinates are rejected', () => {
    const sim = new GpsTelemetrySimulator();
    sim.onWatchPositionFix({
      coords: { latitude: 0, longitude: 0, accuracy: 5 },
      timestamp: 1000
    });
    assert.equal(sim.latestGps, null, 'Null Island coordinate was ignored');
  });

  test('Scenario 7: Stationary jitter (<2m) is filtered out', () => {
    const sim = new GpsTelemetrySimulator();
    sim.onWatchPositionFix({
      coords: { latitude: 16.50000, longitude: 80.60000, accuracy: 5 },
      timestamp: 1000
    });
    sim.onIntervalTick();
    assert.equal(sim.gpsPath.length, 1);

    // 0.8 meter drift while parked
    sim.onWatchPositionFix({
      coords: { latitude: 16.500005, longitude: 80.600005, accuracy: 5 },
      timestamp: 3500
    });
    sim.onIntervalTick();
    assert.equal(sim.gpsPath.length, 1, 'Stationary noise was filtered without new point');
  });

  test('Scenario 8: Initial Point 0 is persisted to queue immediately', () => {
    const sim = new GpsTelemetrySimulator();
    sim.onWatchPositionFix({
      coords: { latitude: 16.5000, longitude: 80.6000, accuracy: 4, speed: 0 },
      timestamp: 1000
    });
    sim.onIntervalTick();
    assert.equal(sim.gpsPath.length, 1);
    assert.equal(sim.sentBatches.length, 1);
    assert.equal(sim.sentBatches[0][0].latitude, 16.5000, 'Point 0 was dispatched to backend');
  });

  test('Scenario 9: Bounded retry queue recovers seamlessly on network drop', () => {
    const sim = new GpsTelemetrySimulator({ networkFails: true });
    sim.onWatchPositionFix({
      coords: { latitude: 16.5000, longitude: 80.6000, accuracy: 5, speed: 10 },
      timestamp: 1000
    });
    sim.onIntervalTick();
    assert.equal(sim.pendingQueue.length, 1, 'Point 0 buffered when network fails');

    // Movement continues while network is offline
    sim.onWatchPositionFix({
      coords: { latitude: 16.5003, longitude: 80.6000, accuracy: 5, speed: 10 },
      timestamp: 3500
    });
    sim.onIntervalTick();
    assert.equal(sim.pendingQueue.length, 2, 'Point 1 buffered when network fails');
    assert.equal(sim.sentBatches.length, 0);

    // Network restores
    sim.networkFails = false;
    sim.onWatchPositionFix({
      coords: { latitude: 16.5006, longitude: 80.6000, accuracy: 5, speed: 10 },
      timestamp: 6000
    });
    sim.onIntervalTick();
    assert.equal(sim.sentBatches.length, 1, 'Flushed upon network restore');
    assert.equal(sim.sentBatches[0].length, 3, 'All 3 points delivered without loss');
    assert.equal(sim.pendingQueue.length, 0, 'Queue is empty after successful flush');
  });

  test('Scenario 10: Queue capacity is bounded to prevent unbounded memory growth', () => {
    const sim = new GpsTelemetrySimulator({ networkFails: true, maxQueueSize: 5 });
    for (let i = 0; i < 10; i++) {
      sim.onWatchPositionFix({
        coords: { latitude: 16.5000 + i * 0.0005, longitude: 80.6000, accuracy: 5, speed: 10 },
        timestamp: 1000 + i * 2500
      });
      sim.onIntervalTick();
    }
    assert.equal(sim.pendingQueue.length, 5, 'Queue strictly bounded at max capacity');
  });
});
