import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Camera,
  Compass,
  Gauge,
  Eye,
  AlertTriangle,
  RefreshCw,
  Video,
  VideoOff,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Cpu
} from 'lucide-react';
import { uploadEvidenceFrame } from '../api';

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

export default function CameraViewfinder({
  isJourneyActive,
  journeyId,
  currentLocation,
  onNewDetection,
  onFrameProcessed,
  settings = {},
  onEligibilityChange,
  cameraState: externalCameraState,
  onCameraStateChange
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const wakeLockRef = useRef(null);
  const inFlightInferenceRef = useRef(false);
  const isRequestingCameraRef = useRef(false);
  const frameSeqRef = useRef(1);

  // Camera States: 'PERMISSION_REQUIRED' | 'REQUESTING_PERMISSION' | 'CAMERA_READY' | 'CAMERA_UNAVAILABLE' | 'PERMISSION_DENIED'
  const [internalCameraState, setInternalCameraState] = useState('PERMISSION_REQUIRED');
  const cameraState = externalCameraState || internalCameraState;

  const updateCameraState = useCallback((newState) => {
    setInternalCameraState(newState);
    if (onCameraStateChange) onCameraStateChange(newState);
    if (onEligibilityChange) onEligibilityChange(newState === 'CAMERA_READY' ? 'READY' : newState);
  }, [onCameraStateChange, onEligibilityChange]);

  const [cameraError, setCameraError] = useState(null);
  const [detectedBox, setDetectedBox] = useState(null);
  const [lastInferenceStatus, setLastInferenceStatus] = useState(null);
  const [lastUploadedFrame, setLastUploadedFrame] = useState(null);
  const [frameCount, setFrameCount] = useState(0);

  const frameIntervalSec = settings.frameInterval || 2.8;

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

  // 2. Start Camera with rear-facing constraint & error classification
  const startCamera = useCallback(async () => {
    if (isRequestingCameraRef.current) return;
    isRequestingCameraRef.current = true;
    updateCameraState('REQUESTING_PERMISSION');
    setCameraError(null);

    // Verify browser supports mediaDevices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      isRequestingCameraRef.current = false;
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const isLocalhost = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
      );
      const msg = (!isHttps && !isLocalhost)
        ? 'Camera access requires HTTPS or localhost origin. Please load site over HTTPS.'
        : 'Browser MediaDevices API is not supported on this device/browser.';
      setCameraError(msg);
      updateCameraState('CAMERA_UNAVAILABLE');
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
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          // Autoplay policy fallback: muted video is required by modern browsers
          videoRef.current.muted = true;
          await videoRef.current.play();
        }
      }

      setCameraError(null);
      updateCameraState('CAMERA_READY');
    } catch (err) {
      console.warn('Camera request error:', err.name, err.message);

      let userMsg = err.message || 'Failed to start camera';
      let nextState = 'CAMERA_UNAVAILABLE';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        nextState = 'PERMISSION_DENIED';
        userMsg = 'Camera permission was denied. Please allow camera access in browser site settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        nextState = 'CAMERA_UNAVAILABLE';
        userMsg = 'No camera hardware found on this device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        nextState = 'CAMERA_UNAVAILABLE';
        userMsg = 'Camera is currently in use by another application or locked by the system.';
      } else if (err.name === 'SecurityError') {
        nextState = 'CAMERA_UNAVAILABLE';
        userMsg = 'Camera access blocked due to security restrictions. HTTPS is required.';
      }

      setCameraError(userMsg);
      updateCameraState(nextState);
    } finally {
      isRequestingCameraRef.current = false;
    }
  }, [updateCameraState]);

  // 3. Stop Camera and release hardware tracks
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    updateCameraState('PERMISSION_REQUIRED');
  }, [updateCameraState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // 4. Reset frame sequence when journey starts/stops
  useEffect(() => {
    if (isJourneyActive) {
      frameSeqRef.current = 1;
      setFrameCount(0);
      setDetectedBox(null);
      setLastInferenceStatus('Drive Mode active — initiating ONNX vision pipeline...');
    } else {
      setDetectedBox(null);
      setLastInferenceStatus(null);
    }
  }, [isJourneyActive]);

  // 5. Live Frame Capture & Real ONNX Inference Loop
  useEffect(() => {
    if (!isJourneyActive || !journeyId || cameraState !== 'CAMERA_READY') return;

    const interval = setInterval(async () => {
      // Guard: only 1 in-flight inference request at a time to prevent server flooding
      if (inFlightInferenceRef.current) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        return;
      }

      inFlightInferenceRef.current = true;

      try {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert captured real frame to JPEG Blob
        const blob = await new Promise((resolve) => {
          canvas.toBlob(resolve, 'image/jpeg', 0.85);
        });

        if (!blob) {
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

        const lat = currentLocation?.lat;
        const lon = currentLocation?.lon;
        const accuracy = currentLocation?.accuracy;
        const heading = currentLocation?.heading;
        const speed = currentLocation?.speed;

        // 3-Tier GPS Policy:
        // Tier 3 (> 50m): Pause automatic sampling to prevent false coordinate pinning
        if (accuracy != null && accuracy > 50) {
          setLastInferenceStatus(`GPS fix is coarse (±${Math.round(accuracy)}m > 50m limit) — automatic sampling paused until satellite lock improves.`);
          inFlightInferenceRef.current = false;
          return;
        }

        // Upload genuine frame to backend ONNX pipeline with verified telemetry
        const resp = await uploadEvidenceFrame(journeyId, file, {
          latitude: lat,
          longitude: lon,
          capturedAt: new Date().toISOString(),
          frameSequence: currentSeq,
          gpsAccuracy: accuracy,
          heading: heading,
          speed: speed,
          clientSha256: clientSha256
        });

        setLastUploadedFrame(resp);
        setFrameCount(currentSeq);
        if (onFrameProcessed) onFrameProcessed(resp);

        // Process genuine ONNX detections
        if (resp?.observations && resp.observations.length > 0) {
          const topDet = resp.observations[0];
          const defectFormatted = formatDefectName(topDet.rawClassLabel);
          const confPercent = ((topDet.rawConfidence || 0) * 100).toFixed(0);

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
          setTimeout(() => setDetectedBox(null), 2400);

          if (onNewDetection) onNewDetection();
        } else {
          setDetectedBox(null);
          setLastInferenceStatus(`Frame #${currentSeq}: Road surface normal (No defects detected)`);
        }
      } catch (err) {
        console.warn('Real frame inference error:', err.message);
        setLastInferenceStatus(`Inference warning: ${err.message}`);
      } finally {
        inFlightInferenceRef.current = false;
      }
    }, frameIntervalSec * 1000);

    return () => clearInterval(interval);
  }, [isJourneyActive, journeyId, cameraState, currentLocation, frameIntervalSec, onFrameProcessed, onNewDetection]);

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
          display: cameraState === 'CAMERA_READY' ? 'block' : 'none'
        }}
      />

      {/* 2. Camera Placeholder / Action Card when not active */}
      {cameraState !== 'CAMERA_READY' && (
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
          {cameraState === 'PERMISSION_REQUIRED' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', maxWidth: '340px' }}>
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
                  Live Dashcam Viewfinder
                </h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                  Real camera frames are analyzed by the on-device or cloud ONNX road-defect detection model.
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
                  boxShadow: '0 0 16px rgba(0, 245, 160, 0.3)'
                }}
              >
                <Camera size={16} /> Start Camera
              </button>
            </div>
          )}

          {cameraState === 'REQUESTING_PERMISSION' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <RefreshCw size={32} color="#00f5a0" className="spin-animation" />
              <p style={{ margin: 0, fontSize: '13px', color: '#f8fafc', fontWeight: 600 }}>
                Requesting camera access from browser...
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                Please select "Allow" on the browser prompt.
              </p>
            </div>
          )}

          {cameraState === 'PERMISSION_DENIED' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', maxWidth: '340px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444'
              }}>
                <ShieldAlert size={26} />
              </div>
              <div>
                <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#fca5a5' }}>
                  Camera Permission Denied
                </h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', lineHeight: 1.4 }}>
                  {cameraError || 'Camera permission was blocked. Please enable camera in your browser site permissions to capture road imagery.'}
                </p>
              </div>
              <button
                type="button"
                onClick={startCamera}
                className="btn-secondary"
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={14} /> Retry Camera Permission
              </button>
            </div>
          )}

          {cameraState === 'CAMERA_UNAVAILABLE' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', maxWidth: '340px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b'
              }}>
                <VideoOff size={26} />
              </div>
              <div>
                <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#fef3c7' }}>
                  Camera Unavailable
                </h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', lineHeight: 1.4 }}>
                  {cameraError || 'Could not access a video capture device.'}
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
      {detectedBox && cameraState === 'CAMERA_READY' && (
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
      )}

      {/* 4. Top Left HUD Badge */}
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
          background: isJourneyActive ? 'rgba(239, 68, 68, 0.2)' : (cameraState === 'CAMERA_READY' ? 'rgba(0, 245, 160, 0.15)' : 'rgba(148, 163, 184, 0.15)'),
          border: `1px solid ${isJourneyActive ? 'rgba(239, 68, 68, 0.5)' : (cameraState === 'CAMERA_READY' ? 'rgba(0, 245, 160, 0.35)' : 'rgba(148, 163, 184, 0.25)')}`,
          color: isJourneyActive ? '#fca5a5' : (cameraState === 'CAMERA_READY' ? '#00f5a0' : '#cbd5e1'),
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
            backgroundColor: isJourneyActive ? '#ef4444' : (cameraState === 'CAMERA_READY' ? '#00f5a0' : '#64748b'),
            boxShadow: isJourneyActive ? '0 0 8px #ef4444' : (cameraState === 'CAMERA_READY' ? '0 0 8px #00f5a0' : 'none')
          }} />
          <span>
            {isJourneyActive
              ? `REC • LIVE ROAD CAMERA (${frameCount} frames)`
              : (cameraState === 'CAMERA_READY' ? 'LIVE CAMERA READY' : 'CAMERA STANDBY')}
          </span>
        </div>
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

      {/* 6. Bottom Center: Real Inference Status Banner */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '12px',
        right: '12px',
        zIndex: 50,
        background: 'rgba(5, 8, 16, 0.85)',
        backdropFilter: 'blur(6px)',
        border: '1px solid var(--border-subtle)',
        padding: '5px 12px',
        borderRadius: '6px',
        fontSize: '11px',
        color: '#94a3b8',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
          <Cpu size={13} color="#a855f7" />
          <span>{lastInferenceStatus || (isJourneyActive ? 'ONNX inference active' : 'Live dashcam feed')}</span>
        </span>
        <span style={{ fontSize: '10px', color: '#64748b' }}>
          {cameraState === 'CAMERA_READY' ? 'Rear Camera Active' : 'Sensor Off'}
        </span>
      </div>
    </div>
  );
}
