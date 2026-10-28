import React, { useEffect, useRef } from 'react';
import {
  Activity,
  Car,
  FileText,
  UserCheck,
  Settings,
  HelpCircle,
  X,
  ChevronRight
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

  // Streamlined Desired Product Structure from Technical Brief
  const NAV_ITEMS = [
    {
      id: 'scanner',
      label: 'Road Monitoring',
      icon: Activity,
      accentColor: '#38bdf8', // Map blue #38BDF8
      desc: 'Live camera detection, map pins, route & report creation'
    },
    {
      id: 'journeys-issues',
      label: 'Journey Reports',
      icon: Car,
      accentColor: '#243b53', // Slate #243B53
      desc: 'Recorded trips, 2D/3D route analysis, defect evidence & PDF',
      badge: issuesCount > 0 ? issuesCount : null
    },
    {
      id: 'gov-reports',
      label: 'Government Reports',
      icon: FileText,
      accentColor: '#14b8a6', // Teal #14B8A6
      desc: 'Official filing audit ledger (NHAI, AP CDMA, Mee Kosam)'
    },
    {
      id: 'profile',
      label: 'Profile & Connected Services',
      icon: UserCheck,
      accentColor: '#38bdf8', // Map blue #38BDF8
      desc: 'Citizen profile, vehicle details & 3-portal gateway'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      accentColor: '#243b53', // Slate #243B53
      desc: 'Theme, camera/location, audio alerts & cache'
    },
    {
      id: 'about',
      label: 'Help and About',
      icon: HelpCircle,
      accentColor: '#627d98',
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
        backgroundColor: 'rgba(16, 42, 67, 0.6)',
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
          backgroundColor: 'var(--bg-secondary, #ffffff)',
          borderRight: '1px solid var(--border-subtle, #cbd5e1)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '10px 0 30px rgba(16, 42, 67, 0.25)',
          animation: 'slideInLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          outline: 'none'
        }}
      >
        {/* Drawer Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle, #cbd5e1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary, #f0f4f8)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src="/favicon-48.png"
              alt="RoadGuard AI App Icon"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                objectFit: 'contain',
                boxShadow: '0 2px 8px rgba(16, 42, 67, 0.2)'
              }}
            />
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main, #102a43)', letterSpacing: '-0.01em' }}>
                ROADGUARD <span style={{ color: '#38bdf8' }}>AI</span>
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted, #243b53)' }}>
                Status: <strong style={{
                  color: recordingStatus === 'RECORDING' ? '#14b8a6' : recordingStatus === 'PAUSED_STATIONARY' ? '#f59e0b' : '#627d98'
                }}>{recordingStatus}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close menu"
            style={{
              background: 'var(--bg-secondary, #ffffff)',
              border: '1px solid var(--border-subtle, #cbd5e1)',
              color: 'var(--text-muted, #243b53)',
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
            const isActive = activeView === item.id || 
              (item.id === 'scanner' && (activeView === 'dashboard' || activeView === 'monitoring')) ||
              (item.id === 'journeys-issues' && (activeView === 'issues' || activeView === 'journeys' || activeView === 'reports'));

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
                  background: isActive ? `${item.accentColor}18` : 'transparent',
                  border: isActive ? `1.5px solid ${item.accentColor}55` : '1.5px solid transparent',
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
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: isActive ? item.accentColor : 'var(--bg-tertiary, #f0f4f8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isActive ? '#ffffff' : 'var(--text-muted, #243b53)',
                  flexShrink: 0,
                  boxShadow: isActive ? `0 2px 8px ${item.accentColor}40` : 'none'
                }}>
                  <Icon size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: isActive ? 700 : 600,
                    color: isActive ? item.accentColor : 'var(--text-main, #102a43)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>{item.label}</span>
                    {item.badge && (
                      <span style={{
                        background: '#ef4444',
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
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted, #627d98)', lineHeight: 1.3 }}>
                    {item.desc}
                  </p>
                </div>
                <ChevronRight size={14} color={isActive ? item.accentColor : '#cbd5e1'} />
              </button>
            );
          })}
        </nav>

        {/* Drawer Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border-subtle, #cbd5e1)',
          background: 'var(--bg-tertiary, #f0f4f8)',
          fontSize: '11px',
          color: 'var(--text-muted, #627d98)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>RoadGuard AI v1.0</span>
            <span style={{ color: '#14b8a6', fontWeight: 600 }}>ONNX YOLO11s</span>
          </div>
          <div>Open-source informed • Leaflet OSM • MIT & AGPL</div>
        </div>
      </div>
    </div>
  );
}
