import React, { useState, useEffect } from 'react';
import {
  Shield,
  Menu,
  Car,
  Bike,
  Truck,
  Play,
  Square,
  MapPin,
  AlertTriangle,
  FileText,
  Activity,
  History,
  CheckCircle2,
  RefreshCw,
  Info,
  Radio,
  Sliders,
  HelpCircle,
  Pause,
  Video,
  AlertCircle
} from 'lucide-react';
import MapViewer from './components/MapViewer';
import CameraViewfinder from './components/CameraViewfinder';
import GrievanceModal from './components/GrievanceModal';
import NavigationDrawer from './components/NavigationDrawer';
import IssuesView from './components/IssuesView';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import JourneyReportsView from './components/JourneyReportsView';
import ProfileView from './components/ProfileView';
import HelpAboutModal from './components/HelpAboutModal';
import {
  getHealth,
  getStats,
  createJourney,
  stopJourney,
  listJourneys,
  listIssues,
  sendGpsBatch,
  wakeUpBackend,
  getUserProfile
} from './api';

// Geodesic Haversine distance calculation in meters
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function App() {
  // Navigation & View State
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' | 'issues' | 'journeys' | 'reports' | 'settings'
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Backend Health & Stats
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [isWakingBackend, setIsWakingBackend] = useState(false);
  const [wakeProgress, setWakeProgress] = useState('');

  // Journey & Recording State
  const [activeJourney, setActiveJourney] = useState(null);
  const [vehicleType, setVehicleType] = useState('CAR');
  const [recordingStatus, setRecordingStatus] = useState('STOPPED');
  const [riderName, setRiderName] = useState('');
  const [riderEmail, setRiderEmail] = useState('');
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completedJourneyBanner, setCompletedJourneyBanner] = useState(null);

  // Camera State: 'PERMISSION_REQUIRED' | 'REQUESTING_PERMISSION' | 'CAMERA_READY' | 'CAMERA_UNAVAILABLE' | 'PERMISSION_DENIED'
  const [cameraState, setCameraState] = useState('PERMISSION_REQUIRED');

  // Telemetry & Geospatial Data (genuine device sensor readings, initialized to null prior to genuine fix)
  const [currentLocation, setCurrentLocation] = useState(null);
  const [gpsPermissionState, setGpsPermissionState] = useState('prompt'); // 'prompt' | 'granted' | 'denied' | 'unavailable'
  const [gpsErrorMessage, setGpsErrorMessage] = useState(null);
  const [gpsPath, setGpsPath] = useState([]);
  const [issues, setIssues] = useState([]);
  const [journeysList, setJourneysList] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [statusMessage, setStatusMessage] = useState('System ready. Start camera and GPS to begin live road monitoring.');

  // Concurrency guard ref to prevent duplicate journey creation from repeated clicks
  const isStartingJourneyRef = React.useRef(false);

  // Configurable Settings State with localStorage persistence
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('roadguard_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved settings:', e);
    }
    return {
      units: 'METRIC',
      theme: 'DARK',
      frameInterval: 2.8,
      stationaryGraceSec: 10,
      maxGpsAccuracy: 25,
      confidenceThreshold: 0.25
    };
  });

  function handleUpdateSettings(newSettings) {
    setSettings(newSettings);
    try {
      localStorage.setItem('roadguard_settings', JSON.stringify(newSettings));
    } catch (e) {
      console.warn('Failed to save settings to localStorage:', e);
    }
  }

  function formatDistance(meters) {
    if (meters == null) return settings.units === 'IMPERIAL' ? '0.00 mi' : '0.00 km';
    if (settings.units === 'IMPERIAL') {
      const miles = (meters / 1000) * 0.621371;
      return `${miles.toFixed(2)} mi`;
    }
    return `${(meters / 1000).toFixed(2)} km`;
  }

  // 1. Initial Load & Periodic Background Sync
  useEffect(() => {
    let isMounted = true;
    let wakeAttempted = false;

    async function checkAndSync() {
      try {
        const h = await getHealth(4000);
        if (isMounted) {
          setHealth(h);
          setIsWakingBackend(false);
        }
        const [s, iss, jList, prof] = await Promise.all([
          getStats().catch(() => null),
          listIssues().catch(() => []),
          listJourneys().catch(() => []),
          getUserProfile().catch(() => null)
        ]);
        if (isMounted) {
          if (s) setStats(s);
          if (iss) setIssues(iss);
          if (jList) setJourneysList(jList);
          if (prof && prof.fullName && prof.email !== 'lokesh.citizen@roadguard.local') {
            setRiderName(prof.fullName);
            if (prof.email) setRiderEmail(prof.email);
            if (prof.vehicleType) setVehicleType(prof.vehicleType);
          }
        }
      } catch (err) {
        if (!wakeAttempted && isMounted) {
          wakeAttempted = true;
          setIsWakingBackend(true);
          setWakeProgress('Waking cloud backend (Render cold start)...');
          wakeUpBackend((progress) => {
            if (isMounted) setWakeProgress(progress.message);
          })
            .then((resumedHealth) => {
              if (isMounted) {
                setHealth(resumedHealth);
                setIsWakingBackend(false);
              }
            })
            .catch((wakeErr) => {
              if (isMounted) {
                setIsWakingBackend(false);
                console.warn('Backend wake-up failed:', wakeErr.message);
              }
            });
        }
      }
    }

    checkAndSync();
    const interval = setInterval(checkAndSync, 6000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Refs for tracking without stale state closures
  const lastRecordedGpsRef = React.useRef(null);
  const distanceMetersRef = React.useRef(0);

  // 2. Geolocation Watcher: Continuous high-accuracy device location tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsPermissionState('unavailable');
      setGpsErrorMessage('Browser Geolocation is not supported by this device or browser.');
      return;
    }

    setGpsPermissionState('prompt');
    const watcherId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsPermissionState('granted');
        setGpsErrorMessage(null);
        const pt = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          speed: pos.coords.speed != null ? pos.coords.speed : null,
          heading: pos.coords.heading != null ? pos.coords.heading : null,
          accuracy: pos.coords.accuracy || 10.0,
          timestamp: pos.timestamp
        };
        setCurrentLocation(pt);
      },
      (err) => {
        console.warn('Device geolocation watcher notification:', err.code, err.message);
        if (err.code === 1) {
          setGpsPermissionState('denied');
          setGpsErrorMessage('Location permission denied. Please allow GPS access in browser site settings.');
        } else if (err.code === 2) {
          setGpsPermissionState('unavailable');
          setGpsErrorMessage('GPS position unavailable. Please ensure location services are enabled.');
        } else if (err.code === 3) {
          setGpsErrorMessage('GPS satellite lock timed out. Searching for satellite signal...');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watcherId);
    };
  }, []);

  // Geolocation retry action handler (non-blocking)
  const handleRetryGps = React.useCallback(() => {
    setGpsErrorMessage(null);
    if (!navigator.geolocation) {
      setGpsPermissionState('unavailable');
      setGpsErrorMessage('Browser Geolocation is not supported by this device.');
      return;
    }
    setGpsPermissionState('prompt');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsPermissionState('granted');
        setGpsErrorMessage(null);
        const pt = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          speed: pos.coords.speed != null ? pos.coords.speed : null,
          heading: pos.coords.heading != null ? pos.coords.heading : null,
          accuracy: pos.coords.accuracy || 10.0,
          timestamp: pos.timestamp
        };
        setCurrentLocation(pt);
      },
      (err) => {
        if (err.code === 1) {
          setGpsPermissionState('denied');
          setGpsErrorMessage('Location permission denied. Please allow GPS access in browser site settings.');
        } else if (err.code === 2) {
          setGpsPermissionState('unavailable');
          setGpsErrorMessage('GPS position unavailable. Please ensure device location is turned on.');
        } else if (err.code === 3) {
          setGpsErrorMessage('GPS lock timed out. Please try moving outdoors with a clearer view of the sky.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  // 3. Elapsed time counter for active journey
  useEffect(() => {
    if (!activeJourney) {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds((sec) => sec + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeJourney]);

  // 4. Genuine GPS tracking & telemetry batch loop during active journey
  useEffect(() => {
    if (!activeJourney) return;

    const interval = setInterval(async () => {
      const pt = currentLocation;

      if (pt && pt.lat != null) {
        // Geodesic distance filtering: ignore stationary jitter (<2m) and implausible jumps (>500m)
        if (lastRecordedGpsRef.current) {
          const stepDist = haversineDistanceMeters(
            lastRecordedGpsRef.current.lat,
            lastRecordedGpsRef.current.lon,
            pt.lat,
            pt.lon
          );

          if (stepDist >= 2.0 && stepDist <= 500.0) {
            distanceMetersRef.current += stepDist;
            setDistanceMeters(distanceMetersRef.current);
            lastRecordedGpsRef.current = pt;
            setGpsPath((prev) => [...prev, pt]);

            try {
              await sendGpsBatch(activeJourney.id, [{
                latitude: pt.lat,
                longitude: pt.lon,
                speed: pt.speed,
                heading: pt.heading,
                accuracy: pt.accuracy
              }]);
            } catch (e) {
              console.warn('GPS batch send error:', e);
            }
          }
        } else {
          // First point of journey
          lastRecordedGpsRef.current = pt;
          setGpsPath((prev) => (prev.length === 0 ? [pt] : prev));
        }
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [activeJourney, currentLocation]);

  // Start Journey / Drive Mode with robust pre-flight verification & non-blocking notices
  async function handleStartJourney() {
    if (isStartingJourneyRef.current || activeJourney) return;

    // Prerequisite 1: Backend service online
    if (health?.status !== 'UP') {
      setStatusMessage('Cannot start: Backend service is currently offline or unreachable.');
      return;
    }

    // Prerequisite 2: Camera ready
    if (cameraState !== 'CAMERA_READY') {
      setStatusMessage('Cannot start: Camera feed is required. Please click "Start Camera" in the viewfinder.');
      return;
    }

    // Prerequisite 3: Location permission
    if (gpsPermissionState === 'denied') {
      setStatusMessage('Cannot start: Location permission is denied. Please allow GPS access in browser site settings.');
      return;
    }

    // Prerequisite 4: Genuine GPS fix
    if (!currentLocation || currentLocation.lat == null) {
      setStatusMessage('Cannot start: Waiting for device GPS satellite fix. Please ensure device location is enabled.');
      return;
    }

    // Prerequisite 5: Safety accuracy threshold (e.g. 25m)
    if (currentLocation.accuracy > settings.maxGpsAccuracy) {
      setStatusMessage(`Cannot start: GPS accuracy (±${currentLocation.accuracy.toFixed(0)}m) is poorer than safety threshold (±${settings.maxGpsAccuracy}m). Waiting for satellite lock...`);
      return;
    }

    isStartingJourneyRef.current = true;
    try {
      setStatusMessage('Initiating live road-monitoring journey...');
      const startPt = { ...currentLocation };

      const journey = await createJourney({
        vehicleType,
        riderName: riderName && riderName.trim() ? riderName.trim() : null,
        riderEmail: riderEmail && riderEmail.trim() ? riderEmail.trim() : null,
        startLatitude: startPt.lat,
        startLongitude: startPt.lon,
        startAddress: 'Live GPS Location',
        demoMode: false,
        demoSource: 'Live Mobile Dashcam'
      });

      lastRecordedGpsRef.current = startPt;
      distanceMetersRef.current = 0;
      setDistanceMeters(0);
      setElapsedSeconds(0);
      setActiveJourney(journey);
      setGpsPath([startPt]);
      setRecordingStatus('RECORDING');
      setCompletedJourneyBanner(null);
      setStatusMessage(`Drive Mode Active: Journey #${journey.id}. Live Camera & ONNX AI running.`);
    } catch (err) {
      console.error('Failed to start journey:', err);
      setStatusMessage('Failed to start journey: ' + err.message);
    } finally {
      isStartingJourneyRef.current = false;
    }
  }

  // Stop Journey / Drive Mode with graceful resource finalization
  async function handleStopJourney() {
    if (!activeJourney) return;
    try {
      setStatusMessage('Stopping Drive Mode and compiling journey report...');
      const finished = await stopJourney(activeJourney.id, {
        endLatitude: currentLocation?.lat,
        endLongitude: currentLocation?.lon,
        distanceMeters: Math.round(distanceMetersRef.current)
      });

      setActiveJourney(null);
      setRecordingStatus('STOPPED');
      setCompletedJourneyBanner(finished);
      setStatusMessage(`Journey #${finished.id} saved: ${finished.totalFrames} frames analyzed, ${finished.issueCount} verified issues.`);

      // Refresh lists after stop
      const iss = await listIssues();
      setIssues(iss);
      const jList = await listJourneys();
      setJourneysList(jList);
    } catch (err) {
      console.error('Could not stop journey:', err);
      setStatusMessage('Could not stop journey: ' + err.message);
    }
  }

  async function handleRefreshAll() {
    try {
      const iss = await listIssues();
      setIssues(iss);
      const s = await getStats();
      setStats(s);
      const jList = await listJourneys();
      setJourneysList(jList);
    } catch (e) {
      console.warn('Refresh error:', e);
    }
  }

  function handleResetSession() {
    try {
      localStorage.removeItem('roadguard_settings');
    } catch (e) {
      console.warn('Could not clear stored settings:', e);
    }
    setSettings({
      units: 'METRIC',
      theme: 'DARK',
      frameInterval: 2.8,
      stationaryGraceSec: 10,
      maxGpsAccuracy: 25,
      confidenceThreshold: 0.25
    });
    setGpsPath([]);
    setSelectedIssue(null);
    setDistanceMeters(0);
    setElapsedSeconds(0);
    setCompletedJourneyBanner(null);
    lastRecordedGpsRef.current = null;
    distanceMetersRef.current = 0;
    setStatusMessage('Local settings and telemetry cache reset. Ready for next drive.');
  }

  return (
    <div style={{
      minHeight: '100vh',
      maxWidth: '100vw',
      overflowX: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-primary)'
    }}>
      {/* 1. Compact Header */}
      <header style={{
        padding: '10px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(15, 21, 35, 0.95)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        {/* Left: Hamburger Button & Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <Menu size={20} />
          </button>

          <img
            src="/favicon-48.png"
            alt="RoadGuard AI App Icon"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              objectFit: 'contain',
              boxShadow: '0 0 12px rgba(0, 245, 160, 0.35)'
            }}
          />

          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#f8fafc', letterSpacing: '-0.01em' }}>
              ROADGUARD <span style={{ color: '#00f5a0' }}>AI</span>
            </h1>
            <p className="header-subtitle" style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
              Intelligent Road-Monitoring & Grievance Redressal
            </p>
          </div>
        </div>

        {/* Right: Recording Status & Backend Connectivity Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Recording Status Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: activeJourney ? 'rgba(0, 245, 160, 0.12)' : 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${activeJourney ? 'rgba(0, 245, 160, 0.35)' : 'rgba(255, 255, 255, 0.1)'}`,
            padding: '4px 10px',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 700,
            color: activeJourney ? '#00f5a0' : '#94a3b8'
          }}>
            <div style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: activeJourney ? '#00f5a0' : '#64748b',
              boxShadow: activeJourney ? '0 0 8px #00f5a0' : 'none'
            }} />
            <span>{activeJourney ? recordingStatus : 'STANDBY'}</span>
          </div>

          {/* Backend Health Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--border-subtle)',
            padding: '4px 10px',
            borderRadius: '8px',
            fontSize: '11px'
          }}>
            <div style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: health?.status === 'UP' ? '#00f5a0' : (isWakingBackend ? '#f59e0b' : '#ff3366'),
              boxShadow: health?.status === 'UP' ? '0 0 8px #00f5a0' : (isWakingBackend ? '0 0 8px #f59e0b' : 'none')
            }} />
            <span style={{ color: '#cbd5e1' }}>
              Backend: <strong>{health?.status === 'UP' ? 'Online' : (isWakingBackend ? 'Waking...' : 'Offline')}</strong>
            </span>
          </div>
        </div>
      </header>

      {/* Render Free-Tier Cold-Start Wake-Up Banner */}
      {isWakingBackend && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.18) 0%, rgba(217, 119, 6, 0.22) 100%)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.45)',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          color: '#fbbf24',
          fontSize: '12px',
          fontWeight: 600,
          textAlign: 'center'
        }}>
          <RefreshCw size={14} className="spin" style={{ flexShrink: 0 }} />
          <span>{wakeProgress || 'Waking cloud backend (Render cold start)...'}</span>
        </div>
      )}

      {/* 2. Navigation Drawer */}
      <NavigationDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeView={activeView}
        onNavigate={(viewId) => {
          if (viewId === 'about') {
            setAboutOpen(true);
          } else {
            setActiveView(viewId);
          }
        }}
        issuesCount={issues.length}
        journeysCount={journeysList.length}
        recordingStatus={activeJourney ? recordingStatus : 'STOPPED'}
      />

      {/* 3. Main Views */}
      <main style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* VIEW 1: Live Monitoring Dashboard */}
        {activeView === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
            {/* GPS Signal Warning or Permission Notice (Non-blocking inline panels) */}
            {currentLocation && currentLocation.accuracy > settings.maxGpsAccuracy && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'rgba(245, 158, 11, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <AlertTriangle size={20} color="#f59e0b" />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#fef08a', letterSpacing: '0.02em' }}>
                      GPS SIGNAL TOO WEAK FOR ROAD AUDIT
                    </div>
                    <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>
                      Current reported accuracy: <strong style={{ color: '#f59e0b' }}>{currentLocation.accuracy.toFixed(0)}m</strong> &bull; Required accuracy: <strong style={{ color: '#00f5a0' }}>&le; {settings.maxGpsAccuracy}m</strong>
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      Keep waiting for a higher-precision satellite fix, or try moving outdoors with an unobstructed view of the sky.
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleRetryGps}
                  className="btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '6px' }}
                >
                  <RefreshCw size={13} style={{ marginRight: '6px' }} /> Retry GPS Fix
                </button>
              </div>
            )}

            {gpsPermissionState === 'denied' && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <AlertCircle size={20} color="#ef4444" />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#fca5a5' }}>
                      GEOLOCATION ACCESS DENIED
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      RoadGuard AI requires browser location permission over HTTPS to map defects and track drive routes.
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleRetryGps}
                  className="btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '6px' }}
                >
                  <RefreshCw size={13} style={{ marginRight: '6px' }} /> Request Location Permission
                </button>
              </div>
            )}

            {gpsErrorMessage && gpsPermissionState !== 'denied' && !currentLocation && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '8px',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                fontSize: '12px',
                color: '#fca5a5'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={15} color="#ef4444" />
                  <span>{gpsErrorMessage}</span>
                </div>
                <button
                  onClick={handleRetryGps}
                  style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
                >
                  Retry
                </button>
              </div>
            )}

            {/* Completed Journey Notification */}
            {completedJourneyBanner && (
              <div style={{
                background: 'rgba(0, 245, 160, 0.1)',
                border: '1px solid rgba(0, 245, 160, 0.3)',
                borderRadius: '8px',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontSize: '13px' }}>
                  <CheckCircle2 size={16} color="#00f5a0" />
                  <span>
                    Journey #{completedJourneyBanner.id} recorded! Total Distance: {formatDistance(completedJourneyBanner.distanceMeters != null ? completedJourneyBanner.distanceMeters : distanceMeters)} &bull; Frames: {completedJourneyBanner.totalFrames} &bull; Defects: {completedJourneyBanner.issueCount}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      setSelectedReportId(completedJourneyBanner.id);
                      setActiveView('reports');
                    }}
                    className="btn-primary"
                    style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px' }}
                  >
                    Open Journey Report &rarr;
                  </button>
                  <button
                    onClick={() => setCompletedJourneyBanner(null)}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px' }}
                  >
                    &times;
                  </button>
                </div>
              </div>
            )}

            {/* Subsystem Diagnostics Strip (Stage 1: Real separate status per component) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '8px'
            }}>
              {/* 1. Backend */}
              <div className="glass-panel" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: health?.status === 'UP' ? '#00f5a0' : '#ef4444',
                  boxShadow: health?.status === 'UP' ? '0 0 6px #00f5a0' : 'none'
                }} />
                <div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>BACKEND</div>
                  <div style={{ fontSize: '11px', color: '#f8fafc', fontWeight: 600 }}>{health?.status === 'UP' ? 'Online' : 'Offline'}</div>
                </div>
              </div>

              {/* 2. Database */}
              <div className="glass-panel" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: health?.database ? '#00f5a0' : '#f59e0b',
                  boxShadow: health?.database ? '0 0 6px #00f5a0' : 'none'
                }} />
                <div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>DATABASE</div>
                  <div style={{ fontSize: '11px', color: '#f8fafc', fontWeight: 600 }}>{health?.database || 'PostgreSQL'}</div>
                </div>
              </div>

              {/* 3. AI Model */}
              <div className="glass-panel" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: health?.modelStatus === 'LOADED' ? '#00f5a0' : '#ef4444',
                  boxShadow: health?.modelStatus === 'LOADED' ? '0 0 6px #00f5a0' : 'none'
                }} />
                <div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>AI MODEL</div>
                  <div style={{ fontSize: '11px', color: '#f8fafc', fontWeight: 600 }}>{health?.modelStatus === 'LOADED' ? 'YOLO11s ONNX' : 'Unavailable'}</div>
                </div>
              </div>

              {/* 4. GPS Sensor */}
              <div className="glass-panel" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: gpsPermissionState === 'denied'
                    ? '#ef4444'
                    : (!currentLocation
                        ? '#f59e0b'
                        : (currentLocation.accuracy <= settings.maxGpsAccuracy ? '#00f5a0' : '#f59e0b')),
                  boxShadow: currentLocation && currentLocation.accuracy <= settings.maxGpsAccuracy ? '0 0 6px #00f5a0' : 'none'
                }} />
                <div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>GPS SENSOR</div>
                  <div style={{ fontSize: '11px', color: '#f8fafc', fontWeight: 600 }}>
                    {gpsPermissionState === 'denied'
                      ? 'Permission Denied'
                      : (!currentLocation
                          ? 'Waiting Fix...'
                          : (currentLocation.accuracy <= settings.maxGpsAccuracy
                              ? `Ready (±${currentLocation.accuracy.toFixed(0)}m)`
                              : `Weak (±${currentLocation.accuracy.toFixed(0)}m)`))}
                  </div>
                </div>
              </div>

              {/* 5. Camera Sensor */}
              <div className="glass-panel" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: recordingStatus !== 'STOPPED'
                    ? '#00f5a0'
                    : (cameraState === 'CAMERA_READY'
                        ? '#00f5a0'
                        : (cameraState === 'REQUESTING_PERMISSION' ? '#f59e0b' : '#94a3b8')),
                  boxShadow: recordingStatus !== 'STOPPED' || cameraState === 'CAMERA_READY' ? '0 0 6px #00f5a0' : 'none'
                }} />
                <div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>CAMERA</div>
                  <div style={{ fontSize: '11px', color: '#f8fafc', fontWeight: 600 }}>
                    {recordingStatus !== 'STOPPED'
                      ? 'Streaming (REC)'
                      : (cameraState === 'CAMERA_READY'
                          ? 'Camera Ready'
                          : (cameraState === 'REQUESTING_PERMISSION'
                              ? 'Requesting...'
                              : (cameraState === 'PERMISSION_DENIED' ? 'Denied' : 'Standby')))}
                  </div>
                </div>
              </div>

              {/* 6. Maps Provider */}
              <div className="glass-panel" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#00f5a0',
                  boxShadow: '0 0 6px #00f5a0'
                }} />
                <div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>MAPS ENGINE</div>
                  <div style={{ fontSize: '11px', color: '#f8fafc', fontWeight: 600 }}>Leaflet + OSM</div>
                </div>
              </div>
            </div>

            {/* Field-Test Driver Safety Advisory */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              borderRadius: '8px',
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '11px',
              color: '#94a3b8'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={14} color="#00f5a0" style={{ flexShrink: 0 }} />
                <span>
                  <strong style={{ color: '#f8fafc' }}>Road Safety Advisory:</strong> Mount phone securely on windshield/dash. Operate app only while parked or have a passenger/co-driver operate it. Never handle the screen while driving.
                </span>
              </div>
              <span style={{
                background: 'rgba(0, 245, 160, 0.1)',
                color: '#00f5a0',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.04em'
              }}>
                PASSENGER / MOUNTED USE ONLY
              </span>
            </div>

            {/* Control Bar: Vehicle selection and start/stop drive mode */}
            <div className="glass-panel" style={{
              padding: '14px 18px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px'
            }}>
              {/* Vehicle Type Selection */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>VEHICLE:</span>
                  {[
                    { id: 'CAR', icon: Car, label: 'Car' },
                    { id: 'BIKE', icon: Bike, label: 'Bike' },
                    { id: 'TRUCK', icon: Truck, label: 'Heavy/Truck' },
                  ].map((v) => {
                    const Icon = v.icon;
                    const active = vehicleType === v.id;
                    return (
                      <button
                        key={v.id}
                        disabled={activeJourney != null}
                        onClick={() => setVehicleType(v.id)}
                        style={{
                          padding: '6px 10px',
                          background: active ? 'rgba(0, 245, 160, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          color: active ? '#00f5a0' : '#94a3b8',
                          border: `1px solid ${active ? 'rgba(0, 245, 160, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: activeJourney ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Icon size={14} /> {v.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: 'rgba(0, 245, 160, 0.1)',
                    color: '#00f5a0',
                    border: '1px solid rgba(0, 245, 160, 0.25)'
                  }}>
                    OPERATING SOURCE: LIVE CAMERA + GPS
                  </span>
                </div>
              </div>

              {/* Action Button: Start / Stop Drive Mode */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: '#cbd5e1' }}>
                  {activeJourney
                    ? `Journey #${activeJourney.id} • ${formatDistance(distanceMeters)} • ${Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:${(elapsedSeconds % 60).toString().padStart(2, '0')} • Acc: ±${(currentLocation?.accuracy || 0).toFixed(0)}m`
                    : statusMessage}
                </span>
                {activeJourney ? (
                  <button
                    onClick={handleStopJourney}
                    className="btn-danger"
                    style={{ padding: '10px 20px', borderRadius: '8px' }}
                  >
                    <Square size={16} fill="white" /> Stop Drive Mode
                  </button>
                ) : (
                  <button
                    onClick={handleStartJourney}
                    className="btn-primary"
                    style={{ padding: '10px 20px', borderRadius: '8px' }}
                  >
                    <Play size={16} fill="#04121d" /> Start Drive Mode
                  </button>
                )}
              </div>
            </div>

            {/* Split Grid: Camera Viewfinder & Interactive Map */}
            <div className="dashboard-split-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
              minHeight: '440px',
              flex: 1
            }}>
              {/* Camera Viewfinder Panel */}
              <div className="glass-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: '12px' }}>
                <div style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={15} color="#00f5a0" /> Live Road Camera & ONNX Defect Vision
                  </span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontWeight: 700,
                    background: health?.modelStatus === 'LOADED' ? 'rgba(0, 245, 160, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: health?.modelStatus === 'LOADED' ? '#00f5a0' : '#ef4444',
                    border: `1px solid ${health?.modelStatus === 'LOADED' ? 'rgba(0, 245, 160, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                  }}>
                    {health?.modelStatus === 'LOADED' ? 'ONNX YOLO11s ACTIVE' : 'MODEL OFFLINE'}
                  </span>
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                  <CameraViewfinder
                    isJourneyActive={activeJourney != null}
                    journeyId={activeJourney?.id}
                    currentLocation={currentLocation}
                    onNewDetection={handleRefreshAll}
                    settings={settings}
                    onEligibilityChange={(state) => setRecordingStatus(state)}
                    cameraState={cameraState}
                    onCameraStateChange={setCameraState}
                  />
                </div>
              </div>

              {/* Map Panel */}
              <div className="glass-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: '12px' }}>
                <div style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={15} color="#38bdf8" /> Geospatial Defect Map (OpenStreetMap)
                  </span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Deduplication: 15m radius</span>
                </div>
                <div style={{ flex: 1, minHeight: '340px' }}>
                  <MapViewer
                    currentLocation={currentLocation}
                    path={gpsPath}
                    issues={issues}
                    onSelectIssue={(issue) => setSelectedIssue(issue)}
                    isJourneyActive={activeJourney != null}
                    gpsError={gpsErrorMessage}
                    onRetryGps={handleRetryGps}
                  />
                </div>
              </div>
            </div>

            {/* Recent Road-Damage Detections Strip */}
            {issues.length > 0 && (
              <div className="glass-panel" style={{ padding: '14px 18px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={15} color="#f59e0b" /> Recent Confirmed Road Defects ({issues.length})
                  </span>
                  <button
                    onClick={() => setActiveView('issues')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#00f5a0',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    View All Issues &rarr;
                  </button>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '12px'
                }}>
                  {issues.slice(0, 3).map((issue) => (
                    <div
                      key={issue.id}
                      style={{
                        background: '#090d16',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            color: issue.defectClass === 'POTHOLE' ? '#ff3366' : '#f59e0b',
                            fontWeight: 700,
                            fontSize: '11px'
                          }}>
                            {issue.defectClass?.replace(/_/g, ' ')}
                          </span>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>
                            #{issue.id}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                          {issue.roadName || 'Public Road'}
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedIssue(issue)}
                        className="btn-primary"
                        style={{ padding: '6px 10px', fontSize: '11px', borderRadius: '6px', whiteSpace: 'nowrap' }}
                      >
                        <FileText size={12} /> Grievance
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: Detected Road Issues View */}
        {activeView === 'issues' && (
          <IssuesView
            issues={issues}
            onRefresh={handleRefreshAll}
            onSelectIssue={(issue) => setSelectedIssue(issue)}
            onViewOnMap={(issue) => {
              setCurrentLocation({
                lat: issue.latitude,
                lon: issue.longitude,
                speed: 0,
                heading: 0,
                accuracy: issue.locationAccuracyM || 5
              });
              setActiveView('dashboard');
              setStatusMessage(`Viewing defect #${issue.id} on map.`);
            }}
          />
        )}

        {/* VIEW 3: Journey History View */}
        {activeView === 'journeys' && (
          <HistoryView
            journeys={journeysList}
            onRefresh={handleRefreshAll}
            onInspectJourney={(j) => {
              setSelectedReportId(j.id);
              setActiveView('reports');
            }}
          />
        )}

        {/* VIEW 4: Journey Reports View (NEW) */}
        {activeView === 'reports' && (
          <JourneyReportsView
            journeys={journeysList}
            selectedJourneyId={selectedReportId}
            onRefresh={handleRefreshAll}
          />
        )}

        {/* VIEW 5: My Profile & Connected Services View */}
        {activeView === 'profile' && (
          <ProfileView
            onProfileUpdated={(updated) => {
              if (updated.fullName) setRiderName(updated.fullName);
              if (updated.email) setRiderEmail(updated.email);
              if (updated.vehicleType) setVehicleType(updated.vehicleType);
            }}
          />
        )}

        {/* VIEW 6: Settings View */}
        {activeView === 'settings' && (
          <SettingsView
            health={health}
            stats={stats}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onResetSession={handleResetSession}
          />
        )}
      </main>

      {/* 4. Grievance Modal */}
      {selectedIssue && (
        <GrievanceModal
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onComplaintSubmitted={() => handleRefreshAll()}
        />
      )}

      {/* 5. Help & About Modal */}
      <HelpAboutModal
        isOpen={aboutOpen}
        onClose={() => setAboutOpen(false)}
      />
    </div>
  );
}
