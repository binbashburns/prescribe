# PRESCRIBE Architecture Explorer

Interactive design tool for the PRESCRIBE graduate capstone. Four tabs cover the four architectural concerns: ontology objects (with their relationships and design notes), AI Function (with paste-ready prompts), batch pipelines (with paste-ready specs), and Application views (with sample-data mockups).

This is a design and prototyping tool. The actual capstone is built on the platform. All sample data shown is fictional.

## Run it

The app is fully static. Two options:

**Option A - local server (recommended)**

```bash
cd prescribe-erd
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

**Option B - open the file directly**

Double-click `index.html`. CDN scripts may fail on some browsers under `file://`; if rendering breaks, fall back to Option A.

## What's where

| File | Purpose |
| --- | --- |
| `index.html` | Page shell. Only edit if changing layout. |
| `styles.css` | All styles, including layer color coding. |
| `erd-source.js` | The mermaid `erDiagram` source string. Edit this to add entities or change relationships. |
| `entities.js` | Per-entity metadata: layer, description, design notes. Edit this to update tooltip and panel content. |
| `automations.js` | AI Function, batch pipelines, and App view metadata. Drives the AI, Data, and Application tabs. |
| `mockups.js` | Sample-data wireframes shown when a App view block is clicked. |
| `app.js` | Render, pan/zoom, click handling, mode switching. |
| `prompts/*.md` | Paste-ready AI Function prompts. |
| `pipelines/*.md` | Paste-ready batch pipelines specs. |

## Editing the model

`erd-source.js` and `entities.js` must stay in sync. Adding `THREAT_ACTOR` to one without the other shows nothing on click. The same applies to anything you add to `automations.js` or `mockups.js`.

## Stack

- [Mermaid 11](https://mermaid.js.org/) with the ELK layout loader for orthogonal edge routing
- [svg-pan-zoom](https://github.com/bumbu/svg-pan-zoom) for navigation
- No build step. No framework. Plain HTML/CSS/JS, ES modules from CDN.

## CI

`.github/workflows/ci.yml` runs on every push and PR to `main`:

- **Validate**: JS syntax checks + cross-checks that every entity referenced by automations/mockups exists in `entities.js`, every prompt/spec file referenced exists on disk, and pipeline orchestration links resolve.
- **Style Guard**: blocks em dashes from being committed (style preference; use hyphens).
- **SAST**: Semgrep `--config=auto` over the repo. Results uploaded as a build artifact.
- **Secret Scanning**: detect-secrets across all files. Results uploaded as an artifact.
- **SBOM**: Syft generates a CycloneDX SBOM. Uploaded as an artifact.
- **CVE Scan**: Grype reads the SBOM and reports vulnerabilities.
- **Pages Deploy**: on push to `main` only, the static site is deployed to GitHub Pages. The deploy job strips `context/`, `ci/`, `.github/`, and `CLAUDE.md` from the upload artifact so internal context never reaches the public site.

## Publishing

The repo deploys to GitHub Pages from `main` via the workflow above. To enable Pages on a fresh repo:

1. Push the repo to GitHub (public visibility).
2. Settings → Pages → Source: **GitHub Actions**.
3. Push to `main` (or trigger the workflow manually). The Pages job runs after Validate and Style Guard pass.
4. The site URL is shown in the workflow's deploy step output.
