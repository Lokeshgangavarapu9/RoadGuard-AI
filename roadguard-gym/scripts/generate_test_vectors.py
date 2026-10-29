"""Generates 50 deterministic parity test vectors for cross-language validation (Python <-> Java)."""

import json
import sys
from pathlib import Path

current_dir = Path(__file__).resolve().parent
pkg_root = current_dir.parent
sys.path.insert(0, str(pkg_root))

import numpy as np

from roadguard_env.config import (
    ACTION_NAMES,
    INITIAL_VLM_QUOTA,
)
from roadguard_env.discretizer import (
    discretize_observation,
    compute_state_id,
    compute_action_mask,
)

current_dir = Path(__file__).resolve().parent
pkg_root = current_dir.parent
backend_res_dir = pkg_root.parent / "roadguard-backend" / "src" / "test" / "resources"
backend_res_dir.mkdir(parents=True, exist_ok=True)
policy_table_path = pkg_root.parent / "roadguard-backend" / "src" / "main" / "resources" / "models" / "inspection_policy_table.json"

with open(policy_table_path, "r", encoding="utf-8") as f:
    policy_table = json.load(f)

q_values_by_state = policy_table["qValuesByState"]
default_action_by_state = policy_table["defaultActionByState"]

test_vectors = []
rng = np.random.default_rng(2026)

# Specific curated scenarios
scenarios = [
    # 0: Ideal highway high-conf pothole with clear image and precise GPS
    {"v_mps": 22.0, "sigma_gps": 8.0, "lap_var": 220.0, "brightness": 138.0, "conf": 0.88, "is_defect": True, "dup_dist": 60.0, "q_rem": 10, "q_max": 15, "streak": 0},
    # 1: Blurry frame (Laplacian < 85)
    {"v_mps": 12.0, "sigma_gps": 15.0, "lap_var": 60.0, "brightness": 135.0, "conf": 0.75, "is_defect": True, "dup_dist": 100.0, "q_rem": 10, "q_max": 15, "streak": 0},
    # 2: Dark frame (brightness <= 35)
    {"v_mps": 10.0, "sigma_gps": 12.0, "lap_var": 190.0, "brightness": 25.0, "conf": 0.80, "is_defect": True, "dup_dist": 100.0, "q_rem": 10, "q_max": 15, "streak": 0},
    # 3: Overexposed frame (brightness >= 240)
    {"v_mps": 14.0, "sigma_gps": 10.0, "lap_var": 180.0, "brightness": 248.0, "conf": 0.85, "is_defect": True, "dup_dist": 100.0, "q_rem": 10, "q_max": 15, "streak": 0},
    # 4: Utility cover (non-defect, class 4)
    {"v_mps": 11.0, "sigma_gps": 9.0, "lap_var": 210.0, "brightness": 140.0, "conf": 0.90, "is_defect": False, "dup_dist": 80.0, "q_rem": 10, "q_max": 15, "streak": 0},
    # 5: Low confidence noise (< 0.35)
    {"v_mps": 8.0, "sigma_gps": 14.0, "lap_var": 150.0, "brightness": 120.0, "conf": 0.28, "is_defect": True, "dup_dist": 90.0, "q_rem": 10, "q_max": 15, "streak": 0},
    # 6: Borderline candidate with VLM quota available
    {"v_mps": 11.5, "sigma_gps": 12.0, "lap_var": 175.0, "brightness": 130.0, "conf": 0.45, "is_defect": True, "dup_dist": 75.0, "q_rem": 8, "q_max": 15, "streak": 0},
    # 7: Duplicate defect nearby (dist <= 15m)
    {"v_mps": 9.0, "sigma_gps": 8.0, "lap_var": 200.0, "brightness": 138.0, "conf": 0.85, "is_defect": True, "dup_dist": 8.0, "q_rem": 10, "q_max": 15, "streak": 0},
    # 8: Exhausted VLM quota (0 remaining)
    {"v_mps": 15.0, "sigma_gps": 10.0, "lap_var": 190.0, "brightness": 138.0, "conf": 0.55, "is_defect": True, "dup_dist": 100.0, "q_rem": 0, "q_max": 15, "streak": 0},
    # 9: Coarse GPS (149m uncertainty)
    {"v_mps": 13.0, "sigma_gps": 149.0, "lap_var": 210.0, "brightness": 138.0, "conf": 0.82, "is_defect": True, "dup_dist": 100.0, "q_rem": 10, "q_max": 15, "streak": 0},
    # 10: Null / missing GPS (sigma = 200m)
    {"v_mps": 0.0, "sigma_gps": 250.0, "lap_var": 210.0, "brightness": 138.0, "conf": 0.85, "is_defect": True, "dup_dist": 100.0, "q_rem": 10, "q_max": 15, "streak": 0},
    # 11: Resample streak 2 (should lock out Action 3)
    {"v_mps": 10.0, "sigma_gps": 10.0, "lap_var": 170.0, "brightness": 138.0, "conf": 0.42, "is_defect": True, "dup_dist": 80.0, "q_rem": 10, "q_max": 15, "streak": 2},
]

