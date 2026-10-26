/**
 * Geospatial, Coordinate Validation, and Telemetry Utilities for RoadGuard AI
 */

/**
 * Validates that latitude and longitude are valid finite numbers within WGS84 bounds.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean}
 */
export function isValidCoordinate(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  return true;
}

/**
 * Calculates great-circle distance between two coordinates in meters (Haversine formula).
 */
export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return 0;
  }
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formats a coordinate pair into a human-readable string (e.g. "16.42501°N, 80.45122°E").
 */
export function formatCoordinate(lat, lon, precision = 5) {
  if (!isValidCoordinate(lat, lon)) return 'Unlocated (No GPS)';
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(precision)}°${latDir}, ${Math.abs(lon).toFixed(precision)}°${lonDir}`;
}

/**
 * Calculates the age of a GPS fix in seconds.
 */
export function calculateFixAgeSeconds(timestampMs) {
  if (!timestampMs || typeof timestampMs !== 'number') return null;
  const now = Date.now();
  const diffMs = Math.max(0, now - timestampMs);
  return Math.floor(diffMs / 1000);
}

/**
 * Determines whether a GPS position fix is stale.
 * A fix older than maxAgeMs (default 20 seconds) is considered stale.
 */
export function isFixStale(timestampMs, maxAgeMs = 20000) {
  if (!timestampMs || typeof timestampMs !== 'number') return true;
  return (Date.now() - timestampMs) > maxAgeMs;
}
