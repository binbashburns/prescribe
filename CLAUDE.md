# CLAUDE.md

Context for Claude Code working on the PRESCRIBE capstone. Read this fully before suggesting changes.

## What this repo is

`prescribe-erd/` is a static, single-page **architecture explorer** for the PRESCRIBE graduate capstone. Four tabs cover the four architectural concerns: ontology, AI Function, batch pipelines, and Application views. It uses Mermaid 11 (`flowchart` rendered with the ELK layout loader), svg-pan-zoom, and plain HTML/CSS/JS - no build step, no framework. `app.js` is an ES module so it can `import` Mermaid + ELK from jsdelivr's ESM build. Run with `python3 -m http.server 8000` and open `localhost:8000`.

The repo is a **design tool**, not the build itself. The actual capstone is built on the platform. This repo exists so Matt can iterate on the ontology shape (objects, properties, relationships, cardinality) and keep design notes per entity in one place that he can interact with visually.

## What PRESCRIBE is

PRESCRIBE - Post-exercise Readiness & Exercise-Sourced Competency Remediation, Informed By Evidence - is a graduate capstone project.

It ingests disparate cyber exercise artifacts (white cell scorecards, AARs, hot wash notes, range logs including Security Onion data), AI-extracts KSA-tagged observations, computes per-operator gaps weighted by DCWF KSA criticality, and prescribes individualized remediation paths.

**The problem it solves:** Cyber training leads at DoD units currently spend days or weeks manually reviewing post-exercise artifacts in disparate formats, scored against exercise-specific rubrics rather than DCWF KSAs. Performance signals go unread, insights evaporate between exercises, operators repeat training they didn't need, and there is no auditable line from "what happened in the exercise" to "what we trained next."

**Target population:** Cyber operators on **Cyber Protection Teams (CPTs)** undergoing **EXEVALs (External Evaluations)** to certify mission readiness. CPTs are 39-person Army cyber units assigned to a Cyber Protection Brigade. Operator MOSs in scope: 17-series (Cyber Operations Specialists), 170-series (Cyber Warfare Officers), and 25D (Cyber Network Defender). Explicitly *not* general-force cyber awareness.

PRESCRIBE serves two scopes simultaneously: **per-CPT readiness** (METL ratings issued to a unit during an EXEVAL - the headline view for the CPT commander) and **per-operator competency** (KSA gaps and individualized remediation - the headline view for the operator and their training NCO). Both flow from the same artifact ingestion, at different granularities.

## Framing rules

- **DCWF (DoD Cyber Workforce Framework) is the competency spine. Always.**
- ATT&CK is dropped as a competency spine. If technique tagging is useful, store as a string property on `Observation`, never a link or first-class object.
- Target population is cyber operators (17/170-series MOSs, 25D), NOT general-force cyber awareness. If a suggestion blurs that line, push back.
- Cyber RAP (April 2026 DoW launch) is policy tailwind only - one paragraph in framing, never the thesis. The Feb 2026 DefenseScoop article on reduced cyber awareness training is deprecated; do not reintroduce it.
- Doctrinal anchors are ADP 7-0, FM 3-12, FM 7-0, TC 25-20, AR 350-1, and DoDM 8140.03. Cite them by name when relevant.

## Platform vocabulary discipline

Use the platform's actual terms: object type, object instance, property, primary key, title key, foreign key, base type, link type (with cardinality 1:1 / 1:M / M:1 / M:M), action type, value type, shared property, interface, struct.

Never invent pseudocode like `_ref` fields. M:M links require either a join table dataset or an object-backed link - call this out explicitly when modeling them.

Before making claims about platform behavior, cite either the platform's official docs . If you're working from general knowledge instead of these sources, say so explicitly. Do not smooth over uncertainty.

## Ontology shape

Three layers separated by where data comes from and how it changes, plus a continuity layer. Thirteen main object types, six object-backed link types - nineteen total in the platform Object Registry.

- **Reference layer** (slow-changing): `WorkRole`, `KSA`, `TrainingResource`, `MET`, `MOP`
- **Observed layer** (per-exercise): `Operator`, `Exercise`, `ExerciseArtifact`, `Observation`, `EXEVAL_RESULT`
- **Derived layer** (computed, recomputable): `KSAGap`, `RemediationItem`
- **Continuity layer**: `Unit`

