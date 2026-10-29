"""RoadGuard AI Gymnasium Environment Package.

Registers RoadGuardInspectionEnv-v0 with Farama Gymnasium.
"""

from gymnasium.envs.registration import register

register(
    id="RoadGuardInspectionEnv-v0",
    entry_point="roadguard_env.inspection_env:RoadGuardInspectionEnv",
    max_episode_steps=300,
)

__version__ = "1.0.0"
