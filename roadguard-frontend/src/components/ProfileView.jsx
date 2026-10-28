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
  ShieldCheck
} from 'lucide-react';
import { getUserProfile, updateUserProfile } from '../api';
import { isValidCoordinate } from '../utils/geoUtils';

export default function ProfileView({
  currentLocation = null,
  onProfileUpdated = null
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
            city: data.cityOrMunicipality || 'Vijayawada',
            district: data.district || 'NTR District',
            state: data.state || 'Andhra Pradesh',
            pinCode: data.pinCode || '520010',
            jurisdiction: 'NHAI / VMC CDMA'
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

  // BookMyShow-Style Auto-Detect Location from Live GPS
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

        const city = addr.city || addr.town || addr.village || addr.suburb || 'Vijayawada';
        const district = addr.county || addr.state_district || 'NTR District';
        const state = addr.state || 'Andhra Pradesh';
        const pin = addr.postcode || '520010';
        const road = addr.road || '';

        let jurisdiction = 'VMC CDMA (Urban Local Body)';
        if (/national\s*highway|nh\b/i.test(road)) {
          jurisdiction = 'NHAI (National Highways Authority of India)';
        } else if (/state\s*highway|sh\b|mdr\b/i.test(road)) {
          jurisdiction = 'AP Roads & Buildings (State Highways)';
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
        // Fallback for Andhra Pradesh corridor
        setAutoLocationBadge({
          city: 'Vijayawada',
          district: 'NTR District',
          state: 'Andhra Pradesh',
          pinCode: '520010',
          jurisdiction: 'NHAI / VMC CDMA'
        });
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
          // Fallback location badge
          setAutoLocationBadge({
            city: 'Vijayawada',
            district: 'NTR District',
            state: 'Andhra Pradesh',
            pinCode: '520010',
            jurisdiction: 'NHAI / VMC CDMA'
          });
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setIsGeocoding(false);
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

  if (isLoading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
        <RefreshCw size={32} className="spin" color="#0284c7" style={{ margin: '0 auto 12px' }} />
        <p style={{ color: '#64748b', fontSize: '14px' }}>Loading Citizen Profile & Portals...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
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
              background: '#f0f9ff',
              color: '#0284c7'
            }}>
              <User size={20} />
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Citizen Profile & Official Portals
            </h2>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
            Manage your citizen identity, vehicle details, and auto-detect your road jurisdiction for 1-click grievance filing.
          </p>
        </div>

        {saveSuccess && (
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
            <CheckCircle2 size={15} /> Profile Saved Successfully
          </div>
        )}
      </div>

      {errorMessage && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#dc2626',
          padding: '12px 16px',
          borderRadius: '10px',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} />
          {errorMessage}
        </div>
      )}

      {/* 2-Column Responsive Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 1.25fr) minmax(280px, 0.95fr)',
        gap: '20px'
      }} className="profile-split-grid">

        {/* LEFT COLUMN: Citizen & Vehicle Identity + BookMyShow Auto-Location */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '22px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Citizen & Vehicle Information
          </h3>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 2-Column Grid for Personal Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lokesh Gangavarapu"
                  value={profile.fullName}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    background: '#f8fafc'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  10-Digit Mobile Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={profile.phoneNumber}
                  onChange={(e) => setProfile({ ...profile, phoneNumber: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    background: '#f8fafc'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="e.g. citizen@roadguard.org"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
                  outline: 'none',
                  background: '#f8fafc'
                }}
              />
            </div>

            {/* Vehicle Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Vehicle Reg. Number (VRN)
                </label>
                <input
                  type="text"
                  placeholder="e.g. AP 16 AB 1234"
                  value={profile.primaryVrn}
                  onChange={(e) => setProfile({ ...profile, primaryVrn: e.target.value.toUpperCase() })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    background: '#f8fafc',
                    fontFamily: 'monospace',
                    fontWeight: 600
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Vehicle Type
                </label>
                <select
                  value={profile.vehicleType}
                  onChange={(e) => setProfile({ ...profile, vehicleType: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    background: '#f8fafc',
                    fontWeight: 600
                  }}
                >
                  <option value="CAR">Car / SUV</option>
                  <option value="BIKE">Two-Wheeler / Bike</option>
                  <option value="HEAVY">Truck / Commercial</option>
                </select>
              </div>
            </div>

            {/* BookMyShow-Style "Auto-Detect My Location" Bar */}
            <div style={{
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '10px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#0369a1' }}>
                  Geospatial Jurisdiction & Location
                </span>
                <button
                  type="button"
                  onClick={handleAutoDetectLocation}
                  disabled={isGeocoding}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    background: '#0284c7',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
                  }}
                >
                  <MapPin size={13} />
                  {isGeocoding ? 'Detecting...' : '📍 Auto-Detect My Location (Live GPS)'}
                </button>
              </div>

              {autoLocationBadge ? (
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #7dd3fc',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <ShieldCheck size={16} color="#0284c7" style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Auto-Located:</strong> {autoLocationBadge.city} ({autoLocationBadge.district}, {autoLocationBadge.state} — {autoLocationBadge.pinCode})
                    <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '2px', fontWeight: 600 }}>
                      Jurisdiction: {autoLocationBadge.jurisdiction}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Click Auto-Detect to reverse-geocode your GPS coordinate to your city, district, and responsible road authority automatically.
                </div>
              )}
            </div>

            {/* Buttons Row */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="submit"
                disabled={isSaving}
                style={{
                  flex: 1,
                  padding: '11px 20px',
                  background: '#102a43',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Save size={15} /> {isSaving ? 'Saving...' : 'Save Profile'}
              </button>

              <button
                type="button"
                onClick={handleClearForm}
                style={{
                  padding: '11px 16px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: '#64748b',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Clear
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: Cute, Compact "Connected Portals" Strip */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '22px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Connected Government Portals
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
              Pre-configured public grievance gateways for Andhra Pradesh & National Highways.
            </p>
          </div>

          {/* 3 Sleek Compact Portal Mini-Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 1. NHAI Rajmargyatra */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                  NHAI Rajmargyatra
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#ecfdf5', color: '#059669' }}>
                  Ready for 1-Click Handoff
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                National Highways (NH-prefix roads) across India.
              </p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <a
                  href="https://rajmargyatra.nhai.gov.in/complaints"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '6px 10px',
                    background: '#102a43',
                    color: '#ffffff',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textDecoration: 'none'
                  }}
                >
                  Launch Portal ↗
                </a>
                <a
                  href="https://rajmargyatra.nhai.gov.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '6px 10px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textDecoration: 'none'
                  }}
                >
                  Check Status ↗
                </a>
              </div>
            </div>

            {/* 2. AP CDMA Puramithra */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                  AP CDMA Puramithra
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#ecfdf5', color: '#059669' }}>
                  Ready for 1-Click Handoff
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                Urban Local Bodies, Municipal Corporations, and town internal roads.
              </p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <a
                  href="https://cdma.ap.gov.in/services/grievances/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '6px 10px',
                    background: '#0d9488',
                    color: '#ffffff',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textDecoration: 'none'
                  }}
                >
                  Launch Portal ↗
                </a>
                <a
                  href="https://puraaseva.ap.gov.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '6px 10px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textDecoration: 'none'
                  }}
                >
                  Check Status ↗
                </a>
              </div>
            </div>

            {/* 3. AP Mee Kosam / PGRS */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                  AP Mee Kosam (PGRS)
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#ecfdf5', color: '#059669' }}>
                  Ready for 1-Click Handoff
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                Andhra Pradesh Public Grievance Redressal System & State Highways.
              </p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <a
                  href="https://meekosam.ap.gov.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '6px 10px',
                    background: '#243b53',
                    color: '#ffffff',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textDecoration: 'none'
                  }}
                >
                  Launch Portal ↗
                </a>
                <a
                  href="https://meekosam.ap.gov.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '6px 10px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textDecoration: 'none'
                  }}
                >
                  Check Status ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
