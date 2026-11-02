import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  CheckCircle2,
  RefreshCw,
  Camera,
  Activity,
  AlertCircle,
  FileText,
  Navigation,
  Undo2,
  Redo2,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Settings as SettingsIcon,
  HelpCircle,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  Cpu,
  X
} from 'lucide-react';
import MapViewer from './components/MapViewer';
import CameraViewfinder from './components/CameraViewfinder';
import DiagnosticPanel from './components/DiagnosticPanel';
import GrievanceModal from './components/GrievanceModal';
import NavigationDrawer from './components/NavigationDrawer';
import JourneysAndIssuesHub from './components/JourneysAndIssuesHub';
import GovernmentReportsView from './components/GovernmentReportsView';
import ProfileView from './components/ProfileView';
import SettingsView from './components/SettingsView';
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
import { isValidCoordinate, haversineDistanceMeters, isOutsideExpectedRegion, formatCoordinate } from './utils/geoUtils';
import {
  startDemoScanSession,
  DEMO_SAMPLE_DEFECTS,
  DEMO_SAMPLE_JOURNEY,
  DEMO_SAMPLE_COMPLAINT
} from './utils/demoScan';

// Section definition dictionary for RoadGuard AI desired product structure
const SECTION_CONFIG = {
  scanner: {
    id: 'scanner',
    title: 'Road Monitoring',
    shortTitle: 'Monitoring',
    hash: '#scanner',
    color: '#38bdf8', // Map blue #38BDF8
    icon: Activity
  },
  'journeys-issues': {
    id: 'journeys-issues',
    title: 'Journey Reports',
    shortTitle: 'Reports',
    hash: '#journeys-issues',
    color: '#243b53', // Slate #243B53
    icon: Car
  },
  'gov-reports': {
    id: 'gov-reports',
    title: 'Government Reports',
    shortTitle: 'Gov Reports',
    hash: '#gov-reports',
    color: '#14b8a6', // Teal #14B8A6
    icon: FileText
  },
  profile: {
    id: 'profile',
    title: 'Profile & Connected Services',
    shortTitle: 'Profile',
    hash: '#profile',
    color: '#38bdf8', // Map blue #38BDF8
    icon: UserCheck
  },
  settings: {
    id: 'settings',
    title: 'Settings',
    shortTitle: 'Settings',
    hash: '#settings',
    color: '#243b53', // Slate #243B53
    icon: SettingsIcon
  }
};

function parseViewFromHash() {
  if (typeof window === 'undefined') return 'scanner';
  const raw = (window.location.hash || '').replace('#', '').trim();
  if (raw === 'scanner' || raw === 'dashboard') return 'scanner';
  if (raw === 'journeys-issues' || raw === 'issues' || raw === 'journeys' || raw === 'reports') return 'journeys-issues';
  if (raw === 'gov-reports') return 'gov-reports';
  if (raw === 'profile') return 'profile';
  if (raw === 'settings') return 'settings';
  return 'scanner';
}

