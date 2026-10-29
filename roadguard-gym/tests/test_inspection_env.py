"""Unit and integration tests for RoadGuardInspectionEnv-v0 and policy bridge.

Implements tests T1 through T10 from Deliverable F.
"""

import os
import json
import numpy as np
import pytest
import gymnasium as gym
from gymnasium.utils.env_checker import check_env

from roadguard_env.config import (
    Action,
    NUM_STATES,
    NUM_ACTIONS,
    INITIAL_VLM_QUOTA,
    GroundTruthClass,
)
from roadguard_env.inspection_env import RoadGuardInspectionEnv
from roadguard_env.discretizer import (
    compute_action_mask,
    discretize_observation,
    compute_state_id,
    state_id_to_bin_indices,
)
from roadguard_env.trace_generator import PhysicalHazard
from roadguard_env.exporter import export_policy_table, compute_canonical_hash


def test_t1_gymnasium_api_and_deterministic_reset():
    """T1: Passes check_env; two calls with same seed produce bit-identical obs and identical hazards."""
    env = RoadGuardInspectionEnv()
    check_env(env)

    obs1, info1 = env.reset(seed=42)
    hazards1 = [(h.id_k, h.x_k, h.y_true_k) for h in env.hazards]

    obs2, info2 = env.reset(seed=42)
    hazards2 = [(h.id_k, h.x_k, h.y_true_k) for h in env.hazards]

    assert obs1.shape == (8,)
    assert obs1.dtype == np.float32
    assert np.allclose(obs1, obs2)
    assert hazards1 == hazards2
    assert info1["action_mask"].shape == (4,)
    # Observation vector contains only sensor floats in [0, 1], zero ground truth strings or labels
    for val in obs1:
        assert isinstance(float(val), float)
        assert 0.0 <= val <= 1.0


def test_t2_termination_vs_truncation_contract():
    """T2: Reaching x_veh >= 2000m terminates; step_count >= 300 truncates; s_7 == 0 never terminates."""
    env = RoadGuardInspectionEnv()
    obs, info = env.reset(seed=123)

    # Exhaust VLM quota manually
    env.vlm_quota_rem = 0
    # Step action 0
    obs, reward, terminated, truncated, info = env.step(Action.SKIP_FRAME)
    assert not terminated, "Exhausting VLM quota must NEVER terminate the episode!"
    assert not truncated

    # Test corridor end termination
    env.x_veh = 1999.0
    obs, reward, terminated, truncated, info = env.step(Action.SKIP_FRAME)
    assert terminated is True
    assert truncated is False

    # Test step count truncation
    env.reset(seed=456)
    env.step_count = 299
    env.x_veh = 500.0  # far from end
    obs, reward, terminated, truncated, info = env.step(Action.SKIP_FRAME)
    assert terminated is False
    assert truncated is True


def test_t3_action_mask_constraints():
    """T3: Blurry, dark, utility cover, low conf, or duplicate masks out Actions 1 & 2; streak 2 masks Action 3."""
    # Base clear candidate observation: speed=0.2, gps=0.1, sharp=0.7, bright=0.1, conf=0.8, defect=1.0, dup=0.1, vlm=0.5
    base_obs = np.array([0.2, 0.1, 0.7, 0.1, 0.8, 1.0, 0.1, 0.5], dtype=np.float32)
    mask = compute_action_mask(base_obs, resample_streak=0)
    assert mask[0] and mask[1] and mask[2] and mask[3]

    # Blurry image (sharpness < 0.2833)
    blurry_obs = base_obs.copy()
    blurry_obs[2] = 0.20
    m_blur = compute_action_mask(blurry_obs, 0)
    assert not m_blur[1] and not m_blur[2]

    # Dark / overexposed image (brightness_dev >= 1.0)
    dark_obs = base_obs.copy()
    dark_obs[3] = 1.0
    m_dark = compute_action_mask(dark_obs, 0)
    assert not m_dark[1] and not m_dark[2]

    # Utility cover / non-defect (s_5 == 0.0)
    cover_obs = base_obs.copy()
    cover_obs[5] = 0.0
    m_cover = compute_action_mask(cover_obs, 0)
    assert not m_cover[1] and not m_cover[2]

    # Low confidence (< 0.35)
    noise_obs = base_obs.copy()
    noise_obs[4] = 0.30
    m_noise = compute_action_mask(noise_obs, 0)
    assert not m_noise[1] and not m_noise[2]

    # Duplicate proximity (s_6 >= 0.70)
    dup_obs = base_obs.copy()
    dup_obs[6] = 0.85
    m_dup = compute_action_mask(dup_obs, 0)
    assert not m_dup[1] and not m_dup[2] and not m_dup[3]

    # VLM Quota 0 (s_7 == 0.0)
    no_quota_obs = base_obs.copy()
    no_quota_obs[7] = 0.0
    m_no_q = compute_action_mask(no_quota_obs, 0)
    assert m_no_q[1] and not m_no_q[2]  # local commit still allowed, VLM masked out

    # Resample streak == 2
    m_streak2 = compute_action_mask(base_obs, resample_streak=2)
    assert not m_streak2[3]


