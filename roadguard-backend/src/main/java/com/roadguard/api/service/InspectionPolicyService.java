package com.roadguard.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Optional;

/**
 * Pure-Java O(1) Policy Evaluator implementing the RoadGuard RL Decision Engine.
 *
 * Evaluates the 8-feature Partially Observable observation vector, maps it to a 1,728-cell
 * mixed-radix state ID, applies runtime dynamic action masking, and performs an O(1)
 * Q-value argmax lookup from inspection_policy_table.json without requiring Python or
 * Gymnasium dependencies in production.
 *
 * Implements deterministic fallback if the policy table is missing, invalid, or corrupt.
 */
@Service
public class InspectionPolicyService {

    private static final Logger log = LoggerFactory.getLogger(InspectionPolicyService.class);

    public static final String POLICY_TABLE_RESOURCE = "/models/inspection_policy_table.json";
    public static final String EXPECTED_SCHEMA_VERSION = "1.0.0";
    public static final int EXPECTED_NUM_STATES = 1728;
    public static final int EXPECTED_NUM_ACTIONS = 4;

    public static final int[] RADICES = {3, 3, 3, 2, 4, 2, 2, 2};
    public static final int[] STRIDES = {576, 192, 64, 32, 8, 4, 2, 1};

    public enum PolicyAction {
        SKIP_FRAME,
        COMMIT_LOCAL_ONNX,
        ESCALATE_TO_CLOUD_VLM,
        BUFFER_AND_RESAMPLE_FAST
    }

    public record PolicyDecision(
        PolicyAction action,
        int stateId,
        boolean[] actionMask,
        double selectedQValue,
        boolean usedFallbackRule,
        String rationale
    ) {}

    private final ObjectMapper objectMapper = new ObjectMapper();
    private boolean policyTableLoaded = false;
    private String loadedTableSha256 = "";
    private int[] defaultActionByState = new int[EXPECTED_NUM_STATES];
    private double[][] qValuesByState = new double[EXPECTED_NUM_STATES][EXPECTED_NUM_ACTIONS];

    @PostConstruct
    public void init() {
        loadPolicyTable();
    }

    public synchronized boolean loadPolicyTable() {
        try (InputStream is = getClass().getResourceAsStream(POLICY_TABLE_RESOURCE)) {
            if (is == null) {
                log.warn("Inspection policy table resource [{}] not found on classpath. Operating in deterministic fallback mode.", POLICY_TABLE_RESOURCE);
                policyTableLoaded = false;
                return false;
            }

            JsonNode root = objectMapper.readTree(is);

            String schemaVersion = root.path("schemaVersion").asText("");
            if (!EXPECTED_SCHEMA_VERSION.equals(schemaVersion)) {
                log.error("Inspection policy schema version [{}] does not match expected [{}]. Falling back.", schemaVersion, EXPECTED_SCHEMA_VERSION);
                policyTableLoaded = false;
                return false;
            }

            int numStates = root.path("numStates").asInt(0);
            if (numStates != EXPECTED_NUM_STATES) {
                log.error("Inspection policy numStates [{}] does not match expected [{}]. Falling back.", numStates, EXPECTED_NUM_STATES);
                policyTableLoaded = false;
                return false;
            }

            String expectedSha256 = root.path("tableSha256").asText("");
            JsonNode defaultActionsNode = root.path("defaultActionByState");
            JsonNode qValuesNode = root.path("qValuesByState");

            if (!defaultActionsNode.isArray() || defaultActionsNode.size() != EXPECTED_NUM_STATES ||
                !qValuesNode.isArray() || qValuesNode.size() != EXPECTED_NUM_STATES) {
                log.error("Inspection policy table payload dimensions invalid. Falling back.");
                policyTableLoaded = false;
                return false;
            }

            for (int s = 0; s < EXPECTED_NUM_STATES; s++) {
                defaultActionByState[s] = defaultActionsNode.get(s).asInt(0);
                JsonNode qArray = qValuesNode.get(s);
                for (int a = 0; a < EXPECTED_NUM_ACTIONS; a++) {
                    qValuesByState[s][a] = qArray.get(a).asDouble(0.0);
                }
            }

            this.loadedTableSha256 = expectedSha256;
            this.policyTableLoaded = true;
            log.info("Inspection policy table successfully loaded: {} states, 4 actions, SHA-256=[{}]", EXPECTED_NUM_STATES, expectedSha256);
            return true;
        } catch (Exception e) {
            log.error("Failed to load inspection policy table from classpath: {}", e.getMessage(), e);
            policyTableLoaded = false;
            return false;
        }
    }

