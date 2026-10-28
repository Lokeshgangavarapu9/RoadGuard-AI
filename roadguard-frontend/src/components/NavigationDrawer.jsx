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

  // 4 Consolidated Clean Hubs + Settings + About
  const NAV_ITEMS = [
    {
      id: 'scanner',
      label: 'Live Road Scanner',
      icon: Activity,
      accentColor: '#2563EB',
      desc: 'Real-time camera detection & geospatial map'
    },
    {
      id: 'journeys-issues',
      label: 'Journeys & Road Issues',
      icon: Car,
      accentColor: '#4F46E5',
      desc: 'Trip logs, route trails, 2D/3D inspection & road defects',
      badge: issuesCount > 0 ? issuesCount : null
    },
    {
      id: 'gov-reports',
      label: 'Government Reports',
      icon: FileText,
      accentColor: '#0D9488',
      desc: 'Official filing audit ledger (NHAI, AP CDMA, Mee Kosam)'
    },
    {
      id: 'profile',
      label: 'Citizen Profile & Portals',
      icon: UserCheck,
      accentColor: '#0284C7',
      desc: 'Citizen identity, vehicle details & 3-portal gateway'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      accentColor: '#64748B',
      desc: 'Civic Daylight theme, alerts, Auto-GPS & cache'
    },
    {
      id: 'about',
      label: 'Help and About',
      icon: HelpCircle,
      accentColor: '#64748B',
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
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
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
          borderRight: '1px solid var(--border-subtle, #e2e8f0)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '10px 0 30px rgba(0, 0, 0, 0.25)',
          animation: 'slideInLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          outline: 'none'
        }}
      >
        {/* Drawer Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary, #f8fafc)'
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
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
              }}
            />
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main, #0f172a)', letterSpacing: '-0.01em' }}>
                ROADGUARD <span style={{ color: '#2563EB' }}>AI</span>
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted, #475569)' }}>
                Status: <strong style={{
                  color: recordingStatus === 'RECORDING' ? '#10b981' : recordingStatus === 'PAUSED_STATIONARY' ? '#f59e0b' : '#64748b'
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
              color: 'var(--text-muted, #475569)',
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

        {/* Navigation Items (4 Consolidated Hubs + Settings + About) */}
        <nav style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id || 
              (item.id === 'scanner' && activeView === 'dashboard') ||
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
                  background: isActive ? item.accentColor : 'var(--bg-tertiary, #f1f5f9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isActive ? '#ffffff' : 'var(--text-muted, #475569)',
                  flexShrink: 0,
                  boxShadow: isActive ? `0 2px 8px ${item.accentColor}40` : 'none'
                }}>
                  <Icon size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: isActive ? 700 : 600,
                    color: isActive ? item.accentColor : 'var(--text-main, #0f172a)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>{item.label}</span>
                    {item.badge && (
                      <span style={{
                        background: '#dc2626',
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
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted, #64748b)', lineHeight: 1.3 }}>
                    {item.desc}
                  </p>
                </div>
                <ChevronRight size={14} color={isActive ? item.accentColor : '#94a3b8'} />
              </button>
            );
          })}
        </nav>

        {/* Drawer Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border-subtle, #e2e8f0)',
          background: 'var(--bg-tertiary, #f8fafc)',
          fontSize: '11px',
          color: 'var(--text-muted, #64748b)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>RoadGuard AI v1.0</span>
            <span style={{ color: '#2563EB', fontWeight: 600 }}>ONNX YOLO11s</span>
          </div>
          <div>Open-source informed • Leaflet OSM • MIT & AGPL</div>
        </div>
      </div>
    </div>
  );
}
