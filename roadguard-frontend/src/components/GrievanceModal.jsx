import React, { useState, useEffect, useRef } from 'react';
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
  Check,
  Cpu,
  RefreshCw,
  KeyRound,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Clock,
  Terminal,
  MapPin,
  Navigation
} from 'lucide-react';
import {
  autoDraftComplaint,
  approveComplaint,
  dispatchAutomationJob,
  getAutomationJob,
  getFilingAuditTrail,
  supplyAutomationOtp,
  confirmAutomationCaptcha,
  getWorkerStatus,
  recordOfficialReceipt,
  investigateIssue,
  updateIssueManualLocation
} from '../api';

export default function GrievanceModal({ issue, onClose, onComplaintSubmitted }) {
  const [loading, setLoading] = useState(true);
  const [currentIssue, setCurrentIssue] = useState(issue);
  const [manualRoadName, setManualRoadName] = useState(issue?.roadName || '');
  const [manualCity, setManualCity] = useState(issue?.cityOrTown || '');
  const [manualDistrict, setManualDistrict] = useState(issue?.district || '');
  const [manualState, setManualState] = useState(issue?.state || 'Andhra Pradesh');
  const [manualPincode, setManualPincode] = useState(issue?.pincode || '');
  const [manualLat, setManualLat] = useState(issue?.latitude != null ? String(issue.latitude) : '');
  const [manualLon, setManualLon] = useState(issue?.longitude != null ? String(issue.longitude) : '');
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState('');
  const [investigation, setInvestigation] = useState(null);
  const [complaint, setComplaint] = useState(null);
  const [complainantName, setComplainantName] = useState('Citizen Reporter');
  const [complainantEmail, setComplainantEmail] = useState('');
  const [complainantPhone, setComplainantPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Automation Worker & Filing state
  const [filingMode, setFilingMode] = useState('MOCK'); // 'MOCK' or 'LIVE'
  const [workerStatus, setWorkerStatus] = useState({ connected: false, activeWorkerCount: 0 });
  const [activeJob, setActiveJob] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [submittingOtp, setSubmittingOtp] = useState(false);
  const [confirmingCaptcha, setConfirmingCaptcha] = useState(false);
  const [officialRefInput, setOfficialRefInput] = useState('');
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [copiedDossier, setCopiedDossier] = useState(false);

  // Poll intervals
  const pollingRef = useRef(null);

  // Initial load
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setErrorMsg('');

        // 1. Check worker connection
        const wStatus = await getWorkerStatus();
        setWorkerStatus(wStatus);

        // 2. Investigate issue
        const inv = await investigateIssue(issue.id);
        setInvestigation(inv);

        // 3. Draft factual complaint dossier
        const draft = await autoDraftComplaint(issue.id, {
          name: complainantName,
          email: complainantEmail,
          phone: complainantPhone,
        });
        setComplaint(draft);

        // 4. Check if an active automation job already exists
        const job = await getAutomationJob(draft.id);
        if (job) {
          setActiveJob(job);
          const logs = await getFilingAuditTrail(draft.id);
          setAuditLogs(logs);
        }
      } catch (err) {
        console.error('Failed to initialize grievance state:', err);
        setErrorMsg(err.message || 'Failed to initialize grievance filing.');
      } finally {
        setLoading(false);
      }
    }

    if (issue) {
      loadData();
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [issue]);

  // Polling loop for active automation job & worker status
  useEffect(() => {
    if (!complaint) return;

    async function pollJob() {
      try {
        // Poll worker heartbeat
        const wStatus = await getWorkerStatus();
        setWorkerStatus(wStatus);

        // Poll current automation job
        const job = await getAutomationJob(complaint.id);
        if (job) {
          setActiveJob(job);

          // If job completed, update complaint
          if (job.status === 'COMPLETED' && job.officialReferenceNumber) {
            setComplaint(prev => ({
              ...prev,
              status: 'SUBMITTED',
              officialReferenceId: job.officialReferenceNumber,
              submissionNotes: job.officialConfirmationText
            }));
            if (onComplaintSubmitted) {
              onComplaintSubmitted({
                ...complaint,
                status: 'SUBMITTED',
                officialReferenceId: job.officialReferenceNumber
              });
            }
          }

          // Fetch latest audit logs
          const logs = await getFilingAuditTrail(complaint.id);
          setAuditLogs(logs);
        }
      } catch (err) {
        // Soft error during polling
      }
    }

    pollingRef.current = setInterval(pollJob, 2500);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [complaint]);

  // Action: Citizen Saves Manual Location for Issue Detected without GPS
  async function handleSaveManualLocation() {
    if (!manualRoadName.trim()) {
      setErrorMsg('Please enter a road or highway name.');
      return;
    }
    if (!manualDistrict.trim()) {
      setErrorMsg('Please enter a district for administrative routing.');
      return;
    }
    try {
      setSavingLocation(true);
      setErrorMsg('');
      setLocationSuccessMsg('');

      const latVal = manualLat.trim() ? parseFloat(manualLat) : null;
      const lonVal = manualLon.trim() ? parseFloat(manualLon) : null;

      const payload = {
        roadName: manualRoadName.trim(),
        cityOrTown: manualCity.trim() || undefined,
        district: manualDistrict.trim(),
        state: manualState.trim() || undefined,
        pincode: manualPincode.trim() || undefined,
        latitude: latVal !== null && !isNaN(latVal) ? latVal : undefined,
        longitude: lonVal !== null && !isNaN(lonVal) ? lonVal : undefined
      };

      const updated = await updateIssueManualLocation(currentIssue.id, payload);
      setCurrentIssue(updated);

      // Re-run investigation and re-draft complaint dossier
      const inv = await investigateIssue(updated.id);
      setInvestigation(inv);

      const draft = await autoDraftComplaint(updated.id, {
        name: complainantName,
        email: complainantEmail,
        phone: complainantPhone,
      });
      setComplaint(draft);
      setLocationSuccessMsg('Location saved successfully! Complaint dossier updated for ' + (inv.candidateAuthorityName || 'Authority'));
    } catch (err) {
      console.error('Failed to update manual location:', err);
      setErrorMsg('Failed to save location: ' + err.message);
    } finally {
      setSavingLocation(false);
    }
  }

  // Action: Citizen Approves & Dispatches Filing Job to Automation Worker
  async function handleApproveAndSubmit() {
    if (!complaint) return;
    if (currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED') {
      setErrorMsg('Cannot submit to government portal: Road defect location details are required. Please fill in and save the location form above.');
      return;
    }
    try {
      setSubmitting(true);
      setErrorMsg('');

      // 1. Citizen review approval
      const approved = await approveComplaint(complaint.id);
      setComplaint(approved);

      // 2. Determine target portal
      const targetPortalId = filingMode === 'MOCK'
        ? 'MOCK_PORTAL'
        : (investigation?.candidateDeptCode === 'NHAI' ? 'RAJMARGYATRA_NHAI' : 'AP_CDMA');

      // 3. Dispatch filing job to local Playwright automation worker
      const job = await dispatchAutomationJob(complaint.id, {
        mode: filingMode,
        portalId: targetPortalId
      });
      setActiveJob(job);

      const logs = await getFilingAuditTrail(complaint.id);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Failed to dispatch automation job:', err);
      setErrorMsg('Failed to dispatch automation filing: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Action: Citizen Submits Mobile OTP to Automation Worker
  async function handleSupplyOtp() {
    if (!activeJob || !otpInput.trim()) return;
    try {
      setSubmittingOtp(true);
      setErrorMsg('');
      const updatedJob = await supplyAutomationOtp(activeJob.id, otpInput.trim());
      setActiveJob(updatedJob);
      setOtpInput('');
    } catch (err) {
      console.error('Failed to submit OTP:', err);
      setErrorMsg('Failed to supply OTP: ' + err.message);
    } finally {
      setSubmittingOtp(false);
    }
  }

  // Action: Citizen Confirms Browser CAPTCHA Solved
  async function handleConfirmCaptcha() {
    if (!activeJob) return;
    try {
      setConfirmingCaptcha(true);
      setErrorMsg('');
      const updatedJob = await confirmAutomationCaptcha(activeJob.id);
      setActiveJob(updatedJob);
    } catch (err) {
      console.error('Failed to confirm CAPTCHA:', err);
      setErrorMsg('Failed to confirm CAPTCHA: ' + err.message);
    } finally {
      setConfirmingCaptcha(false);
    }
  }

  // Action: Manual fallback receipt recording
  async function handleManualRecordReceipt() {
    if (!complaint) return;
    const refId = officialRefInput.trim();
    if (!refId) {
      setErrorMsg('Please enter the official acknowledgment ID from the government portal.');
      return;
    }
    try {
      setSubmitting(true);
      setErrorMsg('');
      const submitted = await recordOfficialReceipt(complaint.id, {
        officialRefId: refId,
        notes: 'Citizen verified receipt entered manually.'
      });
      setComplaint(submitted);
      if (onComplaintSubmitted) onComplaintSubmitted(submitted);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopyReceipt() {
    if (complaint && complaint.officialReferenceId) {
      const summary = `ROADGUARD AI — OFFICIAL CIVIC GRIEVANCE\nReference ID: ${complaint.officialReferenceId}\nPortal: ${activeJob?.portalId || 'Government Grievance Redressal'}\nTimestamp: ${new Date().toISOString()}\nStatus: OFFICIALLY SUBMITTED & VERIFIED`;
      navigator.clipboard.writeText(summary);
      setCopiedReceipt(true);
      setTimeout(() => setCopiedReceipt(false), 2000);
    }
  }

  function handleDownloadReceipt() {
    if (!complaint || !complaint.officialReferenceId) return;
    const coordsStr = currentIssue?.latitude != null && currentIssue?.longitude != null
      ? `${currentIssue.latitude.toFixed(5)}°N, ${currentIssue.longitude.toFixed(5)}°E`
      : 'Manual Location Reported (GPS Telemetry Absent)';
    const text = `========================================================\nROADGUARD AI — OFFICIAL CIVIC GRIEVANCE RECEIPT\n========================================================\nOfficial Reference ID : ${complaint.officialReferenceId}\nStatus                : SUBMITTED (VERIFIED)\nPortal                : ${activeJob?.portalId || 'Official Government Portal'}\nSubmission Timestamp  : ${complaint.submittedAt || new Date().toISOString()}\nCitizen Name          : ${complaint.complainantName || 'Citizen'}\nDefect Classification : ${currentIssue?.defectClass}\nCoordinates           : ${coordsStr}\nLocation Source       : ${currentIssue?.locationSource || 'GPS_TELEMETRY'}\nRoad Corridor         : ${currentIssue?.roadName || 'Civic Corridor'}\nDistrict / State      : ${currentIssue?.district || 'General'}, ${currentIssue?.state || 'AP'}\n========================================================\n\nSUBMITTED GRIEVANCE DOSSIER:\n\n${complaint.bodyText || ''}\n`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt_${complaint.officialReferenceId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Calculate State Machine Step Status
  const isEvidenceReady = !!issue;
  const isPortalSelected = !!investigation?.candidateDeptCode;
  const isAuthProgress = activeJob && ['DISPATCHED', 'RUNNING', 'AWAITING_OTP', 'AWAITING_CAPTCHA', 'SUBMITTED', 'COMPLETED'].includes(activeJob.status);
  const isFormFilled = activeJob && auditLogs.some(l => l.action === 'FORM_FILLED');
  const isEvidenceUploaded = activeJob && auditLogs.some(l => l.action === 'UPLOAD_EVIDENCE');
  const isCitizenApproved = complaint?.status === 'READY_TO_SUBMIT' || activeJob || complaint?.status === 'SUBMITTED';
  const isSubmitted = complaint?.status === 'SUBMITTED' || activeJob?.status === 'COMPLETED';
  const isReferenceExtracted = !!complaint?.officialReferenceId || !!activeJob?.officialReferenceNumber;

  if (!issue) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(4, 8, 16, 0.88)',
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
        maxWidth: '820px',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
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
              width: '42px',
              height: '42px',
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
                Government Grievance Filing Automation
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Issue #{issue.id} • {issue.defectClass?.replace('_', ' ')} • {issue.roadName || 'Identified Corridor'}
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
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errorMsg && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              color: '#fca5a5',
              fontSize: '13px'
            }}>
              <AlertOctagon size={18} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Local Automation Worker Status Banner */}
          <div style={{
            background: workerStatus.connected ? 'rgba(0, 245, 160, 0.08)' : 'rgba(234, 179, 8, 0.08)',
            border: `1px solid ${workerStatus.connected ? 'rgba(0, 245, 160, 0.25)' : 'rgba(234, 179, 8, 0.25)'}`,
            borderRadius: '10px',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Cpu size={18} color={workerStatus.connected ? '#00f5a0' : '#eab308'} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: workerStatus.connected ? '#00f5a0' : '#eab308' }}>
                  {workerStatus.connected
                    ? `Local Playwright Worker Online (${workerStatus.activeWorkerCount} active agent)`
                    : 'Local Automation Worker Not Connected'}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {workerStatus.connected
                    ? 'Automated Chromium browser is ready to perform authorized portal filing and handle human handoffs.'
                    : 'To enable full Playwright browser automation, run "npm start" in the roadguard-worker/ directory.'}
                </div>
              </div>
            </div>

            {/* Mode Selector */}
            <div style={{ display: 'flex', gap: '6px', background: '#090d16', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                type="button"
                onClick={() => setFilingMode('MOCK')}
                style={{
                  background: filingMode === 'MOCK' ? '#0284c7' : 'transparent',
                  color: filingMode === 'MOCK' ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Mock Portal (Training)
              </button>
              <button
                type="button"
                onClick={() => setFilingMode('LIVE')}
                style={{
                  background: filingMode === 'LIVE' ? '#0284c7' : 'transparent',
                  color: filingMode === 'LIVE' ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Live Government Portal
              </button>
            </div>
          </div>

          {/* Real-time State Machine Progress Tracker */}
          <div style={{
            background: '#090d16',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '16px'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '12px' }}>
              Statutory Grievance State Machine
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '8px'
            }}>
              {[
                { label: 'Evidence Prepared', done: isEvidenceReady },
                { label: 'Portal Selected', done: isPortalSelected },
                { label: 'Citizen Approval', done: isCitizenApproved },
                { label: 'Authentication', done: isAuthProgress },
                { label: 'Complaint Form', done: isFormFilled },
                { label: 'Evidence Upload', done: isEvidenceUploaded },
                { label: 'Govt Submission', done: isSubmitted },
                { label: 'Official Receipt', done: isReferenceExtracted },
                { label: 'Status Tracking', done: isReferenceExtracted }
              ].map((step, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: step.done ? 'rgba(0, 245, 160, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                    color: step.done ? '#00f5a0' : '#64748b',
                    fontWeight: step.done ? 600 : 400,
                    border: `1px solid ${step.done ? 'rgba(0, 245, 160, 0.25)' : 'transparent'}`
                  }}
                >
                  <CheckCircle2 size={13} color={step.done ? '#00f5a0' : '#475569'} />
                  <span>{step.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ACTIVE HUMAN-IN-THE-LOOP DIALOGS */}
          {activeJob?.status === 'AWAITING_OTP' && (
            <div style={{
              background: 'rgba(234, 179, 8, 0.15)',
              border: '1px solid #eab308',
              borderRadius: '12px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#facc15' }}>
                <KeyRound size={20} />
                <strong style={{ fontSize: '14px' }}>Government OTP Required</strong>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#fef08a', lineHeight: 1.5 }}>
                {activeJob.otpPrompt || 'Government OTP required. Enter the OTP received on your registered mobile.'}
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="Enter 6-digit OTP (e.g. 582914)"
                  style={{
                    padding: '10px 14px',
                    background: '#090d16',
                    border: '1px solid #eab308',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '14px',
                    letterSpacing: '2px',
                    fontFamily: 'monospace',
                    width: '220px'
                  }}
                />
                <button
                  type="button"
                  onClick={handleSupplyOtp}
                  disabled={submittingOtp || !otpInput.trim()}
                  style={{
                    padding: '10px 20px',
                    background: '#eab308',
                    color: '#04121d',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {submittingOtp ? 'Sending OTP to Worker...' : 'Submit OTP to Worker'}
                </button>
              </div>
            </div>
          )}

          {activeJob?.status === 'AWAITING_CAPTCHA' && (
            <div style={{
              background: 'rgba(168, 85, 247, 0.15)',
              border: '1px solid #a855f7',
              borderRadius: '12px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#c084fc' }}>
                <ShieldAlert size={20} />
                <strong style={{ fontSize: '14px' }}>Government CAPTCHA Required</strong>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#e9d5ff', lineHeight: 1.5 }}>
                {activeJob.captchaPrompt || 'Government CAPTCHA required. Complete the CAPTCHA in the controlled Chromium browser window.'}
              </p>
              <button
                type="button"
                onClick={handleConfirmCaptcha}
                disabled={confirmingCaptcha}
                style={{
                  alignSelf: 'flex-start',
                  padding: '10px 20px',
                  background: '#a855f7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {confirmingCaptcha ? 'Confirming with Worker...' : 'I Have Solved the CAPTCHA in Browser'}
              </button>
            </div>
          )}

          {/* Submission Unverified / Ambiguous Outcome Notice */}
          {complaint?.status === 'SUBMISSION_UNVERIFIED' && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24' }}>
                <AlertOctagon size={20} />
                <strong style={{ fontSize: '14px' }}>Submission Outcome Unverified — Do Not Resubmit</strong>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#fef3c7', lineHeight: 1.5 }}>
                The complaint was submitted through the portal, but an official confirmation receipt was not detected before timeout.
                To prevent creating duplicate complaints, RoadGuard AI has paused in the <strong>SUBMISSION_UNVERIFIED</strong> state.
                Please check the open browser window or official portal before resubmitting.
              </p>
            </div>
          )}

          {/* Verified Official Receipt View */}
          {(complaint?.status === 'SUBMITTED' || activeJob?.status === 'COMPLETED') && (complaint?.officialReferenceId || activeJob?.officialReferenceNumber) ? (
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
                  Grievance Submitted Successfully
                </h3>
                <p style={{ color: '#cbd5e1', fontSize: '13px', margin: '0 0 12px' }}>
                  Official government confirmation detected and parsed from authority portal.
                </p>
                <div style={{
                  display: 'inline-block',
                  background: '#04121d',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '17px',
                  color: '#00f5a0',
                  fontWeight: 700,
                  border: '1px solid rgba(0, 245, 160, 0.3)'
                }}>
                  {complaint?.officialReferenceId || activeJob?.officialReferenceNumber}
                </div>
              </div>

              {/* Receipt Summary Details */}
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
                  <div><strong>Jurisdiction:</strong> {investigation?.candidateAuthorityName || 'National Highways Authority of India'}</div>
                  <div><strong>Official Reference:</strong> {complaint?.officialReferenceId || activeJob?.officialReferenceNumber}</div>
                  <div><strong>Portal Integration:</strong> {activeJob?.portalId || 'Official Grievance Portal'} ({activeJob?.mode || filingMode} mode)</div>
                  <div><strong>Submitted At:</strong> {complaint?.submittedAt || activeJob?.updatedAt || new Date().toLocaleString()}</div>
                </div>
              </div>
            </div>
          ) : (
            /* Citizen Review Screen & Dossier */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Manual Location Entry Card (Especially for Offline/Unlocated Defects) */}
              <div style={{
                background: currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED'
                  ? 'rgba(245, 158, 11, 0.08)'
                  : 'rgba(30, 41, 59, 0.35)',
                border: `1px solid ${currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                borderRadius: '12px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED' ? '#f59e0b' : '#38bdf8' }}>
                    <MapPin size={16} />
                    <strong style={{ fontSize: '13px' }}>
                      {currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED'
                        ? 'Location Required — Offline Incident'
                        : 'Civic Location & Provenance'}
                    </strong>
                  </div>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                    color: currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED' ? '#f59e0b' : '#38bdf8',
                    border: `1px solid ${currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(56, 189, 248, 0.3)'}`
                  }}>
                    {currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED' ? 'ACTION REQUIRED' : (currentIssue?.locationSource === 'MANUAL_ENTRY' ? 'CITIZEN REPORTED' : 'GPS TELEMETRY')}
                  </span>
                </div>

                {currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED' && (
                  <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#fef3c7', lineHeight: 1.5 }}>
                    This defect was recorded while GPS tracking was OFF or unavailable. Before submitting to the government portal, please provide the road and district details for proper administrative routing.
                  </p>
                )}

                {locationSuccessMsg && (
                  <div style={{
                    padding: '8px 12px',
                    background: 'rgba(0, 245, 160, 0.15)',
                    border: '1px solid rgba(0, 245, 160, 0.3)',
                    borderRadius: '6px',
                    color: '#00f5a0',
                    fontSize: '12px',
                    marginBottom: '12px'
                  }}>
                    {locationSuccessMsg}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                      Road / Highway Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. NH-16 Near Benz Circle"
                      value={manualRoadName}
                      onChange={(e) => setManualRoadName(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', background: '#090d16', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '12px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                      Village / Town / City
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Vijayawada"
                      value={manualCity}
                      onChange={(e) => setManualCity(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', background: '#090d16', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '12px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                      District *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. NTR District"
                      value={manualDistrict}
                      onChange={(e) => setManualDistrict(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', background: '#090d16', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '12px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                      State
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Andhra Pradesh"
                      value={manualState}
                      onChange={(e) => setManualState(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', background: '#090d16', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '12px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                      PIN Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="e.g. 520010"
                      value={manualPincode}
                      onChange={(e) => setManualPincode(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', background: '#090d16', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '12px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                      Coordinates (Optional WGS84)
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        placeholder="Lat"
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                        style={{ width: '50%', padding: '8px 6px', background: '#090d16', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '11px', boxSizing: 'border-box' }}
                      />
                      <input
                        type="text"
                        placeholder="Lon"
                        value={manualLon}
                        onChange={(e) => setManualLon(e.target.value)}
                        style={{ width: '50%', padding: '8px 6px', background: '#090d16', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontSize: '11px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={handleSaveManualLocation}
                    disabled={savingLocation}
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(56, 189, 248, 0.2)',
                      border: '1px solid #38bdf8',
                      color: '#38bdf8',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {savingLocation ? <RefreshCw size={12} className="spin" /> : <Check size={12} />}
                    {savingLocation ? 'Saving Location...' : 'Save & Update Dossier'}
                  </button>
                </div>
              </div>

              {/* Review Card: All fields to be submitted */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00f5a0', marginBottom: '8px' }}>
                  <Building2 size={16} />
                  <strong style={{ fontSize: '13px' }}>Factual Dossier Telemetry Review</strong>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '10px',
                  fontSize: '12px',
                  marginBottom: '12px'
                }}>
                  <div><span style={{ color: '#64748b' }}>Authority: </span><strong>{investigation?.candidateAuthorityName || 'NHAI'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Defect Category: </span><strong>{currentIssue?.defectClass}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Coordinates: </span><strong>{currentIssue?.latitude != null && currentIssue?.longitude != null ? `${currentIssue.latitude.toFixed(5)}°N, ${currentIssue.longitude.toFixed(5)}°E` : 'Manual Location Reported'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Corridor: </span><strong>{currentIssue?.roadName || 'Identified Highway'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Location Source: </span><strong style={{ color: currentIssue?.locationSource === 'MANUAL_ENTRY' ? '#38bdf8' : (currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED' ? '#f59e0b' : '#00f5a0') }}>{currentIssue?.locationSource === 'MANUAL_ENTRY' ? 'Citizen Reported' : (currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED' ? 'Location Required' : 'GPS Telemetry')}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Filing Mode: </span><strong style={{ color: '#38bdf8' }}>{filingMode === 'MOCK' ? 'Safe Mock Portal' : 'Live Official Portal'}</strong></div>
                </div>

                {/* Complaint Body Textarea */}
                {complaint && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
                      Objective Factual Description (Prepared by AI Agent, Reviewed by Citizen)
                    </label>
                    <textarea
                      rows={5}
                      value={complaint.bodyText}
                      onChange={(e) => setComplaint({ ...complaint, bodyText: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: '#090d16',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#e2e8f0',
                        fontSize: '11px',
                        lineHeight: 1.5,
                        fontFamily: 'monospace',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Ready to submit banner */}
              <div style={{
                background: currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED'
                  ? 'rgba(245, 158, 11, 0.1)'
                  : 'rgba(2, 132, 199, 0.12)',
                border: `1px solid ${currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(2, 132, 199, 0.3)'}`,
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED' ? '#f59e0b' : '#38bdf8' }}>
                    {currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED'
                      ? 'Location Required Before Submission'
                      : 'Ready to submit to Government Portal'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED'
                      ? 'Save road name and district above so RoadGuard AI can resolve the correct road department.'
                      : 'Citizen authorization required. The Playwright automation worker will open the portal, input the factual dossier, and await your OTP/CAPTCHA input.'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleApproveAndSubmit}
                  disabled={submitting || currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED' || (activeJob && ['RUNNING', 'AWAITING_OTP', 'AWAITING_CAPTCHA'].includes(activeJob.status))}
                  style={{
                    padding: '10px 22px',
                    background: currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED'
                      ? 'rgba(100, 116, 139, 0.3)'
                      : 'linear-gradient(135deg, #00f5a0 0%, #00b4d8 100%)',
                    color: currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED' ? '#94a3b8' : '#04121d',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED' ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title={currentIssue?.locationSource === 'MANUAL_LOCATION_REQUIRED' ? 'Please fill in and save location above' : 'Approve and submit to portal'}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={14} className="spin" /> Dispatching...
                    </>
                  ) : (
                    <>
                      <Send size={14} /> Approve &amp; Submit
                    </>
                  )}
                </button>
              </div>

              {/* Manual Fallback Option if worker offline */}
              {!workerStatus.connected && (
                <div style={{
                  background: 'rgba(30, 41, 59, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '10px',
                  padding: '12px 16px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Alternative: Record Manual Portal Receipt
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="e.g. NHAI-2026-98432 or AP-CDMA-84920"
                      value={officialRefInput}
                      onChange={(e) => setOfficialRefInput(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        background: '#090d16',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '6px',
                        color: '#f8fafc',
                        fontSize: '12px',
                        fontFamily: 'monospace'
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleManualRecordReceipt}
                      disabled={submitting || !officialRefInput.trim()}
                      style={{
                        padding: '8px 14px',
                        background: '#1e293b',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Record Receipt
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Collapsible Real Filing Audit Trail */}
          <div style={{
            background: '#090d16',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            overflow: 'hidden'
          }}>
            <button
              type="button"
              onClick={() => setShowAuditLogs(!showAuditLogs)}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'transparent',
                border: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#cbd5e1',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={14} color="#38bdf8" />
                <span>Real Filing Audit Trail ({auditLogs.length} events recorded)</span>
              </div>
              {showAuditLogs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showAuditLogs && (
              <div style={{ padding: '0 16px 14px', maxHeight: '180px', overflowY: 'auto' }}>
                {auditLogs.length === 0 ? (
                  <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                    No automation events logged yet. Click [Approve &amp; Submit] to begin filing.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        style={{
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          fontFamily: 'monospace'
                        }}
                      >
                        <span style={{ color: '#64748b', flexShrink: 0 }}>
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </span>
                        <span style={{
                          color: log.result === 'SUCCESS' ? '#00f5a0' : (log.result === 'AWAITING_HUMAN' ? '#facc15' : '#f87171'),
                          fontWeight: 700,
                          flexShrink: 0
                        }}>
                          [{log.action}]
                        </span>
                        <span style={{ color: '#cbd5e1' }}>{log.details}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.8)'
        }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Browser Isolation Protected • Human-in-the-Loop Handshake
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              background: '#1e293b',
              color: '#94a3b8',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
