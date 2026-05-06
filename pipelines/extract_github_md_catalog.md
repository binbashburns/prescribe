Build a batch pipeline named `extract_github_md_catalog` that produces the `staging_training_github` dataset (one row per training resource discovered in a GitHub-hosted markdown catalog, e.g., the `awesome-cybersecurity-blueteam` and `awesome-incident-response` repos). No AI Function call required - markdown bullets follow predictable patterns.

Input:

- Configuration dataset `github_md_catalog_config` with columns:
  - `repo_slug` (string PK; e.g., `fabacab/awesome-cybersecurity-blueteam`)
  - `branch` (string; default `master` or `main`)
  - `readme_path` (string; default `README.md`)
  - `enabled` (boolean)
- The corresponding raw markdown files at `https://raw.githubusercontent.com/{repo_slug}/{branch}/{readme_path}`.

Steps:

1. Filter `github_md_catalog_config` to `enabled = true`.

2. For each row, fetch the markdown file. Polite UA `PRESCRIBE-research/0.1`. Sleep 1.0s between requests. GitHub raw is heavily cached - caching middleware is fine.

3. Parse the markdown into a tree of headings (`#`, `##`, `###`, `####`) so each bullet retains its section context. Track the heading stack as the parser advances.

4. Extract bullet entries matching these patterns (apply in order, stop at first match per line):
   - `* [TITLE](URL) - DESCRIPTION` (em dash separator)
   - `* [TITLE](URL) - DESCRIPTION` (hyphen separator)
   - `* [TITLE](URL): DESCRIPTION` (colon separator)
   - `* [TITLE](URL).` (no description, sentence-terminator only)
   - `* [TITLE](URL)` (no description at all)

5. For each match, emit a row with:
   - `raw_title` = the bracketed title text
   - `raw_url` = the parenthesized URL (preserve scheme + path)
   - `raw_description` = the post-separator text up to end of line (may be empty)
   - `section_path` = slash-joined heading stack at the time of the bullet (e.g., `Network/Network monitoring/Intrusion Detection Systems`)
   - `repo_slug` = from config
   - `line_number` = 1-indexed line number in the source markdown

6. Drop bullets where `raw_url` does NOT match a likely course/resource URL pattern:
   - DROP if URL is to a wikipedia.org article (background reading, not a course)
   - DROP if URL is to a different awesome-* repo (referencing list, not a course)
   - DROP if URL ends in `.pdf` and `raw_description` does not mention course/training/curriculum (PDFs are usually whitepapers, not training)
   - KEEP everything else, including tools and platforms - the normalization step will classify

7. Generate `source_record_id` = `{repo_slug}#{section_path}#{line_number}` (slugified, lowercase, dashes for spaces and slashes). Generate `staging_id` = SHA-256 hash of `"github_md" || source_record_id`. Truncated to 16 hex chars.

Output schema (target dataset `staging_training_github`, primary key `staging_id`, update mode snapshot replace per repo):

staging_id: string, PK
source: string, constant value `"github_md"`
source_record_id: string
repo_slug: string
section_path: string
line_number: int
raw_title: string
raw_url: string
raw_description: string
fetched_at: datetime

Rules:

1. `staging_id` non-null and unique → FAIL.
2. `source` constant value `"github_md"` → FAIL.
3. `raw_title` non-null and length > 1 → FAIL.
4. `raw_url` MUST start with `http://` or `https://` → FAIL.
5. `section_path` non-null (rows MUST have heading context) → FAIL.
6. `repo_slug` matches GitHub `owner/repo` format → FAIL.
7. Snapshot replace mode is intentional. If a bullet is removed from the upstream README, it should drop out of the staging dataset. Use snapshot replace per `repo_slug` so removing one repo from config doesn't wipe rows from other repos.

Use:

- No model calls. Pure HTTP fetch + markdown regex parse. Do not add any "AI" blocks.

Schedule:

- Trigger weekly. Awesome-list repos update slowly.
- Downstream pipeline `unify_training_resources` reads this dataset.
