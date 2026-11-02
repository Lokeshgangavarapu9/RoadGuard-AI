import React, { useState, useEffect, useRef } from 'react';
import {
  Car,
  Bike,
  Truck,
  MapPin,
  Clock,
  Layers,
  Box,
  Compass,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Shield,
  Download,
  Trash2,
  RefreshCw,
  SlidersHorizontal,
  CheckCircle2,
  FileText,
  ExternalLink,
  Eye,
  Building,
  Image as ImageIcon,
  Sparkles,
  Filter
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getJourney, getJourneyGps, getJourneyFrames, listIssues, deleteJourney } from '../api';
import { isValidCoordinate } from '../utils/geoUtils';
import { DEMO_SAMPLE_DEFECTS } from '../utils/demoScan';

// 2D Map Marker generator
function createReportIcon(color, symbol = '') {
  return L.divIcon({
    className: 'custom-report-marker',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: ${color};
        border: 2px solid #ffffff;
        box-shadow: 0 0 10px ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 800;
        color: #ffffff;
      ">
        ${symbol}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14]
  });
}

const REPORT_ICONS = {
  START: createReportIcon('#059669', 'S'),
  END: createReportIcon('#dc2626', 'E'),
  POTHOLE: createReportIcon('#dc2626', '●'),
  ALLIGATOR_CRACK: createReportIcon('#d97706', '▲'),
  ROAD_CRACK: createReportIcon('#d97706', '▲'),
  TRANSVERSE_CRACK: createReportIcon('#d97706', '▲'),
  WATERLOGGING: createReportIcon('#0284c7', '■'),
  DEFAULT: createReportIcon('#64748b', '●')
};

