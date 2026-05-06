// Automations metadata for PRESCRIBE.
//
// Drives the AI Automate, Data processing, and Application tabs. Each entry
// declares which ontology objects it reads and writes, so the per-entity panel
// can show "this object is written by X / read by Y" links.
//
// The objects[] arrays must reference entity names that exist in entities.js.

window.PRESCRIBE = window.PRESCRIBE || {};

// AI Function - small, focused LLM-call wrappers. the platform's "Automate
// with AI" layer. Each function has its own prompt file in prompts/.
window.PRESCRIBE.aipFunctions = {
 extract_observation_candidates: {
 title: "Extract Observation Candidates",
 purpose: "Reads the raw text of one exercise artifact and segments it into discrete observation candidates (verbatim excerpts + signal + named operator + optional ATT&CK technique + optional MOP code). Returns a JSON array. Called per-artifact by the extract_observations batch pipelines.",
 promptFile: "prompts/extract_observation_candidates.md",
 modelTier: "Standard reasoning (Sonnet tier)",
 reads: ["EXERCISE_ARTIFACT", "KSA"],
 writes: [],
 invokedBy: ["extract_observations_pipeline"]
 },
 generate_training_objective: {
 title: "Generate Training Objective",
 purpose: "Given a KSA gap context (KSA statement, severity, operator MOS, work role, optional training resource objectives), produces a single-sentence imperative training objective for the operator's remediation plan. Called per-item by the generate_remediation_items batch pipelines.",
 promptFile: "prompts/generate_training_objective.md",
 modelTier: "Standard reasoning (Sonnet tier)",
 reads: ["KSA", "KSA_GAP", "OPERATOR", "WORK_ROLE", "TRAINING_RESOURCE"],
 writes: [],
 invokedBy: ["generate_remediation_items"]
 },
 normalize_training_resource: {
 title: "Normalize Training Resource",
 purpose: "Reads a heterogeneous staging row from any source (DoD 8140 XLSX, NICCS Drupal HTML, GitHub awesome-list markdown, or manual entry) and emits a canonical TRAINING_RESOURCE row in JSON. The format-agnostic step that makes 'disparate inputs → unified output' actually work.",
 promptFile: "prompts/normalize_training_resource.md",
 modelTier: "Standard reasoning (Sonnet tier)",
 reads: [],
 writes: ["TRAINING_RESOURCE"],
 invokedBy: ["unify_training_resources"]
 },
 match_training_to_ksas: {
 title: "Match Training to KSAs",
 purpose: "Given a normalized TRAINING_RESOURCE (objectives_text + asserted_work_role_codes) and a candidate KSA set, ranks and scores up to 8 KSA matches with confidence between 0.60 and 1.00. Uses work-role assertion as a strong prior when the source carried it (e.g., DoD 8140 mappings).",
 promptFile: "prompts/match_training_to_ksas.md",
 modelTier: "Standard reasoning (Sonnet tier)",
 reads: ["TRAINING_RESOURCE", "KSA", "WORK_ROLE_KSA"],
 writes: ["TRAINING_RESOURCE_KSA"],
 invokedBy: ["unify_training_resources"]
 },
 extract_exeval_ratings: {
 title: "Extract EXEVAL Ratings",
 purpose: "Reads an evaluator scorecard or METL report and extracts per-METL T/P/U ratings issued to a unit. The METL-level counterpart to extract_observation_candidates: same artifact, different granularity (team-level rubric, not per-operator competency claim).",
 promptFile: "prompts/extract_exeval_ratings.md",
 modelTier: "Standard reasoning (Sonnet tier)",
 reads: ["EXERCISE_ARTIFACT", "MET", "UNIT"],
 writes: ["EXEVAL_RESULT"],
 invokedBy: ["extract_exeval_ratings_pipeline"]
 }
};