    public boolean isPolicyTableLoaded() {
        return policyTableLoaded;
    }

    public String getLoadedTableSha256() {
        return loadedTableSha256;
    }

    public double[][] getQValuesByState() {
        return qValuesByState;
    }

    public int[] getDefaultActionByState() {
        return defaultActionByState;
    }

    public void setPolicyTableLoadedForTest(boolean loaded) {
        this.policyTableLoaded = loaded;
    }

    /**
     * Primary evaluation method using ImageQualityService.QualityAssessment.
     */
    public PolicyDecision evaluateFramePolicy(
        ImageQualityService.QualityAssessment quality,
        Optional<InferenceService.ParsedDetection> topDetection,
        Double speedMps,
        Double gpsAccuracyM,
        Double nearestIssueDistM,
        int vlmQuotaRemaining,
        int vlmQuotaMax,
        int currentResampleStreak
    ) {
        double sharpness = quality != null ? quality.sharpnessLaplacianVar() : 0.0;
        double brightness = quality != null ? quality.meanBrightness() : 137.5;
        return evaluateFramePolicyRaw(
            sharpness,
            brightness,
            topDetection,
            speedMps,
            gpsAccuracyM,
            nearestIssueDistM,
            vlmQuotaRemaining,
            vlmQuotaMax,
            currentResampleStreak
        );
    }

    /**
     * Overload for backward-compatibility with ImageQualityResult.
     */
    public PolicyDecision evaluateFramePolicy(
        ImageQualityService.ImageQualityResult qualityResult,
        Optional<InferenceService.ParsedDetection> topDetection,
        Double speedMps,
        Double gpsAccuracyM,
        Double nearestIssueDistM,
        int vlmQuotaRemaining,
        int vlmQuotaMax,
        int currentResampleStreak
    ) {
        return evaluateFramePolicy(
            ImageQualityService.QualityAssessment.from(qualityResult),
            topDetection,
            speedMps,
            gpsAccuracyM,
            nearestIssueDistM,
            vlmQuotaRemaining,
            vlmQuotaMax,
            currentResampleStreak
        );
    }

