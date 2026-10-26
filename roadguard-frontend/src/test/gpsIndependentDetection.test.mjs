import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isValidCoordinate } from '../utils/geoUtils.js';

describe('RoadGuard AI — GPS-Independent Detection & Location Provenance', () => {
  it('passes null coordinates when GPS is offline or uncalibrated, never fabricating coordinates', () => {
    // Simulate telemetry sanitizer in CameraViewfinder.jsx
    function sanitizeCoordinates(currentLocation, isGpsEnabled) {
      if (!isGpsEnabled) return { latitude: null, longitude: null };

      const rawLat = currentLocation?.lat;
      const rawLon = currentLocation?.lon;
      const accuracy = currentLocation?.accuracy;
      const hasValidCoords = isValidCoordinate(rawLat, rawLon);
      const isAccurate = accuracy != null && accuracy <= 50;

      return {
        latitude: (hasValidCoords && isAccurate) ? rawLat : null,
        longitude: (hasValidCoords && isAccurate) ? rawLon : null
      };
    }

    // When GPS is OFF
    const offTelemetry = sanitizeCoordinates({ lat: 16.5062, lon: 80.6480, accuracy: 5 }, false);
    assert.equal(offTelemetry.latitude, null);
    assert.equal(offTelemetry.longitude, null);

    // When GPS is ON but fix is coarse (>50m)
    const coarseTelemetry = sanitizeCoordinates({ lat: 16.5062, lon: 80.6480, accuracy: 120 }, true);
    assert.equal(coarseTelemetry.latitude, null);
    assert.equal(coarseTelemetry.longitude, null);

    // When GPS is ON with high accuracy fix (<=50m)
    const lockedTelemetry = sanitizeCoordinates({ lat: 16.4250, lon: 80.4512, accuracy: 8 }, true);
    assert.equal(lockedTelemetry.latitude, 16.4250);
    assert.equal(lockedTelemetry.longitude, 80.4512);
  });

  it('correctly maps locationSource to MANUAL_LOCATION_REQUIRED when coordinates are absent', () => {
    function resolveLocationProvenance(latitude, longitude, currentSource) {
      if (!isValidCoordinate(latitude, longitude)) {
        return 'MANUAL_LOCATION_REQUIRED';
      }
      return currentSource || 'GPS_TELEMETRY';
    }

    assert.equal(resolveLocationProvenance(null, null, null), 'MANUAL_LOCATION_REQUIRED');
    assert.equal(resolveLocationProvenance(undefined, undefined, null), 'MANUAL_LOCATION_REQUIRED');
    assert.equal(resolveLocationProvenance(16.4250, 80.4512, 'MANUAL_ENTRY'), 'MANUAL_ENTRY');
    assert.equal(resolveLocationProvenance(16.4250, 80.4512, null), 'GPS_TELEMETRY');
  });

  it('validates manual location form inputs and range boundaries', () => {
    function validateManualLocation(req) {
      if (!req.roadName || !req.roadName.trim()) {
        throw new Error('Road or highway name is mandatory.');
      }
      if (!req.district || !req.district.trim()) {
        throw new Error('District is required for administrative jurisdiction routing.');
      }
      if (req.latitude != null) {
        if (typeof req.latitude !== 'number' || req.latitude < -90 || req.latitude > 90) {
          throw new Error('Latitude must be between -90 and 90 degrees.');
        }
      }
      if (req.longitude != null) {
        if (typeof req.longitude !== 'number' || req.longitude < -180 || req.longitude > 180) {
          throw new Error('Longitude must be between -180 and 180 degrees.');
        }
      }
      return true;
    }

    // Valid manual entry
    assert.equal(validateManualLocation({
      roadName: 'NH-16 Benz Circle',
      district: 'NTR District',
      state: 'Andhra Pradesh',
      latitude: 16.5062,
      longitude: 80.6480
    }), true);

    // Missing road name
    assert.throws(() => validateManualLocation({ roadName: '', district: 'Guntur' }), /mandatory/);

    // Missing district
    assert.throws(() => validateManualLocation({ roadName: 'Grand Trunk Road', district: '' }), /District is required/);

    // Out of bound coordinates
    assert.throws(() => validateManualLocation({ roadName: 'NH-16', district: 'Krishna', latitude: 95.0 }), /between -90 and 90/);
    assert.throws(() => validateManualLocation({ roadName: 'NH-16', district: 'Krishna', longitude: 200.0 }), /between -180 and 180/);
  });
});
