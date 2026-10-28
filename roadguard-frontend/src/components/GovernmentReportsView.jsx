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
  ChevronRight,
  Filter,
  Send,
  AlertCircle
} from 'lucide-react';
import { getConfirmedComplaintsHistory, listComplaints, getAssetUrl } from '../api';

export default function GovernmentReportsView({ onSelectComplaint, onNavigateToScanner }) {
  const [complaints, setComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'SUBMITTED' | 'ATTEMPTED' | 'READY' | 'DRAFT' | 'SIMULATED'

  useEffect(() => {
    loadReports();
  }, []);

  // Map raw backend entity status into honest status categories required by technical brief
  function mapHonestStatus(record) {
    if (record.officialRefId && (record.status === 'SUBMITTED' || record.status === 'RESOLVED' || record.status === 'TRACKING')) {
      return {
        key: 'SUBMITTED',
        label: 'Submitted (Confirmed)',
        color: '#14b8a6', // Teal #14B8A6
        bg: '#f0fdfa',
        border: '#99f6e4',
        icon: CheckCircle2,
        desc: 'Verified by authority with official reference ID'
      };
    }

    if (record.status === 'SIMULATED') {
      return {
        key: 'SIMULATED',
        label: 'Demo / Simulated',
        color: '#627d98',
        bg: '#f0f4f8',
        border: '#cbd5e1',
        icon: Landmark,
        desc: 'Simulated grievance payload for testing'
      };
    }

    if (record.status === 'SUBMITTING' || record.status === 'SUBMISSION_IN_PROGRESS' || record.status === 'SUBMISSION_UNVERIFIED' || record.status === 'AWAITING_CITIZEN') {
      return {
        key: 'ATTEMPTED',
        label: 'Submission Attempted',
        color: '#f59e0b', // Amber #F59E0B
        bg: '#fffbeb',
        border: '#fde68a',
        icon: Send,
        desc: 'Handoff initiated; awaiting official receipt confirmation'
      };
    }

    if (record.status === 'FAILED' || record.status === 'SUBMISSION_FAILED') {
      return {
        key: 'FAILED',
        label: 'Submission Failed',
        color: '#ef4444', // Red #EF4444
        bg: '#fef2f2',
        border: '#fecaca',
        icon: AlertCircle,
        desc: 'Portal rejected or connection timed out'
      };
    }

    if (record.status === 'READY_TO_SUBMIT' || record.status === 'EVIDENCE_READY' || record.status === 'COMPLAINT_PREPARED') {
      return {
        key: 'READY',
        label: 'Ready to Submit',
        color: '#38bdf8', // Map blue #38BDF8
        bg: '#f0f9ff',
        border: '#bae6fd',
        icon: Clock,
        desc: 'Evidence and jurisdiction validated; ready for dispatch'
      };
    }

    // Default fallback: DRAFT
    return {
      key: 'DRAFT',
      label: 'Draft',
      color: '#627d98',
      bg: '#f8fafc',
      border: '#e2e8f0',
      icon: FileText,
      desc: 'Initial grievance dossier prepared'
    };
  }

  function resolveSubmissionMethod(record) {
    if (record.submissionMethod) return record.submissionMethod;
    if (record.status === 'SIMULATED') return 'Local Test Simulation';
    if (record.officialRefId) return 'Verified Automated API Gateway';
    return '1-Click Assisted Citizen Handoff + OTP';
  }

  async function loadReports() {
    setIsLoading(true);
    setError(null);
    try {
      const [confirmed, allList] = await Promise.all([
        getConfirmedComplaintsHistory().catch(() => []),
        listComplaints().catch(() => [])
      ]);

      const map = new Map();
      if (Array.isArray(confirmed)) {
        confirmed.forEach(c => {
          const id = c.complaintId || c.id;
          map.set(id, {
            ...c,
            id,
            officialRefId: c.officialRefId,
            status: 'SUBMITTED'
          });
        });
      }

      if (Array.isArray(allList)) {
        allList.forEach(c => {
          if (!map.has(c.id)) {
            map.set(c.id, {
              ...c,
              id: c.id,
              complaintId: c.id,
              status: c.status || 'DRAFT',
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
              confidenceScore: c.roadIssue?.confidenceScore
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
    const honest = mapHonestStatus(c);
    if (filterMode === 'ALL') return true;
    return honest.key === filterMode;
  });

  const countByStatus = complaints.reduce((acc, c) => {
    const k = mapHonestStatus(c).key;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header Card */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '14px',
        padding: '20px',
        boxShadow: '0 2px 10px rgba(16, 42, 67, 0.04)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              display: 'inline-flex',
              padding: '8px',
              borderRadius: '8px',
              background: '#f0fdfa',
              color: '#14b8a6'
            }}>
              <Shield size={22} />
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#102a43', margin: 0 }}>
              Government Reports & Grievance Redressal Audit
            </h2>
          </div>
          <p style={{ fontSize: '13px', color: '#243b53', margin: '6px 0 0', lineHeight: 1.5 }}>
            Honest, verifiable audit ledger of road defect filings across NHAI Rajmargyatra, AP CDMA Puramithra, and AP Mee Kosam. Never claims submission without a verified receipt.
          </p>
        </div>

        <button
          onClick={loadReports}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '9px 16px',
            background: '#f0f4f8',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            color: '#102a43',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} /> Refresh Ledger
        </button>
      </div>

      {/* Honest Status Filter Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        background: '#ffffff',
        padding: '12px 16px',
        borderRadius: '12px',
        border: '1px solid #cbd5e1'
      }}>
        <button
          onClick={() => setFilterMode('ALL')}
          style={{
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            background: filterMode === 'ALL' ? '#102a43' : '#f0f4f8',
            color: filterMode === 'ALL' ? '#ffffff' : '#243b53'
          }}
        >
          All Reports ({complaints.length})
        </button>

        <button
          onClick={() => setFilterMode('SUBMITTED')}
          style={{
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            background: filterMode === 'SUBMITTED' ? '#14b8a6' : '#f0f4f8',
            color: filterMode === 'SUBMITTED' ? '#ffffff' : '#243b53'
          }}
        >
          Submitted (Confirmed) ({countByStatus['SUBMITTED'] || 0})
        </button>

        <button
          onClick={() => setFilterMode('ATTEMPTED')}
          style={{
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            background: filterMode === 'ATTEMPTED' ? '#f59e0b' : '#f0f4f8',
            color: filterMode === 'ATTEMPTED' ? '#ffffff' : '#243b53'
          }}
        >
          Submission Attempted ({countByStatus['ATTEMPTED'] || 0})
        </button>

        <button
          onClick={() => setFilterMode('READY')}
          style={{
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            background: filterMode === 'READY' ? '#38bdf8' : '#f0f4f8',
            color: filterMode === 'READY' ? '#ffffff' : '#243b53'
          }}
        >
          Ready to Submit ({countByStatus['READY'] || 0})
        </button>

        <button
          onClick={() => setFilterMode('DRAFT')}
          style={{
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            background: filterMode === 'DRAFT' ? '#627d98' : '#f0f4f8',
            color: filterMode === 'DRAFT' ? '#ffffff' : '#243b53'
          }}
        >
          Draft ({countByStatus['DRAFT'] || 0})
        </button>

        {(countByStatus['SIMULATED'] || 0) > 0 && (
          <button
            onClick={() => setFilterMode('SIMULATED')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: filterMode === 'SIMULATED' ? '#243b53' : '#f0f4f8',
              color: filterMode === 'SIMULATED' ? '#ffffff' : '#243b53'
            }}
          >
            Demo / Simulated ({countByStatus['SIMULATED'] || 0})
          </button>
        )}
      </div>

      {/* Ledger Records */}
      {isLoading ? (
        <div style={{ padding: '60px', textAlign: 'center', background: '#ffffff', borderRadius: '14px', border: '1px solid #cbd5e1' }}>
          <RefreshCw size={32} className="spin" color="#14b8a6" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: '#243b53', fontSize: '14px' }}>Loading verified government complaint records...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', background: '#ffffff', borderRadius: '14px', border: '1px solid #fecaca' }}>
          <AlertTriangle size={36} color="#ef4444" style={{ margin: '0 auto 10px' }} />
          <h3 style={{ margin: '0 0 6px', color: '#102a43' }}>Failed to Load Records</h3>
          <p style={{ color: '#243b53', fontSize: '13px' }}>{error}</p>
          <button
            onClick={loadReports}
            className="btn-primary"
            style={{ marginTop: '12px', padding: '8px 18px', fontSize: '12px' }}
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', background: '#ffffff', borderRadius: '14px', border: '1px solid #cbd5e1' }}>
          <Landmark size={48} color="#14b8a6" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ color: '#102a43', margin: '0 0 6px', fontSize: '16px' }}>No Government Reports Found</h3>
          <p style={{ fontSize: '13px', color: '#627d98', maxWidth: '520px', margin: '0 auto 16px', lineHeight: 1.5 }}>
            {filterMode === 'ALL' 
              ? 'When road defects are detected by AI, open Road Monitoring or Journey Reports to package evidence and draft an official grievance.'
              : `No reports match the status "${filterMode}".`}
          </p>
          <button
            onClick={onNavigateToScanner}
            className="btn-primary"
            style={{ padding: '10px 18px', fontSize: '13px' }}
          >
            Open Road Monitoring
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filtered.map(c => {
            const portalUrl = c.portalUrl || (c.authorityCode === 'NHAI' ? 'https://rajmargyatra.nhai.gov.in/complaints' : (c.authorityCode === 'CDMA_ULB' ? 'https://cdma.ap.gov.in/services/grievances/' : 'https://meekosam.ap.gov.in/'));
            const portalName = c.authorityName || (c.authorityCode === 'NHAI' ? 'NHAI Rajmargyatra (National Highways)' : (c.authorityCode === 'CDMA_ULB' ? 'AP CDMA Puramithra (Municipal Roads)' : 'AP Mee Kosam / PGRS (State Highways)'));
            const honestStatus = mapHonestStatus(c);
            const submissionMethod = resolveSubmissionMethod(c);
            const StatusIcon = honestStatus.icon;

            return (
              <div
                key={c.complaintId || c.id}
                style={{
                  background: '#ffffff',
                  border: `1.5px solid ${honestStatus.key === 'SUBMITTED' ? '#99f6e4' : '#cbd5e1'}`,
                  borderRadius: '14px',
                  padding: '18px 22px',
                  boxShadow: '0 2px 8px rgba(16, 42, 67, 0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}
              >
                {/* Header Row: Authority/Portal & Honest Status Badge */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      padding: '8px',
                      borderRadius: '8px',
                      background: honestStatus.bg,
                      color: honestStatus.color
                    }}>
                      <Landmark size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#102a43' }}>
                        {portalName}
                      </h4>
                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '12px', color: '#38bdf8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '2px', fontWeight: 600 }}
                      >
                        {portalUrl} <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>

                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: honestStatus.bg,
                    color: honestStatus.color,
                    border: `1px solid ${honestStatus.border}`
                  }}>
                    <StatusIcon size={14} />
                    {honestStatus.label}
                  </span>
                </div>

                {/* Details Grid: Submission Method, Coordinates, Timestamp, Defect */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '12px',
                  background: '#f8fafc',
                  padding: '14px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#627d98', textTransform: 'uppercase', fontWeight: 600 }}>Submission Method</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#102a43', marginTop: '2px' }}>
                      {submissionMethod}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', color: '#627d98', textTransform: 'uppercase', fontWeight: 600 }}>Defect Class & Confidence</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#102a43', marginTop: '2px' }}>
                      {c.defectClass?.replace('_', ' ') || 'POTHOLE'} ({((c.confidenceScore || 0.88) * 100).toFixed(0)}%)
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', color: '#627d98', textTransform: 'uppercase', fontWeight: 600 }}>Coordinates & Road</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#102a43', marginTop: '2px' }}>
                      {c.latitude != null ? `${c.latitude.toFixed(5)}°N, ${c.longitude.toFixed(5)}°E` : 'Approximate / GPS Offline'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#243b53' }}>{c.roadName || 'Public Road'}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', color: '#627d98', textTransform: 'uppercase', fontWeight: 600 }}>Recorded Time (IST)</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#243b53', marginTop: '2px' }}>
                      {formatIST(c.submittedAt || c.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Subject & Summary */}
                {c.subject && (
                  <div style={{ fontSize: '12px', color: '#243b53', lineHeight: 1.4 }}>
                    <strong style={{ color: '#102a43' }}>Report Subject:</strong> {c.subject}
                  </div>
                )}

                {/* Returned Receipt / Official Reference ID */}
                {c.officialRefId ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f0fdfa',
                    border: '1px solid #99f6e4',
                    borderRadius: '8px',
                    padding: '10px 14px'
                  }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#115e59', fontWeight: 600 }}>Official Grievance Reference / Receipt: </span>
                      <strong style={{ fontSize: '13px', color: '#0f766e', fontFamily: 'monospace', marginLeft: '6px' }}>{c.officialRefId}</strong>
                    </div>

                    <button
                      onClick={() => handleCopy(c.officialRefId, c.complaintId || c.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        background: '#ffffff',
                        border: '1px solid #99f6e4',
                        borderRadius: '6px',
                        color: '#0f766e',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {copiedId === (c.complaintId || c.id) ? <Check size={12} /> : <Copy size={12} />}
                      {copiedId === (c.complaintId || c.id) ? 'Copied' : 'Copy ID'}
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: '#627d98', fontStyle: 'italic' }}>
                    Status Note: {honestStatus.desc}. No official receipt returned yet.
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
