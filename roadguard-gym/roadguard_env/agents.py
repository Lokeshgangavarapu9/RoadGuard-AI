"""Reinforcement Learning Agents for RoadGuardInspectionEnv-v0.

Implements Action-Masked Double Tabular Q-Learning (DoubleQLearningAgent).
"""

from typing import Optional, Tuple
import numpy as np

from roadguard_env.config import NUM_STATES, NUM_ACTIONS, Action
from roadguard_env.discretizer import discretize_observation, compute_state_id


class DoubleQLearningAgent:
    """Action-Masked Double Tabular Q-Learning Agent."""

    def __init__(
        self,
        num_states: int = NUM_STATES,
        num_actions: int = NUM_ACTIONS,
        alpha: float = 0.15,
        alpha_min: float = 0.02,
        gamma: float = 0.95,
        epsilon_start: float = 1.0,
        epsilon_min: float = 0.05,
        epsilon_decay: float = 0.9992,
        seed: Optional[int] = 42,
    ):
        self.num_states = num_states
        self.num_actions = num_actions
        self.alpha = alpha
        self.alpha_min = alpha_min
        self.gamma = gamma
        self.epsilon = epsilon_start
        self.epsilon_min = epsilon_min
        self.epsilon_decay = epsilon_decay
        self.rng = np.random.default_rng(seed)

        # Tabular Q arrays initialized to 0.0
        self.q_a = np.zeros((num_states, num_actions), dtype=np.float32)
        self.q_b = np.zeros((num_states, num_actions), dtype=np.float32)

    @property
    def q_table(self) -> np.ndarray:
        """Ensemble average Q-value table (1728 x 4)."""
        return (self.q_a + self.q_b) / 2.0

    def select_action(
        self,
        state_id: int,
        action_mask: np.ndarray,
        deterministic: bool = False,
    ) -> int:
        """Selects an action respecting the boolean action mask."""
        valid_actions = np.where(action_mask)[0]
        if len(valid_actions) == 0:
            return Action.SKIP_FRAME

        if not deterministic and self.rng.random() < self.epsilon:
            return int(self.rng.choice(valid_actions))

        # Masked argmax over Q-values
        q_vals = self.q_table[state_id]
        best_val = -1e9
        best_act = valid_actions[0]
        for a in valid_actions:
            if q_vals[a] > best_val:
                best_val = q_vals[a]
                best_act = a
        return int(best_act)

    def update(
        self,
        state_id: int,
        action: int,
        reward: float,
        next_state_id: int,
        next_action_mask: np.ndarray,
        done: bool,
    ) -> None:
        """Performs Action-Masked Double Q-Learning update."""
        valid_next_actions = np.where(next_action_mask)[0]

        if self.rng.random() < 0.5:
            # Update Q_A using best action in Q_A evaluated by Q_B
            if done or len(valid_next_actions) == 0:
                target = reward
            else:
                best_next_a = valid_next_actions[np.argmax(self.q_a[next_state_id, valid_next_actions])]
                target = reward + self.gamma * self.q_b[next_state_id, best_next_a]

            self.q_a[state_id, action] += self.alpha * (target - self.q_a[state_id, action])
        else:
            # Update Q_B using best action in Q_B evaluated by Q_A
            if done or len(valid_next_actions) == 0:
                target = reward
            else:
                best_next_b = valid_next_actions[np.argmax(self.q_b[next_state_id, valid_next_actions])]
                target = reward + self.gamma * self.q_a[next_state_id, best_next_b]

            self.q_b[state_id, action] += self.alpha * (target - self.q_b[state_id, action])

    def decay_exploration(self) -> None:
        """Decays epsilon after each episode."""
        self.epsilon = max(self.epsilon_min, self.epsilon * self.epsilon_decay)
        self.alpha = max(self.alpha_min, self.alpha * 0.9998)
