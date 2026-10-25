import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Camera,
  Compass,
  Gauge,
  Radio,
  ShieldAlert,
  Video,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Pause,
  AlertCircle
} from 'lucide-react';
import { generateSyntheticFrame, DEMO_TRACK } from '../demoData';
import { uploadEvidenceFrame } from '../api';

/**
 * Conservative Road Recording Eligibility States:
 * - CAMERA_PERMISSION_REQUIRED
 * - GPS_UNAVAILABLE
 * - GPS_ACCURACY_POOR
 * - LOCATION_UNCERTAIN
 * - OFF_ROAD
 * - ROAD_CANDIDATE
 * - ROAD_CONFIRMED
 * - RECORDING
 * - PAUSED_STATIONARY
 * - STOPPED
 */

export default function CameraViewfinder({
  isJourneyActive,
  journeyId,
  isDemoMode,
  currentLocation,
  onNewDetection,
  onFrameProcessed,
  settings = {},
  onEligibilityChange
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wakeLockRef = useRef(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [eligibilityState, setEligibilityState] = useState('STOPPED');
  const [consecutiveFixes, setConsecutiveFixes] = useState(0);
  const [stationarySec, setStationarySec] = useState(0);
  const [detectedBox, setDetectedBox] = useState(null);
  const [lastUploadedFrame, setLastUploadedFrame] = useState(null);

  const maxGpsAccuracy = settings.maxGpsAccuracy || 25; // meters
  const stationaryGraceSec = settings.stationaryGraceSec || 10; // seconds
  const frameIntervalSec = settings.frameInterval || 2.8;

  // 1. Manage Screen WakeLock during active drive mode
  useEffect(() => {
    async function requestWakeLock() {
      if (isJourneyActive && 'wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch (e) {
          console.debug('Screen WakeLock unavailable or denied:', e.message);
        }
      }
    }
    requestWakeLock();
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [isJourneyActive]);

  // 2. Setup Camera Stream for Live Mode
  useEffect(() => {
    let stream = null;
    async function startCamera() {
      if (!isDemoMode && isJourneyActive) {
        try {
          setCameraError(null);
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
            setCameraActive(true);
          }
        } catch (err) {
          console.warn('Camera access unavailable:', err.message);
          setCameraError(err.message);
          setCameraActive(false);
        }
      } else {
        setCameraActive(false);
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isDemoMode, isJourneyActive]);

  // 3. Conservative Road Eligibility State Machine Evaluator
  useEffect(() => {
    if (!isJourneyActive) {
      setEligibilityState('STOPPED');
      setConsecutiveFixes(0);
      setStationarySec(0);
      if (onEligibilityChange) onEligibilityChange('STOPPED');
      return;
    }

    if (!isDemoMode && cameraError) {
      setEligibilityState('CAMERA_PERMISSION_REQUIRED');
      if (onEligibilityChange) onEligibilityChange('CAMERA_PERMISSION_REQUIRED');
      return;
    }

    // In Demo Mode: High-fidelity simulated road telemetry
    if (isDemoMode) {
      setEligibilityState('RECORDING');
      if (onEligibilityChange) onEligibilityChange('RECORDING');
      return;
    }

    // In Live Mode: Evaluate physical sensors
    if (!currentLocation || currentLocation.lat == null) {
      setEligibilityState('GPS_UNAVAILABLE');
      if (onEligibilityChange) onEligibilityChange('GPS_UNAVAILABLE');
      return;
    }

    const accuracy = currentLocation.accuracy || 10;
    if (accuracy > maxGpsAccuracy) {
      setEligibilityState('GPS_ACCURACY_POOR');
      if (onEligibilityChange) onEligibilityChange('GPS_ACCURACY_POOR');
      return;
    }

    const speedKmh = currentLocation.speed != null ? currentLocation.speed * 3.6 : 0;

    // Stationary detection with configurable grace period
    if (speedKmh < 2.0) {
      setStationarySec((prev) => prev + 1);
      if (stationarySec >= stationaryGraceSec) {
        setEligibilityState('PAUSED_STATIONARY');
        if (onEligibilityChange) onEligibilityChange('PAUSED_STATIONARY');
        return;
      }
    } else {
      setStationarySec(0);
    }

    // Hysteresis & consecutive fix confirmation
    const newFixCount = consecutiveFixes + 1;
    setConsecutiveFixes(newFixCount);

    if (newFixCount < 2) {
      setEligibilityState('ROAD_CANDIDATE');
      if (onEligibilityChange) onEligibilityChange('ROAD_CANDIDATE');
    } else {
      setEligibilityState('RECORDING');
      if (onEligibilityChange) onEligibilityChange('RECORDING');
    }
  }, [isJourneyActive, isDemoMode, cameraError, currentLocation, maxGpsAccuracy, stationaryGraceSec, stationarySec, consecutiveFixes]);

  // 4. Ingestion & Inference Loop (runs while state is RECORDING)
  useEffect(() => {
    if (!isJourneyActive || !journeyId || eligibilityState !== 'RECORDING') return;

    let frameSeq = 1;
    let trackIndex = 0;

    const interval = setInterval(async () => {
      try {
        let fileToUpload = null;
        let lat = currentLocation?.lat || 16.5062;
        let lon = currentLocation?.lon || 80.6480;

        if (isDemoMode) {
          const trackPoint = DEMO_TRACK[trackIndex % DEMO_TRACK.length];
          lat = trackPoint.lat;
          lon = trackPoint.lon;

          if (trackPoint.defect) {
            setDetectedBox({
              type: trackPoint.defect,
              conf: trackPoint.conf,
              desc: `Demo: ${trackPoint.defect} (${(trackPoint.conf * 100).toFixed(0)}%) [Simulated]`,
              isSimulated: true,
              x1: 0.28,
              y1: 0.38,
              x2: 0.72,
              y2: 0.72
            });
            setTimeout(() => setDetectedBox(null), 1800);
          }

          fileToUpload = await generateSyntheticFrame(trackPoint.defect, frameSeq);
          trackIndex++;
        } else if (videoRef.current && cameraActive && canvasRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          fileToUpload = await new Promise((res) => {
            canvas.toBlob((b) => res(new File([b], `frame_${frameSeq}.jpg`, { type: 'image/jpeg' })), 'image/jpeg', 0.8);
          });
        }

        if (fileToUpload) {
          const resp = await uploadEvidenceFrame(journeyId, fileToUpload, {
            latitude: lat,
            longitude: lon,
            capturedAt: new Date().toISOString(),
            frameSequence: frameSeq
          });

          setLastUploadedFrame(resp);
          if (onFrameProcessed) onFrameProcessed(resp);

          // Real AI detection overlay
          if (resp?.observations && resp.observations.length > 0) {
            const topDet = resp.observations[0];
            const isSim = topDet.inferenceMode === 'MOCK_SIMULATED';
            setDetectedBox({
              type: topDet.rawClassLabel,
              conf: topDet.rawConfidence,
              desc: `${isSim ? 'Mock AI' : 'ONNX YOLO11s'}: ${topDet.rawClassLabel} (${(topDet.rawConfidence * 100).toFixed(0)}%)`,
              x1: topDet.bboxX1,
              y1: topDet.bboxY1,
              x2: topDet.bboxX2,
              y2: topDet.bboxY2,
              isSimulated: isSim
            });
            setTimeout(() => setDetectedBox(null), 2500);
            if (onNewDetection) onNewDetection();
          } else if (resp?.observationCount > 0 && onNewDetection) {
            onNewDetection();
          }
        }
        frameSeq++;
      } catch (err) {
        console.error('Frame ingestion error:', err);
      }
    }, frameIntervalSec * 1000);

    return () => clearInterval(interval);
  }, [isJourneyActive, journeyId, eligibilityState, isDemoMode, currentLocation, cameraActive, frameIntervalSec]);

  // Telemetry display logic: Never pretend simulated data is physical sensor data
  const hasGenuineGps = !isDemoMode && currentLocation?.speed != null;
  const displaySpeed = hasGenuineGps
    ? `${(currentLocation.speed * 3.6).toFixed(0)} km/h`
    : isDemoMode
    ? '48 km/h [Simulated]'
    : '-- km/h';

  const displayHeading = hasGenuineGps && currentLocation.heading != null
    ? `${currentLocation.heading.toFixed(0)}°`
    : isDemoMode
    ? '218° [Simulated]'
    : '--°';

  // Badge configuration based on eligibility state
  const stateBadgeConfig = {
    RECORDING: {
      label: isDemoMode ? 'SIMULATED CORRIDOR • RECORDING' : 'ESTIMATED ROAD • RECORDING',
      color: '#00f5a0',
      bg: 'rgba(0, 245, 160, 0.15)',
      border: 'rgba(0, 245, 160, 0.35)'
    },
    PAUSED_STATIONARY: { label: 'PAUSED • VEHICLE STATIONARY', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)' },
    ROAD_CANDIDATE: { label: 'ROAD ELIGIBILITY: UNVERIFIED (LOCKING)', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.35)' },
    GPS_ACCURACY_POOR: { label: 'PAUSED • GPS ACCURACY POOR', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.35)' },
    GPS_UNAVAILABLE: { label: 'ROAD ELIGIBILITY: UNKNOWN (NO GPS)', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.35)' },
    CAMERA_PERMISSION_REQUIRED: { label: 'CAMERA PERMISSION REQUIRED', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.35)' },
    LOCATION_UNCERTAIN: { label: 'ROAD ELIGIBILITY: UNKNOWN', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)' },
    STOPPED: { label: 'MONITORING INACTIVE', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.25)' }
  }[eligibilityState] || { label: eligibilityState, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.25)' };

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      minHeight: '280px',
      backgroundColor: '#090d16',
      borderRadius: 'inherit',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Live Video Feed */}
      {cameraActive && !isDemoMode ? (
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        /* Synthetic Road Viewfinder Simulation */
        <div style={{
          width: '100%',
          height: '100%',
          background: 'radial-gradient(ellipse at center, #172033 0%, #090d16 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}>
          {/* Road Lines */}
          <div style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            opacity: isJourneyActive && eligibilityState === 'RECORDING' ? 0.4 : 0.15
          }}>
            <div style={{
              position: 'absolute',
              top: '40%',
              left: '50%',
              width: '4px',
              height: '100%',
              background: '#facc15',
              transform: 'translateX(-50%)',
              boxShadow: '0 0 10px #facc15'
            }} />
          </div>

          <div style={{ zIndex: 10, textAlign: 'center', padding: '16px' }}>
            <Eye size={36} color={eligibilityState === 'RECORDING' ? '#00f5a0' : '#64748b'} style={{ marginBottom: '8px' }} />
            <h4 style={{ margin: '0 0 4px', fontSize: '14px', color: '#f8fafc' }}>
              {isDemoMode ? 'Synthetic Dash-Cam Stream (NH-16 Corridor)' : 'Mobile Dashcam Viewfinder'}
            </h4>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
              {isJourneyActive ? 'Real-time road scanning and temporal detection active' : 'Start journey to activate AI sensor pipeline'}
            </p>
          </div>
        </div>
      )}

      {/* Detection Bounding Box Overlay */}
      {detectedBox && (
        <div style={{
          position: 'absolute',
          top: detectedBox.y1 != null ? `${(detectedBox.y1 * 100).toFixed(1)}%` : '35%',
          left: detectedBox.x1 != null ? `${(detectedBox.x1 * 100).toFixed(1)}%` : '30%',
          width: (detectedBox.x2 != null && detectedBox.x1 != null) ? `${Math.max(14, (detectedBox.x2 - detectedBox.x1) * 100).toFixed(1)}%` : '40%',
          height: (detectedBox.y2 != null && detectedBox.y1 != null) ? `${Math.max(12, (detectedBox.y2 - detectedBox.y1) * 100).toFixed(1)}%` : '35%',
          border: `2px solid ${detectedBox.type === 'POTHOLE' ? '#ff3366' : '#ffb703'}`,
          backgroundColor: detectedBox.type === 'POTHOLE' ? 'rgba(255, 51, 102, 0.15)' : 'rgba(255, 183, 3, 0.15)',
          borderRadius: '6px',
          boxShadow: `0 0 15px ${detectedBox.type === 'POTHOLE' ? 'rgba(255, 51, 102, 0.5)' : 'rgba(255, 183, 3, 0.5)'}`,
          pointerEvents: 'none',
          zIndex: 40,
          transition: 'all 0.15s ease'
        }}>
          <span style={{
            position: 'absolute',
            top: '-24px',
            left: '0',
            backgroundColor: detectedBox.type === 'POTHOLE' ? '#ff3366' : '#ffb703',
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '4px',
            whiteSpace: 'nowrap'
          }}>
            {detectedBox.desc}
          </span>
        </div>
      )}

      {/* Top Left: Conservative Eligibility State Machine Badge */}
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        <div style={{
          background: stateBadgeConfig.bg,
          border: `1px solid ${stateBadgeConfig.border}`,
          color: stateBadgeConfig.color,
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 700,
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <div style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: stateBadgeConfig.color,
            boxShadow: `0 0 8px ${stateBadgeConfig.color}`
          }} />
          <span>{stateBadgeConfig.label}</span>
        </div>
      </div>

      {/* Top Right: Telemetry Chips */}
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        zIndex: 50,
        display: 'flex',
        gap: '8px'
      }}>
        <div className="hud-chip">
          <Gauge size={13} />
          <span>{displaySpeed}</span>
        </div>
        <div className="hud-chip">
          <Compass size={13} />
          <span>{displayHeading}</span>
        </div>
      </div>

      {/* Bottom Center: Browser Background Restriction Disclosure */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '12px',
        right: '12px',
        zIndex: 50,
        background: 'rgba(5, 8, 16, 0.75)',
        backdropFilter: 'blur(4px)',
        padding: '4px 10px',
        borderRadius: '6px',
        fontSize: '10px',
        color: '#94a3b8',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>Safety Notice: Keep app active in foreground while driving. Do not touch phone while operating vehicle.</span>
        <span style={{ color: '#cbd5e1' }}>{isDemoMode ? 'SIMULATED DEMO' : 'LIVE SENSORS'}</span>
      </div>
    </div>
  );
}
