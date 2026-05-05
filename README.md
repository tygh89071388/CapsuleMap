# CapsuleMap

Repo-native handoff maps for coding agents.

[繁體中文說明](README.zh-TW.md)

CapsuleMap turns a repository into a small set of files that a coding agent can read before it edits code:

- `docs/ai/PROJECT-CAPSULE.md` — current project summary, entrypoints, hot spots, and first-read guidance.
- `docs/ai/MODULE-INDEX.md` — file-level module map grouped by role.
- `docs/ai/IMPACT-MAP.json` — imports, reverse imports, nearby tests, and risk rank per file.
- `docs/ai/TEST-MAP.json` — source-to-test and test-to-source map.
- `docs/ai/ARCHITECTURE-LANGUAGE.md` — shared vocabulary for handoff and review.
- `docs/ai/SEARCH-GRAPH-ROADMAP.md` — the local search, relationship graph, and attention-gate roadmap behind the handoff strategy.

The goal is not to be another generic memory database. CapsuleMap is a handoff pack: it gives the next coding agent a concise, inspectable map of what to read, what might break, and which tests are likely relevant.

## Why Agents Feel Faster

CapsuleMap is designed to reduce three expensive loops: orientation, blast-radius analysis, and test selection.

- **Spend less context budget**: agents read a capsule, module index, and impact map before pulling broad repo files into context.
- **Start with the right files**: the first-read list tells the next agent where to look before it edits.
- **Avoid random test selection**: the test map gives focused test hints before broad regression.
- **Make handoff reviewable**: generated docs live in the repo, so humans can inspect the same context agents use.
- **Keep benchmarks visible**: the local search setup behind the roadmap moved one hybrid query path from about 17s to about 4s, roughly 76% lower latency, with 5/5 top-1 results in a small validation set.

Those numbers are not a universal productivity claim. They are the kind of measurable bottleneck CapsuleMap is built to expose: fewer wasted reads, fewer missed impact paths, and less repeated orientation work.

## What Makes It Different

- **Repo-native by default**: the handoff pack lives in `docs/ai/`, so humans can review it and agents can read it without a hosted service.
- **Impact-aware**: CapsuleMap does not only summarize files. It also records reverse imports, likely tests, and file-level risk.
- **Agent attention budget**: the output is intentionally small. It tells an agent what to read first instead of asking it to reread the entire repo.
- **Local-first triage**: the judge can run with deterministic heuristics, or with an optional local model through Ollama.
- **Battle-tested origins**: the roadmap is distilled from a real agent workflow that uses QMD-style local markdown search, relationship graphs, and strict attention gates to keep context useful instead of noisy.

## Battle-Tested Origins

CapsuleMap is distilled from an agent workflow that uses local markdown search, relationship graphs, and attention gates in daily coding handoffs.

The public 0.1 release does not bundle that whole system. Instead, it exposes the part every repo can use immediately: a reviewable handoff pack plus a clear contract for future search and graph adapters.

Read [Search, Graph, and Attention Roadmap](docs/SEARCH-GRAPH-ROADMAP.md) for the concrete QMD-style search setup, CJK retrieval lessons, relationship graph contract, and attention-gate rules behind the roadmap.

## Quick Start

Run it in any repository with Node.js 20 or newer:

```bash
npm exec --yes --package capsulemap -- capsulemap init .
```

This writes the handoff pack to `docs/ai/`.

## Use It On Your Own Repository

One-off use without adding a dependency:

```bash
npm exec --yes --package capsulemap -- capsulemap init .
npm exec --yes --package capsulemap -- capsulemap check src/index.ts .
npm exec --yes --package capsulemap -- capsulemap prompt .
npm exec --yes --package capsulemap -- capsulemap roadmap .
```

Install it globally if you want a regular `capsulemap` command:

```bash
npm install -g capsulemap
capsulemap init .
capsulemap check src/index.ts .
capsulemap prompt .
capsulemap roadmap .
```

Install it as a dev dependency when you want every contributor or agent to use the same version:

```bash
npm install --save-dev capsulemap
npm exec capsulemap -- init .
npm exec capsulemap -- check src/index.ts .
npm exec capsulemap -- prompt .
npm exec capsulemap -- roadmap .
```

Commit the generated `docs/ai/*` files when you want the handoff pack to travel with the repository. Keep them uncommitted if you only want a local agent briefing.

