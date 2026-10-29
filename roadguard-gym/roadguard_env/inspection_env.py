"""RoadGuardInspectionEnv-v0 implementation conforming to Farama Gymnasium >= 1.0.0."""

import gymnasium as gym
from gymnasium import spaces
import numpy as np
from typing import Dict, Any, Optional, Tuple, List

from roadguard_env.config import (
    Action,
    ACTION_NAMES,
    NUM_ACTIONS,
    NUM_FEATURES,
    CORRIDOR_LENGTH_M,
    MAX_EPISODE_STEPS,
    INITIAL_VLM_QUOTA,
    DT_NORMAL_SEC,
    DT_FAST_SEC,
    FRUSTUM_NEAR_M,
    FRUSTUM_FAR_M,
    VLM_TPR,
    VLM_TNR,
    GroundTruthClass,
    DistributionMode,
)
from roadguard_env.discretizer import compute_action_mask, discretize_observation, compute_state_id
from roadguard_env.trace_generator import TraceGenerator, PhysicalHazard


class RoadGuardInspectionEnv(gym.Env):
    """RoadGuard Autonomous Inspection POMDP Environment.

    Observation space: Box(0.0, 1.0, shape=(8,), dtype=float32)
    Action space: Discrete(4)
        0: SKIP_FRAME
        1: COMMIT_LOCAL_ONNX
        2: ESCALATE_TO_CLOUD_VLM
        3: BUFFER_AND_RESAMPLE_FAST
    """

    metadata = {"render_modes": []}

    def __init__(
        self,
        distribution_mode: DistributionMode = DistributionMode.PARAMETRIC_DOMAIN_PRIOR,
        csv_file_path: Optional[str] = None,
        corridor_length: float = CORRIDOR_LENGTH_M,
        max_episode_steps: int = MAX_EPISODE_STEPS,
        initial_vlm_quota: int = INITIAL_VLM_QUOTA,
    ):
        super().__init__()

        self.distribution_mode = distribution_mode
        self.csv_file_path = csv_file_path
        self.corridor_length = corridor_length
        self.max_episode_steps = max_episode_steps
        self.initial_vlm_quota = initial_vlm_quota

        self.trace_gen = TraceGenerator(
            mode=self.distribution_mode,
            corridor_length=self.corridor_length,
            csv_file_path=self.csv_file_path,
        )

        self.observation_space = spaces.Box(
            low=0.0,
            high=1.0,
            shape=(NUM_FEATURES,),
            dtype=np.float32,
        )
        self.action_space = spaces.Discrete(NUM_ACTIONS)

        # Internal state variables
        self.x_veh: float = 0.0
        self.v_mps: float = 11.5  # Typical vehicle cruise speed (~41 km/h)
        self.step_count: int = 0
        self.vlm_quota_rem: int = self.initial_vlm_quota
        self.resample_streak: int = 0

        # Ground truth hidden world state z_t (never directly returned in obs)
        self.hazards: List[PhysicalHazard] = []
        self.persisted_issue_locations: List[float] = []

        # Current frame visible hazard
        self.current_visible_hazard: Optional[PhysicalHazard] = None
        self.last_obs: np.ndarray = np.zeros(NUM_FEATURES, dtype=np.float32)

        # Cumulative episode evaluation counters
        self.true_positives: int = 0
        self.false_positives: int = 0
        self.missed_defects: int = 0
        self.vlm_calls: int = 0
        self.vlm_confirmed: int = 0
        self.vlm_rejected: int = 0
        self.total_reward: float = 0.0

    def _get_visible_hazard(self) -> Optional[PhysicalHazard]:
        """Finds closest hazard in viewing frustum [x_veh + 3m, x_veh + 28m]."""
        near = self.x_veh + FRUSTUM_NEAR_M
        far = self.x_veh + FRUSTUM_FAR_M
        candidates = [h for h in self.hazards if near <= h.x_k <= far]
        if not candidates:
            return None
        # Return the closest hazard ahead of the bumper
        candidates.sort(key=lambda h: h.x_k)
        return candidates[0]

    def _get_dup_distance(self, target_x: float) -> float:
        """Computes minimum distance in meters to any previously committed database issue."""
        if not self.persisted_issue_locations:
            return 999.0
        return min(abs(target_x - px) for px in self.persisted_issue_locations)

    def reset(
        self,
        *,
        seed: Optional[int] = None,
        options: Optional[Dict[str, Any]] = None,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        super().reset(seed=seed)

        self.x_veh = 0.0
        # Speed profile: Truncated Normal(11.5 m/s, std=2.5) in [0.0, 30.0]
        self.v_mps = float(np.clip(self.np_random.normal(11.5, 2.5), 2.0, 25.0))
        self.step_count = 0
        self.vlm_quota_rem = self.initial_vlm_quota
        self.resample_streak = 0

        self.hazards = self.trace_gen.generate_corridor_hazards(self.np_random)
        self.persisted_issue_locations = []

        self.true_positives = 0
        self.false_positives = 0
        self.missed_defects = 0
        self.vlm_calls = 0
        self.vlm_confirmed = 0
        self.vlm_rejected = 0
        self.total_reward = 0.0

        self.current_visible_hazard = self._get_visible_hazard()
        target_x = self.current_visible_hazard.x_k if self.current_visible_hazard else (self.x_veh + 15.0)
        dup_dist = self._get_dup_distance(target_x)

        obs, _ = self.trace_gen.sample_environment_step_sensors(
            rng=self.np_random,
            x_veh=self.x_veh,
            v_mps=self.v_mps,
            visible_hazard=self.current_visible_hazard,
            dup_distance_m=dup_dist,
            vlm_quota_rem=self.vlm_quota_rem,
            vlm_quota_max=self.initial_vlm_quota,
            is_resampled=False,
        )
        self.last_obs = obs

        action_mask = compute_action_mask(obs, self.resample_streak)
        info = {
            "action_mask": action_mask,
            "step_count": self.step_count,
            "x_veh": self.x_veh,
            "vlm_quota_rem": self.vlm_quota_rem,
            "resample_streak": self.resample_streak,
        }
        return obs, info

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        if not self.action_space.contains(action):
            raise ValueError(f"Invalid action {action} for Discrete({self.action_space.n})")

        obs = self.last_obs
        s_0 = float(obs[0])  # norm_speed
        s_1 = float(obs[1])  # norm_gps_uncertainty
        s_2 = float(obs[2])  # norm_sharpness
        s_3 = float(obs[3])  # norm_brightness_dev
        s_4 = float(obs[4])  # yolo_max_conf
        s_5 = float(obs[5])  # yolo_class_is_defect
        s_6 = float(obs[6])  # dup_cluster_proximity
        s_7 = float(obs[7])  # nim_vlm_quota_rem

        action_mask = compute_action_mask(obs, self.resample_streak)
        vis_hazard = self.current_visible_hazard

        r_act = 0.0
        dt = DT_NORMAL_SEC
        is_fast_resample = False

        # Compute immediate action reward r_act
        if action == Action.SKIP_FRAME:
            # Safe discard
            r_act = 0.0
            self.resample_streak = 0

        elif action == Action.COMMIT_LOCAL_ONNX:
            # Check mask / preconditions
            can_commit = (
                (s_2 >= 0.2833)
                and (s_3 < 1.0)
                and (s_5 >= 0.5)
                and (s_4 >= 0.35)
                and (s_6 < 0.70)
            )

            if not can_commit:
                if s_6 >= 0.70 or (vis_hazard and vis_hazard.resolved_k):
                    r_act = -6.0  # Duplicate commit penalty
                else:
                    r_act = -12.0  # Invalid/corrupt evidence penalty
            else:
                # Preconditions met
                if vis_hazard is None or vis_hazard.resolved_k or s_6 >= 0.70:
                    r_act = -6.0
                elif vis_hazard.y_true_k == GroundTruthClass.TRUE_DEFECT:
                    vis_hazard.resolved_k = True
                    # Estimate GPS coordinate with noise
                    gps_sigma = s_1 * 200.0
                    coord = vis_hazard.x_k + float(self.np_random.normal(0, max(1.0, min(gps_sigma, 25.0))))
                    self.persisted_issue_locations.append(coord)
                    self.true_positives += 1
                    # Storage cost -0.4, borderline deduction -0.5 if conf < 0.65
                    borderline_penalty = 0.5 if s_4 < 0.65 else 0.0
                    r_act = 10.0 - 0.4 - borderline_penalty  # +9.6 or +9.1
                else:
                    # Shadow patch or utility cover false positive
                    self.false_positives += 1
                    r_act = -12.0 - 0.4  # -12.4
            self.resample_streak = 0

        elif action == Action.ESCALATE_TO_CLOUD_VLM:
            can_commit = (
                (s_2 >= 0.2833)
                and (s_3 < 1.0)
                and (s_5 >= 0.5)
                and (s_4 >= 0.35)
                and (s_6 < 0.70)
            )

            if self.vlm_quota_rem <= 0 or s_7 < 0.05:
                r_act = -8.0  # Quota exhaustion penalty
            elif not can_commit:
                r_act = -8.0  # Wasted VLM call on invalid frame
            else:
                # Deduct quota
                self.vlm_quota_rem -= 1
                self.vlm_calls += 1
                c_vlm = -1.5

                if vis_hazard is not None and vis_hazard.y_true_k == GroundTruthClass.TRUE_DEFECT:
                    # VLM verifies with 94% TPR
                    if self.np_random.random() < VLM_TPR:
                        vis_hazard.resolved_k = True
                        coord = vis_hazard.x_k + float(self.np_random.normal(0, 5.0))
                        self.persisted_issue_locations.append(coord)
                        self.true_positives += 1
                        self.vlm_confirmed += 1
                        r_act = 10.0 + c_vlm - 0.4  # +8.1
                    else:
                        r_act = c_vlm  # -1.5 missed by VLM
                else:
                    # Non-defect (shadow patch or utility cover)
                    # VLM rejects with 96% TNR
                    if self.np_random.random() < VLM_TNR:
                        # Correct rejection: avoids -12.4 false positive disaster!
                        self.vlm_rejected += 1
                        r_act = 1.5 + c_vlm  # 0.0 net reward
                    else:
                        # VLM false acceptance (4%)
                        self.false_positives += 1
                        r_act = -12.0 + c_vlm - 0.4  # -13.9
            self.resample_streak = 0

        elif action == Action.BUFFER_AND_RESAMPLE_FAST:
            can_resample = (
                (s_4 >= 0.25)
                and (s_5 >= 0.5)
                and (s_0 >= 0.06)
                and (s_6 < 0.70)
                and (self.resample_streak < 2)
            )
            if not can_resample:
                r_act = -2.0
                dt = DT_NORMAL_SEC
                self.resample_streak = 0
            else:
                r_act = -0.3  # fast compute cost
                dt = DT_FAST_SEC
                is_fast_resample = True
                self.resample_streak += 1

        # Advance vehicle along corridor
        # Natural slight speed variation
        self.v_mps = float(np.clip(self.v_mps + self.np_random.normal(0.0, 0.5), 3.0, 25.0))
        dx = self.v_mps * dt
        x_veh_next = self.x_veh + dx

        # Check encounter window exit penalty for all hazards passed by front bumper (x_veh > x_k - 3.0m)
        r_exit = 0.0
        for h in self.hazards:
            if not h.exited_window and x_veh_next > (h.x_k - FRUSTUM_NEAR_M):
                h.exited_window = True
                if h.y_true_k == GroundTruthClass.TRUE_DEFECT and not h.resolved_k:
                    self.missed_defects += 1
                    r_exit += -6.0  # Missed defect penalty applied once on exit

        total_step_reward = float(r_act + r_exit)
        self.total_reward += total_step_reward

        self.x_veh = x_veh_next
        self.step_count += 1

        # Strict Farama Gymnasium termination vs truncation contract
        terminated = bool(self.x_veh >= self.corridor_length)
        truncated = bool(self.step_count >= self.max_episode_steps and not terminated)

        # Update visible hazard and duplicate distance for next observation
        self.current_visible_hazard = self._get_visible_hazard()
        target_x = self.current_visible_hazard.x_k if self.current_visible_hazard else (self.x_veh + 15.0)
        dup_dist = self._get_dup_distance(target_x)

        next_obs, raw_meta = self.trace_gen.sample_environment_step_sensors(
            rng=self.np_random,
            x_veh=self.x_veh,
            v_mps=self.v_mps,
            visible_hazard=self.current_visible_hazard,
            dup_distance_m=dup_dist,
            vlm_quota_rem=self.vlm_quota_rem,
            vlm_quota_max=self.initial_vlm_quota,
            is_resampled=is_fast_resample,
        )
        self.last_obs = next_obs

        next_mask = compute_action_mask(next_obs, self.resample_streak)

        info = {
            "action_mask": next_mask,
            "step_count": self.step_count,
            "x_veh": self.x_veh,
            "vlm_quota_rem": self.vlm_quota_rem,
            "resample_streak": self.resample_streak,
            "true_positives": self.true_positives,
            "false_positives": self.false_positives,
            "missed_defects": self.missed_defects,
            "vlm_calls": self.vlm_calls,
            "vlm_confirmed": self.vlm_confirmed,
            "vlm_rejected": self.vlm_rejected,
            "total_reward": self.total_reward,
            "immediate_reward": r_act,
            "exit_penalty": r_exit,
            "raw_meta": raw_meta,
        }

        return next_obs, total_step_reward, terminated, truncated, info