# Add randomized diverse scenarios to reach 50
for i in range(len(scenarios), 50):
    scenarios.append({
        "v_mps": float(rng.choice([0.0, 1.5, 8.0, 15.0, 25.0])),
        "sigma_gps": float(rng.choice([5.0, 20.0, 80.0, 149.0, 200.0])),
        "lap_var": float(rng.choice([40.0, 84.0, 120.0, 170.0, 260.0])),
        "brightness": float(rng.choice([20.0, 80.0, 137.5, 200.0, 245.0])),
        "conf": float(rng.choice([0.15, 0.34, 0.45, 0.60, 0.85])),
        "is_defect": bool(rng.choice([True, False])),
        "dup_dist": float(rng.choice([5.0, 14.0, 25.0, 60.0, 120.0])),
        "q_rem": int(rng.choice([0, 1, 5, 15])),
        "q_max": 15,
        "streak": int(rng.choice([0, 1, 2])),
    })

for idx, sc in enumerate(scenarios):
    # Compute normalized observation
    norm_speed = float(np.clip(sc["v_mps"] / 35.0, 0.0, 1.0))
    norm_gps = float(np.clip(sc["sigma_gps"] / 200.0, 0.0, 1.0))
    norm_sharpness = float(np.clip(sc["lap_var"] / 300.0, 0.0, 1.0))
    norm_brightness_dev = float(np.clip(abs(sc["brightness"] - 137.5) / 102.5, 0.0, 1.0))
    norm_conf = float(np.clip(sc["conf"], 0.0, 1.0))
    norm_class_defect = 1.0 if sc["is_defect"] else 0.0
    dup_prox = 0.0 if sc["dup_dist"] >= 50.0 else float(np.clip(1.0 - sc["dup_dist"] / 50.0, 0.0, 1.0))
    quota_rem = float(np.clip(sc["q_rem"] / float(sc["q_max"]), 0.0, 1.0))

    obs = np.array([
        norm_speed, norm_gps, norm_sharpness, norm_brightness_dev,
        norm_conf, norm_class_defect, dup_prox, quota_rem
    ], dtype=np.float32)

    bins = discretize_observation(obs)
    state_id = compute_state_id(bins)
    mask = compute_action_mask(obs, sc["streak"])

    # Determine policy action from Q-table using mask
    q_s = q_values_by_state[state_id]
    valid_acts = np.where(mask)[0]
    best_a = valid_acts[0]
    best_q = q_s[best_a]
    for a in valid_acts:
        if q_s[a] > best_q:
            best_q = q_s[a]
            best_a = a

    action_name = ACTION_NAMES[best_a]

    test_vectors.append({
        "vectorId": idx,
        "inputs": {
            "speedMps": sc["v_mps"],
            "gpsAccuracyM": sc["sigma_gps"],
            "sharpnessScore": sc["lap_var"],
            "brightnessScore": sc["brightness"],
            "yoloConfidence": sc["conf"],
            "isRoadDamage": sc["is_defect"],
            "nearestIssueDistM": sc["dup_dist"],
            "vlmQuotaRemaining": sc["q_rem"],
            "vlmQuotaMax": sc["q_max"],
            "currentResampleStreak": sc["streak"],
        },
        "expected": {
            "normalizedObservation": [round(float(x), 4) for x in obs],
            "binIndices": [int(x) for x in bins],
            "stateId": int(state_id),
            "actionMask": [bool(x) for x in mask],
            "selectedAction": action_name,
            "selectedQValue": round(float(best_q), 4),
        }
    })

out_backend = backend_res_dir / "test_vectors_50.json"
out_gym = pkg_root / "artifacts" / "test_vectors_50.json"

with open(out_backend, "w", encoding="utf-8") as f:
    json.dump(test_vectors, f, indent=2)

with open(out_gym, "w", encoding="utf-8") as f:
    json.dump(test_vectors, f, indent=2)

print(f"Generated 50 test vectors successfully.")
print(f"Backend path: {out_backend}")
print(f"Gym path: {out_gym}")
