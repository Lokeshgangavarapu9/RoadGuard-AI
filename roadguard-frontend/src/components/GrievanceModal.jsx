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
  Info,
  Send,
  Check
} from 'lucide-react';
import {
  autoDraftComplaint,
  initiatePortalHandoff,
  recordOfficialReceipt,
  investigateIssue
} from '../api';

export default function GrievanceModal({ issue, onClose, onComplaintSubmitted }) {
  const [loading, setLoading] = useState(true);
  const [investigation, setInvestigation] = useState(null);
  const [complaint, setComplaint] = useState(null);
  const [complainantName, setComplainantName] = useState('Citizen Reporter');
  const [complainantEmail, setComplainantEmail] = useState('');
  const [complainantPhone, setComplainantPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [handoffActive, setHandoffActive] = useState(false);
  const [officialRefInput, setOfficialRefInput] = useState('');
  const [submissionNotesInput, setSubmissionNotesInput] = useState('');
  const [verifiedSubmission, setVerifiedSubmission] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedDossier, setCopiedDossier] = useState(false);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setErrorMsg('');
        const inv = await investigateIssue(issue.id);
        setInvestigation(inv);

        const draft = await autoDraftComplaint(issue.id, {
          name: complainantName,
          email: complainantEmail,
          phone: complainantPhone,
        });
        setComplaint(draft);

        if (draft.status === 'AWAITING_USER_ACTION') {
          setHandoffActive(true);
        } else if (draft.status === 'SUBMITTED' && draft.officialReferenceId) {
          setVerifiedSubmission(draft);
        }
      } catch (err) {
        console.error('Failed to prepare grievance draft:', err);
        setErrorMsg(err.message || 'Failed to prepare grievance draft.');
      } finally {
        setLoading(false);
      }
    }

    if (issue) {
      loadData();
    }
  }, [issue]);

  // Step 1: Citizen initiates handoff to official government portal
  async function handleInitiateHandoff() {
    if (!complaint) return;
    try {
      setSubmitting(true);
      setErrorMsg('');

      // Copy dossier to clipboard for easy pasting into portal form
      if (complaint.bodyText) {
        try {
          await navigator.clipboard.writeText(complaint.bodyText);
          setCopiedDossier(true);
          setTimeout(() => setCopiedDossier(false), 4000);
        } catch {
          // Ignore clipboard permission issues
        }
      }

      const updated = await initiatePortalHandoff(complaint.id);
      setComplaint(updated);
      setHandoffActive(true);

      // Open official portal in new tab
      const targetUrl = updated.officialPortalUrl || complaint.officialPortalUrl;
      if (targetUrl) {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('Portal handoff failed:', err);
      setErrorMsg('Failed to initiate portal handoff: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Step 2: Citizen records verified official receipt from portal
  async function handleRecordReceipt() {
    if (!complaint) return;
    const refId = officialRefInput.trim();
    if (!refId) {
      setErrorMsg('Please enter the official acknowledgment / reference ID returned by the government portal.');
      return;
    }

    if (/^(SIM-|STM-AP-)/i.test(refId)) {
      setErrorMsg('Fabricated or simulated reference numbers are strictly rejected. Enter genuine portal acknowledgment.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      const submitted = await recordOfficialReceipt(complaint.id, {
        officialRefId: refId,
        notes: submissionNotesInput.trim() || undefined,
      });
      setVerifiedSubmission(submitted);
      setComplaint(submitted);

      if (onComplaintSubmitted) {
        onComplaintSubmitted(submitted);
      }
    } catch (err) {
      console.error('Failed to record official receipt:', err);
      setErrorMsg('Failed to record receipt: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopyReceipt() {
    if (verifiedSubmission) {
      const summary = `ROADGUARD AI — VERIFIED CIVIC COMPLAINT\nReference ID: ${verifiedSubmission.officialReferenceId}\nAuthority: ${verifiedSubmission.authorityName || 'Concerned Road Authority'}\nPortal: ${verifiedSubmission.officialPortalUrl || 'Official Portal'}\nDate: ${verifiedSubmission.submittedAt || new Date().toISOString()}\nStatus: SUBMITTED & VERIFIED`;
      navigator.clipboard.writeText(summary);
      setCopiedReceipt(true);
      setTimeout(() => setCopiedReceipt(false), 2000);
    }
  }

  function handleDownloadReceipt() {
    if (!verifiedSubmission) return;
    const text = `========================================\nROADGUARD AI CIVIC COMPLAINT RECEIPT\n========================================\nOfficial Reference ID : ${verifiedSubmission.officialReferenceId}\nStatus                : VERIFIED (SUBMITTED)\nAuthority             : ${verifiedSubmission.authorityName || 'Concerned Authority'}\nPortal URL            : ${verifiedSubmission.officialPortalUrl || 'N/A'}\nSubmission Timestamp  : ${verifiedSubmission.submittedAt || new Date().toISOString()}\nComplainant Name      : ${verifiedSubmission.complainantName || 'Citizen'}\nIssue ID              : #${issue.id}\nDefect Category       : ${issue.defectClass}\nLocation (GPS)        : ${issue.latitude?.toFixed(5)}, ${issue.longitude?.toFixed(5)}\nIdempotency Key       : ${verifiedSubmission.idempotencyKey || 'N/A'}\n========================================\n\nCOMPLAINT DOSSIER SUBMITTED:\n\n${verifiedSubmission.bodyText || ''}\n`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt_${verifiedSubmission.officialReferenceId}.txt`;
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
        maxWidth: '740px',
        maxHeight: '92vh',
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
                Civic Complaint & Authority Handoff
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Issue #{issue.id} • {issue.defectClass?.replace('_', ' ')} • {issue.roadName || 'Verified Corridor'}
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
          {errorMsg && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              marginBottom: '16px',
              color: '#fca5a5',
              fontSize: '13px'
            }}>
              <AlertOctagon size={18} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

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
              <p>Auditing road jurisdiction & formulating statutory grievance dossier...</p>
            </div>
          ) : verifiedSubmission ? (
            /* Verified Official Receipt View */
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
                  Official Grievance Recorded & Verified
                </h3>
                <p style={{ color: '#cbd5e1', fontSize: '13px', margin: '0 0 12px' }}>
                  The official reference ID returned by the authority portal has been verified and permanently bound to this defect record.
                </p>
                <div style={{
                  display: 'inline-block',
                  background: '#04121d',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '16px',
                  color: '#00f5a0',
                  fontWeight: 700,
                  border: '1px solid rgba(0, 245, 160, 0.3)'
                }}>
                  {verifiedSubmission.officialReferenceId}
                </div>
              </div>

              {/* Verified Authority Details */}
              <div style={{
                background: '#090d16',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>OFFICIAL FILING SUMMARY</span>
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
                      {copiedReceipt ? <Check size={12} color="#00f5a0" /> : <Copy size={12} />}
                      {copiedReceipt ? 'Copied' : 'Copy'}
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
                <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.6 }}>
                  <div><strong>Authority:</strong> {verifiedSubmission.authorityName || 'Assigned Authority'}</div>
                  <div><strong>Portal:</strong> {verifiedSubmission.officialPortalUrl || 'Government Portal'}</div>
                  <div><strong>Timestamp:</strong> {verifiedSubmission.submittedAt || new Date().toLocaleString()}</div>
                  {verifiedSubmission.submissionNotes && (
                    <div><strong>Citizen Notes:</strong> {verifiedSubmission.submissionNotes}</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Complaint Review and 2-Step Handoff View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Authority & Jurisdiction Card */}
              {investigation && (
                <div style={{
                  background: 'rgba(30, 41, 59, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00f5a0', marginBottom: '6px' }}>
                    <Building2 size={16} />
                    <strong style={{ fontSize: '13px' }}>Responsible Road Authority</strong>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', marginBottom: '2px' }}>
                    {investigation.candidateAuthorityName || 'Road Authority'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
                    {investigation.authorityReason}
                  </div>
                  {investigation.helpline && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#38bdf8' }}>
                      <Phone size={12} /> Helpline: {investigation.helpline}
                    </div>
                  )}
                </div>
              )}

              {/* Truthful Portal Integration Explanation Banner */}
              <div style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}>
                <Info size={18} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '12px', color: '#bae6fd', lineHeight: 1.5 }}>
                  <strong>Official Portal Security Protocol:</strong> Government road grievance portals (NHAI Rajmargyatra, AP CDMA Puramithra, AP R&B) mandate Citizen Mobile SMS OTP verification and do not support anonymous or background third-party API submission.
                  <br />
                  RoadGuard AI prepares a structured, statutory evidence dossier and assists your filing in two simple steps.
                </div>
              </div>

              {/* Step 1: Portal Handoff & Dossier Copy */}
              <div style={{
                background: handoffActive ? 'rgba(15, 23, 42, 0.8)' : 'rgba(30, 41, 59, 0.3)',
                border: `1px solid ${handoffActive ? 'rgba(0, 245, 160, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                borderRadius: '12px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: handoffActive ? '#00f5a0' : '#334155',
                      color: handoffActive ? '#04121d' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700
                    }}>1</div>
                    <strong style={{ fontSize: '13px', color: '#f8fafc' }}>
                      Step 1: Open Official Portal with Prepared Dossier
                    </strong>
                  </div>
                  {copiedDossier && (
                    <span style={{ fontSize: '11px', color: '#00f5a0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={12} /> Dossier Copied to Clipboard
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 12px' }}>
                  Clicking below copies the factual complaint (GPS coordinates, defect category, statutory grounds) to your clipboard and opens the official portal in a new tab. Complete the citizen SMS OTP authentication on the official portal.
                </p>

                <button
                  onClick={handleInitiateHandoff}
                  disabled={submitting}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#f8fafc',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <ExternalLink size={16} />
                  {handoffActive ? 'Re-open Official Portal & Re-copy Dossier' : 'Open Official Portal & Copy Dossier'}
                </button>
              </div>

              {/* Step 2: Record Verified Portal Reference ID */}
              <div style={{
                background: handoffActive ? 'rgba(30, 41, 59, 0.4)' : 'rgba(15, 23, 42, 0.4)',
                border: `1px solid ${handoffActive ? 'rgba(0, 245, 160, 0.4)' : 'rgba(255, 255, 255, 0.06)'}`,
                borderRadius: '12px',
                padding: '16px',
                opacity: handoffActive ? 1 : 0.65
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: handoffActive ? '#00f5a0' : '#334155',
                    color: handoffActive ? '#04121d' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700
                  }}>2</div>
                  <strong style={{ fontSize: '13px', color: '#f8fafc' }}>
                    Step 2: Enter Official Reference ID from Portal Receipt
                  </strong>
                </div>

                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 12px' }}>
                  After submitting your grievance on the official portal, paste the genuine reference ID (e.g., NHAI-2026-XXXXX or CDMA grievance number) below to record and track it.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="e.g. NHAI-2026-98432 or AP-CDMA-84920"
                    value={officialRefInput}
                    disabled={!handoffActive || submitting}
                    onChange={(e) => setOfficialRefInput(e.target.value)}
                    style={{
                      padding: '10px 14px',
                      background: '#090d16',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '13px',
                      fontFamily: 'monospace'
                    }}
                  />
                  <button
                    onClick={handleRecordReceipt}
                    disabled={!handoffActive || submitting || !officialRefInput.trim()}
                    className="btn-primary"
                    style={{
                      padding: '10px 20px',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Send size={15} />
                    {submitting ? 'Verifying...' : 'Record & Verify'}
                  </button>
                </div>
              </div>

              {/* Dossier Preview */}
              {complaint && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
                    AI-Formulated Grievance Dossier (Statutory Grounds & Evidence)
                  </label>
                  <textarea
                    rows={6}
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
            {verifiedSubmission ? 'Close Window' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
