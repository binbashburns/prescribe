Build a batch pipeline named `ingest_exercise_artifacts` that produces the `exercise_artifacts` dataset (the backing dataset for the EXERCISE_ARTIFACT object type). The pipeline watches an S3 prefix for new files, classifies each file by type using deterministic regex rules, extracts metadata, and emits one row per file. No AI Function call required for the core path - file metadata extraction uses lightweight VLM only as a fallback.

Input:

- S3 prefix `exercise-artifacts/` polled on a schedule. Files arrive ad-hoc; common types are PDF, DOCX, PPTX, XLSX, TXT, JSON, PCAP.
- File path convention: `exercise-artifacts/{exercise_code}/{artifact_type_hint}/{filename}`. Example: `exercise-artifacts/EXERCISE-DEMO/aar/2025-06-12_EXERCISE-DEMO_AAR.pdf`.
- Reference dataset `exercises` (backs EXERCISE). Columns: `exercise_id` (PK), `name`, `start_date`. Used to resolve `exercise_id` from the path's `exercise_code` segment.

Steps:

1. List all files at S3 prefix `exercise-artifacts/`. For each file, generate a `staging` row:

{
  "source_path": "",
  "filename": "",
  "exercise_code_from_path": "",
  "artifact_type_hint_from_path": "",
  "file_extension": "",
  "file_size_bytes": 0,
  "s3_last_modified": ""
}

2. Resolve `exercise_id`:
   - Join `staging.exercise_code_from_path` to `exercises.name` (case-insensitive).
   - If no match, set `exercise_id = null` and `ingest_status = 'unmatched_exercise'`. Do not drop the row - flag it for review.

3. Classify `artifact_type` using a deterministic rule set (no model). Apply rules in order, stop at first match:

- IF `filename` matches regex `(?i)nessus.*\.(xml|csv|nessus)$` → `nessus_scan`
- IF `filename` matches `(?i).*aar.*\.(pdf|docx)$` → `aar`
- IF `filename` matches `(?i).*hot.?wash.*\.(docx|pdf|txt)$` → `hot_wash`
- IF `filename` matches `(?i).*purple.?time.*\.(docx|txt)$` → `hot_wash`
- IF `filename` matches `(?i).*daily.?update.?brief.*\.(pptx|pdf)$` → `daily_update_brief`
- IF `filename` matches `(?i).*dub.?day.*\.(pptx|pdf)$` → `daily_update_brief`
- IF `filename` matches `(?i).*team.?report.*\.(xlsx|pdf)$` → `evaluator_scorecard`
- IF `filename` matches `(?i).*metl.*\.(xlsx|csv)$` → `evaluator_scorecard`
- IF `filename` matches `(?i).*msel.*\.(xlsx|csv|json)$` → `msel_log`
- IF `filename` matches `(?i).*\.(pcap|pcapng|log|json)$` AND path contains `/range/` → `range_log`
- IF `artifact_type_hint_from_path` is one of (`aar`, `hot_wash`, `nessus_scan`, `daily_update_brief`, `evaluator_scorecard`, `msel_log`, `range_log`) → use the hint
- ELSE → `unknown`. Set `ingest_status = 'unclassified'`. Do not drop.

4. Extract `source_author`:
   - For PDF and DOCX: read the file's metadata (Author / Creator field) using a metadata-only extraction (no LLM).
   - For PPTX: read the core.xml `<dc:creator>` element.
   - For Nessus / range logs / MSEL: set `source_author = 'system'`.
   - On failure: optionally call a lightweight VLM (Haiku tier) to scan the first page for an author signature. Do NOT use a reasoning model.
   - On total failure: set `source_author = null`.

5. Extract `artifact_time`:
   - First try the filename for an ISO-like date (regex `\d{4}-\d{2}-\d{2}` or `\d{8}`).
   - Else use the file's last-modified timestamp from S3.
   - Output as ISO 8601 datetime.

6. Generate `artifact_id` = SHA-256 hash of `source_path`. Deterministic - re-running the pipeline does not duplicate rows for the same file.

Output schema (target dataset `exercise_artifacts`, primary key `artifact_id`, update mode incremental merge):

artifact_id: string, PK
artifact_type: string enum [aar, evaluator_scorecard, daily_update_brief, hot_wash, nessus_scan, range_log, msel_log, unknown]
source_path: string (S3 URI)
exercise_id: string, nullable, FK to exercises
source_author: string, nullable
artifact_time: datetime
ingest_status: string enum [ok, unmatched_exercise, unclassified]

Rules:

1. `artifact_id` non-null and unique → FAIL.
2. `source_path` non-null and starts with `s3://` → FAIL.
3. `artifact_type` in the allowed enum → FAIL.
4. `ingest_status` in (`ok`, `unmatched_exercise`, `unclassified`) → FAIL.
5. `exercise_id` null rate per build < 10% → WARN.
6. `artifact_type = 'unknown'` rate per build < 5% → WARN.
7. Do NOT delete rows during merge. Even files later removed from S3 should remain in the dataset for audit.

Use:

- Step 4 fallback (PDF/DOCX author extraction when metadata empty): lightweight VLM, Haiku tier ONLY. High volume; do NOT use a reasoning model.
- All other steps: pure transforms, no model.

Schedule:

- Poll S3 every 15 minutes. AI "Streaming/Polling" mode.
- Downstream pipeline `extract_observations` reads this dataset.
