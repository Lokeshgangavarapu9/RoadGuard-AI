import React, { useState } from 'react';
import {
  AlertTriangle,
  FileText,
  MapPin,
  RefreshCw,
  Clock,
  ShieldCheck,
  Building,
  Image as ImageIcon,
  CheckCircle2,
  SlidersHorizontal,
  Compass
} from 'lucide-react';
import { isValidCoordinate } from '../utils/geoUtils';

export default function IssuesView({
  issues = [],
  onRefresh,
  onSelectIssue,
  onViewOnMap
}) {
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterSource, setFilterSource] = useState('ALL');
  const [imageErrors, setImageErrors] = useState({});

  const filteredIssues = issues.filter((iss) => {
    if (filterType !== 'ALL' && iss.defectClass !== filterType) return false;
    if (filterStatus !== 'ALL' && iss.status !== filterStatus) return false;
    if (filterSource === 'REAL_ONNX' && iss.detectionMode !== 'REAL_ONNX') return false;
    if (filterSource === 'SIMULATED' && iss.detectionMode === 'REAL_ONNX') return false;
    return true;
  });

  function handleImageError(id) {
    setImageErrors((prev) => ({ ...prev, [id]: true }));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Filter Controls */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            Detected Road Issues ({issues.length})
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>
            Defects clustered across journeys with road authority jurisdiction analysis.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          {/* Defect Class Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              padding: '8px 12px',
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            <option value="ALL">All Defect Classes</option>
            <option value="POTHOLE">Potholes Only</option>
            <option value="ALLIGATOR_CRACK">Alligator Cracks</option>
            <option value="TRANSVERSE_CRACK">Transverse Cracks</option>
            <option value="ROAD_CRACK">Road Cracks</option>
          </select>

          {/* Defect Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: '8px 12px',
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="DETECTED">Detected</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="COMPLAINT_DRAFTED">Complaint Drafted</option>
            <option value="COMPLAINT_SUBMITTED">Complaint Submitted</option>
            <option value="RESOLVED">Resolved</option>
          </select>

          {/* AI Detection Source Filter */}
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            style={{
              padding: '8px 12px',
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            <option value="ALL">All Inference Sources</option>
            <option value="REAL_ONNX">Genuine ONNX YOLO11s</option>
            <option value="SIMULATED">Simulated Demo</option>
          </select>

          <button
            onClick={onRefresh}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '12px' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Issues Grid / List */}
      {filteredIssues.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
          <AlertTriangle size={44} color="#f59e0b" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ color: '#f8fafc', margin: '0 0 6px', fontSize: '16px' }}>No road defects match filter</h3>
          <p style={{ fontSize: '13px', maxWidth: '400px', margin: '0 auto' }}>
            {issues.length === 0
              ? 'Start a road-monitoring journey to scan the pavement with AI vision.'
              : 'Try selecting "All Defect Classes" or "All Inference Sources" to see other issues.'}
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '16px'
        }}>
          {filteredIssues.map((issue) => {
            const isPothole = issue.defectClass === 'POTHOLE';
            const isRealOnnx = issue.detectionMode === 'REAL_ONNX';
            const hasImgError = imageErrors[issue.id];
            const hasThumbnail = issue.representativeFrameUrl && !hasImgError;
            const formattedTime = issue.createdAt ? new Date(issue.createdAt).toLocaleString() : 'Recent Session';

            return (
              <div
                key={issue.id}
                className="glass-card"
                style={{
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  borderRadius: '12px'
                }}
              >
                {/* Top Badges: Class, Confidence, & Source */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      background: isPothole ? 'rgba(255, 51, 102, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: isPothole ? '#ff3366' : '#f59e0b',
                      border: `1px solid ${isPothole ? 'rgba(255, 51, 102, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                      fontWeight: 700,
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      textTransform: 'uppercase'
                    }}>
                      {issue.defectClass?.replace(/_/g, ' ')}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: isRealOnnx ? 'rgba(0, 245, 160, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                      color: isRealOnnx ? '#00f5a0' : '#eab308',
                      border: `1px solid ${isRealOnnx ? 'rgba(0, 245, 160, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`
                    }}>
                      {isRealOnnx ? 'VERIFIED ONNX' : 'SIMULATED DEMO'}
                    </span>
                    {issue.locationSource === 'MANUAL_LOCATION_REQUIRED' ? (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(245, 158, 11, 0.18)',
                        color: '#f59e0b',
                        border: '1px solid rgba(245, 158, 11, 0.4)'
                      }}>
                        LOCATION REQUIRED
                      </span>
                    ) : issue.locationSource === 'MANUAL_ENTRY' ? (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.3)'
                      }}>
                        MANUAL ENTRY
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(100, 116, 139, 0.15)',
                        color: '#94a3b8',
                        border: '1px solid rgba(148, 163, 184, 0.2)'
                      }}>
                        GPS TELEMETRY
                      </span>
                    )}
                  </div>

                  <span style={{
                    fontSize: '11px',
                    color: '#94a3b8',
                    fontFamily: 'monospace',
                    background: 'rgba(0, 0, 0, 0.4)',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    Conf: {((issue.confidenceScore || 0.88) * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Evidence Thumbnail with Fallback and Error Handling */}
                <div style={{
                  width: '100%',
                  height: '160px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#090d16',
                  position: 'relative',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  {hasThumbnail ? (
                    <img
                      src={issue.representativeFrameUrl}
                      alt={`Evidence for defect #${issue.id}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block'
                      }}
                      onError={() => handleImageError(issue.id)}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#64748b',
                      gap: '6px',
                      background: 'radial-gradient(ellipse at center, #172033 0%, #090d16 100%)'
                    }}>
                      <ImageIcon size={28} color="#475569" />
                      <span style={{ fontSize: '11px' }}>
                        {hasImgError ? 'Evidence Frame Unavailable' : 'Awaiting Frame Extraction'}
                      </span>
                    </div>
                  )}

                  {/* Evidence Tag */}
                  <div style={{
                    position: 'absolute',
                    bottom: '6px',
                    left: '8px',
                    background: 'rgba(5, 8, 16, 0.85)',
                    backdropFilter: 'blur(4px)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    color: '#cbd5e1'
                  }}>
                    Issue #{issue.id} • {issue.observationCount || 1} observation{issue.observationCount > 1 ? 's' : ''}
                  </div>
                </div>

                {/* Location & Title */}
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
                    {issue.roadName || (issue.locationSource === 'MANUAL_LOCATION_REQUIRED' ? 'Unlocated Road Defect' : 'Public Road Corridor')}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8', fontSize: '12px' }}>
                    <MapPin size={13} color={issue.locationSource === 'MANUAL_LOCATION_REQUIRED' ? '#f59e0b' : '#00b4d8'} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {issue.address
                        ? issue.address
                        : (isValidCoordinate(issue.latitude, issue.longitude)
                            ? `${issue.latitude.toFixed(5)}°N, ${issue.longitude.toFixed(5)}°E`
                            : (issue.locationSource === 'MANUAL_LOCATION_REQUIRED'
                                ? 'Offline GPS — Manual Location Required'
                                : 'Coordinates Pending'))}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                    <span>Journey #{issue.journeyId}</span>
                    <span>{formattedTime}</span>
                  </div>
                </div>

                {/* Authority & Status Info */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '11px',
                  color: '#cbd5e1'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Building size={13} color="#94a3b8" />
                    <span>Jurisdiction: <strong>{issue.authorityCode || 'NHAI'}</strong></span>
                  </div>
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: issue.status === 'COMPLAINT_SUBMITTED' ? 'rgba(0, 245, 160, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    color: issue.status === 'COMPLAINT_SUBMITTED' ? '#00f5a0' : '#94a3b8',
                    fontWeight: 600
                  }}>
                    {issue.status?.replace(/_/g, ' ') || 'DETECTED'}
                  </span>
                </div>

                {/* Dual Actions: View on Map & Grievance Drafting */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {onViewOnMap && (
                    <button
                      onClick={() => onViewOnMap(issue)}
                      className="btn-secondary"
                      style={{
                        fontSize: '12px',
                        padding: '8px 10px',
                        flex: 1,
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <MapPin size={13} /> View on Map
                    </button>
                  )}
                  <button
                    onClick={() => onSelectIssue(issue)}
                    className="btn-primary"
                    style={{
                      fontSize: '12px',
                      padding: '8px 10px',
                      flex: 1.2,
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <FileText size={13} /> File Grievance
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
