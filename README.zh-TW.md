# CapsuleMap

給 coding agent 使用的 repo-native 接手地圖。

[English README](README.md)

CapsuleMap 會把一個程式碼倉庫整理成一組 `docs/ai/*` 檔案，讓下一個 coding agent 在改程式前先知道：

- 這個專案是什麼
- 應該先讀哪些檔案
- 改某個檔案可能影響哪裡
- 哪些測試比較可能相關
- 團隊或 agent 之間應該用哪些一致的架構語言
- 本地搜尋、關係圖譜、attention gate 未來要怎麼接進來

它不是通用記憶資料庫，也不是完整 RAG 系統。CapsuleMap 的定位更小、更直接：把「交接下一位 coding agent 需要的地圖」放回 repo 裡，讓它可以被版本控制、被 review、被人類直接打開看。

## 為什麼會省時間、省 token

CapsuleMap 要減少三種昂貴迴圈：重新理解專案、猜改動波及範圍、亂選測試。

- **少燒上下文預算**：agent 先讀 capsule、module index、impact map，不是一開始就把整個 repo 塞進上下文。
- **更快進入狀況**：first-read list 直接告訴下一個 agent 第一輪該看哪裡。
- **測試更聚焦**：test map 先給可能相關測試，避免只會全量亂跑或漏跑重點。
- **交接可 review**：`docs/ai/*` 在 repo 裡，人類和 agent 看的接手資訊一致。
- **把效能瓶頸量出來**：roadmap 背後的本地搜尋設定曾把一條 hybrid query 路徑從約 17 秒降到約 4 秒，延遲約下降 76%，小型驗證集 5/5 top-1。

這不是宣稱每個 repo 的 AI 工作效率都固定提升某個百分比。CapsuleMap 真正要做的是把「少重讀、少漏看、少亂測」變成可檢查、可持續改善的 repo artifact。

## 它的價值在哪

- **Repo-native**：接手資料放在 `docs/ai/`，人類可以 review，agent 也能直接讀，不需要先接一套雲端服務。
- **不只摘要**：CapsuleMap 不只列檔案，還會整理 reverse imports、相關測試、檔案級風險。
- **節省 agent 注意力**：它不是叫 agent 重讀整個 repo，而是告訴 agent 第一輪該讀什麼。
- **Local-first 分流**：judge 預設用 deterministic heuristic，也可以選擇透過 Ollama 使用本地模型。
- **來自實戰工作流**：roadmap 直接蒸餾自 QMD-style 本地 markdown search、關係圖譜、attention gate 的 agent 接手流程；公開版會保持乾淨、通用、可審查。

## 來自實戰工作流

CapsuleMap 是從一套每天用在 coding agent 接手的流程裡抽出來的：本地 markdown search、關係圖譜、attention gate。

公開版 0.1 沒有把整套系統打包進來，而是先公開每個 repo 都能馬上用的部分：可 review 的 handoff pack，以及未來 search / graph adapter 可以遵守的清楚契約。

更完整的 QMD-style 搜尋設定、CJK 檢索踩坑、relationship graph contract、attention gate 規則，可以看 [搜尋、圖譜與 Attention Roadmap](docs/SEARCH-GRAPH-ROADMAP.zh-TW.md)。

## 為什麼需要它

coding agent 很常從零開始接手。它們會重讀太多大檔案、漏掉專案決策、跑太多無關測試，或更糟的是漏跑真正該跑的測試。

CapsuleMap 把可交接的上下文變成 repo 內的固定檔案：

```text
repo files
  -> CapsuleMap scan
  -> docs/ai/*
  -> agent reads capsule + module index
  -> agent checks impact/test map before editing
```

這樣每次接手不用靠聊天紀錄或外部記憶服務，也不用把整個專案塞進模型上下文。

## 快速開始

需要 Node.js 20 或更新版本。

```bash
npm exec --yes --package capsulemap -- capsulemap init .
```

執行後會產生 `docs/ai/`：

- `docs/ai/PROJECT-CAPSULE.md`：專案摘要、入口檔、熱點檔案、agent first-read 指引
- `docs/ai/MODULE-INDEX.md`：依角色整理的檔案級模組索引
- `docs/ai/SYMBOL-INDEX.md`：函式、class、interface、type、enum、exported const 的精簡定義索引
- `docs/ai/IMPACT-MAP.json`：imports、reverse imports、相關測試、檔案風險
- `docs/ai/SYMBOL-MAP.json`：給 `capsulemap symbol` / `capsulemap symbols` 查詢用的機器可讀 symbol map
- `docs/ai/TEST-MAP.json`：source file 與 test file 的對映
- `docs/ai/ARCHITECTURE-LANGUAGE.md`：交接與 review 時使用的一致架構語言
- `docs/ai/SEARCH-GRAPH-ROADMAP.md`：本地搜尋、關係圖譜、attention gate 的公開整合路線

