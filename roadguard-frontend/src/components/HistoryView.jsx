import React, { useState, useEffect } from 'react';
import {
  History,
  Car,
  Bike,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Camera,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  Landmark,
  ExternalLink,
  FileCheck,
  ShieldAlert,
  Send,
  Eye
} from 'lucide-react';
import { getConfirmedComplaintsHistory, getAssetUrl } from '../api';

export default function HistoryView({
  journeys = [],
  onRefresh,
  onInspectJourney
}) {
  const [activeTab, setActiveTab] = useState('journeys'); // 'journeys' | 'complaints'
  const [complaints, setComplaints] = useState([]);
  const [isLoadingComplaints, setIsLoadingComplaints] = useState(false);
  const [complaintsError, setComplaintsError] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const vehicleIcons = {
    CAR: Car,
    BIKE: Bike,
    TRUCK: Truck
  };

  useEffect(() => {
    if (activeTab === 'complaints') {
      loadComplaintsHistory();
    }
  }, [activeTab]);

  async function loadComplaintsHistory() {
    setIsLoadingComplaints(true);
    setComplaintsError(null);
    try {
      const data = await getConfirmedComplaintsHistory();
      setComplaints(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load confirmed government complaints:', err);
      let rawMsg = err.message || 'Failed to fetch confirmed complaints from server.';
      if (typeof rawMsg === 'string' && rawMsg.trim().startsWith('{') && rawMsg.trim().endsWith('}')) {
        try {
          const parsed = JSON.parse(rawMsg);
          rawMsg = parsed.message || parsed.error || `Server error (${parsed.status || 400})`;
        } catch {
          // ignore parse error
        }
      }
      setComplaintsError(rawMsg);
    } finally {
      setIsLoadingComplaints(false);
    }
  }

  function formatFilingTimestamp(isoStr) {
    if (!isoStr) return 'Date & time unconfirmed';
    try {
      const d = new Date(isoStr);
      // Format e.g. "Sunday, 25 October 2026 · 4:12 PM IST"
      const datePart = d.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      const timePart = d.toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      return `${datePart} · ${timePart} IST`;
    } catch {
      return String(isoStr);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header & Tab Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            {activeTab === 'journeys'
              ? `Inspection Journey History (${journeys.length})`
              : `Confirmed Government Complaints (${complaints.length})`}
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>
            {activeTab === 'journeys'
              ? 'Complete audit trail of road-monitoring runs, frame uploads, and defect detections.'
              : 'Verifiable history of road-defect complaints successfully raised and confirmed on government portals.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Section Tab Buttons */}
          <div style={{
            display: 'flex',
            backgroundColor: '#090d16',
            padding: '3px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <button
              onClick={() => setActiveTab('journeys')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'journeys' ? '#1e293b' : 'transparent',
                color: activeTab === 'journeys' ? '#00f5a0' : '#94a3b8',
                boxShadow: activeTab === 'journeys' ? '0 2px 8px rgba(0,0,0,0.4)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <History size={14} /> Inspection Journeys
            </button>
            <button
              onClick={() => setActiveTab('complaints')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: activeTab === 'complaints' ? '#1e293b' : 'transparent',
                color: activeTab === 'complaints' ? '#00f5a0' : '#94a3b8',
                boxShadow: activeTab === 'complaints' ? '0 2px 8px rgba(0,0,0,0.4)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <FileCheck size={14} /> Government Complaints
            </button>
          </div>

          <button
            onClick={activeTab === 'journeys' ? onRefresh : loadComplaintsHistory}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '12px' }}
            disabled={activeTab === 'complaints' && isLoadingComplaints}
          >
            <RefreshCw size={14} className={isLoadingComplaints ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: INSPECTION JOURNEYS (PRESERVED)                    */}
      {/* ======================================================== */}
      {activeTab === 'journeys' && (
        <>
          {journeys.length === 0 ? (
            <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <History size={44} color="#38bdf8" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ color: '#f8fafc', margin: '0 0 6px', fontSize: '16px' }}>No journeys recorded yet</h3>
              <p style={{ fontSize: '13px' }}>Start a live camera journey or synthetic replay from the Live Monitoring view.</p>
            </div>
          ) : (
            <>
              {/* Mobile View: Stacked Cards */}
              <div className="mobile-journey-cards" style={{ display: 'none', flexDirection: 'column', gap: '12px' }}>
                {journeys.map((j) => {
                  const Icon = vehicleIcons[j.vehicleType] || Car;
                  const isActive = j.status === 'ACTIVE';
                  return (
                    <div
                      key={j.id}
                      className="glass-card"
                      style={{
                        padding: '14px',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                      onClick={() => onInspectJourney && onInspectJourney(j)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: '#00f5a0',
                            fontSize: '13px'
                          }}>
                            #{j.id}
                          </span>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            background: isActive ? 'rgba(0, 245, 160, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                            color: isActive ? '#00f5a0' : '#94a3b8'
                          }}>
                            {j.status}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#cbd5e1', fontSize: '12px' }}>
                          <Icon size={14} color="#38bdf8" />
                          <span>{j.vehicleType}</span>
                        </div>
                      </div>

                      <div style={{ fontSize: '12px', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Frames: <strong>{j.totalFrames}</strong></span>
                        <span>Defects: <strong style={{ color: j.issueCount > 0 ? '#ff3366' : '#94a3b8' }}>{j.issueCount}</strong></span>
                      </div>

                      <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        <span>{new Date(j.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop View: Clean Table */}
              <div className="desktop-journey-table glass-panel" style={{ overflowX: 'auto', borderRadius: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8', background: 'rgba(0, 0, 0, 0.2)' }}>
                      <th style={{ padding: '12px 16px' }}>Journey ID</th>
                      <th style={{ padding: '12px 16px' }}>Status</th>
                      <th style={{ padding: '12px 16px' }}>Vehicle</th>
                      <th style={{ padding: '12px 16px' }}>Operator / Driver</th>
                      <th style={{ padding: '12px 16px' }}>Frames Uploaded</th>
                      <th style={{ padding: '12px 16px' }}>Confirmed Defects</th>
                      <th style={{ padding: '12px 16px' }}>Recorded At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journeys.map((j) => {
                      const Icon = vehicleIcons[j.vehicleType] || Car;
                      const isActive = j.status === 'ACTIVE';
                      return (
                        <tr
                          key={j.id}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                            transition: 'background 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#00f5a0' }}>
                            #{j.id}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: isActive ? 'rgba(0, 245, 160, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                              color: isActive ? '#00f5a0' : '#94a3b8'
                            }}>
                              {j.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <Icon size={14} color="#38bdf8" /> {j.vehicleType}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>
                            {j.riderName || 'Anonymous Citizen'}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>
                            {j.totalFrames} frames
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <strong style={{ color: j.issueCount > 0 ? '#ff3366' : '#94a3b8' }}>
                              {j.issueCount}
                            </strong>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '12px' }}>
                            {new Date(j.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* TAB 2: GOVERNMENT COMPLAINTS (CONFIRMED FILINGS)         */}
      {/* ======================================================== */}
      {activeTab === 'complaints' && (
        <>
          {isLoadingComplaints ? (
            <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <RefreshCw size={32} className="spin" color="#00f5a0" style={{ margin: '0 auto 12px' }} />
              <p>Loading confirmed government complaint records...</p>
            </div>
          ) : complaintsError ? (
            <div
              className="glass-panel"
              style={{
                padding: '36px 20px',
                textAlign: 'center',
                backgroundColor: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444'
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Unable to Load Government Complaints
              </h3>
              <p style={{ fontSize: '13px', color: '#cbd5e1', maxWidth: '480px', margin: 0, lineHeight: 1.5 }}>
                {complaintsError}
              </p>
              <button
                type="button"
                onClick={loadComplaintsHistory}
                style={{
                  marginTop: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 20px',
                  borderRadius: '8px',
                  backgroundColor: '#38bdf8',
                  color: '#0f172a',
                  fontWeight: 600,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#7dd3fc')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#38bdf8')}
              >
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : complaints.length === 0 ? (
            <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8', borderRadius: '14px' }}>
              <Landmark size={44} color="#38bdf8" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ color: '#f8fafc', margin: '0 0 6px', fontSize: '16px' }}>
                No Confirmed Government Complaints Yet
              </h3>
              <p style={{ fontSize: '13px', maxWidth: '520px', margin: '0 auto 12px', lineHeight: 1.5 }}>
                Complaints submitted and officially verified through supported government portals (such as NHAI RajmargYatra or AP CDMA) will appear here once confirmed.
              </p>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                backgroundColor: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#38bdf8'
              }}>
                <FileCheck size={14} /> Anti-Fabrication Rule: Drafts, pending approvals, and mock submissions are excluded.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {complaints.map((c) => {
                return (
                  <div
                    key={c.complaintId}
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
                    {/* Top Row: Portal, Official Reference & Filing Channel */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(56, 189, 248, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#38bdf8',
                          flexShrink: 0
                        }}>
                          <Landmark size={20} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                              {c.portalName}
                            </h3>
                            {c.officialPortalUrl && (
                              <a
                                href={c.officialPortalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open official government portal"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  color: '#38bdf8',
                                  textDecoration: 'none'
                                }}
                              >
                                <ExternalLink size={12} /> Official Portal
                              </a>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            {c.officialPortalUrl}
                          </div>
                        </div>
                      </div>

                      {/* Official Reference & Filing Channel Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(14, 165, 233, 0.15)',
                          color: '#38bdf8',
                          border: '1px solid rgba(14, 165, 233, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          <Send size={11} /> {c.filingChannel || 'Official Filing'}
                        </span>

                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          backgroundColor: 'rgba(0, 245, 160, 0.15)',
                          color: '#00f5a0',
                          border: '1px solid rgba(0, 245, 160, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <CheckCircle2 size={13} /> Ref: {c.officialRefId}
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Defect Category, Description & Location */}
                    <div style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.25)',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: c.defectCategory === 'POTHOLE' ? 'rgba(255, 51, 102, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: c.defectCategory === 'POTHOLE' ? '#ff3366' : '#f59e0b',
                          border: `1px solid ${c.defectCategory === 'POTHOLE' ? 'rgba(255, 51, 102, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                        }}>
                          {c.defectCategory}
                        </span>

                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                          {c.description}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '12px', color: '#94a3b8' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={13} color="#00f5a0" />
                          <strong style={{ color: '#cbd5e1' }}>{c.roadName || 'Public Road'}</strong>
                          {c.latitude && c.longitude && (
                            <span style={{ fontFamily: 'monospace', color: '#64748b' }}>
                              ({c.latitude.toFixed(4)}, {c.longitude.toFixed(4)})
                            </span>
                          )}
                        </span>

                        {c.journeyId && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <History size={13} color="#38bdf8" />
                            Journey: <strong style={{ color: '#00f5a0', fontFamily: 'monospace' }}>#{c.journeyId}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Evidence Photos (if available) */}
                    {c.evidencePhotoUrls && c.evidencePhotoUrls.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Camera size={12} /> Evidence:
                        </span>
                        {c.evidencePhotoUrls.map((url, idx) => (
                          <div
                            key={idx}
                            style={{
                              position: 'relative',
                              width: '44px',
                              height: '44px',
                              borderRadius: '6px',
                              overflow: 'hidden',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              cursor: 'pointer'
                            }}
                            onClick={() => setSelectedPhoto(getAssetUrl(url))}
                            title="Click to view full photo"
                          >
                            <img
                              src={getAssetUrl(url)}
                              alt="Evidence"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <div style={{
                              position: 'absolute',
                              inset: 0,
                              backgroundColor: 'rgba(0, 0, 0, 0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: 0,
                              transition: 'opacity 0.15s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                            >
                              <Eye size={14} color="#f8fafc" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Bottom Row: Exact Filing Date & Weekday Timestamp */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px',
                      paddingTop: '8px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                      fontSize: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
                        <Clock size={13} color="#00f5a0" />
                        <span>Filing Date: <strong style={{ color: '#f8fafc' }}>{formatFilingTimestamp(c.submittedAt)}</strong></span>
                      </div>

                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        Complaint ID: <span style={{ fontFamily: 'monospace' }}>#{c.complaintId}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Photo Preview Modal */}
      {selectedPhoto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              backgroundColor: '#0f172a',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedPhoto}
              alt="Evidence Full View"
              style={{ maxWidth: '100%', maxHeight: '80vh', display: 'block', objectFit: 'contain' }}
            />
            <div style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="btn-secondary"
                style={{ padding: '6px 16px', fontSize: '12px' }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
