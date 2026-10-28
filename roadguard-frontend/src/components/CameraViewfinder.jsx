import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Camera,
  Compass,
  Gauge,
  RefreshCw,
  VideoOff,
  ShieldAlert,
  AlertCircle,
  AlertTriangle,
  Cpu,
  Square,
  Play
} from 'lucide-react';
import { uploadEvidenceFrame } from '../api';
import { isValidCoordinate, isFixStale } from '../utils/geoUtils';

/**
 * Human-friendly defect class names for YOLO11s road-damage model
 */
function formatDefectName(rawLabel) {
  if (!rawLabel) return 'Road Defect';
  switch (rawLabel.toLowerCase()) {
    case 'buraco':
      return 'Pothole';
    case 'trinca_malha':
      return 'Alligator Crack';
    case 'trinca_longitudinal':
      return 'Longitudinal Crack';
    case 'trinca_transversal':
      return 'Transverse Crack';
    case 'tampa_bueiro':
      return 'Utility / Manhole Cover';
    default:
      return rawLabel;
  }
}

/**
 * CAMERA LIFECYCLE STATES:
 * - 'IDLE': Camera is stopped / off (initial state)
 * - 'REQUESTING_PERMISSION': getUserMedia prompt is awaiting user approval
 * - 'STARTING': Stream obtained, setting video srcObject and playing
 * - 'RUNNING': Stream actively playing in video element and ready for inference
 * - 'STOPPING': Stopping all tracks and releasing camera hardware
 * - 'ERROR': Camera failed to start (denied, unavailable, security)
 */
