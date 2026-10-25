import React, { useState, useEffect, useRef } from 'react';
import {
  FileBarChart,
  FileText,
  MapPin,
  Clock,
  Car,
  Bike,
  Truck,
  Download,
  Eye,
  Layers,
  Box,
  Compass,
  Calendar,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Shield,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { jsPDF } from 'jspdf';
import { getJourney, getJourneyGps, getJourneyFrames, listIssues } from '../api';

// Marker generator for 2D report map
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
        color: #04121d;
      ">
        ${symbol}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

const REPORT_ICONS = {
  START: createReportIcon('#10b981', 'S'),
  END: createReportIcon('#ef4444', 'E'),
  POTHOLE: createReportIcon('#ff3366', '!'),
  CRACK: createReportIcon('#f59e0b', '~'),
  DEFAULT: createReportIcon('#94a3b8', '•')
};

// MapLibre 3D Map Component
function MapLibre3DViewer({ pathCoords = [], issuePoints = [] }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [webGlSupported, setWebGlSupported] = useState(true);

  useEffect(() => {
    if (!containerRef.current || pathCoords.length === 0) return;

    try {
      const centerLonLat = [pathCoords[0][1], pathCoords[0][0]];

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors'
            }
          },
          layers: [
            {
              id: 'osm-tiles-layer',
              type: 'raster',
              source: 'osm-tiles',
              minzoom: 0,
              maxzoom: 19
            }
          ]
        },
        center: centerLonLat,
        zoom: 15,
        pitch: 60, // 3D Camera tilt
        bearing: -20,
        antialias: true
      });

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

      map.on('load', () => {
        // Add GeoJSON route line
        const coordinates = pathCoords.map((pt) => [pt[1], pt[0]]);
        map.addSource('route-3d', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: coordinates
            }
          }
        });

        map.addLayer({
          id: 'route-3d-line',
          type: 'line',
          source: 'route-3d',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#00f5a0',
            'line-width': 6,
            'line-opacity': 0.85
          }
        });

        // Add 3D Start Marker
        const startEl = document.createElement('div');
        startEl.style.width = '24px';
        startEl.style.height = '24px';
        startEl.style.borderRadius = '50%';
        startEl.style.backgroundColor = '#10b981';
        startEl.style.border = '2px solid white';
        startEl.style.boxShadow = '0 0 10px #10b981';
        new maplibregl.Marker({ element: startEl })
          .setLngLat(coordinates[0])
          .setPopup(new maplibregl.Popup().setText('Journey Start Point'))
          .addTo(map);

        // Add 3D End Marker
        if (coordinates.length > 1) {
          const endEl = document.createElement('div');
          endEl.style.width = '24px';
          endEl.style.height = '24px';
          endEl.style.borderRadius = '50%';
          endEl.style.backgroundColor = '#ef4444';
          endEl.style.border = '2px solid white';
          endEl.style.boxShadow = '0 0 10px #ef4444';
          new maplibregl.Marker({ element: endEl })
            .setLngLat(coordinates[coordinates.length - 1])
            .setPopup(new maplibregl.Popup().setText('Journey Concluded Point'))
            .addTo(map);
        }

        // Add 3D Issue Markers
        issuePoints.forEach((iss) => {
          if (iss.longitude != null && iss.latitude != null) {
            const isPothole = iss.defectClass === 'POTHOLE';
            const issEl = document.createElement('div');
            issEl.style.width = '20px';
            issEl.style.height = '20px';
            issEl.style.borderRadius = '50%';
            issEl.style.backgroundColor = isPothole ? '#ff3366' : '#f59e0b';
            issEl.style.border = '2px solid white';
            issEl.style.boxShadow = `0 0 12px ${isPothole ? '#ff3366' : '#f59e0b'}`;
            new maplibregl.Marker({ element: issEl })
              .setLngLat([iss.longitude, iss.latitude])
              .setPopup(new maplibregl.Popup().setHTML(`
                <div style="font-size:12px;color:#04121d;padding:4px;">
                  <strong>${iss.defectClass?.replace('_', ' ')}</strong><br/>
                  Conf: ${((iss.confidenceScore || 0.85) * 100).toFixed(0)}%
                </div>
              `))
              .addTo(map);
          }
        });
      });

      mapRef.current = map;
    } catch (e) {
      console.warn('MapLibre WebGL 3D initialization failed:', e);
      setWebGlSupported(false);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [pathCoords, issuePoints]);

  if (!webGlSupported) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#090d16',
        color: '#94a3b8',
        padding: '20px',
        textAlign: 'center'
      }}>
        <AlertTriangle size={32} color="#f59e0b" style={{ marginBottom: '8px' }} />
        <h4 style={{ color: '#f8fafc', margin: '0 0 4px' }}>WebGL 3D Acceleration Unavailable</h4>
        <p style={{ fontSize: '12px' }}>Falling back to high-resolution 2D Leaflet view.</p>
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: '100%', height: '100%', borderRadius: 'inherit' }} />;
}

