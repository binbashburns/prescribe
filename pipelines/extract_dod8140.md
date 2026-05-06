Build a batch pipeline named `extract_dod8140` that produces the `staging_training_dod8140` dataset (one row per DoD-internal course or certification extracted from the DoD 8140 Matrix XLSX). This is one of three extraction pipelines that feed the unified training resource ingestion. No AI Function call required - XLSX columns are already structured.

Input:

- media bucket at `training-catalogs/dod8140/` containing the latest version of `(U)+YYYY-MM-DD_DoD8140MatrixVX.X.xlsx`. New versions arrive ad-hoc when DoD CIO publishes updates.
- Reference dataset `dcwf_work_roles` with columns `work_role_code` (3-digit string PK), `title`, `element`. Used to validate that extracted WRC values resolve.

Steps:

1. List files at `training-catalogs/dod8140/`. If multiple versions exist, select the file whose filename contains the most recent ISO date. Set this as the active source file for the run.

2. Open the workbook and process two sheets in parallel branches.

 Branch A: Read sheet named `DoD Training Repository`. Header row is row 2 (row 1 contains the search header). Use these column mappings:
 - `WRC` (column A) → `work_role_code`
 - `Work Role Title` (column B) → drop, redundant with reference data
 - `Element` (column C) → drop
 - `Component` (column D) → `component`
 - `Specialty Code: MOS/NEC/AFSC` (column E) → `specialty_code`
 - `Position` (column F) → drop
 - `Course Title` (column G) → `raw_title`
 - `Course Number/CIN` (column H) → `raw_course_number`
 - `Registration` (column I) → drop
 - `Proficiency` (column J) → `raw_proficiency`
 - `Description` (column K) → `raw_description`
 - `Length` (column L) → `raw_duration`
 - `School House` (column M) → `raw_schoolhouse`

 Drop rows where `raw_title` is null or empty.

 Branch B: Read sheet named `Certification Repository`. Header row is row 2. Column mappings:
 - `WRC` (column A) → `work_role_code`
 - `Work Role Title` (column B) → drop
 - `Element` (column C) → drop
 - `Acronym` (column D) → `raw_title`
 - `Proficiency` (column E) → `raw_proficiency`
 - `Vendor` (column F) → `raw_vendor`

 For Branch B rows, set `raw_description = ""`, `raw_duration = ""`, `raw_course_number = ""` (certs don't carry these), `raw_schoolhouse = ""`, `component = "Commercial"`, `specialty_code = ""`.

3. UNION the two branches with an additional column `record_type`:
 - Branch A rows → `record_type = "course"`
 - Branch B rows → `record_type = "certification"`

4. Map `component` to `provider` via this table (apply to Branch A rows only):
 - `"Army"` → `"U.S. Army"`
 - `"Navy"` → `"U.S. Navy"`
 - `"Air Force"` → `"U.S. Air Force"`
 - `"Marine Corps"` → `"U.S. Marine Corps"`
 - `"Space Force"` → `"U.S. Space Force"`
 - `"Defense Acquisition University (DAU)"` → `"DAU"`
 - `"Joint"` → `"DoD Joint"`
 - any other value → pass through verbatim
 For Branch B rows, set `provider = raw_vendor`.

5. Group by `raw_course_number` (Branch A) or `raw_title` + `raw_vendor` (Branch B) to deduplicate. The same course/cert may appear on multiple WRC rows in the source. Aggregate `work_role_code` into a list column `asserted_work_role_codes` (deduped, sorted ascending). Aggregate `raw_proficiency` similarly into `raw_proficiency_list` since proficiency is per-work-role.

6. Validate `asserted_work_role_codes` against `dcwf_work_roles.work_role_code`. Drop any code that does not resolve. If all codes drop, set `asserted_work_role_codes = []` and `validation_status = "no_valid_wrc"`. Otherwise `validation_status = "ok"`.

7. Generate `source_record_id`:
 - For courses (Branch A): SHA-256 hash of `raw_course_number || provider`. Truncated to 16 hex chars.
 - For certs (Branch B): SHA-256 hash of `raw_title || provider`. Truncated to 16 hex chars.

8. Generate `staging_id` = SHA-256 hash of `"dod8140" || source_record_id`. Used as the primary key for this staging table.

9. Pass through fields. Do NOT call `normalize_training_resource` here - that runs in the unification pipeline.

Output schema (target dataset `staging_training_dod8140`, primary key `staging_id`, update mode incremental merge):

staging_id: string, PK
source: string, constant value `"dod8140"`
source_record_id: string
record_type: string enum [course, certification]
raw_title: string
raw_provider: string
raw_description: string
raw_proficiency_list: array<string>
raw_duration: string
raw_schoolhouse: string
raw_course_number: string
component: string
specialty_code: string
asserted_work_role_codes: array<string>
validation_status: string enum [ok, no_valid_wrc]
extraction_run_id: string
source_file_name: string

Rules:

1. `staging_id` non-null and unique → FAIL.
2. `source` constant value `"dod8140"` → FAIL.
3. `raw_title` non-null and length > 2 characters → FAIL.
4. `record_type` in (`course`, `certification`) → FAIL.
5. `validation_status` in (`ok`, `no_valid_wrc`) → FAIL.
6. `validation_status = "no_valid_wrc"` rate per build < 5% → WARN.
7. Total extracted row count between 200 and 2000 → WARN if outside range. The 8140 Matrix carries roughly 950 courses and 430 certs at v2.1; large deviations indicate parsing errors.

Use:

- No model calls. Pure XLSX parsing and transforms. Do not add any "AI" blocks.

Schedule:

- Trigger on new files at `training-catalogs/dod8140/`. AI "Streaming/Polling" mode with 1-hour polling interval (this source updates infrequently - quarterly at most).
- Downstream pipeline `unify_training_resources` reads this dataset.
