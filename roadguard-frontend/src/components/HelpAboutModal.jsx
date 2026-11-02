import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  Shield,
  FileText,
  AlertTriangle,
  ExternalLink,
  X,
  Code2,
  CheckCircle2,
  Scale,
  Camera,
  MapPin,
  Lock,
  Smartphone,
  Info
} from 'lucide-react';

export default function HelpAboutModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('guide'); // 'guide' | 'privacy' | 'legal' | 'tech'

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Help and About RoadGuard AI"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        padding: '16px',
        animation: 'fadeIn 0.2s ease'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{
        backgroundColor: 'var(--bg-card, #ffffff)',
        color: 'var(--text-main, #0f172a)',
        border: '1px solid var(--border-subtle, #e2e8f0)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary, #f1f5f9)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src="/favicon-48.png"
              alt="RoadGuard AI App Icon"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                objectFit: 'contain'
              }}
            />
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-main, #0f172a)' }}>
                RoadGuard AI · Help & Guide
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-dim, #64748b)' }}>
                Spot road damage. Help get it fixed.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close about dialog"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim, #64748b)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
          background: 'var(--bg-card, #ffffff)',
          overflowX: 'auto'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            style={{
              padding: '12px 16px',
              fontSize: '12px',
              fontWeight: activeTab === 'guide' ? 700 : 500,
              color: activeTab === 'guide' ? 'var(--color-civic-teal, #0d9488)' : 'var(--text-dim, #64748b)',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'guide' ? 'var(--color-civic-teal, #0d9488)' : 'transparent'}`,
              background: 'transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            1. User Guide
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            style={{
              padding: '12px 16px',
              fontSize: '12px',
              fontWeight: activeTab === 'privacy' ? 700 : 500,
              color: activeTab === 'privacy' ? 'var(--color-civic-teal, #0d9488)' : 'var(--text-dim, #64748b)',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'privacy' ? 'var(--color-civic-teal, #0d9488)' : 'transparent'}`,
              background: 'transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            2. Privacy & Camera FAQ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('legal')}
            style={{
              padding: '12px 16px',
              fontSize: '12px',
              fontWeight: activeTab === 'legal' ? 700 : 500,
              color: activeTab === 'legal' ? 'var(--color-civic-teal, #0d9488)' : 'var(--text-dim, #64748b)',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'legal' ? 'var(--color-civic-teal, #0d9488)' : 'transparent'}`,
              background: 'transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            3. Legal Notice
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tech')}
            style={{
              padding: '12px 16px',
              fontSize: '12px',
              fontWeight: activeTab === 'tech' ? 700 : 500,
              color: activeTab === 'tech' ? 'var(--color-civic-teal, #0d9488)' : 'var(--text-dim, #64748b)',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'tech' ? 'var(--color-civic-teal, #0d9488)' : 'transparent'}`,
              background: 'transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            4. Architecture & Licenses
          </button>
        </div>

        {/* Tab Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* TAB 1: User Guide */}
          {activeTab === 'guide' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                How to Use RoadGuard AI in 4 Steps
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-tertiary, #f1f5f9)', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-civic-teal, #0d9488)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>1</span>
                    <strong style={{ fontSize: '13px' }}>Mount Device & Open Scan Road</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted, #334155)', lineHeight: 1.5 }}>
                    Place your smartphone on a dashboard mount with an unobstructed view of the road ahead.
                  </p>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-tertiary, #f1f5f9)', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-civic-teal, #0d9488)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>2</span>
                    <strong style={{ fontSize: '13px' }}>Tap "Start Road Scan"</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted, #334155)', lineHeight: 1.5 }}>
                    One tap starts your rear dashcam stream and begins GPS journey tracking simultaneously.
                  </p>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-tertiary, #f1f5f9)', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-civic-teal, #0d9488)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>3</span>
                    <strong style={{ fontSize: '13px' }}>Drive Normally</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted, #334155)', lineHeight: 1.5 }}>
                    The YOLO11s AI vision model automatically spots potholes and cracks in real time with high accuracy.
                  </p>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-tertiary, #f1f5f9)', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-civic-teal, #0d9488)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>4</span>
                    <strong style={{ fontSize: '13px' }}>Review & File Grievance</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted, #334155)', lineHeight: 1.5 }}>
                    When stopped, review captured evidence and 1-click prepare a grievance draft for official repair.
                  </p>
                </div>
              </div>

              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(13, 148, 136, 0.08)', border: '1px solid rgba(13, 148, 136, 0.25)', fontSize: '12px', color: 'var(--text-muted, #334155)' }}>
                <strong>No dashcam or GPS lock right now?</strong> Use the <strong>"Try 30s Demo Scan"</strong> button on the top-right header to test the complete detection, mapping, and complaint workflow immediately.
              </div>
            </div>
          )}

          {/* TAB 2: Privacy & Camera FAQ */}
          {activeTab === 'privacy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                Privacy & Data Security
              </h3>

              <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'var(--bg-tertiary, #f1f5f9)' }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-main, #0f172a)', marginBottom: '4px' }}>
                  <Lock size={15} color="#0d9488" /> Does RoadGuard AI record or store personal video?
                </strong>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted, #334155)', lineHeight: 1.5 }}>
                  No continuous video is ever uploaded or recorded to cloud storage. Camera frames are processed on-device or streamed to the backend solely for road hazard inference. Only discrete snapshot frames containing confirmed road defects are retained as evidence.
                </p>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'var(--bg-tertiary, #f1f5f9)' }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-main, #0f172a)', marginBottom: '4px' }}>
                  <MapPin size={15} color="#0d9488" /> What happens if I deny GPS location permission?
                </strong>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted, #334155)', lineHeight: 1.5 }}>
                  RoadGuard AI operates in GPS-independent mode. You can still scan roads, detect potholes with full AI accuracy, and manually pin your street location afterwards on the interactive map.
                </p>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'var(--bg-tertiary, #f1f5f9)' }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-main, #0f172a)', marginBottom: '4px' }}>
                  <Shield size={15} color="#0d9488" /> Are my complaint details shared with third parties?
                </strong>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted, #334155)', lineHeight: 1.5 }}>
                  Your citizen identity and complaint drafts remain confidential and are only dispatched to the official government portal (NHAI, AP CDMA, AP Mee Kosam) that you choose to submit to.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: Legal Notice */}
          {activeTab === 'legal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}>
                <AlertTriangle size={22} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '12px', color: 'var(--text-main, #0f172a)', lineHeight: 1.5 }}>
                  <strong style={{ display: 'block', marginBottom: '4px', color: '#b45309' }}>
                    STAGE A PROTOTYPE NOTICE — SIMULATED DEMONSTRATION
                  </strong>
                  Automated grievance filing workflows in this application are statutory complaint preparation demonstrations. In Stage A, no automated submission to Indian municipal or national authorities (such as AP Spandana, NHAI Rajmargyatra, or CPGRAMS) occurs without authenticated citizen review, consent, and official portal OTP verification.
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>Safe Operation Policy</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted, #334155)', lineHeight: 1.5 }}>
                  Never interact with this application or hold your phone while operating a motor vehicle. Mount the device prior to departure and only interact with reports and complaints when parked safely.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: Architecture & Licenses */}
          {activeTab === 'tech' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>System Architecture</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted, #334155)', lineHeight: 1.5 }}>
                  RoadGuard AI combines smartphone dashcam vision, WGS84 GPS telemetry, and Microsoft ONNX Runtime executing YOLO11s road-damage models in a Java Spring Boot backend with PostgreSQL persistence and Farama Gymnasium offline RL policy optimization.
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Scale size={15} color="#0d9488" /> Open-Source Components & Attribution
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                  <div style={{ background: 'var(--bg-tertiary, #f1f5f9)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>coding-parrot/pothole-reporter</strong>
                      <span style={{ color: '#0d9488', fontWeight: 600 }}>MIT License</span>
                    </div>
                    <p style={{ margin: '3px 0 0', color: 'var(--text-dim, #64748b)' }}>
                      Copyright (c) 2026 Gaurav Sen. Adapted: Drive mode ergonomics, stationary pause grace period, and camera evidence capture principles.
                    </p>
                  </div>

                  <div style={{ background: 'var(--bg-tertiary, #f1f5f9)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>Ultralytics YOLO11s & ONNX Runtime</strong>
                      <span style={{ color: '#2563eb', fontWeight: 600 }}>AGPL-3.0 / MIT</span>
                    </div>
                    <p style={{ margin: '3px 0 0', color: 'var(--text-dim, #64748b)' }}>
                      Road damage detection model weights for pothole and crack classification, deployed in ONNX format.
                    </p>
                  </div>

                  <div style={{ background: 'var(--bg-tertiary, #f1f5f9)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>OpenStreetMap & Leaflet</strong>
                      <span style={{ color: '#f59e0b', fontWeight: 600 }}>ODbL / BSD-2</span>
                    </div>
                    <p style={{ margin: '3px 0 0', color: 'var(--text-dim, #64748b)' }}>
                      Map data © OpenStreetMap contributors under Open Database License.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle, #e2e8f0)',
          background: 'var(--bg-tertiary, #f1f5f9)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: 'var(--text-dim, #64748b)'
        }}>
          <span>RoadGuard AI · Civic Clarity Architecture</span>
          <button
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: '6px 14px', fontSize: '11px', minHeight: '32px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
