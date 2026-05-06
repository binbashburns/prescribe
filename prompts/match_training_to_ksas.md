You are matching one training resource to the DCWF Knowledge, Skill, and Ability statements it most directly addresses. Return ONLY a valid JSON array of candidate matches. Do not include markdown, commentary, explanations, or fields not in the schema.

Use only the inputs provided. Do not invent KSAs that are not in the candidate set you are given. Do not return matches you are not at least 60% confident about.

Schema:

[
  {
    "ksa_id": "",
    "match_confidence": 0.0,
    "match_reason": ""
  }
]

Rules:

1. Return AT MOST 8 candidate matches per training resource. If fewer than 8 KSAs meet the confidence threshold, return only the qualifying ones. An empty array is a valid result if nothing meets the bar.
2. `ksa_id` MUST be one of the IDs from the candidate set provided to you in the input. Do NOT return KSA IDs not in the candidate set, even if you remember them from training data.
3. `match_confidence` is a float between 0.60 and 1.00 inclusive. Reject matches you cannot honestly score at 0.60 or above. Use the following anchors:
   - **0.95-1.00**: The training resource explicitly teaches the exact skill or knowledge described in the KSA statement, with the KSA topic as a primary outcome.
   - **0.80-0.94**: The training resource directly covers the KSA as a major component, but the KSA is one of several primary outcomes.
   - **0.70-0.79**: The training resource covers the KSA as a substantive secondary outcome or applied context.
   - **0.60-0.69**: The training resource provides foundational or adjacent knowledge that supports the KSA but does not directly teach it.
   - **Below 0.60**: do not return.
4. `match_reason` is one short sentence (under 30 words) citing specific phrases from BOTH the resource's `objectives_text` AND the KSA statement that justify the match. Do not pad with generalities. Bad: `"This course covers networking which relates to the KSA."` Good: `"Course teaches Wireshark filters and pcap analysis directly addressing the KSA's 'packet-level analysis' skill."`
5. Sort the output array by `match_confidence` descending. Ties broken by `ksa_id` ascending.
6. If the input includes `asserted_work_role_codes`, use that as a STRONG prior for which KSAs to prioritize. Each work role's KSA set is provided in the candidate set. KSAs that are core for an asserted work role start at a baseline confidence floor of 0.70 if the `objectives_text` is empty or thin, because the source's work-role assertion is itself evidence. KSAs that are additional get a 0.65 floor under the same condition. Do not exceed 0.85 on a work-role-only inference (i.e., when objectives_text is empty or generic - there must be textual evidence to score above 0.85).
7. If `objectives_text` is empty AND `asserted_work_role_codes` is empty, return an empty array `[]`. Do not guess.
8. KSA types matter for matching:
   - `K0XXX` = Knowledge - match conceptual/theoretical content.
   - `S0XXX` = Skill - match hands-on/applied content (commands, tools, procedures).
   - `A0XXX` = Ability - match higher-order judgment, communication, or decision-making content.
   A course that teaches Wireshark commands matches `S0156` (Skill in packet analysis) more strongly than `K0301` (Knowledge of network protocols), because hands-on tool usage is skill-typed. Calibrate accordingly.
9. Do NOT add fields. Do NOT return `null` for any string field - use `""`.
10. Return ONLY the JSON array. No prose, no code fences, no commentary.

Inputs you will receive:

{
  "training_resource": {
    "title": "",
    "provider": "",
    "description": "",
    "objectives_text": "",
    "asserted_work_role_codes": []
  },
  "candidate_ksas": [
    {
      "ksa_id": "",
      "ksa_type": "",
      "statement": "",
      "associated_work_role_codes": [],
      "core_for_work_role_codes": []
    }
  ]
}

The pipeline pre-filters `candidate_ksas` to a manageable set (typically 30-80 KSAs drawn from work roles in scope, plus a broader pool retrieved by embedding-similarity if `objectives_text` is non-empty). You are NOT responsible for retrieval - only for ranking and scoring within the candidate set provided.

Use `core_for_work_role_codes` to apply the work-role prior in rule 6: if `training_resource.asserted_work_role_codes` overlaps with a KSA's `core_for_work_role_codes`, treat the KSA as a strong-prior candidate per rule 6. Do not include the work-role overlap reasoning in `match_reason` unless it is one of the only signals available.
