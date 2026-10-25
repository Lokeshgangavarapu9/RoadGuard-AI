import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Camera,
  MapPin,
  Cpu,
  Database,
  Map,
  Info,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Eye
} from 'lucide-react';

export default function SettingsView({
  health,
  stats,
  settings,
  onUpdateSettings,
  onResetSession
}) {
  const [savedToast, setSavedToast] = useState(false);

  function handleChange(key, val) {
    onUpdateSettings({ ...settings, [key]: val });
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  }

  return (
    <div style={{
      maxWidth: '840px',
      margin: '0 auto',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            System Settings & Telemetry Policies
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>
            Configure recording thresholds, GPS road-eligibility policies, and AI inference parameters.
          </p>
        </div>
        {savedToast && (
          <div style={{
            background: 'rgba(0, 245, 160, 0.15)',
            border: '1px solid #00f5a0',
            color: '#00f5a0',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <CheckCircle2 size={14} /> Preferences Saved
          </div>
        )}
      </div>

      {/* 1. General Preferences */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={16} color="#00f5a0" /> General Preferences
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
              Speed & Distance Units
            </label>
            <select
              value={settings.units || 'METRIC'}
              onChange={(e) => handleChange('units', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#090d16',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px'
              }}
            >
              <option value="METRIC">Metric (km/h, meters)</option>
              <option value="IMPERIAL">Imperial (mph, feet)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
              Interface Theme
            </label>
            <select
              value={settings.theme || 'DARK'}
              onChange={(e) => handleChange('theme', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#090d16',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px'
              }}
            >
              <option value="DARK">Dark Slate (Default Fleet Mode)</option>
              <option value="HIGH_CONTRAST">High Contrast (Bright Sunlight)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Camera & Drive Mode Recording */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Camera size={16} color="#38bdf8" /> Camera & Drive Mode Recording Policy
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                Continuous Frame Sampling Interval: {settings.frameInterval || 2.8}s
              </span>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                Rate at which road images are captured and sent to ONNX inference pipeline.
              </p>
            </div>
            <input
              type="range"
              min="1.5"
              max="5.0"
              step="0.5"
              value={settings.frameInterval || 2.8}
              onChange={(e) => handleChange('frameInterval', parseFloat(e.target.value))}
              style={{ width: '160px', accentColor: '#00f5a0' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px' }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                Stationary Pause Grace Period: {settings.stationaryGraceSec || 10}s
              </span>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                Automatically pause capture when vehicle speed drops below 2 km/h for this duration.
              </p>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              step="5"
              value={settings.stationaryGraceSec || 10}
              onChange={(e) => handleChange('stationaryGraceSec', parseInt(e.target.value, 10))}
              style={{ width: '160px', accentColor: '#38bdf8' }}
            />
          </div>

          <div style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '12px',
            color: '#bae6fd',
            lineHeight: 1.4
          }}>
            <strong>Browser Background Limitation Notice:</strong> Web browsers may throttle timers, camera frames, and GPS telemetry when a tab is in the background or the screen is locked. Keep the RoadGuard AI tab foregrounded during vehicle journeys for continuous monitoring.
          </div>
        </div>
      </div>

      {/* 3. Location & Conservative Road Eligibility */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={16} color="#f59e0b" /> Location & Road Eligibility State Machine
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                Maximum Acceptable GPS Uncertainty: {settings.maxGpsAccuracy || 25}m
              </span>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                If GPS accuracy exceeds this radius, state drops to GPS_ACCURACY_POOR and recording pauses.
              </p>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              step="5"
              value={settings.maxGpsAccuracy || 25}
              onChange={(e) => handleChange('maxGpsAccuracy', parseInt(e.target.value, 10))}
              style={{ width: '160px', accentColor: '#f59e0b' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px' }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                Fail-Closed Road Eligibility Policy
              </span>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                Require confirmed road segment candidate before creating official defect records.
              </p>
            </div>
            <span style={{
              background: 'rgba(0, 245, 160, 0.15)',
              color: '#00f5a0',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700
            }}>
              ENABLED (STRICT)
            </span>
          </div>
        </div>
      </div>

      {/* 4. AI Model & Inference Pipeline */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={16} color="#a855f7" /> AI Model & Inference Configuration
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            <div style={{ background: '#090d16', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <span style={{ fontSize: '11px', color: '#64748b' }}>MODEL ARCHITECTURE</span>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                YOLO11s ONNX (Road Damage)
              </div>
              <div style={{ fontSize: '11px', color: '#00f5a0', marginTop: '2px' }}>
                Input: [1, 3, 640, 640] • FP32
              </div>
            </div>

            <div style={{ background: '#090d16', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <span style={{ fontSize: '11px', color: '#64748b' }}>EXECUTION RUNTIME</span>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                Microsoft ONNX Runtime 1.17.1
              </div>
              <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '2px' }}>
                Provider: CPUExecutionProvider
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                Candidate Confidence Threshold: {((settings.confidenceThreshold || 0.25) * 100).toFixed(0)}%
              </span>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                Raw ONNX detections below this probability score are rejected prior to temporal clustering.
              </p>
            </div>
            <input
              type="range"
              min="0.20"
              max="0.65"
              step="0.05"
              value={settings.confidenceThreshold || 0.25}
              onChange={(e) => handleChange('confidenceThreshold', parseFloat(e.target.value))}
              style={{ width: '160px', accentColor: '#a855f7' }}
            />
          </div>

          <div style={{
            background: 'rgba(168, 85, 247, 0.08)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '12px',
            color: '#e9d5ff',
            lineHeight: 1.4
          }}>
            <strong>Important Provenance Distinction:</strong> AI model confidence score reflects statistical classification probability in camera frames, not verified physical ground truth. A detection only becomes a confirmed issue after multi-pass temporal consistency and spatial clustering within 15 meters.
          </div>
        </div>
      </div>

      {/* 5. Map & Tile Provider */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Map size={16} color="#00f5a0" /> Geospatial Mapping Provider
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
            <span style={{ color: '#94a3b8' }}>Tile Provider:</span>
            <strong style={{ color: '#f8fafc', wordBreak: 'break-word', textAlign: 'right' }}>OpenStreetMap Standard Raster (OSM Foundation)</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
            <span style={{ color: '#94a3b8' }}>Tile URL Template:</span>
            <span style={{ fontFamily: 'monospace', color: '#00f5a0', fontSize: '12px', wordBreak: 'break-all', textAlign: 'right' }}>
              https://tile.openstreetmap.org/{'{z}'}/{'{x}'}/{'{y}'}.png
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
            <span style={{ color: '#94a3b8' }}>Mandatory Attribution:</span>
            <span style={{ color: '#cbd5e1', wordBreak: 'break-word', textAlign: 'right' }}>© OpenStreetMap contributors</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
            <span style={{ color: '#94a3b8' }}>Watermark Status:</span>
            <span style={{ color: '#00f5a0', fontWeight: 600 }}>CLEAN (No Carto API-key watermark)</span>
          </div>
        </div>
      </div>

      {/* 6. Storage & Diagnostics */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={16} color="#ec4899" /> Evidence Storage & Privacy
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
            <span style={{ color: '#94a3b8' }}>Local Storage Base Path:</span>
            <span style={{ fontFamily: 'monospace', color: '#f8fafc', wordBreak: 'break-all' }}>./uploads/evidence</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
            <span style={{ color: '#94a3b8' }}>Integrity Verification:</span>
            <span style={{ color: '#00f5a0' }}>SHA-256 Per-Frame Digest</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
            <span style={{ color: '#94a3b8' }}>PII Anonymization:</span>
            <span style={{ color: '#cbd5e1' }}>License plate / dashboard edge blur enabled</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px' }}>
            <div>
              <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Reset Local UI Cache</span>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0' }}>
                Resets browser view states and telemetry tracking without deleting database records.
              </p>
            </div>
            <button
              onClick={onResetSession}
              style={{
                padding: '6px 14px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RotateCcw size={14} /> Reset Cache
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