// Batch pipelines - Data Processing layer. Pure-data orchestration that may
// CALL an AI Function inside but is itself a batch pipeline spec.
window.PRESCRIBE.pipelines = {
 ingest_exercise_artifacts: {
 title: "Ingest Exercise Artifacts",
 purpose: "Watches S3 prefix exercise-artifacts/ for new files, classifies each by type (regex-based), extracts metadata, emits one EXERCISE_ARTIFACT row per file. No AI Function call on the core path.",
 specFile: "pipelines/ingest_exercise_artifacts.md",
 reads: ["EXERCISE"],
 writes: ["EXERCISE_ARTIFACT"],
 callsAip: []
 },
 extract_observations_pipeline: {
 title: "Extract Observations",
 purpose: "Reads each new EXERCISE_ARTIFACT, extracts text via lightweight VLM, calls extract_observation_candidates AI Function per artifact, resolves operators against the exercise roster, semantic-maps excerpts to KSAs via embedding, emits one OBSERVATION row per (operator × KSA × artifact). The keystone data-flow pipeline.",
 specFile: "pipelines/extract_observations_pipeline.md",
 reads: ["EXERCISE_ARTIFACT", "KSA", "MOP", "EXERCISE_OPERATOR"],
 writes: ["OBSERVATION"],
 callsAip: ["extract_observation_candidates"]
 },
 extract_exeval_ratings_pipeline: {
 title: "Extract EXEVAL Ratings",
 purpose: "Filters new EXERCISE_ARTIFACT rows to scorecard / METL-report types, calls extract_exeval_ratings AI Function per artifact, resolves the assessed unit via EXERCISE_UNIT, validates extracted MET codes against the unit's selected METL via UNIT_MET (only METLs the CPT actually selected get rated), emits one EXEVAL_RESULT row per (exercise × unit × MET) tuple. The unit-level counterpart to extract_observations_pipeline.",
 specFile: "pipelines/extract_exeval_ratings_pipeline.md",
 reads: ["EXERCISE_ARTIFACT", "MET", "UNIT", "EXERCISE_UNIT", "UNIT_MET"],
 writes: ["EXEVAL_RESULT"],
 callsAip: ["extract_exeval_ratings"]
 },
 aggregate_ksa_gaps: {
 title: "Aggregate KSA Gaps",
 purpose: "Aggregates confirmed Observations into per-operator KSA gaps. Weights by core/additional designation. Computes is_recurring + cycle_count by comparing to the prior snapshot. Pure transform - no AI Function.",
 specFile: "pipelines/aggregate_ksa_gaps.md",
 reads: ["OBSERVATION", "WORK_ROLE_KSA", "OPERATOR_WORK_ROLE"],
 writes: ["KSA_GAP"],
 callsAip: []
 },
 generate_remediation_items: {
 title: "Generate Remediation Items",
 purpose: "Takes per-operator KSA gaps above severity threshold, matches them to TrainingResources via TRAINING_RESOURCE_KSA, calls generate_training_objective AI Function per item, emits one REMEDIATION_ITEM per (operator × gap × work-role). Preserves operator-set status across re-runs.",
 specFile: "pipelines/generate_remediation_items.md",
 reads: ["KSA_GAP", "TRAINING_RESOURCE_KSA", "TRAINING_RESOURCE", "OPERATOR_WORK_ROLE", "WORK_ROLE_KSA", "OPERATOR", "WORK_ROLE", "KSA"],
 writes: ["REMEDIATION_ITEM"],
 callsAip: ["generate_training_objective"]
 },
 extract_dod8140: {
 title: "Extract DoD 8140 Matrix",
 purpose: "Reads the DoD 8140 Matrix XLSX (already in context/), extracts ~950 DoD courses + ~430 certifications mapped to DCWF work role codes, emits one staging row per course/cert with raw fields. Pure XLSX parsing - no AI. Demonstrates structured-input ingestion.",
 specFile: "pipelines/extract_dod8140.md",
 reads: ["WORK_ROLE"],
 writes: [],
 callsAip: [],
 feedsInto: ["unify_training_resources"]
 },
 enumerate_niccs_catalog: {
 title: "Enumerate NICCS Catalog",
 purpose: "Polite paginated enumeration of NICCS provider catalogs (Drupal Views ?page=N pager, 20 per page). Emits a slug list per provider - the cheap stage. Does NOT fetch course detail pages. Cybrary alone is 538 slugs; full enumeration takes ~40s per provider.",
 specFile: "pipelines/enumerate_niccs_catalog.md",
 reads: [],
 writes: [],
 callsAip: [],
 feedsInto: ["extract_niccs_course_pages"]
 },
 extract_niccs_course_pages: {
 title: "Extract NICCS Course Pages",
 purpose: "Fetches detail pages for a configured slug-selection list (kill-switch - never auto-fetches all 12k catalog entries). Parses Drupal field containers for proficiency, delivery, audience, objectives, provider, and the upstream 'Register for course' URL. Demonstrates HTML-input ingestion.",
 specFile: "pipelines/extract_niccs_course_pages.md",
 reads: [],
 writes: [],
 callsAip: [],
 feedsInto: ["unify_training_resources"]
 },
 extract_github_md_catalog: {
 title: "Extract GitHub Markdown Catalog",
 purpose: "Reads markdown READMEs from GitHub awesome-* repos (e.g., awesome-cybersecurity-blueteam, awesome-incident-response). Parses bullet entries with heading-stack context. Emits one staging row per training-shaped entry. Demonstrates unstructured-input ingestion - no fields, just prose.",
 specFile: "pipelines/extract_github_md_catalog.md",
 reads: [],
 writes: [],
 callsAip: [],
 feedsInto: ["unify_training_resources"]
 },
 unify_training_resources: {
 title: "Unify Training Resources",
 purpose: "The convergence pipeline. UNIONs all staging tables, calls normalize_training_resource per row to canonicalize, then calls match_training_to_ksas per row to emit candidate KSA mappings. Preserves mentor-curated TRAINING_RESOURCE_KSA rows across re-runs. THIS is the 'disparate inputs → unified output' step.",
 specFile: "pipelines/unify_training_resources.md",
 reads: ["WORK_ROLE_KSA", "WORK_ROLE", "KSA"],
 writes: ["TRAINING_RESOURCE", "TRAINING_RESOURCE_KSA"],
 callsAip: ["normalize_training_resource", "match_training_to_ksas"]
 }
};

