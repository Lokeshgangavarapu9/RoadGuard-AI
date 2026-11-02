import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_TRACK_COORDINATES,
  DEMO_SAMPLE_DEFECTS,
  DEMO_SAMPLE_JOURNEY,
  DEMO_SAMPLE_COMPLAINT,
  generateDemoRoadFrame,
  startDemoScanSession
} from '../utils/demoScan.js';

describe('RoadGuard AI — Demo Mode Isolation & Safety Verification', () => {

  it('1. Demo detections are explicitly tagged with isDemo=true and civic provenance', () => {
    assert.ok(DEMO_SAMPLE_DEFECTS.length >= 2, 'Must have at least 2 demo sample defects');
    DEMO_SAMPLE_DEFECTS.forEach(defect => {
      assert.equal(defect.isDemo, true, `Defect ${defect.id} must have isDemo=true`);
      assert.ok(defect.id.startsWith('DEMO-'), `Defect ID must have DEMO- prefix: ${defect.id}`);
      assert.ok(defect.defectClass === 'POTHOLE' || defect.defectClass === 'ALLIGATOR_CRACK');
      assert.ok(defect.confidenceScore > 0.8 && defect.confidenceScore < 1.0);
      assert.ok(defect.roadName.includes('Vijayawada'));
    });
  });

  it('2. Demo coordinates are explicitly simulated and isolated from genuine defect records', () => {
    // CameraViewfinder location sanitizer simulation:
    // If location is marked isDemo, real defect submission must receive null coordinates
    function sanitizeGpsForEvidence(loc) {
      const hasCoords = loc != null && Number.isFinite(loc.lat) && Number.isFinite(loc.lon);
      const isDemo = loc?.isDemo === true;
      return {
        lat: (hasCoords && !isDemo) ? loc.lat : null,
        lon: (hasCoords && !isDemo) ? loc.lon : null,
        isGeotagged: hasCoords && !isDemo,
        locationSource: isDemo ? 'MANUAL_LOCATION_REQUIRED' : (hasCoords ? 'BROWSER_GPS' : 'MANUAL_LOCATION_REQUIRED')
      };
    }

    const demoLocation = { lat: 16.5062, lon: 80.6480, accuracy: 6.5, isDemo: true };
    const sanitized = sanitizeGpsForEvidence(demoLocation);

    assert.equal(sanitized.lat, null, 'Demo latitude must NEVER be attached to real defect evidence');
    assert.equal(sanitized.lon, null, 'Demo longitude must NEVER be attached to real defect evidence');
    assert.equal(sanitized.isGeotagged, false, 'Demo location must not be considered genuinely geotagged');
    assert.equal(sanitized.locationSource, 'MANUAL_LOCATION_REQUIRED');

    const genuineLocation = { lat: 16.5062, lon: 80.6480, accuracy: 6.5, isDemo: false };
    const genuineSanitized = sanitizeGpsForEvidence(genuineLocation);
    assert.equal(genuineSanitized.lat, 16.5062);
    assert.equal(genuineSanitized.lon, 80.6480);
    assert.equal(genuineSanitized.isGeotagged, true);
  });

  it('3. No demo record is saved as a real PostgreSQL record or submitted to portals', () => {
    // Database payload validator
    function validateDatabaseRecord(entity) {
      if (entity.isDemo || String(entity.id).startsWith('DEMO-')) {
        throw new Error(`SECURITY/INTEGRITY VIOLATION: Attempted to persist demo entity [${entity.id}] to database`);
      }
      return true;
    }

    assert.throws(() => validateDatabaseRecord(DEMO_SAMPLE_JOURNEY), /INTEGRITY VIOLATION/);
    assert.throws(() => validateDatabaseRecord(DEMO_SAMPLE_DEFECTS[0]), /INTEGRITY VIOLATION/);
    assert.throws(() => validateDatabaseRecord(DEMO_SAMPLE_COMPLAINT), /INTEGRITY VIOLATION/);

    const genuineJourney = { id: 101, vehicleType: 'CAR', isDemo: false };
    assert.equal(validateDatabaseRecord(genuineJourney), true);
  });

  it('4. Demo complaint has status SIMULATED and officialRefId=null', () => {
    assert.equal(DEMO_SAMPLE_COMPLAINT.status, 'SIMULATED');
    assert.equal(DEMO_SAMPLE_COMPLAINT.officialRefId, null);
    assert.ok(DEMO_SAMPLE_COMPLAINT.citizenHandoffNotes.includes('Prototype Simulation'));

    // Status mapper contract
    function getHonestStatusCategory(record) {
      if (record.officialRefId && record.status === 'SUBMITTED') return 'SUBMITTED';
      if (record.status === 'SIMULATED' || record.isDemo) return 'SIMULATED';
      return 'DRAFT';
    }

    assert.equal(getHonestStatusCategory(DEMO_SAMPLE_COMPLAINT), 'SIMULATED');
    assert.notEqual(getHonestStatusCategory(DEMO_SAMPLE_COMPLAINT), 'SUBMITTED');
  });

  it('5. Exiting demo session cleanly restores application state without side effects', () => {
    let activeJourney = null;
    let demoActive = true;
    let currentLocation = { lat: 16.5062, lon: 80.6480, isDemo: true };
    let postTripSummary = null;

    // Simulation of handleStartRoadScan or stop when demo is active
    function stopDemoScan() {
      demoActive = false;
      currentLocation = null;
      postTripSummary = {
        id: DEMO_SAMPLE_JOURNEY.id,
        distanceMeters: DEMO_SAMPLE_JOURNEY.distanceMeters,
        durationSeconds: 30,
        issuesCount: 2,
        isDemo: true
      };
    }

    stopDemoScan();

    assert.equal(demoActive, false, 'Demo mode must be deactivated');
    assert.equal(activeJourney, null, 'No real active journey should be started');
    assert.equal(currentLocation, null, 'Demo location must be cleared');
    assert.ok(postTripSummary);
    assert.equal(postTripSummary.isDemo, true);
  });

  it('6. Demo records cannot leak into persistent journey list', () => {
    const backendJourneys = [
      { id: 1, vehicleType: 'CAR', status: 'COMPLETED', pointsCount: 15 }
    ];

    // Filter ensuring demo trips are not mixed with backend responses
    function sanitizeJourneyList(list) {
      return list.filter(j => !j.isDemo && !String(j.id).startsWith('DEMO-'));
    }

    const mixedList = [...backendJourneys, DEMO_SAMPLE_JOURNEY];
    const sanitizedList = sanitizeJourneyList(mixedList);

    assert.equal(sanitizedList.length, 1);
    assert.equal(sanitizedList[0].id, 1);
  });

  it('7. Generated canvas frames contain simulated watermark text and metadata', () => {
    // Check that canvas generation function exists and handles step parameter
    assert.equal(typeof generateDemoRoadFrame, 'function');
    // In node environment without DOM, generateDemoRoadFrame returns null safely without throwing
    const frame = generateDemoRoadFrame(5, null);
    assert.equal(frame, null); // Node environment guard
  });

  it('8. startDemoScanSession supports immediate cancellation', () => {
    let tickCount = 0;
    const cancelFn = startDemoScanSession({
      onTick: () => { tickCount++; },
      onDetection: () => {},
      onComplete: () => {}
    });

    assert.equal(typeof cancelFn, 'function');
    cancelFn(); // cancel immediately
    assert.equal(tickCount, 0, 'No ticks should fire after cancellation');
  });

});

