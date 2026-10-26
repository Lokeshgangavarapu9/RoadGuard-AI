import React, { useState } from 'react';
import {
  Activity,
  Camera,
  Compass,
  Navigation,
  Cpu,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Radio
} from 'lucide-react';
import { isValidCoordinate, calculateFixAgeSeconds, isFixStale } from '../utils/geoUtils';

/**
 * Compact, Mobile-Friendly Telemetry & Subsystems Diagnostic Panel
 * Displays live hardware, sensor, AI model, and drive mode states.
 */
export default function DiagnosticPanel({
  cameraState, // 'IDLE' | 'REQUESTING_PERMISSION' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'ERROR'
  isJourneyActive,
  activeJourneyId,
  currentLocation,
  gpsPermissionState, // 'prompt' | 'granted' | 'denied' | 'unavailable'
  gpsErrorMessage,
  health,
  lastInferenceError,
  distanceMeters = 0,
  elapsedSeconds = 0
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasValidGps = currentLocation && isValidCoordinate(currentLocation.lat, currentLocation.lon);
  const isStale = hasValidGps && isFixStale(currentLocation.timestamp, 20000);
  const fixAgeSec = hasValidGps ? calculateFixAgeSeconds(currentLocation.timestamp) : null;

  // Derive human-readable camera status
  let cameraStatusLabel = 'OFF';
  let cameraColor = '#64748b';
  if (cameraState === 'RUNNING' || cameraState === 'CAMERA_READY') {
    cameraStatusLabel = 'ACTIVE';
    cameraColor = '#00f5a0';
  } else if (cameraState === 'REQUESTING_PERMISSION' || cameraState === 'STARTING') {
    cameraStatusLabel = 'STARTING';
    cameraColor = '#f59e0b';
  } else if (cameraState === 'STOPPING') {
    cameraStatusLabel = 'STOPPING';
    cameraColor = '#94a3b8';
  } else if (cameraState === 'ERROR' || cameraState === 'PERMISSION_DENIED' || cameraState === 'CAMERA_UNAVAILABLE') {
    cameraStatusLabel = 'ERROR';
    cameraColor = '#ef4444';
  }

  // Derive human-readable GPS tracking status
  let gpsStatusLabel = 'ACQUIRING';
  let gpsColor = '#f59e0b';
  if (gpsPermissionState === 'denied') {
    gpsStatusLabel = 'DENIED';
    gpsColor = '#ef4444';
  } else if (gpsPermissionState === 'unavailable') {
    gpsStatusLabel = 'UNAVAILABLE';
    gpsColor = '#ef4444';
  } else if (hasValidGps) {
    if (isStale) {
      gpsStatusLabel = 'STALE';
      gpsColor = '#f59e0b';
    } else {
      gpsStatusLabel = 'LOCKED';
      gpsColor = '#00f5a0';
    }
  }

  // Derive AI model status
  const modelLoaded = health?.modelStatus === 'LOADED';
  const modelLabel = modelLoaded ? 'YOLO11s ONNX' : (health?.modelStatus || 'OFFLINE');
  const modelColor = modelLoaded ? '#00f5a0' : '#ef4444';

  return (
    <div style={{
      background: 'rgba(15, 21, 35, 0.88)',
      backdropFilter: 'blur(14px)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '10px',
      overflow: 'hidden',
      transition: 'all 0.2s ease'
    }}>
      {/* 1. Header Bar: Compact summary chips & toggle button */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
          gap: '10px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={15} color="#00f5a0" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.02em' }}>
            SYSTEM DIAGNOSTICS & TELEMETRY
          </span>
          <span style={{
            fontSize: '10px',
            background: isJourneyActive ? 'rgba(0, 245, 160, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${isJourneyActive ? 'rgba(0, 245, 160, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
            color: isJourneyActive ? '#00f5a0' : '#94a3b8',
            padding: '1px 6px',
            borderRadius: '4px',
            fontWeight: 600
          }}>
            {isJourneyActive ? `DRIVE MODE #${activeJourneyId}` : 'STANDBY'}
          </span>
        </div>

        {/* Quick status summary chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#cbd5e1' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: cameraColor }} />
            <span>Cam: <strong>{cameraStatusLabel}</strong></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#cbd5e1' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: gpsColor }} />
            <span>GPS: <strong>{gpsStatusLabel}</strong></span>
          </div>

          <button
            type="button"
            aria-label={isExpanded ? 'Collapse diagnostic panel' : 'Expand diagnostic panel'}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '2px'
            }}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* 2. Detailed Diagnostic Grid: Shown when expanded */}
      {isExpanded && (
        <div style={{
          padding: '10px 14px 14px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '10px'
        }}>
          {/* Card 1: Camera Subsystem */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '8px 10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '10px', fontWeight: 700 }}>
              <Camera size={12} color={cameraColor} />
              <span>CAMERA FEED</span>
            </div>
            <div style={{ marginTop: '4px', fontSize: '13px', fontWeight: 700, color: cameraColor }}>
              {cameraStatusLabel}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              {cameraState === 'RUNNING' || cameraState === 'CAMERA_READY'
                ? 'Rear Dashcam Stream Active'
                : (cameraState === 'STOPPING' ? 'Hardware Releasing' : 'Sensor Powered Down')}
            </div>
          </div>

          {/* Card 2: Drive Mode */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '8px 10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '10px', fontWeight: 700 }}>
              <Navigation size={12} color={isJourneyActive ? '#00f5a0' : '#64748b'} />
              <span>DRIVING MODE</span>
            </div>
            <div style={{ marginTop: '4px', fontSize: '13px', fontWeight: 700, color: isJourneyActive ? '#00f5a0' : '#cbd5e1' }}>
              {isJourneyActive ? `Active (#${activeJourneyId})` : 'Idle / Standby'}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              {isJourneyActive
                ? `${(distanceMeters / 1000).toFixed(2)} km • ${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`
                : 'Ready to record journey'}
            </div>
          </div>

          {/* Card 3: GPS Geolocation Tracking */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '8px 10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '10px', fontWeight: 700 }}>
              <Radio size={12} color={gpsColor} />
              <span>GPS RECEIVER</span>
            </div>
            <div style={{ marginTop: '4px', fontSize: '13px', fontWeight: 700, color: gpsColor }}>
              {gpsStatusLabel} {hasValidGps && currentLocation.accuracy ? `(±${Math.round(currentLocation.accuracy)}m)` : ''}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              {hasValidGps
                ? (isStale ? `Stale reading (${fixAgeSec}s ago)` : `Live Satellite Lock (${fixAgeSec != null ? `${fixAgeSec}s ago` : 'now'})`)
                : (gpsErrorMessage || 'Searching for satellite signal...')}
            </div>
          </div>

          {/* Card 4: GPS Coordinates */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '8px 10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '10px', fontWeight: 700 }}>
              <Compass size={12} color="#38bdf8" />
              <span>COORDINATES (WGS84)</span>
            </div>
            <div style={{ marginTop: '4px', fontSize: '12px', fontWeight: 600, color: hasValidGps ? '#f8fafc' : '#64748b', fontFamily: 'monospace' }}>
              {hasValidGps
                ? `${currentLocation.lat.toFixed(5)}°N, ${currentLocation.lon.toFixed(5)}°E`
                : 'No Valid Fix'}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              {hasValidGps
                ? (currentLocation.speed ? `Speed: ${(currentLocation.speed * 3.6).toFixed(0)} km/h • Head: ${currentLocation.heading?.toFixed(0) || 0}°` : 'Stationary')
                : 'Awaiting device GPS coordinates'}
            </div>
          </div>

          {/* Card 5: AI Model Status */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '8px 10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '10px', fontWeight: 700 }}>
              <Cpu size={12} color={modelColor} />
              <span>AI INFERENCE ENGINE</span>
            </div>
            <div style={{ marginTop: '4px', fontSize: '13px', fontWeight: 700, color: modelColor }}>
              {modelLabel}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              {modelLoaded ? 'ONNX Runtime Operational' : 'Model not loaded on backend'}
            </div>
          </div>

          {/* Card 6: Diagnostic & Warning Alerts */}
          {(gpsErrorMessage || lastInferenceError) && (
            <div style={{
              gridColumn: '1 / -1',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11px',
              color: '#fca5a5'
            }}>
              <AlertTriangle size={14} color="#ef4444" style={{ flexShrink: 0 }} />
              <div>
                {gpsErrorMessage && <div><strong>GPS Notice:</strong> {gpsErrorMessage}</div>}
                {lastInferenceError && <div><strong>Inference Notice:</strong> {lastInferenceError}</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
