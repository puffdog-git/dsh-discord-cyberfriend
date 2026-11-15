# AI 日記與外部記憶入庫（新版）

目前預設流程是：**當日來源 → 正式 DSH Agent 套用工作區人格 → AI 第一人稱日記 → 有證據的記憶候選 → 外部插件公開工具入庫 → 核對收據**。

這已取代前版「以逐則紀錄作為主要日記」的預設。使用者已選擇 memU，依工作區分開記憶庫。管理者的正式對話仍持續保存於原生 DSH Session。

## 閱讀與操作

「記憶輸出」頁可選日期立即產生日記、預覽 AI 日記、查看來源紀錄與入庫結果。主要 Markdown 是 AI 寫的日記；`.sources.md` 才是逐則來源。UI 會分開顯示日記生成與記憶入庫狀態，失敗時仍保留已寫好的日記。

預設每天 **03:00，Asia/Taipei** 處理前一天。重開 DSH 後補產生已收集、尚未完成的日期；沒有觀察到的 Discord 離線訊息不會憑空補回。當日手動輸出標示 partial，日結再產生完成版本。模型／入庫失敗可在 UI 手動重新產生；不無限重試昂貴的 AI 工作。

「聊天快取」僅供近期回覆上下文；與正式 Session、日記與外部記憶庫分開。「log」用於連線和除錯。

## 人格與來源

日記 Agent 有真正的 sessionId／cwd，透過宿主 agents 與 workspaceRegistry 建立，外部人格插件能依工作區套用人格。未替使用者擅自選定人格。

來源按約 20,000 字元分段讀取，逐段留下素材筆記後撰寫日記。沒有用單一長度上限悄悄刪掉整天前半的對話。日記與素材分開保存；日記會說明管理者談話、群友互動、表情／GIF／黑話情境及來源訊息 ID。觀察、推測、模擬與已刪除資料須區分。

日記 Agent 的模型工具權限保持空集合，不授予讀檔、Shell 或任意工具。產生日記和 JSON 候選後，程式檢查候選的證據 ID，再經受限連接器呼叫外部記憶插件。這避開宿主供應者在單一延遲載入工具時的相容性問題，也避免為入庫開放電腦工具。未執行的 DSML／工具語法不會被當成日記。

日記生成與事件收集使用不同佇列，AI 寫作不會阻塞即時收訊。日記草稿保存後，即使入庫尚在進行，也可先預覽。

## memU 入庫

預設連接器使用已註冊的 `memu_private_remember` 公開工具，傳入真正日記 Agent 的 Session／cwd。memU 自己依工作區選擇或建立私有記憶庫；本插件不直接讀寫其資料庫，也不呼叫全域記憶寫入工具。memU 本身的全域共享／召回設定仍由 memU 管理。

完整日記保存在 Markdown；memU 接收它所支援的短記憶摘要，每篇最多三項，附日期、頻道、證據 ID 和穩定 fact_key。這遵守記憶工具的內容規格，沒有把整篇逐字稿硬塞成一條記憶。

收據保存 writer、status、實際記憶 IDs、工具回覆與 evidenceIds。只因模型說「已記住」不算成功；沒有可核對 ID 的寫入結果標示未驗證。來源全為模擬或已刪除時不入庫。記憶候選含已知憑證或群聊受保護資料時拒絕入庫。

其他插件可透過 `globalThis.__DSH_DISCORD_PYSELF_LAB__.memoryOutput.registerMemoryWriter(id, handler)` 註冊替代連接器，再在 UI 選擇 writer ID。handler 收到摘要 args、日記、cwd、sessionId、sourcePath、evidenceIds 與真實 Agent exec；回傳 `{status, ids, detail}`。本插件串行執行寫入，並核對結果。

## 檔案與公開介面

預設索引在工作區下 `discord-memory-output/manifest.json`，manifest schema 為 `dsh.discord.memory-output` version 2。原始 JSONL 位於 `events/YYYY-MM-DD.jsonl`。

每個日期／頻道在對應工作區下產生：

```text
memory/discord/{channelId}/YYYY-MM-DD.md          AI 日記
memory/discord/{channelId}/YYYY-MM-DD.sources.md  逐則來源
memory/discord/{channelId}/YYYY-MM-DD.json        結構化來源＋diary
memory/discord/{channelId}/YYYY-MM-DD.memory.json 入庫收據
```

來源 JSON 保留 `dsh.discord.daily-source` version 1 的既有欄位，新增 `diary`、`cultureEvents` 等可選欄位。人格日記為 `dsh.discord.persona-diary` version 1；收據為 `dsh.discord.memory-receipt` version 1。

原始事件包含 message／message.edit／message.snapshot／message.delete、reaction.add／reaction.remove，以及媒體使用、辨識、同內容別名、重用與接龍事件。Bot／小號的重複觀察會去重；移除後重新按表情仍保留兩次操作。表情是互動線索，不直接等同有趣、贊同或偏好。時間是插件觀察時間；並非完整 Discord 歷史。

REST 前綴 `/api/discord-cyberfriend`：

- `GET /memory-output`：排程、索引、狀態。
- `POST /memory-output/export`：`{"date":"2026-11-11","force":true}`，產生／重產日記。
- `GET /memory-output/read?id=日期%3A頻道ID&format=markdown`：AI 日記。`source` 讀來源 Markdown，`json` 讀結構化資料。只接受索引中存在的 ID。
- `POST /test-diary`：隔離的系統診斷工作區，不向 Discord 發訊息。`{"scope":"second"}` 使用第二個診斷工作區，供分庫驗證。

唯讀工具 `discord_cyberfriend_memory_outputs` 與共享服務提供同樣資料。檔案、Session 與來源 API 可供其他記憶插件使用，不要求適配 memU 私有格式；外部插件仍需設定自己的來源與作用範圍。

## 驗證

已驗證正式 DSH 日記 Agent、真實 memU 公開工具寫入及記憶 ID 收據。診斷資料明確標記「系統測試」，不當成人物生活事實。另有測試覆蓋日記先保存再入庫、失敗不冒稱成功、模擬來源不入庫、慢速日記不阻塞收訊，以及日記／來源分開預覽。