export default function App() {
  // Navigation & View State with Undo/Redo & Hash Sync
  const [activeView, setActiveView] = useState(() => parseViewFromHash());
  const [historyStack, setHistoryStack] = useState(() => [parseViewFromHash()]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [undoableAction, setUndoableAction] = useState(null);

  // Synchronize browser history popstate / hashchange
  useEffect(() => {
    function handleHashChange() {
      const v = parseViewFromHash();
      setActiveView(v);
    }
    window.addEventListener('popstate', handleHashChange);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('popstate', handleHashChange);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const navigateTo = useCallback((viewId, addToHistory = true) => {
    let normalized = viewId;
    if (viewId === 'dashboard') normalized = 'scanner';
    else if (viewId === 'issues' || viewId === 'journeys' || viewId === 'reports') normalized = 'journeys-issues';

    if (normalized === 'about') {
      setAboutOpen(true);
      return;
    }

    setActiveView(normalized);

    const targetHash = SECTION_CONFIG[normalized]?.hash || ('#' + normalized);
    if (window.location.hash !== targetHash) {
      window.history.pushState(null, '', targetHash);
    }

    if (addToHistory) {
      setHistoryStack((prev) => {
        const next = prev.slice(0, historyIndex + 1);
        if (next[next.length - 1] !== normalized) {
          next.push(normalized);
        }
        return next;
      });
      setHistoryIndex((prev) => {
        const next = historyStack.slice(0, prev + 1);
        if (next[next.length - 1] !== normalized) {
          return prev + 1;
        }
        return prev;
      });
    }
  }, [historyIndex, historyStack]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const targetIndex = historyIndex - 1;
      const targetView = historyStack[targetIndex];
      setHistoryIndex(targetIndex);
      setActiveView(targetView);
      const targetHash = SECTION_CONFIG[targetView]?.hash || ('#' + targetView);
      window.history.pushState(null, '', targetHash);
    }
  }, [historyIndex, historyStack]);

  const handleRedo = useCallback(() => {
    if (historyIndex < historyStack.length - 1) {
      const targetIndex = historyIndex + 1;
      const targetView = historyStack[targetIndex];
      setHistoryIndex(targetIndex);
      setActiveView(targetView);
      const targetHash = SECTION_CONFIG[targetView]?.hash || ('#' + targetView);
      window.history.pushState(null, '', targetHash);
    }
  }, [historyIndex, historyStack]);

  // Backend Health & Stats
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [isWakingBackend, setIsWakingBackend] = useState(false);
  const [wakeProgress, setWakeProgress] = useState('');
  const [backendError, setBackendError] = useState(null);

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
  const [coarseLocation, setCoarseLocation] = useState(null);
  const [manualLocation, setManualLocation] = useState(null);
  const [isOutsideRegion, setIsOutsideRegion] = useState(false);
  const [isGpsEnabled, setIsGpsEnabled] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('GPS OFF'); // 'GPS OFF' | 'GPS CONNECTING' | 'GPS ACTIVE' | 'GPS ERROR' | 'GPS PERMISSION DENIED'
  const [lastGpsFixTime, setLastGpsFixTime] = useState(null);
  const [gpsPermissionState, setGpsPermissionState] = useState('prompt'); // 'prompt' | 'granted' | 'denied' | 'unavailable'
  const [gpsErrorMessage, setGpsErrorMessage] = useState(null);
  const [gpsPath, setGpsPath] = useState([]);
  const [issues, setIssues] = useState([]);
  const [journeysList, setJourneysList] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [statusMessage, setStatusMessage] = useState('System ready. Start camera or Driving Mode to begin live road monitoring.');

  // Concurrency guard ref to prevent duplicate journey creation from repeated clicks
  const isStartingJourneyRef = React.useRef(false);

  // Interactive 30-Second Demo Scan Simulation State
  const [demoActive, setDemoActive] = useState(false);
  const [demoSecondsRemaining, setDemoSecondsRemaining] = useState(30);
  const [demoFrameUrl, setDemoFrameUrl] = useState(null);
  const demoSessionCancelRef = useRef(null);

  // Dismissible Welcome Banner & Post-Trip Summary Modal
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => {
    try {
      return localStorage.getItem('roadguard_welcome_dismissed') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [postTripSummary, setPostTripSummary] = useState(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

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
      theme: 'DAYLIGHT',
      autoCaptureAndChime: true,
      autoGpsTracking: true,
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

  // Synchronize Civic Daylight / Night Drive theme
  useEffect(() => {
    const themeMode = settings.theme === 'DARK' ? 'dark' : 'daylight';
    document.documentElement.setAttribute('data-theme', themeMode);
    document.body.setAttribute('data-theme', themeMode);
  }, [settings.theme]);

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
          setBackendError(null);
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
        if (isMounted) {
          setBackendError(err.message || 'Connection failed');
        }
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
                setBackendError(null);
                setIsWakingBackend(false);
              }
            })
            .catch((wakeErr) => {
              if (isMounted) {
                setIsWakingBackend(false);
                setBackendError(wakeErr.message || 'Cloud wake-up timed out');
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
  const currentLocationRef = React.useRef(null);
  const pendingGpsQueueRef = React.useRef([]);

  const watcherIdRef = useRef(null);

  // Synchronize currentLocation state into ref synchronously
  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

  
  const handleRetryBackend = useCallback(() => {
    setIsWakingBackend(true);
    setWakeProgress('Probing cloud backend...');
    setBackendError(null);
    getHealth(8000)
      .then((h) => {
        setHealth(h);
        setBackendError(null);
        setIsWakingBackend(false);
        setStatusMessage('Backend connected: ' + (h.database || 'database ready'));
      })
      .catch((err) => {
        setIsWakingBackend(false);
        setBackendError(err.message || 'Backend unreachable');
        setStatusMessage('Backend probe failed: ' + err.message);
      });
  }, []);
  // 2. Central Geolocation Watcher Lifecycle: User-controlled high-accuracy device tracking
  const startGpsWatcher = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsPermissionState('unavailable');
      setGpsStatus('GPS ERROR');
      setGpsErrorMessage('Browser Geolocation is not supported by this device or browser.');
      return;
    }

    // Always clear any active watcher before creating a new one to prevent duplicate watchers
    if (watcherIdRef.current != null) {
      try {
        navigator.geolocation.clearWatch(watcherIdRef.current);
      } catch (e) {
        console.warn('clearWatch warning:', e);
      }
      watcherIdRef.current = null;
    }

    setGpsPermissionState('prompt');
    setGpsStatus('GPS CONNECTING');
    setGpsErrorMessage(null);

    try {
      const wId = navigator.geolocation.watchPosition(
        (pos) => {
          if (!pos || !pos.coords) return;
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const accuracy = pos.coords.accuracy != null && Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : 10.0;
          const timestamp = pos.timestamp || Date.now();

          // Quality Gate 1: Reject Null Island (0,0)
          if (lat === 0 && lon === 0) return;

          // Quality Gate 2: Reject non-finite or out-of-bounds coordinate
          if (!isValidCoordinate(lat, lon)) {
            console.warn('Ignored non-finite or out-of-bounds coordinate:', lat, lon);
            return;
          }

          // Quality Gate 3: Accept valid browser coordinates even when accuracy is coarse (e.g. ±97m or ±149m)
          const isCoarse = accuracy > 50;
          if (isCoarse) {
            console.info('Coarse GPS fix accepted as approximate:', accuracy, 'm accuracy');
          }

          // Quality Gate 4: Reject stale or out-of-order packets
          if (currentLocationRef.current && timestamp <= currentLocationRef.current.timestamp) {
            return;
          }

          const isOutside = isOutsideExpectedRegion(lat, lon);
          setIsOutsideRegion(isOutside);

          const pt = {
            lat,
            lon,
            speed: pos.coords.speed != null && Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
            heading: pos.coords.heading != null && Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
            accuracy,
            isApproximate: isCoarse,
            isOutsideRegion: isOutside,
            isDemo: false,
            timestamp
          };
          currentLocationRef.current = pt;
          setCurrentLocation(pt);
          setCoarseLocation(isCoarse ? pt : null);
          setGpsPermissionState('granted');
          setGpsStatus(isCoarse ? `GPS APPROXIMATE (±${Math.round(accuracy)}m)` : 'GPS ACTIVE');
          setLastGpsFixTime(timestamp);
          setGpsErrorMessage(isCoarse ? `Approximate location (±${Math.round(accuracy)}m). High-precision GPS not required.` : null);
        },
        (err) => {
          console.warn('Device geolocation watcher notification:', err.code, err.message);
          if (err.code === 1) {
            setGpsPermissionState('denied');
            setGpsStatus('GPS PERMISSION DENIED');
            setGpsErrorMessage('Location permission denied. Please allow GPS access in browser site settings.');
          } else if (err.code === 2) {
            setGpsPermissionState('unavailable');
            setGpsStatus('GPS ERROR');
            setGpsErrorMessage('GPS position unavailable. Please ensure location services are enabled on device.');
          } else if (err.code === 3) {
            // Satellite lock timeout: non-blocking notice without clearing last valid position
            setGpsStatus('GPS CONNECTING');
            setGpsErrorMessage('Searching for GPS satellite lock (outdoors with clear sky view recommended)...');
          } else {
            setGpsStatus('GPS ERROR');
            setGpsErrorMessage(err.message || 'GPS location error');
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0
        }
      );
      watcherIdRef.current = wId;
    } catch (watchErr) {
      console.warn('Failed to register geolocation watchPosition:', watchErr);
      setGpsStatus('GPS ERROR');
      setGpsErrorMessage('Failed to initialize geolocation watcher: ' + watchErr.message);
    }
  }, []);

  // Teardown GPS watcher cleanly on unmount only — NEVER auto-start on page load
  useEffect(() => {
    return () => {
      if (watcherIdRef.current != null) {
        try {
          navigator.geolocation.clearWatch(watcherIdRef.current);
        } catch (e) {}
        watcherIdRef.current = null;
      }
    };
  }, []);

  // Explicit GPS ON/OFF Switch Action
  const handleToggleGps = useCallback(() => {
    if (isGpsEnabled) {
      // TURN GPS OFF: cleanly clear watcher, clear coordinates, set state to GPS OFF
      if (watcherIdRef.current != null) {
        try {
          navigator.geolocation.clearWatch(watcherIdRef.current);
        } catch (e) {
          console.warn('clearWatch warning:', e);
        }
        watcherIdRef.current = null;
      }
      setIsGpsEnabled(false);
      setGpsStatus('GPS OFF');
      setCurrentLocation(null);
      setCoarseLocation(null);
      setGpsErrorMessage(null);
      setStatusMessage('GPS tracking disabled. System operating in offline-GPS mode (camera & AI detection fully active).');
    } else {
      // TURN GPS ON: requests permission and starts single watcher instance
      if (!navigator.geolocation) {
        setIsGpsEnabled(false);
        setGpsStatus('GPS ERROR');
        setGpsErrorMessage('Browser Geolocation is not supported by this device.');
        return;
      }
      setIsGpsEnabled(true);
      setGpsStatus('GPS CONNECTING');
      setCoarseLocation(null);
      setGpsErrorMessage(null);
      setStatusMessage('Connecting to GPS satellites...');
      startGpsWatcher();
    }
  }, [isGpsEnabled, startGpsWatcher]);

  // Geolocation retry action handler: safely restarts single watcher instance
  const handleRetryGps = useCallback(() => {
    setIsGpsEnabled(true);
    setGpsStatus('GPS CONNECTING');
    setCoarseLocation(null);
    setGpsErrorMessage(null);
    startGpsWatcher();
  }, [startGpsWatcher]);

  // Demo Location action handler (Prototype testing without real GPS satellite lock)
  const handleUseDemoLocation = useCallback(() => {
    const demoPt = {
      lat: 16.5062,
      lon: 80.6480,
      speed: 0,
      heading: 0,
      accuracy: 15.0,
      isApproximate: true,
      isDemo: true,
      isOutsideRegion: false,
      timestamp: Date.now()
    };
    currentLocationRef.current = demoPt;
    setCurrentLocation(demoPt);
    setIsOutsideRegion(false);
    setGpsStatus('DEMO LOCATION (NOT LIVE GPS)');
    setGpsErrorMessage(null);
    setStatusMessage('Demo location active (Benz Circle, Vijayawada). Real defect evidence will not be geotagged with demo coordinates.');
  }, []);

  const handleClearDemoLocation = useCallback(() => {
    currentLocationRef.current = null;
    setCurrentLocation(null);
    setGpsStatus(isGpsEnabled ? 'GPS CONNECTING' : 'GPS OFF');
    setStatusMessage('Demo location cleared.');
  }, [isGpsEnabled]);

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

  // 4. Genuine GPS tracking & telemetry batch loop during active journey (decoupled from 1 Hz GPS state updates)
  useEffect(() => {
    if (!activeJourney || !activeJourney.id) return;

    async function flushPendingGpsQueue(journeyId) {
      if (pendingGpsQueueRef.current.length === 0) return;
      const batch = [...pendingGpsQueueRef.current];
      try {
        await sendGpsBatch(journeyId, batch);
        // Remove successfully sent items from queue
        pendingGpsQueueRef.current = pendingGpsQueueRef.current.slice(batch.length);
      } catch (e) {
        console.warn('GPS batch send buffered for retry:', e);
      }
    }

    const interval = setInterval(async () => {
      const pt = currentLocationRef.current;

      if (pt && pt.lat != null) {
        if (!lastRecordedGpsRef.current) {
          // First point of journey (Point 0): Record AND queue for backend persistence!
          lastRecordedGpsRef.current = pt;
          setGpsPath([pt]);
          pendingGpsQueueRef.current.push({
            latitude: pt.lat,
            longitude: pt.lon,
            speed: pt.speed,
            heading: pt.heading,
            accuracy: pt.accuracy,
            timestamp: new Date(pt.timestamp).toISOString()
          });
          await flushPendingGpsQueue(activeJourney.id);
          return;
        }

        const stepDist = haversineDistanceMeters(
          lastRecordedGpsRef.current.lat,
          lastRecordedGpsRef.current.lon,
          pt.lat,
          pt.lon
        );

        const dtSec = Math.max(0.5, (pt.timestamp - lastRecordedGpsRef.current.timestamp) / 1000.0);
        const impliedSpeedMps = stepDist / dtSec;

        // Filter stationary jitter: ignore movements < 2.0m
        if (stepDist < 2.0) return;

        // Reject implausible multipath spikes (>500m in <10s with speed > 45 m/s = 162 km/h)
        if (stepDist > 500.0 && impliedSpeedMps > 45.0) {
          console.warn('Rejected single-point GPS jump:', stepDist, 'm at', impliedSpeedMps, 'm/s');
          return;
        }

        // Valid movement step (including post-underpass genuine movement >500m over elapsed time)
        distanceMetersRef.current += stepDist;
        setDistanceMeters(distanceMetersRef.current);
        lastRecordedGpsRef.current = pt;
        setGpsPath((prev) => [...prev, pt]);

        // Bounded retry queue (max 500 items) to prevent memory leak during network drops
        if (pendingGpsQueueRef.current.length < 500) {
          pendingGpsQueueRef.current.push({
            latitude: pt.lat,
            longitude: pt.lon,
            speed: pt.speed,
            heading: pt.heading,
            accuracy: pt.accuracy,
            timestamp: new Date(pt.timestamp).toISOString()
          });
        }

        await flushPendingGpsQueue(activeJourney.id);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [activeJourney?.id]);

  // Start Journey / Drive Mode with robust pre-flight verification & non-blocking notices
  async function handleStartJourney() {
    if (isStartingJourneyRef.current || activeJourney) return;

    // Prerequisite 1: Backend service online
    if (health?.status !== 'UP') {
      setStatusMessage('Cannot start: Backend service is currently offline or unreachable.');
      return;
    }

    // Determine start coordinates: attach GPS fix if enabled and valid (including approximate fixes)
    let startPt = null;
    if (isGpsEnabled && currentLocation && isValidCoordinate(currentLocation.lat, currentLocation.lon)) {
      startPt = { ...currentLocation };
    }

    isStartingJourneyRef.current = true;
    try {
      setStatusMessage('Initiating live road-monitoring journey...');
      const hasCam = cameraState === 'CAMERA_READY';

      const journey = await createJourney({
        vehicleType,
        riderName: riderName && riderName.trim() ? riderName.trim() : null,
        riderEmail: riderEmail && riderEmail.trim() ? riderEmail.trim() : null,
        startLatitude: startPt ? startPt.lat : null,
        startLongitude: startPt ? startPt.lon : null,
        startAddress: startPt ? 'Live GPS Location' : 'Offline GPS (Manual Location Required)',
        demoMode: false,
        demoSource: hasCam ? 'Live Mobile Dashcam' : 'Road Inspection Run'
      });

      lastRecordedGpsRef.current = startPt;
      distanceMetersRef.current = 0;
      setDistanceMeters(0);
      setElapsedSeconds(0);
      setActiveJourney(journey);
      setGpsPath(startPt ? [startPt] : []);
      setRecordingStatus('RECORDING');
      setCompletedJourneyBanner(null);

      setStatusMessage(
        hasCam
          ? `Drive Mode Active: Journey #${journey.id}. Live Camera & ONNX AI running ${startPt ? 'with GPS' : '(offline GPS mode)'}.`
          : `Drive Mode Active: Journey #${journey.id}. Road Monitoring active ${startPt ? 'with GPS' : '(offline GPS mode)'}.`
      );
    } catch (err) {
      console.error('Failed to start journey:', err);
      setStatusMessage('Failed to start journey: ' + err.message);
    } finally {
      isStartingJourneyRef.current = false;
    }
  }

  // Quick / Emergency camera start or stop toggle
  function handleToggleCamera() {
    if (cameraState === 'CAMERA_READY') {
      setCameraState('PERMISSION_REQUIRED');
      if (activeJourney) {
        setStatusMessage(`Drive Mode active: Journey #${activeJourney.id} — Camera stopped (${isGpsEnabled ? 'GPS tracking active' : 'Offline mode'}).`);
      } else {
        setStatusMessage('Camera stopped. Ready to start when needed.');
      }
    } else {
      setCameraState('REQUESTING_PERMISSION');
      if (activeJourney) {
        setStatusMessage(`Drive Mode active: Journey #${activeJourney.id} — Starting live dashcam feed...`);
      } else {
        setStatusMessage('Starting live dashcam feed...');
      }
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

  // Interactive 30-Second Demo Scan Session
  const handleStartDemoScan = useCallback(() => {
    if (demoSessionCancelRef.current) {
      demoSessionCancelRef.current();
    }
    setDemoActive(true);
    setDemoSecondsRemaining(30);
    setStatusMessage('Interactive 30s Demo Scan running along NH-65 Benz Circle, Vijayawada...');
    navigateTo('scanner');

    const cancelFn = startDemoScanSession({
      onTick: ({ secondsRemaining, elapsedSeconds, gpsPoint, frameUrl }) => {
        setDemoSecondsRemaining(secondsRemaining);
        setDemoFrameUrl(frameUrl);
        setCurrentLocation(gpsPoint);
        setGpsPath((prev) => [...prev, gpsPoint]);
        setDistanceMeters(Math.round((elapsedSeconds / 30) * 1420));
        setElapsedSeconds(elapsedSeconds);
      },
      onDetection: (defect) => {
        setIssues((prev) => [defect, ...prev]);
        setStatusMessage(`DEMO HAZARD DETECTED: ${defect.defectClass} (92%) on NH-65 corridor.`);
      },
      onComplete: ({ journey, defects }) => {
        setDemoActive(false);
        setPostTripSummary({
          id: journey.id,
          distanceMeters: journey.distanceMeters,
          durationSeconds: journey.durationSeconds,
          issuesCount: defects.length,
          isDemo: true
        });
        setStatusMessage('Demo scan completed! 2 sample potholes detected along NH-65 Benz Circle.');
      }
    });

    demoSessionCancelRef.current = cancelFn;
  }, [navigateTo]);

  // Unified Start/Stop Road Scan Action
  const handleStartRoadScan = useCallback(async () => {
    if (activeJourney || demoActive) {
      // STOP ROAD SCAN
      if (demoActive) {
        if (demoSessionCancelRef.current) {
          demoSessionCancelRef.current();
          demoSessionCancelRef.current = null;
        }
        setDemoActive(false);
        setPostTripSummary({
          id: 'DEMO-TRIP-BENZ-CIRCLE',
          distanceMeters: distanceMeters,
          durationSeconds: elapsedSeconds,
          issuesCount: 2,
          isDemo: true
        });
        setStatusMessage('Demo scan stopped.');
        return;
      }

      // Real journey stop
      try {
        setStatusMessage('Stopping scan and saving trip dossier...');
        const finished = await stopJourney(activeJourney.id, {
          endLatitude: currentLocation?.lat,
          endLongitude: currentLocation?.lon,
          distanceMeters: Math.round(distanceMetersRef.current)
        });
        setActiveJourney(null);
        setRecordingStatus('STOPPED');
        setCameraState('PERMISSION_REQUIRED');
        setCompletedJourneyBanner(finished);
        setPostTripSummary({
          id: finished.id,
          distanceMeters: finished.distanceMeters || Math.round(distanceMetersRef.current),
          durationSeconds: elapsedSeconds,
          issuesCount: finished.issueCount || 0,
          isDemo: false
        });
        setStatusMessage(`Trip #${finished.id} saved: ${finished.totalFrames} frames analyzed, ${finished.issueCount} road defects logged.`);
        const [iss, jList] = await Promise.all([listIssues().catch(() => []), listJourneys().catch(() => [])]);
        if (iss) setIssues(iss);
        if (jList) setJourneysList(jList);
      } catch (err) {
        console.error('Could not stop journey:', err);
        setStatusMessage('Could not stop journey: ' + err.message);
      }
    } else {
      // START ROAD SCAN
      setCameraState('REQUESTING_PERMISSION');
      if (!isGpsEnabled && settings.autoGpsTracking !== false) {
        handleToggleGps();
      }
      await handleStartJourney();
    }
  }, [activeJourney, demoActive, distanceMeters, elapsedSeconds, isGpsEnabled, settings.autoGpsTracking, currentLocation, handleToggleGps, handleStartJourney]);

  function getHumanFriendlyGpsBadge() {
    if (!isGpsEnabled) {
      if (manualLocation) {
        return { label: 'Manual Pin Active', color: '#2563eb', bg: '#eff6ff' };
      }
      return { label: 'GPS Paused (Offline Mode)', color: '#64748b', bg: '#f1f5f9' };
    }
    if (gpsStatus === 'GPS CONNECTING') {
      return { label: 'Connecting to GPS...', color: '#f59e0b', bg: '#fffbeb' };
    }
    if (!currentLocation || !isValidCoordinate(currentLocation.lat, currentLocation.lon)) {
      return { label: 'Waiting for GPS Fix', color: '#f59e0b', bg: '#fffbeb' };
    }
    const acc = currentLocation.accuracy || 10;
    if (acc <= 10) {
      return { label: `Exact (±${Math.round(acc)}m)`, color: '#059669', bg: '#ecfdf5' };
    }
    if (acc <= 30) {
      return { label: `Fair (±${Math.round(acc)}m)`, color: '#0d9488', bg: '#f0fdfa' };
    }
    return { label: `Weak (±${Math.round(acc)}m)`, color: '#f59e0b', bg: '#fffbeb' };
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
      {/* 1. Deep Civic Navy Top Navigation Header with Undo/Redo & Active Section Pill */}
      <header style={{
        padding: '12px 20px',
        backgroundColor: 'var(--header-bg, #1e3a8a)',
        color: 'var(--header-text, #ffffff)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        {/* Left: Hamburger, App Brand, 4 Desktop Navigation Workspace Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.22)',
              color: '#ffffff',
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

          {/* Brand Logo & Name */}
          <div
            onClick={() => navigateTo('scanner')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          >
            <img
              src="/favicon-48.png"
              alt="RoadGuard AI App Icon"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                objectFit: 'contain',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)'
              }}
            />
            <div>
              <h1 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                ROADGUARD <span style={{ color: '#38bdf8' }}>AI</span>
              </h1>
              <p className="header-subtitle" style={{ margin: 0, fontSize: '10px', color: 'rgba(255, 255, 255, 0.75)' }}>
                Civic Clarity Architecture · Andhra Pradesh
              </p>
            </div>
          </div>

          {/* 4 Visible Desktop Workspace Tabs (≥768px) */}
          <div className="desktop-nav-tabs" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
            {[
              { id: 'scanner', label: 'Scan Road', icon: Activity },
              { id: 'journeys-issues', label: 'My Trips & Potholes', icon: Car, badge: issues.length > 0 ? issues.length : null },
              { id: 'gov-reports', label: 'Official Complaints', icon: FileText },
              { id: 'profile', label: 'Profile & Settings', icon: UserCheck }
            ].map(item => {
              const Icon = item.icon;
              const isActive = (activeView === item.id) || (item.id === 'scanner' && activeView === 'dashboard') || (item.id === 'profile' && activeView === 'settings');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.id)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: isActive ? 'var(--color-civic-teal, #0d9488)' : 'rgba(255, 255, 255, 0.08)',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      borderRadius: '999px',
                      padding: '1px 6px',
                      fontSize: '10px',
                      fontWeight: 700
                    }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Unified System Status Pill, Try Demo Button & Help Modal Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Unified System Status Pill (opens Diagnostics drawer) */}
          <div
            onClick={() => setShowDiagnostics(prev => !prev)}
            title="Click to toggle Subsystem Diagnostics & Telemetry"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(0, 0, 0, 0.28)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              padding: '6px 12px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              color: '#ffffff'
            }}
          >
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: activeJourney || demoActive ? '#10b981' : (health?.status === 'UP' ? '#0d9488' : (isWakingBackend ? '#f59e0b' : '#ef4444')),
              boxShadow: activeJourney || demoActive ? '0 0 8px #10b981' : 'none'
            }} />
            <span>
              {demoActive
                ? `DEMO SCANNING (${demoSecondsRemaining}s)`
                : (activeJourney ? `RECORDING · TRIP #${activeJourney.id}` : (health?.status === 'UP' ? 'System Ready' : (isWakingBackend ? 'Waking Cloud...' : 'Backend Probing')))}
            </span>
          </div>

          {/* Quick 30s Demo Scan CTA */}
          {!activeJourney && !demoActive && (
            <button
              type="button"
              onClick={handleStartDemoScan}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 8px rgba(13, 148, 136, 0.3)'
              }}
            >
              <Play size={12} fill="#ffffff" /> Try Demo
            </button>
          )}

          {/* Help Button */}
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            title="Help & Guide"
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <HelpCircle size={14} /> Help
          </button>
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
        onNavigate={navigateTo}
        issuesCount={issues.length}
        journeysCount={journeysList.length}
        recordingStatus={activeJourney ? recordingStatus : 'STOPPED'}
      />

      {/* 3. Main Views */}
      <main style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* VIEW 1: Live Road Scanner Dashboard */}
        {(activeView === 'scanner' || activeView === 'dashboard') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
            {/* Welcome Civic Mission Banner (Dismissible) */}
            {!welcomeDismissed && !activeJourney && !demoActive && (
              <div className="glass-panel" style={{
                padding: '16px 20px',
                background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.12) 0%, rgba(15, 23, 42, 0.04) 100%)',
                border: '1px solid rgba(13, 148, 136, 0.35)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', maxWidth: '640px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: 'var(--color-civic-teal, #0d9488)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    flexShrink: 0,
                    boxShadow: '0 4px 10px rgba(13, 148, 136, 0.3)'
                  }}>
                    <Shield size={24} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-bright)' }}>
                      Spot road damage. Help get it fixed.
                    </h2>
                    <p style={{ fontSize: '13px', margin: '4px 0 0', color: 'var(--text-dim)', lineHeight: 1.4 }}>
                      Point your phone at the road while driving. RoadGuard AI spots potholes with on-device computer vision, records exact coordinates, and formats statutory grievances for NHAI, State &amp; Municipal portals.
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleStartRoadScan}
                    className="btn-primary"
                    style={{ padding: '8px 16px', fontSize: '13px' }}
                  >
                    <Play size={14} fill="#ffffff" /> Start Road Scan
                  </button>
                  <button
                    type="button"
                    onClick={handleStartDemoScan}
                    className="btn-secondary"
                    style={{ padding: '8px 14px', fontSize: '13px' }}
                  >
                    <Play size={13} /> Try 30s Demo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWelcomeDismissed(true);
                      try { localStorage.setItem('roadguard_welcome_dismissed', 'true'); } catch (e) {}
                    }}
                    aria-label="Dismiss welcome banner"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '6px',
                      fontSize: '18px',
                      lineHeight: 1
                    }}
                  >
                    &times;
                  </button>
                </div>
              </div>
            )}

            {/* GPS Signal Warning or Approximate Location Indicator (Non-blocking inline panels) */}
            {currentLocation && currentLocation.accuracy > 50 && (
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
                      APPROXIMATE BROWSER LOCATION ACTIVE
                    </div>
                    <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>
                      Reported accuracy: <strong style={{ color: '#f59e0b' }}>±{currentLocation.accuracy.toFixed(0)}m</strong> &bull; Coordinates accepted as approximate for prototype.
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      Camera inference, pothole detection, and journey route tracking continue unhindered.
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

            {/* Out-of-region Non-Blocking Advisory (e.g. coordinates outside Indian operational territory) */}
            {isOutsideRegion && currentLocation && !currentLocation.isDemo && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
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
                  <AlertCircle size={20} color="#f59e0b" />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#fef08a' }}>
                    Location appears outside the expected region — verify for real reporting
                  </div>
                  <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>
                    Coordinates: <strong>{currentLocation.lat.toFixed(4)}°, {currentLocation.lon.toFixed(4)}°</strong> &bull; Browser coordinates are preserved honestly as returned.
                  </div>
                </div>
              </div>
            )}

            {/* Explicit Prototype Demo Location Banner */}
            {currentLocation?.isDemo && (
              <div style={{
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
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
                    background: 'rgba(56, 189, 248, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <MapPin size={20} color="#38bdf8" />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8' }}>
                      DEMO LOCATION ACTIVE — NOT LIVE GPS
                    </div>
                    <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>
                      Displaying prototype coordinates for Vijayawada (16.5062°N, 80.6480°E).
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      Camera inference continues, but genuine defect records will not be tagged with demo coordinates.
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleClearDemoLocation}
                  className="btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '6px' }}
                >
                  Clear Demo
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
                      navigateTo('journeys-issues');
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

            {/* Collapsible Subsystem Diagnostics & Live Telemetry Inspector */}
            {showDiagnostics && (
              <div className="glass-panel" style={{
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid rgba(13, 148, 136, 0.4)',
                background: 'var(--bg-card)',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--text-bright)' }}>
                    <Activity size={16} color="#0d9488" />
                    <span>Subsystem Diagnostics &amp; Live Telemetry Inspector</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDiagnostics(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}
                    title="Close diagnostics panel"
                  >
                    &times;
                  </button>
                </div>
                <DiagnosticPanel
                  cameraState={cameraState}
                  isJourneyActive={activeJourney != null || demoActive}
                  activeJourneyId={activeJourney?.id || (demoActive ? 'DEMO-TRIP' : null)}
                  currentLocation={currentLocation}
                  isGpsEnabled={isGpsEnabled}
                  gpsStatus={gpsStatus}
                  lastGpsFixTime={lastGpsFixTime}
                  gpsPermissionState={gpsPermissionState}
                  gpsErrorMessage={gpsErrorMessage}
                  health={health}
                  backendError={backendError}
                  onRetryBackend={handleRetryBackend}
                  distanceMeters={distanceMeters}
                  elapsedSeconds={elapsedSeconds}
                />
              </div>
            )}

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

            {/* Control Bar: Unified Primary Action, Vehicle selection and Telemetry Controls */}
            {(() => {
              const gpsBadge = getHumanFriendlyGpsBadge();
              const isScanningActive = activeJourney != null || demoActive;
              return (
                <div className="glass-panel" style={{
                  padding: '14px 18px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px'
                }}>
                  {/* Left: Primary Start/Stop CTA, Vehicle Type & GPS Badge */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
                    {/* Unified Primary Action Button */}
                    <button
                      type="button"
                      onClick={handleStartRoadScan}
                      className={isScanningActive ? 'btn-danger' : 'btn-primary'}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                      }}
                    >
                      {isScanningActive ? (
                        <>
                          <Square size={14} fill="currentColor" /> Stop Road Scan
                        </>
                      ) : (
                        <>
                          <Play size={14} fill="currentColor" /> Start Road Scan
                        </>
                      )}
                    </button>

                    {/* Vehicle Type Selection */}
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
                            disabled={isScanningActive}
                            onClick={() => setVehicleType(v.id)}
                            style={{
                              padding: '6px 10px',
                              background: active ? 'rgba(13, 148, 136, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              color: active ? '#0d9488' : '#94a3b8',
                              border: `1px solid ${active ? '#0d9488' : 'rgba(255, 255, 255, 0.08)'}`,
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: isScanningActive ? 'not-allowed' : 'pointer',
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

                    {/* Human-Friendly GPS Badge */}
                    <div
                      onClick={handleToggleGps}
                      title="Click to toggle GPS Tracking mode"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '5px 12px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: gpsBadge.bg,
                        color: gpsBadge.color,
                        border: `1px solid ${gpsBadge.color}40`,
                        cursor: 'pointer'
                      }}
                    >
                      <Navigation size={12} />
                      <span>{gpsBadge.label}</span>
                    </div>
                  </div>

                  {/* Right: Camera toggle, Diagnostics pill, GPS toggle & Status summary */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: '#cbd5e1' }}>
                      {activeJourney
                        ? `Trip #${activeJourney.id} • ${formatDistance(distanceMeters)} • ${Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:${(elapsedSeconds % 60).toString().padStart(2, '0')}${isGpsEnabled && currentLocation ? ` • Acc: ±${(currentLocation?.accuracy || 0).toFixed(0)}m` : ' • Offline GPS'}`
                        : (demoActive ? `Demo Scan (${demoSecondsRemaining}s) • ${formatDistance(distanceMeters)}` : statusMessage)}
                    </span>

                    {/* Camera Toggle Control */}
                    <button
                      type="button"
                      onClick={handleToggleCamera}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: cameraState === 'CAMERA_READY' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(13, 148, 136, 0.18)',
                        border: `1px solid ${cameraState === 'CAMERA_READY' ? '#ef4444' : '#0d9488'}`,
                        color: cameraState === 'CAMERA_READY' ? '#fca5a5' : '#0d9488',
                        transition: 'all 0.15s ease'
                      }}
                      title={cameraState === 'CAMERA_READY' ? 'Stop Camera Stream' : 'Start Camera Stream'}
                    >
                      {cameraState === 'CAMERA_READY' ? (
                        <>
                          <Square size={12} fill="#ef4444" /> Stop Camera
                        </>
                      ) : (
                        <>
                          <Camera size={14} /> Start Camera
                        </>
                      )}
                    </button>

                    {/* Subsystem Diagnostics Toggle */}
                    <button
                      type="button"
                      onClick={() => setShowDiagnostics(prev => !prev)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: showDiagnostics ? 'rgba(13, 148, 136, 0.22)' : 'rgba(255, 255, 255, 0.06)',
                        border: `1px solid ${showDiagnostics ? '#0d9488' : 'rgba(148, 163, 184, 0.25)'}`,
                        color: showDiagnostics ? '#0d9488' : '#cbd5e1'
                      }}
                      title="Toggle Diagnostics & Telemetry Inspector"
                    >
                      <Activity size={13} />
                      <span>Diagnostics</span>
                    </button>

                    {/* GPS ON/OFF Toggle Control */}
                    <button
                      type="button"
                      onClick={handleToggleGps}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: isGpsEnabled ? 'rgba(56, 189, 248, 0.18)' : 'rgba(100, 116, 139, 0.15)',
                        border: `1px solid ${isGpsEnabled ? '#38bdf8' : 'rgba(148, 163, 184, 0.3)'}`,
                        color: isGpsEnabled ? '#38bdf8' : '#94a3b8',
                        transition: 'all 0.15s ease'
                      }}
                      title={isGpsEnabled ? 'Turn GPS Tracking OFF' : 'Turn GPS Tracking ON'}
                    >
                      <Navigation size={13} style={{ transform: isGpsEnabled ? 'none' : 'rotate(45deg)' }} />
                      <span>GPS: {isGpsEnabled ? 'ON' : 'OFF'}</span>
                    </button>

                    {/* Optional Demo Location Toggle (when real GPS is off) */}
                    {!isGpsEnabled && !activeJourney && !demoActive && (
                      <button
                        type="button"
                        onClick={currentLocation?.isDemo ? handleClearDemoLocation : handleUseDemoLocation}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: currentLocation?.isDemo ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.06)',
                          border: `1px solid ${currentLocation?.isDemo ? '#f59e0b' : 'rgba(148, 163, 184, 0.25)'}`,
                          color: currentLocation?.isDemo ? '#f59e0b' : '#cbd5e1'
                        }}
                        title="Toggle Demo location (Vijayawada) for interface walkthroughs"
                      >
                        <MapPin size={13} />
                        <span>{currentLocation?.isDemo ? 'Demo Location' : 'Demo Loc'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

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
                    <Activity size={15} color="#00f5a0" /> Live Road Camera &amp; ONNX Defect Vision
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
                    isJourneyActive={activeJourney != null || demoActive}
                    journeyId={activeJourney?.id || (demoActive ? 'DEMO-TRIP' : null)}
                    currentLocation={currentLocation || manualLocation}
                    onNewDetection={handleRefreshAll}
                    settings={settings}
                    onEligibilityChange={(state) => setRecordingStatus(state)}
                    cameraState={cameraState}
                    onCameraStateChange={setCameraState}
                    onFileGrievance={(issue) => setSelectedIssue(issue)}
                    demoActive={demoActive}
                    demoSecondsRemaining={demoSecondsRemaining}
                    demoFrameUrl={demoFrameUrl}
                    onStartDemo={handleStartDemoScan}
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
                    coarseLocation={coarseLocation}
                    isGpsEnabled={isGpsEnabled}
                    manualLocation={manualLocation}
                    onManualPinSelect={(pin) => setManualLocation(pin)}
                    path={gpsPath}
                    issues={issues}
                    onSelectIssue={(issue) => setSelectedIssue(issue)}
                    isJourneyActive={activeJourney != null || demoActive}
                    gpsError={gpsErrorMessage}
                    onRetryGps={handleRetryGps}
                  />
                </div>
              </div>
            </div>

            {/* 3-Line Live Scan Activity Ticker */}
            <div className="glass-panel" style={{
              padding: '12px 18px',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              background: 'var(--bg-card)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-bright)', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
                  <Activity size={14} color="var(--color-civic-teal, #0d9488)" />
                  <span>Vision AI Engine:</span>
                  <span style={{ color: demoActive ? '#38bdf8' : (health?.modelStatus === 'LOADED' ? '#059669' : '#0d9488'), fontWeight: 600 }}>
                    {demoActive ? 'Demo Synthetic Highway Stream Active (NH-65 Vijayawada)' : (health?.modelStatus === 'LOADED' ? 'ONNX YOLO11s Active (Local Edge Inference · Conf >= 0.25)' : 'ONNX Local Detector Ready')}
                  </span>
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Pure Java Backend &bull; RL Policy Engine
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-dim)', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <Navigation size={13} color="#38bdf8" />
                  <span style={{ fontWeight: 600 }}>Geospatial Corridor:</span>
                  <span>
                    {currentLocation && isValidCoordinate(currentLocation.lat, currentLocation.lon)
                      ? `${formatCoordinate(currentLocation.lat)}, ${formatCoordinate(currentLocation.lon)} (±${Math.round(currentLocation.accuracy || 10)}m) · ${gpsPath.length} genuine fixes`
                      : (manualLocation ? `Manual Pin: ${formatCoordinate(manualLocation.lat)}, ${formatCoordinate(manualLocation.lon)}` : 'Camera inference unhindered in GPS-independent mode')}
                  </span>
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Deduplication Radius: 15m
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px' }}>
                <Sparkles size={12} color="#f59e0b" />
                <span style={{ fontWeight: 600 }}>Event Stream:</span>
                <span style={{ color: 'var(--text-dim)' }}>
                  {statusMessage}
                </span>
              </div>
            </div>

            {/* Recent Road-Damage Detections Strip */}
            {issues.length > 0 && (
              <div className="glass-panel" style={{ padding: '14px 18px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={15} color="#f59e0b" /> Recent Confirmed Road Defects ({issues.length})
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={() => {
                        if (activeJourney) setSelectedReportId(activeJourney.id);
                        navigateTo('journeys-issues');
                      }}
                      style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid #38bdf8',
                        color: '#38bdf8',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <FileText size={12} /> View Journey Report &rarr;
                    </button>
                    <button
                      onClick={() => navigateTo('journeys-issues')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#38bdf8',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      All Issues &rarr;
                    </button>
                  </div>
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

        {/* VIEW 2: Journeys & Road Issues Consolidated Hub */}
        {activeView === 'journeys-issues' && (
          <JourneysAndIssuesHub
            journeys={journeysList}
            issues={issues}
            selectedJourneyId={selectedReportId}
            onSelectJourney={(j) => setSelectedReportId(j?.id || j)}
            onRefresh={handleRefreshAll}
            onSelectIssue={(issue) => setSelectedIssue(issue)}
            onViewOnMap={(loc) => {
              setCurrentLocation({
                lat: loc.latitude,
                lon: loc.longitude,
                speed: 0,
                heading: 0,
                accuracy: loc.locationAccuracyM || 5
              });
              navigateTo('scanner');
              setStatusMessage(`Viewing defect on map.`);
            }}
          />
        )}

        {/* VIEW 3: Government Reports Hub */}
        {activeView === 'gov-reports' && (
          <GovernmentReportsView
            issues={issues}
            journeys={journeysList}
            onNavigateToScanner={() => navigateTo('scanner')}
            onSelectComplaint={(complaint) => {
              // Complaint preview
            }}
          />
        )}

        {/* VIEW 4: My Profile & Connected Services View */}
        {activeView === 'profile' && (
          <ProfileView
            currentLocation={currentLocation}
            onProfileUpdated={(updated) => {
              if (updated.fullName) setRiderName(updated.fullName);
              if (updated.email) setRiderEmail(updated.email);
              if (updated.vehicleType) setVehicleType(updated.vehicleType);
            }}
          />
        )}

        {/* VIEW 5: Settings View */}
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

      {/* Mobile Fixed Bottom Navigation Bar (<768px) */}
      <nav className="mobile-bottom-nav">
        {[
          { id: 'scanner', label: 'Scan Road', icon: Activity },
          { id: 'journeys-issues', label: 'My Trips', icon: Car, badge: issues.length > 0 ? issues.length : null },
          { id: 'gov-reports', label: 'Complaints', icon: FileText },
          { id: 'profile', label: 'Profile', icon: UserCheck }
        ].map((item) => {
          const Icon = item.icon;
          const isActive = (activeView === item.id) || (item.id === 'scanner' && activeView === 'dashboard') || (item.id === 'profile' && activeView === 'settings');
          return (
            <button
              key={item.id}
              type="button"
              className={`mobile-bottom-nav-btn ${isActive ? 'active' : ''}`}
              onClick={() => navigateTo(item.id)}
            >
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} />
                {item.badge && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-8px',
                    background: '#ef4444',
                    color: '#ffffff',
                    fontSize: '9px',
                    fontWeight: 800,
                    borderRadius: '999px',
                    padding: '1px 4px',
                    lineHeight: 1
                  }}>
                    {item.badge}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Post-Trip Summary Modal */}
      {postTripSummary && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.72)',
          backdropFilter: 'blur(4px)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '480px',
            width: '100%',
            background: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(13, 148, 136, 0.15)',
                  color: 'var(--color-civic-teal, #0d9488)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-bright)' }}>
                    {postTripSummary.isDemo ? 'Demo Scan Completed' : 'Trip Successfully Saved'}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-dim)' }}>
                    {postTripSummary.isDemo ? 'Interactive 30s Walkthrough along NH-65' : `Trip #${postTripSummary.id}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPostTripSummary(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}
                title="Dismiss summary"
              >
                &times;
              </button>
            </div>

            {/* Metrics Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.04)',
              borderRadius: '10px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>DISTANCE</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-bright)', marginTop: '2px' }}>
                  {formatDistance(postTripSummary.distanceMeters || 0)}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>DURATION</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-bright)', marginTop: '2px' }}>
                  {Math.floor(postTripSummary.durationSeconds / 60)}m {postTripSummary.durationSeconds % 60}s
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>HAZARDS</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: postTripSummary.issuesCount > 0 ? '#ef4444' : '#059669', marginTop: '2px' }}>
                  {postTripSummary.issuesCount}
                </div>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0, lineHeight: 1.4 }}>
              {postTripSummary.issuesCount > 0
                ? `${postTripSummary.issuesCount} road hazards were identified and geotagged. You can inspect the photographic evidence in your trip dossier or prepare a grievance for submission to the road authority.`
                : 'Your journey was safely recorded with zero potholes detected on this stretch.'}
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const tripId = postTripSummary.id;
                  setPostTripSummary(null);
                  if (tripId && !postTripSummary.isDemo) {
                    setSelectedReportId(tripId);
                  }
                  navigateTo('journeys-issues');
                }}
                style={{ padding: '8px 14px', fontSize: '13px' }}
              >
                Inspect Trip Dossier
              </button>
              {postTripSummary.issuesCount > 0 && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setPostTripSummary(null);
                    navigateTo('gov-reports');
                  }}
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                  Prepare Grievance &rarr;
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
