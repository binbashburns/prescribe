Build a batch pipeline named `unify_training_resources` that produces the `training_resources` dataset (the backing dataset for the TRAINING_RESOURCE object type) AND the `training_resource_ksa` dataset (the backing dataset for the TRAINING_RESOURCE_KSA join). Reads the union of all staging tables from the disparate-source extraction pipelines, calls the AI Function `normalize_training_resource` per row to canonicalize, then calls the AI Function `match_training_to_ksas` per row to emit candidate KSA mappings.

Input:

- Dataset `staging_training_dod8140` (output of `extract_dod8140`).
- Dataset `staging_training_niccs` (output of `extract_niccs_course_pages`).
- Dataset `staging_training_github` (output of `extract_github_md_catalog`).
- Reference dataset `dcwf_ksa` with columns `ksa_id`, `ksa_type`, `statement`.
- Reference dataset `work_role_ksa` (backing of WORK_ROLE_KSA join). Used to attach `core_for_work_role_codes` and `associated_work_role_codes` per KSA.
- Reference dataset `dcwf_work_roles` with columns `work_role_id`, `work_role_code`, `title`. Used to validate `asserted_work_role_codes` from staging.
- Prior snapshot of `training_resource_ksa`. Required to preserve mentor-curated rows across re-runs.

Steps:

1. UNION the three staging tables, keeping only the columns each carries plus the constant `source` column. Source-specific raw columns are passed through as a JSON-encoded string in a column called `staging_payload`. The union step's job is just to align schemas - the AI function does the real normalization.

   Output schema after union (intermediate):
   - `staging_id`, `source`, `source_record_id`, `staging_payload` (JSON string of source-specific raw fields)

2. For each unioned row, call the AI Function `normalize_training_resource`. Pass the entire `staging_payload` parsed back to JSON, plus `source` as a hint. The function returns the canonical TRAINING_RESOURCE schema as JSON. See `prompts/normalize_training_resource.md` for the schema and rules.

3. Validate `asserted_work_role_codes` from the function output against `dcwf_work_roles.work_role_code`. Drop any code that does not resolve. Pass the validated list onward.

4. Generate `training_resource_id` = SHA-256 hash of `source || source_record_id`. Truncated to 16 hex chars. Deterministic so re-runs do not duplicate.

5. Write the canonical rows to the target `training_resources` dataset (TRAINING_RESOURCE backing dataset).

6. For the KSA matching branch: take the rows from step 3 (with canonical `training_resource_id`, `objectives_text`, `asserted_work_role_codes`).

7. Build the `candidate_ksas` array per row. Two branches:
   - If `asserted_work_role_codes` is non-empty: pull the union of all KSAs associated with those work roles via `work_role_ksa`. This is typically 30-60 KSAs.
   - If `asserted_work_role_codes` is empty AND `objectives_text` is non-empty: pre-filter the full `dcwf_ksa` dataset by computing embedding similarity between `objectives_text` and each KSA `statement`, keep the top 80 by similarity. Use a standard text embedding model (Claude-side embeddings or sentence-transformers/all-MiniLM-L6-v2 - local is fine).
   - If both empty: skip the KSA matching call. Emit zero TRAINING_RESOURCE_KSA rows for this resource.

8. Decorate each candidate KSA with `core_for_work_role_codes` and `associated_work_role_codes` from `work_role_ksa`.

9. Call the AI Function `match_training_to_ksas`. Pass the `training_resource` object (with `objectives_text`, `asserted_work_role_codes`, etc.) and the `candidate_ksas` array. The function returns a JSON array of (ksa_id, match_confidence, match_reason) tuples. See `prompts/match_training_to_ksas.md`.

10. Set `match_method = 'semantic'` for each emitted row.

11. Generate `training_resource_ksa_id` = SHA-256 hash of `training_resource_id || ksa_id`. Truncated to 16 hex chars.

12. Preserve mentor-curated rows from the prior snapshot:
    - Left-join the current run's emit-set to the prior snapshot of `training_resource_ksa` on `training_resource_ksa_id`.
    - If the prior row has `match_method = 'curated'`: KEEP the prior row exactly. Do NOT overwrite with the semantic version.
    - If the prior row has `match_method = 'semantic'`: REPLACE with the new semantic emission.
    - For rows present in prior but NOT in current run: keep them only if `match_method = 'curated'`. Drop semantic-only rows that fell out (e.g., the underlying training resource was deleted or the AI function no longer matches).

Output schemas:

`training_resources` (target dataset for TRAINING_RESOURCE, PK `training_resource_id`, update mode incremental merge):

training_resource_id: string, PK
title: string
provider: string
description: string
objectives_text: string
proficiency: string enum [Basic, Intermediate, Advanced, ""]
delivery_method: string
cost: string
duration_text: string
url: string
asserted_work_role_codes: array<string>
source: string enum [dod8140, niccs, github_md, manual]
source_record_id: string

`training_resource_ksa` (target dataset for TRAINING_RESOURCE_KSA join, PK `training_resource_ksa_id`, update mode incremental merge):

training_resource_ksa_id: string, PK
training_resource_id: string, FK to training_resources
ksa_id: string, FK to dcwf_ksa
match_method: string enum [semantic, curated]
match_confidence: float between 0.60 and 1.00
match_reason: string

Rules:

1. `training_resource_id` non-null and unique → FAIL.
2. `source` in (`dod8140`, `niccs`, `github_md`, `manual`) → FAIL.
3. `proficiency` in allowed enum or empty string → FAIL.
4. For each row in `training_resource_ksa`: `match_confidence` between 0.60 and 1.00 → FAIL.
5. Mentor-curated `match_method = 'curated'` rows MUST be preserved across re-runs (step 12). If a re-run drops a curated row, that's a destructive bug - FAIL.
6. `training_resource_id` and `ksa_id` FK-resolvable → FAIL.
7. Semantic emit rate per training resource ≤ 8 (the AI function caps at 8) → FAIL.

Use:

- Step 2 (normalize): AI Function `normalize_training_resource`. Standard reasoning model.
- Step 7 (embedding pre-filter when no work-role assertion): text embedding model. No LLM.
- Step 9 (KSA matching): AI Function `match_training_to_ksas`. Standard reasoning model.
- All other steps: pure transforms.

Schedule:

- Trigger downstream of any of the three staging extractors. Run incrementally on new staging rows; full rebuild monthly.
- Downstream consumer: App "Training Resource Browser" view, plus `generate_remediation_items` pipeline (which reads `training_resource_ksa` to find matching courses for each KSA gap).
