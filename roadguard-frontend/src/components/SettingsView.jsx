import React, { useState } from 'react';
import {
  Settings,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  MapPin,
  Trash2,
  CheckCircle2,
  Shield,
  RotateCcw
} from 'lucide-react';

export default function SettingsView({
  settings = {},
  onUpdateSettings,
  onResetSession
}) {
  const [savedToast, setSavedToast] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  // Defaults:
  // theme: 'DAYLIGHT' | 'DARK'
  // autoCaptureAndChime: true | false
  // autoGpsTracking: true | false
  const currentTheme = settings.theme === 'DARK' ? 'DARK' : 'DAYLIGHT';
  const autoCapture = settings.autoCaptureAndChime !== false;
  const autoGps = settings.autoGpsTracking !== false;

  function handleUpdate(key, value) {
    const updated = { ...settings, [key]: value };
    if (onUpdateSettings) onUpdateSettings(updated);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  }

  function handleClearCache() {
    try {
      localStorage.removeItem('roadguard_settings');
      localStorage.removeItem('roadguard_session_id');
      sessionStorage.clear();
    } catch (e) {
      console.warn('Cache clear warning:', e);
    }
    if (onResetSession) onResetSession();
    setResetConfirm(true);
    setTimeout(() => setResetConfirm(false), 3000);
  }

  return (
    <div style={{
      maxWidth: '760px',
      margin: '0 auto',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      {/* Top Header Card */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-flex',
              padding: '6px',
              borderRadius: '8px',
              background: '#f1f5f9',
              color: '#475569'
            }}>
              <Settings size={20} />
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              System Preferences
            </h2>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
            User interface display, notification chimes, and local cache controls.
          </p>
        </div>

        {savedToast && (
          <div style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#059669',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <CheckCircle2 size={14} /> Preference Saved
          </div>
        )}
      </div>

      {/* 4 Simple Controls Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* 1. Interface Color Theme */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '18px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
              Interface Color Theme
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Civic Daylight provides optimal outdoor daytime visibility without dashboard glare.
            </div>
          </div>

          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '4px', border: '1px solid #e2e8f0' }}>
            <button
              onClick={() => handleUpdate('theme', 'DAYLIGHT')}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: currentTheme === 'DAYLIGHT' ? '#ffffff' : 'transparent',
                color: currentTheme === 'DAYLIGHT' ? '#2563eb' : '#64748b',
                boxShadow: currentTheme === 'DAYLIGHT' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              <Sun size={14} /> Civic Daylight (Default)
            </button>
            <button
              onClick={() => handleUpdate('theme', 'DARK')}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: currentTheme === 'DARK' ? '#0f172a' : 'transparent',
                color: currentTheme === 'DARK' ? '#38bdf8' : '#64748b',
                boxShadow: currentTheme === 'DARK' ? '0 1px 4px rgba(0,0,0,0.2)' : 'none'
              }}
            >
              <Moon size={14} /> Night Drive
            </button>
          </div>
        </div>

        {/* 2. Auto-Capture Pothole Screenshot & Alert Chime */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '18px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
              Auto-Capture Pothole Screenshot & Alert Chime
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Automatically capture high-resolution evidence thumbnails and chime upon defect detection.
            </div>
          </div>

          <button
            onClick={() => handleUpdate('autoCaptureAndChime', !autoCapture)}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              border: `1px solid ${autoCapture ? '#a7f3d0' : '#cbd5e1'}`,
              background: autoCapture ? '#ecfdf5' : '#f8fafc',
              color: autoCapture ? '#059669' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {autoCapture ? <Volume2 size={15} /> : <VolumeX size={15} />}
            {autoCapture ? 'ENABLED (ON)' : 'MUTED (OFF)'}
          </button>
        </div>

        {/* 3. Automatic GPS Location & Jurisdiction Tracking */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '18px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
              Automatic GPS Location & Jurisdiction Tracking
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Automatically maintain road authority jurisdiction (NHAI / AP PWD / CDMA ULB) as you drive.
            </div>
          </div>

          <button
            onClick={() => handleUpdate('autoGpsTracking', !autoGps)}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              border: `1px solid ${autoGps ? '#bae6fd' : '#cbd5e1'}`,
              background: autoGps ? '#f0f9ff' : '#f8fafc',
              color: autoGps ? '#0284c7' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <MapPin size={15} />
            {autoGps ? 'ACTIVE (ON)' : 'DISABLED (OFF)'}
          </button>
        </div>

        {/* 4. Clear Local App Cache */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '18px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
              Clear Local App Cache
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Reset locally cached sessions, offline buffers, and reload fresh government configurations.
            </div>
          </div>

          <button
            onClick={handleClearCache}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RotateCcw size={14} />
            {resetConfirm ? 'Cache Cleared!' : 'Clear Cached Data'}
          </button>
        </div>
      </div>
    </div>
  );
}
