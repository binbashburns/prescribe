Build a batch pipeline named `generate_remediation_items` that produces the `remediation_items` dataset (the backing dataset for the REMEDIATION_ITEM object type). The pipeline takes per-operator KSA gaps, matches them to training resources from the curated/AI-mapped catalog, calls the AI Function `generate_training_objective` per item, and emits one prescribed item per (operator × gap × work-role) tuple.

Input:

- Dataset `ksa_gaps` (backs KSA_GAP). Use only rows where `severity_score >= 0.4`.
- Dataset `training_resource_ksa` (backs TRAINING_RESOURCE_KSA join). Columns: `training_resource_id` (FK), `ksa_id` (FK), `match_method` (enum: `curated | semantic`), `match_confidence` (float).
- Dataset `training_resources` (backs TRAINING_RESOURCE). Columns: `training_resource_id` (PK), `title`, `provider`, `objectives_text`.
- Dataset `operator_work_role` (backs OPERATOR_WORK_ROLE join).
- Dataset `work_role_ksa` (backs WORK_ROLE_KSA join). Used to determine which of the operator's roles "owns" each gap.
- Dataset `operators` (backs OPERATOR). Columns: `operator_id` (PK), `mos_series`.
- Dataset `work_roles` (backs WORK_ROLE). Columns: `work_role_id` (PK), `title`.
- Dataset `dcwf_ksa` (backs KSA). Columns: `ksa_id` (PK), `statement`.
- Prior snapshot of the target dataset `remediation_items`. Required to preserve operator-set `status` across re-runs.

Steps:

1. For each row in filtered `ksa_gaps`, pair the gap with the operator's relevant work roles:
   - Join `ksa_gaps.operator_id` to `operator_work_role.operator_id`.
   - For each (gap, work_role) pair, check `work_role_ksa` to confirm the KSA is in that work role's KSA set. Drop pairs where the KSA is not associated with the work role.
   - Set `scoped_work_role_id = work_role_id` from the surviving pair.

2. For each (gap, work-role) row, find candidate training resources:
   - Join to `training_resource_ksa` on `ksa_id`.
   - Filter to `match_confidence >= 0.7`.
   - Rank candidates: `match_method = 'curated'` first, then by `match_confidence` desc.
   - Keep the top-ranked candidate. Set `training_resource_id = candidate.training_resource_id`.
   - If no candidate exists, set `training_resource_id = null`.

3. Call the AI Function `generate_training_objective` once per row. Pass the following input object:

{
  "ksa_statement": "<from dcwf_ksa.statement>",
  "severity_score": 0.0,
  "operator_mos": "<from operators.mos_series>",
  "work_role_title": "<from work_roles.title>",
  "training_resource_objectives": "<from training_resources.objectives_text or empty string>"
}

The function returns a single sentence (see `prompts/generate_training_objective.md`). Store as `training_objective`.

4. Compute `priority_rank` per operator. Within each `operator_id`, sort items by `severity_score` descending. Assign rank starting at 1.

5. Generate `remediation_item_id` = SHA-256 hash of `operator_id || ksa_gap_id || scoped_work_role_id`.

6. Preserve `status` from the prior snapshot:
   - Left-join the current run's items to the prior snapshot of `remediation_items` on `remediation_item_id`.
   - If the prior row exists, copy its `status` value.
   - Else set `status = 'active'`.

7. Drop output rows where the underlying gap no longer exists AND the prior `status` was already `completed`.

Output schema (target dataset `remediation_items`, primary key `remediation_item_id`, update mode incremental merge):

remediation_item_id: string, PK
operator_id: string, FK to operators
scoped_work_role_id: string, FK to work_roles
ksa_gap_id: string, FK to ksa_gaps
ksa_id: string, FK to dcwf_ksa
training_resource_id: string, nullable, FK to training_resources
training_objective: string
priority_rank: int >= 1
status: string enum [active, in_progress, completed, dismissed]

Rules:

1. `remediation_item_id` non-null and unique → FAIL.
2. `operator_id`, `scoped_work_role_id`, `ksa_gap_id`, `ksa_id` non-null and FK-resolvable → FAIL.
3. `training_resource_id` if non-null must FK-resolve → FAIL.
4. `priority_rank` >= 1 → FAIL.
5. `status` in (`active`, `in_progress`, `completed`, `dismissed`) → FAIL.
6. `training_objective` non-null and length > 20 characters → WARN.
7. `training_resource_id` null rate per build < 30% → WARN.
8. Status updates flow from the App UI, NOT from this pipeline. Always preserve operator-set status on re-runs (step 6).

Use:

- Step 3 (training objective generation): the AI Function `generate_training_objective`. One call per row.
- All other steps: pure transforms, no model.

Schedule:

- Trigger downstream of the `aggregate_ksa_gaps` pipeline. Run after `ksa_gaps` is updated.
