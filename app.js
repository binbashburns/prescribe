// PRESCRIBE Architecture Explorer - main app.
//
// Renders the ontology as a Mermaid `flowchart` laid out by ELK (orthogonal
// edge routing + crossing minimization) - Mermaid's built-in `erDiagram`
// uses dagre, which can't avoid the line tangle on a graph this dense.
//
// erd-source.js stays in ER syntax: it's the single source of truth for
// properties (parsed for the side panel) and for relationships (parsed for
// the relationship index). At render time we *also* convert it to a
// flowchart string for ELK to lay out. Adding an entity is still a
// one-file edit in erd-source.js + entities.js.

import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11.14.0/dist/mermaid.esm.min.mjs";
import elkLayouts from "https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@0.2.1/dist/mermaid-layout-elk.esm.min.mjs";

mermaid.registerLayoutLoaders(elkLayouts);

const dark = matchMedia("(prefers-color-scheme: dark)").matches;

mermaid.initialize({
 startOnLoad: false,
 theme: "base",
 securityLevel: "loose",
 layout: "elk",
 fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", system-ui, sans-serif',
 themeVariables: {
 darkMode: dark,
 fontSize: "13px",
 lineColor: dark ? "#9c9a92" : "#73726c",
 textColor: dark ? "#e8e6df" : "#1f1f1d",
 primaryColor: dark ? "#2a2a28" : "#ffffff",
 primaryBorderColor: dark ? "#444441" : "#cecbc1"
 },
 flowchart: {
 htmlLabels: true,
 nodeSpacing: 50,
 rankSpacing: 90,
 padding: 14,
 diagramPadding: 24
 },
 elk: {
 "elk.algorithm": "layered",
 "elk.spacing.nodeNode": 50,
 "elk.layered.spacing.nodeNodeBetweenLayers": 90,
 "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
 "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
 "elk.layered.mergeEdges": true,
 "elk.edgeRouting": "ORTHOGONAL"
 }
});

const layerLabels = {
 reference: "Reference",
 observed: "Observed",
 derived: "Derived",
 continuity: "Continuity",
 join: "Join table"
};

let panZoom = null;
let currentSelection = null;
let currentMode = "ontology"; // 'ontology' | 'data' | 'aip' | 'app'
let currentDocFile = null; // when set, side panel is showing a fetched .md doc
let relationshipIndex = {};