def test_t4_missing_or_coarse_gps_never_blocks_commit():
    """T4: Missing GPS (s_1 = 1.0) on a sharp high-conf pothole does NOT block commit and earns full +9.6."""
    env = RoadGuardInspectionEnv()
    obs, info = env.reset(seed=999)

    # Set up visible true defect ahead
    env.hazards = [
        PhysicalHazard(id_k=1, x_k=15.0, y_true_k=GroundTruthClass.TRUE_DEFECT, c_true_k=0, severity_k=0.8)
    ]
    env.current_visible_hazard = env.hazards[0]
    # Set observation to coarse GPS (s_1 = 1.0), sharp, high conf
    env.last_obs = np.array([0.25, 1.0, 0.80, 0.10, 0.82, 1.0, 0.0, 0.50], dtype=np.float32)

    mask = compute_action_mask(env.last_obs, 0)
    assert bool(mask[1]) is True, "Coarse or missing GPS must NOT block Action 1 (COMMIT_LOCAL_ONNX)"

    next_obs, reward, terminated, truncated, info = env.step(Action.COMMIT_LOCAL_ONNX)
    assert reward == pytest.approx(9.6, abs=0.01)
    assert env.hazards[0].resolved_k is True


def test_t5_encounter_window_duplicate_prevention():
    """T5: Committing on frame 1 earns +9.6; frame 2 detects duplicate and penalizes if forced."""
    env = RoadGuardInspectionEnv()
    env.reset(seed=888)

    env.x_veh = 0.0
    hazard = PhysicalHazard(id_k=1, x_k=18.0, y_true_k=GroundTruthClass.TRUE_DEFECT, c_true_k=0, severity_k=0.8)
    env.hazards = [hazard]
    env.current_visible_hazard = hazard

    # Frame 1: valid commit
    env.last_obs = np.array([0.25, 0.05, 0.80, 0.10, 0.85, 1.0, 0.0, 0.50], dtype=np.float32)
    _, r1, _, _, _ = env.step(Action.COMMIT_LOCAL_ONNX)
    assert r1 == pytest.approx(9.6, abs=0.01)
    assert hazard.resolved_k is True

    # Frame 2: duplicate attempt while still near defect
    env.last_obs = np.array([0.25, 0.05, 0.80, 0.10, 0.85, 1.0, 0.90, 0.50], dtype=np.float32)
    mask2 = compute_action_mask(env.last_obs, 0)
    assert not bool(mask2[1]), "Frame 2 duplicate must mask out Action 1"

    # Forced commit on duplicate
    _, r2, _, _, _ = env.step(Action.COMMIT_LOCAL_ONNX)
    assert r2 == -6.0