Typical agent workflow:

```text
1. Run capsulemap init .
2. Ask the coding agent to read docs/ai/PROJECT-CAPSULE.md first.
3. Before editing a file, run capsulemap check <file> .
4. Use docs/ai/TEST-MAP.json to choose focused tests.
5. Read docs/ai/SEARCH-GRAPH-ROADMAP.md when the task involves search, memory, graph, retrieval, or context injection.
6. Update docs/ai/* again after major architecture or module changes.
```

Then ask CapsuleMap what to read before editing a file:

```bash
capsulemap check src/project-scan.mjs .
```

Render a handoff prompt for a coding agent:

```bash
capsulemap prompt .
```

Print the search / graph / attention roadmap without writing files:

```bash
capsulemap roadmap .
```

## Why This Exists

Coding agents often restart from scratch. They reread broad files, miss local project decisions, rerun too many tests, or skip tests that matter.

CapsuleMap keeps the useful handoff layer inside the repo:

```text
repo files
  -> CapsuleMap scan
  -> docs/ai/*
  -> agent reads capsule + module index
  -> agent checks impact/test map before editing
```

## Local Model Judge

CapsuleMap can use a local model as an optional privacy-first judge. The preview currently ships a deterministic fallback and an optional Ollama path.

The judge is meant for triage, not authority:

- classify whether a user task is a handoff, code change, architecture review, test request, or docs task
- recommend the minimal AI docs to read
- mark when a capsule is likely needed
- keep repository text local

Enable Ollama only when you want it:

```bash
CAPSULEMAP_LOCAL_JUDGE=ollama CAPSULEMAP_OLLAMA_MODEL=gemma4:e2b capsulemap judge "continue the refactor"
```

Without those variables, CapsuleMap uses local heuristics only.

## Commands

```bash
# Build docs/ai for the current repo
capsulemap init .

# Print a scan summary
capsulemap scan .

# JSON scan output
capsulemap scan . --json

# Ask what a changed file may affect
capsulemap check src/index.ts .

# Render a handoff prompt for an agent
capsulemap prompt .

# Print the search / graph / attention roadmap
capsulemap roadmap .

# Triage a task with the local judge
capsulemap judge "fix the dispatch tests"
```

## What It Generates

`docs/ai/PROJECT-CAPSULE.md` tells the next agent what the project is and which files to read first.

`docs/ai/MODULE-INDEX.md` groups indexed files by role so an agent can orient quickly.

`docs/ai/IMPACT-MAP.json` records imports, reverse imports, related tests, and file-level risk.

`docs/ai/TEST-MAP.json` links source files and nearby tests.

`docs/ai/ARCHITECTURE-LANGUAGE.md` keeps shared naming stable during handoff and review.

`docs/ai/SEARCH-GRAPH-ROADMAP.md` explains how local search, relationship graphs, and attention gates can plug into the handoff pack without turning it into an opaque memory service.

## Design Notes

Read [Design Notes](docs/DESIGN-NOTES.md) for the design lessons behind CapsuleMap, including why the preview starts with a file-level handoff pack and how search, embeddings, relationship graphs, and attention budgets may fit into future versions.

For the deeper search and graph direction, read [Search, Graph, and Attention Roadmap](docs/SEARCH-GRAPH-ROADMAP.md).

## Architecture

```text
bin/capsulemap.mjs
  -> src/project-scan.mjs  scan files, imports, reverse imports, tests
  -> src/writer.mjs        write docs/ai, render prompts, render roadmap
  -> src/local-judge.mjs   heuristic or optional Ollama triage
```

CapsuleMap is intentionally file-level in this preview. It does not try to replace a symbol graph, IDE index, or full RAG system.

## Current Scope

Implemented:

- JavaScript, TypeScript, and Python file discovery
- relative JS/TS import resolution
- simple Python import extraction
- file-level impact map
- test map
- handoff prompt rendering
- search / graph / attention roadmap rendering
- local heuristic judge
- optional Ollama judge

Not included yet:

- MCP server
- symbol-level call graph
- bundled QMD or vector search adapter
- built-in relationship graph database
- automatic git hooks
- cloud memory backend

## Development

```bash
npm run check
npm test
```

No external runtime dependencies are required for the preview.
