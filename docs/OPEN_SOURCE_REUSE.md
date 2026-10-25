# Open-Source Component Analysis, Licensing & Reuse Strategy

**Document Version**: 1.0.0  
**Date**: October 24, 2026  
**Auditor**: Senior Software Engineer & IP Compliance Auditor  
**Project**: RoadGuard AI (`C:\Users\LOKESH\java project 2026`)

---

## 1. Inventory & License Audit

| Repository / Project | License | Source / Upstream | Role in RoadGuard AI | Compliance Obligations |
|---|---|---|---|---|
| **Pothole Reporter** | **MIT License** | `https://github.com/coding-parrot/pothole-reporter` (Gaurav Sen) | Conceptual pattern for assisted complaint drafting, refusing to guess unknown authorities, foreground drive safety. | Retain copyright notice and MIT permission notice. |
| **Leaflet** | **BSD 2-Clause** | `https://github.com/Leaflet/Leaflet` | Primary 2D mapping engine (`react-leaflet`). Live marker, accuracy halo, route polyline. | Retain BSD copyright notice; display OSM attribution (`© OpenStreetMap contributors`). |
| **MapLibre GL JS** | **BSD 3-Clause** | `https://github.com/maplibre/maplibre-gl-js` | Lightweight 3D hardware-accelerated route and defect inspection in Journey Reports. | Retain BSD 3-Clause notice and disclaimers. |
| **OSRM** | **BSD 2-Clause** | `https://github.com/Project-OSRM/osrm-backend` | Open Source Routing Machine concepts for road network snapping and trajectory evaluation. | Attribution required if OSRM hosted endpoints are queried. Respect usage policy. |
| **Nominatim** | **GPLv2** | `https://github.com/osm-search/Nominatim` | Reverse geocoding for converting latitude/longitude coordinates into road names and districts. | Client querying public API must respect 1 req/sec rate limit, valid User-Agent, and OSM attribution. |
| **YOLO11s Model** | **AGPL-3.0** | `Kodjaoglanian/pavimentos-yolo11s` (Hugging Face) | Pretrained road defect detection model running in Microsoft ONNX Runtime Java. | Network copyleft applies: if offered as network service, corresponding source must be made available. |

---

## 2. Component Adaptation & Reuse Decisions

### A. Pothole Reporter (`coding-parrot/pothole-reporter`)
- **Analyzed Capabilities**:
  - Refusal to fabricate authorities: refuses to route when jurisdiction or municipal boundary is unknown.
  - Assisted user-controlled complaint action: compiles exact location, defect photo, probable contract, and opens user's email client or handoff draft.
  - Driver safety policy: instructions that phone must be securely mounted, journey started before vehicle moves, and reviews conducted while stationary.
- **Components Adapted for RoadGuard AI**:
  1. *Refusal to Guess Policy*: When a road cannot be verified against NHAI, AP CDMA, or AP R&B, RoadGuard displays `Authority not verified` and prompts user to assign jurisdiction.
  2. *Assisted Complaint Packet*: Implemented in `GrievanceModal.jsx` and `ComplaintReviewView.jsx` — bundles evidence, exact coordinates, and links to the verified official portal for user-confirmed filing.
  3. *Foreground Drive Mode Notice*: Explicit user notice on the live camera viewfinder regarding browser background throttling.

### B. Leaflet & OpenStreetMap (`Leaflet/Leaflet`)
- **Analyzed Capabilities**: Lightweight 2D web mapping with high tile-rendering performance.
- **Components Adapted for RoadGuard AI**:
  - `MapViewer.jsx`: Leaflet `MapContainer`, `TileLayer` using `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.
  - Custom SVG/divIcon markers for Start ('S'), End ('E'), current location with radar ripple, and color-coded defect pins.
  - Progressive `Polyline` trace of accepted GPS coordinates.
  - Geodesic noise filtering: ignores stationary jitter (<2m) and implausible spikes (>500m).

### C. MapLibre GL JS (`maplibre/maplibre-gl-js`)
- **Analyzed Capabilities**: Hardware-accelerated WebGL vector map rendering with camera pitch, tilt, and bearing control.
- **Components Adapted for RoadGuard AI**:
  - `JourneyReportsView.jsx`: Optional 3D perspective toggle (60° pitch, 30° bearing) with seamless fallback to 2D Leaflet if WebGL hardware acceleration is unavailable.

### D. Nominatim & Reverse Geocoding
- **Analyzed Capabilities**: Converting coordinates to human-readable street addresses.
- **Components Adapted for RoadGuard AI**:
  - In `JourneyService.java` and frontend `api.js`: reverse geocoding cache to prevent redundant external queries, respecting OSM 1 request/second usage limit, and falling back to coordinate pairs when offline.

---

## 3. License Compliance Notices

```text
Portions of this software are based on or inspired by:

Pothole Reporter
Copyright (c) 2026 Gaurav Sen
Licensed under the MIT License.

Leaflet
Copyright (c) 2010-2024, Vladimir Agafonkin
Copyright (c) 2010-2011, CloudMade
Licensed under the BSD 2-Clause License.

MapLibre GL JS
Copyright (c) 2020-2024, MapLibre contributors
Licensed under the BSD 3-Clause License.

Ultralytics YOLO11s Pavimentos
Copyright (c) 2024 Ultralytics / Kodjaoglanian
Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).
```