def test_t6_missed_defect_single_penalty_on_window_exit():
    """T6: Skipping across all frames of a true defect applies -6.0 penalty exactly once upon exit."""
    env = RoadGuardInspectionEnv()
    env.reset(seed=777)

    env.x_veh = 0.0
    hazard = PhysicalHazard(id_k=1, x_k=20.0, y_true_k=GroundTruthClass.TRUE_DEFECT, c_true_k=0, severity_k=0.8)
    env.hazards = [hazard]

    # Skip while approaching (x_veh moves from 0 -> ~20m)
    total_exit_penalty = 0.0
    for _ in range(5):
        _, reward, terminated, truncated, info = env.step(Action.SKIP_FRAME)
        total_exit_penalty += info["exit_penalty"]
        if env.x_veh > (hazard.x_k - 3.0):
            break

    assert env.missed_defects == 1
    assert total_exit_penalty == -6.0

    # Ensure subsequent steps do NOT charge the penalty again
    _, _, _, _, info_after = env.step(Action.SKIP_FRAME)
    assert info_after["exit_penalty"] == 0.0
    assert env.missed_defects == 1


def test_t7_false_positive_and_vlm_shadow_rejection():
    """T7: Local commit on shadow patch yields -12.4; VLM escalation on shadow patch yields 0.0 net reward."""
    # Subtest A: Local commit on shadow patch
    env = RoadGuardInspectionEnv()
    env.reset(seed=666)
    shadow_hazard = PhysicalHazard(id_k=2, x_k=15.0, y_true_k=GroundTruthClass.SHADOW_PATCH, c_true_k=-1, severity_k=0.5)
    env.hazards = [shadow_hazard]
    env.current_visible_hazard = shadow_hazard
    env.last_obs = np.array([0.25, 0.05, 0.80, 0.10, 0.55, 1.0, 0.0, 0.50], dtype=np.float32)

    _, r_fp, _, _, _ = env.step(Action.COMMIT_LOCAL_ONNX)
    assert r_fp == pytest.approx(-12.4, abs=0.01)

    # Subtest B: VLM rejection of shadow patch
    env2 = RoadGuardInspectionEnv()
    env2.reset(seed=667)
    shadow_hazard2 = PhysicalHazard(id_k=3, x_k=15.0, y_true_k=GroundTruthClass.SHADOW_PATCH, c_true_k=-1, severity_k=0.5)
    env2.hazards = [shadow_hazard2]
    env2.current_visible_hazard = shadow_hazard2
    env2.last_obs = np.array([0.25, 0.05, 0.80, 0.10, 0.55, 1.0, 0.0, 0.50], dtype=np.float32)

    # Deterministic test: override np_random so VLM rejects (draw < 0.96)
    env2.np_random = np.random.default_rng(10)
    _, r_vlm, _, _, info = env2.step(Action.ESCALATE_TO_CLOUD_VLM)
    # Rejection gives bonus 1.5 - cost 1.5 = 0.0 net
    assert r_vlm == pytest.approx(0.0, abs=0.01)
    assert info["vlm_rejected"] == 1


def test_t8_quota_exhaustion_penalty_and_continuation():
    """T8: Forcing Action 2 when quota == 0 yields -8.0, does not commit, and continues episode."""
    env = RoadGuardInspectionEnv()
    env.reset(seed=555)
    env.vlm_quota_rem = 0
    env.last_obs = np.array([0.25, 0.05, 0.80, 0.10, 0.80, 1.0, 0.0, 0.0], dtype=np.float32)

    _, reward, terminated, truncated, info = env.step(Action.ESCALATE_TO_CLOUD_VLM)
    assert reward == -8.0
    assert not terminated
    assert env.true_positives == 0


def test_t9_discretizer_and_state_id_bijection():
    """Verifies that all 1,728 mixed-radix state IDs map bijectively to/from bin indices."""
    seen_states = set()
    for s_id in range(NUM_STATES):
        bins = state_id_to_bin_indices(s_id)
        assert len(bins) == 8
        recomputed_id = compute_state_id(bins)
        assert recomputed_id == s_id
        seen_states.add(s_id)
    assert len(seen_states) == 1728


