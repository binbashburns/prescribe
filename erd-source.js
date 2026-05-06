// Mermaid erDiagram source for the PRESCRIBE ontology.
// Edit this file to add entities or change relationships.
// Keep entity names in sync with entities.js - the side panel looks them up by name.

window.PRESCRIBE = window.PRESCRIBE || {};

window.PRESCRIBE.erdSource = `erDiagram
  WORK_ROLE {
    string work_role_id PK
    string work_role_code
    string title
    string workforce_element
  }
  KSA {
    string ksa_id PK
    string ksa_type
    string statement
  }
  TRAINING_RESOURCE {
    string training_resource_id PK
    string title
    string provider
    string objectives_text
    string ksa_match_method
  }
  MET {
    string met_id PK
    string code
    string statement
    string source_framework
    string proponent
    bool is_active
  }
  MOP {
    string mop_id PK
    string code
    string statement
    string standard_text
    bool is_critical
    string met_id FK
    string subtask_code
    string subtask_statement
    string source_framework
  }
  UNIT {
    string unit_id PK
    string name
    string unit_type
    string echelon
    string current_commander_name
    string current_commander_email
  }
  EXEVAL_RESULT {
    string exeval_result_id PK
    string exercise_id FK
    string unit_id FK
    string met_id FK
    string rating
    string assessor_notes
    string assessed_by
    datetime assessed_at
  }
  OPERATOR {
    string operator_id PK
    string callsign
    string mos_series
    string unit_id FK
  }
  EXERCISE {
    string exercise_id PK
    string name
    date start_date
    string adversary
  }
  EXERCISE_ARTIFACT {
    string artifact_id PK
    string artifact_type
    string source_path
    string exercise_id FK
    string source_author
    datetime artifact_time
  }
  OBSERVATION {
    string observation_id PK
    string operator_id FK
    string ksa_id FK
    string exercise_id FK
    string artifact_id FK
    string mop_id FK
    string signal
    float confidence
    string evidence_excerpt
    string validation_status
    string technique_tag
  }
  KSA_GAP {
    string ksa_gap_id PK
    string operator_id FK
    string ksa_id FK
    float severity_score
    int observation_count
    bool is_recurring
    int cycle_count
  }
  REMEDIATION_ITEM {
    string remediation_item_id PK
    string operator_id FK
    string scoped_work_role_id FK
    string ksa_gap_id FK
    string ksa_id FK
    string training_resource_id FK
    string training_objective
    int priority_rank
    string status
  }
  WORK_ROLE_KSA {
    string work_role_id FK
    string ksa_id FK
    string core_or_additional
  }
  TRAINING_RESOURCE_KSA {
    string training_resource_id FK
    string ksa_id FK
    string match_method
    float match_confidence
  }
  OPERATOR_WORK_ROLE {
    string operator_id FK
    string work_role_id FK
    string assignment_type
  }
  EXERCISE_OPERATOR {
    string exercise_id FK
    string operator_id FK
    string work_role_id FK
    string role_type
  }
  EXERCISE_UNIT {
    string exercise_id FK
    string unit_id FK
    string participation_type
  }
  UNIT_MET {
    string unit_id FK
    string met_id FK
    date selected_from
    date selected_to
    string selection_rationale
  }

  WORK_ROLE ||--o{ WORK_ROLE_KSA : ""
  KSA ||--o{ WORK_ROLE_KSA : ""
  TRAINING_RESOURCE ||--o{ TRAINING_RESOURCE_KSA : ""
  KSA ||--o{ TRAINING_RESOURCE_KSA : ""
  OPERATOR ||--o{ OPERATOR_WORK_ROLE : ""
  WORK_ROLE ||--o{ OPERATOR_WORK_ROLE : ""
  EXERCISE ||--o{ EXERCISE_OPERATOR : ""
  OPERATOR ||--o{ EXERCISE_OPERATOR : ""
  WORK_ROLE ||--o{ EXERCISE_OPERATOR : "performing"
  EXERCISE ||--o{ EXERCISE_UNIT : ""
  UNIT ||--o{ EXERCISE_UNIT : ""
  EXERCISE ||--o{ EXERCISE_ARTIFACT : "produces"
  MET ||--o{ MOP : "decomposes_to"
  MOP }o--o{ KSA : "requires"
  UNIT ||--o{ UNIT_MET : ""
  MET ||--o{ UNIT_MET : ""
  EXERCISE ||--o{ EXEVAL_RESULT : "produces"
  UNIT ||--o{ EXEVAL_RESULT : "rated"
  MET ||--o{ EXEVAL_RESULT : "on"
  EXERCISE_ARTIFACT ||--o{ OBSERVATION : "sourced_from"
  MOP ||--o{ OBSERVATION : "evaluated_by"
  OPERATOR ||--o{ OBSERVATION : "subject"
  KSA ||--o{ OBSERVATION : "tags"
  EXERCISE ||--o{ OBSERVATION : "during"
  OPERATOR ||--o{ KSA_GAP : ""
  KSA ||--o{ KSA_GAP : ""
  OPERATOR ||--o{ REMEDIATION_ITEM : ""
  WORK_ROLE ||--o{ REMEDIATION_ITEM : "scoped_to"
  KSA_GAP ||--o{ REMEDIATION_ITEM : "addresses"
  KSA ||--o{ REMEDIATION_ITEM : ""
  TRAINING_RESOURCE ||--o{ REMEDIATION_ITEM : ""
  UNIT ||--o{ OPERATOR : "assigns"`;