## 用在自己的專案

不想加入依賴，可以直接用 npm one-off 執行：

```bash
npm exec --yes --package capsulemap -- capsulemap init .
npm exec --yes --package capsulemap -- capsulemap check src/index.ts .
npm exec --yes --package capsulemap -- capsulemap symbol main .
npm exec --yes --package capsulemap -- capsulemap symbols src/index.ts .
npm exec --yes --package capsulemap -- capsulemap prompt .
npm exec --yes --package capsulemap -- capsulemap roadmap .
```

如果想在本機有固定 `capsulemap` 指令：

```bash
npm install -g capsulemap
capsulemap init .
capsulemap check src/index.ts .
capsulemap symbol main .
capsulemap symbols src/index.ts .
capsulemap prompt .
capsulemap roadmap .
```

如果希望團隊或 coding agent 固定使用同一版：

```bash
npm install --save-dev capsulemap
npm exec capsulemap -- init .
npm exec capsulemap -- check src/index.ts .
npm exec capsulemap -- symbol main .
npm exec capsulemap -- symbols src/index.ts .
npm exec capsulemap -- prompt .
npm exec capsulemap -- roadmap .
```

如果希望接手資料跟著 repo 走，就把產生出的 `docs/ai/*` commit 進專案。如果只是臨時給 agent 看，也可以只留在本機不提交。

建議 workflow：

```text
1. 執行 capsulemap init .
2. 請 coding agent 先讀 docs/ai/PROJECT-CAPSULE.md。
3. 改檔案前跑 capsulemap check <file> .。
4. 如果已知函式、class、interface 或 type 名稱，先跑 capsulemap symbol <name-or-regex> .。
5. 用 docs/ai/TEST-MAP.json 選擇聚焦測試。
6. 任務涉及搜尋、記憶、圖譜、檢索或上下文注入時，讀 docs/ai/SEARCH-GRAPH-ROADMAP.md。
7. 大改架構或模組後，再重新產生 docs/ai/*。
```

查某個檔案改動可能影響什麼：

```bash
capsulemap check src/project-scan.mjs .
```

用名稱查定義位置：

```bash
capsulemap symbol scanProject .
capsulemap symbols src/project-scan.mjs .
```

產生給 coding agent 的接手 prompt：

```bash
capsulemap prompt .
```

只輸出 search / graph / attention roadmap，不寫檔案：

```bash
capsulemap roadmap .
```

用本地判斷器分流任務：

```bash
capsulemap judge "continue the refactor"
```

## 設計筆記

更多設計背景可以看 [Design Notes 繁中版](docs/DESIGN-NOTES.zh-TW.md)。裡面整理了 CapsuleMap 為什麼先做 file-level handoff pack，以及搜尋、embedding、關係圖譜、attention budget 未來可以怎麼接進來。

更完整的 search / graph / attention 方向可以看 [搜尋、圖譜與 Attention Roadmap](docs/SEARCH-GRAPH-ROADMAP.zh-TW.md)。

## 本地模型判斷器

CapsuleMap 內建 deterministic heuristic，預設不需要任何模型或網路服務。

如果你有 Ollama，也可以啟用本地模型判斷器：

```bash
CAPSULEMAP_LOCAL_JUDGE=ollama CAPSULEMAP_OLLAMA_MODEL=gemma4:e2b capsulemap judge "continue the refactor"
```

這個 judge 的用途是分流，不是裁決。它可以協助判斷任務像是：

- 接手 / resume / handoff
- code change
- architecture review
- test request
- docs task

它也會建議 agent 最少需要讀哪些 `docs/ai/*` 檔案。

## 架構

```text
bin/capsulemap.mjs
  -> src/project-scan.mjs  scan files, imports, reverse imports, tests
  -> src/writer.mjs        write docs/ai, render prompts, render symbol index and roadmap
  -> src/local-judge.mjs   heuristic or optional Ollama triage
```

目前 MVP 是 file-level map 加 definition-level symbol lookup；不做 symbol-level call graph，也不取代 IDE index。

## 目前支援

已實作：

- JavaScript、TypeScript、Python 檔案掃描
- relative JS/TS import resolution
- simple Python import extraction
- file-level impact map
- definition-level symbol map
- test map
- handoff prompt rendering
- search / graph / attention roadmap rendering
- local heuristic judge
- optional Ollama judge

尚未包含：

- MCP server
- symbol-level call graph
- 內建 QMD 或 vector search adapter
- 內建 relationship graph database
- automatic git hooks
- cloud memory backend

## 開發

```bash
npm run check
npm test
```

目前 preview 沒有外部 runtime dependencies。
