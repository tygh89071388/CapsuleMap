# Search, Graph, and Attention Roadmap

CapsuleMap is not just a file summarizer. It is the public, repo-native slice of a larger agent-handoff workflow shaped by three hard-won lessons:

1. Search finds likely context.
2. Graphs explain why context is connected.
3. Attention gates decide what the agent should actually read now.

The 0.1 release starts with a file-level handoff pack because it is useful immediately, easy to inspect, and safe to commit. This roadmap explains how local search, relationship graphs, and attention control can plug into that foundation without turning CapsuleMap into an opaque memory database.

## Why This Matters

Coding agents fail in boring ways before they fail in clever ways:

- They reread broad files because they do not know where to start.
- They miss project decisions because those decisions live in chat history, notes, or old reviews.
- They run either too many tests or the wrong tests.
- They receive too much memory and become slower or less precise.
- They search poorly across Chinese, English, file paths, commands, and error strings.

CapsuleMap solves the first layer today by generating a handoff map inside the repo. The next layers should bring local search and relationship reasoning into the same reviewable workflow.

## Layer 1: Repo-Native Handoff Pack

This is what CapsuleMap ships today.

- `PROJECT-CAPSULE.md` orients the next agent before it scans the whole repo.
- `MODULE-INDEX.md` groups files by role.
- `IMPACT-MAP.json` records imports, reverse imports, likely tests, and file-level risk.
- `TEST-MAP.json` links source files and tests.
- `ARCHITECTURE-LANGUAGE.md` keeps handoff and review vocabulary stable.
- `SEARCH-GRAPH-ROADMAP.md` documents how search, graph, and attention layers should be added.

This layer is intentionally file-level. It is not trying to replace an IDE index, type checker, symbol graph, or full RAG system.

## Layer 2: QMD-Style Local Search

Search should answer:

> Which documents, notes, files, or handoff artifacts are probably relevant to this task?

A practical local setup that informed CapsuleMap uses a QMD-style markdown search flow:

- **Keyword index**: SQLite FTS5 with trigram tokenization for CJK-friendly substring search.
- **Vector index**: embeddings for semantic matches across wording and language.
- **Embedding model**: `multilingual-e5-large-instruct` performed better than smaller multilingual experiments when recall and score separation mattered.
- **Query mode**: hybrid keyword + vector retrieval.
- **Fusion**: deterministic RRF-style score fusion.
- **Reranking**: optional, measured, and not always-on.
- **Short CJK fallback**: very short Chinese queries need vector or alternate matching because trigram matching naturally starts at 3 characters.

The important part is not that every team must use QMD. The important part is that local search needs an explicit, measurable configuration. Model names, vector dimensions, tokenizer choices, query formatting, rebuild rules, and benchmark fixtures are product behavior, not hidden plumbing.

### Search Adapter Contract

A future CapsuleMap search adapter should be able to return compact candidates like:

```json
{
  "query": "resume payment refactor and run focused tests",
  "hits": [
    {
      "path": "docs/ai/PROJECT-CAPSULE.md",
      "reason": "handoff overview",
      "score": 0.91
    },
    {
      "path": "docs/decisions/payment-tests.md",
      "reason": "test selection policy",
      "score": 0.78
    }
  ]
}
```

Search should explain where to look. It should not decide truth by itself.

## Layer 3: Relationship Graphs

Graphs should answer:

> Why are these files, decisions, tests, or lessons connected?

Search retrieves candidates. A relationship graph explains connections between candidates.

Useful relation types include:

- `imports` / `imported_by`
- `tested_by`
- `owns_contract`
- `depends_on_decision`
- `learned_from`
- `risk_affects`
- `supersedes`
- `related_to`

For example, a source file might connect to a nearby test through imports, to an architecture decision through a module contract, and to an old lesson through a previously fixed failure.

### Graph Adapter Contract

A future graph adapter should return short, inspectable facts:

```json
{
  "subject": "src/payment-router.ts",
  "facts": [
    {
      "relation": "tested_by",
      "target": "tests/payment-router.test.ts",
      "reason": "direct import from test"
    },
    {
      "relation": "depends_on_decision",
      "target": "docs/decisions/payment-contract.md",
      "reason": "same module contract"
    }
  ]
}
```

Graph output should stay small. The goal is to explain relationships, not dump the whole database into the agent.

## Layer 4: Attention Gate

The hard problem is not finding more context. It is deciding what not to inject.

A useful attention gate should follow a strict order:

1. Start with `PROJECT-CAPSULE.md` and `MODULE-INDEX.md`.
2. Add `IMPACT-MAP.json` and `TEST-MAP.json` only for files likely to be edited.
3. Add search hits only when the capsule is missing, stale, or too thin.
4. Add graph facts only when the task involves relationships, causes, architecture, ownership, risk, or test strategy.
5. Deduplicate repeated documents.
6. Cap results aggressively.
7. Keep raw history out of the default path.

This is how a tool saves tokens without starving the agent. The agent gets the highest-value context first, then expands only when the task justifies it.

### Attention Gate Contract

A future attention gate can select a compact bundle:

```json
{
  "requiredReads": [
    "docs/ai/PROJECT-CAPSULE.md",
    "docs/ai/MODULE-INDEX.md",
    "docs/ai/IMPACT-MAP.json"
  ],
  "optionalReads": [
    "docs/decisions/payment-contract.md"
  ],
  "graphFacts": [
    "src/payment-router.ts is tested by tests/payment-router.test.ts"
  ],
  "skipped": [
    "raw chat history",
    "duplicate search hit"
  ]
}
```

The bundle should be reviewable by humans. If a human cannot tell why the agent received a piece of context, the system is too opaque.

## How This Fits CapsuleMap

CapsuleMap 0.1 already has the stable base:

```text
repo files
  -> capsulemap init
  -> docs/ai/*
  -> agent reads the handoff pack
  -> agent checks impact/test maps before editing
```

Future adapters can extend the flow:

```text
task
  -> handoff pack
  -> search adapter
  -> graph adapter
  -> attention gate
  -> compact read plan
  -> agent verifies against source code
```

The handoff pack remains the center. Search and graph layers are support systems, not replacements for source code verification.

## What We Are Not Shipping Yet

CapsuleMap does not currently include:

- bundled QMD integration
- a built-in vector index
- a built-in graph database
- symbol-level call graphs
- automatic git hooks
- MCP server
- cloud memory backend

Those are deliberately separate. The public contract should stay small enough to trust.

## Design Principle

Do not give agents "more memory" by default. Give them a map, then a measured way to ask for more.

That is the difference between a context dump and a handoff system.
