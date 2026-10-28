# RoadGuard AI — Computer Vision Model Evaluation & Benchmark Standards

**Model File**: `roadguard-backend/models/road_damage_yolo.onnx`  
**Architecture**: Ultralytics YOLO11s / YOLOv8 fine-tuned for Road Damage Detection (RDD)  
**Tensors**: Input `[images]` (1x3x640x640, float32), Output `[output0]` (1x8x8400)  
**Execution Runtime**: Microsoft ONNX Runtime 1.19.0 (DirectML / CPU / WebGL)

---

## 1. Class Taxonomy & Crowdsensing Benchmark (RDD2022)

RoadGuard aligns with the international Crowdsensing-based Road Damage Detection Challenge (RDD2022 / IEEE BigData):

| Class Code | Defect Category | Description | Severity Impact |
| :---: | :--- | :--- | :---: |
| **D00** | Longitudinal Crack | Linear crack parallel to the road travel direction | Low / Medium |
| **D10** | Transverse Crack | Linear crack perpendicular to the road travel direction | Medium |
| **D20** | Alligator Crack | High-density fatigue cracking resembling reptile skin | High |
| **D40** | Pothole | Deep structural cavity / depression posing wheel damage risk | Critical |

---

## 2. Benchmark Reality vs. Field Claims

* **Realistic Edge Performance**: Real-time YOLOv8/11 models running on mobile dashcams at 25–30 FPS typically demonstrate:
  * Mean Average Precision (mAP@0.50): **0.62 – 0.78**
  * Pothole Precision (D40): **0.74 – 0.86**
  * Recall: **0.68 – 0.81**
* **The "100% Accuracy" Reality Check**: Any claim of 100% field accuracy is scientifically invalid. Environmental variations (puddle reflections, sun glare, shadow patterns from trees or overpasses) introduce false positives if unmoderated.
* **RoadGuard Architectural Safeguard**:
  1. Real-time edge inference flags candidates with visual warning triangles on the dashcam view.
  2. Cryptographic SHA-256 evidence hashing confirms frame authenticity.
  3. Pre-submission citizen review allows the citizen to inspect the photo, verify the pothole, and submit with full consent.
