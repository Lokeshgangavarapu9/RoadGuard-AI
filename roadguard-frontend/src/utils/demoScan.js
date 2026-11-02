/**
 * RoadGuard AI — Interactive 30-Second Civic Demo Scan Simulator
 *
 * Provides a self-contained, interactive 30-second simulation of road scanning
 * along the NH-65 corridor in Vijayawada, Andhra Pradesh.
 *
 * Demonstrates:
 * 1. Dashcam synthesis with moving asphalt texture and road markings
 * 2. Real-time bounding box projection for detected road hazards
 * 3. Live GPS trail updates along Benz Circle -> Bandar Road corridor
 * 4. Sample pothole detections with civic confidence scores
 * 5. Complete trip dossier and pre-filled citizen complaint draft
 *
 * Isolation guarantee:
 * - Real user database records and official complaints are never polluted.
 * - Demo markers are clearly tagged with isDemo = true.
 */

export const DEMO_TRACK_COORDINATES = [
  { lat: 16.5012, lon: 80.6415, speed: 8.5, heading: 42, label: 'Near Benz Circle South' },
  { lat: 16.5036, lon: 80.6443, speed: 10.2, heading: 45, label: 'Approaching Benz Circle' },
  { lat: 16.5062, lon: 80.6480, speed: 9.8, heading: 48, label: 'Benz Circle Junction (NH-65)' },
  { lat: 16.5088, lon: 80.6518, speed: 11.0, heading: 52, label: 'MG Road / Bandar Road' },
  { lat: 16.5115, lon: 80.6555, speed: 10.5, heading: 50, label: 'Near Siddhartha College' },
  { lat: 16.5142, lon: 80.6598, speed: 11.2, heading: 55, label: 'DV Manor Cross Road' },
  { lat: 16.5170, lon: 80.6635, speed: 11.8, heading: 58, label: 'Auto Nagar Approach' },
  { lat: 16.5198, lon: 80.6672, speed: 10.4, heading: 54, label: 'Kanuru Outer Link' },
  { lat: 16.5225, lon: 80.6710, speed: 9.6, heading: 50, label: 'NH-65 Vijayawada East Bypass' }
];

export const DEMO_SAMPLE_DEFECTS = [
  {
    id: 'DEMO-DEFECT-1',
    defectClass: 'POTHOLE',
    severity: 'HIGH',
    confidenceScore: 0.924,
    latitude: 16.5062,
    longitude: 80.6480,
    roadName: 'NH-65, Benz Circle Junction, Vijayawada',
    district: 'NTR District / Vijayawada Municipal Corporation',
    detectedAt: new Date(Date.now() - 22000).toISOString(),
    isDemo: true,
    locationSource: 'BROWSER_GPS',
    box: { x1: 0.38, y1: 0.55, x2: 0.62, y2: 0.78 },
    potholeDimensions: '65cm × 45cm · Est. depth 7.5cm',
    jurisdiction: 'VMC / NHAI Regional Office Vijayawada',
    portal: 'AP CDMA Puramithra / NHAI Rajmargyatra'
  },
  {
    id: 'DEMO-DEFECT-2',
    defectClass: 'ALLIGATOR_CRACK',
    severity: 'MEDIUM',
    confidenceScore: 0.881,
    latitude: 16.5142,
    longitude: 80.6598,
    roadName: 'Bandar Road, Near DV Manor Cross, Vijayawada',
    district: 'NTR District / Vijayawada',
    detectedAt: new Date(Date.now() - 10000).toISOString(),
    isDemo: true,
    locationSource: 'BROWSER_GPS',
    box: { x1: 0.22, y1: 0.62, x2: 0.48, y2: 0.84 },
    potholeDimensions: '120cm × 80cm surface fatigue cracking',
    jurisdiction: 'AP Roads & Buildings (R&B) Department',
    portal: 'AP Mee Kosam (1902)'
  }
];

export const DEMO_SAMPLE_JOURNEY = {
  id: 'DEMO-TRIP-BENZ-CIRCLE',
  vehicleType: 'CAR',
  startTime: new Date(Date.now() - 30000).toISOString(),
  endTime: new Date().toISOString(),
  distanceMeters: 1420,
  durationSeconds: 30,
  potholesCount: 2,
  defectsCount: 2,
  isDemo: true,
  status: 'COMPLETED',
  routeName: 'NH-65 Benz Circle to Bandar Road (Demo Drive)',
  pointsCount: DEMO_TRACK_COORDINATES.length
};

export const DEMO_SAMPLE_COMPLAINT = {
  id: 'DEMO-COMPLAINT-2026',
  trackingNumber: 'DEMO-VMC-2026-9041',
  portalName: 'AP CDMA Puramithra (Municipal Corporation)',
  portalId: 'ap-puramithra',
  tollFree: '14420 / 1902',
  status: 'SIMULATED',
  officialRefId: null,
  submittedAt: new Date().toISOString(),
  roadName: 'NH-65, Benz Circle Junction, Vijayawada',
  jurisdiction: 'Vijayawada Municipal Corporation (Zone II)',
  defectSummary: 'Severe pothole (65cm × 45cm) near pedestrian crosswalk causing vehicle deceleration and two-wheeler skid hazard.',
  evidencePhotos: 1,
  citizenHandoffNotes: 'Stage A Prototype Simulation. To submit for real repairs, open the official portal and verify with your mobile OTP.'
};

/**
 * Generates an animated road canvas frame with realistic asphalt, lane markers, and dashboard HUD.
 * Returns a data URL.
 */