def test_t9_100_episode_eval_beats_static_baselines():
    """T9: Trained policy beats StaticThresholdBaseline on reward/F1 and uses >= 40% fewer VLM calls than GreedyVLM."""
    from pathlib import Path
    metrics_path = Path(__file__).resolve().parent.parent / "artifacts" / "eval_metrics_100ep.json"
    assert metrics_path.exists(), "eval_metrics_100ep.json must exist"

    with open(metrics_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    metrics = data["metricsByPolicy"]
    rl = metrics["trained_rl_agent"]
    static_base = metrics["baseline_1_static_threshold"]
    greedy_vlm = metrics["baseline_2_greedy_vlm"]

    # 1. Higher mean episode reward than static threshold
    assert rl["mean_episode_reward"] > static_base["mean_episode_reward"]

    # 2. Higher F1 score than static threshold
    assert rl["defect_f1"] > static_base["defect_f1"]

    # 3. >= 40% fewer VLM calls than GreedyVlmBaseline
    vlm_reduction = 1.0 - (rl["total_vlm_calls"] / greedy_vlm["total_vlm_calls"])
    assert vlm_reduction >= 0.40, f"Expected >= 40% reduction, got {vlm_reduction * 100:.2f}%"


def test_t10_parity_test_vectors_verification():
    """T10: Verifies that 50 generated test vectors match exact discretization and action masking in Python."""
    from pathlib import Path
    vectors_path = Path(__file__).resolve().parent.parent / "artifacts" / "test_vectors_50.json"
    assert vectors_path.exists(), "test_vectors_50.json must exist"

    with open(vectors_path, "r", encoding="utf-8") as f:
        vectors = json.load(f)

    assert len(vectors) == 50
    for vec in vectors:
        inp = vec["inputs"]
        exp = vec["expected"]

        norm_speed = float(np.clip(inp["speedMps"] / 35.0, 0.0, 1.0))
        norm_gps = float(np.clip(inp["gpsAccuracyM"] / 200.0, 0.0, 1.0))
        norm_sharpness = float(np.clip(inp["sharpnessScore"] / 300.0, 0.0, 1.0))
        norm_brightness_dev = float(np.clip(abs(inp["brightnessScore"] - 137.5) / 102.5, 0.0, 1.0))
        norm_conf = float(np.clip(inp["yoloConfidence"], 0.0, 1.0))
        norm_class_defect = 1.0 if inp["isRoadDamage"] else 0.0
        dup_prox = 0.0 if inp["nearestIssueDistM"] >= 50.0 else float(np.clip(1.0 - inp["nearestIssueDistM"] / 50.0, 0.0, 1.0))
        quota_rem = float(np.clip(inp["vlmQuotaRemaining"] / float(inp["vlmQuotaMax"]), 0.0, 1.0))

        obs = np.array([
            norm_speed, norm_gps, norm_sharpness, norm_brightness_dev,
            norm_conf, norm_class_defect, dup_prox, quota_rem
        ], dtype=np.float32)

        bins = discretize_observation(obs)
        state_id = compute_state_id(bins)
        mask = compute_action_mask(obs, inp["currentResampleStreak"])

        assert list(bins) == exp["binIndices"]
        assert state_id == exp["stateId"]
        assert list(mask) == exp["actionMask"]


def test_t10_policy_table_export_and_hash():
    """T10: Exports table, verifies JSON schema, 1728 states, and SHA-256 match."""
    import tempfile
    q_table = np.zeros((NUM_STATES, NUM_ACTIONS), dtype=np.float32)
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        payload = export_policy_table(q_table, tmp_path)
        assert payload["schemaVersion"] == "1.0.0"
        assert payload["numStates"] == 1728
        assert len(payload["defaultActionByState"]) == 1728
        assert len(payload["qValuesByState"]) == 1728
        assert len(payload["tableSha256"]) == 64

        # Read back and verify hash
        with open(tmp_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        recalculated_hash = compute_canonical_hash(data)
        assert recalculated_hash == data["tableSha256"]
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
