"""Policy table exporter producing the canonical inspection_policy_table.json."""

import json
import hashlib
from typing import Dict, Any, List
import numpy as np

from roadguard_env.config import (
    NUM_STATES,
    NUM_ACTIONS,
    ACTION_NAMES,
    FEATURE_NAMES,
    BIN_CUTOFFS,
    RADICES,
    STRIDES,
    DistributionMode,
)
from roadguard_env.discretizer import state_id_to_bin_indices, compute_action_mask


def generate_nominal_obs_from_bins(bins: np.ndarray) -> np.ndarray:
    """Generates a nominal continuous observation representative of the given bin indices."""
    # Midpoints of each bin
    # s_0 (speed): cutoffs [0.06, 0.45] -> bins 0: 0.02, 1: 0.25, 2: 0.70
    speed_vals = [0.02, 0.25, 0.70]
    # s_1 (gps): cutoffs [0.125, 0.75] -> bins 0: 0.05, 1: 0.40, 2: 0.90
    gps_vals = [0.05, 0.40, 0.90]
    # s_2 (sharpness): cutoffs [0.2833, 0.55] -> bins 0: 0.15, 1: 0.40, 2: 0.75
    sharp_vals = [0.15, 0.40, 0.75]
    # s_3 (brightness dev): cutoffs [1.0] -> bins 0: 0.10, 1: 1.0
    bright_vals = [0.10, 1.0]
    # s_4 (conf): cutoffs [0.35, 0.50, 0.65] -> bins 0: 0.20, 1: 0.42, 2: 0.58, 3: 0.80
    conf_vals = [0.20, 0.42, 0.58, 0.80]
    # s_5 (defect class): cutoffs [0.5] -> bins 0: 0.0, 1: 1.0
    defect_vals = [0.0, 1.0]
    # s_6 (duplicate): cutoffs [0.70] -> bins 0: 0.20, 1: 0.85
    dup_vals = [0.20, 0.85]
    # s_7 (vlm quota): cutoffs [0.05] -> bins 0: 0.0, 1: 0.50
    vlm_vals = [0.0, 0.50]

    return np.array([
        speed_vals[bins[0]],
        gps_vals[bins[1]],
        sharp_vals[bins[2]],
        bright_vals[bins[3]],
        conf_vals[bins[4]],
        defect_vals[bins[5]],
        dup_vals[bins[6]],
        vlm_vals[bins[7]],
    ], dtype=np.float32)


def compute_canonical_hash(payload: Dict[str, Any]) -> str:
    """Computes SHA-256 over canonical sorted JSON representation of table data."""
    # Build clean canonical dictionary excluding tableSha256
    clean_dict = {k: v for k, v in payload.items() if k != "tableSha256"}
    canon_bytes = json.dumps(clean_dict, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(canon_bytes).hexdigest()


def export_policy_table(
    q_table: np.ndarray,
    output_path: str,
    distribution_mode: str = "PARAMETRIC_DOMAIN_PRIOR",
) -> Dict[str, Any]:
    """Generates, serializes, hashes, and writes inspection_policy_table.json."""
    if q_table.shape != (NUM_STATES, NUM_ACTIONS):
        raise ValueError(f"Expected q_table of shape ({NUM_STATES}, {NUM_ACTIONS}), got {q_table.shape}")

    default_actions: List[int] = []
    q_values_list: List[List[float]] = []

    for s_id in range(NUM_STATES):
        bins = state_id_to_bin_indices(s_id)
        nominal_obs = generate_nominal_obs_from_bins(bins)
        mask = compute_action_mask(nominal_obs, resample_streak=0)

        q_s = [round(float(q_table[s_id, a]), 4) for a in range(NUM_ACTIONS)]
        q_values_list.append(q_s)

        valid_acts = np.where(mask)[0]
        if len(valid_acts) == 0:
            default_actions.append(0)
        else:
            best_a = valid_acts[0]
            best_q = q_s[best_a]
            for a in valid_acts:
                if q_s[a] > best_q:
                    best_q = q_s[a]
                    best_a = a
            default_actions.append(int(best_a))

    payload = {
        "schemaName": "RoadGuardInspectionPolicyTable",
        "schemaVersion": "1.0.0",
        "environmentId": "RoadGuardInspectionEnv-v0",
        "trainedWithDistributionMode": distribution_mode,
        "numStates": NUM_STATES,
        "numActions": NUM_ACTIONS,
        "actionNames": ACTION_NAMES,
        "featureNames": FEATURE_NAMES,
        "binCutoffs": BIN_CUTOFFS,
        "radices": RADICES,
        "strides": STRIDES,
        "defaultActionByState": default_actions,
        "qValuesByState": q_values_list,
    }

    sha256_hash = compute_canonical_hash(payload)
    payload["tableSha256"] = sha256_hash

    with open(output_path, mode="w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    return payload
