import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  AlertTriangle,
  FileText,
  Crosshair,
  RefreshCw,
  Clock
} from 'lucide-react';
import { isValidCoordinate, isFixStale, calculateFixAgeSeconds } from '../utils/geoUtils';

// Custom Map Marker Generator
function createMarkerIcon(color, pulse = false, innerSymbol = '') {
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="
        position: relative;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        ${pulse ? `<div style="
          position: absolute;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: ${color};
          opacity: 0.35;
          animation: pulse-ring 2s infinite;
        "></div>` : ''}
        <div style="
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: ${color};
          border: 3px solid #ffffff;
          box-shadow: 0 0 12px ${color};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 800;
          color: #04121d;
        ">
          ${innerSymbol}
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

// Directional Heading Vehicle Marker (supports live and stale states)
function createVehicleMarkerIcon(heading = null, isStale = false) {
  const hasHeading = heading != null && !isNaN(heading);
  const color = isStale ? '#f59e0b' : '#00f5a0';
  const pulseRgba = isStale ? 'rgba(245, 158, 11, 0.3)' : 'rgba(0, 245, 160, 0.25)';

  return L.divIcon({
    className: 'custom-vehicle-marker',
    html: `
      <div style="
        position: relative;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(${hasHeading ? heading : 0}deg);
        transition: transform 0.3s ease;
      ">
        <div style="
          position: absolute;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: ${pulseRgba};
          animation: pulse-ring 2.5s infinite;
        "></div>
        <div style="
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: ${color};
          border: 3px solid #ffffff;
          box-shadow: 0 0 14px ${color};
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          ${hasHeading ? `
            <div style="
              width: 0;
              height: 0;
              border-left: 4px solid transparent;
              border-right: 4px solid transparent;
              border-bottom: 8px solid #04121d;
              margin-bottom: 2px;
            "></div>
          ` : `
            <div style="width: 6px; height: 6px; border-radius: 50%; background: #04121d;"></div>
          `}
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

const ICONS = {
  POTHOLE: createMarkerIcon('#ff3366', true),
  ALLIGATOR_CRACK: createMarkerIcon('#ffb703', false),
  ROAD_CRACK: createMarkerIcon('#ffb703', false),
  TRANSVERSE_CRACK: createMarkerIcon('#ff9f1c', false),
  WATERLOGGING: createMarkerIcon('#00b4d8', false),
  START: createMarkerIcon('#10b981', false, 'S'),
  END: createMarkerIcon('#ef4444', false, 'E'),
  MANUAL: createMarkerIcon('#38bdf8', true, '📍'),
  DEFAULT: createMarkerIcon('#94a3b8', false),
};

// Map Recenter & Auto-Follow Handler
function MapController({ center, autoFollow, onUserPan, shouldFollow }) {
  const map = useMap();

  useEffect(() => {
    function handleDragStart() {
      if (onUserPan) onUserPan();
    }
    map.on('dragstart', handleDragStart);
    return () => map.off('dragstart', handleDragStart);
  }, [map, onUserPan]);

  useEffect(() => {
    if (autoFollow && shouldFollow && center && center[0] && center[1]) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, autoFollow, shouldFollow, map]);

  return null;
}

// Map Click Handler for 3-tier Manual Pin Fallback
function MapClickHandler({ onManualPinSelect }) {
  useMapEvents({
    click(e) {
      if (onManualPinSelect && e?.latlng) {
        onManualPinSelect({
          lat: e.latlng.lat,
          lon: e.latlng.lng,
          timestamp: Date.now(),
          accuracy: 5.0,
          isManual: true
        });
      }
    }
  });
  return null;
}

export default function MapViewer({
  currentLocation,
  coarseLocation = null,
  isGpsEnabled = false,
  path = [],
  issues = [],
  onSelectIssue,
  isJourneyActive = false,
  gpsError = null,
  onRetryGps,
  manualLocation = null,
  onManualPinSelect = null,
  isManualMode = false
}) {
  const hasValidGps = isGpsEnabled && currentLocation && isValidCoordinate(currentLocation.lat, currentLocation.lon);
  const isStale = hasValidGps && isFixStale(currentLocation.timestamp, 20000);
  const fixAgeSec = hasValidGps ? calculateFixAgeSeconds(currentLocation.timestamp) : null;
  const hasValidCoarse = !hasValidGps && coarseLocation && isValidCoordinate(coarseLocation.lat, coarseLocation.lon);

  // Viewport center fallback (Corridor area), purely for map initialization
  const defaultCenter = [16.5062, 80.6480];
  const center = hasValidGps
    ? [currentLocation.lat, currentLocation.lon]
    : (manualLocation && isValidCoordinate(manualLocation.lat, manualLocation.lon)
      ? [manualLocation.lat, manualLocation.lon]
      : (hasValidCoarse
        ? [coarseLocation.lat, coarseLocation.lon]
        : defaultCenter));

  const [autoFollow, setAutoFollow] = useState(true);
  const [_tileError, setTileError] = useState(false);
  const mapRef = useRef(null);

  // Validate all coordinates in path
  const polylineCoords = path
    .filter((p) => {
      const lat = p?.latitude || p?.lat;
      const lon = p?.longitude || p?.lon;
      return isValidCoordinate(lat, lon);
    })
    .map((p) => [p.latitude || p.lat, p.longitude || p.lon]);

  const startPoint = polylineCoords.length > 0 ? polylineCoords[0] : null;
  const endPoint = !isJourneyActive && polylineCoords.length > 1 ? polylineCoords[polylineCoords.length - 1] : null;

  function handleRecenter() {
    setAutoFollow(true);
    if (hasValidGps && mapRef.current) {
      mapRef.current.setView([currentLocation.lat, currentLocation.lon], 16, { animate: true });
    } else if (manualLocation && isValidCoordinate(manualLocation.lat, manualLocation.lon) && mapRef.current) {
      mapRef.current.setView([manualLocation.lat, manualLocation.lon], 16, { animate: true });
    } else if (hasValidCoarse && mapRef.current) {
      mapRef.current.setView([coarseLocation.lat, coarseLocation.lon], 14, { animate: true });
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', borderRadius: 'inherit' }}>
      <MapContainer
        ref={mapRef}
        center={center}
        zoom={14}
        style={{ width: '100%', height: '100%', minHeight: '350px', background: '#090e17' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          eventHandlers={{
            tileerror: () => setTileError(true),
            load: () => setTileError(false)
          }}
        />

        <MapController
          center={center}
          autoFollow={autoFollow}
          shouldFollow={hasValidGps || (manualLocation && isValidCoordinate(manualLocation.lat, manualLocation.lon)) || hasValidCoarse}
          onUserPan={() => setAutoFollow(false)}
        />

        <MapClickHandler onManualPinSelect={onManualPinSelect} />

        {/* Manual Location Fallback Pin (when user clicks map) */}
        {manualLocation && isValidCoordinate(manualLocation.lat, manualLocation.lon) && (
          <Marker position={[manualLocation.lat, manualLocation.lon]} icon={ICONS.MANUAL}>
            <Popup>
              <div style={{ padding: '6px', fontSize: '12px' }}>
                <strong style={{ color: '#38bdf8' }}>Manual Location Pin (Fallback)</strong>
                <p style={{ margin: '4px 0 0', color: '#cbd5e1' }}>
                  {manualLocation.lat.toFixed(5)}°N, {manualLocation.lon.toFixed(5)}°E
                </p>
                <div style={{ marginTop: '4px', fontSize: '10px', color: '#94a3b8' }}>
                  Used for grievance lodging when GPS is unavailable.
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* GPS Breadcrumb Track Line */}
        {polylineCoords.length > 1 && (
          <Polyline
            positions={polylineCoords}
            pathOptions={{ color: '#00f5a0', weight: 5, opacity: 0.9, lineJoin: 'round' }}
          />
        )}

        {/* Journey Start Marker */}
        {startPoint && (
          <Marker position={startPoint} icon={ICONS.START}>
            <Popup>
              <div style={{ padding: '4px', fontSize: '12px' }}>
                <strong style={{ color: '#10b981' }}>Journey Departure Point</strong>
                <p style={{ margin: '4px 0 0', color: '#64748b' }}>
                  {startPoint[0].toFixed(5)}°N, {startPoint[1].toFixed(5)}°E
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Journey Final Destination Marker (when journey stopped) */}
        {endPoint && (
          <Marker position={endPoint} icon={ICONS.END}>
            <Popup>
              <div style={{ padding: '4px', fontSize: '12px' }}>
                <strong style={{ color: '#ef4444' }}>Journey Concluded Point</strong>
                <p style={{ margin: '4px 0 0', color: '#64748b' }}>
                  {endPoint[0].toFixed(5)}°N, {endPoint[1].toFixed(5)}°E
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* GPS Accuracy Circle (only rendered when GPS fix is valid) */}
        {hasValidGps && currentLocation.accuracy && currentLocation.accuracy > 0 && (
          <Circle
            center={[currentLocation.lat, currentLocation.lon]}
            radius={Math.min(currentLocation.accuracy, 300)}
            pathOptions={{
              color: isStale ? '#f59e0b' : (currentLocation.accuracy > 25 ? '#f59e0b' : '#00f5a0'),
              fillColor: isStale ? '#f59e0b' : (currentLocation.accuracy > 25 ? '#f59e0b' : '#00f5a0'),
              fillOpacity: isStale ? 0.08 : 0.15,
              weight: 1
            }}
          />
        )}

        {/* Current Vehicle Position Marker: ONLY rendered when a genuine GPS fix exists */}
        {hasValidGps && (
          <Marker
            position={[currentLocation.lat, currentLocation.lon]}
            icon={createVehicleMarkerIcon(currentLocation.heading, isStale)}
          >
            <Popup>
              <div style={{ padding: '6px', fontSize: '12px' }}>
                <strong style={{ color: isStale ? '#f59e0b' : '#00f5a0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {isStale && <Clock size={12} />}
                  {isStale ? `Stale GPS Position (${fixAgeSec}s ago)` : 'Live Device Position'}
                </strong>
                <div style={{ marginTop: '4px', color: '#cbd5e1' }}>
                  <div>Lat: {currentLocation.lat.toFixed(5)}° | Lon: {currentLocation.lon.toFixed(5)}°</div>
                  <div>Speed: {currentLocation.speed ? `${(currentLocation.speed * 3.6).toFixed(1)} km/h` : 'Stationary / 0 km/h'}</div>
                  {currentLocation.accuracy && (
                    <div style={{ color: currentLocation.accuracy > 25 ? '#f59e0b' : '#94a3b8' }}>
                      GPS Accuracy: &plusmn;{currentLocation.accuracy.toFixed(0)}m
                    </div>
                  )}
                  {isStale && (
                    <div style={{ marginTop: '4px', fontSize: '11px', color: '#f59e0b' }}>
                      Position has not updated recently.
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Coarse Location Region Indicator (Rendered when GPS accuracy > 50m, e.g. Wi-Fi / IP) */}
        {hasValidCoarse && (
          <>
            <Circle
              center={[coarseLocation.lat, coarseLocation.lon]}
              radius={Math.min(coarseLocation.accuracy || 200, 1000)}
              pathOptions={{
                color: '#f59e0b',
                fillColor: '#f59e0b',
                fillOpacity: 0.12,
                weight: 2,
                dashArray: '6, 8'
              }}
            />
            <Marker
              position={[coarseLocation.lat, coarseLocation.lon]}
              icon={createMarkerIcon('#f59e0b', false, '🌐')}
            >
              <Popup>
                <div style={{ padding: '6px', fontSize: '12px' }}>
                  <strong style={{ color: '#f59e0b' }}>Approximate Area (Coarse Fix)</strong>
                  <p style={{ margin: '4px 0 0', color: '#cbd5e1' }}>
                    Lat: {coarseLocation.lat.toFixed(4)}°, Lon: {coarseLocation.lon.toFixed(4)}°
                  </p>
                  <div style={{ marginTop: '4px', fontSize: '11px', color: '#fbbf24' }}>
                    Accuracy: &plusmn;{Math.round(coarseLocation.accuracy)}m (Wi-Fi/Cell Tower).
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '10px', color: '#94a3b8' }}>
                    Click anywhere on the map to place an exact manual pin for defect reporting.
                  </div>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Confirmed Road Defect Markers (validated coordinates only) */}
        {issues
          .filter((issue) => isValidCoordinate(issue.latitude, issue.longitude))
          .map((issue) => {
            const icon = ICONS[issue.defectClass] || ICONS.DEFAULT;
            const isPothole = issue.defectClass === 'POTHOLE';

            return (
              <Marker key={issue.id} position={[issue.latitude, issue.longitude]} icon={icon}>
                <Popup>
                  <div style={{ minWidth: '220px', padding: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{
                        background: isPothole ? 'rgba(255, 51, 102, 0.15)' : 'rgba(255, 183, 3, 0.15)',
                        color: isPothole ? '#ff3366' : '#ffb703',
                        fontWeight: 700,
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        textTransform: 'uppercase'
                      }}>
                        {issue.defectClass?.replace('_', ' ')}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        Conf: {((issue.confidenceScore || 0.85) * 100).toFixed(0)}%
                      </span>
                    </div>

                    <h4 style={{ margin: '0 0 6px', fontSize: '14px', color: '#0f172a' }}>
                      {issue.roadName || 'Public Road Defect'}
                    </h4>

                    <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#475569', lineHeight: 1.4 }}>
                      {issue.address || `${issue.latitude.toFixed(5)}°N, ${issue.longitude.toFixed(5)}°E`}
                    </p>

                    <div style={{
                      background: issue.dlpApplicable ? '#ecfdf5' : '#f1f5f9',
                      border: `1px solid ${issue.dlpApplicable ? '#a7f3d0' : '#cbd5e1'}`,
                      padding: '6px 8px',
                      borderRadius: '6px',
                      marginBottom: '10px',
                      fontSize: '11px'
                    }}>
                      {issue.dlpApplicable ? (
                        <span style={{ color: '#059669', fontWeight: 600 }}>
                          Active Contractor DLP Warranty
                        </span>
                      ) : (
                        <span style={{ color: '#334155' }}>
                          Authority: <strong>{issue.authorityCode || 'NHAI'}</strong>
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => onSelectIssue && onSelectIssue(issue)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: '#0f172a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <FileText size={14} /> File Grievance Letter
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>

      {/* Floating Recenter & Auto-Follow Button */}
      <div style={{
        position: 'absolute',
        bottom: '24px',
        right: '12px',
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <button
          onClick={handleRecenter}
          title={autoFollow ? 'Auto-follow active' : 'Recenter on my location'}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: autoFollow ? '#00f5a0' : '#0f172a',
            color: autoFollow ? '#04121d' : '#f8fafc',
            border: `2px solid ${autoFollow ? '#00f5a0' : 'rgba(255, 255, 255, 0.2)'}`,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <Crosshair size={20} />
        </button>
      </div>

      {/* GPS Error or Lock Timeout Banner */}
      {gpsError && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          right: '12px',
          zIndex: 500,
          background: 'rgba(15, 23, 42, 0.94)',
          border: '1px solid rgba(239, 68, 68, 0.5)',
          borderRadius: '8px',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#f8fafc',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
            <div>
              <span>{gpsError}</span>
              {hasValidGps && isStale && (
                <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '2px' }}>
                  Showing last valid fix from {fixAgeSec}s ago.
                </div>
              )}
            </div>
          </div>
          {onRetryGps && (
            <button
              onClick={onRetryGps}
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                color: '#ef4444',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0
              }}
            >
              <RefreshCw size={12} /> Retry
            </button>
          )}
        </div>
      )}

      {/* GPS Status Banner when not actively locked */}
      {!hasValidGps && !gpsError && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          zIndex: 500,
          background: 'rgba(15, 23, 42, 0.85)',
          border: `1px solid ${isGpsEnabled ? 'rgba(0, 245, 160, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
          borderRadius: '6px',
          padding: '4px 10px',
          fontSize: '11px',
          fontWeight: 600,
          color: '#cbd5e1',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isGpsEnabled ? '#38bdf8' : '#f59e0b' }} />
          <span>
            {isGpsEnabled
              ? 'Awaiting satellite fix • Default corridor viewport shown'
              : 'GPS Offline • Detection active with manual location mode'}
          </span>
        </div>
      )}

      {/* Poor Accuracy Warning Pill */}
      {hasValidGps && currentLocation.accuracy > 25 && !gpsError && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          zIndex: 500,
          background: isStale ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.15)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '6px',
          padding: '4px 10px',
          fontSize: '11px',
          fontWeight: 600,
          color: '#fbbf24',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          {isStale && <Clock size={12} />}
          <span>
            {isStale
              ? `Stale Fix (${fixAgeSec}s ago) • ±${currentLocation.accuracy.toFixed(0)}m`
              : `GPS Accuracy: ±${currentLocation.accuracy.toFixed(0)}m (Weak Satellite Fix)`}
          </span>
        </div>
      )}
    </div>
  );
}