// App views - Application layer. Stubbed for now; fill in as the
// commander/operator views get designed.
window.PRESCRIBE.workshopViews = {
 operator_profile: {
 title: "Operator Profile",
 audience: "Operator (self-view) + Commander",
 purpose: "Per-operator dashboard showing current KSA gaps, recent observations, and active remediation items. The operator's primary view of their own readiness; the commander's drill-down view from the unit roster.",
 surfaces: ["OPERATOR", "OBSERVATION", "KSA_GAP", "REMEDIATION_ITEM", "OPERATOR_WORK_ROLE"]
 },
 mentor_validation_queue: {
 title: "Mentor Validation Queue",
 audience: "Mentors / Team Controllers",
 purpose: "Queue of OBSERVATION rows with validation_status = 'candidate' or 'needs_resolution'. Mentor reviews each, edits operator_id if needed, and flips status to 'confirmed' (which then propagates to KSA_GAP via the aggregate_ksa_gaps pipeline).",
 surfaces: ["OBSERVATION", "EXERCISE_ARTIFACT", "OPERATOR"]
 },
 unit_recurring_deficiencies: {
 title: "Unit Recurring Deficiencies",
 audience: "Commander",
 purpose: "Unit-level view of KSA_GAP rows where is_recurring = true, grouped by KSA, sorted by total cycle_count across the unit. The longitudinal commander view that exposes training failures the unit hasn't closed across multiple exercise cycles.",
 surfaces: ["UNIT", "OPERATOR", "KSA_GAP", "KSA"]
 },
 remediation_plan: {
 title: "My Remediation Plan",
 audience: "Operator (self-view)",
 purpose: "Operator's prioritized list of REMEDIATION_ITEM rows. Each item shows the gap KSA, the training objective text, an optional course link, and a status the operator can flip (active → in_progress → completed).",
 surfaces: ["OPERATOR", "REMEDIATION_ITEM", "TRAINING_RESOURCE", "KSA"]
 },
 exercise_after_action: {
 title: "Exercise After Action",
 audience: "Exercise Director / Assessment Cell",
 purpose: "Per-exercise summary view: which artifacts were ingested, how many Observations were extracted, MOP coverage rates, top-N gaps surfaced. Read-only consumption of the data-flow output.",
 surfaces: ["EXERCISE", "EXERCISE_ARTIFACT", "OBSERVATION", "MOP"]
 },
 cpt_exeval_summary: {
 title: "CPT EXEVAL Summary",
 audience: "CPT Commander / Brigade S3",
 purpose: "Per-CPT readiness view of the most recent EXEVAL: each METL the CPT has selected, the rating received (Trained / Practiced / Untrained), assessor notes, and the longitudinal trend across prior EXEVALs. Drills down to the OBSERVATION-level evidence behind any rating. The headline view for the boss-driven CPT EXEVAL use case.",
 surfaces: ["UNIT", "MET", "UNIT_MET", "EXEVAL_RESULT", "EXERCISE", "OBSERVATION"]
 }
};

// Helper indexes - built once and reused.
window.PRESCRIBE.automationIndex = (function() {
 const aipByObject = {}; // entity → { reading: [...], writing: [...] }
 const pipelineByObject = {};
 const viewsByObject = {};

 function add(idx, key, entry, role, obj) {
 if (!idx[obj]) idx[obj] = { reading: [], writing: [], surfacing: [] };
 idx[obj][role].push({ key, ...entry });
 }

 for (const [key, fn] of Object.entries(window.PRESCRIBE.aipFunctions)) {
 fn.reads.forEach(o => add(aipByObject, key, fn, "reading", o));
 fn.writes.forEach(o => add(aipByObject, key, fn, "writing", o));
 }
 for (const [key, p] of Object.entries(window.PRESCRIBE.pipelines)) {
 p.reads.forEach(o => add(pipelineByObject, key, p, "reading", o));
 p.writes.forEach(o => add(pipelineByObject, key, p, "writing", o));
 }
 for (const [key, v] of Object.entries(window.PRESCRIBE.workshopViews)) {
 v.surfaces.forEach(o => add(viewsByObject, key, v, "surfacing", o));
 }

 return { aipByObject, pipelineByObject, viewsByObject };
})();
