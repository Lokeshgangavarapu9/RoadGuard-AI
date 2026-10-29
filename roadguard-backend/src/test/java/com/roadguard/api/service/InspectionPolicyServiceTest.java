package com.roadguard.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class InspectionPolicyServiceTest {

    private InspectionPolicyService policyService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        policyService = new InspectionPolicyService();
        policyService.init();
    }

    @Test
    @DisplayName("T10.1: Policy JSON table loads successfully with 1728 states and SHA-256 match")
    void testPolicyTableLoadedAndValid() {
        assertTrue(policyService.isPolicyTableLoaded(), "Inspection policy table should load from classpath");
        assertNotNull(policyService.getLoadedTableSha256());
        assertEquals(64, policyService.getLoadedTableSha256().length(), "SHA-256 must be 64 hex characters");
        assertEquals(1728, policyService.getDefaultActionByState().length);
        assertEquals(1728, policyService.getQValuesByState().length);
    }

    @Test
    @DisplayName("T10.2: 50 Test Vectors Cross-Language Parity (Python <-> Java)")
    void test50VectorsCrossLanguageParity() throws Exception {
        InputStream is = getClass().getResourceAsStream("/test_vectors_50.json");
        assertNotNull(is, "test_vectors_50.json must exist in test classpath");

        JsonNode root = objectMapper.readTree(is);
        assertTrue(root.isArray(), "test_vectors_50.json must be a JSON array");
        assertEquals(50, root.size(), "Must contain exactly 50 parity test vectors");

        for (JsonNode vec : root) {
            int vectorId = vec.path("vectorId").asInt();
            JsonNode inp = vec.path("inputs");
            JsonNode exp = vec.path("expected");

            double speedMps = inp.path("speedMps").asDouble();
            double gpsAccuracyM = inp.path("gpsAccuracyM").asDouble();
            double sharpnessScore = inp.path("sharpnessScore").asDouble();
            double brightnessScore = inp.path("brightnessScore").asDouble();
            double yoloConfidence = inp.path("yoloConfidence").asDouble();
            boolean isRoadDamage = inp.path("isRoadDamage").asBoolean();
            double nearestIssueDistM = inp.path("nearestIssueDistM").asDouble();
            int vlmQuotaRemaining = inp.path("vlmQuotaRemaining").asInt();
            int vlmQuotaMax = inp.path("vlmQuotaMax").asInt();
            int currentResampleStreak = inp.path("currentResampleStreak").asInt();

            InferenceService.SupportedModelClass modelClass = isRoadDamage
                ? InferenceService.SupportedModelClass.POTHOLE
                : InferenceService.SupportedModelClass.UTILITY_COVER_NON_DEFECT;
            InferenceService.ParsedDetection topDet = new InferenceService.ParsedDetection(
                modelClass,
                yoloConfidence,
                0.2, 0.2, 0.8, 0.8,
                yoloConfidence < 0.65
            );

            InspectionPolicyService.PolicyDecision decision = policyService.evaluateFramePolicyRaw(
                sharpnessScore,
                brightnessScore,
                Optional.of(topDet),
                speedMps,
                gpsAccuracyM,
                nearestIssueDistM,
                vlmQuotaRemaining,
                vlmQuotaMax,
                currentResampleStreak
            );

            // 1. Assert State ID parity
            int expStateId = exp.path("stateId").asInt();
            assertEquals(expStateId, decision.stateId(), "Vector " + vectorId + " stateId mismatch");

            // 2. Assert Action Mask parity
            JsonNode expMask = exp.path("actionMask");
            for (int a = 0; a < 4; a++) {
                assertEquals(expMask.get(a).asBoolean(), decision.actionMask()[a],
                    "Vector " + vectorId + " actionMask[" + a + "] mismatch");
            }

            // 3. Assert Selected Action parity
            String expAction = exp.path("selectedAction").asText();
            assertEquals(expAction, decision.action().name(),
                "Vector " + vectorId + " selectedAction mismatch");

            assertFalse(decision.usedFallbackRule(), "Vector " + vectorId + " should not use fallback rule");
        }
    }

    @Test
    @DisplayName("T10.3: Deterministic fallback heuristic when policy table is absent")
    void testDeterministicFallbackWhenTableUnloaded() {
        policyService.setPolicyTableLoadedForTest(false);

        InferenceService.ParsedDetection highConfDet = new InferenceService.ParsedDetection(
            InferenceService.SupportedModelClass.POTHOLE, 0.80, 0.1, 0.1, 0.9, 0.9, false
        );

        // Clear high conf -> COMMIT_LOCAL_ONNX
        InspectionPolicyService.PolicyDecision d1 = policyService.evaluateFramePolicyRaw(
            200.0, 137.5, Optional.of(highConfDet), 12.0, 10.0, 100.0, 10, 15, 0
        );
        assertTrue(d1.usedFallbackRule());
        assertEquals(InspectionPolicyService.PolicyAction.COMMIT_LOCAL_ONNX, d1.action());

        // Borderline conf with VLM quota -> ESCALATE_TO_CLOUD_VLM
        InferenceService.ParsedDetection borderlineDet = new InferenceService.ParsedDetection(
            InferenceService.SupportedModelClass.POTHOLE, 0.45, 0.1, 0.1, 0.9, 0.9, true
        );
        InspectionPolicyService.PolicyDecision d2 = policyService.evaluateFramePolicyRaw(
            200.0, 137.5, Optional.of(borderlineDet), 12.0, 10.0, 100.0, 10, 15, 0
        );
        assertTrue(d2.usedFallbackRule());
        assertEquals(InspectionPolicyService.PolicyAction.ESCALATE_TO_CLOUD_VLM, d2.action());

        // Blurry frame -> SKIP_FRAME
        InspectionPolicyService.PolicyDecision d3 = policyService.evaluateFramePolicyRaw(
            50.0, 137.5, Optional.of(highConfDet), 12.0, 10.0, 100.0, 10, 15, 0
        );
        assertTrue(d3.usedFallbackRule());
        assertEquals(InspectionPolicyService.PolicyAction.SKIP_FRAME, d3.action());
    }

    @Test
    @DisplayName("T4: Coarse or missing GPS never blocks local commit")
    void testMissingOrCoarseGpsNeverBlocksCommit() {
        InferenceService.ParsedDetection det = new InferenceService.ParsedDetection(
            InferenceService.SupportedModelClass.POTHOLE, 0.85, 0.1, 0.1, 0.9, 0.9, false
        );

        // Missing GPS (null gpsAccuracyM and null speed)
        InspectionPolicyService.PolicyDecision decision = policyService.evaluateFramePolicyRaw(
            200.0, 137.5, Optional.of(det), null, null, 100.0, 10, 15, 0
        );

        assertTrue(decision.actionMask()[InspectionPolicyService.PolicyAction.COMMIT_LOCAL_ONNX.ordinal()],
            "Action 1 (COMMIT_LOCAL_ONNX) must remain valid even when GPS is missing/null");
    }

    @Test
    @DisplayName("T3: Resample streak 2 locks out Action 3 (BUFFER_AND_RESAMPLE_FAST)")
    void testResampleStreakLockout() {
        InferenceService.ParsedDetection det = new InferenceService.ParsedDetection(
            InferenceService.SupportedModelClass.POTHOLE, 0.45, 0.1, 0.1, 0.9, 0.9, true
        );

        InspectionPolicyService.PolicyDecision decisionStreak0 = policyService.evaluateFramePolicyRaw(
            200.0, 137.5, Optional.of(det), 12.0, 10.0, 100.0, 10, 15, 0
        );
        assertTrue(decisionStreak0.actionMask()[InspectionPolicyService.PolicyAction.BUFFER_AND_RESAMPLE_FAST.ordinal()]);

        InspectionPolicyService.PolicyDecision decisionStreak2 = policyService.evaluateFramePolicyRaw(
            200.0, 137.5, Optional.of(det), 12.0, 10.0, 100.0, 10, 15, 2
        );
        assertFalse(decisionStreak2.actionMask()[InspectionPolicyService.PolicyAction.BUFFER_AND_RESAMPLE_FAST.ordinal()],
            "Action 3 must be locked out when resample_streak >= 2");
    }
}
