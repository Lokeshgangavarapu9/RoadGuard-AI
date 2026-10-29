"""Discretizer, mixed-radix state ID encoder/decoder, and action mask logic."""

import numpy as np
from typing import List, Tuple
from roadguard_env.config import (
    STRIDES,
    RADICES,
    NUM_STATES,
    NUM_FEATURES,
    BIN_CUTOFFS,
    FEATURE_NAMES,
)


def discretize_feature(val: float, cutoffs: List[float]) -> int:
    """Discretizes a single float feature into a bin index in [0, len(cutoffs)]."""
    val = float(np.clip(val, 0.0, 1.0))
    for i, cutoff in enumerate(cutoffs):
        if val < cutoff:
            return i
    return len(cutoffs)


def discretize_observation(obs: np.ndarray) -> np.ndarray:
    """Converts continuous 8D observation vector into 8 discrete bin indices."""
    if len(obs) != NUM_FEATURES:
        raise ValueError(f"Expected observation of shape ({NUM_FEATURES},), got {len(obs)}")

    bins = np.zeros(NUM_FEATURES, dtype=np.int32)
    for i, name in enumerate(FEATURE_NAMES):
        bins[i] = discretize_feature(obs[i], BIN_CUTOFFS[name])
    return bins


def compute_state_id(bin_indices: np.ndarray) -> int:
    """Calculates mixed-radix state index from 8 bin indices using exact strides.

    state_id = sum(bin_indices[i] * strides[i])
             = 576*b0 + 192*b1 + 64*b2 + 32*b3 + 8*b4 + 4*b5 + 2*b6 + b7
    """
    if len(bin_indices) != NUM_FEATURES:
        raise ValueError(f"Expected {NUM_FEATURES} bin indices, got {len(bin_indices)}")

    state_id = 0
    for i in range(NUM_FEATURES):
        b = int(bin_indices[i])
        if b < 0 or b >= RADICES[i]:
            raise ValueError(
                f"Bin index {b} for feature {FEATURE_NAMES[i]} out of range [0, {RADICES[i]-1}]"
            )
        state_id += b * STRIDES[i]

    if state_id < 0 or state_id >= NUM_STATES:
        raise ValueError(f"Computed state_id {state_id} out of bounds [0, {NUM_STATES-1}]")
    return state_id


def state_id_to_bin_indices(state_id: int) -> np.ndarray:
    """Decodes a state ID back into 8 bin indices using mixed-radix division."""
    if state_id < 0 or state_id >= NUM_STATES:
        raise ValueError(f"State ID {state_id} out of bounds [0, {NUM_STATES-1}]")

    bins = np.zeros(NUM_FEATURES, dtype=np.int32)
    rem = state_id
    for i in range(NUM_FEATURES):
        bins[i] = rem // STRIDES[i]
        rem = rem % STRIDES[i]
    return bins


def compute_action_mask(obs: np.ndarray, resample_streak: int = 0) -> np.ndarray:
    """Computes boolean action mask [mask_0, mask_1, mask_2, mask_3] for given observation.

    - Action 0 (SKIP_FRAME): Always True.
    - Action 1 (COMMIT_LOCAL_ONNX): Valid iff image clear (s_2 >= 0.2833 and s_3 < 1.0),
      defect class (s_5 >= 0.5), confidence >= 0.35 (s_4 >= 0.35), and not a duplicate (s_6 < 0.70).
      Note: s_1 (coarse or missing GPS) does NOT block Action 1!
    - Action 2 (ESCALATE_TO_CLOUD_VLM): Valid iff Action 1 preconditions hold AND
      vlm_quota_rem s_7 >= 0.05.
    - Action 3 (BUFFER_AND_RESAMPLE_FAST): Valid iff candidate signal exists (s_4 >= 0.25 and s_5 >= 0.5),
      vehicle is moving (s_0 >= 0.06), not already a duplicate (s_6 < 0.70), and resample_streak < 2.
    """
    s_0 = float(obs[0])  # norm_speed
    s_1 = float(obs[1])  # norm_gps_uncertainty
    s_2 = float(obs[2])  # norm_sharpness
    s_3 = float(obs[3])  # norm_brightness_dev
    s_4 = float(obs[4])  # yolo_max_conf
    s_5 = float(obs[5])  # yolo_class_is_defect
    s_6 = float(obs[6])  # dup_cluster_proximity
    s_7 = float(obs[7])  # nim_vlm_quota_rem

    mask = np.zeros(4, dtype=bool)

    # 0: SKIP_FRAME is always valid
    mask[0] = True

    # 1: COMMIT_LOCAL_ONNX
    is_image_clear = (s_2 >= 0.2833) and (s_3 < 1.0)
    is_defect_class = (s_5 >= 0.5)
    is_confident_enough = (s_4 >= 0.35)
    is_not_duplicate = (s_6 < 0.70)

    can_commit_local = (
        is_image_clear
        and is_defect_class
        and is_confident_enough
        and is_not_duplicate
    )
    mask[1] = can_commit_local

    # 2: ESCALATE_TO_CLOUD_VLM
    has_vlm_quota = (s_7 >= 0.05)
    mask[2] = can_commit_local and has_vlm_quota

    # 3: BUFFER_AND_RESAMPLE_FAST
    has_candidate_signal = (s_4 >= 0.25) and is_defect_class
    is_vehicle_moving = (s_0 >= 0.06)
    can_resample = (
        has_candidate_signal
        and is_vehicle_moving
        and is_not_duplicate
        and (resample_streak < 2)
    )
    mask[3] = can_resample

    return mask
