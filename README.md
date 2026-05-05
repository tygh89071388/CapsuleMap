# CapsuleMap

Repo-native handoff maps for coding agents.

[繁體中文說明](README.zh-TW.md)

CapsuleMap turns a repository into a small set of files that a coding agent can read before it edits code:

- `docs/ai/PROJECT-CAPSULE.md` — current project summary, entrypoints, hot spots, and first-read guidance.
- `docs/ai/MODULE-INDEX.md` — file-level module map grouped by role.
- `docs/ai/IMPACT-MAP.json` — imports, reverse imports, nearby tests, and risk rank per file.
- `docs/ai/TEST-MAP.json` — source-to-test and test-to-source map.
- `docs/ai/ARCHITECTURE-LANGUAGE.md` — shared vocabulary for handoff and review.

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
- **Designed from real handoff problems**: the roadmap is shaped by lessons from CJK search, hybrid retrieval, graph-based memory, and noisy context injection.

## Quick Start

Clone the repository and run the CLI with Node.js 20 or newer:

```bash
git clone https://github.com/tygh89071388/CapsuleMap.git
cd CapsuleMap
npm test
node bin/capsulemap.mjs init .
```

This writes the handoff pack to `docs/ai/`.

## Use It On Your Own Repository

CapsuleMap is not published to npm yet. For now, use it directly from the cloned repo.

From the CapsuleMap checkout:

```bash
git clone https://github.com/tygh89071388/CapsuleMap.git
cd CapsuleMap
npm test
```

Then run the CLI against any repository:

```bash
node /path/to/CapsuleMap/bin/capsulemap.mjs init /path/to/your/repo
node /path/to/CapsuleMap/bin/capsulemap.mjs check src/index.ts /path/to/your/repo
node /path/to/CapsuleMap/bin/capsulemap.mjs prompt /path/to/your/repo
```

If you prefer a global command during local development:

```bash
cd /path/to/CapsuleMap
npm link

cd /path/to/your/repo
capsulemap init .
capsulemap check src/index.ts .
capsulemap prompt .
```

Commit the generated `docs/ai/*` files when you want the handoff pack to travel with the repository. Keep them uncommitted if you only want a local agent briefing.

Typical agent workflow:

```text
1. Run capsulemap init .
2. Ask the coding agent to read docs/ai/PROJECT-CAPSULE.md first.
3. Before editing a file, run capsulemap check <file> .
4. Use docs/ai/TEST-MAP.json to choose focused tests.
5. Update docs/ai/* again after major architecture or module changes.
```

Then ask CapsuleMap what to read before editing a file:

```bash
node bin/capsulemap.mjs check src/project-scan.mjs .
```

Render a handoff prompt for a coding agent:

```bash
node bin/capsulemap.mjs prompt .
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
CAPSULEMAP_LOCAL_JUDGE=ollama CAPSULEMAP_OLLAMA_MODEL=gemma4:e2b node bin/capsulemap.mjs judge "continue the refactor"
```

Without those variables, CapsuleMap uses local heuristics only.

## Commands

```bash
# Build docs/ai for the current repo
node bin/capsulemap.mjs init .

# Print a scan summary
node bin/capsulemap.mjs scan .

# JSON scan output
node bin/capsulemap.mjs scan . --json

# Ask what a changed file may affect
node bin/capsulemap.mjs check src/index.ts .

# Render a handoff prompt for an agent
node bin/capsulemap.mjs prompt .

# Triage a task with the local judge
node bin/capsulemap.mjs judge "fix the dispatch tests"
```

## What It Generates

`docs/ai/PROJECT-CAPSULE.md` tells the next agent what the project is and which files to read first.

`docs/ai/MODULE-INDEX.md` groups indexed files by role so an agent can orient quickly.

`docs/ai/IMPACT-MAP.json` records imports, reverse imports, related tests, and file-level risk.

`docs/ai/TEST-MAP.json` links source files and nearby tests.

`docs/ai/ARCHITECTURE-LANGUAGE.md` keeps shared naming stable during handoff and review.

## Design Notes

Read [Design Notes](docs/DESIGN-NOTES.md) for the design lessons behind CapsuleMap, including why the preview starts with a file-level handoff pack and how search, embeddings, relationship graphs, and attention budgets may fit into future versions.

## Architecture

```text
bin/capsulemap.mjs
  -> src/project-scan.mjs  scan files, imports, reverse imports, tests
  -> src/writer.mjs        write docs/ai and render prompts
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
- local heuristic judge
- optional Ollama judge

Not included yet:

- MCP server
- symbol-level call graph
- automatic git hooks
- cloud memory backend

## Development

```bash
npm run check
npm test
```

No external runtime dependencies are required for the preview.
