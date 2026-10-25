import React, { useEffect, useRef } from 'react';
import {
  MapPin,
  AlertTriangle,
  History,
  FileBarChart,
  Settings,
  HelpCircle,
  X,
  Shield,
  Activity,
  ChevronRight,
  ExternalLink,
  UserCheck
} from 'lucide-react';

export default function NavigationDrawer({
  isOpen,
  onClose,
  activeView,
  onNavigate,
  issuesCount = 0,
  journeysCount = 0,
  recordingStatus = 'STOPPED'
}) {
  const drawerRef = useRef(null);

  // Close on Escape key press
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Trap focus or prevent background scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      drawerRef.current?.focus();
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const NAV_ITEMS = [
    {
      id: 'dashboard',
      label: 'New Map / Live Monitoring',
      icon: Activity,
      desc: 'Real-time camera detection & geospatial map'
    },
    {
      id: 'issues',
      label: 'Detected Road Issues',
      icon: AlertTriangle,
      desc: 'Review road defects & draft complaints',
      badge: issuesCount > 0 ? issuesCount : null
    },
    {
      id: 'journeys',
      label: 'Journey History',
      icon: History,
      desc: 'Logs, route trails & defect metrics',
      badge: journeysCount > 0 ? journeysCount : null
    },
    {
      id: 'reports',
      label: 'Journey Reports',
      icon: FileBarChart,
      desc: '2D & 3D route analysis & PDF export',
      badge: journeysCount > 0 ? journeysCount : null
    },
    {
      id: 'profile',
      label: 'My Profile & Connected Services',
      icon: UserCheck,
      desc: 'Vehicle registration & official complaint portals'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      desc: 'GPS accuracy, AI thresholds & storage'
    },
    {
      id: 'about',
      label: 'Help and About',
      icon: HelpCircle,
      desc: 'Documentation, attribution & legal notice'
    }
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation Menu"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        backgroundColor: 'rgba(5, 8, 16, 0.75)',
        backdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s ease'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={drawerRef}
        tabIndex={-1}
        style={{
          width: '100%',
          maxWidth: '360px',
          height: '100%',
          backgroundColor: '#0f1422',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '10px 0 30px rgba(0, 0, 0, 0.6)',
          animation: 'slideInLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          outline: 'none'
        }}
      >
        {/* Drawer Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(23, 32, 51, 0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #00f5a0 0%, #00b4d8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#04121d',
              boxShadow: '0 0 12px rgba(0, 245, 160, 0.35)'
            }}>
              <Shield size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                ROADGUARD <span style={{ color: '#00f5a0' }}>AI</span>
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                Status: <strong style={{
                  color: recordingStatus === 'RECORDING' ? '#00f5a0' : recordingStatus === 'PAUSED_STATIONARY' ? '#f59e0b' : '#94a3b8'
                }}>{recordingStatus}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close menu"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: isActive ? 'rgba(0, 245, 160, 0.12)' : 'transparent',
                  border: isActive ? '1px solid rgba(0, 245, 160, 0.35)' : '1px solid transparent',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: isActive ? 'rgba(0, 245, 160, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isActive ? '#00f5a0' : '#94a3b8',
                  flexShrink: 0
                }}>
                  <Icon size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: isActive ? 700 : 600,
                    color: isActive ? '#00f5a0' : '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>{item.label}</span>
                    {item.badge && (
                      <span style={{
                        background: '#ff3366',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: '999px'
                      }}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b', lineHeight: 1.3 }}>
                    {item.desc}
                  </p>
                </div>
                <ChevronRight size={14} color={isActive ? '#00f5a0' : '#475569'} />
              </button>
            );
          })}
        </nav>

        {/* Drawer Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 21, 35, 0.7)',
          fontSize: '11px',
          color: '#64748b'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>RoadGuard AI v1.0</span>
            <span style={{ color: '#00f5a0' }}>ONNX YOLO11s</span>
          </div>
          <div>Open-source informed • Leaflet OSM • MIT & AGPL</div>
        </div>
      </div>
    </div>
  );
}