There are TWO keystone observed objects, at different granularities:

- **`Observation`** is the per-operator, per-claim keystone. Each Observation links one Operator × one KSA × one Exercise, sourced from one ExerciseArtifact, with: `signal` (strength/deficiency/neutral), `confidence`, `evidence_excerpt` (verbatim), and `validation_status`. Optionally links to one MOP. Granularity is fine - one Observation per discrete claim. Feeds individualized remediation.
- **`EXEVAL_RESULT`** is the per-unit, per-METL keystone. One row per (Exercise × Unit × MET) tuple where the unit was assessed. Carries the Trained / Practiced / Untrained rating, assessor notes, and assessor identity. Feeds CPT-level readiness reporting. Distinct from Observation because EXEVALs grade *units* against *METLs*, not *operators* against *KSAs* - same artifacts, different granularity.

`MET` (Mission Essential Task) is the shared pool from which CPTs select their METLs. `UNIT_MET` is the join capturing each unit's METL selection (with `selected_from` / `selected_to` for METL rotation history). `MOP` is the per-task measure of performance, child of MET via `met_id` FK; it carries `standard_text` (grading criteria), `subtask_code` and `subtask_statement` as flat strings (subtasks are not independently rated), and links to the KSAs it requires via M:M. Without MOP, exercise rubric judgments don't bind to competency tracking; with MOP, "operator failed MOP M during exercise E" becomes evidence of a KSA gap.

## Required M:M links

Object-backed link types (carry a payload, so each gets a join object in the diagram and a backing dataset):

- `WorkRole ↔ KSA` (carries `core_or_additional`; gap weighting uses this)
- `TrainingResource ↔ KSA` (carries `match_method`, `match_confidence`)
- `Operator ↔ WorkRole` (carries `assignment_type`; enduring DCWF assignments)
- `Exercise ↔ Operator` (carries `role_type` value-typed enum AND `work_role_id` - the DCWF role the operator was actually performing during this specific exercise; this is what makes per-exercise expected KSAs reachable in two hops)
- `Exercise ↔ Unit` (carries `participation_type`)
- `Unit ↔ MET` (`UNIT_MET` - captures CPT METL selection from the shared pool; carries `selected_from` / `selected_to` for rotation history and `selection_rationale`)

Pure link types (no payload, no join object - just a relationship):

- `MOP ↔ KSA` (M:M, expressed as `}o--o{` in the diagram; no payload now, promote to object-backed if a per-pair weight or criticality emerges)
- `MET ↔ MOP` (1:M, MOP carries `met_id` FK to its parent MET - METL hierarchy is now relational, not flat strings)

## Out of scope - do not propose modeling these

