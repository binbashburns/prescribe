Build a batch pipeline named `enumerate_niccs_catalog` that produces the `staging_niccs_slugs` dataset (one row per course slug discovered on a NICCS provider catalog). This is the cheap enumeration stage - it does NOT fetch course detail pages. A separate pipeline (`extract_niccs_course_pages`) fetches details for slugs the team has selected. No AI Function call required.

Input:

- Configuration dataset `niccs_provider_config` with columns: `provider_slug` (string PK; e.g., `cybrary`, `letsdefend`, `tryhackme`), `enabled` (boolean), `polite_sleep_seconds` (float, default 1.5).
- The public NICCS catalog at `https://niccs.cisa.gov/training/catalog/{provider_slug}?page=N` (Drupal Views default pager, page size hardcoded to 20, sequential `page=0..page=last`).

Steps:

1. Filter `niccs_provider_config` to `enabled = true`.

2. For each provider, enumerate paginated catalog pages:
   - Start at `page=0`. Fetch `https://niccs.cisa.gov/training/catalog/{provider_slug}?page={page}`.
   - Use a polite User-Agent identifying the project: `PRESCRIBE-research/0.1`. Wait `polite_sleep_seconds` between requests.
   - Parse the response for the substring matching regex `Displaying ([0-9]+) - ([0-9]+) of ([0-9]+) Courses`. If the regex does not match, the provider slug is invalid (NICCS returned its 404 fallback page, which is byte-identical to the catalog index). Mark provider as `validation_status = 'invalid_provider_slug'` and emit a single status row, then move on.
   - If the regex matches, capture `total_courses = group(3)`. Continue paginating until the page's range upper bound (group(2)) equals `total_courses`. Safety cap at `page=60`.

3. Per page, parse all `<a href="/training/catalog/{provider_slug}/{slug}">{title}</a>` links. Each link becomes one staging row.

4. Output one row per (provider, slug) tuple. Deduplicate by `(provider_slug, slug)` in case the same course appears on multiple pages.

5. Generate `staging_id` = SHA-256 hash of `provider_slug || slug`. Truncated to 16 hex chars.

Output schema (target dataset `staging_niccs_slugs`, primary key `staging_id`, update mode incremental merge):

staging_id: string, PK
provider_slug: string
slug: string
title: string
niccs_url: string
discovered_at: datetime
total_courses_on_provider: int
validation_status: string enum [ok, invalid_provider_slug]

Rules:

1. `staging_id` non-null and unique → FAIL.
2. `provider_slug` and `slug` non-null and length > 1 → FAIL.
3. `niccs_url` MUST start with `https://niccs.cisa.gov/training/catalog/` → FAIL.
4. `validation_status` in (`ok`, `invalid_provider_slug`) → FAIL.
5. For runs where `validation_status = 'invalid_provider_slug'`: emit one status row with `slug = ''`, `title = ''`. The downstream pipeline must filter these out before fetching details.
6. Per-provider course count between 5 and 5000 → WARN. Larger means a malformed pager response or NICCS catalog growth that should be investigated.
7. Polite-rate compliance: total HTTP requests per build per provider must equal `ceil(total_courses_on_provider / 20)`. If the script fires more than that, it is misbehaving - FAIL.

Use:

- No model calls. Pure HTTP fetch + regex parse. Do not add any "AI" blocks.

Schedule:

- Trigger nightly. NICCS catalog growth is slow; daily enumeration is sufficient and respectful of the source.
- Downstream pipeline `extract_niccs_course_pages` reads this dataset, optionally filtered by slug-list selection.
