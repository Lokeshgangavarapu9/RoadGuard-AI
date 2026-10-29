"""Baseline policies evaluated alongside the RL agent across 100 held-out episodes."""

from abc import ABC, abstractmethod
import numpy as np

from roadguard_env.config import Action


class BaselinePolicy(ABC):
    """Abstract base class for heuristic comparison baselines."""

    @abstractmethod
    def act(self, obs: np.ndarray, action_mask: np.ndarray) -> int:
        """Selects an action in [0, 3] given observation and action mask."""
        pass


class StaticThresholdBaseline(BaselinePolicy):
    """Baseline 1: Static Heuristic (Current Production Rule).

    Commits locally if high confidence (conf >= 0.65) and image clear;
    otherwise skips frame. Never calls VLM or fast resample.
    """

    def act(self, obs: np.ndarray, action_mask: np.ndarray) -> int:
        # Action 1 mask requires s_2 >= 0.2833, s_3 < 1.0, s_5 >= 0.5, s_4 >= 0.35, s_6 < 0.70
        s_4 = float(obs[4])  # yolo_max_conf
        if action_mask[Action.COMMIT_LOCAL_ONNX] and s_4 >= 0.65:
            return Action.COMMIT_LOCAL_ONNX
        return Action.SKIP_FRAME


class GreedyVlmBaseline(BaselinePolicy):
    """Baseline 2: Greedy VLM Escalation.

    Greedily escalates any candidate frame with conf >= 0.35 to cloud VLM
    until quota is exhausted, then falls back to local commit if conf >= 0.65.
    """

    def act(self, obs: np.ndarray, action_mask: np.ndarray) -> int:
        s_4 = float(obs[4])  # yolo_max_conf
        # If VLM escalation is valid, call VLM for candidate defects
        if action_mask[Action.ESCALATE_TO_CLOUD_VLM] and s_4 >= 0.35:
            return Action.ESCALATE_TO_CLOUD_VLM
        # If quota exhausted, fall back to high confidence local commit
        if action_mask[Action.COMMIT_LOCAL_ONNX] and s_4 >= 0.65:
            return Action.COMMIT_LOCAL_ONNX
        return Action.SKIP_FRAME


class NaiveAlwaysCommitBaseline(BaselinePolicy):
    """Baseline 3: Naive Always Commit >= 0.35.

    Commits any candidate with conf >= 0.35 locally without VLM verification.
    Maximizes recall but suffers severe false-positive penalties.
    """

    def act(self, obs: np.ndarray, action_mask: np.ndarray) -> int:
        if action_mask[Action.COMMIT_LOCAL_ONNX]:
            return Action.COMMIT_LOCAL_ONNX
        return Action.SKIP_FRAME