- `ThreatActor` / adversary as object types (it's a property on `Exercise`)
- MITRE ATT&CK technique objects (technique tagging stays as a string property on `Observation`)
- `Mentor` / `Rater` as first-class objects (use properties: `source_author`, `validated_by_user`)
- `DCWF Task` as an object type (was dropped - Observations map to KSAs, never to Tasks; no data flow uses Tasks)
- Sub-tasks below the DCWF Task statement level
- `Subtask` as a separate object (folded into `MOP` as flat string properties; subtasks are not independently rated - they only group MOPs)
- `MSEL_Event` as a separate object (it's an `artifact_type='msel_log'` value on `ExerciseArtifact`; specific scripted events are extracted into `Observation` rows like any other source)
- `Commander` as a separate object (folded to `current_commander_name` + `current_commander_email` strings on `Unit`)
- `RemediationPath` as a wrapper object (it's a App query over `RemediationItem` filtered by `operator_id` + `scoped_work_role_id`)
- `RecurringDeficiency` as a separate object (became `is_recurring` + `cycle_count` flags on `KSAGap`)
- `OperatorRoleType` as a separate object (became a value-typed enum on `Exercise ↔ Operator`)

If Matt proposes one of these, ask why before complying. Each was deliberately collapsed; resurrecting one needs a use case that didn't exist when it was dropped.

## Range constraints (out of scope for this repo, in scope for the capstone)

- Stack: AWS + Security Onion (Zeek, Suricata, Wazuh) + CALDERA (APT29 primary; APT33, Scattered Spider, Volt Typhoon, FIN7 modeled) + Sysmon/WEF/CloudTrail/VPC Flow.
- Range produces **one input among many** (range logs). Scorecards, AARs, and hot washes are non-range inputs dropped into the same S3 bucket under `exercise-artifacts/` prefix.
- Range is NOT the capstone deliverable; the platform build is.
- Hard timebox: weeks 1-2 only.

## This repo's structure

```
prescribe-erd/
├── README.md # User-facing setup
├── CLAUDE.md # This file
├── index.html # Page shell. Edit only if changing layout.
├── styles.css # All styles. Layer color tokens live here.
├── erd-source.js # Mermaid erDiagram source. Drives the diagram structure.
├── entities.js # Per-entity metadata. Drives the side panel.
└── app.js # Render, pan/zoom, click handling, relationship index.
```

### Critical sync rule

`erd-source.js` and `entities.js` must stay in sync. Every entity name in the mermaid source must have a matching key in `entities.js`. If you add `THREAT_ACTOR` to one but not the other, clicking it shows nothing. When making changes, update both in the same commit.

### Renderer (Mermaid flowchart + ELK layout)

The renderer was switched from `erDiagram` (dagre layout) to `flowchart` (ELK layout) to get orthogonal edge routing and crossing minimization on the dense graph. `erd-source.js` is still ER syntax - `app.js` parses it for properties (drives the side panel) and *also* converts it to a flowchart string for ELK at render time. Single source of truth preserved.

`app.js` is now an ES module. It imports `mermaid@11.x` and `@mermaid-js/layout-elk@0.2.x` from jsdelivr's ESM build (the ELK package ships ESM-only - no UMD/IIFE), registers the layout loader with `mermaid.registerLayoutLoaders(elkLayouts)`, then initializes with `layout: "elk"`.

DOM selectors target Mermaid v11 flowchart nodes (`g.node` containing a child `rect`), not the old ER selectors (`g[id^="entity-"]` / `rect.entityBox`). To extract the entity name from a node, parse its `id` attribute (`flowchart-{ENTITY_NAME}-{n}`) - Mermaid preserves underscores there. Layer coloring is applied via Mermaid `classDef` blocks injected into the generated flowchart source (one classDef per layer, fill+stroke colors pulled from CSS variables).

**Per-mode diagrams.** As of 2026-05-05, each top-bar tab (Ontology / AI Automate / Data processing / Application) renders its own diagram derived from `automations.js`. Ontology shows the full ER. AI shows ontology objects connected to AI Function (rounded shapes). Data shows ontology objects connected to batch pipelines. Application shows App view blocks. Click routing is by node id prefix (`flowchart-fn_*`, `flowchart-pipe_*`, `flowchart-view_*`, bare entity names). Mermaid prepends a render-id, so the regex matches `flowchart-...-N` non-anchored - see `attachNodeBehavior` in `app.js`.

### Layer coloring

CSS variables `--layer-{ref|obs|der|cont|join}[-bg]` in `styles.css` define the palette. The renderer reads them via `getComputedStyle` and emits one Mermaid `classDef` per layer in the generated flowchart source, so layer colors flow through Mermaid's own styling pipeline rather than being post-applied with `setAttribute`.

### Pan/zoom

`svg-pan-zoom@3.6.1` wraps the rendered SVG. The toolbar buttons (`#zoom-in`, `#zoom-out`, `#zoom-reset`) call `panZoom.zoomIn()` / `zoomOut()` / `fit()+center()`. If the SVG fails to mount, `panZoom` will be `null`; check `app.js#initPanZoom`.

### Run

```bash
python3 -m http.server 8000
```

`file://` works on some browsers but Mermaid's CDN load can fail under that protocol. Default to the local server.

## Where we are (state Matt left things in)

- **Ontology:** 19 objects (13 main + 6 object-backed joins). Two keystone observed objects: `Observation` (per-operator, per-claim) and `EXEVAL_RESULT` (per-unit, per-METL). MET was promoted from flat strings to a first-class reference object on 2026-05-05 after the boss confirmed CPT EXEVAL is the primary use case and per-METL ratings need to be queryable. Subtask stays folded into MOP as flat strings.
- **Per-mode UI:** Each top-bar tab renders its own diagram. AI / Data / Application diagrams are generated from `automations.js`; Ontology renders the full ER. Click an ontology object to see properties; click a function/pipeline node to open its prompt or spec; click a App view block to see a sample-data mockup from `mockups.js`.
- **AI Function registered (5):** `extract_observation_candidates`, `generate_training_objective`, `normalize_training_resource`, `match_training_to_ksas`, `extract_exeval_ratings`. The last one has no calling pipeline yet.
- **batch pipelines registered (9):** `ingest_exercise_artifacts`, `extract_observations_pipeline`, `aggregate_ksa_gaps`, `generate_remediation_items` (the per-operator observation flow); `extract_dod8140`, `enumerate_niccs_catalog`, `extract_niccs_course_pages`, `extract_github_md_catalog`, `unify_training_resources` (the disparate-input training-resource flow).
- **Disparate raw inputs in `context/`:** DoD 8140 Matrix XLSX (~950 courses + ~430 certs, work-role-tagged), DCWF Work Role Tool XLSX (KSA reference), GitHub awesome-cybersecurity-blueteam.md + awesome-incident-response.md (raw markdown bullets), 27 NICCS Cybrary index pages + 538-row slug CSV + 10 detail pages, 7 NICCS LetsDefend index pages + 133-row slug CSV, plus 4 raw 404-fallback pages from invalid provider slugs (which validate the `validation_status='invalid_provider_slug'` path). Pull script at `context/training-catalogs/_pull_niccs.sh`.
- **Notion workspace:** Lives at parent page "graduate capstone workspace" with subpages 001 Use Case, 002 Architecture, 002a Ontology Design, 003 Range Build, 004 the platform Build, 005 Phase Planning, 006 Deliverables, plus a Scratch notes page. Kanban DB id `212b25f9-2b8e-8056-b8a5-000bf2b1b550`. Card properties are `Name` and `Status`. When updating Notion via MCP, child page links must be preserved manually using `<page url="..." />` syntax or they are lost on full rewrites.
- **NICCS:** Bulk export refused (formal email reply 2026-05-05 from NICCS Supervisory Office). NICCS confirmed no DCWF-tagged catalog exists or is planned; redirected to DISA. Public catalog HTML *is* parseable - Drupal Views pager `?page=N` works (20 per page, hardcoded), and Drupal field CSS classes (`field-tc-proficiency` etc.) are stable. So programmatic enumeration at small scale is viable; bulk-dump in one shot is not.
- **NICE/DCWF coverage gap:** NICE v2.0 stripped the Cyberspace Effects and Cyberspace Intelligence work role categories and pushed them to DCWF. The 17/170/25D audience has no NICE work role equivalents. `TrainingResource ↔ KSA` is therefore the right join granularity (KSAs persist across frameworks even when work roles diverge). Do not propose joining at the work role level.

## Training resource ingestion strategy

The point of the training-resource ingestion is to demonstrate "disparate inputs → unified output" - that's the architectural argument the capstone makes, scaled to the training-catalog space the same way the artifact → observation flow does it for exercise reports.

**Three input shapes, one canonical output.** Each source feeds its own thin extractor that emits a loosely-shaped staging row. The unification happens in the AI Function, not in the extractors:

1. **DoD 8140 Matrix XLSX** (already in `context/`). Structured cells, ~950 courses + ~430 certs, already work-role-tagged via WRC. Strongest source - the work-role assertion is ground truth and acts as a strong prior in `match_training_to_ksas`. `extract_dod8140` reads the XLSX and emits one staging row per course/cert.
2. **NICCS Drupal HTML** (catalog at `niccs.cisa.gov/training/catalog/{provider}`). Parseable but shallow - `objectives_text` is often the literal string `"Gain a skill"`. Two-stage flow: `enumerate_niccs_catalog` paginates `?page=N` to collect slugs cheaply (~40s per provider), then `extract_niccs_course_pages` fetches detail pages for explicitly-selected slugs only (kill-switch - never auto-fetches the full 12k catalog). The "Register for course" link points to the upstream provider page where the rich content actually lives, but those are typically SPAs and out of scope for the demo.
3. **GitHub awesome-* markdown** (e.g., `awesome-cybersecurity-blueteam`, `awesome-incident-response`). Unstructured prose - bullet lines like `* [Title](URL) - description`. `extract_github_md_catalog` parses the markdown into bullets with heading-stack context and emits one row per training-shaped entry.

**The convergence step.** `unify_training_resources` UNIONs all three staging tables, calls `normalize_training_resource` AI Function per row to canonicalize into the TRAINING_RESOURCE schema (regardless of source shape), then calls `match_training_to_ksas` AI Function per row to emit candidate TRAINING_RESOURCE_KSA rows scored 0.60-1.00. Mentor-curated rows (`match_method='curated'`) are preserved across re-runs.

**Don't pre-shape data in `context/`.** The raw artifacts that live in `context/training-catalogs/` are intentionally NOT cleaned, normalized, or ontology-friendly. They're the *inputs* to the demo - the value the capstone demonstrates is what happens between raw and unified. If you find yourself adding handwritten YAML mappings or curated bullet lists to `context/`, stop - that's me doing the ontology's job for the ontology. Add raw artifacts only.

**Selection drives the demo, not random sampling.** When picking which slugs to fetch detail pages for, drive selection from the work roles in scope (deduped core+additional KSAs across 17C / 17A / 170A / 25D, clustered into ~12-15 topic groups, 2-4 courses per cluster = 30-50 total). Manual hand-pick is fine; the goal is coverage, not catalog size.

## Open decisions Matt has not made yet

- Should `Observation` require all four core FKs (operator, ksa, exercise, artifact) or can `artifact_id` be optional for direct mentor-entered observations? (`mop_id` is already explicitly optional.)
- `KSAGap` recompute trigger: per-Observation immediate, or batched nightly?
- When to refactor `ExerciseArtifact` from one object with `artifact_type` discriminator into a platform interface (a base type) with concrete subtypes (NessusScanResult, AARDocument, MSELLog, DUBSlideDeck). Don't refactor until type-specific properties start driving distinct workflows; until then let `evidence_excerpt` absorb format-specific text.

Promotion conditions for things that were collapsed - if any of these triggers fire, the dropped object earns its place back:

- **`Commander` as an object** - needed once App has a commander-personalized view that requires session identity, audit history ("who saw this readiness data, and when"), or per-commander preferences. Re-add with `effective_from` / `effective_to` for command rotation history.
- **`MSEL_Event` as an object** - needed once the causal chain "scripted inject → blue-team response → Observation" becomes load-bearing in queries (e.g., "for inject I12, did blue team detect within SLA?"). Until then, the inject text lives in `evidence_excerpt`.
- **`RemediationPath` as an object** - needed once a "path" has its own write owner, action surface, or status independent of the items it contains (e.g., commander approval workflow on a path before items become active).
- **`Subtask` as a separate object** - needed once anything queries on the (MET → Subtask → MOP) middle level. So far MOPs roll up directly to METs via `met_id` FK; subtasks are decorative.

When these come up, flag them - don't paper over them with a default.

## How to push back on Matt

- Question framing drift, especially conflating cyber operators with general force.
- Question scope creep - anything that pulls focus from the artifact → KSA → remediation pipeline.
- If Matt proposes modeling something on the out-of-scope list, ask why before complying.
- If he cites an article or doctrinal source incorrectly, correct it.
- Honesty about gaps ("I wasn't grounding that in docs") is preferred to confident speculation.

## Style preferences

- Prose over bullets unless lists are essential.
- Don't open responses with sycophantic preambles.
- When proposing changes that span multiple files, flag the blast radius up front and confirm scope before mass-editing.
- For platform-specific claims, link to the relevant docs or course module rather than describing from memory.
- Direct, harsh feedback is preferred to softening. Matt iterates faster on sharper input.
