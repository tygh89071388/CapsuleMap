# CapsuleMap — 任務追蹤

> 設計文件：`specs/capsulemap-mvp.md`
> 最後更新：2026-05-05

## 階段 1：Private Preview MVP
- [x] Tracer Bullet：CLI `init` 可掃描 repo 並產生 `docs/ai/*` 五份檔案（size: M）
- [x] CLI `check` 可針對單一檔案回報風險、反向引用與建議測試（size: S）
- [x] CLI `prompt` 可產生 coding agent 接手 prompt（size: S）
- [x] CLI `judge` 可用 deterministic heuristic / optional Ollama 做任務分流（size: S）
- [x] 補 README、spec、測試與驗證紀錄（size: M）

## 階段 2：後續 Roadmap
- [ ] 決定是否加入 MCP server
- [ ] 決定是否加入 git diff aware update
- [ ] 決定是否建立 GitHub repo 與發布流程