export function generateDemoRoadFrame(step = 0, defect = null) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Sky / Horizon gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 150);
  skyGrad.addColorStop(0, '#38BDF8');
  skyGrad.addColorStop(0.5, '#BAE6FD');
  skyGrad.addColorStop(1, '#E2E8F0');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 640, 150);

  // Distant buildings & road horizon
  ctx.fillStyle = '#94A3B8';
  ctx.fillRect(0, 140, 640, 15);
  ctx.fillStyle = '#64748B';
  ctx.fillRect(120, 125, 45, 25);
  ctx.fillRect(180, 115, 60, 35);
  ctx.fillRect(420, 120, 50, 30);
  ctx.fillRect(485, 110, 75, 40);

  // Asphalt road surface with perspective trapezoid
  ctx.beginPath();
  ctx.moveTo(270, 150);
  ctx.lineTo(370, 150);
  ctx.lineTo(640, 360);
  ctx.lineTo(0, 360);
  ctx.closePath();
  ctx.fillStyle = '#334155';
  ctx.fill();

  // Road shoulders / curbs
  ctx.fillStyle = '#CBD5E1';
  ctx.beginPath();
  ctx.moveTo(260, 150);
  ctx.lineTo(270, 150);
  ctx.lineTo(0, 360);
  ctx.lineTo(-20, 360);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(370, 150);
  ctx.lineTo(380, 150);
  ctx.lineTo(660, 360);
  ctx.lineTo(640, 360);
  ctx.closePath();
  ctx.fill();

  // Center dashed lane markings with animation offset
  ctx.strokeStyle = '#FCD34D'; // Yellow highway centerline
  ctx.lineWidth = 6;
  const offset = (step * 18) % 60;
  for (let y = 160 + offset; y < 360; y += 45) {
    const factor = (y - 150) / 210;
    const x = 320;
    const length = 18 * factor;
    ctx.lineWidth = 3 + factor * 6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + length);
    ctx.stroke();
  }

  // Draw simulated pothole defect if one is active in this frame
  if (defect) {
    const bx = defect.box.x1 * 640;
    const by = defect.box.y1 * 360;
    const bw = (defect.box.x2 - defect.box.x1) * 640;
    const bh = (defect.box.y2 - defect.box.y1) * 360;

    // Dark cracked cavity in asphalt
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.ellipse(bx + bw / 2, by + bh / 2, bw * 0.45, bh * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Jagged crater rim
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Bounding Box (Civic Teal / Amber)
    ctx.strokeStyle = '#0D9488';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(bx, by, bw, bh);

    // Box label banner
    ctx.fillStyle = '#0D9488';
    ctx.fillRect(bx, by - 22, bw, 22);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px "Outfit", sans-serif';
    ctx.fillText(`${defect.defectClass} ${(defect.confidenceScore * 100).toFixed(0)}%`, bx + 6, by - 6);
  }

  // Demo watermark & telemetry HUD on frame
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.fillRect(10, 10, 260, 48);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.strokeRect(10, 10, 260, 48);

  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  ctx.fillText('ROADGUARD AI · 30S DEMO SCAN', 20, 28);
  ctx.fillStyle = '#94A3B8';
  ctx.font = '10px "Inter", sans-serif';
  ctx.fillText('NH-65 Vijayawada · Simulated Dashcam', 20, 46);

  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Controller for running an interactive 30-second Demo Scan Session.
 */
export function startDemoScanSession({ onTick, onDetection, onComplete }) {
  let step = 0;
  const maxSteps = 30; // 30 seconds at 1-second ticks
  let isCancelled = false;

  const intervalId = setInterval(() => {
    if (isCancelled) {
      clearInterval(intervalId);
      return;
    }

    step += 1;
    const coordIndex = Math.min(
      Math.floor((step / maxSteps) * DEMO_TRACK_COORDINATES.length),
      DEMO_TRACK_COORDINATES.length - 1
    );
    const coord = DEMO_TRACK_COORDINATES[coordIndex];

    let currentDefect = null;
    // Trigger Defect 1 at 8-12 seconds
    if (step >= 8 && step <= 14) {
      currentDefect = DEMO_SAMPLE_DEFECTS[0];
    }
    // Trigger Defect 2 at 20-25 seconds
    else if (step >= 20 && step <= 25) {
      currentDefect = DEMO_SAMPLE_DEFECTS[1];
    }

    const frameUrl = generateDemoRoadFrame(step, currentDefect);

    const gpsPoint = {
      lat: coord.lat,
      lon: coord.lon,
      speed: coord.speed,
      heading: coord.heading,
      accuracy: 6.5,
      isApproximate: false,
      isDemo: true,
      timestamp: Date.now()
    };

    onTick?.({
      secondsRemaining: maxSteps - step,
      elapsedSeconds: step,
      gpsPoint,
      frameUrl,
      currentDefect,
      progressPercent: Math.round((step / maxSteps) * 100)
    });

    // Notify new detection once when entering detection window
    if (step === 8) {
      onDetection?.(DEMO_SAMPLE_DEFECTS[0]);
    } else if (step === 20) {
      onDetection?.(DEMO_SAMPLE_DEFECTS[1]);
    }

    if (step >= maxSteps) {
      clearInterval(intervalId);
      onComplete?.({
        journey: DEMO_SAMPLE_JOURNEY,
        defects: DEMO_SAMPLE_DEFECTS,
        complaint: DEMO_SAMPLE_COMPLAINT
      });
    }
  }, 1000);

  return () => {
    isCancelled = true;
    clearInterval(intervalId);
  };
}

