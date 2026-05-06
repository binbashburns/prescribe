Build a batch pipeline named `extract_niccs_course_pages` that produces the `staging_training_niccs` dataset (one row per NICCS course detail page parsed into Drupal fields). Reads slugs from `staging_niccs_slugs`, fetches detail pages, parses Drupal field containers, emits canonical staging columns. No AI Function call required - Drupal CSS classes are stable.

Input:

- Dataset `staging_niccs_slugs` (output of `enumerate_niccs_catalog`). Columns: `staging_id`, `provider_slug`, `slug`, `title`, `niccs_url`, `validation_status`.
- Configuration dataset `niccs_slug_selection` with columns: `provider_slug`, `slug`, `selection_reason` (e.g., 'work_role_511_curated', 'manual_demo_pick'). Used to constrain which slugs get fetched (do NOT auto-fetch all 12k courses on the catalog).

Steps:

1. Filter `staging_niccs_slugs` to `validation_status = 'ok'`. INNER JOIN to `niccs_slug_selection` on `(provider_slug, slug)`. The join is the kill-switch: only selected slugs are fetched.

2. For each surviving row, fetch the course detail page at `niccs_url`. Polite UA `PRESCRIBE-research/0.1`. Sleep 1.5s between requests.

3. Parse Drupal field containers. Each field is a `<div class="...field--name-{NAME}...">` block. Use a balanced-tag scan to capture the inner HTML, strip nested tags, collapse whitespace. Extract these eight fields:
   - `field-tc-proficiency` → `raw_proficiency` (string; example: `"Overall Proficiency Level 2 - Intermediate"`)
   - `field-tc-purpose` → `raw_purpose` (string; example: `"Training Purpose Skill Development"`)
   - `field-tc-audiences` → `raw_audiences` (string; example: `"Specific Audience General Public"`)
   - `field-tc-delivery-method` → `raw_delivery_method` (string; example: `"Delivery Method Online, Self-Paced"`)
   - `field-tc-objectives` → `raw_objectives` (string; example: `"Learning Objectives Gain a skill"` - often shallow)
   - `field-tc-provider-name` → `raw_provider_name` (string; usually contains the provider name plus "Find more courses from..." boilerplate to strip)
   - `field-tp-locations` → `raw_locations` (string)
   - `field--name-body` → `raw_body` (string; usually NICCS boilerplate about contacting the provider)

4. Extract additional metadata:
   - `<h1>` element → `raw_title`
   - `<a href="..." [text]="Register for course">` → `register_url` (the upstream provider URL - the actual content lives there)
   - `<meta name="description" content="...">` → `raw_meta_description`

5. Compute `extraction_status`:
   - `'ok'` if all eight Drupal fields parsed successfully
   - `'partial_extraction'` if 4-7 fields parsed
   - `'extraction_failed'` if 0-3 fields parsed (likely a 404 fallback or page structure change)

6. Generate `source_record_id` = the `slug` value. Generate `staging_id` = SHA-256 hash of `"niccs" || provider_slug || slug`. Truncated to 16 hex chars.

7. Pass through fields. Do NOT call `normalize_training_resource` here - that runs in the unification pipeline.

Output schema (target dataset `staging_training_niccs`, primary key `staging_id`, update mode incremental merge):

staging_id: string, PK
source: string, constant value `"niccs"`
source_record_id: string (the slug)
provider_slug: string
slug: string
niccs_url: string
register_url: string, nullable
raw_title: string
raw_proficiency: string
raw_purpose: string
raw_audiences: string
raw_delivery_method: string
raw_objectives: string
raw_provider_name: string
raw_locations: string
raw_body: string
raw_meta_description: string
extraction_status: string enum [ok, partial_extraction, extraction_failed]
fetched_at: datetime

Rules:

1. `staging_id` non-null and unique → FAIL.
2. `source` constant value `"niccs"` → FAIL.
3. `niccs_url` MUST start with `https://niccs.cisa.gov/training/catalog/` → FAIL.
4. `extraction_status` in (`ok`, `partial_extraction`, `extraction_failed`) → FAIL.
5. `extraction_status = 'extraction_failed'` rate per build < 3% → WARN. Higher means NICCS changed its DOM structure and the field-class extractor needs updating.
6. `raw_title` non-null and length > 2 → FAIL.
7. Polite-rate compliance: requests per build = number of selected slugs. If the script fetches the catalog index in this pipeline, that's a bug - FAIL.

Use:

- No model calls. Pure HTTP fetch + regex parse. Do not add any "AI" blocks.

Schedule:

- Manual trigger initially. After v1 stabilizes, schedule weekly to refresh selected slugs (NICCS course content occasionally changes).
- Downstream pipeline `unify_training_resources` reads this dataset.
