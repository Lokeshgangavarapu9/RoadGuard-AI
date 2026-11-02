import React, { useState, useEffect } from 'react';
import {
  User,
  Car,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Landmark,
  Building,
  Save,
  Trash2,
  Sparkles,
  ShieldCheck,
  Settings,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Compass,
  AlertTriangle
} from 'lucide-react';
import { getUserProfile, updateUserProfile } from '../api';
import { isValidCoordinate } from '../utils/geoUtils';

export default function ProfileView({
  currentLocation = null,
  onProfileUpdated = null,
  settings = {},
  onUpdateSettings = null,
  onResetSession = null
}) {
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    primaryVrn: '',
    vehicleType: 'CAR',
    state: 'Andhra Pradesh',
    district: '',
    cityOrMunicipality: '',
    pinCode: ''
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [autoLocationBadge, setAutoLocationBadge] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getUserProfile()
      .then((data) => {
        if (!isMounted || !data) return;
        setProfile({
          fullName: data.fullName || '',
          email: data.email || '',
          phoneNumber: data.phoneNumber || '',
          primaryVrn: data.primaryVrn || '',
          vehicleType: data.vehicleType || 'CAR',
          state: data.state || 'Andhra Pradesh',
          district: data.district || '',
          cityOrMunicipality: data.cityOrMunicipality || '',
          pinCode: data.pinCode || ''
        });

        if (data.cityOrMunicipality || data.district) {
          setAutoLocationBadge({
            city: data.cityOrMunicipality,
            district: data.district,
            state: data.state || 'Andhra Pradesh',
            pinCode: data.pinCode || '',
            jurisdiction: 'Saved Profile Location'
          });
        }
      })
      .catch((err) => {
        console.warn('Could not load user profile:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  // Honest Auto-Detect Location from Live GPS — Never fabricates coordinates on error
  async function handleAutoDetectLocation() {
    setIsGeocoding(true);
    setErrorMessage(null);

    async function reverseGeocode(lat, lon) {
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`,
          { headers: { 'User-Agent': 'RoadGuardAI/1.0 (roadguard-citizen-app)' } }
        );
        const data = await resp.json();
        const addr = data.address || {};

        const city = addr.city || addr.town || addr.village || addr.suburb || 'Local Area';
        const district = addr.county || addr.state_district || 'District';
        const state = addr.state || 'Andhra Pradesh';
        const pin = addr.postcode || '';
        const road = addr.road || '';

        let jurisdiction = 'Municipal / Local Authority';
        if (/national\s*highway|nh\b/i.test(road)) {
          jurisdiction = 'NHAI (National Highways Authority of India)';
        } else if (/state\s*highway|sh\b|mdr\b/i.test(road)) {
          jurisdiction = 'AP Roads & Buildings (State Highways)';
        } else {
          jurisdiction = 'Urban Local Body / CDMA';
        }

        const badge = { city, district, state, pinCode: pin, jurisdiction };
        setAutoLocationBadge(badge);

        setProfile((prev) => ({
          ...prev,
          cityOrMunicipality: city,
          district: district,
          state: state,
          pinCode: pin
        }));

        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      } catch (e) {
        console.warn('Reverse geocoding error:', e);
        setErrorMessage('Could not resolve street address from GPS. Please enter your district or city manually.');
      } finally {
        setIsGeocoding(false);
      }
    }

    if (currentLocation && isValidCoordinate(currentLocation.lat, currentLocation.lon)) {
      await reverseGeocode(currentLocation.lat, currentLocation.lon);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.warn('Geolocation lookup failed:', err.message);
          setIsGeocoding(false);
          // Honest failure: do NOT fabricate Vijayawada!
          setAutoLocationBadge(null);
          setErrorMessage('Could not read browser GPS location. Please allow location access or select your city manually below.');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setIsGeocoding(false);
      setErrorMessage('Browser Geolocation is not supported on this device.');
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const updated = await updateUserProfile(profile);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      if (onProfileUpdated) onProfileUpdated(updated);
    } catch (err) {
      console.error('Failed to save profile:', err);
      setErrorMessage(err.message || 'Failed to update citizen profile.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleClearForm() {
    setProfile({
      fullName: '',
      email: '',
      phoneNumber: '',
      primaryVrn: '',
      vehicleType: 'CAR',
      state: 'Andhra Pradesh',
      district: '',
      cityOrMunicipality: '',
      pinCode: ''
    });
    setAutoLocationBadge(null);
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Workspace Header */}
      <div style={{
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-subtle, #e2e8f0)',
        borderRadius: '14px',
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <User size={22} color="var(--color-civic-teal, #0d9488)" /> Citizen Profile & System Preferences
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-dim, #64748b)', margin: '4px 0 0' }}>
            Manage your citizen credentials, vehicle type, display theme, and connected official grievance portals.
          </p>
        </div>

        {saveSuccess && (
          <div style={{
            background: '#ecfdf5',
            border: '1px solid #10b981',
            borderRadius: '8px',
            padding: '6px 14px',
            color: '#047857',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <CheckCircle2 size={16} /> Profile Saved Successfully
          </div>
        )}

        {errorMessage && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            padding: '6px 14px',
            color: '#b91c1c',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <AlertCircle size={16} /> {errorMessage}
          </div>
        )}
      </div>

      {/* 2-Column Responsive Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '20px',
        alignItems: 'start'
      }}>
        {/* COLUMN 1: Citizen Profile & Vehicle Form */}
        <div style={{
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          borderRadius: '14px',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} color="var(--color-civic-teal, #0d9488)" /> Citizen Details & Vehicle
          </h3>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-main, #0f172a)', marginBottom: '4px' }}>
                Full Name (Citizen / Complainant)
              </label>
              <input
                type="text"
                value={profile.fullName}
                onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                placeholder="e.g. Lokesh G."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  background: 'var(--bg-canvas, #f8fafc)',
                  color: 'var(--text-main, #0f172a)',
                  fontSize: '13px'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-main, #0f172a)', marginBottom: '4px' }}>
                  Mobile (For OTP Handoff)
                </label>
                <input
                  type="tel"
                  value={profile.phoneNumber}
                  onChange={(e) => setProfile({ ...profile, phoneNumber: e.target.value })}
                  placeholder="+91 98765 43210"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle, #e2e8f0)',
                    background: 'var(--bg-canvas, #f8fafc)',
                    color: 'var(--text-main, #0f172a)',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-main, #0f172a)', marginBottom: '4px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="name@example.com"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle, #e2e8f0)',
                    background: 'var(--bg-canvas, #f8fafc)',
                    color: 'var(--text-main, #0f172a)',
                    fontSize: '13px'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-main, #0f172a)', marginBottom: '4px' }}>
                  Vehicle Type
                </label>
                <select
                  value={profile.vehicleType}
                  onChange={(e) => setProfile({ ...profile, vehicleType: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle, #e2e8f0)',
                    background: 'var(--bg-canvas, #f8fafc)',
                    color: 'var(--text-main, #0f172a)',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="CAR">Car / SUV</option>
                  <option value="MOTORCYCLE">Motorcycle / Scooter</option>
                  <option value="TRUCK">Truck / Commercial Bus</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-main, #0f172a)', marginBottom: '4px' }}>
                  Vehicle Reg. Number (VRN)
                </label>
                <input
                  type="text"
                  value={profile.primaryVrn}
                  onChange={(e) => setProfile({ ...profile, primaryVrn: e.target.value })}
                  placeholder="e.g. AP 16 AB 1234"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle, #e2e8f0)',
                    background: 'var(--bg-canvas, #f8fafc)',
                    color: 'var(--text-main, #0f172a)',
                    fontSize: '13px'
                  }}
                />
              </div>
            </div>

            {/* Location Section with honest auto-detect */}
            <div style={{
              background: 'var(--bg-tertiary, #f1f5f9)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              borderRadius: '10px',
              padding: '14px',
              marginTop: '4px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>
                  Primary District & City
                </span>
                <button
                  type="button"
                  onClick={handleAutoDetectLocation}
                  disabled={isGeocoding}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: 'var(--color-civic-teal, #0d9488)',
                    color: '#ffffff',
                    border: 'none',
                    cursor: isGeocoding ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <MapPin size={12} /> {isGeocoding ? 'Detecting...' : 'Auto-Detect via GPS'}
                </button>
              </div>

              {autoLocationBadge && (
                <div style={{
                  background: 'rgba(13, 148, 136, 0.1)',
                  border: '1px solid rgba(13, 148, 136, 0.25)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '11px',
                  color: 'var(--color-civic-teal, #0d9488)',
                  marginBottom: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>📍 {autoLocationBadge.city}, {autoLocationBadge.district} ({autoLocationBadge.state})</span>
                  <span style={{ fontWeight: 700 }}>{autoLocationBadge.jurisdiction}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <input
                    type="text"
                    value={profile.district}
                    onChange={(e) => setProfile({ ...profile, district: e.target.value })}
                    placeholder="District (e.g. NTR / Guntur)"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      background: 'var(--bg-card, #ffffff)',
                      color: 'var(--text-main, #0f172a)',
                      fontSize: '12px'
                    }}
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={profile.cityOrMunicipality}
                    onChange={(e) => setProfile({ ...profile, cityOrMunicipality: e.target.value })}
                    placeholder="City / Municipality (e.g. Vijayawada)"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      background: 'var(--bg-card, #ffffff)',
                      color: 'var(--text-main, #0f172a)',
                      fontSize: '12px'
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="submit"
                disabled={isSaving}
                className="btn-primary"
                style={{ flex: 1, padding: '10px 18px', fontSize: '13px' }}
              >
                <Save size={15} /> {isSaving ? 'Saving Profile...' : 'Save Profile'}
              </button>
              <button
                type="button"
                onClick={handleClearForm}
                className="btn-secondary"
                style={{ padding: '10px 16px', fontSize: '13px' }}
              >
                Clear
              </button>
            </div>
          </form>
        </div>

        {/* COLUMN 2: System Preferences & Connected Portals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Preferences Card */}
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            borderRadius: '14px',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} color="var(--color-civic-teal, #0d9488)" /> System Preferences
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Theme Toggle */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'var(--bg-canvas, #f8fafc)',
                border: '1px solid var(--border-subtle, #e2e8f0)'
              }}>
                <div>
                  <strong style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {settings.theme === 'DARK' ? <Moon size={15} color="#38bdf8" /> : <Sun size={15} color="#f59e0b" />}
                    Display Theme
                  </strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim, #64748b)' }}>
                    {settings.theme === 'DARK' ? 'Night Drive Mode (High Contrast Dark)' : 'Civic Daylight Mode (Clean Teal & Slate)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = settings.theme === 'DARK' ? 'DAYLIGHT' : 'DARK';
                    onUpdateSettings?.({ ...settings, theme: next });
                  }}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px', minHeight: '34px' }}
                >
                  {settings.theme === 'DARK' ? 'Switch to Daylight' : 'Switch to Night'}
                </button>
              </div>

              {/* Audio Chime Toggle */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'var(--bg-canvas, #f8fafc)',
                border: '1px solid var(--border-subtle, #e2e8f0)'
              }}>
                <div>
                  <strong style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {settings.autoCaptureAndChime !== false ? <Volume2 size={15} color="#0d9488" /> : <VolumeX size={15} color="#64748b" />}
                    Audio Chime on Defect
                  </strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim, #64748b)' }}>
                    Plays a gentle chime when a severe pothole is detected
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoCaptureAndChime !== false}
                  onChange={(e) => onUpdateSettings?.({ ...settings, autoCaptureAndChime: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#0d9488' }}
                />
              </div>

              {/* Auto-GPS Start Toggle */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'var(--bg-canvas, #f8fafc)',
                border: '1px solid var(--border-subtle, #e2e8f0)'
              }}>
                <div>
                  <strong style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Compass size={15} color="#0d9488" />
                    Auto-Start GPS on Drive
                  </strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim, #64748b)' }}>
                    Request high-accuracy GPS fix automatically when starting scan
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoGpsTracking !== false}
                  onChange={(e) => onUpdateSettings?.({ ...settings, autoGpsTracking: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#0d9488' }}
                />
              </div>

              {/* Reset Session Cache with Confirmation */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#fef2f2',
                border: '1px solid #fecaca'
              }}>
                <div>
                  <strong style={{ fontSize: '13px', color: '#b91c1c' }}>Clear Local Cache</strong>
                  <div style={{ fontSize: '11px', color: '#7f1d1d' }}>
                    Reset local session state and cached trip coordinates
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmResetOpen(true)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Clear Cache
                </button>
              </div>
            </div>
          </div>

          {/* Connected Official Portals */}
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            borderRadius: '14px',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: '0 0 6px' }}>
              Supported Government Portals · Manual OTP Filing
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-dim, #64748b)', margin: '0 0 14px' }}>
              RoadGuard AI formats complete defect dossiers with photos, WGS84 coordinates, and draft text. Official submission requires your mobile OTP on these portals:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-canvas, #f8fafc)', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '13px' }}>NHAI Rajmargyatra</strong>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#059669' }}>
                    National Highways
                  </span>
                </div>
                <p style={{ margin: '4px 0 8px', fontSize: '11px', color: 'var(--text-dim, #64748b)' }}>
                  NH-16, NH-65, and national corridor roads across Andhra Pradesh.
                </p>
                <a
                  href="https://rajmargyatra.nhai.gov.in/complaints"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-civic-teal, #0d9488)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  Open Official Portal <ExternalLink size={11} />
                </a>
              </div>

              <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-canvas, #f8fafc)', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '13px' }}>AP CDMA Puramithra</strong>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#059669' }}>
                    Urban Municipalities
                  </span>
                </div>
                <p style={{ margin: '4px 0 8px', fontSize: '11px', color: 'var(--text-dim, #64748b)' }}>
                  Vijayawada, Guntur, Visakhapatnam, and all AP Urban Local Bodies.
                </p>
                <a
                  href="https://cdma.ap.gov.in/services/grievances/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-civic-teal, #0d9488)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  Open Official Portal <ExternalLink size={11} />
                </a>
              </div>

              <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-canvas, #f8fafc)', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '13px' }}>AP Mee Kosam (PGRS 1902)</strong>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#059669' }}>
                    State Highways & Rural R&B
                  </span>
                </div>
                <p style={{ margin: '4px 0 8px', fontSize: '11px', color: 'var(--text-dim, #64748b)' }}>
                  Government of Andhra Pradesh Public Grievance Redressal System.
                </p>
                <a
                  href="https://meekosam.ap.gov.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-civic-teal, #0d9488)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  Open Official Portal <ExternalLink size={11} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Resetting Session Cache */}
      {confirmResetOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 2200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            borderRadius: '14px',
            padding: '24px',
            maxWidth: '420px',
            width: '100%',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-subtle, #e2e8f0)'
          }}>
            <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} color="#ef4444" /> Clear Local Session Cache?
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--text-muted, #334155)', margin: '0 0 18px', lineHeight: 1.5 }}>
              This will clear local in-browser preferences and temporary trip caches. Your saved profile in the database will remain safe.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmResetOpen(false);
                  if (onResetSession) onResetSession();
                }}
                className="btn-danger"
                style={{ padding: '8px 16px', fontSize: '12px' }}
              >
                Yes, Clear Cache
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
