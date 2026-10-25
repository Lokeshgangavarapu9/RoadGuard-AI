import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Car,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Lock,
  FileText,
  Building,
  Landmark,
  Save,
  Check,
  AlertTriangle,
  Info
} from 'lucide-react';
import { getUserProfile, updateUserProfile, getConnectedPortals, refreshPortalStatus } from '../api';

export default function ProfileView({ onProfileUpdated }) {
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    address: '',
    primaryVrn: '',
    vehicleType: 'CAR',
    additionalVehicles: ''
  });

  const [portals, setPortals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [refreshingPortalId, setRefreshingPortalId] = useState(null);

  // Live VRN Normalization helper
  function normalizeVrn(vrn) {
    if (!vrn) return '';
    return vrn.replace(/[\s\-_]/g, '').toUpperCase();
  }

  const normalizedVrn = normalizeVrn(profile.primaryVrn);
  const isVrnValid = normalizedVrn.length === 0 || /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/.test(normalizedVrn);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [profileData, portalsData] = await Promise.all([
        getUserProfile(),
        getConnectedPortals().catch(() => [])
      ]);

      if (profileData) {
        setProfile({
          fullName: profileData.fullName || '',
          email: profileData.email || '',
          phoneNumber: profileData.phoneNumber || profileData.phone || '',
          address: profileData.address || '',
          primaryVrn: profileData.primaryVrn || '',
          vehicleType: profileData.vehicleType || 'CAR',
          additionalVehicles: profileData.additionalVehicles || ''
        });
      }

      if (portalsData && Array.isArray(portalsData)) {
        setPortals(portalsData);
      }
    } catch (err) {
      console.error('Failed to load profile or portal data:', err);
      setErrorMessage(err.message || 'Could not load profile from cloud backend.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      const payload = {
        ...profile,
        phone: (profile.phoneNumber || profile.phone || '').trim(),
        phoneNumber: (profile.phoneNumber || profile.phone || '').trim()
      };
      const updated = await updateUserProfile(payload);
      setSaveSuccess(true);
      if (onProfileUpdated) onProfileUpdated(updated);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setErrorMessage(err.message || 'Failed to save profile. Ensure backend is running.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRefreshPortal(portalId) {
    setRefreshingPortalId(portalId);
    try {
      const updatedPortal = await refreshPortalStatus(portalId);
      setPortals(prev => prev.map(p => (p.portalId === portalId || p.id === portalId) ? updatedPortal : p));
    } catch (err) {
      console.error('Failed to refresh portal status:', err);
    } finally {
      setRefreshingPortalId(null);
    }
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'CONNECTED_VERIFIED':
        return {
          label: 'CONNECTED & VERIFIED',
          bg: 'rgba(16, 185, 129, 0.15)',
          border: '#10b981',
          text: '#34d399',
          icon: CheckCircle2
        };
      case 'MANUAL_HANDOFF_ONLY':
        return {
          label: 'MANUAL CITIZEN HANDOFF',
          bg: 'rgba(14, 165, 233, 0.15)',
          border: '#0ea5e9',
          text: '#38bdf8',
          icon: ExternalLink
        };
      case 'LOGIN_REQUIRED':
        return {
          label: 'CITIZEN LOGIN REQUIRED',
          bg: 'rgba(245, 158, 11, 0.15)',
          border: '#f59e0b',
          text: '#fbbf24',
          icon: Lock
        };
      case 'API_UNAVAILABLE':
        return {
          label: 'NO PUBLIC API (ASSISTED)',
          bg: 'rgba(148, 163, 184, 0.12)',
          border: '#64748b',
          text: '#94a3b8',
          icon: Info
        };
      case 'PORTAL_UNAVAILABLE':
      case 'CONNECTION_FAILED':
        return {
          label: 'SERVICE OFFLINE',
          bg: 'rgba(239, 68, 68, 0.15)',
          border: '#ef4444',
          text: '#f87171',
          icon: AlertTriangle
        };
      default:
        return {
          label: status || 'NOT CONNECTED',
          bg: 'rgba(100, 116, 139, 0.15)',
          border: '#64748b',
          text: '#cbd5e1',
          icon: Info
        };
    }
  }

  if (isLoading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
        <RefreshCw size={28} className="spin" style={{ marginBottom: '12px', color: '#00f5a0' }} />
        <p>Loading user profile and connected portal status...</p>
      </div>
    );
  }

  if (errorMessage && !profile.fullName) {
    return (
      <div style={{
        maxWidth: '560px',
        margin: '60px auto',
        padding: '32px 24px',
        textAlign: 'center',
        background: '#0f172a',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
      }}>
        <AlertCircle size={44} color="#f87171" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ color: '#f8fafc', margin: '0 0 8px', fontSize: '18px', fontWeight: 700 }}>
          Unable to Load Profile
        </h3>
        <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 24px', lineHeight: 1.5 }}>
          {errorMessage}
          <br />
          The cloud backend may be asleep on Render or temporarily unreachable.
        </p>
        <button
          onClick={loadData}
          className="btn-primary"
          style={{ padding: '10px 24px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={15} />
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px 60px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #00f5a0 0%, #00b4d8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#04121d',
            boxShadow: '0 0 16px rgba(0, 245, 160, 0.3)'
          }}>
            <User size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: '#f8fafc', letterSpacing: '-0.02em' }}>
              My Profile & Connected Services
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
              Citizen credentials, vehicle registrations, and official government complaint destinations.
            </p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {saveSuccess && (
        <div style={{
          padding: '14px 18px',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid #10b981',
          borderRadius: '10px',
          color: '#34d399',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '24px'
        }}>
          <CheckCircle2 size={18} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>
            Profile updated successfully. Your vehicle and citizen details are now active for grievance filings.
          </span>
        </div>
      )}

      {errorMessage && (
        <div style={{
          padding: '14px 18px',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          borderRadius: '10px',
          color: '#f87171',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '24px'
        }}>
          <AlertCircle size={18} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>{errorMessage}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        {/* Left Column: Citizen & Vehicle Profile */}
        <div style={{
          backgroundColor: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '24px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '14px' }}>
            <Shield size={18} color="#00f5a0" />
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#f1f5f9' }}>
              Complainant Citizen Identity
            </h2>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Full Name */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                Full Name (as per ID/Aadhaar) *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  value={profile.fullName}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                  placeholder="e.g. Lokesh Kumar"
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    backgroundColor: '#1e293b',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <User size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                Email Address (for grievance receipts) *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  required
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="e.g. citizen@example.com"
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    backgroundColor: '#1e293b',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <Mail size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                Mobile Number (required for portal OTP) *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="tel"
                  required
                  value={profile.phoneNumber}
                  onChange={(e) => setProfile({ ...profile, phoneNumber: e.target.value })}
                  placeholder="e.g. 9876543210"
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    backgroundColor: '#1e293b',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <Phone size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Used during manual portal handoff to receive one-time passwords from NHAI/AP PGRS.
              </span>
            </div>

            {/* Address */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                Residential / Postal Address (optional)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={profile.address}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  placeholder="e.g. Vijayawada, Krishna District, Andhra Pradesh"
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    backgroundColor: '#1e293b',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <MapPin size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              </div>
            </div>

            {/* Primary Vehicle Registration Number (VRN) */}
            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '16px', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>
                  Primary Vehicle Registration Number (VRN)
                </label>
                {normalizedVrn && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: isVrnValid ? 'rgba(0, 245, 160, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: isVrnValid ? '#00f5a0' : '#f87171',
                    border: `1px solid ${isVrnValid ? 'rgba(0, 245, 160, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                  }}>
                    {isVrnValid ? `Normalized: ${normalizedVrn}` : 'Format Check'}
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={profile.primaryVrn}
                  onChange={(e) => setProfile({ ...profile, primaryVrn: e.target.value })}
                  placeholder="e.g. AP 16 AB 1234 or DL 01 A 9999"
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    backgroundColor: '#1e293b',
                    border: `1px solid ${isVrnValid ? 'rgba(255, 255, 255, 0.1)' : '#ef4444'}`,
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <Car size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Preserves original display formatting while storing normalized alphanumeric token for authority verification.
              </span>
            </div>

            {/* Vehicle Type */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                Default Vehicle Classification
              </label>
              <select
                value={profile.vehicleType}
                onChange={(e) => setProfile({ ...profile, vehicleType: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: '#1e293b',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="CAR">Passenger Car / Taxi / SUV</option>
                <option value="MOTORCYCLE">Two-Wheeler (Motorcycle / Scooter)</option>
                <option value="AUTO_RICKSHAW">Three-Wheeler (Auto Rickshaw)</option>
                <option value="TRUCK">Heavy Commercial Vehicle / Truck</option>
                <option value="BUS">Bus / Transit</option>
                <option value="BICYCLE">Bicycle</option>
              </select>
            </div>

            {/* Additional Vehicles */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                Additional Vehicles (comma separated)
              </label>
              <input
                type="text"
                value={profile.additionalVehicles}
                onChange={(e) => setProfile({ ...profile, additionalVehicles: e.target.value })}
                placeholder="e.g. AP 16 CD 5678, TS 09 EF 9012"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: '#1e293b',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={isSaving}
              style={{
                marginTop: '10px',
                padding: '12px 20px',
                background: 'linear-gradient(135deg, #00f5a0 0%, #00b4d8 100%)',
                color: '#04121d',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.7 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              {isSaving ? (
                <>
                  <RefreshCw size={16} className="spin" /> Saving Changes...
                </>
              ) : (
                <>
                  <Save size={16} /> Save Profile Changes
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Connected Government Services */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Card */}
          <div style={{
            backgroundColor: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '20px 24px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Landmark size={20} color="#38bdf8" />
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#f1f5f9' }}>
                Connected Government Portals
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
              RoadGuard AI routes verified road hazards to the legally responsible statutory authority. State and national grievance portals strictly mandate citizen mobile OTP or BotDetect CAPTCHA verification. We generate a pre-formatted evidence dossier and launch an assisted citizen handoff.
            </p>
          </div>

          {/* Portal Cards */}
          {portals.map((portal) => {
            const badge = getStatusBadge(portal.status || portal.connectionStatus);
            const BadgeIcon = badge.icon;
            const currentPortalKey = portal.portalId || portal.id;
            const isRefreshing = refreshingPortalId === currentPortalKey;

            return (
              <div
                key={portal.id || portal.portalId}
                style={{
                  backgroundColor: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '14px',
                  padding: '20px',
                  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}
              >
                {/* Title & Status Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                      {portal.portalName}
                    </h3>
                    <a
                      href={portal.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        color: '#38bdf8',
                        textDecoration: 'none',
                        marginTop: '3px'
                      }}
                    >
                      {portal.officialUrl} <ExternalLink size={10} />
                    </a>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    backgroundColor: badge.bg,
                    border: `1px solid ${badge.border}`,
                    color: badge.text,
                    fontSize: '10px',
                    fontWeight: 700
                  }}>
                    <BadgeIcon size={12} />
                    <span>{badge.label}</span>
                  </div>
                </div>

                {/* Jurisdiction & Integration Mode */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '8px',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px',
                  fontSize: '11px'
                }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Jurisdiction: </span>
                    <strong style={{ color: '#e2e8f0' }}>{portal.roadJurisdiction}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Filing Channel: </span>
                    <strong style={{ color: '#e2e8f0' }}>Official Citizen Redressal</strong>
                  </div>
                </div>

                {/* Description & Integration Notes */}
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: 1.45 }}>
                  {portal.connectionNotes || portal.description}
                </p>

                {/* Footer Actions */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '10px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>
                    Last Verified: {portal.lastVerifiedAt ? new Date(portal.lastVerifiedAt).toLocaleDateString() : 'Active configuration'}
                  </span>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleRefreshPortal(currentPortalKey)}
                      disabled={isRefreshing}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        color: '#94a3b8',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: isRefreshing ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <RefreshCw size={12} className={isRefreshing ? 'spin' : ''} />
                      Verify Status
                    </button>

                    <a
                      href={portal.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '6px 14px',
                        backgroundColor: 'rgba(14, 165, 233, 0.15)',
                        border: '1px solid rgba(14, 165, 233, 0.4)',
                        borderRadius: '6px',
                        color: '#38bdf8',
                        fontSize: '11px',
                        fontWeight: 700,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <ExternalLink size={12} /> Open Portal
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
