package com.roadguard.api;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtSession;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.FileInputStream;
import java.nio.FloatBuffer;
import java.security.MessageDigest;
import java.util.*;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class OnnxInferenceRunnerTest {

    public static class Detection {
        public String classLabel;
        public int classId;
        public float confidence;
        public float x1, y1, x2, y2; // normalized 0..1

        @Override
        public String toString() {
            return String.format("[%s (%.1f%%) bbox: (%.3f, %.3f) - (%.3f, %.3f)]",
                classLabel, confidence * 100, x1, y1, x2, y2);
        }
    }

    public static class InferenceRun {
        public List<Detection> rawCandidates = new ArrayList<>();
        public List<Detection> finalDetections = new ArrayList<>();
    }

    private static final String[] CLASS_NAMES = {
        "buraco",               // 0: pothole
        "trinca_longitudinal",  // 1: longitudinal crack
        "trinca_transversal",   // 2: transverse crack
        "trinca_malha",         // 3: alligator crack
        "tampa_bueiro"          // 4: manhole cover
    };

    public static String computeSha256(File file) {
        try (FileInputStream fis = new FileInputStream(file)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buf = new byte[8192];
            int n;
            while ((n = fis.read(buf)) != -1) {
                digest.update(buf, 0, n);
            }
            byte[] hash = digest.digest();
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02X", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return "ERROR: " + e.getMessage();
        }
    }

    public static InferenceRun runInferenceDetailed(OrtEnvironment env, OrtSession session, File imageFile, float confThresh, float iouThresh) throws Exception {
        BufferedImage original = ImageIO.read(imageFile);
        assertNotNull(original, "Failed to decode image: " + imageFile.getAbsolutePath());

        int inputW = 512;
        int inputH = 512;

        // Resize image to 512x512
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
        InferenceRun run = new InferenceRun();

        try (OnnxTensor inputTensor = OnnxTensor.createTensor(env, buffer, shape)) {
            try (OrtSession.Result result = session.run(Collections.singletonMap("images", inputTensor))) {
                float[][][] output = (float[][][]) result.get(0).getValue();
                int numAnchors = output[0][0].length;

                for (int i = 0; i < numAnchors; i++) {
                    float cx = output[0][0][i];
                    float cy = output[0][1][i];
                    float w = output[0][2][i];
                    float h = output[0][3][i];

                    // Find class with max score among classes 0..4 (indices 4..8)
                    int bestClass = -1;
                    float maxScore = 0.0f;
                    for (int c = 0; c < 5; c++) {
                        float score = output[0][4 + c][i];
                        if (score > maxScore) {
                            maxScore = score;
                            bestClass = c;
                        }
                    }

                    // Only consider actual road defects: classes 0..3
                    // Class 4 is tampa_bueiro (manhole cover), which is normal road infrastructure, not a damage defect
                    if (maxScore >= confThresh && bestClass >= 0 && bestClass <= 3) {
                        Detection det = new Detection();
                        det.classId = bestClass;
                        det.classLabel = CLASS_NAMES[bestClass];
                        det.confidence = maxScore;
                        det.x1 = Math.max(0.0f, Math.min(1.0f, (cx - w / 2.0f) / inputW));
                        det.y1 = Math.max(0.0f, Math.min(1.0f, (cy - h / 2.0f) / inputH));
                        det.x2 = Math.max(0.0f, Math.min(1.0f, (cx + w / 2.0f) / inputW));
                        det.y2 = Math.max(0.0f, Math.min(1.0f, (cy + h / 2.0f) / inputH));
                        run.rawCandidates.add(det);
                    }
                }
            }
        }

        // Apply Non-Maximum Suppression (NMS)
        List<Detection> rawCopy = new ArrayList<>(run.rawCandidates);
        run.finalDetections = applyNms(rawCopy, iouThresh);
        return run;
    }

    public static List<Detection> runInference(OrtEnvironment env, OrtSession session, File imageFile, float confThresh, float iouThresh) throws Exception {
        return runInferenceDetailed(env, session, imageFile, confThresh, iouThresh).finalDetections;
    }

    private static List<Detection> applyNms(List<Detection> detections, float iouThresh) {
        // Sort descending by confidence
        detections.sort((a, b) -> Float.compare(b.confidence, a.confidence));

        List<Detection> retained = new ArrayList<>();
        boolean[] suppressed = new boolean[detections.size()];

        for (int i = 0; i < detections.size(); i++) {
            if (suppressed[i]) continue;
            Detection a = detections.get(i);
            retained.add(a);

            for (int j = i + 1; j < detections.size(); j++) {
                if (suppressed[j]) continue;
                Detection b = detections.get(j);
                if (a.classId == b.classId) {
                    if (computeIoU(a, b) > iouThresh) {
                        suppressed[j] = true;
                    }
                }
            }
        }
        return retained;
    }

    private static float computeIoU(Detection a, Detection b) {
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

    @Test
    public void testProductionConfidenceThresholdDetections() throws Exception {
        File modelFile = new File("models/road_damage_yolo.onnx");
        if (!modelFile.exists()) {
            modelFile = new File("roadguard-backend/models/road_damage_yolo.onnx");
        }
        assertTrue(modelFile.exists(), "Model file not found at " + modelFile.getAbsolutePath());

        OrtEnvironment env = OrtEnvironment.getEnvironment();
        OrtSession session = env.createSession(modelFile.getAbsolutePath(), new OrtSession.SessionOptions());

        File potholeImg = new File("../test-images/defect_pothole.jpg");
        if (!potholeImg.exists()) potholeImg = new File("test-images/defect_pothole.jpg");
        assertTrue(potholeImg.exists(), "Pothole test image not found");

        File cracksImg = new File("../test-images/defect_pavement_cracks.jpg");
        if (!cracksImg.exists()) cracksImg = new File("test-images/defect_pavement_cracks.jpg");
        assertTrue(cracksImg.exists(), "Cracks test image not found");

        File cleanImg = new File("../test-images/clean_road.jpg");
        if (!cleanImg.exists()) cleanImg = new File("test-images/clean_road.jpg");
        assertTrue(cleanImg.exists(), "Clean road test image not found");

        float prodThreshold = 0.25f; // Production configured threshold in application.properties

        System.out.println("\n=======================================================");
        System.out.println("PRODUCTION THRESHOLD (0.25 / 25%) INFERENCE AUDIT");
        System.out.println("=======================================================");

        // 1. Pothole Image under Production Threshold (0.25)
        List<Detection> potholeDets = runInference(env, session, potholeImg, prodThreshold, 0.45f);
        System.out.println("\n[PROD TEST 1] Defect Pothole Image (Threshold = 0.25):");
        System.out.println("  Detections count: " + potholeDets.size());
        for (Detection d : potholeDets) {
            System.out.println("  -> " + d);
        }
        assertFalse(potholeDets.isEmpty(), "Expected pothole detections to pass production threshold of 0.25");
        assertTrue(potholeDets.get(0).confidence >= prodThreshold);

        // 2. Cracks Image under Production Threshold (0.25)
        List<Detection> cracksProdDets = runInference(env, session, cracksImg, prodThreshold, 0.45f);
        System.out.println("\n[PROD TEST 2] Defect Cracks Image (Threshold = 0.25):");
        System.out.println("  Detections count: " + cracksProdDets.size());
        // Honest audit: raw crack predictions peak at ~19.6% and ~15.8%, so under 0.25 threshold, 0 detections pass
        assertEquals(0, cracksProdDets.size(),
            "Under production threshold (0.25), fine cracks in defect_pavement_cracks.jpg do not pass (raw confidence peaks at ~19.6%)");

        // 3. Clean Road Image under Production Threshold (0.25)
        List<Detection> cleanDets = runInference(env, session, cleanImg, prodThreshold, 0.45f);
        System.out.println("\n[PROD TEST 3] Clean Road Image (Threshold = 0.25):");
        System.out.println("  Detections count: " + cleanDets.size());
        assertEquals(0, cleanDets.size(), "Clean road image must produce zero defect detections at production threshold");

        session.close();
    }

    @Test
    public void testDiagnosticRawSensitivityAndCrackAnalysis() throws Exception {
        File modelFile = new File("models/road_damage_yolo.onnx");
        if (!modelFile.exists()) {
            modelFile = new File("roadguard-backend/models/road_damage_yolo.onnx");
        }
        assertTrue(modelFile.exists(), "Model file not found at " + modelFile.getAbsolutePath());

        OrtEnvironment env = OrtEnvironment.getEnvironment();
        OrtSession session = env.createSession(modelFile.getAbsolutePath(), new OrtSession.SessionOptions());

        File cracksImg = new File("../test-images/defect_pavement_cracks.jpg");
        if (!cracksImg.exists()) cracksImg = new File("test-images/defect_pavement_cracks.jpg");
        assertTrue(cracksImg.exists(), "Cracks test image not found");

        System.out.println("\n=======================================================");
        System.out.println("DIAGNOSTIC RAW SENSITIVITY PROBE (Threshold = 0.15)");
        System.out.println("Explaining why 19.6% and 15.8% appeared in test output");
        System.out.println("=======================================================");

        // Probe down to 0.15 to reveal raw candidate predictions
        List<Detection> rawCrackDets = runInference(env, session, cracksImg, 0.15f, 0.45f);
        System.out.println("  Diagnostic raw detections count at 0.15: " + rawCrackDets.size());
        for (Detection d : rawCrackDets) {
            System.out.println("  -> Raw Candidate: " + d);
        }

        assertFalse(rawCrackDets.isEmpty(), "Model does detect alligator crack features when probed down to 0.15");
        // Verify that raw scores are strictly below production threshold of 0.25
        for (Detection d : rawCrackDets) {
            assertTrue(d.confidence < 0.25f,
                "Candidate confidence (" + d.confidence + ") should be below production threshold (0.25)");
        }

        session.close();
    }

    public static class EvalImageSpec {
        public String filename;
        public String expectedCategory; // "CLEAN_ROAD", "POTHOLE", "ROAD_CRACK"
        public String defectDetails;
        public String source;

        public EvalImageSpec(String filename, String expectedCategory, String defectDetails, String source) {
            this.filename = filename;
            this.expectedCategory = expectedCategory;
            this.defectDetails = defectDetails;
            this.source = source;
        }
    }

    @Test
    public void testComprehensiveNineImageEvaluationSet() throws Exception {
        File modelFile = new File("models/road_damage_yolo.onnx");
        if (!modelFile.exists()) {
            modelFile = new File("roadguard-backend/models/road_damage_yolo.onnx");
        }
        assertTrue(modelFile.exists(), "Model file not found at " + modelFile.getAbsolutePath());

        OrtEnvironment env = OrtEnvironment.getEnvironment();
        OrtSession session = env.createSession(modelFile.getAbsolutePath(), new OrtSession.SessionOptions());

        File testDir = new File("../test-images");
        if (!testDir.exists()) testDir = new File("test-images");
        assertTrue(testDir.exists(), "test-images directory not found");

        List<EvalImageSpec> specs = Arrays.asList(
            new EvalImageSpec("clean_road.jpg", "CLEAN_ROAD", "Clean highway with markings & 1 manhole cover, 0 defects", "Wikimedia Commons"),
            new EvalImageSpec("eval_clean_highway.jpg", "CLEAN_ROAD", "Clean asphalt motorway in Serres, 0 defects", "Wikimedia Commons / Unsplash"),
            new EvalImageSpec("defect_pothole.jpg", "POTHOLE", "Deep high-contrast asphalt pothole cavity", "DarshanM0di/potholedetect"),
            new EvalImageSpec("eval_potholes_road.jpg", "POTHOLE", "Rural road lane with multiple pothole craters", "Wikimedia Commons (Potholes.jpg)"),
            new EvalImageSpec("eval_pothole_pavement.jpg", "POTHOLE", "Localized severe pothole cavity in asphalt pavement", "Wikimedia Commons (Santeri Viinamäki)"),
            new EvalImageSpec("defect_pavement_cracks.jpg", "ROAD_CRACK", "Interconnected alligator / fatigue cracking network", "Kodjaoglanian/pavimentos-yolo11s"),
            new EvalImageSpec("eval_cracked_asphalt.jpg", "ROAD_CRACK", "Pavement surface distress with interconnected crack lines", "Wikimedia Commons (Jonathunder)"),
            new EvalImageSpec("eval_longitudinal_crack.jpg", "ROAD_CRACK", "Longitudinal fissure along roadway travel direction", "Wikimedia Commons (Matthew Paulson)"),
            new EvalImageSpec("eval_deteriorated_asphalt.jpg", "ROAD_CRACK", "Weathered deteriorated asphalt with transverse/block cracking", "Wikimedia Commons (Silar)")
        );

        float prodThreshold = 0.25f;
        float diagThreshold = 0.10f;
        float iouThreshold = 0.45f;

        System.out.println("\n==================================================================================");
        System.out.println("ROADGUARD AI — REPRODUCIBLE 9-IMAGE BENCHMARK EVALUATION");
        System.out.println("Model: YOLO11s ONNX | Production Conf: 0.25 | IoU NMS: 0.45");
        System.out.println("==================================================================================");

        int totalImages = specs.size();
        int potholeTP = 0, potholeFP = 0, potholeFN = 0;
        int crackTP = 0, crackFP = 0, crackFN = 0;
        int cleanTN = 0, cleanFP = 0;

        StringBuilder tableBuilder = new StringBuilder();
        tableBuilder.append(String.format("%-28s | %-12s | %-10s | %-10s | %-6s | %-9s | %s\n",
            "Image Filename", "Resolution", "GroundTruth", "Prod Class", "Conf%", "Diag Dets", "Outcome"));
        tableBuilder.append("-----------------------------------------------------------------------------------------------------------------\n");

        for (EvalImageSpec spec : specs) {
            File imgFile = new File(testDir, spec.filename);
            assertTrue(imgFile.exists(), "Evaluation image missing: " + spec.filename);

            BufferedImage bimg = ImageIO.read(imgFile);
            assertNotNull(bimg, "Failed to decode image: " + spec.filename);
            int width = bimg.getWidth();
            int height = bimg.getHeight();
            long fileBytes = imgFile.length();
            String sha256 = computeSha256(imgFile);

            InferenceRun prodRun = runInferenceDetailed(env, session, imgFile, prodThreshold, iouThreshold);
            InferenceRun diagRun = runInferenceDetailed(env, session, imgFile, diagThreshold, iouThreshold);

            System.out.println("\n----------------------------------------------------------------------------------");
            System.out.printf("FILE: %s (%dx%d, %d bytes)\n", spec.filename, width, height, fileBytes);
            System.out.printf("SHA-256: %s\n", sha256);
            System.out.printf("Source: %s\n", spec.source);
            System.out.printf("Ground Truth: %s [%s]\n", spec.expectedCategory, spec.defectDetails);
            System.out.printf("Raw Candidates (>=0.25): %d | Final After NMS (>=0.25): %d\n",
                prodRun.rawCandidates.size(), prodRun.finalDetections.size());
            for (Detection d : prodRun.finalDetections) {
                System.out.printf("   [PROD HIT] Class: %s (id=%d), Confidence: %.1f%%, BBox: (%.3f, %.3f) - (%.3f, %.3f)\n",
                    d.classLabel, d.classId, d.confidence * 100, d.x1, d.y1, d.x2, d.y2);
            }
            System.out.printf("Diagnostic Candidates (>=0.10): %d | Final After NMS: %d\n",
                diagRun.rawCandidates.size(), diagRun.finalDetections.size());
            for (Detection d : diagRun.finalDetections) {
                if (d.confidence < prodThreshold) {
                    System.out.printf("   [DIAG SUB-THRESHOLD] Class: %s, Confidence: %.1f%%, BBox: (%.3f, %.3f) - (%.3f, %.3f)\n",
                        d.classLabel, d.confidence * 100, d.x1, d.y1, d.x2, d.y2);
                }
            }

            // Determine Evaluation Decision
            String prodClassStr = "NONE";
            float topConf = 0.0f;
            if (!prodRun.finalDetections.isEmpty()) {
                Detection top = prodRun.finalDetections.get(0);
                prodClassStr = top.classLabel;
                topConf = top.confidence * 100;
            }

            String outcome;
            if ("CLEAN_ROAD".equals(spec.expectedCategory)) {
                if (prodRun.finalDetections.isEmpty()) {
                    outcome = "TRUE_NEGATIVE (Clean road verified)";
                    cleanTN++;
                } else {
                    outcome = "FALSE_POSITIVE (Spurious defect on clean road)";
                    cleanFP++;
                }
            } else if ("POTHOLE".equals(spec.expectedCategory)) {
                boolean hasPothole = prodRun.finalDetections.stream().anyMatch(d -> "buraco".equals(d.classLabel));
                if (hasPothole) {
                    outcome = "TRUE_POSITIVE (Pothole correctly detected)";
                    potholeTP++;
                } else if (!prodRun.finalDetections.isEmpty()) {
                    outcome = "MISCLASSIFIED (" + prodClassStr + " instead of pothole)";
                    potholeFN++;
                } else {
                    outcome = "FALSE_NEGATIVE (Missed pothole)";
                    potholeFN++;
                }
            } else { // ROAD_CRACK
                boolean hasCrack = prodRun.finalDetections.stream().anyMatch(d -> d.classLabel.startsWith("trinca"));
                if (hasCrack) {
                    outcome = "TRUE_POSITIVE (Crack correctly detected)";
                    crackTP++;
                } else if (!prodRun.finalDetections.isEmpty()) {
                    outcome = "MISCLASSIFIED (" + prodClassStr + " instead of crack)";
                    crackFN++;
                } else {
                    outcome = "FALSE_NEGATIVE (Crack below 0.25 threshold)";
                    crackFN++;
                }
            }

            System.out.printf("EVALUATION OUTCOME: %s\n", outcome);

            tableBuilder.append(String.format("%-28s | %-12s | %-10s | %-10s | %5.1f%% | %-9d | %s\n",
                spec.filename, width + "x" + height, spec.expectedCategory, prodClassStr, topConf,
                diagRun.finalDetections.size(), outcome));
        }

        System.out.println("\n==================================================================================");
        System.out.println("EVALUATION MATRIX SUMMARY TABLE");
        System.out.println("==================================================================================");
        System.out.print(tableBuilder.toString());

        // Compute metrics
        double potholePrecision = (potholeTP + potholeFP) > 0 ? (double) potholeTP / (potholeTP + potholeFP) : 0.0;
        double potholeRecall = (potholeTP + potholeFN) > 0 ? (double) potholeTP / (potholeTP + potholeFN) : 0.0;
        double potholeF1 = (potholePrecision + potholeRecall) > 0 ? 2 * (potholePrecision * potholeRecall) / (potholePrecision + potholeRecall) : 0.0;

        double crackPrecision = (crackTP + crackFP) > 0 ? (double) crackTP / (crackTP + crackFP) : 0.0;
        double crackRecall = (crackTP + crackFN) > 0 ? (double) crackTP / (crackTP + crackFN) : 0.0;
        double crackF1 = (crackPrecision + crackRecall) > 0 ? 2 * (crackPrecision * crackRecall) / (crackPrecision + crackRecall) : 0.0;

        int overallDefectTP = potholeTP + crackTP;
        int overallDefectFP = potholeFP + crackFP + cleanFP;
        int overallDefectFN = potholeFN + crackFN;
        double overallPrecision = (overallDefectTP + overallDefectFP) > 0 ? (double) overallDefectTP / (overallDefectTP + overallDefectFP) : 0.0;
        double overallRecall = (overallDefectTP + overallDefectFN) > 0 ? (double) overallDefectTP / (overallDefectTP + overallDefectFN) : 0.0;
        double overallF1 = (overallPrecision + overallRecall) > 0 ? 2 * (overallPrecision * overallRecall) / (overallPrecision + overallRecall) : 0.0;
        double cleanSpecificity = (cleanTN + cleanFP) > 0 ? (double) cleanTN / (cleanTN + cleanFP) : 0.0;

        System.out.println("\n==================================================================================");
        System.out.println("EMPIRICAL METRICS (Calculated on 9 genuine road evaluation images)");
        System.out.println("==================================================================================");
        System.out.printf("Total Images Evaluated: %d (Clean: 2, Potholes: 3, Cracks: 4)\n", totalImages);
        System.out.printf("Pothole Detection: TP=%d, FP=%d, FN=%d -> Precision: %.1f%%, Recall: %.1f%%, F1: %.1f%%\n",
            potholeTP, potholeFP, potholeFN, potholePrecision * 100, potholeRecall * 100, potholeF1 * 100);
        System.out.printf("Crack Detection:   TP=%d, FP=%d, FN=%d -> Precision: %.1f%%, Recall: %.1f%%, F1: %.1f%%\n",
            crackTP, crackFP, crackFN, crackPrecision * 100, crackRecall * 100, crackF1 * 100);
        System.out.printf("Clean Road Filter: TN=%d, FP=%d -> Specificity: %.1f%%\n",
            cleanTN, cleanFP, cleanSpecificity * 100);
        System.out.printf("Overall Defect:    TP=%d, FP=%d, FN=%d -> Precision: %.1f%%, Recall: %.1f%%, F1: %.1f%%\n",
            overallDefectTP, overallDefectFP, overallDefectFN, overallPrecision * 100, overallRecall * 100, overallF1 * 100);
        System.out.println("==================================================================================\n");

        session.close();
    }

    @Test
    public void testVideoFrameSequenceTemporalConfirmation() throws Exception {
        File modelFile = new File("models/road_damage_yolo.onnx");
        if (!modelFile.exists()) {
            modelFile = new File("roadguard-backend/models/road_damage_yolo.onnx");
        }
        assertTrue(modelFile.exists(), "Model file not found at " + modelFile.getAbsolutePath());

        OrtEnvironment env = OrtEnvironment.getEnvironment();
        OrtSession session = env.createSession(modelFile.getAbsolutePath(), new OrtSession.SessionOptions());

        File testDir = new File("../test-images");
        if (!testDir.exists()) testDir = new File("test-images");

        File potholeFrame1 = new File(testDir, "defect_pothole.jpg");
        File potholeFrame2 = new File(testDir, "eval_potholes_road.jpg");
        File cleanFrame = new File(testDir, "clean_road.jpg");

        float prodThreshold = 0.25f;
        float iouThreshold = 0.45f;

        // Simulate a 4-frame video stream sequence:
        // Frame 1: Pothole (Arrival 1 -> Unconfirmed, count=1 < 2)
        // Frame 2: Pothole (Arrival 2 -> Confirmed, count=2 >= minConfirmations)
        // Frame 3: Clean road (0 defects)
        // Frame 4: Clean road (0 defects)
        int windowSize = 4;
        int minConfirmations = 2;
        Deque<String> slidingWindow = new ArrayDeque<>();

        File[] videoFrames = new File[]{potholeFrame1, potholeFrame2, cleanFrame, cleanFrame};
        boolean[] expectedConfirmed = new boolean[]{false, true, false, false};

        System.out.println("\n=======================================================");
        System.out.println("VIDEO STREAM TEMPORAL CONFIRMATION SIMULATION");
        System.out.println("Window Size: " + windowSize + " | Min Confirmations: " + minConfirmations);
        System.out.println("=======================================================");

        for (int i = 0; i < videoFrames.length; i++) {
            File frameFile = videoFrames[i];
            int frameSeq = i + 1;
            List<Detection> dets = runInference(env, session, frameFile, prodThreshold, iouThreshold);

            String defectDetected = null;
            if (!dets.isEmpty() && dets.get(0).classLabel.equals("buraco")) {
                defectDetected = "POTHOLE";
            }

            boolean isConfirmed = false;
            if (defectDetected != null) {
                slidingWindow.addLast(defectDetected);
                while (slidingWindow.size() > windowSize) {
                    slidingWindow.removeFirst();
                }
                long count = slidingWindow.stream().filter(d -> d.equals("POTHOLE")).count();
                if (count >= minConfirmations) {
                    isConfirmed = true;
                }
            }

            System.out.printf("Video Frame #%d [%s]: Defect='%s', WindowCount=%d, Confirmed=%b\n",
                frameSeq, frameFile.getName(), defectDetected != null ? defectDetected : "NONE",
                slidingWindow.size(), isConfirmed);

            assertEquals(expectedConfirmed[i], isConfirmed, "Mismatch in temporal confirmation on frame #" + frameSeq);
        }

        session.close();
    }
}
