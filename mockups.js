// App view mockups for PRESCRIBE.
//
// Each mockup is HTML rendered into the side panel when the user clicks a
// view block on the Application-mode diagram. Sample data is fake but uses
// realistic PRESCRIBE domain language (DCWF KSA codes, EXERCISE-DEMO exercise,
// callsigns from the corpus, etc.). Mockups are wireframes - they're for
// design conversation, not production.

window.PRESCRIBE = window.PRESCRIBE || {};

window.PRESCRIBE.mockups = {

  operator_profile: `
    <div class="mock">
      <div class="mock-header">
        <div class="mock-title">GHOST06 - CPL Smith, J.</div>
        <div class="mock-sub">17C · 1st BCT, 2-7 Cyber · Cyber Defense Analyst (CS-511) primary · Vulnerability Analyst (CS-541) additional</div>
      </div>

      <div class="mock-stat-row">
        <div class="mock-stat"><div class="mock-stat-num">7</div><div class="mock-stat-lbl">Active KSA gaps</div></div>
        <div class="mock-stat"><div class="mock-stat-num">3</div><div class="mock-stat-lbl">Recurring</div></div>
        <div class="mock-stat"><div class="mock-stat-num">12</div><div class="mock-stat-lbl">Items in plan</div></div>
        <div class="mock-stat"><div class="mock-stat-num">4</div><div class="mock-stat-lbl">Exercises</div></div>
      </div>

      <div class="mock-section">
        <div class="mock-section-title">Active KSA Gaps</div>
        <table class="mock-table">
          <tr><td><code>S0089</code></td><td>Skill in identifying lateral movement indicators</td><td><span class="mock-sev high">0.82</span></td><td><span class="mock-badge">recurring × 3</span></td></tr>
          <tr><td><code>S0167</code></td><td>Skill in writing IDS signatures (Suricata)</td><td><span class="mock-sev high">0.74</span></td><td></td></tr>
          <tr><td><code>K0334</code></td><td>Knowledge of network traffic analysis methods</td><td><span class="mock-sev med">0.58</span></td><td><span class="mock-badge">recurring × 2</span></td></tr>
          <tr><td><code>S0258</code></td><td>Skill in performing event correlation</td><td><span class="mock-sev med">0.51</span></td><td></td></tr>
          <tr><td><code>K0177</code></td><td>Knowledge of cyber attack stages (kill chain)</td><td><span class="mock-sev low">0.34</span></td><td></td></tr>
        </table>
      </div>

      <div class="mock-section">
        <div class="mock-section-title">Recent Observations (EXERCISE-DEMO)</div>
        <ul class="mock-feed">
          <li><span class="mock-sig def">DEFICIENCY</span> Failed to detect Sliver C2 beacon to c2.example.adversary during inject I12. <span class="mock-evi">- hot_wash, Day 3</span></li>
          <li><span class="mock-sig def">DEFICIENCY</span> Did not flag certipy-generated Kerberos ticket within 30-min SLA. <span class="mock-evi">- evaluator_scorecard, Day 3</span></li>
          <li><span class="mock-sig str">STRENGTH</span> Correctly identified ExampleApp prompt-injection vector. <span class="mock-evi">- DUB Day 2</span></li>
          <li><span class="mock-sig def">DEFICIENCY</span> Missed lateral movement on 10.10.4.0/24 (nbtscan). <span class="mock-evi">- hot_wash, Day 3</span></li>
        </ul>
      </div>

      <div class="mock-section">
        <div class="mock-section-title">Active Remediation Plan (top 3)</div>
        <div class="mock-card-grid">
          <div class="mock-card"><div class="mock-card-rank">#1</div><div>Demonstrate ability to write a Suricata rule that detects Sliver C2 beacon traffic during the next exercise window.</div><div class="mock-card-foot">SANS SEC504 · in_progress</div></div>
          <div class="mock-card"><div class="mock-card-rank">#2</div><div>Detect and report at least one Kerberos ticket abuse attempt (Rubeus or Certipy) within 30 minutes of inject during the next exercise.</div><div class="mock-card-foot">no course · active</div></div>
          <div class="mock-card"><div class="mock-card-rank">#3</div><div>Identify lateral movement on internal /24 subnets using passive traffic analysis during the next exercise.</div><div class="mock-card-foot">Pluralsight "Advanced Network Detection" · active</div></div>
        </div>
      </div>

      <div class="mock-foot">Surfaces from: OPERATOR, OBSERVATION, KSA_GAP, REMEDIATION_ITEM, OPERATOR_WORK_ROLE</div>
    </div>
  `,

  mentor_validation_queue: `
    <div class="mock">
      <div class="mock-header">
        <div class="mock-title">Mentor Validation Queue</div>
        <div class="mock-sub">CW3 Reyes · 1st Cyber BDE · EXERCISE-DEMO evaluator</div>
      </div>

      <div class="mock-stat-row">
        <div class="mock-stat"><div class="mock-stat-num">147</div><div class="mock-stat-lbl">Candidate</div></div>
        <div class="mock-stat"><div class="mock-stat-num">12</div><div class="mock-stat-lbl">Needs resolution</div></div>
        <div class="mock-stat"><div class="mock-stat-num">228</div><div class="mock-stat-lbl">Confirmed today</div></div>
      </div>

      <div class="mock-section">
        <div class="mock-section-title">Pending</div>
        <table class="mock-table queue">
          <thead><tr><th>Source</th><th>Excerpt</th><th>Suggested operator</th><th>KSA</th><th>Conf.</th><th></th></tr></thead>
          <tr><td><code>hot_wash_d3.docx</code></td><td>"On itadmins3, they disabled windows event logging and changed audit policies"</td><td>RAPTOR12 (0.71)</td><td>S0089</td><td>0.78</td><td><span class="mock-action">confirm · edit · reject</span></td></tr>
          <tr><td><code>nessus_d2.csv</code></td><td>"Discovered open port 25/tcp on 10.10.1.125"</td><td><em>none</em></td><td>K0334</td><td>0.66</td><td><span class="mock-action">resolve · skip</span></td></tr>
          <tr><td><code>scorecard_d3.xlsx</code></td><td>"Failed to alert on certipy-generated golden ticket within SLA"</td><td>GHOST06 (0.94)</td><td>S0167</td><td>0.81</td><td><span class="mock-action">confirm · edit · reject</span></td></tr>
          <tr><td><code>dub_d2.pptx</code></td><td>"Successfully isolated 10.10.1.80 within 18 minutes of detection"</td><td>VIPER03 (0.88)</td><td>S0258</td><td>0.72</td><td><span class="mock-action">confirm · edit · reject</span></td></tr>
        </table>
      </div>

      <div class="mock-foot">Surfaces from: OBSERVATION, EXERCISE_ARTIFACT, OPERATOR · drives the validation_status flip that propagates to KSA_GAP</div>
    </div>
  `,

  unit_recurring_deficiencies: `
    <div class="mock">
      <div class="mock-header">
        <div class="mock-title">1st Cyber BDE - Recurring Deficiencies</div>
        <div class="mock-sub">LTC Carter, J. (commander) · 32 operators across 3 work roles</div>
      </div>

      <div class="mock-stat-row">
        <div class="mock-stat"><div class="mock-stat-num">19</div><div class="mock-stat-lbl">Recurring KSAs</div></div>
        <div class="mock-stat"><div class="mock-stat-num">14</div><div class="mock-stat-lbl">Operators affected</div></div>
        <div class="mock-stat"><div class="mock-stat-num">4</div><div class="mock-stat-lbl">Exercise cycles</div></div>
      </div>

      <div class="mock-section">
        <div class="mock-section-title">Top recurring KSAs (by total cycle_count across the unit)</div>
        <div class="mock-bars">
          <div class="mock-bar-row"><div class="mock-bar-lbl"><code>S0089</code> Lateral movement detection</div><div class="mock-bar"><div class="mock-bar-fill" style="width:92%"></div></div><div class="mock-bar-num">11 ops</div></div>
          <div class="mock-bar-row"><div class="mock-bar-lbl"><code>S0167</code> Suricata signature writing</div><div class="mock-bar"><div class="mock-bar-fill" style="width:75%"></div></div><div class="mock-bar-num">9 ops</div></div>
          <div class="mock-bar-row"><div class="mock-bar-lbl"><code>K0334</code> Network traffic analysis</div><div class="mock-bar"><div class="mock-bar-fill" style="width:58%"></div></div><div class="mock-bar-num">7 ops</div></div>
          <div class="mock-bar-row"><div class="mock-bar-lbl"><code>S0258</code> Event correlation</div><div class="mock-bar"><div class="mock-bar-fill" style="width:50%"></div></div><div class="mock-bar-num">6 ops</div></div>
          <div class="mock-bar-row"><div class="mock-bar-lbl"><code>K0177</code> Cyber kill chain</div><div class="mock-bar"><div class="mock-bar-fill" style="width:33%"></div></div><div class="mock-bar-num">4 ops</div></div>
        </div>
      </div>

      <div class="mock-section">
        <div class="mock-section-title">Operators with ≥3 recurring KSAs</div>
        <ul class="mock-feed">
          <li><strong>GHOST06</strong> · CPL Smith · 5 recurring · last seen EXERCISE-DEMO (Jun 2025)</li>
          <li><strong>RAPTOR12</strong> · SGT Wong · 4 recurring · last seen EXERCISE-DEMO (Jun 2025)</li>
          <li><strong>VIPER03</strong> · SGT Patel · 3 recurring · last seen EXERCISE-DEMO (Jun 2025)</li>
          <li><strong>HAVOC09</strong> · CPL Nguyen · 3 recurring · last seen EXERCISE-DEMO-Q1 (Mar 2025)</li>
        </ul>
      </div>

      <div class="mock-foot">Surfaces from: UNIT, OPERATOR, KSA_GAP (filtered to is_recurring=true), KSA · longitudinal commander view</div>
    </div>
  `,

  remediation_plan: `
    <div class="mock">
      <div class="mock-header">
        <div class="mock-title">My Remediation Plan - GHOST06</div>
        <div class="mock-sub">Scoped to Cyber Defense Analyst (CS-511) · 8 active items · 2 in progress · 1 completed this cycle</div>
      </div>

      <div class="mock-section">
        <div class="mock-section-title">Active items (priority order)</div>
        <div class="mock-card-grid">
          <div class="mock-card"><div class="mock-card-rank">#1</div><div class="mock-card-ksa"><code>S0089</code> Lateral movement detection · severity 0.82 · recurring × 3</div><div>Demonstrate ability to detect lateral movement on internal /24 subnets using passive traffic analysis during the next Cyber Defense Analyst exercise window.</div><div class="mock-card-foot"><span>SANS SEC504</span><span class="mock-status active">active</span></div></div>
          <div class="mock-card"><div class="mock-card-rank">#2</div><div class="mock-card-ksa"><code>S0167</code> Suricata signature writing · severity 0.74</div><div>Demonstrate ability to write a Suricata rule that detects Sliver C2 beacon traffic during the next Cyber Defense Analyst exercise window.</div><div class="mock-card-foot"><span>SANS SEC503</span><span class="mock-status progress">in_progress</span></div></div>
          <div class="mock-card"><div class="mock-card-rank">#3</div><div class="mock-card-ksa"><code>S0258</code> Event correlation · severity 0.51</div><div>Detect and report at least one Kerberos ticket abuse attempt (Rubeus or Certipy) within 30 minutes of inject during the next exercise.</div><div class="mock-card-foot"><span>no course mapped</span><span class="mock-status active">active</span></div></div>
          <div class="mock-card"><div class="mock-card-rank">#4</div><div class="mock-card-ksa"><code>K0334</code> Network traffic analysis · severity 0.58</div><div>Identify and triage three distinct anomalous traffic patterns on east-west traffic during the next exercise.</div><div class="mock-card-foot"><span>Pluralsight "Advanced Network Detection"</span><span class="mock-status progress">in_progress</span></div></div>
        </div>
      </div>

      <div class="mock-section">
        <div class="mock-section-title">Completed this cycle</div>
        <div class="mock-card-grid">
          <div class="mock-card complete"><div class="mock-card-ksa"><code>K0177</code> Cyber kill chain</div><div>Complete refresher on Lockheed Martin cyber kill chain phases.</div><div class="mock-card-foot"><span>NICCS NICCS-001</span><span class="mock-status done">completed</span></div></div>
        </div>
      </div>

      <div class="mock-foot">Surfaces from: OPERATOR, REMEDIATION_ITEM (filtered by operator + scoped_work_role), TRAINING_RESOURCE, KSA</div>
    </div>
  `,

  cpt_exeval_summary: `
    <div class="mock">
      <div class="mock-header">
        <div class="mock-title">CPT-A - EXERCISE-DEMO EXEVAL Summary</div>
        <div class="mock-sub">CPT-A · Cyber Protection Team · LTC Carter, J. (cdr) · Assessed by 666th CPB OC/T Team · 7-12 Jun 2025</div>
      </div>

      <div class="mock-stat-row">
        <div class="mock-stat"><div class="mock-stat-num">8</div><div class="mock-stat-lbl">METLs assessed</div></div>
        <div class="mock-stat"><div class="mock-stat-num">3</div><div class="mock-stat-lbl">Trained</div></div>
        <div class="mock-stat"><div class="mock-stat-num">4</div><div class="mock-stat-lbl">Practiced</div></div>
        <div class="mock-stat"><div class="mock-stat-num">1</div><div class="mock-stat-lbl">Untrained</div></div>
      </div>

      <div class="mock-section">
        <div class="mock-section-title">METL Ratings (this EXEVAL)</div>
        <table class="mock-table">
          <tr><td><code>CPT-MET-1</code></td><td>Conduct DCO-IDM</td><td><span class="mock-sev low">T</span></td><td>All MOPs met to standard.</td></tr>
          <tr><td><code>CPT-MET-2</code></td><td>Identify Adversary TTPs on Friendly Networks</td><td><span class="mock-sev med">P</span></td><td>Detection of Sliver C2 missed first-pass; identified on revisit.</td></tr>
          <tr><td><code>CPT-MET-3</code></td><td>Conduct Cyberspace Threat Hunting</td><td><span class="mock-sev high">U</span></td><td>Failed to detect lateral movement on /24 subnets within SLA. Recurring deficiency × 3 cycles.</td></tr>
          <tr><td><code>CPT-MET-4</code></td><td>Develop and Issue Cyber Defense Tasking</td><td><span class="mock-sev low">T</span></td><td>Tasking products met format and timeliness standards.</td></tr>
          <tr><td><code>CPT-MET-5</code></td><td>Coordinate with Network Owner / SOC</td><td><span class="mock-sev med">P</span></td><td>Daily Update Briefs delivered, coordination protocol slow on Day 2.</td></tr>
          <tr><td><code>CPT-MET-6</code></td><td>Document and Report Findings</td><td><span class="mock-sev low">T</span></td><td>AAR submitted within 72h of ENDEX.</td></tr>
          <tr><td><code>CPT-MET-7</code></td><td>Maintain Operational Readiness</td><td><span class="mock-sev med">P</span></td><td>Tool stack drift identified; corrected mid-exercise.</td></tr>
          <tr><td><code>CPT-MET-8</code></td><td>Sustain Cyber Workforce Proficiency</td><td><span class="mock-sev med">P</span></td><td>5 of 32 operators carrying recurring KSA gaps; remediation plans active.</td></tr>
        </table>
      </div>

      <div class="mock-section">
        <div class="mock-section-title">Trend (last 4 EXEVALs)</div>
        <div class="mock-bars">
          <div class="mock-bar-row"><div class="mock-bar-lbl">CPT-MET-3 Threat Hunting</div><div class="mock-bar"><div class="mock-bar-fill" style="width:25%;background:#8c1d1d"></div></div><div class="mock-bar-num">U U U U</div></div>
          <div class="mock-bar-row"><div class="mock-bar-lbl">CPT-MET-2 Adversary TTPs</div><div class="mock-bar"><div class="mock-bar-fill" style="width:55%;background:#6b4f00"></div></div><div class="mock-bar-num">U P P P</div></div>
          <div class="mock-bar-row"><div class="mock-bar-lbl">CPT-MET-1 DCO-IDM</div><div class="mock-bar"><div class="mock-bar-fill" style="width:90%;background:#1f5d20"></div></div><div class="mock-bar-num">P T T T</div></div>
        </div>
      </div>

      <div class="mock-section">
        <div class="mock-section-title">Drill-Down: Evidence behind CPT-MET-3 Untrained rating</div>
        <ul class="mock-feed">
          <li><span class="mock-sig def">DEFICIENCY</span> Failed to detect Sliver C2 beacon to c2.example.adversary during inject I12. <span class="mock-evi">- GHOST06, hot_wash Day 3</span></li>
          <li><span class="mock-sig def">DEFICIENCY</span> Did not flag certipy-generated Kerberos ticket within 30-min SLA. <span class="mock-evi">- RAPTOR12, evaluator_scorecard Day 3</span></li>
          <li><span class="mock-sig def">DEFICIENCY</span> Missed lateral movement on 10.10.4.0/24 (nbtscan). <span class="mock-evi">- VIPER03, hot_wash Day 3</span></li>
        </ul>
      </div>

      <div class="mock-foot">Surfaces from: UNIT (filtered to unit_type='CPT'), MET, UNIT_MET, EXEVAL_RESULT, EXERCISE, OBSERVATION (drill-down only)</div>
    </div>
  `,

  exercise_after_action: `
    <div class="mock">
      <div class="mock-header">
        <div class="mock-title">EXERCISE-DEMO - After Action Summary</div>
        <div class="mock-sub">7-12 Jun 2025 · adversary: APT29 (CALDERA) · host: 1st Cyber BDE · participating units: 3</div>
      </div>

      <div class="mock-stat-row">
        <div class="mock-stat"><div class="mock-stat-num">14</div><div class="mock-stat-lbl">Artifacts ingested</div></div>
        <div class="mock-stat"><div class="mock-stat-num">412</div><div class="mock-stat-lbl">Observations extracted</div></div>
        <div class="mock-stat"><div class="mock-stat-num">375</div><div class="mock-stat-lbl">Confirmed by mentor</div></div>
        <div class="mock-stat"><div class="mock-stat-num">68%</div><div class="mock-stat-lbl">MOP coverage</div></div>
      </div>

      <div class="mock-section">
        <div class="mock-section-title">Artifact breakdown</div>
        <table class="mock-table">
          <tr><td><code>aar</code></td><td>1 file</td><td>57 observations</td></tr>
          <tr><td><code>evaluator_scorecard</code></td><td>3 files</td><td>184 observations</td></tr>
          <tr><td><code>daily_update_brief</code></td><td>3 files</td><td>43 observations</td></tr>
          <tr><td><code>hot_wash</code></td><td>4 files</td><td>91 observations</td></tr>
          <tr><td><code>nessus_scan</code></td><td>2 files</td><td>12 observations</td></tr>
          <tr><td><code>msel_log</code></td><td>1 file</td><td>25 observations</td></tr>
        </table>
      </div>

      <div class="mock-section">
        <div class="mock-section-title">Top deficiencies (across all participating operators)</div>
        <div class="mock-bars">
          <div class="mock-bar-row"><div class="mock-bar-lbl"><code>S0089</code> Lateral movement detection</div><div class="mock-bar"><div class="mock-bar-fill" style="width:88%"></div></div><div class="mock-bar-num">23</div></div>
          <div class="mock-bar-row"><div class="mock-bar-lbl"><code>S0167</code> Suricata signature writing</div><div class="mock-bar"><div class="mock-bar-fill" style="width:67%"></div></div><div class="mock-bar-num">17</div></div>
          <div class="mock-bar-row"><div class="mock-bar-lbl"><code>K0334</code> Network traffic analysis</div><div class="mock-bar"><div class="mock-bar-fill" style="width:54%"></div></div><div class="mock-bar-num">14</div></div>
        </div>
      </div>

      <div class="mock-section">
        <div class="mock-section-title">MOP coverage gaps</div>
        <ul class="mock-feed">
          <li><code>MOP-3.2.1</code> "Detect lateral movement within 30 min" - 4 of 12 operators evaluated; 0 met standard</li>
          <li><code>MOP-4.1.3</code> "Centralize Windows event logging" - 8 of 12 evaluated; 5 met standard</li>
          <li><code>MOP-5.2.4</code> "Identify Kerberos ticket abuse" - 3 of 12 evaluated; 1 met standard</li>
        </ul>
      </div>

      <div class="mock-foot">Surfaces from: EXERCISE, EXERCISE_ARTIFACT, OBSERVATION, MOP · read-only consumption of the data-flow output</div>
    </div>
  `

};
