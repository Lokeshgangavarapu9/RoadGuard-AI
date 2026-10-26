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
  Info,
  Cpu,
  Send,
  Globe,
  Sliders,
  CheckSquare,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import {
  getUserProfile,
  updateUserProfile,
  getConnectedPortals,
  refreshPortalStatus,
  getWorkerStatus,
  getProfileReadiness
} from '../api';

export default function ProfileView({ onProfileUpdated, onNavigateToIssues }) {
  const [activeTab, setActiveTab] = useState('personal'); // 'personal' | 'address' | 'preferences' | 'portals' | 'readiness'
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    preferredLanguage: 'English',
    mobileVerified: false,
    emailVerified: false,
    // Address & Jurisdiction
    address: '',
    state: 'Andhra Pradesh',
    district: '',
    cityOrMunicipality: '',
    ulbName: '',
    wardNumber: '',
    locality: '',
    pinCode: '',
    // Vehicle info
    primaryVrn: '',
    vehicleType: 'CAR',
    additionalVehicles: '',
    // Complaint Preferences
    preferredNotificationChannel: 'SMS',
    consentDeviceLocation: true,
    consentInspectionPhotos: true,
    communicationPreferences: ''
  });

  const [portals, setPortals] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [workerStatus, setWorkerStatus] = useState({ connected: false, activeWorkerCount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [refreshingPortalId, setRefreshingPortalId] = useState(null);
  const [portalNotice, setPortalNotice] = useState(null);

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
      const [profileData, portalsData, wStatus, readData] = await Promise.all([
        getUserProfile(),
        getConnectedPortals().catch(() => []),
        getWorkerStatus().catch(() => ({ connected: false, activeWorkerCount: 0 })),
        getProfileReadiness().catch(() => null)
      ]);

      setWorkerStatus(wStatus);
      if (readData) setReadiness(readData);

      if (profileData) {
        // Anti-mock guard: Ensure new/unregistered users never receive fabricated demo details
        const isLegacyDemo =
          profileData.email === 'lokesh.citizen@roadguard.local' ||
          (profileData.fullName === 'Lokesh Kumar' && (profileData.primaryVrn === 'AP 16 AB 1234' || profileData.primaryVrnNormalized === 'AP16AB1234')) ||
          profileData.phone === '+91 98765 43210';

        if (!isLegacyDemo && (profileData.fullName || profileData.email)) {
          setProfile({
            fullName: profileData.fullName || '',
            email: profileData.email || '',
            phoneNumber: profileData.phoneNumber || profileData.phone || '',
            preferredLanguage: profileData.preferredLanguage || 'English',
            mobileVerified: Boolean(profileData.mobileVerified),
            emailVerified: Boolean(profileData.emailVerified),
            address: profileData.address || '',
            state: profileData.state || 'Andhra Pradesh',
            district: profileData.district || '',
            cityOrMunicipality: profileData.cityOrMunicipality || '',
            ulbName: profileData.ulbName || '',
            wardNumber: profileData.wardNumber || '',
            locality: profileData.locality || '',
            pinCode: profileData.pinCode || '',
            primaryVrn: profileData.primaryVrn || '',
            vehicleType: profileData.vehicleType || 'CAR',
            additionalVehicles: profileData.additionalVehicles || '',
            preferredNotificationChannel: profileData.preferredNotificationChannel || 'SMS',
            consentDeviceLocation: profileData.consentDeviceLocation !== false,
            consentInspectionPhotos: profileData.consentInspectionPhotos !== false,
            communicationPreferences: profileData.communicationPreferences || ''
          });
        }
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
    if (e) e.preventDefault();
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

      // Refresh readiness evaluation after update
      const updatedReadiness = await getProfileReadiness().catch(() => null);
      if (updatedReadiness) setReadiness(updatedReadiness);

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
    setPortalNotice(null);
    try {
      const updated = await refreshPortalStatus(portalId);
      setPortals((prev) => prev.map((p) => ((p.portalId || p.id) === portalId ? updated : p)));
      setPortalNotice({
        portalId,
        title: 'Status Verified & Retained',
        message: updated.connectionNotes || 'Status refreshed from verified portal configuration.'
      });
    } catch (err) {
      console.error('Failed to refresh portal status:', err);
      setPortalNotice({
        portalId,
        title: 'Verification Failed',
        message: 'Could not contact backend to verify portal service status.'
      });
    } finally {
      setRefreshingPortalId(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            Citizen Profile &amp; Connected Government Portals
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>
            Maintain contact, jurisdiction and complaint preferences required for autonomous road-damage filing.
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          backgroundColor: '#090d16',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          flexWrap: 'wrap',
          gap: '4px'
        }}>
          {[
            { id: 'personal', label: 'Personal Info', icon: User },
            { id: 'address', label: 'Address & Jurisdiction', icon: MapPin },
            { id: 'preferences', label: 'Complaint Preferences', icon: Sliders },
            { id: 'portals', label: 'Connected Portals', icon: Landmark },
            { id: 'readiness', label: 'Profile Readiness', icon: CheckSquare }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: isActive ? '#1e293b' : 'transparent',
                  color: isActive ? '#00f5a0' : '#94a3b8',
                  boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.4)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={14} /> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Status Notifications */}
      {saveSuccess && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid #10b981',
          borderRadius: '10px',
          color: '#34d399',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Check size={16} /> Citizen profile changes saved and synced successfully!
        </div>
      )}

      {errorMessage && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          borderRadius: '10px',
          color: '#f87171',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertTriangle size={16} /> {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
          <RefreshCw size={32} className="spin" color="#00f5a0" style={{ margin: '0 auto 12px' }} />
          <p>Loading citizen profile and verified portal requirements...</p>
        </div>
      ) : (
        <>
          {/* ======================================================== */}
          {/* SECTION A: MY PERSONAL INFORMATION                       */}
          {/* ======================================================== */}
          {activeTab === 'personal' && (
            <div className="glass-card" style={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px', color: '#f8fafc' }}>
                  Section A: Citizen Personal Information
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                  Legitimate identity details used to author official complaint submissions under citizen representation.
                </p>
              </div>

              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  {/* Full Legal Name */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                      Full Legal Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        required
                        value={profile.fullName}
                        onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                        placeholder="e.g. Ramesh Varma"
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

                  {/* Mobile Number & Verification Badge */}
                  <div>
                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                      <span>10-Digit Mobile Number <span style={{ color: '#ef4444' }}>*</span></span>
                      <span style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: profile.mobileVerified ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: profile.mobileVerified ? '#34d399' : '#fbbf24'
                      }}>
                        {profile.mobileVerified ? 'Verified via Portal' : 'Verified at Filing Time via OTP'}
                      </span>
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
                      Mandatory for government portal SMS OTP logins (NHAI Rajmargyatra / AP CDMA).
                    </span>
                  </div>

                  {/* Email Address */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                      Email Address <span style={{ color: '#ef4444' }}>*</span>
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

                  {/* Preferred Language */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                      Preferred Language
                    </label>
                    <div style={{ position: 'relative' }}>
                      <select
                        value={profile.preferredLanguage}
                        onChange={(e) => setProfile({ ...profile, preferredLanguage: e.target.value })}
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
                      >
                        <option value="English">English</option>
                        <option value="Telugu">Telugu (తెలుగు)</option>
                        <option value="Hindi">Hindi (हिन्दी)</option>
                      </select>
                      <Globe size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                    </div>
                  </div>
                </div>

                {/* Primary Vehicle Registration */}
                <div style={{
                  padding: '16px',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Car size={16} color="#00f5a0" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                      Vehicle Identification (Optional for highway patrol telemetry)
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                        Vehicle Registration Number (VRN)
                      </label>
                      <input
                        type="text"
                        value={profile.primaryVrn}
                        onChange={(e) => setProfile({ ...profile, primaryVrn: e.target.value })}
                        placeholder="e.g. AP 16 CD 5678"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          backgroundColor: '#1e293b',
                          border: `1px solid ${isVrnValid ? 'rgba(255, 255, 255, 0.1)' : '#ef4444'}`,
                          borderRadius: '6px',
                          color: '#f8fafc',
                          fontSize: '12px',
                          textTransform: 'uppercase',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                        Vehicle Classification
                      </label>
                      <select
                        value={profile.vehicleType}
                        onChange={(e) => setProfile({ ...profile, vehicleType: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          backgroundColor: '#1e293b',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          color: '#f8fafc',
                          fontSize: '12px',
                          boxSizing: 'border-box'
                        }}
                      >
                        <option value="CAR">Passenger Car / SUV</option>
                        <option value="MOTORCYCLE">Two-Wheeler / Motorcycle</option>
                        <option value="AUTO_RICKSHAW">Three-Wheeler Auto</option>
                        <option value="TRUCK">Commercial Truck / Bus</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-primary"
                  style={{ alignSelf: 'flex-start', padding: '10px 20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Save size={15} /> {isSaving ? 'Saving Changes...' : 'Save Personal Info'}
                </button>
              </form>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION B: ADDRESS & JURISDICTION                        */}
          {/* ======================================================== */}
          {activeTab === 'address' && (
            <div className="glass-card" style={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px', color: '#f8fafc' }}>
                  Section B: Address and Civic Jurisdiction
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                  Required by municipal grievance portals (e.g. AP CDMA / Puramithra) to map defects to statutory city wards.
                </p>
              </div>

              {/* Informational isolation notice */}
              <div style={{
                padding: '12px 14px',
                backgroundColor: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#cbd5e1',
                lineHeight: 1.5,
                display: 'flex',
                gap: '10px'
              }}>
                <Info size={16} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>Jurisdiction Isolation:</strong> Residential addresses are maintained separately from detected road hazards. For highway defects, RoadGuard uses the actual GPS telemetry of the hazard, not your home address.
                </span>
              </div>

              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  {/* State */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                      State / UT
                    </label>
                    <input
                      type="text"
                      value={profile.state}
                      onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                      placeholder="e.g. Andhra Pradesh"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* District */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                      District
                    </label>
                    <input
                      type="text"
                      value={profile.district}
                      onChange={(e) => setProfile({ ...profile, district: e.target.value })}
                      placeholder="e.g. Krishna / NTR District"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Municipality / Urban Local Body */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                      City / Municipality / ULB <span style={{ color: '#00f5a0' }}>(Required for AP CDMA)</span>
                    </label>
                    <input
                      type="text"
                      value={profile.cityOrMunicipality}
                      onChange={(e) => setProfile({ ...profile, cityOrMunicipality: e.target.value, ulbName: e.target.value })}
                      placeholder="e.g. Vijayawada Municipal Corporation"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Ward Number */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                      Ward Number
                    </label>
                    <input
                      type="text"
                      value={profile.wardNumber}
                      onChange={(e) => setProfile({ ...profile, wardNumber: e.target.value })}
                      placeholder="e.g. Ward 12"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Locality */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                      Locality / Colony
                    </label>
                    <input
                      type="text"
                      value={profile.locality}
                      onChange={(e) => setProfile({ ...profile, locality: e.target.value })}
                      placeholder="e.g. Benz Circle"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Postal PIN Code */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                      Postal PIN Code
                    </label>
                    <input
                      type="text"
                      value={profile.pinCode}
                      onChange={(e) => setProfile({ ...profile, pinCode: e.target.value })}
                      placeholder="e.g. 520010"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* Street / Postal Address */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                    Street / Residential Address (Optional postal contact)
                  </label>
                  <textarea
                    rows={2}
                    value={profile.address}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    placeholder="e.g. Door 4-12, Ring Road"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-primary"
                  style={{ alignSelf: 'flex-start', padding: '10px 20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Save size={15} /> {isSaving ? 'Saving Changes...' : 'Save Address & Jurisdiction'}
                </button>
              </form>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION C: COMPLAINT PREFERENCES                         */}
          {/* ======================================================== */}
          {activeTab === 'preferences' && (
            <div className="glass-card" style={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px', color: '#f8fafc' }}>
                  Section C: Citizen Complaint Preferences &amp; Permissions
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                  Configure notification channels and explicit permissions for evidence utilization in legal grievance filings.
                </p>
              </div>

              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Notification Channel */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                    Preferred Government Correspondence Channel
                  </label>
                  <select
                    value={profile.preferredNotificationChannel}
                    onChange={(e) => setProfile({ ...profile, preferredNotificationChannel: e.target.value })}
                    style={{
                      maxWidth: '320px',
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="SMS">SMS Notification (Official Grievance Receipt)</option>
                    <option value="EMAIL">Email Correspondence</option>
                    <option value="BOTH">Both SMS &amp; Email</option>
                  </select>
                </div>

                {/* Permissions & Explicit Consent */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  padding: '16px',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
                    Explicit Evidence &amp; Telemetry Permissions
                  </div>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={profile.consentDeviceLocation}
                      onChange={(e) => setProfile({ ...profile, consentDeviceLocation: e.target.checked })}
                      style={{ marginTop: '3px' }}
                    />
                    <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                      <strong>Consent to use high-precision device location:</strong> Grants permission to extract satellite coordinates during road inspections to map potholes to statutory authorities.
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={profile.consentInspectionPhotos}
                      onChange={(e) => setProfile({ ...profile, consentInspectionPhotos: e.target.checked })}
                      style={{ marginTop: '3px' }}
                    />
                    <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                      <strong>Consent to upload defect photos as legal evidence:</strong> Authorizes RoadGuard AI to upload anonymized road damage frames to official grievance portals as proof of damage.
                    </div>
                  </label>
                </div>

                {/* Additional Communication Notes */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                    Special Communication or Accessibility Requests
                  </label>
                  <input
                    type="text"
                    value={profile.communicationPreferences}
                    onChange={(e) => setProfile({ ...profile, communicationPreferences: e.target.value })}
                    placeholder="e.g. Call after 5 PM; communicate in Telugu"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-primary"
                  style={{ alignSelf: 'flex-start', padding: '10px 20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Save size={15} /> {isSaving ? 'Saving Changes...' : 'Save Preferences'}
                </button>
              </form>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION D: CONNECTED GOVERNMENT SERVICES                 */}
          {/* ======================================================== */}
          {activeTab === 'portals' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Playwright Agent Status Banner */}
              <div style={{
                backgroundColor: '#0f172a',
                border: `1px solid ${workerStatus.connected ? 'rgba(0, 245, 160, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Cpu size={20} color={workerStatus.connected ? '#00f5a0' : '#eab308'} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
                      Playwright Local Automation Worker
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      Required for automated form-filling on official portals with human-in-the-loop OTP/CAPTCHA handoffs.
                    </div>
                  </div>
                </div>

                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '999px',
                  backgroundColor: workerStatus.connected ? 'rgba(0, 245, 160, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                  color: workerStatus.connected ? '#00f5a0' : '#eab308',
                  border: `1px solid ${workerStatus.connected ? 'rgba(0, 245, 160, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`
                }}>
                  {workerStatus.connected ? `Agent Active (${workerStatus.activeWorkerCount} worker)` : 'Agent Offline (Manual Handoff)'}
                </span>
              </div>

              {/* Portal Notice Toast */}
              {portalNotice && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: 'rgba(14, 165, 233, 0.15)',
                  border: '1px solid #0ea5e9',
                  borderRadius: '8px',
                  color: '#38bdf8',
                  fontSize: '12px'
                }}>
                  <strong>{portalNotice.title}:</strong> {portalNotice.message}
                </div>
              )}

              {/* Portal Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                {portals.map((portal) => {
                  const pId = portal.portalId || portal.id;
                  const isRefreshing = refreshingPortalId === pId;

                  return (
                    <div
                      key={pId}
                      className="glass-card"
                      style={{
                        backgroundColor: '#0f172a',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        padding: '18px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                        <div>
                          <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                            {portal.portalName}
                          </h4>
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
                              marginTop: '2px'
                            }}
                          >
                            <ExternalLink size={11} /> {portal.officialUrl}
                          </a>
                        </div>

                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.3)'
                        }}>
                          {portal.status || 'MANUAL_HANDOFF_ONLY'}
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.45 }}>
                        <strong style={{ color: '#94a3b8' }}>Jurisdiction:</strong> {portal.roadJurisdiction}
                      </div>

                      <div style={{
                        fontSize: '11px',
                        color: '#94a3b8',
                        lineHeight: 1.45,
                        backgroundColor: 'rgba(0,0,0,0.25)',
                        padding: '10px',
                        borderRadius: '6px'
                      }}>
                        {portal.connectionNotes}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px' }}>
                        <button
                          onClick={() => handleRefreshPortal(pId)}
                          disabled={isRefreshing}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '11px' }}
                        >
                          <RefreshCw size={12} className={isRefreshing ? 'spin' : ''} /> Check Status
                        </button>

                        <a
                          href={portal.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary"
                          style={{ padding: '6px 12px', fontSize: '11px', textDecoration: 'none' }}
                        >
                          Open Portal &rarr;
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECTION E & H: PROFILE READINESS & PORTAL REQUIREMENTS   */}
          {/* ======================================================== */}
          {activeTab === 'readiness' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Readiness Scores Overview Card */}
              <div className="glass-card" style={{
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px', color: '#f8fafc' }}>
                      Profile Readiness for Autonomous Grievance Filing
                    </h3>
                    <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                      Evaluates saved citizen details against mandatory requirements of statutory road grievance portals.
                    </p>
                  </div>

                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: readiness?.overallStatus === 'READY' ? 'rgba(0, 245, 160, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: readiness?.overallStatus === 'READY' ? '#00f5a0' : '#fbbf24',
                    border: `1px solid ${readiness?.overallStatus === 'READY' ? 'rgba(0, 245, 160, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                  }}>
                    {readiness?.overallStatus || 'CHECKING READINESS'}
                  </span>
                </div>

                {/* Score Meters */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div style={{ backgroundColor: 'rgba(0,0,0,0.25)', padding: '14px', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                      <span>Personal Info Completeness</span>
                      <strong style={{ color: '#00f5a0' }}>{readiness?.personalInfoCompletenessPercent || 0}%</strong>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${readiness?.personalInfoCompletenessPercent || 0}%`,
                        height: '100%',
                        backgroundColor: '#00f5a0',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'rgba(0,0,0,0.25)', padding: '14px', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                      <span>Address &amp; Jurisdiction</span>
                      <strong style={{ color: '#38bdf8' }}>{readiness?.addressJurisdictionCompletenessPercent || 0}%</strong>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${readiness?.addressJurisdictionCompletenessPercent || 0}%`,
                        height: '100%',
                        backgroundColor: '#38bdf8',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Portal-Specific Requirements & Evaluation Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '6px 0 0', color: '#f8fafc' }}>
                  Verified Portal Requirements Evaluation
                </h4>

                {readiness?.portalReadinessList?.map((p) => {
                  return (
                    <div
                      key={p.portalId}
                      className="glass-card"
                      style={{
                        backgroundColor: '#0f172a',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        padding: '18px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                            {p.portalName}
                          </h4>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {p.roadJurisdiction}
                          </span>
                        </div>

                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: p.isReadyToPrepare ? 'rgba(0, 245, 160, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: p.isReadyToPrepare ? '#00f5a0' : '#f87171',
                          border: `1px solid ${p.isReadyToPrepare ? 'rgba(0, 245, 160, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}>
                          {p.isReadyToPrepare ? 'Ready to Prepare Complaint' : 'Missing Required Details'}
                        </span>
                      </div>

                      {/* Satisfied vs Missing Fields */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', fontSize: '12px' }}>
                        <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                          <div style={{ color: '#00f5a0', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={13} /> Satisfied Prerequisites:
                          </div>
                          {p.satisfiedFields.length > 0 ? (
                            <ul style={{ margin: 0, paddingLeft: '16px', color: '#cbd5e1', lineHeight: 1.5 }}>
                              {p.satisfiedFields.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                          ) : (
                            <div style={{ color: '#64748b' }}>None satisfied yet.</div>
                          )}
                        </div>

                        <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                          <div style={{ color: p.missingRequiredFields.length > 0 ? '#ff3366' : '#94a3b8', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={13} /> Missing Mandatory Fields:
                          </div>
                          {p.missingRequiredFields.length > 0 ? (
                            <ul style={{ margin: 0, paddingLeft: '16px', color: '#f87171', lineHeight: 1.5 }}>
                              {p.missingRequiredFields.map((m, i) => <li key={i}>{m}</li>)}
                            </ul>
                          ) : (
                            <div style={{ color: '#00f5a0' }}>All mandatory fields satisfied!</div>
                          )}
                        </div>
                      </div>

                      {/* Summary & Next Action */}
                      <div style={{
                        padding: '10px 14px',
                        backgroundColor: 'rgba(56, 189, 248, 0.08)',
                        border: '1px solid rgba(56, 189, 248, 0.2)',
                        borderRadius: '6px',
                        fontSize: '11px',
                        color: '#cbd5e1',
                        lineHeight: 1.45
                      }}>
                        <div><strong style={{ color: '#38bdf8' }}>Status:</strong> {p.readinessSummary}</div>
                        <div style={{ marginTop: '4px' }}><strong style={{ color: '#00f5a0' }}>Next Step:</strong> {p.nextCitizenAction}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