export default function JourneysAndIssuesHub({
  journeys = [],
  issues = [],
  selectedJourneyId = null,
  onSelectJourney,
  onSelectIssue,
  onViewOnMap,
  onRefresh,
  initialTab = null // 'defects' | 'journeys'
}) {
  // Default to defects if defects exist, otherwise journeys
  const [activeTab, setActiveTab] = useState(() => {
    if (initialTab) return initialTab;
    return issues && issues.length > 0 ? 'defects' : 'journeys';
  });
  const [inspectingId, setInspectingId] = useState(selectedJourneyId);

  // Single Journey Inspection State
  const [journeyData, setJourneyData] = useState(null);
  const [gpsPoints, setGpsPoints] = useState([]);
  const [frames, setFrames] = useState([]);
  const [journeyIssues, setJourneyIssues] = useState([]);
  const [isLoadingInspection, setIsLoadingInspection] = useState(false);
  const [viewDimension, setViewDimension] = useState('2D'); // '2D' | '3D'
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusNotification, setStatusNotification] = useState(null);

  // Auto-filter empty test runs (0 km / 0 defects)
  const [hideEmptyTrips, setHideEmptyTrips] = useState(true);

  // Local demo issues state if citizen wants to preview
  const [demoIssues, setDemoIssues] = useState([]);

  // All Defects Filter State
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const maplibreglContainerRef = useRef(null);
  const maplibreglMapRef = useRef(null);

  useEffect(() => {
    if (selectedJourneyId) {
      setInspectingId(selectedJourneyId);
      setActiveTab('journeys');
    }
  }, [selectedJourneyId]);

  // Load Journey Details when inspecting
  useEffect(() => {
    if (!inspectingId) {
      setJourneyData(null);
      setGpsPoints([]);
      setFrames([]);
      setJourneyIssues([]);
      return;
    }

    let isMounted = true;
    setIsLoadingInspection(true);

    Promise.all([
      getJourney(inspectingId).catch(() => null),
      getJourneyGps(inspectingId).catch(() => []),
      getJourneyFrames(inspectingId).catch(() => []),
      listIssues(inspectingId).catch(() => [])
    ]).then(([jData, gps, frms, iss]) => {
      if (!isMounted) return;
      setJourneyData(jData);
      setGpsPoints(Array.isArray(gps) ? gps : []);
      setFrames(Array.isArray(frms) ? frms : []);
      setJourneyIssues(Array.isArray(iss) ? iss : []);
      setIsLoadingInspection(false);
    }).catch(err => {
      if (isMounted) {
        console.warn('Failed to load journey inspection details:', err);
        setIsLoadingInspection(false);
      }
    });

    return () => {
      isMounted = false;
      if (maplibreglMapRef.current) {
        maplibreglMapRef.current.remove();
        maplibreglMapRef.current = null;
      }
    };
  }, [inspectingId]);

  // MapLibre GL 3D Map Rendering Lifecycle
  useEffect(() => {
    if (viewDimension !== '3D' || !maplibreglContainerRef.current) return;

    const validCoordinates = gpsPoints
      .filter(p => p.longitude != null && p.latitude != null && isValidCoordinate(p.latitude, p.longitude))
      .map(p => [p.longitude, p.latitude]);

    if (validCoordinates.length < 2) return;

    try {
      const map = new maplibregl.Map({
        container: maplibreglContainerRef.current,
        style: 'https://demotiles.maplibre.org/style.json',
        center: validCoordinates[0],
        zoom: 14.5,
        pitch: 55,
        bearing: -17.6
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');

      map.on('load', () => {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: validCoordinates
            }
          }
        });

        // Glowing 3D Route Line: Sky-Cyan Core with Indigo Casing
        map.addLayer({
          id: 'route-casing',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#4F46E5',
            'line-width': 8,
            'line-opacity': 0.85
          }
        });

        map.addLayer({
          id: 'route-core',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#0284C7',
            'line-width': 4
          }
        });

        // Fit map bounds to route
        const bounds = validCoordinates.reduce((b, coord) => b.extend(coord), new maplibregl.LngLatBounds(validCoordinates[0], validCoordinates[0]));
        map.fitBounds(bounds, { padding: 40, maxZoom: 17, pitch: 55 });
      });

      maplibreglMapRef.current = map;
    } catch (e) {
      console.warn('MapLibre 3D map initialization error:', e);
    }

    return () => {
      if (maplibreglMapRef.current) {
        maplibreglMapRef.current.remove();
        maplibreglMapRef.current = null;
      }
    };
  }, [viewDimension, gpsPoints]);

  // Export PDF Dossier (dynamically loaded on demand)
  async function handleExportPDF() {
    if (!journeyData) return;
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(30, 58, 138); // Civic Navy
      doc.text('RoadGuard AI — Road Inspection Dossier', 14, 20);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Journey ID: #${journeyData.id} (${journeyData.uuid || 'N/A'})`, 14, 28);
    doc.text(`Vehicle: ${journeyData.vehicleType || 'CAR'} | Rider: ${journeyData.riderName || 'Anonymous'}`, 14, 35);
    doc.text(`Distance: ${((journeyData.distanceMeters || 0) / 1000).toFixed(2)} km | Date: ${new Date(journeyData.startedAt || Date.now()).toLocaleString('en-IN')}`, 14, 42);
    doc.text(`Total Defect Observations: ${journeyIssues.length}`, 14, 49);

    let y = 60;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('Detected Road Defects & Jurisdiction Audit:', 14, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    journeyIssues.forEach((issue, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${idx + 1}. [${issue.defectClass?.replace('_', ' ')}] - Conf: ${((issue.confidenceScore || 0.85) * 100).toFixed(0)}%`, 14, y);
      y += 6;
      doc.text(`   Coords: ${issue.latitude?.toFixed(5)}°N, ${issue.longitude?.toFixed(5)}°E | Road: ${issue.roadName || 'Public Roadway'}`, 14, y);
      y += 6;
      doc.text(`   Jurisdiction: ${issue.authorityCode || 'NHAI'} | Status: ${issue.status || 'DETECTED'}`, 14, y);
      y += 8;
    });

    doc.save(`RoadGuard_Journey_${journeyData.id}_Audit_Report.pdf`);
    } catch (err) {
      console.error('Failed to load PDF export module:', err);
      setStatusNotification('Could not generate PDF dossier: ' + err.message);
      setTimeout(() => setStatusNotification(null), 3000);
    }
  }

  async function handleDeleteJourney(e, journeyId) {
    if (e && e.stopPropagation) e.stopPropagation();
    setIsDeleting(true);
    try {
      await deleteJourney(journeyId);
      setStatusNotification(`Trip #${journeyId} deleted successfully.`);
      setTimeout(() => setStatusNotification(null), 3000);
      setDeleteConfirmId(null);
      if (inspectingId === journeyId) setInspectingId(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to delete journey:', err);
      setStatusNotification(`Failed to delete trip #${journeyId}: ${err.message}`);
      setTimeout(() => setStatusNotification(null), 4000);
      setDeleteConfirmId(null);
    } finally {
      setIsDeleting(false);
    }
  }

  // Combined issues list including optional preview demo defects
  const allIssues = [...issues, ...demoIssues];

  // Filtered defects for the "Detected Potholes & Issues" sub-tab
  const filteredIssues = allIssues.filter(iss => {
    if (filterType !== 'ALL' && iss.defectClass !== filterType) return false;
    if (filterStatus !== 'ALL' && iss.status !== filterStatus) return false;
    return true;
  });

  // Filtered journeys (hiding empty runs if toggle is on)
  const visibleJourneys = journeys.filter(j => {
    if (hideEmptyTrips) {
      const dist = j.distanceMeters || 0;
      const defCount = j.potholesCount || j.defectsCount || 0;
      if (dist < 10 && defCount === 0) return false;
    }
    return true;
  });

  // Stale active trip helper
  function formatJourneyStatus(j) {
    if (j.status === 'ACTIVE') {
      const ageMs = Date.now() - new Date(j.startedAt || Date.now()).getTime();
      if (ageMs > 30 * 60 * 1000) {
        return { label: 'COMPLETED (Inactive)', color: '#64748b', bg: '#f1f5f9' };
      }
      return { label: 'RECORDING', color: '#059669', bg: '#ecfdf5' };
    }
    return { label: j.status || 'COMPLETED', color: '#64748b', bg: '#f1f5f9' };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Notification */}
      {statusNotification && (
        <div style={{
          position: 'fixed',
          top: '72px',
          right: '20px',
          zIndex: 1000,
          background: '#0f172a',
          color: '#ffffff',
          padding: '10px 18px',
          borderRadius: '10px',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          fontWeight: 600,
          animation: 'fadeIn 0.2s ease'
        }}>
          <CheckCircle2 size={16} color="var(--color-civic-teal, #0d9488)" />
          {statusNotification}
        </div>
      )}

      {/* Top Switcher Hub Header */}
      <div style={{
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-subtle, #e2e8f0)',
        borderRadius: '14px',
        padding: '16px 20px',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--color-civic-teal, #0d9488)' }}>📍</span> My Trips & Road Issues
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-dim, #64748b)', margin: '4px 0 0' }}>
            Review detected road hazards, browse recorded journey trails, and prepare statutory complaints.
          </p>
        </div>

        {/* 2 Sub-Tabs */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-tertiary, #f1f5f9)',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          gap: '4px'
        }}>
          <button
            type="button"
            onClick={() => { setActiveTab('defects'); setInspectingId(null); }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'defects' && !inspectingId ? 'var(--bg-card, #ffffff)' : 'transparent',
              color: activeTab === 'defects' && !inspectingId ? 'var(--text-main, #0f172a)' : 'var(--text-dim, #64748b)',
              boxShadow: activeTab === 'defects' && !inspectingId ? 'var(--shadow-sm)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <AlertTriangle size={15} color={activeTab === 'defects' && !inspectingId ? '#dc2626' : '#64748b'} />
            Detected Potholes & Issues ({allIssues.length})
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('journeys'); }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'journeys' && !inspectingId ? 'var(--bg-card, #ffffff)' : 'transparent',
              color: activeTab === 'journeys' && !inspectingId ? 'var(--text-main, #0f172a)' : 'var(--text-dim, #64748b)',
              boxShadow: activeTab === 'journeys' && !inspectingId ? 'var(--shadow-sm)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Car size={15} color={activeTab === 'journeys' && !inspectingId ? '#2563eb' : '#64748b'} />
            Recorded Trips & Route Maps ({visibleJourneys.length})
          </button>
        </div>
      </div>

      {/* SUB-SECTION 1: SINGLE JOURNEY INSPECTION VIEW (DOSSIER) */}
      {inspectingId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Back to List Navigation Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={() => setInspectingId(null)}
              className="btn-secondary"
              style={{ padding: '8px 16px', fontSize: '13px', minHeight: '36px' }}
            >
              <ArrowLeft size={16} /> Back to Trips List
            </button>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleExportPDF}
                className="btn-primary"
                style={{ padding: '8px 16px', fontSize: '13px', minHeight: '36px' }}
              >
                <Download size={15} /> Export Audit Dossier (PDF)
              </button>
            </div>
          </div>

          {isLoadingInspection ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-dim, #64748b)' }}>
              <RefreshCw size={28} className="spin-animation" style={{ margin: '0 auto 12px' }} />
              <p>Loading journey telemetry, route points, and defect observations...</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Trip Metadata Header Card */}
              <div style={{
                background: 'var(--bg-card, #ffffff)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: '12px',
                padding: '18px 22px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '14px'
              }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim, #64748b)', fontWeight: 600 }}>TRIP REFERENCE</span>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                    #{journeyData?.id || inspectingId}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim, #64748b)', fontWeight: 600 }}>VEHICLE & RIDER</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>
                    {journeyData?.vehicleType || 'CAR'} · {journeyData?.riderName || 'Anonymous'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim, #64748b)', fontWeight: 600 }}>TOTAL DISTANCE</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-civic-teal, #0d9488)' }}>
                    {((journeyData?.distanceMeters || 0) / 1000).toFixed(2)} km
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim, #64748b)', fontWeight: 600 }}>DEFECTS RECORDED</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#dc2626' }}>
                    {journeyIssues.length} road hazards
                  </div>
                </div>
              </div>

              {/* 2D / 3D Route Map Selector */}
              <div style={{
                background: 'var(--bg-card, #ffffff)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '12px 18px',
                  borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <strong style={{ fontSize: '14px', color: 'var(--text-main, #0f172a)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={16} color="var(--color-civic-teal, #0d9488)" /> Route Telemetry Trail
                  </strong>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setViewDimension('2D')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: 'none',
                        background: viewDimension === '2D' ? 'var(--color-civic-teal, #0d9488)' : 'var(--bg-tertiary, #f1f5f9)',
                        color: viewDimension === '2D' ? '#fff' : 'var(--text-dim, #64748b)',
                        cursor: 'pointer'
                      }}
                    >
                      2D Map (Leaflet)
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewDimension('3D')}
                      disabled={gpsPoints.length < 2}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: 'none',
                        background: viewDimension === '3D' ? 'var(--color-civic-teal, #0d9488)' : 'var(--bg-tertiary, #f1f5f9)',
                        color: viewDimension === '3D' ? '#fff' : 'var(--text-dim, #64748b)',
                        cursor: gpsPoints.length < 2 ? 'not-allowed' : 'pointer',
                        opacity: gpsPoints.length < 2 ? 0.6 : 1
                      }}
                    >
                      3D Trail {gpsPoints.length < 2 ? '(Requires GPS Trail)' : '(MapLibre)'}
                    </button>
                  </div>
                </div>

                <div style={{ height: '380px', position: 'relative' }}>
                  {viewDimension === '2D' ? (
                    gpsPoints.length > 0 ? (
                      <MapContainer
                        center={[gpsPoints[0].latitude, gpsPoints[0].longitude]}
                        zoom={14}
                        style={{ width: '100%', height: '100%' }}
                      >
                        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Polyline
                          positions={gpsPoints.map(p => [p.latitude, p.longitude])}
                          pathOptions={{ color: '#0d9488', weight: 4 }}
                        />
                        {journeyIssues.map(iss => (
                          <Marker
                            key={iss.id}
                            position={[iss.latitude, iss.longitude]}
                            icon={REPORT_ICONS[iss.defectClass] || REPORT_ICONS.DEFAULT}
                          >
                            <Popup>
                              <div>
                                <strong>{iss.defectClass}</strong>
                                <p style={{ margin: '4px 0 0', fontSize: '11px' }}>{iss.roadName}</p>
                              </div>
                            </Popup>
                          </Marker>
                        ))}
                      </MapContainer>
                    ) : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center', color: 'var(--text-dim, #64748b)', background: 'var(--bg-canvas, #f8fafc)' }}>
                        <p style={{ maxWidth: '420px', margin: 0, fontSize: '13px', lineHeight: 1.5 }}>
                          Insufficient genuine GPS route points were recorded during this journey (Camera inference ran in GPS-independent mode). 3D lines are rendered strictly from real recorded coordinates.
                        </p>
                      </div>
                    )
                  ) : (
                    gpsPoints.length >= 2 ? (
                      <div ref={maplibreglContainerRef} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center', color: 'var(--text-dim, #64748b)', background: 'var(--bg-canvas, #f8fafc)' }}>
                        <p style={{ maxWidth: '420px', margin: 0, fontSize: '13px', lineHeight: 1.5 }}>
                          Insufficient genuine GPS route points were recorded during this journey (Camera inference ran in GPS-independent mode). 3D lines are rendered strictly from real recorded coordinates.
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-SECTION 2: RECORDED TRIPS & ROUTE MAPS LIST */}
      {activeTab === 'journeys' && !inspectingId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Filter Bar */}
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            borderRadius: '10px',
            padding: '10px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-main, #0f172a)' }}>
              <input
                type="checkbox"
                checked={hideEmptyTrips}
                onChange={(e) => setHideEmptyTrips(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--color-civic-teal, #0d9488)', cursor: 'pointer' }}
              />
              Hide empty test runs (0 km / 0 defects)
            </label>

            <span style={{ color: 'var(--text-dim, #64748b)' }}>
              Showing {visibleJourneys.length} of {journeys.length} trips
            </span>
          </div>

          {visibleJourneys.length === 0 ? (
            <div style={{
              background: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              borderRadius: '14px',
              padding: '60px 20px',
              textAlign: 'center',
              color: 'var(--text-dim, #64748b)'
            }}>
              <Car size={40} color="var(--color-civic-teal, #0d9488)" style={{ margin: '0 auto 10px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main, #0f172a)', margin: '0 0 4px' }}>
                No Trips Recorded Yet
              </h3>
              <p style={{ fontSize: '13px', margin: 0 }}>
                Start a road scan session to record GPS telemetry and inspect road defects.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
              {visibleJourneys.map(j => {
                const statusMeta = formatJourneyStatus(j);
                return (
                  <div
                    key={j.id}
                    className="glass-card"
                    style={{
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      borderRadius: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                        Trip #{j.id}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: statusMeta.bg,
                        color: statusMeta.color
                      }}>
                        {statusMeta.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted, #334155)' }}>
                      <span>Vehicle: <strong>{j.vehicleType || 'CAR'}</strong></span>
                      <span>Distance: <strong>{((j.distanceMeters || 0) / 1000).toFixed(2)} km</strong></span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim, #64748b)' }}>
                      <span>Started: {new Date(j.startedAt || Date.now()).toLocaleTimeString()}</span>
                      <span style={{ color: (j.potholesCount || j.defectsCount) > 0 ? '#dc2626' : 'inherit', fontWeight: 700 }}>
                        {j.potholesCount || j.defectsCount || 0} defects found
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => { setInspectingId(j.id); }}
                        className="btn-primary"
                        style={{ flex: 1, padding: '7px 12px', fontSize: '12px', minHeight: '34px' }}
                      >
                        Inspect Dossier &rarr;
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(j.id)}
                        aria-label={`Delete trip #${j.id}`}
                        style={{
                          padding: '7px 10px',
                          background: '#fef2f2',
                          color: '#ef4444',
                          border: '1px solid #fecaca',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-SECTION 3: DETECTED POTHOLES & ISSUES LIST */}
      {activeTab === 'defects' && !inspectingId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Defect Filter Bar */}
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            borderRadius: '10px',
            padding: '10px 16px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <Filter size={15} color="var(--text-dim, #64748b)" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  background: 'var(--bg-canvas, #f8fafc)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-main, #0f172a)'
                }}
              >
                <option value="ALL">All Defect Classes</option>
                <option value="POTHOLE">Potholes Only</option>
                <option value="ALLIGATOR_CRACK">Alligator Cracks</option>
                <option value="TRANSVERSE_CRACK">Transverse Cracks</option>
                <option value="ROAD_CRACK">Road Cracks</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  background: 'var(--bg-canvas, #f8fafc)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-main, #0f172a)'
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="DETECTED">Detected</option>
                <option value="COMPLAINT_DRAFTED">Complaint Drafted</option>
                <option value="SUBMITTED">Submitted</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {demoIssues.length === 0 && issues.length === 0 && (
                <button
                  type="button"
                  onClick={() => setDemoIssues(DEMO_SAMPLE_DEFECTS)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: 'rgba(13, 148, 136, 0.1)',
                    border: '1px solid var(--color-civic-teal, #0d9488)',
                    color: 'var(--color-civic-teal, #0d9488)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Sparkles size={12} /> Load Sample Vijayawada Detections (Demo)
                </button>
              )}
              <span style={{ fontSize: '12px', color: 'var(--text-dim, #64748b)' }}>
                Showing {filteredIssues.length} road hazards
              </span>
            </div>
          </div>

          {filteredIssues.length === 0 ? (
            <div style={{
              background: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              borderRadius: '14px',
              padding: '60px 20px',
              textAlign: 'center',
              color: 'var(--text-dim, #64748b)'
            }}>
              <AlertTriangle size={40} color="#d97706" style={{ margin: '0 auto 10px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main, #0f172a)', margin: '0 0 6px' }}>
                No Road Hazards Recorded
              </h3>
              <p style={{ fontSize: '13px', margin: '0 0 16px', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                No defects matched your filter. Start a live road scan or load sample Vijayawada detections to test the complaint workflow.
              </p>
              <button
                type="button"
                onClick={() => setDemoIssues(DEMO_SAMPLE_DEFECTS)}
                className="btn-primary"
                style={{ padding: '8px 18px', fontSize: '12px' }}
              >
                <Sparkles size={14} /> Load Sample Vijayawada Detections (Demo)
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
              {filteredIssues.map(issue => (
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: issue.defectClass === 'POTHOLE' ? '#fef2f2' : '#fffbeb',
                      color: issue.defectClass === 'POTHOLE' ? '#dc2626' : '#d97706'
                    }}>
                      {issue.defectClass?.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim, #64748b)' }}>
                      AI Confidence: {((issue.confidenceScore || 0.88) * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>
                      {issue.roadName || 'Public Roadway'}
                    </h4>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-dim, #64748b)' }}>
                      {issue.latitude != null && issue.longitude != null
                        ? `${issue.latitude.toFixed(5)}°N, ${issue.longitude.toFixed(5)}°E`
                        : 'Unlocated (Manual Pin Required)'}
                    </p>
                  </div>

                  <div style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-canvas, #f8fafc)',
                    border: '1px solid var(--border-subtle, #e2e8f0)',
                    fontSize: '11px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>Jurisdiction: <strong>{issue.authorityCode || 'NHAI / Municipal'}</strong></span>
                    {issue.isDemo && (
                      <span style={{ fontWeight: 700, color: '#2563eb' }}>DEMO SAMPLE</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => onViewOnMap && onViewOnMap(issue)}
                      className="btn-secondary"
                      style={{ flex: 1, padding: '8px 10px', fontSize: '12px', minHeight: '34px' }}
                    >
                      <MapPin size={13} color="#2563eb" /> View on Map
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectIssue && onSelectIssue(issue)}
                      className="btn-primary"
                      style={{ flex: 1.2, padding: '8px 12px', fontSize: '12px', minHeight: '34px' }}
                    >
                      <FileText size={13} /> Prepare Complaint &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Journey Deletion Confirmation Modal */}
      {deleteConfirmId && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 2200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            borderRadius: '14px',
            padding: '24px',
            maxWidth: '420px',
            width: '100%',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-subtle, #e2e8f0)'
          }}>
            <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} color="#ef4444" /> Delete Trip #{deleteConfirmId}?
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--text-muted, #334155)', margin: '0 0 18px', lineHeight: 1.5 }}>
              Are you sure you want to delete this trip record? All recorded GPS coordinates, speed telemetry, and trip summaries will be permanently removed.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteJourney(null, deleteConfirmId)}
                disabled={isDeleting}
                className="btn-danger"
                style={{ padding: '8px 16px', fontSize: '12px' }}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Trip'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
