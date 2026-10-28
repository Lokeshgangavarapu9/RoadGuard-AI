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
  Image as ImageIcon
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { jsPDF } from 'jspdf';
import { getJourney, getJourneyGps, getJourneyFrames, listIssues, deleteJourney } from '../api';
import { isValidCoordinate } from '../utils/geoUtils';

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
  initialTab = 'journeys' // 'journeys' | 'defects'
}) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'journeys' | 'defects'
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

  // Handle Journey Deletion
  async function handleDeleteJourney(e, id) {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await deleteJourney(id);
      setStatusNotification(`Journey #${id} deleted successfully.`);
      setTimeout(() => setStatusNotification(null), 3000);
      if (inspectingId === id) {
        setInspectingId(null);
      }
      setDeleteConfirmId(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Delete journey failed:', err);
      setStatusNotification(`Failed to delete journey #${id}: ${err.message}`);
      setTimeout(() => setStatusNotification(null), 4000);
    } finally {
      setIsDeleting(false);
    }
  }

  // 3D MapLibre Initialization
  useEffect(() => {
    if (viewDimension !== '3D' || !maplibreglContainerRef.current) return;

    const validCoordinates = gpsPoints
      .filter(p => isValidCoordinate(p.latitude, p.longitude))
      .map(p => [p.longitude, p.latitude]);

    if (validCoordinates.length === 0) return;

    if (maplibreglMapRef.current) {
      maplibreglMapRef.current.remove();
      maplibreglMapRef.current = null;
    }

    try {
      const startCoord = validCoordinates[0];
      const map = new maplibregl.Map({
        container: maplibreglContainerRef.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: startCoord,
        zoom: 15.5,
        pitch: 55,
        bearing: -15
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

  // Export PDF Dossier
  function handleExportPDF() {
    if (!journeyData) return;
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
  }

  // Filtered defects for the "All Detected Road Defects" sub-tab
  const filteredIssues = issues.filter(iss => {
    if (filterType !== 'ALL' && iss.defectClass !== filterType) return false;
    if (filterStatus !== 'ALL' && iss.status !== filterStatus) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Notification */}
      {statusNotification && (
        <div style={{
          position: 'fixed',
          top: '72px',
          right: '20px',
          zIndex: 1000,
          background: '#102a43',
          color: '#ffffff',
          padding: '10px 18px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          fontWeight: 600,
          animation: 'fadeIn 0.2s ease'
        }}>
          <CheckCircle2 size={16} color="#00f5a0" />
          {statusNotification}
        </div>
      )}

      {/* Top Segmented Switcher Hub Header */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '16px 20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#243b53' }}>📍</span> Journeys & Road Issues
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
            Unified inspection hub: review route telemetry dossiers, 2D/3D map trails, and all detected road defects.
          </p>
        </div>

        {/* Segmented Control Switcher */}
        <div style={{
          display: 'flex',
          background: '#f1f5f9',
          borderRadius: '10px',
          padding: '4px',
          border: '1px solid #e2e8f0'
        }}>
          <button
            onClick={() => { setActiveTab('journeys'); setInspectingId(null); }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeTab === 'journeys' && !inspectingId ? '#ffffff' : 'transparent',
              color: activeTab === 'journeys' && !inspectingId ? '#243b53' : '#64748b',
              boxShadow: activeTab === 'journeys' && !inspectingId ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Car size={16} /> All Journeys & Route Maps ({journeys.length})
          </button>
          <button
            onClick={() => { setActiveTab('defects'); setInspectingId(null); }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeTab === 'defects' ? '#ffffff' : 'transparent',
              color: activeTab === 'defects' ? '#243b53' : '#64748b',
              boxShadow: activeTab === 'defects' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <AlertTriangle size={16} color="#d97706" /> All Detected Road Defects ({issues.length})
          </button>
        </div>
      </div>

      {/* SUB-SECTION 1: SINGLE JOURNEY 2D/3D INSPECTION VIEW */}
      {inspectingId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Back Bar & Inspection Controls */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 18px'
          }}>
            <button
              onClick={() => setInspectingId(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={16} /> Back to All Journeys
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                Journey #{inspectingId} Dossier
              </span>

              {/* 2D / 3D Dimension Toggle */}
              <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px', border: '1px solid #e2e8f0' }}>
                <button
                  onClick={() => setViewDimension('2D')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: viewDimension === '2D' ? '#ffffff' : 'transparent',
                    color: viewDimension === '2D' ? '#0284c7' : '#64748b',
                    boxShadow: viewDimension === '2D' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  <Layers size={13} style={{ display: 'inline', marginRight: '4px' }} /> 2D Map
                </button>
                <button
                  onClick={() => setViewDimension('3D')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: viewDimension === '3D' ? '#ffffff' : 'transparent',
                    color: viewDimension === '3D' ? '#243b53' : '#64748b',
                    boxShadow: viewDimension === '3D' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  <Box size={13} style={{ display: 'inline', marginRight: '4px' }} /> 3D WebGL
                </button>
              </div>

              {/* PDF Download Button */}
              <button
                onClick={handleExportPDF}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  background: '#102a43',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Download size={14} /> Export PDF
              </button>
            </div>
          </div>

          {isLoadingInspection ? (
            <div style={{ padding: '60px', textAlign: 'center', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <RefreshCw size={28} className="spin" color="#243b53" style={{ margin: '0 auto 10px' }} />
              <p style={{ color: '#64748b', fontSize: '14px' }}>Loading route coordinates & defect evidence...</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(300px, 1fr)', gap: '16px' }} className="inspection-split-grid">
              {/* Map Column */}
              <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', minHeight: '440px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                    {viewDimension === '3D' ? 'MapLibre 3D Extruded Trajectory' : 'OpenStreetMap 2D Route Trail'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {gpsPoints.length} GPS Coordinates Logged
                  </span>
                </div>

                <div style={{ flex: 1, minHeight: '400px', position: 'relative' }}>
                  {viewDimension === '3D' ? (
                    gpsPoints.filter(p => isValidCoordinate(p.latitude, p.longitude)).length < 2 ? (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        minHeight: '400px',
                        padding: '40px 20px',
                        textAlign: 'center',
                        background: '#f8fafc',
                        color: '#64748b'
                      }}>
                        <Box size={40} color="#94a3b8" style={{ marginBottom: '12px' }} />
                        <h4 style={{ margin: '0 0 6px', color: '#102a43', fontSize: '15px', fontWeight: 800 }}>3D Route Trajectory Unavailable</h4>
                        <p style={{ margin: 0, fontSize: '12px', maxWidth: '380px', lineHeight: 1.5 }}>
                          Insufficient genuine GPS route points were recorded during this journey (Camera inference ran in GPS-independent mode). 3D lines are rendered strictly from real recorded coordinates.
                        </p>
                      </div>
                    ) : (
                      <div ref={maplibreglContainerRef} style={{ width: '100%', height: '100%', minHeight: '400px' }} />
                    )
                  ) : (
                    <MapContainer
                      center={gpsPoints.length > 0 && isValidCoordinate(gpsPoints[0].latitude, gpsPoints[0].longitude) ? [gpsPoints[0].latitude, gpsPoints[0].longitude] : [16.5062, 80.6480]}
                      zoom={14}
                      style={{ width: '100%', height: '100%', minHeight: '400px' }}
                    >
                      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                      {gpsPoints.length > 1 && (
                        <Polyline
                          positions={gpsPoints.filter(p => isValidCoordinate(p.latitude, p.longitude)).map(p => [p.latitude, p.longitude])}
                          pathOptions={{ color: '#0284c7', weight: 5, opacity: 0.9 }}
                        />
                      )}
                      {gpsPoints.length > 0 && isValidCoordinate(gpsPoints[0].latitude, gpsPoints[0].longitude) && (
                        <Marker position={[gpsPoints[0].latitude, gpsPoints[0].longitude]} icon={REPORT_ICONS.START}>
                          <Popup>Departure: {new Date(gpsPoints[0].recordedAt).toLocaleTimeString()}</Popup>
                        </Marker>
                      )}
                      {gpsPoints.length > 1 && isValidCoordinate(gpsPoints[gpsPoints.length - 1].latitude, gpsPoints[gpsPoints.length - 1].longitude) && (
                        <Marker position={[gpsPoints[gpsPoints.length - 1].latitude, gpsPoints[gpsPoints.length - 1].longitude]} icon={REPORT_ICONS.END}>
                          <Popup>Destination: {new Date(gpsPoints[gpsPoints.length - 1].recordedAt).toLocaleTimeString()}</Popup>
                        </Marker>
                      )}
                      {journeyIssues.map(issue => (
                        isValidCoordinate(issue.latitude, issue.longitude) && (
                          <Marker key={issue.id} position={[issue.latitude, issue.longitude]} icon={REPORT_ICONS[issue.defectClass] || REPORT_ICONS.DEFAULT}>
                            <Popup>
                              <strong>{issue.defectClass?.replace('_', ' ')}</strong><br />
                              Confidence: {((issue.confidenceScore || 0.85) * 100).toFixed(0)}%<br />
                              Road: {issue.roadName || 'Public Road'}
                            </Popup>
                          </Marker>
                        )
                      ))}
                    </MapContainer>
                  )}
                </div>
              </div>

              {/* Defects in this Journey Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                    Defects Detected on This Trip ({journeyIssues.length})
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    {((journeyData?.distanceMeters || 0) / 1000).toFixed(2)} km monitored
                  </span>
                </div>

                {journeyIssues.length === 0 ? (
                  <div style={{ padding: '36px 20px', textAlign: 'center', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                    <CheckCircle2 size={36} color="#059669" style={{ margin: '0 auto 8px' }} />
                    <h4 style={{ margin: 0, color: '#0f172a' }}>No Defects Detected</h4>
                    <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Pavement condition was within acceptable safety criteria throughout this journey.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
                    {journeyIssues.map(issue => (
                      <div
                        key={issue.id}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '8px',
                            background: issue.defectClass === 'POTHOLE' ? '#fef2f2' : '#fffbeb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: issue.defectClass === 'POTHOLE' ? '#dc2626' : '#d97706',
                            flexShrink: 0
                          }}>
                            <AlertTriangle size={20} />
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                              {issue.defectClass?.replace('_', ' ')}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                              Conf: {((issue.confidenceScore || 0.85) * 100).toFixed(0)}% • {issue.roadName || 'Public Road'}
                            </div>
                            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                              Coords: {issue.latitude?.toFixed(4)}°N, {issue.longitude?.toFixed(4)}°E
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => onSelectIssue && onSelectIssue(issue)}
                          style={{
                            padding: '6px 12px',
                            background: '#0d9488',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <FileText size={12} /> Report
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-SECTION 2: ALL JOURNEYS FLASHCARDS VIEW */}
      {activeTab === 'journeys' && !inspectingId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {journeys.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', color: '#64748b' }}>
              <Car size={44} color="#243b53" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ color: '#0f172a', margin: '0 0 6px', fontSize: '16px' }}>No Inspection Journeys Recorded</h3>
              <p style={{ fontSize: '13px', maxWidth: '480px', margin: '0 auto' }}>
                Mount your smartphone and click Start Driving Mode or Camera Scanner on the dashboard to automatically monitor roads and generate journey dossiers.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
              {journeys.map(j => {
                const VehicleIcon = j.vehicleType === 'BIKE' ? Bike : (j.vehicleType === 'HEAVY' ? Truck : Car);
                const distanceKm = ((j.distanceMeters || 0) / 1000).toFixed(2);
                const isConfirmingDelete = deleteConfirmId === j.id;

                return (
                  <div
                    key={j.id}
                    className="glass-card"
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                      position: 'relative'
                    }}
                  >
                    {/* Top Row: Car Icon & Journey ID */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '8px',
                          background: '#eef2ff',
                          color: '#243b53',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <VehicleIcon size={20} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                            Journey #{j.id}
                          </h4>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {j.riderName || 'Inspection Run'}
                          </span>
                        </div>
                      </div>

                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: j.status === 'ACTIVE' ? '#ecfdf5' : '#f1f5f9',
                        color: j.status === 'ACTIVE' ? '#059669' : '#475569'
                      }}>
                        {j.status || 'STOPPED'}
                      </span>
                    </div>

                    {/* Stats Strip */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Distance</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{distanceKm} km</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Frames</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{j.totalFrames || 0}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Defects</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: (j.issuesCount || 0) > 0 ? '#dc2626' : '#059669' }}>
                          {j.issuesCount || 0}
                        </div>
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      {new Date(j.startedAt || j.createdAt || Date.now()).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>

                    {/* Footer Actions: Open Dossier & Dustbin Delete */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '4px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                      <button
                        onClick={() => { setInspectingId(j.id); if (onSelectJourney) onSelectJourney(j.id); }}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          background: '#eef2ff',
                          color: '#243b53',
                          border: '1px solid #c7d2fe',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <Eye size={14} /> Open Journey & Issues (2D/3D)
                      </button>

                      {isConfirmingDelete ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            onClick={(e) => handleDeleteJourney(e, j.id)}
                            disabled={isDeleting}
                            style={{
                              padding: '6px 10px',
                              background: '#dc2626',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Confirm
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                            style={{
                              padding: '6px 8px',
                              background: '#f1f5f9',
                              color: '#475569',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(j.id); }}
                          title="Delete journey"
                          aria-label={`Delete journey #${j.id}`}
                          style={{
                            padding: '8px',
                            background: '#fef2f2',
                            color: '#ef4444',
                            border: '1px solid #fecaca',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-SECTION 3: ALL DETECTED ROAD DEFECTS VIEW */}
      {activeTab === 'defects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Defect Class & Status Filter Bar */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 18px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <SlidersHorizontal size={16} color="#64748b" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={{
                  padding: '7px 12px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: '#0f172a',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                <option value="ALL">All Defect Classes</option>
                <option value="POTHOLE">Potholes Only</option>
                <option value="ALLIGATOR_CRACK">Alligator Cracks</option>
                <option value="TRANSVERSE_CRACK">Transverse Cracks</option>
                <option value="ROAD_CRACK">Road Cracks</option>
                <option value="WATERLOGGING">Waterlogging</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  padding: '7px 12px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: '#0f172a',
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
            </div>

            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Showing {filteredIssues.length} of {issues.length} detected defects
            </span>
          </div>

          {filteredIssues.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', color: '#64748b' }}>
              <AlertTriangle size={44} color="#d97706" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ color: '#0f172a', margin: '0 0 6px', fontSize: '16px' }}>No Road Defects Found</h3>
              <p style={{ fontSize: '13px', maxWidth: '480px', margin: '0 auto' }}>
                No defects matched your filter criteria. Start the live camera scanner to identify road hazards automatically.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {filteredIssues.map(issue => (
                <div
                  key={issue.id}
                  className="glass-card"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: issue.defectClass === 'POTHOLE' ? '#fef2f2' : '#fffbeb',
                      color: issue.defectClass === 'POTHOLE' ? '#dc2626' : '#d97706',
                      textTransform: 'uppercase'
                    }}>
                      {issue.defectClass?.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Conf: {((issue.confidenceScore || 0.85) * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: '14px', color: '#0f172a', fontWeight: 700 }}>
                      {issue.roadName || 'Public Roadway'}
                    </h4>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                      {issue.address || `${issue.latitude?.toFixed(5)}°N, ${issue.longitude?.toFixed(5)}°E`}
                    </p>
                  </div>

                  <div style={{
                    padding: '8px 10px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #f1f5f9',
                    fontSize: '11px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ color: '#475569' }}>
                      Authority: <strong>{issue.authorityCode || 'NHAI'}</strong>
                    </span>
                    <span style={{ color: issue.dlpApplicable ? '#059669' : '#64748b', fontWeight: 600 }}>
                      {issue.dlpApplicable ? '✓ Active DLP Warranty' : 'Standard Maintenance'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      onClick={() => onViewOnMap && onViewOnMap(issue)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        color: '#334155',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <MapPin size={13} color="#2563eb" /> View on Map
                    </button>
                    <button
                      onClick={() => onSelectIssue && onSelectIssue(issue)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        background: '#0d9488',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <FileText size={13} /> Report
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

