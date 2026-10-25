package com.roadguard.api.service;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtSession;
import com.roadguard.api.entity.DetectionObservation;
import com.roadguard.api.entity.EvidenceFrame;
import com.roadguard.api.entity.RoadIssue;
import com.roadguard.api.repository.DetectionObservationRepository;
import com.roadguard.api.repository.EvidenceFrameRepository;
import com.roadguard.api.repository.RoadIssueRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.FloatBuffer;
import java.time.Instant;
import java.util.*;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class InferenceService {

    private static final Logger log = LoggerFactory.getLogger(InferenceService.class);

    @Value("${roadguard.inference.mode:ONNX}")
    private String inferenceMode;

    @Value("${roadguard.inference.onnx.model-path:./models/road_damage_yolo.onnx}")
    private String modelPath;

    @Value("${roadguard.inference.confidence-threshold:0.25}")
    private double confidenceThreshold;

    @Value("${roadguard.inference.temporal.window-size:4}")
    private int windowSize;

    @Value("${roadguard.inference.temporal.min-confirmations:2}")
    private int minConfirmations;

    private final DetectionObservationRepository observationRepository;
    private final RoadIssueRepository roadIssueRepository;
    private final EvidenceFrameRepository frameRepository;
    private final GeospatialDeduplicationService dedupService;
    private final InvestigationService investigationService;
    private final EvidenceStorageService evidenceStorageService;

    // ONNX Runtime session & environment
    private OrtEnvironment ortEnv;
    private OrtSession ortSession;
    private String modelStatus = "UNINITIALIZED";

    // Track rolling window of recent detections per journey: journeyId -> Queue of WindowObservation
    private final Map<Long, Deque<WindowObservation>> temporalWindows = new ConcurrentHashMap<>();

    private static final String[] CLASS_NAMES = {
        "buraco",               // 0: pothole -> RoadIssue.DefectClass.POTHOLE
        "trinca_longitudinal",  // 1: longitudinal crack -> RoadIssue.DefectClass.ROAD_CRACK
        "trinca_transversal",   // 2: transverse crack -> RoadIssue.DefectClass.TRANSVERSE_CRACK
        "trinca_malha",         // 3: alligator crack -> RoadIssue.DefectClass.ALLIGATOR_CRACK
        "tampa_bueiro"          // 4: manhole cover (utility, not a defect)
    };

    public static class RawDetection {
        public int classId;
        public String classLabel;
        public float confidence;
        public float x1, y1, x2, y2;
    }

    private static class WindowObservation {
        Long frameId;
        RoadIssue.DefectClass defectClass;
        double confidence;
        double lat;
        double lon;
        int frameSeq;
    }

    public InferenceService(
        DetectionObservationRepository observationRepository,
        RoadIssueRepository roadIssueRepository,
        EvidenceFrameRepository frameRepository,
        GeospatialDeduplicationService dedupService,
        InvestigationService investigationService,
        EvidenceStorageService evidenceStorageService
    ) {
        this.observationRepository = observationRepository;
        this.roadIssueRepository = roadIssueRepository;
        this.frameRepository = frameRepository;
        this.dedupService = dedupService;
        this.investigationService = investigationService;
        this.evidenceStorageService = evidenceStorageService;
    }

    @PostConstruct
    public void init() {
        log.info("Initializing RoadGuard AI InferenceService in mode: {}", inferenceMode);
        if ("ONNX".equalsIgnoreCase(inferenceMode)) {
            loadOnnxModel();
        } else {
            modelStatus = "SIMULATED_DEMO_ONLY";
            log.info("Inference mode is '{}' (Simulated detections restricted to explicit demo journeys)", inferenceMode);
        }
    }

    private void loadOnnxModel() {
        try {
            File file = resolveModelFile(modelPath);
            if (file == null || !file.exists()) {
                modelStatus = "MODEL NOT CONFIGURED";
                log.warn("MODEL NOT CONFIGURED: ONNX model file does not exist at '{}'. Genuine inference is disabled until configured.", modelPath);
                return;
            }

            ortEnv = OrtEnvironment.getEnvironment();
            OrtSession.SessionOptions options = new OrtSession.SessionOptions();
            ortSession = ortEnv.createSession(file.getAbsolutePath(), options);
            modelStatus = "LOADED";
            log.info("ONNX Road Damage Detection Model loaded successfully from {} (Input: {}, Output: {})",
                file.getAbsolutePath(),
                ortSession.getInputNames(),
                ortSession.getOutputNames());
        } catch (Exception e) {
            modelStatus = "MODEL LOAD ERROR: " + e.getMessage();
            log.error("Failed to initialize ONNX Runtime session: {}", e.getMessage(), e);
        }
    }

    private File resolveModelFile(String pathStr) {
        if (pathStr == null || pathStr.isBlank()) return null;
        File f = new File(pathStr);
        if (f.exists()) return f;

        // Try looking relative to current directory or roadguard-backend
        File fallback = new File("roadguard-backend", pathStr);
        if (fallback.exists()) return fallback;

        // Try stripping leading ./
        if (pathStr.startsWith("./") || pathStr.startsWith(".\\")) {
            File alt = new File(pathStr.substring(2));
            if (alt.exists()) return alt;
            File alt2 = new File("roadguard-backend", pathStr.substring(2));
            if (alt2.exists()) return alt2;
        }

        return f;
    }

    @PreDestroy
    public void cleanup() {
        if (ortSession != null) {
            try {
                ortSession.close();
            } catch (Exception ignored) {}
        }
    }

    public String getInferenceMode() {
        return inferenceMode;
    }

    public String getModelStatus() {
        return modelStatus;
    }

    public String getModelPath() {
        return modelPath;
    }

    @Transactional
    public List<DetectionObservation> processFrame(EvidenceFrame frame) {
        log.info("Processing frame #{} ({}) for journey #{} in mode: {}",
            frame.getId(), frame.getUuid(), frame.getJourney().getId(), inferenceMode);

        List<DetectionObservation> observations = new ArrayList<>();

        if ("ONNX".equalsIgnoreCase(inferenceMode)) {
            if (!"LOADED".equals(modelStatus) || ortSession == null) {
                log.warn("MODEL NOT CONFIGURED: Unable to run ONNX inference for frame #{}. Status: {}", frame.getId(), modelStatus);
                frame.setInferenceStatus(EvidenceFrame.InferenceStatus.FAILED);
                frameRepository.save(frame);
                return observations;
            }

            BufferedImage image = evidenceStorageService.loadFrameImage(frame.getStorageKey());
            if (image == null) {
                log.error("Failed to load image bytes for frame #{} from storageKey: {}", frame.getId(), frame.getStorageKey());
                frame.setInferenceStatus(EvidenceFrame.InferenceStatus.FAILED);
                frameRepository.save(frame);
                return observations;
            }

            List<RawDetection> rawDetections = executeOnnxInference(image);
            log.info("ONNX inference on frame #{} detected {} defect candidate(s) above threshold {}",
                frame.getId(), rawDetections.size(), confidenceThreshold);

            int seq = frame.getFrameSequence() != null ? frame.getFrameSequence() : 1;
            double lat = frame.getLatitude() != null ? frame.getLatitude() : 16.5062;
            double lon = frame.getLongitude() != null ? frame.getLongitude() : 80.6480;

            for (RawDetection det : rawDetections) {
                RoadIssue.DefectClass defectClass = mapClassToDefect(det.classId);
                if (defectClass == null) continue;

                DetectionObservation obs = new DetectionObservation();
                obs.setFrame(frame);
                obs.setRawClassLabel(defectClass.name());
                obs.setRawConfidence((double) det.confidence);
                obs.setInferenceMode("REAL_ONNX");
                obs.setBboxX1((double) det.x1);
                obs.setBboxY1((double) det.y1);
                obs.setBboxX2((double) det.x2);
                obs.setBboxY2((double) det.y2);
                obs.setConfirmed(false);

                // Temporal window check per journey
                Long journeyId = frame.getJourney().getId();
                Deque<WindowObservation> window = temporalWindows.computeIfAbsent(journeyId, k -> new ArrayDeque<>());

                WindowObservation wo = new WindowObservation();
                wo.frameId = frame.getId();
                wo.defectClass = defectClass;
                wo.confidence = det.confidence;
                wo.lat = lat;
                wo.lon = lon;
                wo.frameSeq = seq;

                window.addLast(wo);
                while (window.size() > windowSize) {
                    window.removeFirst();
                }

                // Count occurrences of this defect in window
                long count = window.stream().filter(w -> w.defectClass == defectClass).count();
                if (count >= minConfirmations) {
                    obs.setConfirmed(true);
                    obs.setConfirmationFrame(seq);

                    RoadIssue confirmedIssue = handleConfirmedDefect(
                        frame, defectClass, det.confidence, lat, lon, RoadIssue.DetectionMode.REAL_ONNX);
                    obs.setRoadIssue(confirmedIssue);
                }

                observationRepository.save(obs);
                observations.add(obs);
            }

            frame.setInferenceStatus(EvidenceFrame.InferenceStatus.DONE);
            frameRepository.save(frame);
            return observations;
        }

        // SIMULATED DEMO MODE (Explicitly separated from production inference path)
        if (frame.getJourney() != null && Boolean.TRUE.equals(frame.getJourney().getDemoMode())) {
            int seq = frame.getFrameSequence() != null ? frame.getFrameSequence() : 1;
            boolean demoHit = (seq % 3 == 0);
            if (demoHit) {
                RoadIssue.DefectClass defectClass = (seq % 2 == 0)
                    ? RoadIssue.DefectClass.POTHOLE
                    : RoadIssue.DefectClass.ALLIGATOR_CRACK;
                double confidence = 0.72;

                DetectionObservation obs = new DetectionObservation();
                obs.setFrame(frame);
                obs.setRawClassLabel("SIMULATED_" + defectClass.name());
                obs.setRawConfidence(confidence);
                obs.setInferenceMode("MOCK_SIMULATED");
                obs.setBboxX1(0.25);
                obs.setBboxY1(0.50);
                obs.setBboxX2(0.55);
                obs.setBboxY2(0.70);
                obs.setConfirmed(false);

                observationRepository.save(obs);
                observations.add(obs);
            }
        }

        frame.setInferenceStatus(EvidenceFrame.InferenceStatus.DONE);
        frameRepository.save(frame);
        return observations;
    }

    private List<RawDetection> executeOnnxInference(BufferedImage original) {
        int inputW = 512;
        int inputH = 512;

        // Resize image to 512x512 with bilinear interpolation
        BufferedImage resized = new BufferedImage(inputW, inputH, BufferedImage.TYPE_INT_RGB);
        Graphics2D g2d = resized.createGraphics();
        g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g2d.drawImage(original, 0, 0, inputW, inputH, null);
        g2d.dispose();

        // Convert to CHW float tensor normalized [0, 1]
        FloatBuffer buffer = FloatBuffer.allocate(1 * 3 * inputH * inputW);
        for (int y = 0; y < inputH; y++) {
            for (int x = 0; x < inputW; x++) {
                int rgb = resized.getRGB(x, y);
                float r = ((rgb >> 16) & 0xFF) / 255.0f;
                buffer.put(r);
            }
        }
        for (int y = 0; y < inputH; y++) {
            for (int x = 0; x < inputW; x++) {
                int rgb = resized.getRGB(x, y);
                float g = ((rgb >> 8) & 0xFF) / 255.0f;
                buffer.put(g);
            }
        }
        for (int y = 0; y < inputH; y++) {
            for (int x = 0; x < inputW; x++) {
                int rgb = resized.getRGB(x, y);
                float b = (rgb & 0xFF) / 255.0f;
                buffer.put(b);
            }
        }
        buffer.flip();

        long[] shape = new long[]{1, 3, inputH, inputW};
        List<RawDetection> rawCandidates = new ArrayList<>();

        try (OnnxTensor inputTensor = OnnxTensor.createTensor(ortEnv, buffer, shape)) {
            try (OrtSession.Result result = ortSession.run(Collections.singletonMap("images", inputTensor))) {
                float[][][] output = (float[][][]) result.get(0).getValue();
                int numAnchors = output[0][0].length; // 5376

                for (int i = 0; i < numAnchors; i++) {
                    float cx = output[0][0][i];
                    float cy = output[0][1][i];
                    float w = output[0][2][i];
                    float h = output[0][3][i];

                    int bestClass = -1;
                    float maxScore = 0.0f;
                    // Evaluate all 5 classes trained into the model:
                    // Classes 0..3 are defects (pothole, longitudinal crack, transverse crack, alligator crack)
                    // Class 4 is tampa_bueiro (manhole cover - normal infrastructure)
                    for (int c = 0; c < 5; c++) {
                        float score = output[0][4 + c][i];
                        if (score > maxScore) {
                            maxScore = score;
                            bestClass = c;
                        }
                    }

                    if (maxScore >= confidenceThreshold && bestClass >= 0 && bestClass <= 3) {
                        RawDetection det = new RawDetection();
                        det.classId = bestClass;
                        det.classLabel = CLASS_NAMES[bestClass];
                        det.confidence = maxScore;
                        det.x1 = Math.max(0.0f, Math.min(1.0f, (cx - w / 2.0f) / inputW));
                        det.y1 = Math.max(0.0f, Math.min(1.0f, (cy - h / 2.0f) / inputH));
                        det.x2 = Math.max(0.0f, Math.min(1.0f, (cx + w / 2.0f) / inputW));
                        det.y2 = Math.max(0.0f, Math.min(1.0f, (cy + h / 2.0f) / inputH));
                        rawCandidates.add(det);
                    }
                }
            }
        } catch (Exception e) {
            log.error("ONNX inference execution failed: {}", e.getMessage(), e);
            return Collections.emptyList();
        }

        // Apply greedy Non-Maximum Suppression (IoU threshold 0.45)
        return applyNms(rawCandidates, 0.45f);
    }

    private List<RawDetection> applyNms(List<RawDetection> detections, float iouThresh) {
        detections.sort((a, b) -> Float.compare(b.confidence, a.confidence));
        List<RawDetection> retained = new ArrayList<>();
        boolean[] suppressed = new boolean[detections.size()];

        for (int i = 0; i < detections.size(); i++) {
            if (suppressed[i]) continue;
            RawDetection a = detections.get(i);
            retained.add(a);

            for (int j = i + 1; j < detections.size(); j++) {
                if (suppressed[j]) continue;
                RawDetection b = detections.get(j);
                if (a.classId == b.classId && computeIoU(a, b) > iouThresh) {
                    suppressed[j] = true;
                }
            }
        }
        return retained;
    }

    private float computeIoU(RawDetection a, RawDetection b) {
        float xx1 = Math.max(a.x1, b.x1);
        float yy1 = Math.max(a.y1, b.y1);
        float xx2 = Math.min(a.x2, b.x2);
        float yy2 = Math.min(a.y2, b.y2);

        float w = Math.max(0.0f, xx2 - xx1);
        float h = Math.max(0.0f, yy2 - yy1);
        float intersection = w * h;

        float areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
        float areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
        float union = areaA + areaB - intersection;

        return union <= 0.0f ? 0.0f : intersection / union;
    }

    private RoadIssue.DefectClass mapClassToDefect(int classId) {
        switch (classId) {
            case 0: return RoadIssue.DefectClass.POTHOLE;            // buraco
            case 1: return RoadIssue.DefectClass.ROAD_CRACK;          // trinca_longitudinal
            case 2: return RoadIssue.DefectClass.TRANSVERSE_CRACK;   // trinca_transversal
            case 3: return RoadIssue.DefectClass.ALLIGATOR_CRACK;    // trinca_malha
            default: return null;
        }
    }

    private RoadIssue handleConfirmedDefect(
        EvidenceFrame frame,
        RoadIssue.DefectClass defectClass,
        double confidence,
        double lat,
        double lon,
        RoadIssue.DetectionMode detectionMode
    ) {
        Optional<RoadIssue> existingDuplicate = dedupService.findExistingDuplicate(lat, lon, defectClass);
        if (existingDuplicate.isPresent()) {
            RoadIssue existing = existingDuplicate.get();
            existing.setObservationCount(existing.getObservationCount() + 1);
            existing.setLastSeenAt(Instant.now());
            if (confidence > (existing.getConfidenceScore() != null ? existing.getConfidenceScore() : 0)) {
                existing.setConfidenceScore(confidence);
            }
            log.info("Aggregated genuine observation into existing RoadIssue #{} (Count: {})",
                existing.getId(), existing.getObservationCount());
            return roadIssueRepository.save(existing);
        }

        RoadIssue issue = new RoadIssue();
        issue.setUuid(UUID.randomUUID().toString());
        issue.setJourney(frame.getJourney());
        issue.setDefectClass(defectClass);
        issue.setSeverity(confidence > 0.40 ? RoadIssue.Severity.HIGH : RoadIssue.Severity.MEDIUM);
        issue.setLatitude(lat);
        issue.setLongitude(lon);
        issue.setLocationAccuracyM(10.0);
        issue.setConfidenceScore(confidence);
        issue.setDetectionMode(detectionMode);
        issue.setObservationCount(1);
        issue.setStatus(RoadIssue.IssueStatus.DETECTED);

        deriveRoadDetails(issue, lat, lon);

        RoadIssue savedIssue = roadIssueRepository.save(issue);
        log.info("Created new genuine confirmed RoadIssue #{} ({}, conf: {}) at {}, {}",
            savedIssue.getId(), defectClass, confidence, lat, lon);

        try {
            investigationService.investigateIssue(savedIssue);
        } catch (Exception e) {
            log.warn("Investigation failed for issue #{}: {}", savedIssue.getId(), e.getMessage());
        }

        return savedIssue;
    }

    private void deriveRoadDetails(RoadIssue issue, double lat, double lon) {
        if (lat >= 16.5 && lat <= 16.6 && lon >= 80.6 && lon <= 80.7) {
            issue.setRoadName("NH-16 Chennai-Kolkata Highway (Vijayawada bypass)");
            issue.setAddress("Near Benz Circle, Vijayawada, Krishna District, Andhra Pradesh 520010");
        } else if (lat >= 17.6 && lat <= 17.8) {
            issue.setRoadName("NH-16 Visakhapatnam Port Corridor");
            issue.setAddress("Gajuwaka Junction, Visakhapatnam, Andhra Pradesh 530026");
        } else if (lat >= 14.4 && lat <= 14.8) {
            issue.setRoadName("SH-61 Kadapa - Rayachoty Road");
            issue.setAddress("Near Guvvalacheruvu Ghat, Kadapa District, Andhra Pradesh 516001");
        } else {
            issue.setRoadName("MDR-104 Amaravati Capital Access Road");
            issue.setAddress("Thullur Road, Guntur District, Andhra Pradesh 522237");
        }
    }
}