function getCss(name) {
 return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function layerColors() {
 return {
 reference: { fill: getCss("--layer-ref-bg"), stroke: getCss("--layer-ref") },
 observed: { fill: getCss("--layer-obs-bg"), stroke: getCss("--layer-obs") },
 derived: { fill: getCss("--layer-der-bg"), stroke: getCss("--layer-der") },
 continuity: { fill: getCss("--layer-cont-bg"), stroke: getCss("--layer-cont") },
 join: { fill: getCss("--layer-join-bg"), stroke: getCss("--layer-join") }
 };
}

// ---- Parse ER source once, reuse for both flowchart generation and side panel ----

const REL_REGEX = /^\s*([A-Z_]+)\s*(\|\|--o\{|\|\|--\|\{|\|\|--o\||\|\|--\|\||}o--o\{|}o--\|\{)\s*([A-Z_]+)\s*:\s*"([^"]*)"\s*$/;

function parseErSource() {
 const lines = window.PRESCRIBE.erdSource.split("\n");
 const entities = [];
 const edges = [];

 let current = null;
 const startRe = /^\s*([A-Z_]+)\s*\{\s*$/;
 const endRe = /^\s*\}\s*$/;

 for (const line of lines) {
 if (current) {
 if (endRe.test(line)) {
 entities.push(current);
 current = null;
 continue;
 }
 const trimmed = line.trim();
 if (!trimmed) continue;
 const parts = trimmed.split(/\s+/);
 if (parts.length >= 2) {
 current.props.push({
 type: parts[0],
 name: parts[1],
 key: parts[2] || ""
 });
 }
 continue;
 }
 const sm = line.match(startRe);
 if (sm) {
 current = { name: sm[1], props: [] };
 continue;
 }
 const rm = line.match(REL_REGEX);
 if (rm) {
 edges.push({ from: rm[1], to: rm[3], cardCode: rm[2], label: rm[4] });
 }
 }

 return { entities, edges };
}

function parseCardinality(card) {
 const map = {
 "||--o{": "1 to many (0..N)",
 "||--|{": "1 to many (1..N)",
 "||--o|": "1 to 0 or 1",
 "||--||": "1 to 1",
 "}o--o{": "many to many",
 "}o--|{": "many to many"
 };
 return map[card] || card;
}

// ---- Per-mode diagram source generators ----
//
// Each mode produces its own Mermaid flowchart so the diagram tells a story
// appropriate to the tab. Node ID conventions:
// - bare ENTITY_NAME → ontology object (existing click flow)
// - fn_<key> → AI Function (clicking opens its prompt)
// - pipe_<key> → batch pipelines (clicking opens spec)
// - view_<key> → App view (clicking renders mockup)
// attachNodeBehavior() routes by prefix.

function classDefBlock() {
 const colors = layerColors();
 const ink = getCss("--text") || "#1f1f1d";
 // Special-class fills are hardcoded light, so text color is hardcoded dark
 // (using ink would render white-on-light-yellow in dark mode).
 const specialInk = "#1f2937";
 return [
 ` classDef reference fill:${colors.reference.fill},stroke:${colors.reference.stroke},stroke-width:1.5px,color:${ink},rx:6,ry:6`,
 ` classDef observed fill:${colors.observed.fill},stroke:${colors.observed.stroke},stroke-width:1.5px,color:${ink},rx:6,ry:6`,
 ` classDef derived fill:${colors.derived.fill},stroke:${colors.derived.stroke},stroke-width:1.5px,color:${ink},rx:6,ry:6`,
 ` classDef continuity fill:${colors.continuity.fill},stroke:${colors.continuity.stroke},stroke-width:1.5px,color:${ink},rx:6,ry:6`,
 ` classDef join fill:${colors.join.fill},stroke:${colors.join.stroke},stroke-width:1.5px,stroke-dasharray:4 2,color:${ink},rx:6,ry:6`,
 ` classDef aipfn fill:#fff2c5,stroke:#b06a16,stroke-width:2px,color:${specialInk},font-weight:600,rx:12,ry:12`,
 ` classDef pipeline fill:#d4e7ff,stroke:#1d4d8c,stroke-width:2px,color:${specialInk},font-weight:600,rx:12,ry:12`,
 ` classDef view fill:#efe6f6,stroke:#7a3fa8,stroke-width:2px,color:${specialInk},font-weight:600,rx:6,ry:6`
 ];
}

function entityNodeLabel(name, layer, props, includePropsLimit) {
 const limit = typeof includePropsLimit === "number" ? includePropsLimit : 8;
 if (limit <= 0) return `<b>${name}</b>`;
 const propLines = props.slice(0, limit).map(p => {
 const safeName = p.name.replace(/"/g, "&quot;");
 return p.key ? `${safeName} <i>${p.key}</i>` : safeName;
 });
 if (props.length > limit) propLines.push(`<i>+${props.length - limit} more</i>`);
 return `<b>${name}</b>${propLines.length ? "<br/>" + propLines.join("<br/>") : ""}`;
}

function buildOntologyDiagram(parsed) {
 const out = ["flowchart LR"];
 for (const e of parsed.entities) {
 const meta = window.PRESCRIBE.entities[e.name];
 const layer = meta?.layer || "reference";
 out.push(` ${e.name}["${entityNodeLabel(e.name, layer, e.props, 8)}"]:::${layer}`);
 }
 out.push("");
 for (const edge of parsed.edges) {
 if (edge.label) out.push(` ${edge.from} -- "${edge.label}" --> ${edge.to}`);
 else out.push(` ${edge.from} --> ${edge.to}`);
 }
 out.push("");
 out.push(...classDefBlock());
 return out.join("\n");
}

function buildAipDiagram(parsed) {
 const out = ["flowchart LR"];
 const fns = window.PRESCRIBE.aipFunctions || {};
 const usedEntities = new Set();
 const propsByEntity = Object.fromEntries(parsed.entities.map(e => [e.name, e.props]));

 for (const [key, fn] of Object.entries(fns)) {
 fn.reads.forEach(o => usedEntities.add(o));
 fn.writes.forEach(o => usedEntities.add(o));
 }

 for (const name of usedEntities) {
 const meta = window.PRESCRIBE.entities[name];
 if (!meta) continue;
 const props = propsByEntity[name] || [];
 out.push(` ${name}["${entityNodeLabel(name, meta.layer, props, 0)}"]:::${meta.layer}`);
 }

 for (const [key, fn] of Object.entries(fns)) {
 out.push(` fn_${key}(["${escapeMermaidLabel(fn.title)}"]):::aipfn`);
 }

 out.push("");
 for (const [key, fn] of Object.entries(fns)) {
 fn.reads.forEach(o => out.push(` ${o} --> fn_${key}`));
 fn.writes.forEach(o => out.push(` fn_${key} --> ${o}`));
 }

 out.push("");
 out.push(...classDefBlock());
 return out.join("\n");
}

function buildDataDiagram(parsed) {
 const out = ["flowchart LR"];
 const pipes = window.PRESCRIBE.pipelines || {};
 const usedEntities = new Set();
 const propsByEntity = Object.fromEntries(parsed.entities.map(e => [e.name, e.props]));

 for (const p of Object.values(pipes)) {
 p.reads.forEach(o => usedEntities.add(o));
 p.writes.forEach(o => usedEntities.add(o));
 }

 for (const name of usedEntities) {
 const meta = window.PRESCRIBE.entities[name];
 if (!meta) continue;
 out.push(` ${name}["${entityNodeLabel(name, meta.layer, propsByEntity[name] || [], 0)}"]:::${meta.layer}`);
 }

 for (const [key, p] of Object.entries(pipes)) {
 out.push(` pipe_${key}(["${escapeMermaidLabel(p.title)}"]):::pipeline`);
 }

 out.push("");
 for (const [key, p] of Object.entries(pipes)) {
 p.reads.forEach(o => out.push(` ${o} --> pipe_${key}`));
 p.writes.forEach(o => out.push(` pipe_${key} --> ${o}`));
 // Pipeline-to-pipeline orchestration (e.g., extractors that write to staging
 // datasets feed unify_training_resources without directly touching ontology objects).
 // Use canonical `-. label .->` dashed-with-label syntax (Mermaid v11).
 (p.feedsInto || []).forEach(downstream => {
 if (pipes[downstream]) out.push(` pipe_${key} -. "staging" .-> pipe_${downstream}`);
 });
 }

 out.push("");
 out.push(...classDefBlock());
 return out.join("\n");
}

function buildAppDiagram() {
 const out = ["flowchart TB"];
 const views = window.PRESCRIBE.workshopViews || {};
 for (const [key, v] of Object.entries(views)) {
 out.push(` view_${key}["${escapeMermaidLabel(v.title)}"]:::view`);
 }
 out.push("");
 out.push(...classDefBlock());
 return out.join("\n");
}

function escapeMermaidLabel(s) {
 if (!s) return "";
 return String(s).replace(/"/g, "&quot;").replace(/\n/g, " ");
}

function buildDiagramSource(mode, parsed) {
 switch (mode) {
 case "aip": return buildAipDiagram(parsed);
 case "data": return buildDataDiagram(parsed);
 case "app": return buildAppDiagram();
 default: return buildOntologyDiagram(parsed);
 }
}

// ---- Render ----

async function render() {
 const erdContainer = document.getElementById("erd");
 const parsed = parseErSource();
 buildRelationshipIndex(parsed);

 if (panZoom) {
 try { panZoom.destroy(); } catch (e) { /* fine */ }
 panZoom = null;
 }

 // Application mode renders HTML cards directly, not a Mermaid graph.
 // App views aren't graph-connected; a flowchart is the wrong primitive.
 if (currentMode === "app") {
 renderAppCards(erdContainer);
 return;
 }

 const flowSource = buildDiagramSource(currentMode, parsed);

 let svg;
 try {
 ({ svg } = await mermaid.render("erd-svg-" + currentMode + "-" + Date.now(), flowSource));
 } catch (err) {
 const msg = err && err.message ? err.message : String(err);
 erdContainer.innerHTML = `<div style="padding:1rem;color:#a00;font-family:monospace;white-space:pre-wrap;font-size:11px;overflow:auto;height:100%">RENDER FAILED: ${msg}\n\n=== SOURCE ===\n${flowSource.replace(/&/g,"&amp;").replace(/</g,"&lt;")}</div>`;
 console.error("Mermaid render error:", err);
 return;
 }

 erdContainer.innerHTML = svg;

 const svgEl = erdContainer.querySelector("svg");
 if (!svgEl) return;

 svgEl.removeAttribute("style");
 svgEl.setAttribute("width", "100%");
 svgEl.setAttribute("height", "100%");

 attachNodeBehavior(svgEl);
 initPanZoom(svgEl);
 applyLayerFilterToDom();
}

function renderAppCards(container) {
 const views = window.PRESCRIBE.workshopViews || {};
 const cards = Object.entries(views).map(([key, v]) => {
 const surfacesText = (v.surfaces || []).map(s => `<code>${escapeHtml(s)}</code>`).join(" ");
 return `
 <li class="view-card" data-view-key="${escapeHtml(key)}" tabindex="0" role="button">
 <div class="view-card-title">${escapeHtml(v.title)}</div>
 <div class="view-card-audience">${escapeHtml(v.audience)}</div>
 <div class="view-card-purpose">${escapeHtml(v.purpose)}</div>
 <div class="view-card-surfaces">surfaces: ${surfacesText}</div>
 </li>
 `;
 }).join("");

 container.innerHTML = `
 <div class="view-grid-wrap">
 <div class="view-grid-header">
 <h2>App Views</h2>
 <p>Each card is a sample wireframe of a App view. Click any card to see a sample-data mockup of that view in the side pane.</p>
 </div>
 <ul class="view-grid">${cards}</ul>
 </div>
 `;

 container.querySelectorAll(".view-card[data-view-key]").forEach(el => {
 const key = el.getAttribute("data-view-key");
 const open = () => {
 const v = views[key];
 if (v) selectView(key);
 };
 el.addEventListener("click", open);
 el.addEventListener("keydown", (e) => {
 if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
 });
 });
}

function attachNodeBehavior(svgEl) {
 const entityNames = Object.keys(window.PRESCRIBE.entities);
 const sortedByLen = entityNames.slice().sort((a, b) => b.length - a.length);

 svgEl.querySelectorAll("g.node").forEach(node => {
 const id = node.id || "";
 // Mermaid v11 prefixes node ids with the render id we passed to mermaid.render(),
 // so the actual id looks like "<render-id>-flowchart-<NODE_KEY>-<n>". Match
 // "flowchart-...-N" anywhere in the id, not anchored.
 const m = id.match(/flowchart-(.+?)-\d+$/);
 const nodeKey = m ? m[1] : null;
 if (!nodeKey) return;

 node.style.cursor = "pointer";

 if (nodeKey.startsWith("fn_")) {
 const fnKey = nodeKey.slice(3);
 const fn = window.PRESCRIBE.aipFunctions?.[fnKey];
 if (!fn) return;
 addTooltip(node, `${fn.title}\n\n${fn.purpose}`);
 node.addEventListener("click", (e) => {
 e.stopPropagation();
 selectAipFunction(fnKey);
 });
 return;
 }

 if (nodeKey.startsWith("pipe_")) {
 const pipeKey = nodeKey.slice(5);
 const p = window.PRESCRIBE.pipelines?.[pipeKey];
 if (!p) return;
 addTooltip(node, `${p.title}\n\n${p.purpose}`);
 node.addEventListener("click", (e) => {
 e.stopPropagation();
 selectPipeline(pipeKey);
 });
 return;
 }

 if (nodeKey.startsWith("view_")) {
 const viewKey = nodeKey.slice(5);
 const v = window.PRESCRIBE.workshopViews?.[viewKey];
 if (!v) return;
 addTooltip(node, `${v.title} (${v.audience})\n\n${v.purpose}`);
 node.addEventListener("click", (e) => {
 e.stopPropagation();
 selectView(viewKey);
 });
 return;
 }

 // Entity node
 let entityName = entityNames.includes(nodeKey)
 ? nodeKey
 : sortedByLen.find(n => id.includes(n));
 if (!entityName) return;
 const meta = window.PRESCRIBE.entities[entityName];
 if (!meta) return;

 node.setAttribute("data-entity", entityName);
 node.setAttribute("data-layer", meta.layer);
 addTooltip(node, `${entityName} (${layerLabels[meta.layer]})\n\n${meta.description}`);
 node.addEventListener("click", (e) => {
 e.stopPropagation();
 selectEntity(entityName);
 });
 });
}

function addTooltip(node, text) {
 const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
 title.textContent = text;
 node.insertBefore(title, node.firstChild);
}

function initPanZoom(svgEl) {
 panZoom = svgPanZoom(svgEl, {
 zoomEnabled: true,
 controlIconsEnabled: false,
 fit: true,
 center: true,
 minZoom: 0.2,
 maxZoom: 6,
 zoomScaleSensitivity: 0.4
 });

 document.getElementById("zoom-in").addEventListener("click", () => panZoom.zoomIn());
 document.getElementById("zoom-out").addEventListener("click", () => panZoom.zoomOut());
 document.getElementById("zoom-reset").addEventListener("click", () => {
 panZoom.resize();
 panZoom.fit();
 panZoom.center();
 });

 window.addEventListener("resize", () => {
 if (panZoom) {
 panZoom.resize();
 panZoom.fit();
 panZoom.center();
 }
 });
}

// ---- Relationship index (drives the side panel's relationship list) ----

function buildRelationshipIndex(parsed) {
 relationshipIndex = {};
 for (const edge of parsed.edges) {
 const cardinality = parseCardinality(edge.cardCode);
 if (!relationshipIndex[edge.from]) relationshipIndex[edge.from] = [];
 if (!relationshipIndex[edge.to]) relationshipIndex[edge.to] = [];
 relationshipIndex[edge.from].push({ direction: "out", to: edge.to, cardinality, label: edge.label });
 relationshipIndex[edge.to].push({ direction: "in", from: edge.from, cardinality, label: edge.label });
 }
}

// ---- Detail panel ----

function selectEntity(name) {
 const meta = window.PRESCRIBE.entities[name];
 if (!meta) return;

 const svgEl = document.querySelector("#erd svg");
 if (svgEl) {
 svgEl.querySelectorAll("g.node").forEach(n => n.classList.remove("selected", "dimmed"));
 const targetNode = svgEl.querySelector(`g.node[data-entity="${name}"]`);
 if (targetNode) targetNode.classList.add("selected");
 }

 currentSelection = name;
 currentDocFile = null;
 dispatchPanel();
}

function setMode(mode) {
 currentMode = mode;
 currentSelection = null;
 currentDocFile = null;
 document.querySelectorAll(".zone-card[data-mode]").forEach(card => {
 const isActive = card.getAttribute("data-mode") === mode;
 card.classList.toggle("active", isActive);
 card.setAttribute("aria-selected", isActive ? "true" : "false");
 });
 // Drive the body mode class so CSS animations target only flow-shaped tabs.
 ["mode-ontology","mode-aip","mode-data","mode-app"].forEach(c => document.body.classList.remove(c));
 document.body.classList.add("mode-" + mode);
 render(); // re-render the diagram for the new mode
 dispatchPanel(); // and reset the side panel to the mode's empty state
}

function selectAipFunction(key) {
 const fn = window.PRESCRIBE.aipFunctions?.[key];
 if (!fn?.promptFile) return;
 currentSelection = null;
 showDoc(fn.promptFile);
}

function selectPipeline(key) {
 const p = window.PRESCRIBE.pipelines?.[key];
 if (!p?.specFile) return;
 currentSelection = null;
 showDoc(p.specFile);
}

function selectView(key) {
 const view = window.PRESCRIBE.workshopViews?.[key];
 if (!view) return;
 currentSelection = null;
 currentDocFile = null;
 renderViewMockup(key, view);
}

function renderViewMockup(key, view) {
 const html = window.PRESCRIBE.mockups?.[key];
 if (!html) {
 setPanel(`
 <div class="entity-detail">
 <button class="doc-back" data-action="mockup-back">← Back</button>
 <div class="entity-header"><h2>${escapeHtml(view.title)}</h2></div>
 <p class="description">No mockup defined yet for <code>${escapeHtml(key)}</code>. Add an entry to <code>mockups.js</code>.</p>
 </div>
 `);
 } else {
 setPanel(`
 <div class="mockup-wrap">
 <button class="doc-back" data-action="mockup-back">← Back</button>
 <div class="doc-meta">${escapeHtml(view.title)} · ${escapeHtml(view.audience)} · mockup with sample data</div>
 ${html}
 </div>
 `);
 }
 document.querySelector("[data-action='mockup-back']")?.addEventListener("click", () => {
 dispatchPanel();
 });
}

function showDoc(file) {
 currentDocFile = file;
 dispatchPanel();
}

function dispatchPanel() {
 if (currentDocFile) return renderDocView(currentDocFile);
 if (currentSelection) return renderObjectView(currentSelection);
 return renderModeEmpty(currentMode);
}

function renderObjectView(name) {
 const meta = window.PRESCRIBE.entities[name];
 if (!meta) return;
 switch (currentMode) {
 case "aip": return renderAipObjectPanel(name, meta);
 case "data": return renderDataObjectPanel(name, meta);
 case "app": return renderAppObjectPanel(name, meta);
 default: return renderOntologyPanel(name, meta);
 }
}

function renderModeEmpty(mode) {
 switch (mode) {
 case "aip": return renderAipEmpty();
 case "data": return renderDataEmpty();
 case "app": return renderAppEmpty();
 default: return renderOntologyEmpty();
 }
}

// ---- Ontology mode ----

function renderOntologyPanel(name, meta) {
 const properties = parsePropertiesFromSource(name);
 const rels = relationshipIndex[name] || [];

 const html = `
 <div class="entity-detail">
 <div class="entity-header">
 <h2>${escapeHtml(name)}</h2>
 <span class="layer-chip ${layerChipClass(meta.layer)}">${layerLabels[meta.layer] || meta.layer}</span>
 </div>

 <p class="description">${escapeHtml(meta.description)}</p>

 ${meta.designNote ? `
 <div class="design-note">
 <strong>Design note.</strong> ${escapeHtml(meta.designNote)}
 </div>
 ` : ""}

 <div class="section">
 <div class="section-title">Properties</div>
 ${renderPropertiesTable(properties)}
 </div>

 <div class="section">
 <div class="section-title">Relationships (${rels.length})</div>
 ${renderRelationships(rels)}
 </div>

 ${renderReferences(meta.references)}
 </div>
 `;
 setPanel(html);
 wireRelationshipClicks();
}

function renderReferences(refs) {
 if (!refs || !refs.length) return "";
 const items = refs.map(r => `
 <li>
 <a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.label)}</a>
 </li>
 `).join("");
 return `
 <div class="section">
 <div class="section-title">Public references (${refs.length})</div>
 <ul class="ref-list">${items}</ul>
 </div>
 `;
}

function renderOntologyEmpty() {
 setPanel(`
 <div class="empty-state">
 <h2>Click any entity</h2>
 <p>Tap an entity in the diagram to see its layer, properties, relationships, and design notes here.</p>
 <div class="quick-facts">
 <div class="fact">
 <div class="fact-label">Keystone object</div>
 <div class="fact-value">Observation</div>
 <div class="fact-note">Operator × KSA × Exercise, sourced from one ExerciseArtifact.</div>
 </div>
 <div class="fact">
 <div class="fact-label">Spine</div>
 <div class="fact-value">DCWF</div>
 <div class="fact-note">ATT&amp;CK dropped as structural spine; technique tags appear as string properties only.</div>
 </div>
 <div class="fact">
 <div class="fact-label">Audience</div>
 <div class="fact-value">17 / 170 / 25D</div>
 <div class="fact-note">Cyber operators whose readiness is measured through exercise performance.</div>
 </div>
 </div>
 </div>
 `);
}

// ---- AI Automate mode ----

function renderAipEmpty() {
 const fns = window.PRESCRIBE.aipFunctions || {};
 const items = Object.entries(fns).map(([key, fn]) => `
 <li class="auto-card" data-action="open-doc" data-file="${escapeHtml(fn.promptFile)}">
 <div class="auto-card-title">${escapeHtml(fn.title)}</div>
 <div class="auto-card-purpose">${escapeHtml(fn.purpose)}</div>
 <div class="auto-card-meta">
 <span>${escapeHtml(fn.modelTier || "")}</span>
 ${fn.invokedBy?.length ? `<span>· called by ${fn.invokedBy.map(escapeHtml).join(", ")}</span>` : ""}
 </div>
 </li>
 `).join("");

 setPanel(`
 <div class="mode-intro">
 <h2>AI Automate</h2>
 <p>PRESCRIBE's AI layer is two focused AI Function plus the batch pipelines that call them. Click a function to open its paste-ready prompt, or click an ontology object on the diagram to see which functions touch it.</p>
 </div>
 <div class="section">
 <div class="section-title">AI Function (${Object.keys(fns).length})</div>
 <ul class="auto-list">${items}</ul>
 </div>
 `);
 wireDocLinks();
}

function renderAipObjectPanel(name, meta) {
 const idx = window.PRESCRIBE.automationIndex?.aipByObject?.[name] || { reading: [], writing: [] };
 const pidx = window.PRESCRIBE.automationIndex?.pipelineByObject?.[name] || { reading: [], writing: [] };

 const writingFns = idx.writing;
 const readingFns = idx.reading;
 const writingPipes = pidx.writing;
 const readingPipes = pidx.reading;

 const noAip = !writingFns.length && !readingFns.length;

 setPanel(`
 <div class="entity-detail">
 <div class="entity-header">
 <h2>${escapeHtml(name)}</h2>
 <span class="layer-chip ${layerChipClass(meta.layer)}">${layerLabels[meta.layer] || meta.layer}</span>
 </div>
 <p class="description">${escapeHtml(meta.description)}</p>

 ${noAip ? `
 <div class="design-note">
 <strong>No AI automation.</strong> This object is not directly read or written by any AI Function.
 ${writingPipes.length ? `Populated by batch pipelines${writingPipes.length>1?"s":""}: ${writingPipes.map(p => `<code>${escapeHtml(p.title)}</code>`).join(", ")}.` : ""}
 ${!writingPipes.length ? `Populated manually, by reference data load, or via App Action.` : ""}
 </div>
 ` : ""}

 ${writingFns.length ? `
 <div class="section">
 <div class="section-title">Written by AI Function (${writingFns.length})</div>
 <ul class="auto-list">${writingFns.map(renderAutoFnCard).join("")}</ul>
 </div>
 ` : ""}

 ${readingFns.length ? `
 <div class="section">
 <div class="section-title">Read by AI Function (${readingFns.length})</div>
 <ul class="auto-list">${readingFns.map(renderAutoFnCard).join("")}</ul>
 </div>
 ` : ""}

 ${writingPipes.length || readingPipes.length ? `
 <div class="section">
 <div class="section-title">Pipeline touch (for context)</div>
 <ul class="auto-list muted">
 ${writingPipes.map(p => `<li class="auto-card" data-action="open-doc" data-file="${escapeHtml(p.specFile)}"><div class="auto-card-title">writes · ${escapeHtml(p.title)}</div></li>`).join("")}
 ${readingPipes.map(p => `<li class="auto-card" data-action="open-doc" data-file="${escapeHtml(p.specFile)}"><div class="auto-card-title">reads · ${escapeHtml(p.title)}</div></li>`).join("")}
 </ul>
 </div>
 ` : ""}
 </div>
 `);
 wireDocLinks();
}

function renderAutoFnCard(fn) {
 return `
 <li class="auto-card" data-action="open-doc" data-file="${escapeHtml(fn.promptFile || fn.specFile)}">
 <div class="auto-card-title">${escapeHtml(fn.title)}</div>
 <div class="auto-card-purpose">${escapeHtml(fn.purpose)}</div>
 </li>
 `;
}

// ---- Data processing mode ----

function renderDataEmpty() {
 const pipes = window.PRESCRIBE.pipelines || {};
 const items = Object.entries(pipes).map(([key, p]) => `
 <li class="auto-card" data-action="open-doc" data-file="${escapeHtml(p.specFile)}">
 <div class="auto-card-title">${escapeHtml(p.title)}</div>
 <div class="auto-card-purpose">${escapeHtml(p.purpose)}</div>
 <div class="auto-card-meta">
 ${p.callsAip?.length ? `<span>calls AI: ${p.callsAip.map(escapeHtml).join(", ")}</span>` : `<span>pure transform</span>`}
 </div>
 </li>
 `).join("");

 setPanel(`
 <div class="mode-intro">
 <h2>Data Processing</h2>
 <p>The batch pipelines that move data from S3 through the ontology. Click a pipeline to open its full spec, or click an ontology object to see which pipelines write or read it.</p>
 </div>
 <div class="section">
 <div class="section-title">Pipelines (${Object.keys(pipes).length})</div>
 <ul class="auto-list">${items}</ul>
 </div>
 `);
 wireDocLinks();
}

function renderDataObjectPanel(name, meta) {
 const pidx = window.PRESCRIBE.automationIndex?.pipelineByObject?.[name] || { reading: [], writing: [] };
 const writing = pidx.writing;
 const reading = pidx.reading;
 const noPipes = !writing.length && !reading.length;

 setPanel(`
 <div class="entity-detail">
 <div class="entity-header">
 <h2>${escapeHtml(name)}</h2>
 <span class="layer-chip ${layerChipClass(meta.layer)}">${layerLabels[meta.layer] || meta.layer}</span>
 </div>
 <p class="description">${escapeHtml(meta.description)}</p>

 ${noPipes ? `
 <div class="design-note">
 <strong>No pipeline writes this object.</strong> Likely populated by manual entry, reference data load, or App Action.
 </div>
 ` : ""}

 ${writing.length ? `
 <div class="section">
 <div class="section-title">Written by (${writing.length})</div>
 <ul class="auto-list">${writing.map(renderAutoFnCard).join("")}</ul>
 </div>
 ` : ""}

 ${reading.length ? `
 <div class="section">
 <div class="section-title">Read by (${reading.length})</div>
 <ul class="auto-list">${reading.map(renderAutoFnCard).join("")}</ul>
 </div>
 ` : ""}
 </div>
 `);
 wireDocLinks();
}

// ---- Application mode ----

function renderAppEmpty() {
 const views = window.PRESCRIBE.workshopViews || {};
 const items = Object.entries(views).map(([key, v]) => `
 <li class="auto-card">
 <div class="auto-card-title">${escapeHtml(v.title)}</div>
 <div class="auto-card-purpose">${escapeHtml(v.purpose)}</div>
 <div class="auto-card-meta"><span>${escapeHtml(v.audience)}</span></div>
 </li>
 `).join("");

 setPanel(`
 <div class="mode-intro">
 <h2>Application</h2>
 <p>Sketches of the App views that consume this ontology. Read-only stubs for now - no App config files yet. Click an ontology object on the diagram to see which views surface it.</p>
 </div>
 <div class="section">
 <div class="section-title">App views (${Object.keys(views).length})</div>
 <ul class="auto-list">${items}</ul>
 </div>
 `);
}

function renderAppObjectPanel(name, meta) {
 const vidx = window.PRESCRIBE.automationIndex?.viewsByObject?.[name] || { surfacing: [] };
 const surfacing = vidx.surfacing;

 setPanel(`
 <div class="entity-detail">
 <div class="entity-header">
 <h2>${escapeHtml(name)}</h2>
 <span class="layer-chip ${layerChipClass(meta.layer)}">${layerLabels[meta.layer] || meta.layer}</span>
 </div>
 <p class="description">${escapeHtml(meta.description)}</p>

 ${surfacing.length ? `
 <div class="section">
 <div class="section-title">Surfaced in App views (${surfacing.length})</div>
 <ul class="auto-list">${surfacing.map(v => `
 <li class="auto-card">
 <div class="auto-card-title">${escapeHtml(v.title)}</div>
 <div class="auto-card-purpose">${escapeHtml(v.purpose)}</div>
 <div class="auto-card-meta"><span>${escapeHtml(v.audience)}</span></div>
 </li>
 `).join("")}</ul>
 </div>
 ` : `
 <div class="design-note">
 <strong>Not surfaced in any App view yet.</strong> Add a view to <code>automations.js</code> when one is designed.
 </div>
 `}
 </div>
 `);
}

// ---- Doc viewer (renders prompt or spec markdown) ----

function docTypeMeta(file) {
 // Look up the corresponding aipFunctions or pipelines entry by file path,
 // and produce a "what is this and what do you do with it" header.
 const aip = window.PRESCRIBE.aipFunctions || {};
 const pipes = window.PRESCRIBE.pipelines || {};

 for (const [key, fn] of Object.entries(aip)) {
 if (fn.promptFile === file) {
 return {
 kind: "AI Function prompt",
 title: fn.title,
 modelTier: fn.modelTier || "Standard reasoning (Sonnet tier)",
 purpose: fn.purpose,
 howTo: [
 "Open the AI Function application and create a new function.",
 "Paste the entire markdown below into the function's system prompt.",
 `Configure the model tier to <strong>${escapeHtml(fn.modelTier || "Standard reasoning (Sonnet tier)")}</strong>.`,
 "Define the function's input schema to match the 'Inputs you will receive' section at the bottom of the prompt.",
 "Define the output schema to match the JSON schema near the top of the prompt.",
 "Call this function from the corresponding batch pipelines" +
 (fn.invokedBy && fn.invokedBy.length ? ` (<code>${fn.invokedBy.map(escapeHtml).join(", ")}</code>)` : " when ready."),
 ]
 };
 }
 }

 for (const [key, p] of Object.entries(pipes)) {
 if (p.specFile === file) {
 return {
 kind: "Batch pipeline spec",
 title: p.title,
 modelTier: null,
 purpose: p.purpose,
 howTo: [
 "In the platform's pipeline editor, create a new batch pipeline.",
 "Use the spec below to configure inputs (datasets and media buckets), transformation steps, AI Function calls, and outputs.",
 p.callsAip && p.callsAip.length
 ? `Wire in the following AI Function(s) when their step is reached: <code>${p.callsAip.map(escapeHtml).join(", ")}</code>.`
 : "No AI Function calls in this pipeline (pure transforms or model-free fetch/parse).",
 "Apply the data quality rules at the bottom of the spec as pipeline constraints; FAIL rules block the build, WARN rules log a warning.",
 "Set the schedule per the 'Schedule' section at the bottom of the spec."
 ]
 };
 }
 }

 return null;
}

async function renderDocView(file) {
 const meta = docTypeMeta(file);
 const headerHtml = meta ? `
 <div class="doc-howto">
 <div class="doc-howto-kind">${escapeHtml(meta.kind)}</div>
 <h2 class="doc-howto-title">${escapeHtml(meta.title)}</h2>
 <p class="doc-howto-purpose">${escapeHtml(meta.purpose)}</p>
 <div class="doc-howto-section-title">How to use this</div>
 <ol class="doc-howto-list">
 ${meta.howTo.map(s => `<li>${s}</li>`).join("")}
 </ol>
 </div>
 ` : "";

 setPanel(`
 <div class="doc-view">
 <button class="doc-back" data-action="doc-back">← Back</button>
 ${headerHtml}
 <div class="doc-meta">Source: <code>${escapeHtml(file)}</code></div>
 <pre class="doc-content">Loading…</pre>
 </div>
 `);

 document.querySelector("[data-action='doc-back']")?.addEventListener("click", () => {
 currentDocFile = null;
 dispatchPanel();
 });

 try {
 const res = await fetch(file, { cache: "no-cache" });
 if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
 const text = await res.text();
 document.querySelector(".doc-content").textContent = text;
 } catch (err) {
 document.querySelector(".doc-content").textContent = `Failed to load ${file}\n\n${err}`;
 }
}

// ---- Panel helpers ----

function setPanel(html) {
 document.getElementById("detail-panel").innerHTML = html;
}

function wireRelationshipClicks() {
 document.querySelectorAll("#detail-panel .rel-list li[data-target]").forEach(li => {
 li.addEventListener("click", () => {
 const target = li.getAttribute("data-target");
 selectEntity(target);
 });
 });
}

function wireDocLinks() {
 document.querySelectorAll("#detail-panel [data-action='open-doc']").forEach(el => {
 el.addEventListener("click", () => {
 const file = el.getAttribute("data-file");
 if (file) showDoc(file);
 });
 });
}

function parsePropertiesFromSource(entityName) {
 const source = window.PRESCRIBE.erdSource;
 const re = new RegExp(`\\b${entityName}\\s*\\{([^}]*)\\}`, "m");
 const m = source.match(re);
 if (!m) return [];
 const body = m[1];
 const props = [];
 body.split("\n").forEach(line => {
 const t = line.trim();
 if (!t) return;
 const parts = t.split(/\s+/);
 if (parts.length < 2) return;
 props.push({ type: parts[0], name: parts[1], key: parts[2] || "" });
 });
 return props;
}

function renderPropertiesTable(props) {
 if (!props.length) return `<p class="description">No properties defined.</p>`;
 const rows = props.map(p => `
 <tr>
 <td>${escapeHtml(p.type)}</td>
 <td>${escapeHtml(p.name)}</td>
 <td>${p.key ? `<span class="key-badge ${escapeHtml(p.key)}">${escapeHtml(p.key)}</span>` : ""}</td>
 </tr>
 `).join("");
 return `<table class="props-table">${rows}</table>`;
}

function renderRelationships(rels) {
 if (!rels.length) return `<p class="description">No declared relationships.</p>`;
 const items = rels.map(r => {
 const target = r.direction === "out" ? r.to : r.from;
 const arrow = r.direction === "out" ? "→" : "←";
 return `
 <li data-target="${escapeHtml(target)}">
 <div class="rel-card">${arrow} <span class="rel-target">${escapeHtml(target)}</span></div>
 <div class="rel-via">${escapeHtml(r.cardinality)}${r.label ? ` - ${escapeHtml(r.label)}` : ""}</div>
 </li>
 `;
 }).join("");
 return `<ul class="rel-list">${items}</ul>`;
}

function layerChipClass(layer) {
 const map = { reference: "ref", observed: "obs", derived: "der", continuity: "cont", join: "join" };
 return map[layer] || "";
}

function escapeHtml(s) {
 if (s == null) return "";
 return String(s)
 .replace(/&/g, "&amp;")
 .replace(/</g, "&lt;")
 .replace(/>/g, "&gt;")
 .replace(/"/g, "&quot;")
 .replace(/'/g, "&#39;");
}

document.addEventListener("click", (e) => {
 const node = e.target.closest("g.node");
 if (!node && !e.target.closest(".detail-pane")) {
 const svgEl = document.querySelector("#erd svg");
 if (svgEl) {
 svgEl.querySelectorAll("g.node.selected, g.node.dimmed").forEach(n => {
 n.classList.remove("selected", "dimmed");
 });
 }
 }
});

function wireTabClicks() {
 document.querySelectorAll(".zone-card[data-mode]").forEach(card => {
 card.addEventListener("click", () => {
 const mode = card.getAttribute("data-mode");
 if (mode && mode !== currentMode) setMode(mode);
 });
 });
}

function wireSplitter() {
 const splitter = document.getElementById("pane-splitter");
 if (!splitter) return;
 const root = document.documentElement;

 // Restore persisted width
 try {
 const saved = parseInt(localStorage.getItem("prescribe.detailPaneWidth") || "0", 10);
 if (saved >= 240 && saved <= 1200) root.style.setProperty("--detail-pane-width", saved + "px");
 } catch {}

 function clamp(px) {
 const max = Math.max(window.innerWidth - 320, 320); // leave at least 320px for diagram
 return Math.max(240, Math.min(max, px));
 }

 function setWidth(px) {
 const w = clamp(px);
 root.style.setProperty("--detail-pane-width", w + "px");
 try { localStorage.setItem("prescribe.detailPaneWidth", String(w)); } catch {}
 if (panZoom) {
 panZoom.resize();
 panZoom.fit();
 panZoom.center();
 }
 }

 function onMouseMove(e) {
 setWidth(window.innerWidth - e.clientX);
 }

 function onMouseUp() {
 document.body.classList.remove("splitter-dragging");
 splitter.classList.remove("dragging");
 window.removeEventListener("mousemove", onMouseMove);
 window.removeEventListener("mouseup", onMouseUp);
 }

 splitter.addEventListener("mousedown", (e) => {
 e.preventDefault();
 document.body.classList.add("splitter-dragging");
 splitter.classList.add("dragging");
 window.addEventListener("mousemove", onMouseMove);
 window.addEventListener("mouseup", onMouseUp);
 });

 // Keyboard support
 splitter.addEventListener("keydown", (e) => {
 const cur = parseInt(getComputedStyle(root).getPropertyValue("--detail-pane-width"), 10) || 360;
 if (e.key === "ArrowLeft") { e.preventDefault(); setWidth(cur + 32); }
 if (e.key === "ArrowRight") { e.preventDefault(); setWidth(cur - 32); }
 });

 // Double-click to reset
 splitter.addEventListener("dblclick", () => setWidth(360));
}

let activeLayerFilter = null; // 'reference' | 'observed' | 'derived' | 'continuity' | 'join' | null

function wireLayerFilters() {
  document.querySelectorAll(".layer-chip[data-layer-filter]").forEach(chip => {
    chip.addEventListener("click", () => {
      const layer = chip.getAttribute("data-layer-filter");
      if (layer === "all") {
        setLayerFilter(null);
      } else {
        setLayerFilter(activeLayerFilter === layer ? null : layer);
      }
    });
  });
}

function setLayerFilter(layer) {
  activeLayerFilter = layer;

  document.querySelectorAll(".layer-chip[data-layer-filter]").forEach(chip => {
    const chipLayer = chip.getAttribute("data-layer-filter");
    const isActive = chipLayer === "all" ? !layer : chipLayer === layer;
    chip.classList.toggle("layer-chip-active", isActive);
  });

  document.body.classList.toggle("layer-filter-on", !!layer);
  applyLayerFilterToDom();
}

function applyLayerFilterToDom() {
  // Tag every g.node with .layer-match if it matches the active layer.
  // For ontology nodes: data-layer attribute set by attachNodeBehavior.
  // For function/pipeline/view nodes: never match a layer filter (filter is
  // about ontology layers, not the AI/pipeline meta-layer).
  const svg = document.querySelector("#erd svg");
  if (!svg) return;
  svg.querySelectorAll("g.node").forEach(n => {
    const matches = activeLayerFilter && n.getAttribute("data-layer") === activeLayerFilter;
    n.classList.toggle("layer-match", !!matches);
  });
}

function wireSplash() {
 const splash = document.getElementById("splash");
 const enterBtn = document.getElementById("splash-enter");
 const remember = document.getElementById("splash-remember-me");
 if (!splash || !enterBtn) return;

 let dismissed = false;
 try {
 dismissed = localStorage.getItem("prescribe.splashDismissed") === "1";
 } catch {}

 if (!dismissed) {
 splash.hidden = false;
 }

 enterBtn.addEventListener("click", () => {
 if (remember && remember.checked) {
 try { localStorage.setItem("prescribe.splashDismissed", "1"); } catch {}
 }
 splash.hidden = true;
 if (panZoom) {
 panZoom.resize();
 panZoom.fit();
 panZoom.center();
 }
 });
}

function bootstrap() {
 // Set initial body mode class so CSS animations have a hook on first load.
 document.body.classList.add("mode-" + currentMode);
 wireSplash();
 wireTabClicks();
 wireSplitter();
 wireLayerFilters();
 render();
}

if (document.readyState === "loading") {
 document.addEventListener("DOMContentLoaded", bootstrap);
} else {
 bootstrap();
}
