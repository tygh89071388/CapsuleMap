# CapsuleMap MVP

## 狀態
- 階段：開發中
- 建立：2026-05-05
- 最後更新：2026-05-05

## 現狀掃描
- 已有相關系統：
  - 先前原型已驗證 Project Capsule、Module Index、Impact Map、Test Map 產物。
  - 先前工作流已驗證熱專案即時接手膠囊制度。
  - 先前記憶工具已驗證全文搜尋與關係查詢的分工。
- 可複用部分：
  - 既有 file-level codemap 思路。
  - 既有 `docs/ai/PROJECT-CAPSULE.md` 的 first-read 指引格式。
  - 既有 `IMPACT-MAP.json` / `TEST-MAP.json` 的 source/test 對映概念。
- GitHub / Web 相鄰方案：
  - ContextGraph：repo-local `.contextgraph/` durable working state。適用性：參考，定位接近但重點在 compaction/checkpoint。
  - MemoryGraph：graph-based MCP persistent memory。適用性：參考，不直接重做 memory DB。
  - SpecMem：Agent Experience、living docs、impact-aware context。適用性：強競品，CapsuleMap 要收斂成更輕的 handoff pack。
  - codemem：local-first memory for agent-heavy engineering work。適用性：參考，不直接取代。
  - Code Graph RAG MCP：code graph / semantic code analysis。適用性：互補，CapsuleMap MVP 先做 file-level handoff。
- 否決性提案命中：無明確否決。既有決策支持抽離 handoff/codemap 子系統。
- 結論：先做能跑的 CLI MVP，再決定公開流程。

## 需求
- 目標：做出 `CapsuleMap` MVP，把 repo 轉成 coding agent 可接手的 capsule + map。
- 原因：回饋開源社群前，先把 project capsule、code map、記憶搜尋分工抽成乾淨、可展示、無私密耦合的工具。
- 使用者：維護者與 coding agent 使用者。
- 成功標準：
  - 能在本機 repo 產生 `docs/ai/*` 五份交付物。
  - 能用 CLI 查改某檔案應看哪些測試。
  - README 清楚說明 CapsuleMap 的定位，不宣稱是通用 memory DB。
  - 不依賴 private runtime、credential 或機器專屬路徑。
  - 測試能用 Node 內建 test runner 跑通。

## 設計
- 架構概述：
  - `bin/capsulemap.mjs`：CLI 入口。
  - `src/project-scan.mjs`：掃描檔案、imports、reverse imports、nearby tests、risk rank。
  - `src/writer.mjs`：輸出 `docs/ai/*` 與 handoff prompt。
  - `src/local-judge.mjs`：本地模型 triage，預設 deterministic heuristic，可選 Ollama。
- 技術選型：
  - Node.js ESM，零外部 runtime dependency。
  - Node 內建 `node:test` 驗證。
  - MVP 做 file-level graph，不做 symbol-level graph。
- 關鍵決策：
  - 方案 A 極簡版：只產 Markdown capsule。代價是缺少 check/test map，差異不足。
  - 方案 B 彈性版：MCP + graph DB + plugin adapter。代價是 MVP 太重，容易撞 MemoryGraph/SpecMem。
  - 方案 C 常用情境版：CLI 產 repo-local handoff pack + optional local judge。選 C，因為最容易先看成果，也最不會綁特定 runtime。

## 風險與限制
- 掃描精度有限：MVP 是 file-level，不能替代 IDE call graph。緩解方式：README 明講限制。
- 本地模型不穩：Ollama 可能未啟動或模型不存在。緩解方式：預設 heuristics，Ollama 只做 optional。
- 開源前清理：保持 repo 不依賴私有路徑或服務。緩解方式：公開前跑敏感資料與敘事掃描。

## 不做的事
- 不綁特定聊天平台或 terminal transport。
- 不做 cloud memory backend。
- 不做完整 MCP server。
