import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  FileCheck,
  AlertOctagon,
  Building2,
  Phone,
  ExternalLink,
  Download,
  Copy,
  CheckCircle2,
  Sparkles,
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { autoDraftComplaint, simulateSubmission, investigateIssue } from '../api';

export default function GrievanceModal({ issue, onClose, onComplaintSubmitted }) {
  const [loading, setLoading] = useState(true);
  const [investigation, setInvestigation] = useState(null);
  const [complaint, setComplaint] = useState(null);
  const [complainantName, setComplainantName] = useState('Lokesh Kumar');
  const [complainantEmail, setComplainantEmail] = useState('lokesh.citizen@roadguard.local');
  const [complainantPhone, setComplainantPhone] = useState('+91 98765 43210');
  const [submitting, setSubmitting] = useState(false);
  const [simulatedReceipt, setSimulatedReceipt] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Fetch or trigger investigation
        const inv = await investigateIssue(issue.id);
        setInvestigation(inv);

        // Auto-draft complaint
        const draft = await autoDraftComplaint(issue.id, {
          name: complainantName,
          email: complainantEmail,
          phone: complainantPhone,
        });
        setComplaint(draft);
      } catch (err) {
        console.error('Failed to prepare grievance draft:', err);
      } finally {
        setLoading(false);
      }
    }

    if (issue) {
      loadData();
    }
  }, [issue]);

  async function handleSimulateSubmission() {
    if (!complaint) return;
    try {
      setSubmitting(true);
      const receipt = await simulateSubmission(complaint.id);
      setSimulatedReceipt(receipt);

      // Trigger celebratory confetti
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });

      if (onComplaintSubmitted) {
        onComplaintSubmitted(receipt);
      }
    } catch (err) {
      console.error('Simulated submission failed:', err);
      alert('Simulation error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopyReceipt() {
    if (simulatedReceipt && simulatedReceipt.receiptText) {
      navigator.clipboard.writeText(simulatedReceipt.receiptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleDownloadReceipt() {
    if (!simulatedReceipt) return;
    const blob = new Blob([simulatedReceipt.receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt_${simulatedReceipt.simulatedRefId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!issue) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(4, 8, 16, 0.85)',
      backdropFilter: 'blur(10px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '720px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(30, 41, 59, 0.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #00f5a0 0%, #00b4d8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#04121d'
            }}>
              <Shield size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                AI Grievance & Statutory Redressal
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Issue #{issue.id} • {issue.defectClass?.replace('_', ' ')} • {issue.roadName || 'Andhra Pradesh Corridor'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Statutory Regulatory Notice */}
          <div style={{
            background: 'rgba(255, 183, 3, 0.12)',
            border: '1px solid rgba(255, 183, 3, 0.4)',
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <AlertOctagon size={18} color="#ffb703" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#fef08a' }}>
              SIMULATED DEMONSTRATION — NOT SUBMITTED TO ANY GOVERNMENT AUTHORITY
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
              <div className="radar-sweep" style={{
                width: '48px',
                height: '48px',
                border: '3px solid #00f5a0',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                margin: '0 auto 16px'
              }} />
              <p>Investigating public registry tender records & drafting legal citations...</p>
            </div>
          ) : simulatedReceipt ? (
            /* Simulation Receipt View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                background: 'rgba(0, 245, 160, 0.1)',
                border: '1px solid rgba(0, 245, 160, 0.3)',
                borderRadius: '14px',
                padding: '20px',
                textAlign: 'center'
              }}>
                <CheckCircle2 size={44} color="#00f5a0" style={{ margin: '0 auto 8px' }} />
                <h3 style={{ color: '#00f5a0', margin: '0 0 6px', fontSize: '18px' }}>
                  Stage A Demonstration Simulated!
                </h3>
                <p style={{ color: '#cbd5e1', fontSize: '13px', margin: '0 0 12px' }}>
                  A formal grievance record has been simulated and cataloged with regulatory watermarks.
                </p>
                <div style={{
                  display: 'inline-block',
                  background: '#04121d',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '15px',
                  color: '#00f5a0',
                  fontWeight: 700
                }}>
                  {simulatedReceipt.simulatedRefId}
                </div>
              </div>

              {/* Regulatory Disclaimer Banner */}
              <div style={{
                background: 'rgba(255, 183, 3, 0.12)',
                border: '1px solid rgba(255, 183, 3, 0.4)',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}>
                <Info size={20} color="#ffb703" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '12px', color: '#fef08a', lineHeight: 1.5 }}>
                  <strong>STAGE A COMPLIANCE NOTICE:</strong> {simulatedReceipt.warningWatermark}
                  <br />
                  In production Stage B, this automated package connects directly to the Andhra Pradesh Spandana API or NHAI Rajmarg Yatra with authenticated citizen OTP verification.
                </div>
              </div>

              {/* Receipt Preview */}
              <div style={{
                background: '#090d16',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>OFFICIAL ACKNOWLEDGMENT RECEIPT</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleCopyReceipt}
                      style={{
                        background: '#1e293b',
                        color: '#f8fafc',
                        border: 'none',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {copied ? <CheckCircle2 size={12} color="#00f5a0" /> : <Copy size={12} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={handleDownloadReceipt}
                      style={{
                        background: '#1e293b',
                        color: '#f8fafc',
                        border: 'none',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Download size={12} /> Download
                    </button>
                  </div>
                </div>
                <pre style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: '#94a3b8',
                  background: 'transparent',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {simulatedReceipt.receiptText}
                </pre>
              </div>

              {/* Official Portal Link */}
              {simulatedReceipt.grievancePortalUrl && (
                <a
                  href={simulatedReceipt.grievancePortalUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px',
                    background: '#1e293b',
                    color: '#00f5a0',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  <ExternalLink size={16} /> Open Official {simulatedReceipt.authorityDeptCode} Portal
                </a>
              )}
            </div>
          ) : (
            /* Complaint Review and Submit View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Investigation Intelligence Badges */}
              {investigation && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '12px'
                }}>
                  {/* Authority Card */}
                  <div style={{
                    background: 'rgba(30, 41, 59, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '14px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00f5a0', marginBottom: '6px' }}>
                      <Building2 size={16} />
                      <strong style={{ fontSize: '13px' }}>Determined Road Authority</strong>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginBottom: '2px' }}>
                      {investigation.candidateAuthorityName || 'NHAI'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
                      {investigation.authorityReason}
                    </div>
                    {investigation.helpline && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#38bdf8' }}>
                        <Phone size={12} /> Helpline: {investigation.helpline}
                      </div>
                    )}
                  </div>

                  {/* DLP Status Card */}
                  <div style={{
                    background: investigation.dlpApplicable ? 'rgba(0, 245, 160, 0.08)' : 'rgba(30, 41, 59, 0.4)',
                    border: `1px solid ${investigation.dlpApplicable ? 'rgba(0, 245, 160, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: '12px',
                    padding: '14px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: investigation.dlpApplicable ? '#00f5a0' : '#ffb703', marginBottom: '6px' }}>
                      <AlertOctagon size={16} />
                      <strong style={{ fontSize: '13px' }}>
                        {investigation.dlpApplicable ? 'Defect Liability Period (DLP) Active!' : 'Routine Maintenance Obligation'}
                      </strong>
                    </div>
                    <div style={{ fontSize: '12px', color: '#e2e8f0', lineHeight: 1.4 }}>
                      {investigation.evidenceSummary}
                    </div>
                  </div>
                </div>
              )}

              {/* Complainant Contact Fields */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                padding: '14px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                    Complainant Name
                  </label>
                  <input
                    type="text"
                    value={complainantName}
                    onChange={(e) => setComplainantName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: '#f8fafc',
                      fontSize: '12px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                    Email (for Status Notification)
                  </label>
                  <input
                    type="email"
                    value={complainantEmail}
                    onChange={(e) => setComplainantEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: '#f8fafc',
                      fontSize: '12px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={complainantPhone}
                    onChange={(e) => setComplainantPhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: '#f8fafc',
                      fontSize: '12px'
                    }}
                  />
                </div>
              </div>

              {/* Legal Letter Preview */}
              {complaint && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
                    AI-Formulated Grievance Draft (Statutory Grounds & Evidence)
                  </label>
                  <textarea
                    rows={8}
                    value={complaint.bodyText}
                    onChange={(e) => setComplaint({ ...complaint, bodyText: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#090d16',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      color: '#e2e8f0',
                      fontSize: '12px',
                      lineHeight: 1.6,
                      fontFamily: 'monospace',
                      resize: 'vertical'
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.8)'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 18px',
              background: '#1e293b',
              color: '#94a3b8',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {simulatedReceipt ? 'Close Window' : 'Cancel'}
          </button>

          {!simulatedReceipt && (
            <button
              onClick={handleSimulateSubmission}
              disabled={submitting}
              className="btn-primary"
              style={{
                fontSize: '13px',
                padding: '10px 22px'
              }}
            >
              <Sparkles size={16} />
              {submitting ? 'Generating Simulated Filing...' : 'Simulate Stage A Filing'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
