"""Training and Evaluation Script for RoadGuardInspectionEnv-v0.

Trains Action-Masked Double Tabular Q-Learning over 4,000 episodes (seeds 1000..4999),
evaluates across 100 held-out episodes (seeds 10000..10099) against 3 baselines,
saves artifacts/eval_metrics_100ep.json, and exports inspection_policy_table.json.
"""

import os
import sys
import json
import time
from pathlib import Path
from typing import Dict, Any, List
import numpy as np

# Ensure roadguard_env is importable
current_dir = Path(__file__).resolve().parent
pkg_root = current_dir.parent
sys.path.insert(0, str(pkg_root))

from roadguard_env.config import (
    NUM_STATES,
    NUM_ACTIONS,
    INITIAL_VLM_QUOTA,
    CORRIDOR_LENGTH_M,
)
from roadguard_env.inspection_env import RoadGuardInspectionEnv
from roadguard_env.discretizer import discretize_observation, compute_state_id
from roadguard_env.agents import DoubleQLearningAgent
from roadguard_env.baselines import (
    StaticThresholdBaseline,
    GreedyVlmBaseline,
    NaiveAlwaysCommitBaseline,
)
from roadguard_env.exporter import export_policy_table


def evaluate_policy(
    policy_fn,
    num_episodes: int = 100,
    seed_start: int = 10000,
) -> Dict[str, Any]:
    """Evaluates a policy on held-out episodes."""
    env = RoadGuardInspectionEnv()
    rewards = []
    total_tp = 0
    total_fp = 0
    total_fn = 0
    total_vlm_calls = 0
    total_distance_m = 0.0
    total_frames = 0

    for ep in range(num_episodes):
        seed = seed_start + ep
        obs, info = env.reset(seed=seed)
        done = False
        ep_reward = 0.0

        while not done:
            total_frames += 1
            action_mask = info["action_mask"]
            state_id = compute_state_id(discretize_observation(obs))
            action = policy_fn(obs, state_id, action_mask)

            obs, reward, terminated, truncated, info = env.step(action)
            ep_reward += reward
            done = terminated or truncated

        rewards.append(ep_reward)
        total_tp += info["true_positives"]
        total_fp += info["false_positives"]
        total_fn += info["missed_defects"]
        total_vlm_calls += info["vlm_calls"]
        total_distance_m += info["x_veh"]

    total_km = max(0.001, total_distance_m / 1000.0)
    precision = total_tp / max(1, total_tp + total_fp)
    recall = total_tp / max(1, total_tp + total_fn)
    f1 = 2 * (precision * recall) / max(1e-6, precision + recall) if (precision + recall) > 0 else 0.0
    fp_per_km = total_fp / total_km
    vlm_util_pct = (total_vlm_calls / (num_episodes * INITIAL_VLM_QUOTA)) * 100.0
    vlm_per_tp = total_vlm_calls / max(1, total_tp)
    bandwidth_saved_pct = (1.0 - (total_vlm_calls / max(1, total_frames))) * 100.0

    return {
        "mean_episode_reward": float(np.mean(rewards)),
        "std_episode_reward": float(np.std(rewards)),
        "total_true_positives": int(total_tp),
        "total_false_positives": int(total_fp),
        "total_missed_defects": int(total_fn),
        "defect_precision": float(round(precision, 4)),
        "defect_recall": float(round(recall, 4)),
        "defect_f1": float(round(f1, 4)),
        "false_positive_rate_per_km": float(round(fp_per_km, 4)),
        "total_vlm_calls": int(total_vlm_calls),
        "vlm_quota_utilization_pct": float(round(vlm_util_pct, 2)),
        "vlm_calls_per_true_defect": float(round(vlm_per_tp, 3)),
        "bandwidth_saved_pct": float(round(bandwidth_saved_pct, 2)),
    }


