import React from 'react';
import {
  HelpCircle,
  Shield,
  FileText,
  AlertTriangle,
  ExternalLink,
  X,
  Code2,
  CheckCircle2,
  Scale
} from 'lucide-react';

export default function HelpAboutModal({ isOpen, onClose }) {
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
        backgroundColor: 'rgba(5, 8, 16, 0.85)',
        backdropFilter: 'blur(10px)',
        padding: '16px',
        animation: 'fadeIn 0.2s ease'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{
        backgroundColor: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(30, 41, 59, 0.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src="/favicon-48.png"
              alt="RoadGuard AI App Icon"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                objectFit: 'contain',
                boxShadow: '0 0 12px rgba(0, 245, 160, 0.35)'
              }}
            />
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                About RoadGuard AI
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                Intelligent Road-Monitoring & Public Grievance Redressal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close about dialog"
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

        {/* Body Content */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Regulatory Warning Banner */}
          <div style={{
            background: 'rgba(255, 183, 3, 0.12)',
            border: '1px solid rgba(255, 183, 3, 0.4)',
            borderRadius: '10px',
            padding: '12px 16px',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start'
          }}>
            <AlertTriangle size={20} color="#ffb703" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '12px', color: '#fef08a', lineHeight: 1.5 }}>
              <strong style={{ display: 'block', marginBottom: '2px' }}>
                SIMULATED DEMONSTRATION — NOT SUBMITTED TO ANY GOVERNMENT AUTHORITY
              </strong>
              Grievance filing workflows in this application are legal drafting simulations. In Stage A, no automated submission to Indian government portals (such as AP Spandana, NHAI Rajmarg Yatra, or CPGRAMS) occurs without authenticated citizen review and consent.
            </div>
          </div>

          {/* Project Overview */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
              System Architecture
            </h3>
            <p style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.6 }}>
              RoadGuard AI combines smartphone dashcam computer-vision, high-frequency GPS telemetry, and Microsoft ONNX Runtime executing YOLO11s road-damage detection models inside an enterprise Spring Boot backend. Confirmed defects are correlated against public road authority jurisdictions (NHAI, State R&B, Municipal Corporations) and Defect Liability Period (DLP) contractor warranties.
            </p>
          </div>

          {/* Open-Source Attribution & Licenses */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Scale size={16} color="#00f5a0" /> Open-Source Attribution & Licenses
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div style={{ background: '#090d16', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: '#f8fafc' }}>coding-parrot/pothole-reporter</strong>
                  <span style={{ color: '#00f5a0', fontWeight: 600 }}>MIT License</span>
                </div>
                <p style={{ margin: '4px 0 0', color: '#94a3b8' }}>
                  Copyright (c) 2026 Gaurav Sen. Reusable patterns adapted: Drive mode stop button ergonomics, telemetry status display tokens, stationary pause grace period, and camera evidence capture principles.
                </p>
              </div>

              <div style={{ background: '#090d16', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: '#f8fafc' }}>Ultralytics YOLO11s</strong>
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>AGPL-3.0 License</span>
                </div>
                <p style={{ margin: '4px 0 0', color: '#94a3b8' }}>
                  Road damage detection model weights trained for pothole and crack classification, deployed in ONNX format via Microsoft ONNX Runtime.
                </p>
              </div>

              <div style={{ background: '#090d16', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: '#f8fafc' }}>OpenStreetMap & Leaflet</strong>
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>ODbL / BSD-2</span>
                </div>
                <p style={{ margin: '4px 0 0', color: '#94a3b8' }}>
                  Map data © OpenStreetMap contributors under Open Database License. Tiles served by OSM Foundation tile servers.
                </p>
              </div>
            </div>
          </div>

          {/* Quick User Guide */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
              Quick User Guide
            </h3>
            <ul style={{ paddingLeft: '18px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.6 }}>
              <li><strong>Live Drive Mode:</strong> Mount your phone securely on the vehicle dashboard. Select vehicle type and tap "Start Journey".</li>
              <li><strong>Safe Driving:</strong> Never interact with the application while operating a motor vehicle.</li>
              <li><strong>Fail-Closed Safety:</strong> If GPS accuracy is insufficient (&gt;25m) or the vehicle is stationary, recording automatically pauses.</li>
              <li><strong>Grievance Redressal:</strong> Click on any detected issue or map marker to generate a legally structured statutory notice.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 21, 35, 0.7)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: '#64748b'
        }}>
          <span>RoadGuard AI • Andhra Pradesh Corridor</span>
          <button
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: '6px 14px', fontSize: '11px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
