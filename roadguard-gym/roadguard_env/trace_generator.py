"""Trace generator for RoadGuardInspectionEnv-v0.

Supports:
1. Mode A: PARAMETRIC_DOMAIN_PRIOR (default)
   Documented parametric distributions (Poisson, Beta, Gamma, Truncated Normal)
   calibrated to realistic road monitoring priors. Never claimed to be empirical field data.
2. Mode B: EMPIRICAL_CSV_REPLAY
   Loads real driving traces / evidence frames exported from PostgreSQL or CSV logs.
"""

from dataclasses import dataclass
from typing import List, Optional, Tuple, Dict, Any
import numpy as np

from roadguard_env.config import (
    GroundTruthClass,
    DistributionMode,
    CORRIDOR_LENGTH_M,
    FRUSTUM_NEAR_M,
    FRUSTUM_FAR_M,
    INITIAL_VLM_QUOTA,
)


@dataclass
class PhysicalHazard:
    id_k: int
    x_k: float  # longitudinal position in meters along corridor
    y_true_k: GroundTruthClass  # TRUE_DEFECT, UTILITY_COVER, SHADOW_PATCH, CLEAN_ASPHALT
    c_true_k: int  # 0: POTHOLE, 1: LONGITUDINAL_CRACK, 2: TRANSVERSE_CRACK, 3: ALLIGATOR_CRACK, 4: UTILITY_COVER
    severity_k: float  # [0.4, 1.0]
    resolved_k: bool = False
    exited_window: bool = False


