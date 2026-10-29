"""Configuration, constants, and hyperparameters for RoadGuardInspectionEnv-v0."""

from enum import Enum
from typing import Dict, List, Tuple
from dataclasses import dataclass


class Action(int, Enum):
    SKIP_FRAME = 0
    COMMIT_LOCAL_ONNX = 1
    ESCALATE_TO_CLOUD_VLM = 2
    BUFFER_AND_RESAMPLE_FAST = 3


ACTION_NAMES = [
    "SKIP_FRAME",
    "COMMIT_LOCAL_ONNX",
    "ESCALATE_TO_CLOUD_VLM",
    "BUFFER_AND_RESAMPLE_FAST",
]

NUM_ACTIONS = len(ACTION_NAMES)

FEATURE_NAMES = [
    "norm_speed",
    "norm_gps_uncertainty",
    "norm_sharpness",
    "norm_brightness_dev",
    "yolo_max_conf",
    "yolo_class_is_defect",
    "dup_cluster_proximity",
    "nim_vlm_quota_rem",
]

NUM_FEATURES = len(FEATURE_NAMES)

RADICES = [3, 3, 3, 2, 4, 2, 2, 2]
STRIDES = [576, 192, 64, 32, 8, 4, 2, 1]
NUM_STATES = 1728

BIN_CUTOFFS: Dict[str, List[float]] = {
    "norm_speed": [0.06, 0.45],
    "norm_gps_uncertainty": [0.125, 0.75],
    "norm_sharpness": [0.2833, 0.55],
    "norm_brightness_dev": [1.0],
    "yolo_max_conf": [0.35, 0.50, 0.65],
    "yolo_class_is_defect": [0.5],
    "dup_cluster_proximity": [0.70],
    "nim_vlm_quota_rem": [0.05],
}

# Corridor and Episode Constraints
CORRIDOR_LENGTH_M = 2000.0
MAX_EPISODE_STEPS = 300
INITIAL_VLM_QUOTA = 15

# Time intervals
DT_NORMAL_SEC = 2.0
DT_FAST_SEC = 0.8

# Camera viewing frustum relative to front bumper (meters)
FRUSTUM_NEAR_M = 3.0
FRUSTUM_FAR_M = 28.0

# Reward function coefficients
R_TP_BASE = 10.0
COST_STORAGE = -0.4
PENALTY_BORDERLINE = -0.5
PENALTY_INVALID_COMMIT = -12.0
PENALTY_DUPLICATE_COMMIT = -6.0
PENALTY_FALSE_POSITIVE = -12.4
COST_VLM = -1.5
BONUS_FP_AVOIDANCE = 1.5
PENALTY_QUOTA_EXHAUSTED = -8.0
PENALTY_WASTED_VLM = -8.0
COST_RESAMPLE = -0.3
PENALTY_INVALID_RESAMPLE = -2.0
PENALTY_MISSED_DEFECT = -6.0

# VLM inspection probabilities
VLM_TPR = 0.94
VLM_TNR = 0.96


class GroundTruthClass(str, Enum):
    TRUE_DEFECT = "TRUE_DEFECT"
    UTILITY_COVER = "UTILITY_COVER"
    SHADOW_PATCH = "SHADOW_PATCH"
    CLEAN_ASPHALT = "CLEAN_ASPHALT"


class DistributionMode(str, Enum):
    PARAMETRIC_DOMAIN_PRIOR = "PARAMETRIC_DOMAIN_PRIOR"
    EMPIRICAL_CSV_REPLAY = "EMPIRICAL_CSV_REPLAY"


@dataclass
class TraceGeneratorConfig:
    distribution_mode: DistributionMode = DistributionMode.PARAMETRIC_DOMAIN_PRIOR
    mean_hazards_per_corridor: float = 12.0
    true_defect_ratio: float = 0.65
    utility_cover_ratio: float = 0.12
    shadow_patch_ratio: float = 0.15
    clean_asphalt_ratio: float = 0.08
    mean_speed_mps: float = 11.5
    std_speed_mps: float = 5.0
    csv_trace_path: str = ""
