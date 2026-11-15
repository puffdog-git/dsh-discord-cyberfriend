---
name: discord-memory-diagnose
description: 檢查 Discord 對話、人格日記與外部記憶插件的交付及召回；適用忘記事情、日記未入庫、工作區記憶混用或切換記憶系統的診斷。
---

先確認問題發生的 Discord 帳號、頻道、DSH 會話及實際工作區，只讀該範圍的設定與狀態。不要用目前開啟的 UI 工作區代替真實綁定，也不要將記憶正文、私訊或金鑰列入診斷報告。

## 找出中斷位置

1. 在 Discord 設定檢查會話綁定與回覆模式。正式 DSH 會話可讓已啟用記憶插件按自身策略捕獲；獨立自訂 LLM API 模式不能假定具有相同召回／捕獲能力。
2. 查看記憶輸出的來源紀錄、日記狀態、selectedWriter、寫入回執與錯誤。管理介面對應唯讀 `GET /api/discord-cyberfriend/memory-output`、`GET /api/discord-cyberfriend/sessions`；只有具本機管理權限時才使用這些 HTTP 介面，普通 Agent 不因此取得管理權。
3. 預設保留 memU。直接交付只走目前選定 writer：`memu` 用 `memu_private_remember`，`meow` 用 `memory_remember`，`files` 只輸出候選，`session` 只交付正式會話。失敗不自動改投別家，不為相容性同時啟用所有記憶系統。
4. 核對成功的證據：stored／deduplicated 需真回執及非空記憶 ID；pending_review／submitted／unverified 尚未確認，exported 只是檔案，模型說「已記住」不是回執。已啟用的其他插件仍可能自行捕獲正式會話，selected writer 不是全宿主唯一捕獲器。
5. 在選定記憶插件的公開診斷／召回介面核對相同工作區與記憶庫。只有使用者要求寫讀測試時才新增不含個資的測試記憶，記錄其 ID 及測試標記；不把正式來源批次重送當測試。

## 不同插件的範圍

- memU：核對實際工作區／library 綁定與跨庫召回設定。
- 魚的記憶：預設可能按 session 分庫，日記 session 不一定與聊天共用。
- Prime：捕獲與背景提煉分開；Mnemon：核對 Strategy／Source／View 與實體 dataDir，雲端子 Provider 不是獨立捕獲器。
- 靈樞：session 標記不代表私有，核對 sessionPrivate／租戶；OpenViking：核對 account／user／peer 與 context 召回，提交不等於提煉完成。
- Hindsight：核對 server／bank 與 retain／reflect 狀態；Soul-md：記憶依人格卡，無卡可能全域，同卡可跨工作區共用。

修復限於已確認的中斷點。重匯入或切換 writer 前核對目標、來源版本與去重方式；不直接改資料庫、私有儲存或偽造 session。工具缺失就報告缺失，不猜工具參數或繞過原權限。

回報「來源 → 日記／會話 → 所選交付 → 入庫 → 召回」各段的已確認證據、首個失敗點與最小修復。後端未實測時明確說明，保留原 writer 與範圍。
