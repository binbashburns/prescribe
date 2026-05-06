// Per-entity metadata for the side detail panel.
// Each entry's key MUST match the entity name in erd-source.js.
//
// layer: reference | observed | derived | continuity | join
// description: one-paragraph plain-English summary
// designNote: optional. Why the design is the way it is. Surfaces decisions worth remembering.

window.PRESCRIBE = window.PRESCRIBE || {};

window.PRESCRIBE.entities = {

 // ============ REFERENCE LAYER ============

 WORK_ROLE: {
 layer: "reference",
 description: "DCWF work role. Loaded from the DCWF xlsx and treated as slow-changing reference data. The competency spine for the entire ontology.",
 designNote: "DCWF replaced ATT&CK as the structural spine because the audience's readiness is measured in workforce framework terms, not adversary technique coverage. DCWF Tasks were dropped from the ontology - they aren't in any data flow (Observations map to KSAs directly), and keeping them would have been pure schema overhead.",
 references: [
 { label: "DoD Cyber Workforce Framework (DCWF) - DoD CIO Cyber Workforce Innovation Directorate", url: "https://www.cyber.mil/dod-workforce-innovation-directorate/dod-cyber-workforce-framework" },
 { label: "DoDM 8140.03 (Cyberspace Workforce Qualification & Management)", url: "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodm/814003p.pdf" }
 ]
 },

 KSA: {
 layer: "reference",
 description: "DCWF Knowledge, Skill, or Ability statement. The atomic unit of competency measurement. Every Observation maps to exactly one KSA.",
 designNote: "Granularity is fine on purpose - fine enough that an evaluator note like 'missed the lateral movement detection' maps to a specific KSA, not a coarse category.",
 references: [
 { label: "DCWF Work Role Tool (downloadable XLSX of work roles, tasks, KSAs)", url: "https://www.cyber.mil/dod-workforce-innovation-directorate/dod-cyber-workforce-framework/dcwf" },
 { label: "NIST NICE Framework (KSA reference for cybersecurity workforce)", url: "https://www.nist.gov/itl/applied-cybersecurity/nice/nice-framework-resource-center" }
 ]
 },

 TRAINING_RESOURCE: {
 layer: "reference",
 description: "An external course or learning resource (NICCS, GIAC, Pluralsight, internal DoD training). Maps to KSAs via the TRAINING_RESOURCE_KSA join.",
 designNote: "ksa_match_method tracks whether mapping was hand-curated (POC) or AI-derived via semantic match against objectives_text. The join carries a confidence score for AI matches.",
 references: [
 { label: "NICCS Education & Training Catalog (CISA)", url: "https://niccs.cisa.gov/training/catalog" },
 { label: "GIAC certifications", url: "https://www.giac.org/certifications/" },
 { label: "awesome-cybersecurity-blueteam (curated training/tools list)", url: "https://github.com/fabacab/awesome-cybersecurity-blueteam" },
 { label: "DoD 8140 Matrix (work-role-tagged courses + certifications)", url: "https://www.cyber.mil/dod-workforce-innovation-directorate/dod8140/qualification-matrices" }
 ]
 },

 MET: {
 layer: "reference",
 description: "Mission Essential Task. The shared pool from which CPTs select their METLs (Mission Essential Task Lists). Different CPTs have different METLs, but they're all drawn from this master set. Per the Cyber Exercise Assessment Handbook, METs are typically derived from NIST CSF or the CMF Training & Readiness Manual.",
 designNote: "Promoted from a flat string property on MOP to a first-class reference object once the boss confirmed (2026-05-05) that the audience is CPTs being EXEVAL'd, and the per-CPT METL selection from a shared pool needs to be queryable. Subtask stays folded into MOP as flat strings - subtasks aren't independently rated, they only structure MOPs.",
 references: [
 { label: "Cyber Exercise Assessment Handbook v1.0 (JHU/APL, 2016) - METL/MOP doctrinal framework", url: "https://apps.dtic.mil/sti/citations/AD1018078" },
 { label: "ADP 7-0 Training (Army Doctrine Publication)", url: "https://armypubs.army.mil/ProductMaps/PubForm/Details.aspx?PUB_ID=1023568" },
 { label: "FM 7-0 Training (Army Field Manual)", url: "https://armypubs.army.mil/ProductMaps/PubForm/Details.aspx?PUB_ID=1024128" },
 { label: "NIST Cybersecurity Framework", url: "https://www.nist.gov/cyberframework" }
 ]
 },

 MOP: {
 layer: "reference",
 description: "Measure of Performance - the atomic, quantifiable unit of exercise assessment per the Cyber Exercise Assessment Handbook. Each MOP belongs to one MET (via met_id FK) and carries standard_text (grading criteria), is_critical, and the subtask context as flat strings. Bridges per-exercise rubric judgment to the DCWF spine via MOP↔KSA.",
 designNote: "met_id is a foreign key to the MET object now. Subtask stays as flat strings (subtask_code, subtask_statement) because subtasks aren't independently rated - they only group MOPs. Standards live on MOP itself; if standards diverge per exercise, refactor to a MOP_STANDARD_FOR_EXERCISE join. ATT&CK technique tagging stays as a string property on Observation.",
 references: [
 { label: "Cyber Developmental Test and Evaluation Guidebook v 3.0", url: "https://www.cto.mil/wp-content/uploads/2025/07/Cyber-DTE-Guidebook-V3-June2025.pdf" },
 { label: "AFDP 3-12, Cyberspace Operations, 01 May 2026", url: "https://www.doctrine.af.mil/Portals/61/documents/AFDP_3-12/3-12-AFDP-CYBERSPACE-OPS.pdf" }
 ]
 },

 EXEVAL_RESULT: {
 layer: "observed",
 description: "Per-EXEVAL per-METL rating issued to a Unit by an external assessor. The 'assessment received' the boss explicitly asked to capture. Army readiness ratings for CPT EXEVALs use Trained / Practiced / Untrained (T/P/U). One row per (exercise × unit × MET) tuple where the unit was assessed.",
 designNote: "Distinct from OBSERVATION (per-claim, per-operator, mapped to KSA) because it operates at the team-level rubric layer, not the operator-level competency layer. EXEVAL_RESULT is what a CPT carries forward as a readiness-of-record fact; OBSERVATION is what feeds individualized remediation. Both are sourced from EXERCISE_ARTIFACT (specifically evaluator_scorecard artifacts) but at different granularity. assessor_notes is free-text; assessed_by is the rater (string), not a first-class object."
 },

 // ============ OBSERVED LAYER ============

 OPERATOR: {
 layer: "observed",
 description: "Cyber operator (17-series, 170-series, 25D MOS). Belongs to a unit; holds one or more DCWF work roles via OPERATOR_WORK_ROLE.",
 designNote: "Population scope is deliberate: cyber operators whose readiness is measured through exercise performance. Not general-force cyber awareness."
 },

 EXERCISE: {
 layer: "observed",
 description: "A scheduled cyber exercise with start/end dates, scenario, and adversary attribution. Produces ExerciseArtifacts (post-event docs, range logs, MSEL logs) which are the source for all Observations.",
 designNote: "adversary is a string property, not a link. ThreatActor was deliberately left out of the ontology - adding it pulls scope toward intel modeling, away from competency tracking."
 },

 EXERCISE_ARTIFACT: {
 layer: "observed",
 description: "A single document or log file dropped into the exercise-artifacts/ S3 prefix. Concrete artifact_type values observed in the corpus: aar, evaluator_scorecard (METL/MSEL Reports), daily_update_brief, hot_wash, nessus_scan, range_log (Security Onion / Zeek / Suricata / Wazuh), msel_log.",
 designNote: "MSEL log is just one more artifact_type - the EXCON-scripted scenario events are extracted from it as Observations like any other source. One object today; refactor to a platform interface (a base type) with concrete subtypes (NessusScanResult, AARDocument, MSELLog) only when artifact-type-specific properties start driving distinct workflows. Don't add Nessus or AAR-specific fields here now - let evidence_excerpt absorb them. source_author is a string property; Mentor and Rater are not first-class objects."
 },

 OBSERVATION: {
 layer: "observed",
 description: "THE KEYSTONE OBJECT. Each Observation links one Operator × one KSA × one Exercise, sourced from one ExerciseArtifact. Optionally also links to a MOP (the per-exercise rubric judgment). Carries signal (strength/deficiency/neutral), confidence, verbatim evidence_excerpt, and validation_status.",
 designNote: "Granularity is one Observation per discrete claim, not per artifact section. AI extracts these as candidates; mentor validation flips validation_status to confirmed before they propagate to KSA_GAP. mop_id is optional - direct mentor-entered observations and passive scan findings (Nessus) won't have a MOP. technique_tag stays a string property; never link to ATT&CK objects.",
 references: [
 { label: "MITRE ATT&CK (technique_tag string values reference this)", url: "https://attack.mitre.org/" },
 { label: "Tenable Nessus (one source format for technical observations)", url: "https://www.tenable.com/products/nessus" }
 ]
 },

 // ============ DERIVED LAYER ============

 KSA_GAP: {
 layer: "derived",
 description: "Computed per-operator gap on a specific KSA, aggregated from confirmed Observations. Carries is_recurring and cycle_count for longitudinal commander views - same gap for the same operator across two or more exercise cycles flips is_recurring to true.",
 designNote: "is_recurring + cycle_count replaced a previously separate RECURRING_DEFICIENCY object. The semantics were thin enough that a flag on KSA_GAP is more truthful than a duplicate object. Open question: per-Observation immediate recompute, or batched nightly?"
 },

 REMEDIATION_ITEM: {
 layer: "derived",
 description: "One prescribed action to close a KSA_GAP, scoped to a specific work role for the operator. Carries the addressed gap, the target KSA, an optional TRAINING_RESOURCE, a free-text training_objective, priority_rank, and status.",
 designNote: "REMEDIATION_PATH was dropped - 'a path' is just 'all REMEDIATION_ITEMs for operator X scoped to work role Y,' which is a App query, not an object. scoped_work_role_id lives directly on the item so an operator with a 17-series primary and a 25D additional role gets two distinct sets of items without needing a wrapper. training_resource_id is optional - some items will be objective-only ('demonstrate Suricata rule writing on the next exercise')."
 },

 // ============ CONTINUITY LAYER ============

 UNIT: {
 layer: "continuity",
 description: "Organizational unit. The PRIMARY scope for PRESCRIBE is Cyber Protection Teams (CPTs) - 39-person Army cyber units assigned to a Cyber Protection Brigade - being EXEVAL'd to certify mission readiness. unit_type distinguishes CPT from BCT, BDE, and other unit types. Operators belong to a unit; units participate in exercises and carry their own METL via UNIT_MET; units receive per-METL EXEVAL ratings via EXEVAL_RESULT. Survives operator and commander turnover.",
 designNote: "Continuity layer exists so institutional memory of training history persists across command transitions and PCS moves. unit_type drives which App views surface to which audiences (CPT-specific commander view vs. generic readiness view). COMMANDER was dropped as a separate object for v1; promote back when a commander-personalized App surface needs session identity. current_commander_name + current_commander_email are denormalized strings on UNIT for now."
 },

 // ============ JOIN TABLES ============

 WORK_ROLE_KSA: {
 layer: "join",
 description: "Many-to-many join between WORK_ROLE and KSA. Carries the core_or_additional flag because DCWF distinguishes core KSAs (mandatory for the role) from additional KSAs (relevant but supplementary).",
 designNote: "The platform needs this as an object-backed link type because it carries a payload. Gap weighting uses core_or_additional - operators losing a core KSA grade more severely than an additional one."
 },

 TRAINING_RESOURCE_KSA: {
 layer: "join",
 description: "Many-to-many join between TRAINING_RESOURCE and KSA. Carries match_method (curated | semantic) and match_confidence.",
 designNote: "Hybrid curated+AI training mapping. Curated rows are seeded from hand-mapping; semantic rows are written by AI after embedding objectives_text against KSA statements."
 },

 OPERATOR_WORK_ROLE: {
 layer: "join",
 description: "Many-to-many join between OPERATOR and WORK_ROLE for enduring DCWF assignments. Operators routinely hold multiple work roles. Carries assignment_type (primary, additional_1, additional_2 per DCWF coding rules).",
 designNote: "DCWF allows up to three work role codes per position with primary >= 50% of duties. The join schema mirrors that exactly so coding stays unambiguous. Distinct from EXERCISE_OPERATOR.work_role_id, which captures the role the operator was actually performing during a single exercise (often a subset of their enduring assignments)."
 },

 EXERCISE_OPERATOR: {
 layer: "join",
 description: "Many-to-many join between EXERCISE and OPERATOR. Carries role_type as a value-typed enum (red, blue, white, evaluator, opfor) AND work_role_id pointing to the DCWF work role the operator was performing during this specific exercise.",
 designNote: "The work_role_id link is what makes 'expected KSAs for operator X in exercise Y' a 2-hop query (EXERCISE_OPERATOR → WORK_ROLE → WORK_ROLE_KSA). Without it, the only path went through OPERATOR_WORK_ROLE and returned ALL of the operator's enduring KSAs - wrong scope, because operators with multiple work roles only perform one of them per exercise. role_type is a value type, not its own object."
 },

 EXERCISE_UNIT: {
 layer: "join",
 description: "Many-to-many join between EXERCISE and UNIT. Carries participation_type (host, participant, opfor).",
 designNote: "Multiple units can participate in one exercise; one unit participates in many exercises over time."
 },

 UNIT_MET: {
 layer: "join",
 description: "Many-to-many join between UNIT and MET. Captures which METLs (Mission Essential Tasks) a CPT (or other unit) has currently selected from the shared MET pool. Carries selected_from / selected_to for METL rotation history and selection_rationale (free-text).",
 designNote: "CPTs select their METLs from a standardized pool - this join models the selection. selected_from / selected_to make this temporal so a CPT's prior METL set can be reconstructed for historical EXEVAL analysis. selection_rationale captures the why - typically tied to mission priority, force-package alignment, or higher-headquarters direction. Without this join, EXEVAL_RESULT would have no way to validate that the rated METL was actually one the CPT had selected at the time of assessment."
 }

};
