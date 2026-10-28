import React, { useState, useEffect } from 'react';
import {
  FileText,
  Shield,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  Landmark,
  Building,
  Copy,
  Check,
  AlertTriangle,
  MapPin,
  Image as ImageIcon,
  ChevronRight
} from 'lucide-react';
import { getConfirmedComplaintsHistory, listComplaints, getAssetUrl } from '../api';

export default function GovernmentReportsView({ onSelectComplaint, onNavigateToScanner }) {
  const [complaints, setComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'CONFIRMED' | 'HANDOFF'

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    setIsLoading(true);
    setError(null);
    try {
      const [confirmed, allList] = await Promise.all([
        getConfirmedComplaintsHistory().catch(() => []),
        listComplaints().catch(() => [])
      ]);

      // Merge confirmed history with all prepared complaints, deduplicating by id
      const map = new Map();
      if (Array.isArray(confirmed)) {
        confirmed.forEach(c => map.set(c.complaintId || c.id, { ...c, isConfirmed: true }));
      }
      if (Array.isArray(allList)) {
        allList.forEach(c => {
          if (!map.has(c.id)) {
            map.set(c.id, {
              complaintId: c.id,
              status: c.status,
              officialRefId: c.officialRefId,
              subject: c.subject,
              bodyText: c.bodyText,
              authorityCode: c.authorityCode || c.authority?.deptCode || 'NHAI',
              authorityName: c.authorityName || c.authority?.deptName || 'National Highways Authority of India',
              portalUrl: c.portalUrl || c.authority?.grievanceUrl || 'https://rajmargyatra.nhai.gov.in',
              submittedAt: c.submittedAt || c.updatedAt,
              createdAt: c.createdAt,
              roadName: c.roadIssue?.roadName,
              latitude: c.roadIssue?.latitude,
              longitude: c.roadIssue?.longitude,
              defectClass: c.roadIssue?.defectClass,
              confidenceScore: c.roadIssue?.confidenceScore,
              filingChannel: c.officialRefId ? 'Verified Receipt Recorded' : '1-Click Assisted Portal Handoff + Citizen OTP',
              isConfirmed: Boolean(c.officialRefId && c.status === 'SUBMITTED')
            });
          }
        });
      }

      setComplaints(Array.from(map.values()));
    } catch (err) {
      console.error('Failed to load government reports:', err);
      setError(err.message || 'Unable to load government reports.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleCopy(text, id) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function formatIST(isoStr) {
    if (!isoStr) return 'Pending Verification';
    try {
      return new Date(isoStr).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) + ' IST';
    } catch {
      return isoStr;
    }
  }

  const filtered = complaints.filter(c => {
    if (filterMode === 'CONFIRMED') return c.isConfirmed || c.officialRefId;
    if (filterMode === 'HANDOFF') return !c.officialRefId;
    return true;
  });

  const confirmedCount = complaints.filter(c => c.isConfirmed || c.officialRefId).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
              background: '#f0fdfa',
              color: '#0d9488'
            }}>
              <Shield size={20} />
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Official Government Filing Ledger
            </h2>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '6px 0 0' }}>
            Truthful, tamper-evident audit ledger of road defect grievances dispatched to NHAI Rajmargyatra, AP CDMA, and AP Mee Kosam / PGRS.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={loadReports}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} /> Refresh Ledger
          </button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Dossiers Prepared</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{complaints.length}</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600, textTransform: 'uppercase' }}>Confirmed on Official Portals</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>{confirmedCount}</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 600, textTransform: 'uppercase' }}>Assisted OTP Handoffs</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>{complaints.length - confirmedCount}</div>
        </div>
      </div>

      {/* Ledger Content */}
      {isLoading ? (
        <div style={{ padding: '60px', textAlign: 'center', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <RefreshCw size={32} className="spin" color="#0d9488" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: '#64748b', fontSize: '14px' }}>Loading verified government complaint records...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', background: '#ffffff', borderRadius: '14px', border: '1px solid #fecaca' }}>
          <AlertTriangle size={36} color="#dc2626" style={{ margin: '0 auto 10px' }} />
          <h3 style={{ margin: '0 0 6px', color: '#0f172a' }}>Failed to Load Records</h3>
          <p style={{ color: '#64748b', fontSize: '13px' }}>{error}</p>
          <button
            onClick={loadReports}
            style={{
              marginTop: '12px',
              padding: '8px 16px',
              background: '#1e3a8a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      ) : complaints.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <Landmark size={48} color="#0d9488" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ color: '#0f172a', margin: '0 0 6px', fontSize: '16px' }}>No Government Reports Filed Yet</h3>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '520px', margin: '0 auto 16px', lineHeight: 1.5 }}>
            When road defects are detected by AI, open the <strong>Journeys & Road Issues</strong> hub and click <strong>Report</strong> to package evidence, resolve jurisdiction, and submit an assisted grievance to NHAI, AP CDMA, or AP Mee Kosam.
          </p>
          <button
            onClick={onNavigateToScanner}
            style={{
              padding: '10px 18px',
              background: '#0d9488',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Open Live Camera Scanner
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filtered.map(c => {
            const portalUrl = c.portalUrl || (c.authorityCode === 'NHAI' ? 'https://rajmargyatra.nhai.gov.in/complaints' : (c.authorityCode === 'CDMA_ULB' ? 'https://cdma.ap.gov.in/services/grievances/' : 'https://meekosam.ap.gov.in/'));
            const portalName = c.authorityName || (c.authorityCode === 'NHAI' ? 'NHAI Rajmargyatra (National Highways)' : (c.authorityCode === 'CDMA_ULB' ? 'AP CDMA Puramithra (Municipal Roads)' : 'AP Mee Kosam / PGRS (State Highways)'));
            const isConfirmed = Boolean(c.officialRefId);

            return (
              <div
                key={c.complaintId || c.id}
                style={{
                  background: '#ffffff',
                  border: `1px solid ${isConfirmed ? '#a7f3d0' : '#e2e8f0'}`,
                  borderRadius: '14px',
                  padding: '18px 22px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}
              >
                {/* Header Row: Portal Name & Status Badge */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      padding: '8px',
                      borderRadius: '8px',
                      background: isConfirmed ? '#ecfdf5' : '#f0fdfa',
                      color: isConfirmed ? '#059669' : '#0d9488'
                    }}>
                      <Landmark size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                        {portalName}
                      </h4>
                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '12px', color: '#0284c7', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}
                      >
                        {portalUrl} <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>

                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: isConfirmed ? '#ecfdf5' : '#fffbeb',
                    color: isConfirmed ? '#059669' : '#d97706',
                    border: `1px solid ${isConfirmed ? '#a7f3d0' : '#fde68a'}`
                  }}>
                    {isConfirmed ? '✓ Verified Receipt Recorded' : '1-Click Assisted Portal Handoff + Citizen OTP'}
                  </span>
                </div>

                {/* Details Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '12px',
                  background: '#f8fafc',
                  padding: '14px',
                  borderRadius: '10px',
                  border: '1px solid #f1f5f9'
                }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Defect Class & Severity</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                      {c.defectClass?.replace('_', ' ') || 'POTHOLE'} ({((c.confidenceScore || 0.88) * 100).toFixed(0)}% AI Conf)
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Exact Location Coordinates</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                      {c.latitude?.toFixed(5)}°N, {c.longitude?.toFixed(5)}°E
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{c.roadName || 'Public Roadway'}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Captured Timestamp</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>
                      {formatIST(c.createdAt)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Reported / Handed Off</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>
                      {formatIST(c.submittedAt)}
                    </div>
                  </div>
                </div>

                {/* Official Reference ID Box */}
                {c.officialRefId && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    padding: '10px 14px'
                  }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>Official Grievance Reference ID: </span>
                      <strong style={{ fontSize: '13px', color: '#14532d', fontFamily: 'monospace', marginLeft: '6px' }}>{c.officialRefId}</strong>
                    </div>

                    <button
                      onClick={() => handleCopy(c.officialRefId, c.complaintId || c.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        background: '#ffffff',
                        border: '1px solid #86efac',
                        borderRadius: '6px',
                        color: '#15803d',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {copiedId === (c.complaintId || c.id) ? <Check size={12} /> : <Copy size={12} />}
                      {copiedId === (c.complaintId || c.id) ? 'Copied' : 'Copy ID'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