export default function CameraViewfinder({
  isJourneyActive,
  journeyId,
  currentLocation,
  onNewDetection,
  onFrameProcessed,
  settings = {},
  onEligibilityChange,
  cameraState: externalCameraState,
  onCameraStateChange,
  onFileGrievance
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const wakeLockRef = useRef(null);
  const inFlightInferenceRef = useRef(false);
  const frameSeqRef = useRef(1);

  // Generation ID token to cancel late-resolving getUserMedia promises
  const cameraGenerationRef = useRef(0);

  // Internal Camera Lifecycle State Machine
  const [lifecycleState, setLifecycleState] = useState('IDLE');

  // Map internal state to legacy external state for parent compatibility
  const updateLifecycleState = useCallback((nextState) => {
    setLifecycleState(nextState);
    if (onCameraStateChange) {
      // Map to legacy states:
      // 'RUNNING' -> 'CAMERA_READY'
      // 'REQUESTING_PERMISSION' -> 'REQUESTING_PERMISSION'
      // 'IDLE' | 'STOPPING' -> 'PERMISSION_REQUIRED'
      // 'ERROR' -> 'CAMERA_UNAVAILABLE' / 'PERMISSION_DENIED'
      let mapped = 'PERMISSION_REQUIRED';
      if (nextState === 'RUNNING') mapped = 'CAMERA_READY';
      else if (nextState === 'REQUESTING_PERMISSION' || nextState === 'STARTING') mapped = 'REQUESTING_PERMISSION';
      else if (nextState === 'ERROR') mapped = 'CAMERA_UNAVAILABLE';
      onCameraStateChange(mapped);
    }
    if (onEligibilityChange) {
      onEligibilityChange(nextState === 'RUNNING' ? 'READY' : nextState);
    }
  }, [onCameraStateChange, onEligibilityChange]);

  const [cameraError, setCameraError] = useState(null);
  const [errorType, setErrorType] = useState(null); // 'PERMISSION_DENIED' | 'UNAVAILABLE' | 'SECURITY'
  const [detectedBox, setDetectedBox] = useState(null);
  const [lastInferenceStatus, setLastInferenceStatus] = useState(null);
  const [_lastUploadedFrame, setLastUploadedFrame] = useState(null);
  const [frameCount, setFrameCount] = useState(0);
  const [capturedScreenshots, setCapturedScreenshots] = useState([]);

  const frameIntervalSec = settings.frameInterval || 2.8;

  // Decouple camera capture & inference loop from rapid GPS state updates
  const currentLocationRef = useRef(currentLocation);
  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

  // 1. WakeLock management during active drive mode
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

  // 2. Central idempotent stopCamera operation
  const stopCamera = useCallback(() => {
    // Invalidate any pending getUserMedia promise or in-flight inference
    cameraGenerationRef.current += 1;
    updateLifecycleState('STOPPING');
    inFlightInferenceRef.current = false;

    // Release all hardware stream tracks immediately
    if (streamRef.current) {
      try {
        const tracks = streamRef.current.getTracks();
        tracks.forEach((track) => {
          try {
            track.stop();
          } catch (tErr) {
            console.warn('Track stop warning:', tErr);
          }
        });
      } catch (err) {
        console.warn('Stream tracks release warning:', err);
      }
      streamRef.current = null;
    }

    // Detach and pause video element
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch (pErr) {
        // Ignored
      }
      videoRef.current.srcObject = null;
    }

    setDetectedBox(null);
    updateLifecycleState('IDLE');
    setLastInferenceStatus(isJourneyActive ? 'Driving Mode active — Camera stopped' : 'Camera off');
  }, [isJourneyActive, updateLifecycleState]);

  // 3. Central startCamera operation with cancellation token & error handling
  const startCamera = useCallback(async () => {
    // If currently running, stop first to reset cleanly
    if (streamRef.current) {
      stopCamera();
    }

    const currentGeneration = ++cameraGenerationRef.current;
    updateLifecycleState('REQUESTING_PERMISSION');
    setCameraError(null);
    setErrorType(null);

    // Verify browser supports mediaDevices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const isLocalhost = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
      );
      const msg = (!isHttps && !isLocalhost)
        ? 'Camera access requires HTTPS or localhost origin. Please load site over HTTPS.'
        : 'Browser MediaDevices API is not supported on this device/browser.';
      setCameraError(msg);
      setErrorType('UNAVAILABLE');
      updateLifecycleState('ERROR');
      return;
    }

    try {
      // Prefer rear-facing camera on mobile dashcam mounts, fallback to any video
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Race condition check: If user clicked Stop while getUserMedia was pending, discard immediately!
      if (cameraGenerationRef.current !== currentGeneration) {
        console.log('Discarding late-resolving camera stream after stop request');
        stream.getTracks().forEach((track) => {
          try { track.stop(); } catch (e) {}
        });
        return;
      }

      updateLifecycleState('STARTING');
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          // Autoplay policy fallback: muted video is required by modern browsers
          if (videoRef.current) {
            videoRef.current.muted = true;
            await videoRef.current.play();
          }
        }
      }

      // Check again if cancelled during play()
      if (cameraGenerationRef.current !== currentGeneration) {
        stopCamera();
        return;
      }

      setCameraError(null);
      setErrorType(null);
      updateLifecycleState('RUNNING');
      setLastInferenceStatus(isJourneyActive ? 'ONNX vision pipeline monitoring active' : 'Live dashcam feed active');
    } catch (err) {
      // If cancelled, do not transition to error
      if (cameraGenerationRef.current !== currentGeneration) {
        return;
      }

      console.warn('Camera request error:', err.name, err.message);

      let userMsg = err.message || 'Failed to start camera';
      let errKind = 'UNAVAILABLE';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errKind = 'PERMISSION_DENIED';
        userMsg = 'Camera permission was denied. Please allow camera access in browser site settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errKind = 'UNAVAILABLE';
        userMsg = 'No camera hardware found on this device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errKind = 'UNAVAILABLE';
        userMsg = 'Camera is currently in use by another application or locked by the system.';
      } else if (err.name === 'SecurityError') {
        errKind = 'SECURITY';
        userMsg = 'Camera access blocked due to security restrictions. HTTPS is required.';
      }

      setCameraError(userMsg);
      setErrorType(errKind);
      updateLifecycleState('ERROR');
    }
  }, [stopCamera, updateLifecycleState, isJourneyActive]);

  // Synchronize with external camera state changes from parent controls
  useEffect(() => {
    if (externalCameraState === 'REQUESTING_PERMISSION' && lifecycleState === 'IDLE') {
      startCamera();
    } else if ((externalCameraState === 'PERMISSION_REQUIRED' || externalCameraState === 'IDLE') && lifecycleState === 'RUNNING') {
      stopCamera();
    }
  }, [externalCameraState, lifecycleState, startCamera, stopCamera]);

  // Teardown hardware on unmount
  useEffect(() => {
    return () => {
      cameraGenerationRef.current += 1;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          try { track.stop(); } catch (e) {}
        });
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  // 4. Reset frame sequence when journey starts/stops
  useEffect(() => {
    if (isJourneyActive) {
      frameSeqRef.current = 1;
      setFrameCount(0);
      setDetectedBox(null);
      setLastInferenceStatus(
        lifecycleState === 'RUNNING'
          ? 'Drive Mode active — initiating ONNX vision pipeline...'
          : 'Drive Mode active — Camera is stopped (GPS-only route tracking)'
      );
    } else {
      setDetectedBox(null);
      setLastInferenceStatus(lifecycleState === 'RUNNING' ? 'Live dashcam feed active' : null);
    }
  }, [isJourneyActive, lifecycleState]);

  // 5. Live Frame Capture & Real ONNX Inference Loop
  useEffect(() => {
    // Only capture frames when camera is RUNNING (supports both active journey and standalone quick scan)
    if (lifecycleState !== 'RUNNING') {
      return;
    }

    const interval = setInterval(async () => {
      // Guard: only 1 in-flight inference request at a time to prevent server flooding
      if (inFlightInferenceRef.current || lifecycleState !== 'RUNNING') {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || video.paused || video.ended) {
        return;
      }

      inFlightInferenceRef.current = true;
      const currentGen = cameraGenerationRef.current;

      try {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert captured real frame to JPEG Blob
        const blob = await new Promise((resolve) => {
          canvas.toBlob(resolve, 'image/jpeg', 0.85);
        });

        // Abort if camera was stopped while converting blob
        if (!blob || cameraGenerationRef.current !== currentGen) {
          inFlightInferenceRef.current = false;
          return;
        }

        const currentSeq = frameSeqRef.current++;
        const file = new File([blob], `frame_${currentSeq}.jpg`, { type: 'image/jpeg' });

        // Compute SHA-256 cryptographic digest of captured frame
        let clientSha256 = null;
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          clientSha256 = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        } catch (hashErr) {
          console.warn('WebCrypto SHA-256 unavailable:', hashErr);
        }

        const latestLoc = currentLocationRef.current;
        const rawLat = latestLoc?.lat;
        const rawLon = latestLoc?.lon;
        const accuracy = latestLoc?.accuracy;
        const heading = latestLoc?.heading;
        const speed = latestLoc?.speed;
        const timestamp = latestLoc?.timestamp;

        // Verify coordinate validity and freshness
        const hasValidCoords = isValidCoordinate(rawLat, rawLon);
        const isStale = isFixStale(timestamp, 60000); // 60-second stale limit

        // Accept valid browser coordinates even when accuracy is coarse (e.g. ±97m or ±149m).
        // If GPS is OFF, missing, or stale, send null coordinates (GPS-independent mode).
        const sanitizedLat = (hasValidCoords && !isStale) ? rawLat : null;
        const sanitizedLon = (hasValidCoords && !isStale) ? rawLon : null;

        // Upload genuine frame to backend ONNX pipeline with verified telemetry
        const resp = await uploadEvidenceFrame(journeyId || null, file, {
          latitude: sanitizedLat,
          longitude: sanitizedLon,
          capturedAt: new Date().toISOString(),
          frameSequence: currentSeq,
          gpsAccuracy: accuracy,
          heading: heading,
          speed: speed,
          clientSha256: clientSha256
        });

        // Abort if camera was stopped while upload was in flight
        if (cameraGenerationRef.current !== currentGen) {
          return;
        }

        setLastUploadedFrame(resp);
        setFrameCount(currentSeq);
        if (onFrameProcessed) onFrameProcessed(resp);

        // Process genuine ONNX detections
        if (resp?.observations && resp.observations.length > 0) {
          const topDet = resp.observations[0];
          const defectFormatted = formatDefectName(topDet.rawClassLabel);
          const confPercent = ((topDet.rawConfidence || 0) * 100).toFixed(0);

          let thumbUrl = null;
          try {
            thumbUrl = canvas.toDataURL('image/jpeg', 0.6);
          } catch (thumbErr) {
            console.debug('Failed to generate frame thumbnail:', thumbErr);
          }

          if (thumbUrl) {
            setCapturedScreenshots((prev) => [
              {
                id: Date.now() + Math.random(),
                url: thumbUrl,
                timestamp: new Date().toLocaleTimeString(),
                label: defectFormatted,
                confidence: confPercent,
                seq: currentSeq,
                observation: topDet,
                latitude: sanitizedLat,
                longitude: sanitizedLon
              },
              ...prev
            ].slice(0, 8));
          }

          setDetectedBox({
            type: topDet.rawClassLabel,
            conf: topDet.rawConfidence,
            desc: `ONNX YOLO11s: ${defectFormatted} (${confPercent}%)`,
            x1: topDet.bboxX1,
            y1: topDet.bboxY1,
            x2: topDet.bboxX2,
            y2: topDet.bboxY2,
            isSimulated: false
          });

          setLastInferenceStatus(`Detected: ${defectFormatted} (${confPercent}%) — Frame #${currentSeq}`);
          setTimeout(() => {
            if (cameraGenerationRef.current === currentGen) {
              setDetectedBox(null);
            }
          }, 2400);

          if (onNewDetection) onNewDetection();
        } else {
          setDetectedBox(null);
          setLastInferenceStatus(`Frame #${currentSeq}: Road surface normal (No defects detected)`);
        }
      } catch (err) {
        if (cameraGenerationRef.current === currentGen) {
          console.warn('Real frame inference error:', err.message);
          setLastInferenceStatus(`Inference warning: ${err.message}`);
        }
      } finally {
        if (cameraGenerationRef.current === currentGen) {
          inFlightInferenceRef.current = false;
        }
      }
    }, frameIntervalSec * 1000);

    return () => clearInterval(interval);
  }, [journeyId, lifecycleState, frameIntervalSec, onFrameProcessed, onNewDetection]);

  // Genuine GPS telemetry formatted for HUD chips
  const hasGenuineGps = currentLocation?.speed != null;
  const displaySpeed = hasGenuineGps
    ? `${(currentLocation.speed * 3.6).toFixed(0)} km/h`
    : '-- km/h';

  const displayHeading = currentLocation?.heading != null
    ? `${currentLocation.heading.toFixed(0)}°`
    : '--°';

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
      {/* Hidden processing canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* 1. Live Video Feed Element */}
      <video
        ref={videoRef}
        playsInline
        autoPlay
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: lifecycleState === 'RUNNING' ? 'block' : 'none'
        }}
      />

      {/* 2. Camera Controls & Status Overlay when Stopped / Inactive / Error */}
      {lifecycleState !== 'RUNNING' && (
        <div style={{
          width: '100%',
          height: '100%',
          background: 'radial-gradient(ellipse at center, #172033 0%, #090d16 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center'
        }}>
          {lifecycleState === 'IDLE' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', maxWidth: '360px' }}>
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'rgba(0, 245, 160, 0.12)',
                border: '1px solid rgba(0, 245, 160, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#00f5a0'
              }}>
                <Camera size={26} />
              </div>
              <div>
                <h4 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                  {isJourneyActive ? 'Driving Mode Active — Camera Stopped' : 'Live Dashcam Viewfinder'}
                </h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                  {isJourneyActive
                    ? 'GPS route tracking and distance recording are still active. Click Start Camera to resume road-defect detection.'
                    : 'Real camera frames are analyzed by the on-device or cloud ONNX road-defect detection model.'}
                </p>
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#64748b' }}>
                  Requires HTTPS or localhost and browser camera permission.
                </p>
              </div>
              <button
                type="button"
                onClick={startCamera}
                className="btn-primary"
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 0 16px rgba(0, 245, 160, 0.3)',
                  cursor: 'pointer'
                }}
              >
                <Play size={16} fill="#04121d" /> Start Camera
              </button>
            </div>
          )}

          {lifecycleState === 'REQUESTING_PERMISSION' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <RefreshCw size={32} color="#00f5a0" className="spin-animation" />
              <p style={{ margin: 0, fontSize: '13px', color: '#f8fafc', fontWeight: 600 }}>
                Requesting camera access from browser...
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                Please select "Allow" on the browser prompt.
              </p>
              <button
                type="button"
                onClick={stopCamera}
                className="btn-secondary"
                style={{ marginTop: '8px', padding: '6px 14px', fontSize: '12px' }}
              >
                Cancel
              </button>
            </div>
          )}

          {lifecycleState === 'STARTING' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <RefreshCw size={32} color="#00f5a0" className="spin-animation" />
              <p style={{ margin: 0, fontSize: '13px', color: '#f8fafc', fontWeight: 600 }}>
                Initializing camera feed...
              </p>
              <button
                type="button"
                onClick={stopCamera}
                className="btn-secondary"
                style={{ marginTop: '8px', padding: '6px 14px', fontSize: '12px' }}
              >
                Cancel
              </button>
            </div>
          )}

          {lifecycleState === 'STOPPING' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <RefreshCw size={28} color="#94a3b8" className="spin-animation" />
              <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', fontWeight: 600 }}>
                Releasing camera hardware...
              </p>
            </div>
          )}

          {lifecycleState === 'ERROR' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', maxWidth: '360px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: errorType === 'PERMISSION_DENIED' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                border: `1px solid ${errorType === 'PERMISSION_DENIED' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: errorType === 'PERMISSION_DENIED' ? '#ef4444' : '#f59e0b'
              }}>
                {errorType === 'PERMISSION_DENIED' ? <ShieldAlert size={26} /> : <VideoOff size={26} />}
              </div>
              <div>
                <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: errorType === 'PERMISSION_DENIED' ? '#fca5a5' : '#fef3c7' }}>
                  {errorType === 'PERMISSION_DENIED' ? 'Camera Permission Denied' : 'Camera Unavailable'}
                </h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', lineHeight: 1.4 }}>
                  {cameraError || 'Could not access camera video stream.'}
                </p>
              </div>
              <button
                type="button"
                onClick={startCamera}
                className="btn-secondary"
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={14} /> Retry Camera
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. Real ONNX Detection Bounding Box Overlay */}
      {detectedBox && lifecycleState === 'RUNNING' && (
        <>
          {/* Prominent Pulsing Alert Triangle Badge */}
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            backgroundColor: 'rgba(239, 68, 68, 0.95)',
            border: '2px solid #ffffff',
            borderRadius: '30px',
            padding: '6px 18px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 800,
            fontSize: '12px',
            boxShadow: '0 0 25px rgba(239, 68, 68, 0.8)'
          }}>
            <AlertTriangle size={17} color="#ffffff" />
            <span>ROAD DEFECT DETECTED: {detectedBox.desc?.replace('ONNX YOLO11s: ', '')}</span>
          </div>

          <div style={{
            position: 'absolute',
            top: detectedBox.y1 != null ? `${(detectedBox.y1 * 100).toFixed(1)}%` : '35%',
            left: detectedBox.x1 != null ? `${(detectedBox.x1 * 100).toFixed(1)}%` : '30%',
            width: (detectedBox.x2 != null && detectedBox.x1 != null) ? `${Math.max(14, (detectedBox.x2 - detectedBox.x1) * 100).toFixed(1)}%` : '40%',
            height: (detectedBox.y2 != null && detectedBox.y1 != null) ? `${Math.max(12, (detectedBox.y2 - detectedBox.y1) * 100).toFixed(1)}%` : '35%',
            border: `2px solid ${detectedBox.type?.toLowerCase().includes('buraco') ? '#ff3366' : '#ffb703'}`,
            backgroundColor: detectedBox.type?.toLowerCase().includes('buraco') ? 'rgba(255, 51, 102, 0.18)' : 'rgba(255, 183, 3, 0.18)',
            borderRadius: '6px',
            boxShadow: `0 0 15px ${detectedBox.type?.toLowerCase().includes('buraco') ? 'rgba(255, 51, 102, 0.6)' : 'rgba(255, 183, 3, 0.6)'}`,
            pointerEvents: 'none',
            zIndex: 40,
            transition: 'all 0.12s ease'
          }}>
            <span style={{
              position: 'absolute',
              top: '-24px',
              left: '0',
              backgroundColor: detectedBox.type?.toLowerCase().includes('buraco') ? '#ff3366' : '#ffb703',
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
        </>
      )}

      {/* 4. Top Left HUD Badge & Prominent Stop Camera Control */}
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        {/* Status Pill */}
        <div style={{
          background: isJourneyActive ? 'rgba(239, 68, 68, 0.25)' : (lifecycleState === 'RUNNING' ? 'rgba(0, 245, 160, 0.18)' : 'rgba(148, 163, 184, 0.15)'),
          border: `1px solid ${isJourneyActive ? 'rgba(239, 68, 68, 0.6)' : (lifecycleState === 'RUNNING' ? 'rgba(0, 245, 160, 0.4)' : 'rgba(148, 163, 184, 0.25)')}`,
          color: isJourneyActive ? '#fca5a5' : (lifecycleState === 'RUNNING' ? '#00f5a0' : '#cbd5e1'),
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
            backgroundColor: isJourneyActive ? '#ef4444' : (lifecycleState === 'RUNNING' ? '#00f5a0' : '#64748b'),
            boxShadow: isJourneyActive ? '0 0 8px #ef4444' : (lifecycleState === 'RUNNING' ? '0 0 8px #00f5a0' : 'none')
          }} />
          <span>
            {lifecycleState === 'RUNNING'
              ? (isJourneyActive ? `REC • LIVE CAMERA (${frameCount} frames)` : 'LIVE CAMERA ACTIVE')
              : (lifecycleState === 'REQUESTING_PERMISSION' ? 'REQUESTING ACCESS...' : 'CAMERA OFF')}
          </span>
        </div>

        {/* PROMINENT STOP CAMERA BUTTON: Always visible while camera is active or starting */}
        {lifecycleState === 'RUNNING' && (
          <button
            type="button"
            onClick={stopCamera}
            title="Stop Camera Stream"
            style={{
              background: 'rgba(239, 68, 68, 0.85)',
              border: '1px solid #ef4444',
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)',
              transition: 'all 0.15s ease'
            }}
          >
            <Square size={11} fill="white" /> Stop Camera
          </button>
        )}
      </div>

      {/* 5. Top Right HUD: Live GPS Speed & Heading */}
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        zIndex: 50,
        display: 'flex',
        gap: '8px'
      }}>
        <div className="hud-chip" title="Genuine device GPS speed">
          <Gauge size={13} />
          <span>{displaySpeed}</span>
        </div>
        <div className="hud-chip" title="Genuine device GPS heading">
          <Compass size={13} />
          <span>{displayHeading}</span>
        </div>
      </div>

      {/* Captured Pothole Screenshots Strip */}
      {capturedScreenshots.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '44px',
          left: '12px',
          right: '12px',
          zIndex: 55,
          background: 'rgba(5, 8, 16, 0.88)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '8px',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Camera size={13} color="#00f5a0" /> Captured Defects ({capturedScreenshots.length})
            </span>
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>Real-time ONNX Evidence</span>
          </div>
          <div style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '2px'
          }}>
            {capturedScreenshots.map((item) => (
              <div
                key={item.id}
                style={{
                  position: 'relative',
                  flexShrink: 0,
                  width: '94px',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 51, 102, 0.45)',
                  backgroundColor: '#000'
                }}
              >
                <img
                  src={item.url}
                  alt={item.label}
                  style={{ width: '100%', height: '54px', objectFit: 'cover', display: 'block' }}
                />
                <div style={{
                  padding: '3px 4px',
                  fontSize: '9px',
                  color: '#cbd5e1',
                  background: 'rgba(0,0,0,0.75)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}>
                  <div style={{ color: '#ff3366', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.label} ({item.confidence}%)
                  </div>
                  {onFileGrievance && (
                    <button
                      type="button"
                      onClick={() => onFileGrievance({
                        id: 'cam-' + item.id,
                        defectClass: item.label?.toUpperCase().replace(' ', '_'),
                        defectType: item.label,
                        latitude: item.latitude,
                        longitude: item.longitude,
                        evidencePhotoUrl: item.url,
                        confidenceScore: Number(item.confidence) / 100
                      })}
                      style={{
                        background: '#38bdf8',
                        border: 'none',
                        borderRadius: '3px',
                        color: '#000',
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '2px 4px',
                        cursor: 'pointer',
                        marginTop: '2px'
                      }}
                    >
                      File Grievance
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Bottom Center: Real Inference Status Banner */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '12px',
        right: '12px',
        zIndex: 50,
        background: 'rgba(5, 8, 16, 0.88)',
        backdropFilter: 'blur(6px)',
        border: '1px solid var(--border-subtle)',
        padding: '5px 12px',
        borderRadius: '6px',
        fontSize: '11px',
        color: '#94a3b8',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '6px'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
          <Cpu size={13} color="#a855f7" />
          <span>{lastInferenceStatus || (isJourneyActive ? 'ONNX inference active' : 'Camera standby')}</span>
        </span>
        <span style={{ fontSize: '10px', color: '#64748b' }}>
          {lifecycleState === 'RUNNING' ? 'Rear Camera Active' : 'Camera Hardware Stopped'}
        </span>
      </div>
    </div>
  );
}