export default function JourneyReportsView({
  journeys = [],
  selectedJourneyId = null,
  onRefresh,
  onOpenIssueGrievance
}) {
  const [selectedJourney, setSelectedJourney] = useState(null);
  const [journeyGps, setJourneyGps] = useState([]);
  const [journeyIssues, setJourneyIssues] = useState([]);
  const [journeyFrames, setJourneyFrames] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeMapMode, setActiveMapMode] = useState('2D'); // '2D' | '3D'
  const [selectedImage, setSelectedImage] = useState(null);

  // Sync selected journey from props
  useEffect(() => {
    if (selectedJourneyId != null) {
      const match = journeys.find((j) => j.id === Number(selectedJourneyId));
      if (match) {
        setSelectedJourney(match);
      } else {
        // Fetch directly from backend if not in provided list
        getJourney(selectedJourneyId)
          .then((j) => setSelectedJourney(j))
          .catch((e) => console.warn('Could not fetch journey by ID:', e));
      }
    }
  }, [selectedJourneyId, journeys]);

  // Fetch full details when a journey is inspected
  useEffect(() => {
    async function fetchJourneyDetails() {
      if (!selectedJourney) return;
      try {
        setLoadingDetail(true);
        const [gpsPoints, issuesList, framesList] = await Promise.all([
          getJourneyGps(selectedJourney.id).catch(() => []),
          listIssues(selectedJourney.id).catch(() => []),
          getJourneyFrames(selectedJourney.id).catch(() => [])
        ]);
        setJourneyGps(gpsPoints || []);
        setJourneyIssues(issuesList || []);
        setJourneyFrames(framesList || []);
      } catch (err) {
        console.warn('Failed to load detailed journey records:', err);
      } finally {
        setLoadingDetail(false);
      }
    }

    fetchJourneyDetails();
  }, [selectedJourney]);

  // Compute stats
  const pathCoords = journeyGps
    .filter((g) => g && g.latitude && g.longitude)
    .map((g) => [g.latitude, g.longitude]);

  // Calculate duration
  function getDurationText(start, stop) {
    if (!start) return 'Unavailable';
    const s = new Date(start);
    const e = stop ? new Date(stop) : new Date();
    const diffSec = Math.max(0, Math.floor((e - s) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      return `${hours}h ${mins % 60}m`;
    }
    return `${mins}m ${secs}s`;
  }

  // Format distance
  function formatDistance(meters) {
    if (meters == null || isNaN(meters)) return 'Unavailable';
    if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
    return `${meters.toFixed(0)} m`;
  }

  // Generate and download PDF Journey Report
  function handleDownloadPdf() {
    if (!selectedJourney) return;

    try {
      const doc = new jsPDF();
      const margin = 16;
      let y = 20;

      // Header Banner
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 36, 'F');

      doc.setFontSize(18);
      doc.setTextColor(0, 245, 160);
      doc.setFont('helvetica', 'bold');
      doc.text('ROADGUARD AI — INSPECTION JOURNEY REPORT', margin, 18);

      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.text(`Official Autonomous Road Condition & Defect Audit • Journey #${selectedJourney.id}`, margin, 26);

      y = 46;

      // Notice Box: SIMULATED DEMONSTRATION
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(245, 158, 11);
      doc.rect(margin, y, 178, 14, 'FD');
      doc.setFontSize(9);
      doc.setTextColor(180, 83, 9);
      doc.setFont('helvetica', 'bold');
      doc.text('SIMULATED DEMONSTRATION — NOT SUBMITTED TO ANY GOVERNMENT AUTHORITY', margin + 4, y + 9);

      y += 24;

      // Journey Metadata Table
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text('1. Journey Overview & Telemetry Summary', margin, y);
      y += 8;

      const duration = getDurationText(selectedJourney.startedAt, selectedJourney.stoppedAt);
      const distance = formatDistance(selectedJourney.distanceMeters);

      const metadata = [
        ['Journey UUID:', selectedJourney.uuid || 'N/A'],
        ['Status:', selectedJourney.status || 'STOPPED'],
        ['Vehicle Mode:', selectedJourney.vehicleType || 'CAR'],
        ['Operator / Driver:', selectedJourney.riderName || 'Anonymous Citizen'],
        ['Departure Time:', selectedJourney.startedAt ? new Date(selectedJourney.startedAt).toLocaleString() : 'Unavailable'],
        ['Arrival Time:', selectedJourney.stoppedAt ? new Date(selectedJourney.stoppedAt).toLocaleString() : 'In Progress'],
        ['Total Duration:', duration],
        ['Recorded Distance:', distance],
        ['GPS Fixes Collected:', `${journeyGps.length} points`],
        ['Evidence Frames Analyzed:', `${selectedJourney.totalFrames || journeyFrames.length} frames`],
        ['Confirmed Road Defects:', `${journeyIssues.length} defects`]
      ];

      doc.setFontSize(10);
      metadata.forEach(([key, val]) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(key, margin, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(String(val), margin + 55, y);
        y += 6;
      });

      y += 8;

      // Defect Audit Table
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(`2. Confirmed Road Defects Log (${journeyIssues.length})`, margin, y);
      y += 8;

      if (journeyIssues.length === 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 116, 139);
        doc.text('No verified road defects detected during this inspection journey.', margin, y);
        y += 10;
      } else {
        // Table Header
        doc.setFillColor(241, 245, 249);
        doc.rect(margin, y, 178, 8, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(51, 65, 85);
        doc.text('ID', margin + 2, y + 5.5);
        doc.text('Class', margin + 14, y + 5.5);
        doc.text('Confidence', margin + 56, y + 5.5);
        doc.text('Jurisdiction', margin + 86, y + 5.5);
        doc.text('Coordinates', margin + 120, y + 5.5);
        y += 9;

        doc.setFont('helvetica', 'normal');
        journeyIssues.forEach((iss) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.text(`#${iss.id}`, margin + 2, y + 5);
          doc.text(iss.defectClass?.replace('_', ' ') || 'DEFECT', margin + 14, y + 5);
          doc.text(`${((iss.confidenceScore || 0.85) * 100).toFixed(0)}%`, margin + 56, y + 5);
          doc.text(iss.authorityCode || 'NHAI', margin + 86, y + 5);
          doc.text(`${iss.latitude.toFixed(4)}°N, ${iss.longitude.toFixed(4)}°E`, margin + 120, y + 5);
          y += 7;
        });
      }

      // Footer
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('Generated autonomously by RoadGuard AI • Microsoft ONNX Runtime YOLO11s • OpenStreetMap', margin, pageHeight - 10);

      doc.save(`RoadGuard_Journey_Report_${selectedJourney.id}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Could not export PDF report: ' + err.message);
    }
  }

  // View: Detailed Single Journey Report
  if (selectedJourney) {
    const isCompleted = selectedJourney.status === 'STOPPED';
    const duration = getDurationText(selectedJourney.startedAt, selectedJourney.stoppedAt);
    const distance = formatDistance(selectedJourney.distanceMeters);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Navigation & Header Bar */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: 'rgba(15, 23, 42, 0.6)',
          padding: '12px 18px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setSelectedJourney(null)}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              <ArrowLeft size={14} /> Back to Reports
            </button>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Inspection Journey #{selectedJourney.id} Report
              </h2>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                UUID: {selectedJourney.uuid} • {new Date(selectedJourney.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleDownloadPdf}
              className="btn-primary"
              style={{ padding: '8px 14px', fontSize: '12px' }}
            >
              <Download size={14} /> Download PDF Report
            </button>
          </div>
        </div>

        {/* Regulatory Watermark */}
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: '8px',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '11px',
          color: '#fbbf24'
        }}>
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <span>SIMULATED DEMONSTRATION — NOT SUBMITTED TO ANY GOVERNMENT AUTHORITY</span>
        </div>

        {/* Top Metric Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px'
        }}>
          <div className="glass-card" style={{ padding: '14px', borderRadius: '10px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>RECORDED DISTANCE</span>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#00f5a0', marginTop: '4px' }}>
              {distance}
            </div>
            <span style={{ fontSize: '10px', color: '#64748b' }}>Geodesic GPS Haversine</span>
          </div>

          <div className="glass-card" style={{ padding: '14px', borderRadius: '10px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>JOURNEY DURATION</span>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
              {duration}
            </div>
            <span style={{ fontSize: '10px', color: '#64748b' }}>Active Tracking Time</span>
          </div>

          <div className="glass-card" style={{ padding: '14px', borderRadius: '10px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>CONFIRMED DEFECTS</span>
            <div style={{ fontSize: '18px', fontWeight: 800, color: journeyIssues.length > 0 ? '#ff3366' : '#94a3b8', marginTop: '4px' }}>
              {journeyIssues.length}
            </div>
            <span style={{ fontSize: '10px', color: '#64748b' }}>Spatial Clustered (15m)</span>
          </div>

          <div className="glass-card" style={{ padding: '14px', borderRadius: '10px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>EVIDENCE FRAMES</span>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#a855f7', marginTop: '4px' }}>
              {selectedJourney.totalFrames || journeyFrames.length}
            </div>
            <span style={{ fontSize: '10px', color: '#64748b' }}>ONNX Processed</span>
          </div>
        </div>

        {/* Map View Section: 2D vs 3D MapLibre Toggle */}
        <div className="glass-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: '12px' }}>
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={15} color="#00f5a0" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                Recorded Route & Geospatial Inspection Trail
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                ({pathCoords.length} GPS trace points)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => setActiveMapMode('2D')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: activeMapMode === '2D' ? 'rgba(0, 245, 160, 0.2)' : 'transparent',
                  color: activeMapMode === '2D' ? '#00f5a0' : '#94a3b8',
                  border: `1px solid ${activeMapMode === '2D' ? '#00f5a0' : 'rgba(255, 255, 255, 0.1)'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Layers size={13} /> 2D Leaflet View
              </button>
              <button
                onClick={() => setActiveMapMode('3D')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: activeMapMode === '3D' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  color: activeMapMode === '3D' ? '#38bdf8' : '#94a3b8',
                  border: `1px solid ${activeMapMode === '3D' ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Box size={13} /> 3D MapLibre (WebGL)
              </button>
            </div>
          </div>

          <div style={{ height: '380px', width: '100%', position: 'relative' }}>
            {pathCoords.length === 0 ? (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                fontSize: '13px'
              }}>
                No GPS route coordinates recorded for this journey.
              </div>
            ) : activeMapMode === '3D' ? (
              <MapLibre3DViewer pathCoords={pathCoords} issuePoints={journeyIssues} />
            ) : (
              <MapContainer
                center={pathCoords[0]}
                zoom={14}
                style={{ width: '100%', height: '100%', background: '#090e17' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maxZoom={19}
                />

                {/* Polyline Route */}
                <Polyline
                  positions={pathCoords}
                  pathOptions={{ color: '#00f5a0', weight: 5, opacity: 0.9 }}
                />

                {/* Departure Marker */}
                <Marker position={pathCoords[0]} icon={REPORT_ICONS.START}>
                  <Popup>
                    <div style={{ fontSize: '12px', padding: '4px' }}>
                      <strong style={{ color: '#10b981' }}>Departure Point</strong>
                      <p style={{ margin: '2px 0 0', color: '#64748b' }}>
                        {pathCoords[0][0].toFixed(5)}°N, {pathCoords[0][1].toFixed(5)}°E
                      </p>
                    </div>
                  </Popup>
                </Marker>

                {/* Concluded Marker */}
                {pathCoords.length > 1 && (
                  <Marker position={pathCoords[pathCoords.length - 1]} icon={REPORT_ICONS.END}>
                    <Popup>
                      <div style={{ fontSize: '12px', padding: '4px' }}>
                        <strong style={{ color: '#ef4444' }}>Concluded Point</strong>
                        <p style={{ margin: '2px 0 0', color: '#64748b' }}>
                          {pathCoords[pathCoords.length - 1][0].toFixed(5)}°N, {pathCoords[pathCoords.length - 1][1].toFixed(5)}°E
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Road Issues */}
                {journeyIssues.map((iss) => (
                  <Marker
                    key={iss.id}
                    position={[iss.latitude, iss.longitude]}
                    icon={iss.defectClass === 'POTHOLE' ? REPORT_ICONS.POTHOLE : REPORT_ICONS.CRACK}
                  >
                    <Popup>
                      <div style={{ fontSize: '12px', padding: '4px', minWidth: '160px' }}>
                        <strong style={{ color: iss.defectClass === 'POTHOLE' ? '#ff3366' : '#f59e0b' }}>
                          {iss.defectClass?.replace('_', ' ')}
                        </strong>
                        <div style={{ color: '#64748b', margin: '4px 0' }}>
                          Confidence: {((iss.confidenceScore || 0.85) * 100).toFixed(0)}%
                        </div>
                        <div style={{ color: '#334155', fontSize: '11px' }}>
                          Authority: {iss.authorityCode || 'NHAI'}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </div>
        </div>

        {/* Bottom Split: Defect Timeline / Audit Table & Evidence Frames Thumbnails */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '16px'
        }}>
          {/* Defect Audit Log */}
          <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Confirmed Defect Audit Log ({journeyIssues.length})
            </h3>
            {journeyIssues.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                Zero defects logged during this journey run.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                {journeyIssues.map((iss) => (
                  <div
                    key={iss.id}
                    style={{
                      background: '#090d16',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          color: iss.defectClass === 'POTHOLE' ? '#ff3366' : '#f59e0b',
                          fontWeight: 700,
                          fontSize: '12px'
                        }}>
                          {iss.defectClass?.replace(/_/g, ' ')}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>#{iss.id}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        {iss.roadName || 'Public Road'} • {iss.latitude.toFixed(4)}°N, {iss.longitude.toFixed(4)}°E
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', color: '#00f5a0', fontWeight: 600 }}>
                        {((iss.confidenceScore || 0.85) * 100).toFixed(0)}% Conf
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Captured Evidence Gallery */}
          <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Captured Evidence Frames ({journeyFrames.length})
            </h3>
            {journeyFrames.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                No photographic frames captured during this session.
              </p>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                gap: '8px',
                maxHeight: '320px',
                overflowY: 'auto'
              }}>
                {journeyFrames.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedImage(f.storageUrl)}
                    style={{
                      height: '75px',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      background: '#090d16',
                      cursor: 'pointer',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      position: 'relative'
                    }}
                  >
                    <img
                      src={f.storageUrl}
                      alt={`Frame #${f.frameSequence}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: '2px',
                      left: '4px',
                      fontSize: '9px',
                      color: '#cbd5e1',
                      background: 'rgba(0, 0, 0, 0.7)',
                      padding: '1px 3px',
                      borderRadius: '2px'
                    }}>
                      #{f.frameSequence}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal: High-Resolution Evidence Frame */}
        {selectedImage && (
          <div
            onClick={() => setSelectedImage(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 3000,
              backgroundColor: 'rgba(4, 8, 16, 0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
          >
            <div style={{ maxWidth: '800px', width: '100%', position: 'relative' }}>
              <img
                src={selectedImage}
                alt="Enlarged evidence frame"
                style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px' }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // View: Main List of Completed Journey Reports
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            Journey Reports & Geospatial Audits ({journeys.length})
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>
            Comprehensive inspection dossiers, 2D/3D route playback, defect logs, and downloadable PDF reports.
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="btn-secondary"
          style={{ padding: '8px 14px', fontSize: '12px' }}
        >
          <RefreshCw size={14} /> Refresh Reports
        </button>
      </div>

      {/* Reports Grid */}
      {journeys.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
          <FileBarChart size={44} color="#38bdf8" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ color: '#f8fafc', margin: '0 0 6px', fontSize: '16px' }}>No journeys logged yet</h3>
          <p style={{ fontSize: '13px', maxWidth: '420px', margin: '0 auto' }}>
            Start a Drive Mode session on the Live Monitoring page. Completed journeys automatically generate detailed reports here.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '16px'
        }}>
          {journeys.map((j) => {
            const isCompleted = j.status === 'STOPPED';
            const duration = getDurationText(j.startedAt, j.stoppedAt);
            const distance = formatDistance(j.distanceMeters);

            return (
              <div
                key={j.id}
                className="glass-card"
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                {/* Top Badge & ID */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      color: '#00f5a0',
                      fontSize: '14px'
                    }}>
                      #{j.id}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 700,
                      background: isCompleted ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 245, 160, 0.15)',
                      color: isCompleted ? '#94a3b8' : '#00f5a0'
                    }}>
                      {j.status}
                    </span>
                  </div>

                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {j.vehicleType}
                  </span>
                </div>

                {/* Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '10px' }}>DISTANCE</span>
                    <div style={{ fontWeight: 700, color: '#f8fafc' }}>{distance}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '10px' }}>DURATION</span>
                    <div style={{ fontWeight: 700, color: '#f8fafc' }}>{duration}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '10px' }}>FRAMES ANALYZED</span>
                    <div style={{ fontWeight: 700, color: '#f8fafc' }}>{j.totalFrames} frames</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '10px' }}>CONFIRMED DEFECTS</span>
                    <div style={{ fontWeight: 700, color: j.issueCount > 0 ? '#ff3366' : '#94a3b8' }}>
                      {j.issueCount} defects
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} />
                  <span>{new Date(j.createdAt).toLocaleString()}</span>
                </div>

                {/* View Details Action */}
                <button
                  onClick={() => setSelectedJourney(j)}
                  className="btn-primary"
                  style={{
                    fontSize: '12px',
                    padding: '8px 14px',
                    width: '100%',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Eye size={14} /> Open Journey Report (2D/3D)
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
