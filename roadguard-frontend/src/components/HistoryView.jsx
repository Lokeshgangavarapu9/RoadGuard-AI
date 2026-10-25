import React, { useState } from 'react';
import {
  History,
  Car,
  Bike,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Camera,
  AlertTriangle,
  RefreshCw,
  ChevronRight
} from 'lucide-react';

export default function HistoryView({
  journeys = [],
  onRefresh,
  onInspectJourney
}) {
  const [selectedJourney, setSelectedJourney] = useState(null);

  const vehicleIcons = {
    CAR: Car,
    BIKE: Bike,
    TRUCK: Truck
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            Inspection Journey History ({journeys.length})
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>
            Complete audit trail of road-monitoring runs, frame uploads, and defect detections.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="btn-secondary"
          style={{ padding: '8px 14px', fontSize: '12px' }}
        >
          <RefreshCw size={14} /> Refresh History
        </button>
      </div>

      {journeys.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
          <History size={44} color="#38bdf8" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ color: '#f8fafc', margin: '0 0 6px', fontSize: '16px' }}>No journeys recorded yet</h3>
          <p style={{ fontSize: '13px' }}>Start a live camera journey or synthetic replay from the Live Monitoring view.</p>
        </div>
      ) : (
        <>
          {/* Mobile View: Stacked Cards (visible below 768px via CSS) */}
          <div className="mobile-journey-cards" style={{ display: 'none', flexDirection: 'column', gap: '12px' }}>
            {journeys.map((j) => {
              const Icon = vehicleIcons[j.vehicleType] || Car;
              const isActive = j.status === 'ACTIVE';
              return (
                <div
                  key={j.id}
                  className="glass-card"
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                  onClick={() => onInspectJourney && onInspectJourney(j)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        color: '#00f5a0',
                        fontSize: '13px'
                      }}>
                        #{j.id}
                      </span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 700,
                        background: isActive ? 'rgba(0, 245, 160, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                        color: isActive ? '#00f5a0' : '#94a3b8'
                      }}>
                        {j.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#cbd5e1', fontSize: '12px' }}>
                      <Icon size={14} color="#38bdf8" />
                      <span>{j.vehicleType}</span>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Frames: <strong>{j.totalFrames}</strong></span>
                    <span>Defects: <strong style={{ color: j.issueCount > 0 ? '#ff3366' : '#94a3b8' }}>{j.issueCount}</strong></span>
                  </div>

                  <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    <span>{new Date(j.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop View: Clean Table */}
          <div className="desktop-journey-table glass-panel" style={{ overflowX: 'auto', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8', background: 'rgba(0, 0, 0, 0.2)' }}>
                  <th style={{ padding: '12px 16px' }}>Journey ID</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Vehicle</th>
                  <th style={{ padding: '12px 16px' }}>Operator / Driver</th>
                  <th style={{ padding: '12px 16px' }}>Frames Uploaded</th>
                  <th style={{ padding: '12px 16px' }}>Confirmed Defects</th>
                  <th style={{ padding: '12px 16px' }}>Recorded At</th>
                </tr>
              </thead>
              <tbody>
                {journeys.map((j) => {
                  const Icon = vehicleIcons[j.vehicleType] || Car;
                  const isActive = j.status === 'ACTIVE';
                  return (
                    <tr
                      key={j.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#00f5a0' }}>
                        #{j.id}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: isActive ? 'rgba(0, 245, 160, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                          color: isActive ? '#00f5a0' : '#94a3b8'
                        }}>
                          {j.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Icon size={14} color="#38bdf8" /> {j.vehicleType}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>
                        {j.riderName || 'Anonymous Citizen'}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>
                        {j.totalFrames} frames
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <strong style={{ color: j.issueCount > 0 ? '#ff3366' : '#94a3b8' }}>
                          {j.issueCount}
                        </strong>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '12px' }}>
                        {new Date(j.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
