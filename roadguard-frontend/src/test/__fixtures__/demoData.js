// Test fixtures for offline UI / canvas unit testing
export const DEMO_TRACK = [
  { lat: 16.5062, lon: 80.6480, speed: 11.2, heading: 215, road: 'NH-16 Benz Circle Vijayawada', defect: null },
  { lat: 16.5020, lon: 80.6445, speed: 14.5, heading: 218, road: 'NH-16 Krishna River Bridge Approach', defect: null },
  { lat: 16.4975, lon: 80.6410, speed: 16.0, heading: 220, road: 'NH-16 Kanaka Durga Flyover merge', defect: 'POTHOLE', conf: 0.92, desc: 'Deep pothole (28cm dia, 7cm depth) in middle lane' },
  { lat: 16.4910, lon: 80.6355, speed: 17.5, heading: 222, road: 'NH-16 Undavalli Junction', defect: null },
  { lat: 16.4830, lon: 80.6280, speed: 18.2, heading: 225, road: 'NH-16 Tadepalli Bypass', defect: 'ALLIGATOR_CRACK', conf: 0.88, desc: 'Severe fatigue alligator cracking along wheel path' },
  { lat: 16.4740, lon: 80.6200, speed: 19.5, heading: 226, road: 'NH-16 Mangalagiri AIIMS Connector', defect: null },
  { lat: 16.4650, lon: 80.6120, speed: 19.0, heading: 228, road: 'NH-16 Mangalagiri Bypass', defect: 'POTHOLE', conf: 0.86, desc: 'Edge raveling and asphalt breakout' },
  { lat: 16.4550, lon: 80.6030, speed: 18.0, heading: 230, road: 'NH-16 Kaza Toll Plaza corridor', defect: null },
  { lat: 16.4420, lon: 80.5910, speed: 16.5, heading: 232, road: 'NH-16 Acharya Nagarjuna University', defect: 'TRANSVERSE_CRACK', conf: 0.84, desc: 'Full-width thermal transverse crack' },
  { lat: 16.4300, lon: 80.5800, speed: 15.0, heading: 235, road: 'NH-16 Guntur North Entry', defect: null },
];

export function generateSyntheticFrame(defectType, sequence) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 480);
  grad.addColorStop(0, '#2d3748');
  grad.addColorStop(0.4, '#1a202c');
  grad.addColorStop(1, '#171923');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 640, 480);

  ctx.strokeStyle = '#f6e05e';
  ctx.lineWidth = 6;
  ctx.setLineDash([30, 25]);
  ctx.beginPath();
  ctx.moveTo(320, 180);
  ctx.lineTo(320, 480);
  ctx.stroke();

  ctx.strokeStyle = '#edf2f7';
  ctx.lineWidth = 4;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(140, 180);
  ctx.lineTo(40, 480);
  ctx.moveTo(500, 180);
  ctx.lineTo(600, 480);
  ctx.stroke();

  if (defectType === 'POTHOLE') {
    ctx.fillStyle = '#0a0d14';
    ctx.beginPath();
    ctx.ellipse(320, 350, 75, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.strokeStyle = '#ff3366';
    ctx.lineWidth = 2;
    ctx.strokeRect(230, 300, 180, 100);
    ctx.fillStyle = '#ff3366';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('POTHOLE (92.4%)', 235, 292);
  } else if (defectType === 'ALLIGATOR_CRACK') {
    ctx.strokeStyle = '#1a202c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      ctx.moveTo(250 + i * 15, 330);
      ctx.lineTo(260 + i * 15, 380);
      ctx.lineTo(245 + i * 15, 410);
    }
    ctx.stroke();

    ctx.strokeStyle = '#ffb703';
    ctx.lineWidth = 2;
    ctx.strokeRect(220, 310, 170, 110);
    ctx.fillStyle = '#ffb703';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('ALLIGATOR_CRACK (88.1%)', 225, 302);
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(10, 10, 380, 50);
  ctx.fillStyle = '#00f5a0';
  ctx.font = '11px monospace';
  ctx.fillText(`ROADGUARD AI • CAM-01 • FRAME #${sequence}`, 20, 28);
  ctx.fillText(`GPS: 16.5062°N, 80.6480°E • NH-16 ANDHRA PRADESH`, 20, 48);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(new File([blob], `frame_${sequence}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.85);
  });
}
