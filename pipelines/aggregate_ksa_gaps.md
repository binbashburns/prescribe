Build a batch pipeline named `aggregate_ksa_gaps` that produces the `ksa_gaps` dataset (the backing dataset for the KSA_GAP object type). The pipeline aggregates confirmed Observations into per-operator competency gaps, weights by core/additional KSA designation, and tracks recurrence across runs. No AI Function calls - this is a pure transform pipeline.

Input:

- Dataset `observations` (backs OBSERVATION). Use only rows where `validation_status = 'confirmed'`.
- Dataset `work_role_ksa` (backs WORK_ROLE_KSA join). Columns: `work_role_id` (FK), `ksa_id` (FK), `core_or_additional` (enum: `core | additional`).
- Dataset `operator_work_role` (backs OPERATOR_WORK_ROLE join). Columns: `operator_id` (FK), `work_role_id` (FK), `assignment_type`.
- Prior snapshot of the target dataset `ksa_gaps`. Required for computing `is_recurring` and `cycle_count`.

Steps:

1. Filter `observations` to `validation_status = 'confirmed'` AND `signal` in (`strength`, `deficiency`). Drop neutral.

2. Group by (`operator_id`, `ksa_id`) and aggregate:

{
  "operator_id": "",
  "ksa_id": "",
  "observation_count": 0,
  "deficiency_count": 0,
  "strength_count": 0
}

Where:
- `observation_count` = COUNT(*)
- `deficiency_count` = COUNT(* WHERE signal = 'deficiency')
- `strength_count` = COUNT(* WHERE signal = 'strength')

3. For each grouped row, determine the `core_or_additional` weight:
   - Join the row's `operator_id` to `operator_work_role` to get the operator's work roles.
   - Join those work roles to `work_role_ksa` filtered to the row's `ksa_id`.
   - If ANY of the operator's work roles has this KSA as `core_or_additional = 'core'`, set `weight = 1.5`. Else set `weight = 1.0`.

4. Compute `severity_score` (float 0 to 1):
   - Base score = `deficiency_count / observation_count`
   - Apply weight: `severity_score = MIN(1.0, base_score * weight)`

5. Drop rows where `severity_score < 0.2`.

6. Compute `is_recurring` and `cycle_count` by left-joining the current run's gaps to the prior snapshot of `ksa_gaps` on (`operator_id`, `ksa_id`):
   - If a matching prior row exists AND the current row's `severity_score >= 0.2`: set `is_recurring = true`, `cycle_count = prior.cycle_count + 1`.
   - Otherwise: set `is_recurring = false`, `cycle_count = 1`.

7. Generate `ksa_gap_id` = SHA-256 hash of `operator_id || ksa_id`.

Output schema (target dataset `ksa_gaps`, primary key `ksa_gap_id`, update mode snapshot replace):

ksa_gap_id: string, PK
operator_id: string, FK to operators
ksa_id: string, FK to dcwf_ksa
severity_score: float between 0 and 1
observation_count: int >= 1
is_recurring: boolean
cycle_count: int >= 1

Rules:

1. `ksa_gap_id` non-null and unique → FAIL.
2. `operator_id`, `ksa_id` non-null and FK-resolvable → FAIL.
3. `severity_score` between 0 and 1 inclusive → FAIL.
4. `cycle_count` >= 1 → FAIL.
5. `observation_count` >= 1 → FAIL.
6. For rows with `is_recurring = true`: matching (`operator_id`, `ksa_id`) MUST exist in the prior snapshot → WARN.
7. Snapshot replace mode is intentional. Do not preserve stale gaps.

Use:

- No model calls in this pipeline. Pure aggregation and join logic. Do not add any "AI" blocks.

Schedule:

- Default to nightly batch trigger (cron). Idempotent - re-runnable at any time without side effects.
- Open question: per-Observation immediate recompute, or batched nightly? Default to nightly for v1; revisit if mentor-to-commander-view latency becomes a complaint.