    /**
     * Internal raw feature normalizer, discretizer, action mask evaluator, and argmax selector.
     */
    public PolicyDecision evaluateFramePolicyRaw(
        double sharpnessLaplacianVar,
        double meanBrightness,
        Optional<InferenceService.ParsedDetection> topDetection,
        Double speedMps,
        Double gpsAccuracyM,
        Double nearestIssueDistM,
        int vlmQuotaRemaining,
        int vlmQuotaMax,
        int currentResampleStreak
    ) {
        // Feature 0: Normalized speed in [0, 1]
        double normSpeed = clamp01((speedMps != null ? speedMps : 0.0) / 35.0);

        // Feature 1: Normalized GPS uncertainty in [0, 1] (defaults to 1.0 if null/missing)
        double normGpsUncertainty = gpsAccuracyM != null ? clamp01(gpsAccuracyM / 200.0) : 1.0;

        // Feature 2: Normalized sharpness Laplacian variance in [0, 1]
        double normSharpness = clamp01(sharpnessLaplacianVar / 300.0);

        // Feature 3: Normalized brightness deviation |B - 137.5| / 102.5 in [0, 1]
        double normBrightnessDev = clamp01(Math.abs(meanBrightness - 137.5) / 102.5);

        // Feature 4: Top YOLO detection confidence in [0, 1]
        double yoloMaxConf = topDetection.map(d -> clamp01(d.confidence())).orElse(0.0);

        // Feature 5: YOLO predicted class is road defect (1.0) vs utility cover/none (0.0)
        double yoloClassIsDefect = topDetection.map(d -> d.modelClass().isRoadDamage() ? 1.0 : 0.0).orElse(0.0);

        // Feature 6: Duplicate cluster proximity in [0, 1]
        double dupClusterProximity = (nearestIssueDistM != null && nearestIssueDistM < 50.0)
            ? clamp01(1.0 - nearestIssueDistM / 50.0)
            : 0.0;

        // Feature 7: VLM quota remaining fraction in [0, 1]
        double nimVlmQuotaRem = vlmQuotaMax > 0
            ? clamp01((double) vlmQuotaRemaining / (double) vlmQuotaMax)
            : 0.0;

        // Discretization to mixed-radix bins
        int b0 = normSpeed < 0.06 ? 0 : (normSpeed < 0.45 ? 1 : 2);
        int b1 = normGpsUncertainty < 0.125 ? 0 : (normGpsUncertainty < 0.75 ? 1 : 2);
        int b2 = normSharpness < 0.2833 ? 0 : (normSharpness < 0.55 ? 1 : 2);
        int b3 = normBrightnessDev < 1.0 ? 0 : 1;
        int b4 = yoloMaxConf < 0.35 ? 0 : (yoloMaxConf < 0.50 ? 1 : (yoloMaxConf < 0.65 ? 2 : 3));
        int b5 = yoloClassIsDefect < 0.5 ? 0 : 1;
        int b6 = dupClusterProximity < 0.70 ? 0 : 1;
        int b7 = nimVlmQuotaRem < 0.05 ? 0 : 1;

        int stateId = 576 * b0 + 192 * b1 + 64 * b2 + 32 * b3 + 8 * b4 + 4 * b5 + 2 * b6 + b7;

        // Action masking
        boolean[] mask = new boolean[EXPECTED_NUM_ACTIONS];
        mask[0] = true; // SKIP_FRAME is always valid

        boolean isImageClear = (normSharpness >= 0.2833) && (normBrightnessDev < 1.0);
        boolean isDefectClass = (yoloClassIsDefect >= 0.5);
        boolean isConfidentEnough = (yoloMaxConf >= 0.35);
        boolean isNotDuplicate = (dupClusterProximity < 0.70);

        boolean canCommitLocal = isImageClear && isDefectClass && isConfidentEnough && isNotDuplicate;
        mask[1] = canCommitLocal;
        mask[2] = canCommitLocal && (nimVlmQuotaRem >= 0.05);

        boolean hasCandidateSignal = (yoloMaxConf >= 0.25) && isDefectClass;
        boolean isVehicleMoving = (normSpeed >= 0.06);
        mask[3] = hasCandidateSignal && isVehicleMoving && isNotDuplicate && (currentResampleStreak < 2);

        if (policyTableLoaded) {
            // Find valid action with maximum Q-value
            int bestAction = 0;
            double bestQ = -1e9;
            for (int a = 0; a < EXPECTED_NUM_ACTIONS; a++) {
                if (mask[a]) {
                    double q = qValuesByState[stateId][a];
                    if (q > bestQ) {
                        bestQ = q;
                        bestAction = a;
                    }
                }
            }
            PolicyAction selectedAction = PolicyAction.values()[bestAction];
            return new PolicyDecision(
                selectedAction,
                stateId,
                mask,
                bestQ,
                false,
                "RL table lookup state " + stateId + " -> " + selectedAction + " (Q=" + String.format("%.2f", bestQ) + ")"
            );
        } else {
            // Fallback deterministic heuristic rule
            PolicyAction fallbackAction;
            if (mask[1] && yoloMaxConf >= 0.65) {
                fallbackAction = PolicyAction.COMMIT_LOCAL_ONNX;
            } else if (mask[2] && yoloMaxConf >= 0.35) {
                fallbackAction = PolicyAction.ESCALATE_TO_CLOUD_VLM;
            } else {
                fallbackAction = PolicyAction.SKIP_FRAME;
            }
            return new PolicyDecision(
                fallbackAction,
                stateId,
                mask,
                0.0,
                true,
                "Fallback deterministic heuristic applied (policy table unavailable)"
            );
        }
    }

    private static double clamp01(double val) {
        if (Double.isNaN(val) || val <= 0.0) return 0.0;
        if (val >= 1.0) return 1.0;
        return val;
    }
}
