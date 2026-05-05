# CapsuleMap 設計筆記

[English version](DESIGN-NOTES.md)

CapsuleMap 一開始只承諾一件小但重要的事：讓下一個 coding agent 更容易接手一個 repo。

這個承諾刻意比完整記憶平台更小。preview 不打算保存每段對話、不建立完整語意索引，也不要求長駐服務。它只把一組精簡的接手資料寫回 repo，讓人類和 agent 都能直接檢查。

## 核心問題

很多 coding agent 失敗，不只是上下文窗口不夠，而是交接太弱：

- agent 不知道第一輪該讀哪些檔案
- 專案決策藏在舊聊天或零散筆記裡
- 用大範圍測試取代精準測試判斷
- 產生的摘要太籠統，不能真的指引修改
- 持久記憶系統很強，但也帶來建置與信任成本

CapsuleMap 把交接資料視為 repo artifact。下一個 agent 需要讀的東西，人類 reviewer 也應該能打開看懂。

## Preview 已提供什麼

目前 preview 先專注在 file-level handoff：

- project capsule
- module index
- impact map
- test map
- architecture vocabulary
- local heuristic 或 optional Ollama 任務分流

這些已經能回答 agent 接手前最該問的問題：

- 這個專案是什麼？
- 我應該先讀哪些檔案？
- 如果改這個檔案，可能影響哪裡？
- 哪些測試比較可能相關？
- 討論架構時應該使用哪些一致的詞？

## Roadmap 背後的經驗

CapsuleMap 的 roadmap 來自 local-first agent 系統的實務經驗，但公開版會保持乾淨、通用、可審查。

### 搜尋需要語言意識

單純 keyword search 在 CJK 文字上很容易踩雷。當文字切分器把一長串中文當成單一搜尋詞，子字串查詢就可能完全找不到。

未來若加入搜尋 adapter，應該明確處理：

- CJK-friendly indexing 要實測，不能假設會好
- 很短的查詢可能需要 vector fallback 或替代 matching
- 搜尋品質要用真實多語查詢驗證

### Embedding 需要操作紀律

embedding model 不是隨便替換就好的零件。換模型可能改變向量維度、排序行為、儲存大小與重建成本。

未來 CapsuleMap 若加入搜尋能力，文件應該清楚記錄：

- 使用哪個 embedding model
- document / query 如何格式化
- 什麼情況必須重建 index
- 換模型後怎麼驗證搜尋品質

### 一組具體的本地搜尋設定

CapsuleMap 目前還沒有內建搜尋後端，但它的 roadmap 參考了一套 QMD-based local search 設定。

這套設定中值得公開的，不是私有流程，而是工程約束：

- **基礎工具**：QMD，一個本地 markdown search tool。
- **keyword index**：SQLite FTS5，使用 trigram tokenizer，讓 CJK 子字串搜尋比較穩。
- **embedding model**：`multilingual-e5-large-instruct`。相較於較小的 `embeddinggemma-300M` 設定，實測多語召回與分數分離度更好。
- **query mode**：hybrid query，同時融合 keyword 與 vector 結果。
- **fusion**：deterministic RRF-style score fusion。
- **query expansion**：預設關閉；小型本地模型在多語與短 CJK 查詢上容易產生噪音擴展。
- **LLM reranking**：預設關閉；在測試 workload 中，延遲成本高於品質收益。
- **短 CJK fallback**：trigram 天然從 3 字元開始比較有效，極短中文查詢需要 vector 或其他 matching fallback。

重點不是一定要使用同一套工具，而是 local search 必須有可量測設定。模型名稱、index 維度、query formatting、重建規則、benchmark fixture，都應該被視為產品表面的一部分。

### Hybrid Retrieval 通常比單一排序穩

keyword search、vector search、model reranking 失敗的方式都不同。好的本地系統應該優先選擇可量測、可預測的排序行為，而不是一味增加昂貴的模型呼叫。

未來可以探索：

- keyword + vector fusion
- deterministic score fusion
- 只有在實測有效時才啟用 reranking
- 為多語 repo 建立 benchmark fixture

### 關係圖譜回答的是不同問題

搜尋索引負責找文件；關係圖譜負責解釋連結。

對 coding agent 來說，這個差別很重要：

- search 幫忙找到可能相關的檔案或筆記
- impact map 顯示 file-level 改動風險
- relationship graph 可以解釋某個決策、模組或測試為什麼互相影響

CapsuleMap 先從 file-level impact map 開始，因為它簡單、可 review，而且馬上有用。未來如果加入 graph adapter，也應該維持可檢查，不應強迫使用 hosted backend。

### Attention Budget 是產品功能

更多上下文不一定比較好。每個任務都注入太多不相關記憶時，agent 反而會變差。

CapsuleMap 會持續偏向：

- 小而準的 first-read list
- 依任務類型選 required docs
- 去重後的建議
- 清楚區分 hints 與 authority

## 為什麼現在不全部做

preview 刻意不做完整 memory database、symbol graph、MCP server、cloud backend。

這是產品選擇。第一版應該先證明 repo-local handoff pack 本身有價值，再加更重的基礎設施。

未來每個新功能都應該過同一個門檻：如果它不能更清楚回答「該讀什麼、會影響什麼、該測什麼」，就暫時不該進核心交接流程。

## 隱私與可審查性

CapsuleMap 的設計目標，是讓產生出的 handoff files 可以被 commit、review、分享。

公開 repo 應避免把 credentials、機器本機路徑、私有服務名稱、個人識別資訊、聊天平台 runtime 細節寫進產物。

發布前先跑：

```bash
npm run check
npm test
```

然後再跑自己的 credential 與 private-context 掃描，確認沒有把不該公開的內容 commit 出去。