def main():
    start_time = time.time()
    print("=================================================================")
    print(" RoadGuard AI - Gymnasium 1.x RL Training & Evaluation Pipeline")
    print("=================================================================")

    # 1. Initialize environment and agent
    env = RoadGuardInspectionEnv()
    agent = DoubleQLearningAgent(seed=42)

    num_train_episodes = 4000
    print(f"\n[1/4] Training Action-Masked Double Tabular Q-Learning ({num_train_episodes} episodes)...")
    train_rewards = []

    for ep in range(num_train_episodes):
        seed = 1000 + ep
        obs, info = env.reset(seed=seed)
        state_id = compute_state_id(discretize_observation(obs))
        action_mask = info["action_mask"]
        done = False
        ep_reward = 0.0

        while not done:
            action = agent.select_action(state_id, action_mask, deterministic=False)
            next_obs, reward, terminated, truncated, next_info = env.step(action)
            done = terminated or truncated

            next_state_id = compute_state_id(discretize_observation(next_obs))
            next_action_mask = next_info["action_mask"]

            agent.update(state_id, action, reward, next_state_id, next_action_mask, done)

            obs = next_obs
            state_id = next_state_id
            action_mask = next_action_mask
            ep_reward += reward

        train_rewards.append(ep_reward)
        agent.decay_exploration()

        if (ep + 1) % 500 == 0:
            avg_rew = np.mean(train_rewards[-200:])
            print(f"  Episode {ep+1}/{num_train_episodes} | Avg Reward (last 200): {avg_rew:.2f} | Epsilon: {agent.epsilon:.3f}")

    train_duration = time.time() - start_time
    print(f"Training completed in {train_duration:.2f} seconds.")

    # 2. Evaluate on 100 held-out episodes against baselines
    print("\n[2/4] Evaluating across 100 held-out episodes (seeds 10000..10099)...")
    static_base = StaticThresholdBaseline()
    greedy_base = GreedyVlmBaseline()
    naive_base = NaiveAlwaysCommitBaseline()

    eval_results = {}

    print("  Evaluating Trained Double Q-Learning Policy...")
    eval_results["trained_rl_agent"] = evaluate_policy(
        lambda o, s, m: agent.select_action(s, m, deterministic=True),
        num_episodes=100,
        seed_start=10000,
    )

    print("  Evaluating Baseline 1: Static Threshold (Prod Rule)...")
    eval_results["baseline_1_static_threshold"] = evaluate_policy(
        lambda o, s, m: static_base.act(o, m),
        num_episodes=100,
        seed_start=10000,
    )

    print("  Evaluating Baseline 2: Greedy VLM Escalation...")
    eval_results["baseline_2_greedy_vlm"] = evaluate_policy(
        lambda o, s, m: greedy_base.act(o, m),
        num_episodes=100,
        seed_start=10000,
    )

    print("  Evaluating Baseline 3: Naive Always Commit >= 0.35...")
    eval_results["baseline_3_naive_always_commit"] = evaluate_policy(
        lambda o, s, m: naive_base.act(o, m),
        num_episodes=100,
        seed_start=10000,
    )

    # 3. Print Comparison Table
    print("\n=========================================================================================================================")
    print(f"{'Policy / Baseline':<32} | {'Reward ± Std':<18} | {'Precision':<10} | {'Recall':<10} | {'F1':<8} | {'FP/km':<8} | {'VLM Calls':<10}")
    print("-------------------------------------------------------------------------------------------------------------------------")
    for name, m in eval_results.items():
        rew_str = f"{m['mean_episode_reward']:.2f} ± {m['std_episode_reward']:.2f}"
        print(f"{name:<32} | {rew_str:<18} | {m['defect_precision']:<10.4f} | {m['defect_recall']:<10.4f} | {m['defect_f1']:<8.4f} | {m['false_positive_rate_per_km']:<8.4f} | {m['total_vlm_calls']:<10}")
    print("=========================================================================================================================")

    # 4. Save artifacts
    print("\n[3/4] Saving evaluation scorecard...")
    artifacts_dir = pkg_root / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    metrics_path = artifacts_dir / "eval_metrics_100ep.json"

    scorecard = {
        "metadata": {
            "environment": "RoadGuardInspectionEnv-v0",
            "episodesEvaluated": 100,
            "seedRange": [10000, 10099],
            "trainingEpisodes": num_train_episodes,
            "trainingTimeSeconds": round(train_duration, 2),
            "timestampUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
        "metricsByPolicy": eval_results,
    }

    with open(metrics_path, mode="w", encoding="utf-8") as f:
        json.dump(scorecard, f, indent=2)
    print(f"  Scorecard written to: {metrics_path}")

    # 5. Export policy JSON to backend and artifacts
    print("\n[4/4] Exporting deterministic JSON lookup table...")
    backend_models_dir = pkg_root.parent / "roadguard-backend" / "src" / "main" / "resources" / "models"
    backend_models_dir.mkdir(parents=True, exist_ok=True)
    backend_table_path = backend_models_dir / "inspection_policy_table.json"
    artifacts_table_path = artifacts_dir / "inspection_policy_table.json"

    table_payload = export_policy_table(agent.q_table, str(backend_table_path))
    with open(artifacts_table_path, mode="w", encoding="utf-8") as f:
        json.dump(table_payload, f, indent=2)

    print(f"  Backend policy table written to: {backend_table_path}")
    print(f"  Artifact policy table written to: {artifacts_table_path}")
    print(f"  Canonical SHA-256 Hash: {table_payload['tableSha256']}")
    print("\nTraining & evaluation completed successfully!")


if __name__ == "__main__":
    main()
