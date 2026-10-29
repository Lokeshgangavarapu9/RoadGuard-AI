# RoadGuard-Gym: Offline Gymnasium RL Environment

`roadguard-gym` is an offline Farama Gymnasium (>= 1.0.0) package for training and evaluating an autonomous road inspection policy in a Partially Observable Markov Decision Process (POMDP).

## Environment Specification
- **Environment ID:** `RoadGuardInspectionEnv-v0`
- **Observation Space:** `Box(low=0.0, high=1.0, shape=(8,), dtype=np.float32)`
  - $s_0$: Normalized vehicle speed
  - $s_1$: Normalized GPS uncertainty ($\sigma_{gps}$)
  - $s_2$: Normalized Laplacian sharpness variance
  - $s_3$: Monotonic brightness deviation ($|B - 137.5| / 102.5$)
  - $s_4$: YOLO maximum detection confidence
  - $s_5$: YOLO predicted class is defect ($1.0$ if classes 0..3, else $0.0$)
  - $s_6$: Duplicate cluster proximity
  - $s_7$: NVIDIA NIM Cloud VLM quota remaining
- **Action Space:** `Discrete(4)`
  - 0: `SKIP_FRAME`
  - 1: `COMMIT_LOCAL_ONNX`
  - 2: `ESCALATE_TO_CLOUD_VLM`
  - 3: `BUFFER_AND_RESAMPLE_FAST`
- **Mixed-Radix Discretization:**
  - Radices: `[3, 3, 3, 2, 4, 2, 2, 2]`
  - Strides: `[576, 192, 64, 32, 8, 4, 2, 1]`
  - Total States: 1,728 discrete cells

## Training & Evaluation
```bash
python scripts/train_and_evaluate.py
pytest tests/
```

## Production Export
The trained Q-table exports to:
`roadguard-backend/src/main/resources/models/inspection_policy_table.json`
with schema version `1.0.0` and SHA-256 verification hash.
