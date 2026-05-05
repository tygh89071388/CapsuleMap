# CapsuleMap

給 coding agent 使用的 repo-native 接手地圖。

[English README](README.md)

CapsuleMap 會把一個程式碼倉庫整理成一組 `docs/ai/*` 檔案，讓下一個 coding agent 在改程式前先知道：

- 這個專案是什麼
- 應該先讀哪些檔案
- 改某個檔案可能影響哪裡
- 哪些測試比較可能相關
- 團隊或 agent 之間應該用哪些一致的架構語言

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
- **來自真實接手問題**：後續 roadmap 會吸收 CJK 搜尋、hybrid retrieval、關係圖譜、上下文注入降噪等經驗，但會保持公開版乾淨、通用、可審查。

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
git clone https://github.com/tygh89071388/CapsuleMap.git
cd CapsuleMap
npm test
node bin/capsulemap.mjs init .
```

執行後會產生 `docs/ai/`：

- `docs/ai/PROJECT-CAPSULE.md`：專案摘要、入口檔、熱點檔案、agent first-read 指引
- `docs/ai/MODULE-INDEX.md`：依角色整理的檔案級模組索引
- `docs/ai/IMPACT-MAP.json`：imports、reverse imports、相關測試、檔案風險
- `docs/ai/TEST-MAP.json`：source file 與 test file 的對映
- `docs/ai/ARCHITECTURE-LANGUAGE.md`：交接與 review 時使用的一致架構語言

查某個檔案改動可能影響什麼：

```bash
node bin/capsulemap.mjs check src/project-scan.mjs .
```

產生給 coding agent 的接手 prompt：

```bash
node bin/capsulemap.mjs prompt .
```

用本地判斷器分流任務：

```bash
node bin/capsulemap.mjs judge "continue the refactor"
```

## 設計筆記

更多設計背景可以看 [Design Notes 繁中版](docs/DESIGN-NOTES.zh-TW.md)。裡面整理了 CapsuleMap 為什麼先做 file-level handoff pack，以及搜尋、embedding、關係圖譜、attention budget 未來可以怎麼接進來。

## 本地模型判斷器

CapsuleMap 內建 deterministic heuristic，預設不需要任何模型或網路服務。

如果你有 Ollama，也可以啟用本地模型判斷器：

```bash
CAPSULEMAP_LOCAL_JUDGE=ollama CAPSULEMAP_OLLAMA_MODEL=gemma4:e2b node bin/capsulemap.mjs judge "continue the refactor"
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
  -> src/writer.mjs        write docs/ai and render prompts
  -> src/local-judge.mjs   heuristic or optional Ollama triage
```

目前 MVP 是 file-level map，不做 symbol-level call graph，也不取代 IDE index。

## 目前支援

已實作：

- JavaScript、TypeScript、Python 檔案掃描
- relative JS/TS import resolution
- simple Python import extraction
- file-level impact map
- test map
- handoff prompt rendering
- local heuristic judge
- optional Ollama judge

尚未包含：

- MCP server
- symbol-level call graph
- automatic git hooks
- cloud memory backend

## 開發

```bash
npm run check
npm test
```

目前 preview 沒有外部 runtime dependencies。
