Build a batch pipeline named `extract_exeval_ratings` that produces the `exeval_results` dataset (the backing dataset for the EXEVAL_RESULT object type). The pipeline reads scorecard / METL-report artifacts, calls the AI Function `extract_exeval_ratings` per artifact, resolves the assessed unit and validates extracted MET codes against the unit's selected METL, and emits one row per (exercise × unit × MET) tuple that the unit was assessed on. The unit-level counterpart to `extract_observations`.

Input:

- Dataset `exercise_artifacts` (backs EXERCISE_ARTIFACT). Same columns as `extract_observations`. This pipeline filters to `artifact_type IN ('evaluator_scorecard', 'aar')` — the artifact types that carry per-METL T/P/U ratings.
- Media bucket at S3 prefix `exercise-artifacts/` containing the actual files (PDF, docx, xlsx).
- Reference dataset `met_catalog` (backs MET). Columns: `met_id` (string, PK), `met_code` (string), `statement` (string), `source_doctrine` (string).
- Reference dataset `units` (backs UNIT). Columns: `unit_id` (string, PK), `uic` (string), `short_name` (string), `unit_type` (string).
- Reference dataset `exercise_units` (backs EXERCISE_UNIT). Columns: `exercise_id`, `unit_id`, `participation_type` (string enum: host, participant, opfor). Resolves which unit was being assessed in this exercise.
- Reference dataset `unit_mets` (backs UNIT_MET). Columns: `unit_id`, `met_id`, `selected_from`, `selected_to`, `selection_rationale`. Constrains valid METs per unit — only METLs the CPT actually selected get rated.

Steps:

1. Filter `exercise_artifacts` to `artifact_type IN ('evaluator_scorecard', 'aar')`. Use the "AI" block with a lightweight VLM (Haiku tier) to extract `raw_text` from each file at `source_path`. On unreadable file or model error, set `raw_text = null` and `extraction_status = 'failed'`. Drop failed rows.

2. Call the AI Function `extract_exeval_ratings` once per filtered row. Pass `raw_text` and `artifact_type` as inputs. The function returns a JSON array of rating objects (see `prompts/extract_exeval_ratings.md` for the schema). Explode into one row per rating, retaining `artifact_id` and `exercise_id` as parent keys.

3. Resolve `unit_id` per row by joining `candidate.assessed_unit_uic_or_name` to `units` filtered through `exercise_units` for the row's `exercise_id`. Match strategy: exact match on `uic` first; else exact match on `short_name`; else fuzzy match on `short_name` with Levenshtein distance < 3. If no match, set `unit_id = null` and `validation_status = 'needs_resolution'`.

4. Resolve `met_id` per row by joining `candidate.met_code` to `met_catalog.met_code`. If no match, set `met_id = null` and `validation_status = 'needs_resolution'`.

5. Validate the (unit_id, met_id) pair against `unit_mets`: only METs the unit had selected at the time of `artifact_time` are valid (selected_from <= artifact_time AND (selected_to IS NULL OR artifact_time < selected_to)). If the pair is not in `unit_mets`, set `validation_status = 'mismatched_metl'` (the assessor scored the unit on a MET it had not selected — an artifact-quality flag, not a row drop).

6. Generate `exeval_result_id` = SHA-256 hash of `exercise_id || unit_id || met_id`. Deterministic so re-runs do not duplicate rows.

Output schema (target dataset `exeval_results`, primary key `exeval_result_id`, update mode incremental merge):

exeval_result_id: string, PK
exercise_id: string, FK to exercises
unit_id: string, nullable, FK to units
met_id: string, nullable, FK to met_catalog
artifact_id: string, FK to exercise_artifacts
rating: string enum [trained, practiced, untrained]
assessor_notes: string, nullable
assessor_name: string, nullable
validation_status: string enum [confirmed, needs_resolution, mismatched_metl]
assessed_at: datetime

Rules:

1. `exeval_result_id` non-null and unique → FAIL.
2. `exercise_id`, `artifact_id` non-null and FK-resolvable → FAIL.
3. `rating` in (`trained`, `practiced`, `untrained`) → FAIL.
4. Before merging output to the target dataset, filter OUT rows in the existing target where an authoritative override exists (the App lets the assessment cell flip `validation_status = 'confirmed'` after manual review — those rows must never be overwritten by a re-run).
5. `unit_id` null rate per build < 10% → WARN.
6. `validation_status = 'mismatched_metl'` rate per build < 5% → WARN. A higher rate suggests assessors are scoring against a stale METL — escalate to S3.

Use:

- Step 1 (raw text extraction): lightweight VLM, Haiku tier. Same constraint as `extract_observations`.
- Step 2 (rating extraction): the AI Function `extract_exeval_ratings`. Standard reasoning model is configured at the function level.
- Steps 3, 4, 5, 6: pure transforms, no model.

Schedule:

- Trigger on new rows in `exercise_artifacts` with `artifact_type IN ('evaluator_scorecard', 'aar')`. Streaming/Polling mode with a 15-minute polling interval. Same trigger pattern as `extract_observations`; the two pipelines run in parallel against the same artifact stream at different granularities (per-operator vs per-unit).
