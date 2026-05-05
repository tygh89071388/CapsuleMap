# CapsuleMap Design Notes

[繁體中文版本](DESIGN-NOTES.zh-TW.md)

CapsuleMap starts with a narrow promise: make a repository easier for the next coding agent to pick up.

That promise is intentionally smaller than a full memory platform. The preview does not try to store every conversation, build a complete semantic index, or run a long-lived service. It writes a compact handoff pack into the repository and makes that pack easy to inspect.

## The Core Problem

Most coding-agent failures are not caused by a lack of context window alone. They often come from weak handoff:

- the agent does not know which files matter first
- local project decisions are hidden in old chats or scattered notes
- broad test runs replace focused test judgment
- generated summaries are too vague to guide edits
- persistent memory systems add power, but also add setup and trust cost

CapsuleMap treats handoff as a repo artifact. If the next agent needs it, a human reviewer should also be able to open it.

## What The Preview Ships

The preview focuses on file-level handoff:

- project capsule
- module index
- impact map
- test map
- architecture vocabulary
- local heuristic or optional Ollama task triage

This is enough to answer the first questions an agent should ask:

- What is this project?
- Which files should I read first?
- If I edit this file, what may be affected?
- Which tests are likely relevant?
- What words should I use when discussing architecture?

## Lessons Behind The Roadmap

CapsuleMap's roadmap is shaped by practical lessons from local-first agent systems.

### Search Needs Language Awareness

Plain keyword search can fail badly on CJK text when segmentation treats long phrases as one search term. Future search adapters should be explicit about segmentation, substring behavior, and short-query fallback.

For example:

- CJK-friendly indexing should be measured, not assumed
- very short queries may need vector fallback or alternate matching
- search quality should be tested with real multilingual queries

### Embeddings Need Operational Discipline

Embedding models are not interchangeable drop-in parts. Changing a model can change vector dimensions, ranking behavior, storage size, and rebuild cost.

Future CapsuleMap search features should document:

- which embedding model is used
- how documents and queries are formatted
- when indexes must be rebuilt
- how to verify search quality after a model change

### Hybrid Retrieval Often Beats One Ranking Method

Keyword search, vector search, and model-based reranking each fail in different ways. A robust local system should prefer measurable ranking behavior over expensive model calls that look smart but add latency.

Future work may explore:

- keyword + vector fusion
- deterministic score fusion
- optional reranking only when it proves useful
- benchmark fixtures for multilingual repositories

### Relationship Graphs Answer Different Questions

A search index finds documents. A relationship graph explains connections.

For coding agents, this distinction matters:

- search helps find likely relevant files or notes
- impact maps show file-level change risk
- relationship graphs can explain why one decision, module, or test affects another

CapsuleMap starts with file-level impact maps because they are simple, reviewable, and useful immediately. A future graph adapter should remain inspectable and should not require a hosted backend.

### Attention Budget Is A Product Feature

More context is not always better. Agents can become worse when every task injects too much unrelated memory.

CapsuleMap should keep favoring:

- small first-read lists
- per-task required docs
- deduped recommendations
- clear separation between hints and authority

## Why Not Build Everything Now

The preview deliberately avoids a full memory database, symbol graph, MCP server, and cloud backend.

That is a product choice. The first version should prove that a repo-local handoff pack is useful before adding heavier infrastructure.

Future integrations should follow the same rule: if a feature cannot explain what to read, what may break, or what to test, it does not belong in the core handoff path yet.

## Privacy And Reviewability

CapsuleMap is designed so generated handoff files can be committed, reviewed, and shared.

Public repositories should avoid placing credentials, machine-local paths, private service names, personal identifiers, or chat-platform runtime details inside generated docs.

Before publishing, run:

```bash
npm run check
npm test
```

Then run your normal credential and private-context scans before committing.
