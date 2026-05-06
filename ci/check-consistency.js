// Cross-check entities, relationships, automations, and mockups for consistency.
// Run by .github/workflows/ci.yml on every push and PR. Exits non-zero on any
// mismatch so CI fails before bad metadata reaches GitHub Pages.

const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
global.window = {};
eval(fs.readFileSync(path.join(repoRoot, "erd-source.js"), "utf8"));
eval(fs.readFileSync(path.join(repoRoot, "entities.js"), "utf8"));
eval(fs.readFileSync(path.join(repoRoot, "automations.js"), "utf8"));
eval(fs.readFileSync(path.join(repoRoot, "mockups.js"), "utf8"));

const meta = window.PRESCRIBE.entities || {};
const aip = window.PRESCRIBE.aipFunctions || {};
const pipes = window.PRESCRIBE.pipelines || {};
const views = window.PRESCRIBE.workshopViews || {};
const mockups = window.PRESCRIBE.mockups || {};

const issues = [];

// Parse erd-source.js for entity definitions and relationships
const src = window.PRESCRIBE.erdSource || "";
const entityRe = /^\s*([A-Z_]+)\s*\{/gm;
const relRe = /^\s*([A-Z_]+)\s*(\|\|--o\{|\|\|--\|\{|}o--o\{|}o--\|\{|\|\|--o\||\|\|--\|\|)\s*([A-Z_]+)/gm;
const defined = new Set();
let m;
while ((m = entityRe.exec(src))) defined.add(m[1]);
const inRels = new Set();
while ((m = relRe.exec(src))) {
  inRels.add(m[1]);
  inRels.add(m[3]);
}

for (const e of defined) {
  if (!meta[e]) issues.push(`erd-source.js entity ${e} has no metadata in entities.js`);
}
for (const e of Object.keys(meta)) {
  if (!defined.has(e)) issues.push(`entities.js entity ${e} has no erd-source.js definition`);
}
for (const e of inRels) {
  if (!defined.has(e)) issues.push(`relationship references undefined entity: ${e}`);
}

// Cross-check automations.js entity references
function check(label, items, fields) {
  for (const [key, item] of Object.entries(items)) {
    for (const f of fields) {
      (item[f] || []).forEach(o => {
        if (!meta[o]) issues.push(`${label}.${key}.${f}: unknown entity "${o}"`);
      });
    }
  }
}
check("aipFunctions", aip, ["reads", "writes"]);
check("pipelines", pipes, ["reads", "writes"]);
check("workshopViews", views, ["surfaces"]);

// Verify referenced prompt and spec files exist on disk
for (const [key, fn] of Object.entries(aip)) {
  if (fn.promptFile && !fs.existsSync(path.join(repoRoot, fn.promptFile))) {
    issues.push(`aipFunctions.${key}: promptFile ${fn.promptFile} does not exist`);
  }
}
for (const [key, p] of Object.entries(pipes)) {
  if (p.specFile && !fs.existsSync(path.join(repoRoot, p.specFile))) {
    issues.push(`pipelines.${key}: specFile ${p.specFile} does not exist`);
  }
}

// Every Workshop view registered in automations.js must have a mockup
for (const k of Object.keys(views)) {
  if (!mockups[k]) issues.push(`workshopViews.${k} has no mockup in mockups.js`);
}
for (const k of Object.keys(mockups)) {
  if (!views[k]) issues.push(`mockups.${k} has no corresponding workshopViews entry (orphan mockup)`);
}

// Pipeline-to-pipeline orchestration must resolve
for (const [k, p] of Object.entries(pipes)) {
  for (const dst of p.feedsInto || []) {
    if (!pipes[dst]) issues.push(`pipelines.${k}.feedsInto: unknown pipeline "${dst}"`);
  }
}

// AIP function invokedBy and pipeline callsAip must agree
for (const [fnKey, fn] of Object.entries(aip)) {
  for (const pipeKey of fn.invokedBy || []) {
    if (!pipes[pipeKey]) {
      issues.push(`aipFunctions.${fnKey}.invokedBy: unknown pipeline "${pipeKey}"`);
      continue;
    }
    if (!(pipes[pipeKey].callsAip || []).includes(fnKey)) {
      issues.push(`aipFunctions.${fnKey}.invokedBy lists ${pipeKey}, but pipelines.${pipeKey}.callsAip does not include ${fnKey}`);
    }
  }
}
for (const [pipeKey, p] of Object.entries(pipes)) {
  for (const fnKey of p.callsAip || []) {
    if (!aip[fnKey]) {
      issues.push(`pipelines.${pipeKey}.callsAip: unknown AIP function "${fnKey}"`);
    }
  }
}

if (issues.length) {
  console.error("Consistency check FAILED with " + issues.length + " issue(s):");
  for (const i of issues) console.error("  - " + i);
  process.exit(1);
}
console.log("Consistency check passed.");
console.log("  entities: " + Object.keys(meta).length);
console.log("  AI functions: " + Object.keys(aip).length);
console.log("  pipelines: " + Object.keys(pipes).length);
console.log("  workshop views: " + Object.keys(views).length);
console.log("  mockups: " + Object.keys(mockups).length);
