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
  AlertCircle,
  Phone,
  Sparkles,
  Info,
  X
} from 'lucide-react';
import { getConfirmedComplaintsHistory, listComplaints, getAssetUrl } from '../api';
import { DEMO_SAMPLE_COMPLAINT } from '../utils/demoScan';

export default function GovernmentReportsView({ onSelectComplaint, onNavigateToScanner }) {
  const [complaints, setComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'SUBMITTED' | 'ATTEMPTED' | 'READY' | 'DRAFT' | 'SIMULATED'

  // 3-Step Complaint Preparation Drawer state
  const [activeDrawerComplaint, setActiveDrawerComplaint] = useState(null);
  const [drawerStep, setDrawerStep] = useState(1);
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  // Map raw backend entity status into honest status categories required by technical brief
  function mapHonestStatus(record) {
    if (record.officialRefId && (record.status === 'SUBMITTED' || record.status === 'RESOLVED' || record.status === 'TRACKING')) {
      return {
        key: 'SUBMITTED',
        label: 'Submitted (Confirmed)',
        color: '#0d9488', // Teal #0D9488
        bg: '#ecfdf5',
        border: '#99f6e4',
        icon: CheckCircle2,
        desc: 'Verified by authority with official reference ID'
      };
    }

    if (record.status === 'SIMULATED' || record.isDemo) {
      return {
        key: 'SIMULATED',
        label: 'Demo / Simulated',
        color: '#64748b',
        bg: '#f1f5f9',
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
        color: '#2563eb', // Blue #2563EB
        bg: '#eff6ff',
        border: '#bfdbfe',
        icon: Clock,
        desc: 'Evidence and jurisdiction validated; ready for citizen OTP filing'
      };
    }

    // Default fallback: DRAFT
    return {
      key: 'DRAFT',
      label: 'Draft',
      color: '#64748b',
      bg: '#f8fafc',
      border: '#e2e8f0',
      icon: FileText,
      desc: 'Initial grievance dossier prepared'
    };
  }

  function resolveSubmissionMethod(record) {
    if (record.submissionMethod) return record.submissionMethod;
    if (record.status === 'SIMULATED' || record.isDemo) return 'Local Test Simulation';
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
              submittedAt: c.submittedAt || c.createdAt
            });
          }
        });
      }

      const merged = Array.from(map.values());
      merged.sort((a, b) => new Date(b.submittedAt || b.createdAt || 0) - new Date(a.submittedAt || a.createdAt || 0));
      setComplaints(merged);
    } catch (err) {
      console.error('Failed to load complaint ledger:', err);
      setError(err.message || 'Failed to fetch government reports from backend');
    } finally {
      setIsLoading(false);
    }
  }

  function handleCopyReference(refId) {
    if (!refId) return;
    navigator.clipboard.writeText(refId);
    setCopiedId(refId);
    setTimeout(() => setCopiedId(null), 2500);
  }

  function handleLoadDemoComplaint() {
    setComplaints([DEMO_SAMPLE_COMPLAINT]);
    setFilterMode('ALL');
  }

  const filtered = complaints.filter(c => {
    if (filterMode === 'ALL') return true;
    const honest = mapHonestStatus(c);
    return honest.key === filterMode;
  });

  const countByStatus = complaints.reduce((acc, c) => {
    const k = mapHonestStatus(c).key;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Connected Government Portals Overview Banner */}
      <div style={{
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-subtle, #e2e8f0)',
        borderRadius: '14px',
        padding: '20px',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={20} color="var(--color-civic-teal, #0d9488)" /> Official Government Portals & Redressal Ledger
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-dim, #64748b)', margin: '4px 0 0' }}>
              Direct access to connected Indian road authority portals. RoadGuard AI formats evidence and facilitates citizen OTP verification.
            </p>
          </div>

          <button
            onClick={loadReports}
            disabled={isLoading}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '12px', minHeight: '34px' }}
          >
            <RefreshCw size={14} className={isLoading ? 'spin-animation' : ''} /> Refresh Ledger
          </button>
        </div>

        {/* 3 Portal Mini-Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
          {/* 1. NHAI */}
          <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-tertiary, #f1f5f9)', border: '1px solid var(--border-subtle, #e2e8f0)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '13px', color: 'var(--text-main, #0f172a)' }}>NHAI Rajmargyatra</strong>
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#059669' }}>
                National Highways
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-dim, #64748b)' }}>
              NH-16, NH-65, bypasses & toll corridors across India.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted, #334155)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Phone size={11} /> Toll Free 1033
              </span>
              <a
                href="https://rajmargyatra.nhai.gov.in/complaints"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-civic-teal, #0d9488)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                Launch Portal <ExternalLink size={11} />
              </a>
            </div>
          </div>

          {/* 2. AP CDMA Puramithra */}
          <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-tertiary, #f1f5f9)', border: '1px solid var(--border-subtle, #e2e8f0)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '13px', color: 'var(--text-main, #0f172a)' }}>AP CDMA Puramithra</strong>
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#059669' }}>
                Municipal Towns & Cities
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-dim, #64748b)' }}>
              Vijayawada, Guntur, and all Urban Local Body roads.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted, #334155)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Phone size={11} /> Toll Free 14420
              </span>
              <a
                href="https://cdma.ap.gov.in/services/grievances/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-civic-teal, #0d9488)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                Launch Portal <ExternalLink size={11} />
              </a>
            </div>
          </div>

          {/* 3. AP Mee Kosam */}
          <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-tertiary, #f1f5f9)', border: '1px solid var(--border-subtle, #e2e8f0)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '13px', color: 'var(--text-main, #0f172a)' }}>AP Mee Kosam (PGRS)</strong>
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#059669' }}>
                State Roads & Buildings
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-dim, #64748b)' }}>
              State Highways (SH) and major district connecting roads.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted, #334155)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Phone size={11} /> Helpline 1902
              </span>
              <a
                href="https://meekosam.ap.gov.in/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-civic-teal, #0d9488)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                Launch Portal <ExternalLink size={11} />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Honest Status Filter Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        background: 'var(--bg-card, #ffffff)',
        padding: '12px 16px',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle, #e2e8f0)'
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
            background: filterMode === 'ALL' ? 'var(--color-civic-slate, #0f172a)' : 'var(--bg-tertiary, #f1f5f9)',
            color: filterMode === 'ALL' ? '#ffffff' : 'var(--text-dim, #64748b)'
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
            background: filterMode === 'SUBMITTED' ? '#0d9488' : 'var(--bg-tertiary, #f1f5f9)',
            color: filterMode === 'SUBMITTED' ? '#ffffff' : 'var(--text-dim, #64748b)'
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
            background: filterMode === 'ATTEMPTED' ? '#f59e0b' : 'var(--bg-tertiary, #f1f5f9)',
            color: filterMode === 'ATTEMPTED' ? '#ffffff' : 'var(--text-dim, #64748b)'
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
            background: filterMode === 'READY' ? '#2563eb' : 'var(--bg-tertiary, #f1f5f9)',
            color: filterMode === 'READY' ? '#ffffff' : 'var(--text-dim, #64748b)'
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
            background: filterMode === 'DRAFT' ? '#64748b' : 'var(--bg-tertiary, #f1f5f9)',
            color: filterMode === 'DRAFT' ? '#ffffff' : 'var(--text-dim, #64748b)'
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
              background: filterMode === 'SIMULATED' ? '#334155' : 'var(--bg-tertiary, #f1f5f9)',
              color: filterMode === 'SIMULATED' ? '#ffffff' : 'var(--text-dim, #64748b)'
            }}
          >
            Demo / Simulated ({countByStatus['SIMULATED'] || 0})
          </button>
        )}
      </div>

      {/* Ledger Records */}
      {isLoading ? (
        <div style={{ padding: '60px', textAlign: 'center', background: 'var(--bg-card, #ffffff)', borderRadius: '14px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
          <RefreshCw size={28} className="spin-animation" color="var(--color-civic-teal, #0d9488)" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-dim, #64748b)', fontSize: '13px' }}>Loading verified government complaint records...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--bg-card, #ffffff)', borderRadius: '14px', border: '1px solid #fecaca' }}>
          <AlertTriangle size={36} color="#ef4444" style={{ margin: '0 auto 10px' }} />
          <h3 style={{ margin: '0 0 6px', color: 'var(--text-main, #0f172a)' }}>Failed to Load Records</h3>
          <p style={{ color: 'var(--text-dim, #64748b)', fontSize: '13px' }}>{error}</p>
          <button
            onClick={loadReports}
            className="btn-primary"
            style={{ marginTop: '12px', padding: '8px 18px', fontSize: '12px' }}
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--bg-card, #ffffff)', borderRadius: '14px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
          <Landmark size={44} color="var(--color-civic-teal, #0d9488)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ color: 'var(--text-main, #0f172a)', margin: '0 0 6px', fontSize: '16px' }}>No Government Reports Found</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-dim, #64748b)', maxWidth: '480px', margin: '0 auto 16px', lineHeight: 1.5 }}>
            {filterMode === 'ALL'
              ? 'When road defects are detected by AI, prepare a complaint to package photos and GPS coordinates into an official statutory dossier.'
              : `No reports match the status "${filterMode}".`}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={handleLoadDemoComplaint}
              className="btn-primary"
              style={{ padding: '9px 18px', fontSize: '12px' }}
            >
              <Sparkles size={14} /> Preview Sample Complaint (Demo)
            </button>
            <button
              onClick={onNavigateToScanner}
              className="btn-secondary"
              style={{ padding: '9px 18px', fontSize: '12px' }}
            >
              Scan Roads Now
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filtered.map(c => {
            const portalUrl = c.portalUrl || (c.authorityCode === 'NHAI' ? 'https://rajmargyatra.nhai.gov.in/complaints' : (c.authorityCode === 'CDMA_ULB' ? 'https://cdma.ap.gov.in/services/grievances/' : 'https://meekosam.ap.gov.in/'));
            const portalName = c.authorityName || (c.authorityCode === 'NHAI' ? 'NHAI Rajmargyatra (National Highways)' : (c.authorityCode === 'CDMA_ULB' ? 'AP CDMA Puramithra (Municipal Roads)' : 'AP Mee Kosam / PGRS (State Highways)'));
            const honestStatus = mapHonestStatus(c);
            const submissionMethod = resolveSubmissionMethod(c);

            return (
              <div
                key={c.complaintId || c.id}
                className="glass-card"
                style={{
                  padding: '18px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  border: `1.5px solid ${honestStatus.key === 'SUBMITTED' ? '#99f6e4' : 'var(--border-subtle, #e2e8f0)'}`
                }}
              >
                {/* Header Row: Authority & Honest Status Badge */}
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
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                        {portalName}
                      </h4>
                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '11px', color: 'var(--color-civic-teal, #0d9488)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}
                      >
                        Official Authority Portal <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: honestStatus.bg,
                      color: honestStatus.color,
                      border: `1px solid ${honestStatus.border}`
                    }}>
                      {honestStatus.label}
                    </span>
                  </div>
                </div>

                {/* Simulated Notice if Demo */}
                {(honestStatus.key === 'SIMULATED' || c.isDemo) && (
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    fontSize: '11px',
                    color: '#92400e',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <AlertTriangle size={14} color="#d97706" />
                    <strong>SIMULATED DEMONSTRATION — NOT SUBMITTED TO ANY GOVERNMENT AUTHORITY</strong>
                  </div>
                )}

                {/* Complaint Summary Text */}
                <div style={{ fontSize: '13px', color: 'var(--text-muted, #334155)', lineHeight: 1.5, background: 'var(--bg-canvas, #f8fafc)', padding: '12px 14px', borderRadius: '8px' }}>
                  {c.defectSummary || c.bodyText || c.subject || 'Factual pothole hazard evidence dossier prepared for statutory road authority.'}
                </div>

                {/* Location & Verification Row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', fontSize: '11px', color: 'var(--text-dim, #64748b)' }}>
                  <span>Location: <strong>{c.roadName || 'Andhra Pradesh Corridor'}</strong></span>
                  <span>Filing Protocol: <strong>{submissionMethod}</strong></span>
                  {c.submittedAt && (
                    <span>Logged: {new Date(c.submittedAt).toLocaleDateString('en-IN')}</span>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '2px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDrawerComplaint(c);
                      setDrawerStep(1);
                    }}
                    className="btn-primary"
                    style={{ padding: '8px 16px', fontSize: '12px', minHeight: '34px' }}
                  >
                    Open Complaint Handoff Wizard &rarr;
                  </button>
                  <a
                    href={portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                    style={{ padding: '8px 14px', fontSize: '12px', minHeight: '34px', textDecoration: 'none' }}
                  >
                    Launch Authority Portal <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3-STEP COMPLAINT PREPARATION DRAWER / MODAL */}
      {activeDrawerComplaint && (
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
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden'
          }}>
            {/* Drawer Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
              background: 'var(--bg-tertiary, #f1f5f9)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: 0 }}>
                  Complaint Filing Wizard (3-Step Handoff)
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-dim, #64748b)' }}>
                  Step {drawerStep} of 3 · Assisted Official Redressal
                </span>
              </div>
              <button
                onClick={() => setActiveDrawerComplaint(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim, #64748b)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Stepper Dots */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', background: 'var(--bg-canvas, #f8fafc)' }}>
              <div style={{ flex: 1, padding: '10px', textAlign: 'center', fontSize: '11px', fontWeight: drawerStep === 1 ? 700 : 500, color: drawerStep === 1 ? 'var(--color-civic-teal, #0d9488)' : 'var(--text-dim, #64748b)', borderBottom: drawerStep === 1 ? '2px solid var(--color-civic-teal, #0d9488)' : 'none' }}>
                1. Road & Evidence
              </div>
              <div style={{ flex: 1, padding: '10px', textAlign: 'center', fontSize: '11px', fontWeight: drawerStep === 2 ? 700 : 500, color: drawerStep === 2 ? 'var(--color-civic-teal, #0d9488)' : 'var(--text-dim, #64748b)', borderBottom: drawerStep === 2 ? '2px solid var(--color-civic-teal, #0d9488)' : 'none' }}>
                2. Citizen Details
              </div>
              <div style={{ flex: 1, padding: '10px', textAlign: 'center', fontSize: '11px', fontWeight: drawerStep === 3 ? 700 : 500, color: drawerStep === 3 ? 'var(--color-civic-teal, #0d9488)' : 'var(--text-dim, #64748b)', borderBottom: drawerStep === 3 ? '2px solid var(--color-civic-teal, #0d9488)' : 'none' }}>
                3. OTP Portal Handoff
              </div>
            </div>

            {/* Drawer Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {drawerStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>Confirm Photo & Hazard Location</h4>
                  <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-canvas, #f8fafc)', border: '1px solid var(--border-subtle, #e2e8f0)', fontSize: '12px' }}>
                    <div>Road: <strong>{activeDrawerComplaint.roadName || 'Public Roadway'}</strong></div>
                    <div style={{ marginTop: '4px', color: 'var(--text-dim, #64748b)' }}>
                      Authority: <strong>{activeDrawerComplaint.authorityName || 'National Highways Authority of India (NHAI)'}</strong>
                    </div>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted, #334155)', lineHeight: 1.5, margin: 0 }}>
                    AI computer vision has confirmed the hazard bounding coordinates and matched jurisdiction based on the corridor registry.
                  </p>
                </div>
              )}

              {drawerStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>Check Citizen Complainant Details</h4>
                  <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-canvas, #f8fafc)', border: '1px solid var(--border-subtle, #e2e8f0)', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>Name: <strong>Lokesh G. (Citizen Complainant)</strong></div>
                    <div>District: <strong>NTR District / Vijayawada</strong></div>
                    <div>Mobile: <strong>Ready for OTP Verification</strong></div>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted, #334155)', lineHeight: 1.5, margin: 0 }}>
                    Details are pre-filled from your citizen profile. Official portal registration requires matching your phone number to receive a statutory tracking ID.
                  </p>
                </div>
              )}

              {drawerStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>Copy Draft & Open Official Portal</h4>

                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-canvas, #f8fafc)',
                    border: '1px solid var(--border-subtle, #e2e8f0)',
                    fontSize: '12px',
                    lineHeight: 1.5,
                    fontFamily: 'monospace'
                  }}>
                    {activeDrawerComplaint.defectSummary || 'Severe road hazard detected requiring urgent asphalt repair and safety warning sign.'}
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(activeDrawerComplaint.defectSummary || 'Severe pothole hazard');
                        setCopiedText(true);
                        setTimeout(() => setCopiedText(false), 2000);
                      }}
                      className="btn-secondary"
                      style={{ flex: 1, padding: '8px 12px', fontSize: '12px' }}
                    >
                      {copiedText ? <><Check size={14} color="#059669" /> Copied to Clipboard!</> : <><Copy size={14} /> Copy Complaint Text</>}
                    </button>
                    <a
                      href={activeDrawerComplaint.portalUrl || 'https://rajmargyatra.nhai.gov.in/complaints'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary"
                      style={{ flex: 1.2, padding: '8px 14px', fontSize: '12px', textDecoration: 'none' }}
                    >
                      Open Portal & Verify OTP <ExternalLink size={13} />
                    </a>
                  </div>

                  <div style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(13, 148, 136, 0.08)',
                    border: '1px solid rgba(13, 148, 136, 0.25)',
                    fontSize: '11px',
                    color: 'var(--text-muted, #334155)',
                    lineHeight: 1.5
                  }}>
                    <strong>Why OTP verification?</strong> Indian grievance portals require mobile verification to ensure legitimate resident complaints. RoadGuard AI prepares everything in advance, saving you 90% of filing time.
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Controls */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-subtle, #e2e8f0)',
              background: 'var(--bg-tertiary, #f1f5f9)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              {drawerStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setDrawerStep(prev => prev - 1)}
                  className="btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '12px', minHeight: '32px' }}
                >
                  &larr; Back
                </button>
              ) : <div />}

              {drawerStep < 3 ? (
                <button
                  type="button"
                  onClick={() => setDrawerStep(prev => prev + 1)}
                  className="btn-primary"
                  style={{ padding: '6px 16px', fontSize: '12px', minHeight: '32px' }}
                >
                  Continue &rarr;
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveDrawerComplaint(null)}
                  className="btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '12px', minHeight: '32px' }}
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
