Build a batch pipeline named `extract_observations` that produces the `observations` dataset (the backing dataset for the OBSERVATION object type). The pipeline reads exercise artifact files from a media bucket, calls the AI Function `extract_observation_candidates` per artifact, resolves operators and KSAs, and emits one row per (operator × KSA × artifact) tuple.

Input:

- Dataset `exercise_artifacts` (backs EXERCISE_ARTIFACT). Columns: `artifact_id` (string, PK), `artifact_type` (string enum), `source_path` (string, S3 URI), `exercise_id` (string, FK), `source_author` (string), `artifact_time` (datetime). Update pattern: append-only.
- Media bucket at S3 prefix `exercise-artifacts/` containing the actual files (PDF, docx, pptx, txt, JSON).
- Reference dataset `dcwf_ksa` with columns `ksa_id`, `ksa_type`, `statement`.
- Reference dataset `mop_catalog` with columns `mop_id`, `code`, `statement`.
- Reference dataset `exercise_operator_roster` (a flattened view of EXERCISE_OPERATOR joined to OPERATOR) with columns `exercise_id`, `operator_id`, `callsign`, `role_type`, `work_role_id`.

Steps:

1. Use the "AI" block with a lightweight VLM (Claude Haiku tier or equivalent fast model). Do NOT use a large reasoning model for this step. For each row in `exercise_artifacts`, read the file at `source_path` from the media bucket and output a column `raw_text` (plain text with page breaks preserved). On unreadable file or model error, set `raw_text = null` and `extraction_status = 'failed'`. Drop failed rows from downstream steps.

2. Call the AI Function `extract_observation_candidates` once per `exercise_artifacts` row. Pass `raw_text` and `artifact_type` as inputs. The function returns a JSON array of candidate objects (see `prompts/extract_observation_candidates.md` for the schema and rules). Explode the array into one row per candidate, retaining `artifact_id` and `exercise_id` as parent keys.

3. Resolve `operator_id` per candidate by joining `candidate.operator_callsign_or_name` to `exercise_operator_roster` filtered by the candidate's `exercise_id`. Match strategy: exact match on `callsign` first; else fuzzy match on `callsign` or full name with Levenshtein distance < 3. If no match, set `operator_id = null` and `validation_status = 'needs_resolution'`. Otherwise `validation_status = 'candidate'`.

4. Map `evidence_excerpt` to KSAs by computing embedding similarity against `dcwf_ksa.statement`. Use a standard text embedding model. Output one row per (candidate × KSA) pair where cosine similarity >= 0.65. Set `confidence` = the similarity score for that pair.

5. Resolve `mop_id` per row by joining `candidate.mop_code` to `mop_catalog.code`. Set `mop_id = null` if `mop_code` is empty.

6. Generate `observation_id` = SHA-256 hash of the concatenation `artifact_id || evidence_excerpt || ksa_id`. Deterministic so re-runs do not duplicate rows.

Output schema (target dataset `observations`, primary key `observation_id`, update mode incremental merge):

observation_id: string, PK
operator_id: string, nullable, FK to operators
ksa_id: string, FK to dcwf_ksa
exercise_id: string, FK to exercises
artifact_id: string, FK to exercise_artifacts
mop_id: string, nullable, FK to mop_catalog
signal: string enum [strength, deficiency, neutral]
confidence: float between 0 and 1
evidence_excerpt: string
validation_status: string enum [candidate, needs_resolution, confirmed]
technique_tag: string, nullable

Rules:

1. `observation_id` non-null and unique → FAIL.
2. `ksa_id`, `exercise_id`, `artifact_id` non-null and FK-resolvable → FAIL.
3. `signal` in (`strength`, `deficiency`, `neutral`) → FAIL.
4. `confidence` between 0 and 1 inclusive → FAIL.
5. Before merging output to the target dataset, filter OUT rows in the existing target where `validation_status = 'confirmed'`. Mentor-confirmed rows must NEVER be overwritten by a re-run.
6. `evidence_excerpt` non-null and length > 10 characters → WARN.
7. `operator_id` null rate per build < 20% → WARN.

Use:

- Step 1 (raw text extraction): lightweight VLM, Haiku tier. High volume, do NOT default to a large reasoning model.
- Step 2 (claim segmentation): the AI Function `extract_observation_candidates`. Standard reasoning model is configured at the function level.
- Step 4 (KSA mapping): text embedding model. No LLM call.
- Steps 3, 5, 6: pure transforms, no model.

Schedule:

- Trigger on new rows in `exercise_artifacts`. Use AI "Streaming/Polling" mode with a 15-minute polling interval.
- Downstream pipeline `aggregate_ksa_gaps` reads the confirmed Observations from this dataset.
