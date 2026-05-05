# 搜尋、圖譜與 Attention Roadmap

CapsuleMap 不只是檔案摘要工具。它是從一套實戰 AI agent 接手流程中抽出來、可以公開使用的 repo-native 版本。

這套流程背後有三個核心教訓：

1. 搜尋負責找到可能相關的上下文。
2. 圖譜負責解釋上下文為什麼彼此有關。
3. Attention gate 負責決定這一輪到底該讓 agent 讀多少。

0.1 版先從 file-level handoff pack 開始，因為它馬上有用、容易檢查、也適合 commit 進 repo。這份 roadmap 說明未來如何把本地搜尋、關係圖譜、上下文控管接進 CapsuleMap，同時避免變成看不懂的黑盒記憶庫。

## 為什麼重要

Coding agent 很常不是因為不聰明而失敗，而是因為接手方式太粗：

- 不知道從哪裡開始，所以重讀一堆大檔案。
- 專案決策藏在聊天紀錄、筆記或舊 review 裡。
- 測試不是跑太多，就是漏跑真正相關的。
- 記憶塞太多，反而變慢、變吵、變不精準。
- 中文、英文、路徑、指令、錯誤訊息混在一起時，搜尋很容易失準。

CapsuleMap 現在先解決第一層：把接手地圖放回 repo。下一層就是把 local search 與 relationship graph 做成可檢查、可量測、可插拔的能力。

## 第一層：Repo-Native Handoff Pack

這是 CapsuleMap 目前已經提供的能力。

- `PROJECT-CAPSULE.md`：讓下一個 agent 在掃整個 repo 前先知道專案狀態。
- `MODULE-INDEX.md`：依角色整理檔案。
- `IMPACT-MAP.json`：記錄 imports、reverse imports、可能相關測試、檔案級風險。
- `TEST-MAP.json`：連結 source files 與 tests。
- `ARCHITECTURE-LANGUAGE.md`：讓交接和 review 使用一致詞彙。
- `SEARCH-GRAPH-ROADMAP.md`：說明 search、graph、attention gate 未來如何接進來。

這一層刻意維持 file-level。它不是 IDE index、type checker、symbol graph 或完整 RAG 系統的替代品。

## 第二層：QMD-Style Local Search

搜尋應該回答：

> 這個任務可能需要讀哪些文件、筆記、檔案或接手產物？

CapsuleMap roadmap 背後參考了一套 QMD-style markdown search 流程：

- **Keyword index**：SQLite FTS5 + trigram tokenizer，讓 CJK 子字串搜尋比較穩。
- **Vector index**：用 embedding 處理不同措辭、不同語言的語意匹配。
- **Embedding model**：`multilingual-e5-large-instruct`；在重視多語召回與分數分離度時，比較小的多語模型實驗更穩。
- **Query mode**：hybrid keyword + vector retrieval。
- **Fusion**：deterministic RRF-style score fusion。
- **Reranking**：可選、可量測，不應無腦常駐。
- **短中文 fallback**：trigram 天然從 3 字元開始比較有效，極短中文查詢需要 vector 或其他 matching fallback。

重點不是每個人都要用 QMD。重點是 local search 的設定必須可量測。模型名稱、向量維度、tokenizer、query formatting、重建規則、benchmark fixture，這些都是產品行為，不是可以藏起來的雜務。

### Search Adapter Contract

未來 CapsuleMap search adapter 應該回傳精簡候選：

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

搜尋負責告訴 agent 去哪裡看，不負責直接判定真相。

## 第三層：Relationship Graph

圖譜應該回答：

> 這些檔案、決策、測試、教訓為什麼彼此有關？

搜尋找候選，圖譜解釋候選之間的關係。

有用的關係類型包括：

- `imports` / `imported_by`
- `tested_by`
- `owns_contract`
- `depends_on_decision`
- `learned_from`
- `risk_affects`
- `supersedes`
- `related_to`

例如，一個 source file 可以透過 import 關係連到測試，透過 module contract 連到架構決策，再透過舊失敗紀錄連到某個教訓。

### Graph Adapter Contract

未來 graph adapter 應該回傳短而可檢查的 facts：

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

圖譜輸出要短。它的用途是解釋關係，不是把整個 database 倒進 agent 上下文。

## 第四層：Attention Gate

真正困難的不是找到更多上下文，而是決定什麼不要注入。

好用的 attention gate 應該照順序做：

1. 先讀 `PROJECT-CAPSULE.md` 和 `MODULE-INDEX.md`。
2. 只有在可能改檔案時才加入 `IMPACT-MAP.json` 和 `TEST-MAP.json`。
3. capsule 不存在、過薄或過期時，才補 search hits。
4. 任務涉及關係、原因、架構、ownership、風險、測試策略時，才補 graph facts。
5. 重複文件要去重。
6. 結果數量要積極限制。
7. raw history 預設不要進上下文。

這樣才是真的省 token：不是餓死 agent，而是先給最有價值的東西，需要時再展開。

### Attention Gate Contract

未來 attention gate 可以產生精簡 read plan：

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

這個 bundle 必須讓人類也看得懂。如果人類看不出為什麼 agent 收到某段上下文，系統就太黑盒了。

## 如何接進 CapsuleMap

CapsuleMap 0.1 已經有穩定基底：

```text
repo files
  -> capsulemap init
  -> docs/ai/*
  -> agent reads the handoff pack
  -> agent checks impact/test maps before editing
```

未來 adapter 可以把流程擴成：

```text
task
  -> handoff pack
  -> search adapter
  -> graph adapter
  -> attention gate
  -> compact read plan
  -> agent verifies against source code
```

中心仍然是 handoff pack。搜尋和圖譜是輔助系統，不取代原始碼驗證。

## 目前還沒內建什麼

CapsuleMap 目前還沒有內建：

- QMD integration
- vector index
- graph database
- symbol-level call graph
- automatic git hooks
- MCP server
- cloud memory backend

這些刻意先分開。公開契約要小到能被信任。

## 設計原則

不要預設給 agent 更多記憶。先給它一張地圖，再提供可量測的方法讓它要求更多。

這就是 context dump 和 handoff system 的差別。