class TraceGenerator:
    """Generates or replays driving traces and physical hazard distributions."""

    def __init__(
        self,
        mode: DistributionMode = DistributionMode.PARAMETRIC_DOMAIN_PRIOR,
        mean_hazards: float = 12.0,
        corridor_length: float = CORRIDOR_LENGTH_M,
        csv_file_path: Optional[str] = None,
    ):
        self.mode = mode
        self.mean_hazards = mean_hazards
        self.corridor_length = corridor_length
        self.csv_file_path = csv_file_path
        self._empirical_traces: List[Dict[str, Any]] = []

        if self.mode == DistributionMode.EMPIRICAL_CSV_REPLAY and csv_file_path:
            self._load_csv_traces(csv_file_path)

    def _load_csv_traces(self, path: str) -> None:
        """Loads real driving logs if provided."""
        # Simple CSV loader if file exists
        import csv
        try:
            with open(path, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                self._empirical_traces = list(reader)
        except Exception:
            self._empirical_traces = []

    def generate_corridor_hazards(self, rng: np.random.Generator) -> List[PhysicalHazard]:
        """Generates sorted list of physical hazards along the 2000m corridor."""
        if self.mode == DistributionMode.EMPIRICAL_CSV_REPLAY and self._empirical_traces:
            # Replay from empirical data if available
            hazards = []
            for i, row in enumerate(self._empirical_traces):
                x = float(row.get("x_pos", 50.0 + i * 150.0))
                c_idx = int(row.get("class_index", 0))
                y_class = GroundTruthClass.TRUE_DEFECT if c_idx < 4 else GroundTruthClass.UTILITY_COVER
                hazards.append(PhysicalHazard(
                    id_k=i,
                    x_k=x,
                    y_true_k=y_class,
                    c_true_k=c_idx,
                    severity_k=float(row.get("severity", 0.7)),
                ))
            hazards.sort(key=lambda h: h.x_k)
            return hazards

        # Mode A: PARAMETRIC_DOMAIN_PRIOR
        # Sample K ~ Poisson(lambda = 12)
        k_count = int(rng.poisson(lam=self.mean_hazards))
        k_count = max(4, min(k_count, 25))

        # Uniform locations along corridor (20m to corridor_length - 20m)
        positions = rng.uniform(20.0, self.corridor_length - 20.0, size=k_count)
        positions.sort()

        hazards = []
        for i, x in enumerate(positions):
            # Prior hazard class distribution:
            # ~70% true defects (pothole, cracks)
            # ~15% utility covers (tampa_bueiro)
            # ~15% shadow patches
            p_type = rng.random()
            if p_type < 0.70:
                y_class = GroundTruthClass.TRUE_DEFECT
                # Defect classes 0..3: 0: pothole, 1: long crack, 2: trans crack, 3: alligator crack
                c_true = int(rng.choice([0, 1, 2, 3], p=[0.40, 0.25, 0.20, 0.15]))
            elif p_type < 0.85:
                y_class = GroundTruthClass.UTILITY_COVER
                c_true = 4
            else:
                y_class = GroundTruthClass.SHADOW_PATCH
                c_true = -1  # Not a real defect or utility cover

            severity = float(rng.uniform(0.4, 1.0))
            hazards.append(PhysicalHazard(
                id_k=i,
                x_k=float(x),
                y_true_k=y_class,
                c_true_k=c_true,
                severity_k=severity,
                resolved_k=False,
                exited_window=False,
            ))

        return hazards

    def sample_environment_step_sensors(
        self,
        rng: np.random.Generator,
        x_veh: float,
        v_mps: float,
        visible_hazard: Optional[PhysicalHazard],
        dup_distance_m: float,
        vlm_quota_rem: int,
        vlm_quota_max: int = INITIAL_VLM_QUOTA,
        is_resampled: bool = False,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Samples noisy 8D sensor observation o_t for the current frame.

        Features:
        0: norm_speed = clip(v_mps / 35.0, 0, 1)
        1: norm_gps_uncertainty = clip(sigma_gps_m / 200.0, 0, 1)
        2: norm_sharpness = clip(LaplacianVar / 300.0, 0, 1)
        3: norm_brightness_dev = clip(|B - 137.5| / 102.5, 0, 1)
        4: yolo_max_conf = max_{c} p_c in [0, 1]
        5: yolo_class_is_defect = 1.0 if argmax in {0,1,2,3} else 0.0
        6: dup_cluster_proximity = clip(1.0 - d_dup / 50.0, 0, 1)
        7: nim_vlm_quota_rem = clip(Q_rem / Q_max, 0, 1)
        """
        # Feature 0: Speed
        norm_speed = float(np.clip(v_mps / 35.0, 0.0, 1.0))

        # Feature 1: GPS Uncertainty (Mixture: 70% GNSS accurate, 20% Wi-Fi ~97m, 10% coarse/lost ~149-200m)
        gps_mode = rng.random()
        if gps_mode < 0.70:
            sigma_gps = float(rng.gamma(shape=3.0, scale=3.0))  # mean ~9m (precise < 25m)
        elif gps_mode < 0.90:
            sigma_gps = float(rng.normal(loc=97.0, scale=20.0))  # urban canyon / approximate
        else:
            sigma_gps = float(rng.uniform(149.0, 220.0))  # coarse / unlocated
        norm_gps = float(np.clip(sigma_gps / 200.0, 0.0, 1.0))

        # Feature 2: Sharpness (LaplacianVar / 300.0)
        # Resampled frame is sharper (closer to object, optimized shutter)
        if is_resampled:
            laplacian_var = float(rng.normal(loc=210.0, scale=30.0))
        elif v_mps > 15.0:
            # Motion blur at higher speeds
            laplacian_var = float(rng.normal(loc=130.0, scale=50.0))
        else:
            laplacian_var = float(rng.normal(loc=180.0, scale=45.0))
        laplacian_var = max(10.0, laplacian_var)
        norm_sharpness = float(np.clip(laplacian_var / 300.0, 0.0, 1.0))

        # Feature 3: Brightness deviation (|B - 137.5| / 102.5)
        # B in [0, 255]. Mostly well-lit (B ~ 130..150), occasionally tunnel or direct glare
        if rng.random() < 0.92:
            brightness = float(rng.normal(loc=138.0, scale=25.0))
        else:
            brightness = float(rng.choice([25.0, 245.0]))  # too dark or overexposed
        brightness = np.clip(brightness, 0.0, 255.0)
        norm_brightness_dev = float(np.clip(abs(brightness - 137.5) / 102.5, 0.0, 1.0))

        # Features 4 & 5: YOLO Confidence & Class
        if visible_hazard is None:
            # Background asphalt / noise
            conf = float(rng.beta(1.5, 8.0))  # typically < 0.25
            class_is_defect = 0.0
            pred_class = 4
        else:
            dist = visible_hazard.x_k - x_veh
            # Confidence improves as vehicle approaches near edge (closer = higher conf)
            proximity_factor = 1.0 - (dist - FRUSTUM_NEAR_M) / (FRUSTUM_FAR_M - FRUSTUM_NEAR_M)
            proximity_factor = np.clip(proximity_factor, 0.0, 1.0)

            if visible_hazard.y_true_k == GroundTruthClass.TRUE_DEFECT:
                # True defect: Beta(5.5, 2.5) mean 0.69, boosted up to 0.85 when close
                base_conf = float(rng.beta(5.5, 2.5))
                conf = float(np.clip(base_conf + 0.15 * proximity_factor, 0.20, 0.98))
                # Occasionally misclassified as utility cover or vice-versa
                if rng.random() < 0.96:
                    class_is_defect = 1.0
                    pred_class = visible_hazard.c_true_k
                else:
                    class_is_defect = 0.0
                    pred_class = 4

            elif visible_hazard.y_true_k == GroundTruthClass.UTILITY_COVER:
                # Utility cover (tampa_bueiro) - correctly predicted as class 4 (non-defect) 92% of time
                base_conf = float(rng.beta(5.0, 3.0))
                conf = float(np.clip(base_conf, 0.25, 0.92))
                if rng.random() < 0.92:
                    class_is_defect = 0.0
                    pred_class = 4
                else:
                    class_is_defect = 1.0
                    pred_class = 0  # misclassified as pothole

            elif visible_hazard.y_true_k == GroundTruthClass.SHADOW_PATCH:
                # Shadow patch: Beta(3.2, 4.0) mean 0.44 - frequently falling into borderline [0.35, 0.65)
                conf = float(rng.beta(3.2, 4.0))
                # 85% of time classified as defect candidate (e.g. pothole lookalike)
                if rng.random() < 0.85:
                    class_is_defect = 1.0
                    pred_class = int(rng.choice([0, 1, 2]))
                else:
                    class_is_defect = 0.0
                    pred_class = 4
            else:
                conf = float(rng.beta(1.5, 7.0))
                class_is_defect = 0.0
                pred_class = 4

        norm_yolo_conf = float(np.clip(conf, 0.0, 1.0))
        norm_class_defect = 1.0 if class_is_defect >= 0.5 else 0.0

        # Feature 6: Duplicate proximity
        if dup_distance_m >= 50.0:
            dup_proximity = 0.0
        else:
            dup_proximity = float(np.clip(1.0 - dup_distance_m / 50.0, 0.0, 1.0))

        # Feature 7: VLM Quota Remaining
        quota_rem = float(np.clip(vlm_quota_rem / float(vlm_quota_max), 0.0, 1.0))

        obs = np.array([
            norm_speed,
            norm_gps,
            norm_sharpness,
            norm_brightness_dev,
            norm_yolo_conf,
            norm_class_defect,
            dup_proximity,
            quota_rem,
        ], dtype=np.float32)

        raw_meta = {
            "v_mps": v_mps,
            "sigma_gps": sigma_gps,
            "laplacian_var": laplacian_var,
            "brightness": brightness,
            "yolo_conf": conf,
            "yolo_class": pred_class,
            "dup_dist_m": dup_distance_m,
            "vlm_quota": vlm_quota_rem,
        }

        return obs, raw_meta
