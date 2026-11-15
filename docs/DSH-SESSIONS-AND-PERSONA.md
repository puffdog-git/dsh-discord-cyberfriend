# DSH 正式會話與外部人格

日期：2026-11-11（UTC+8）。適用 Discord 賽博群友。

## 使用方式

1. 「DSH 會話與人格」選擇 **DSH 正式會話**，模型使用 DSH 已註冊來源。自訂 OpenAI 相容 API 請使用原有獨立模式。
2. 四個對象／場景設定頁分別提供：插件內建人格、插件口吻規則、去 AI 味提示、去 AI 味文字處理、Markdown 移除。外部人格模式建議五項均關閉；此次已將四組設定設為關閉，原人格文字保留。
3. 在 DSH 的人格插件中，為新的 Discord 工作區或其中會話選人格。插件本身不複製、覆寫外部人格庫。
4. 「DSH 會話與人格」頁下方可查看 channel → session ID／cwd，開始新會話、切換工作區並開新會話，或明確綁定既有的冷 DSH 會話。舊會話與歷史保留。綁定目標不能正由其他 Agent 持有，也不能已綁定另一段 Discord 對話。

目前外部 dsh-persona-dafeiyu 原設定為 workspace 模式、全域人格關閉。測試暫時設定的人格會在結束時清除；使用者需自行選擇希望正式使用的人格。關閉本插件人格不等於關閉 DSH 全域系統提示詞。

## 會話與工作區

每個 `transport + 登入帳號 ID + Discord channel ID` 對應獨立持久 Session。群聊不因發話者是管理者或其他人而更換 Session；權限與本地補充仍按發話者套用。討論串有自己的 channel ID，所以各有獨立 Session。Bot／小號預設分離。

預設工作區在插件所屬 workspace 的 `discord/` 子目錄：

- `admin-dm`：管理者私訊；Bot／小號仍各有自己的 Session。
- `other-dm`：其他使用者私訊，各個 DM channel 有自己的 Session。
- `guild-{guildId}`：每個伺服器一個工作區，各頻道／討論串有自己的 Session。
- `group-{channelId}`：群組私訊。

工作區會經 DSH workspaceRegistry 正式註冊，Session 也經 attachSession 加入工作區，能在 DSH 側邊欄查看。自訂根目錄與私訊目錄可在設定中指定；個別綁定可覆寫工作區。

Session 隔離不代表任意外部記憶插件也隔離：若記憶插件把整個 workspace 當成共用記憶，預設 other-dm 的不同會話仍可能共用該插件的工作區記憶。需要人別隔離時，請透過綁定 UI 指定不同工作區，並檢查該記憶插件的作用範圍。

## 實作與相容範圍

- 使用宿主 `agents.create/resume`、持久化服務與正式 Agent loop。傳入的是真正 Session，不是偽造 sessionId 或自行寫 DSH JSONL。
- 系統提示詞透過 Agent scoped `systemPrompt.section` 注入 Discord 功能契約。DSH 自行 assemble，外部插件取得真正的 `agent.session.header.id` 與 `cwd`。
- 已實測 dsh-persona-dafeiyu 0.8.0 的 workspace／session 人格切換。其他插件是否生效取決於其掛載方式；全域 Agent／提示詞 hooks 可參與，要求特殊 Agent preset 的插件未宣稱通用相容。
- 每個 Discord 對話序列化執行。取消會停止對應 Agent，尚未執行的已取消訊息不入列。模型未完成的結果不當成完整答案發送。
- 圖片由 DSH 附件服務保存，以正式 image blocks 送入 Session。原生圖片優先；可用且適用的 ModLens provider 保留選路。
- 預設不授予 Agent 工具。需要記憶插件工具時，可在 UI 明確填入已註冊名稱；重載後生效。沒有授予 Discord 發送工具，避免 Agent 與回覆器各送一次。
- 正常私訊／@／閒聊、使用者表情控制、Bot 表情觸發回覆走共用 responder。分類、GIF 搜尋等內部判斷不建立聊天 Session。
- 正式模式由 DSH 提供既有會話上下文，不再把本插件的整份歷史重複塞入 prompt。舊 history.json 保留用於既有接話判斷／預覽補齊，沒有自動匯入為新對話。開啟「保存所有管理者對話至 DSH」（預設開啟）後，管理者未觸發回覆的訊息也會進入對應的正式 Session。
- `/cyberfriend-reset` 同時換新 DSH 綁定並清除本地頻道記憶；原 DSH 歷史仍保留。
- 綁定資料在 `data/session-bindings.json`，以暫存檔及 rename 保存。卸載插件會停止並釋放其擁有的 Agent；借用的 DSH UI Agent 只取消插件當下自己的生成，不關閉使用者其他工作，原生 Session 資料保留。

## 驗證

- 84 項 Node 測試、50 項前端 smoke、23 項隔離 REST smoke 通過。新增測試涵蓋序列化、Session／帳號／頻道隔離、重啟恢復、取消、工作區覆寫、禁止奪取其他活躍 Agent、人格與格式開關、Bot 表情共用回覆器。
- 真實 DSH 診斷會話記住「藍莓星球」，兩次重啟後沿用同一 ID 並正確取回。
- 同一 Session 先後套用 workspace 阿茶／大肥魚，下一輪自我介紹立即切換；session 層指定阿茶也生效，且仍記得暗號。外部插件 probe 確認收到真正 Session ID／cwd。
- 桌面 Discord 管理者於 21:33 發出 S1，Bot 成功回覆並記住「銀河布丁」。21:35 未 @ 的 S2 經接話窗口進入同一 Session；人格切換後回答大肥魚並正確取回暗號。
- 另開診斷 Session 詢問暗號，回覆不知道；未混入另一 Session 的暗號。
- 桌面 Discord 管理者於 21:45／21:46 對小號發出 D1／D2，小號在自己的 Session 記住並取回「琥珀海獺」。typing 與真正送出均有日誌。
- 21:47 小號 I1 測試：18 格 GIF 取出 4 格，4 張 image blocks 進入 DSH Session，成功回覆灰白小貓與黃色貓砂盆的描述。

這些是短期功能測試，不代表長期連線或任意外部記憶插件都已驗證。

最終檢查：四個測試／正式 Discord 綁定均已取得 workspaceId。22:00 管理者從桌面 Discord 發出 S3，Bot 恢復原頻道 Session 而非建立新 Session。外部人格設定已恢復：workspace 模式、全域關閉、測試工作區選擇清空；未更動既有原工作區人格設定。


## 管理者完整保存與外部記憶（22:28 更新）

`archiveAdminMessages` 預設開啟。保存插件實際收到的管理者私訊、群聊、伺服器頻道訊息；未 @、閒聊判定略過、回覆關閉、限流或小號僅接收模式，都不影響保存。無法讀取離線期間或 Discord 未提供的頻道訊息，不自動回補全部歷史。

全新會話尚未產生系統開頭時，僅保存的訊息先留在本機待寫入紀錄，重啟後仍會保留；會話完成首次模型回覆並建立系統開頭後，才補寫入原生 Session。這不會為了保存紀錄額外呼叫模型，也避免先寫使用者訊息造成新版 DSH 無法重新載入會話。若該會話一直沒有啟動模型回覆，訊息會繼續留在待寫入紀錄。

保存與回覆分離。未回覆的訊息透過原生 Agent 的 `runMaintenance` 與 Session `user/message` append 寫入，不啟動模型、不顯示 typing、不製造假的完成輪次。作者、頻道、時間、文字、附件／貼圖資訊保留在內容中；沒有實際解碼的媒體不假裝已辨識。正常回覆仍由正式 Agent loop 保存使用者、圖片與助理內容。以 Discord 頻道／訊息 ID 去重。

`data/manager-inbox.json` 是原生 Session 寫入前的持久重試佇列，成功後移除。DSH UI 正在執行其他工作時不取消它，佇列每 10 秒重試；插件重啟後仍可補寫。不要刪除此檔來清空正式對話。相同頻道由 Bot／小號各收到時，仍沿各自 Session 保存，並不跨帳號混合。

閒置的既有 DSH UI Agent 可接續使用；只在 Discord 生成期間掛載功能提示、工具限制與模型設定，結束後移除並還原模型。手動綁定其他 Session 仍要求先關閉其 Agent。

### memU 1.3.1

已檢查本機 `dsh-memu-memory` 的 `lib/inbound.js`、`inject.js`、`private.js` 與 README。它會監聽原生 `session/event` 中的 `user/message`，因此不需要把每則 Discord 訊息再投遞成 memU 專用批次；重複投遞反而會產生兩個來源。其他讀取 DSH Session／事件／工作區的記憶插件也能使用這個標準來源，但未宣稱全部插件已實測。

**本機目前管理者私訊與伺服器兩個會話的 memU binding 存在，但 libraryId 為 null，尚未選定記憶庫。** 請在 memU 為 `discord/admin-dm` 與相應 `discord/guild-*` 工作區選取／建立記憶庫。兩邊要共用或隔離長期記憶，由 memU 的綁定選擇決定；本插件不代改既有記憶庫或跨場景合併。

若需要 memU 自動整理，還需在本插件「會話可用工具名稱」授權 memU 實際註冊的記憶寫入工具（例如 `memu_private_remember`、`memu_private_update`），並依 memU 設定啟用整理。預設工具清單為空。只保存、沒有後續完成 AI 輪次的訊息尾端，memU 可能等後續有效輪次再整理。**原生紀錄存在、記憶庫已綁定、已完成長期記憶抽取，是三個不同狀態。**

本次驗證：88 項 Node 測試、50 項前端 smoke、25 項 Python 測試。實機 G1：先前 404 的 GIF 更新網址後 57 格取 4 格，原生圖片送模成功，小號實際送出描述紅色蒙面小人與藍色閃電的文字回覆。A1：未 @ 群聊模擬訊息不產生回覆，但原生壓縮 Session 檔有一筆 user/message。A2：從管理者桌面 Discord 發送私訊，在僅接收模式下仍出現同樣原生事件，沒有啟動 AI；測試後已還原自動回覆模式。另於 DSH UI 開啟的診斷 Session 接續生成「接續成功」，沿用既有 ID，未再報 Agent 佔用錯誤。

typing 收尾修正：續發 typing 在文字送出前停止，不再等候送出後的表情處理；finally 保留一次性清理。六種 typing 生命週期測試確認正常／送出失敗路徑均先停止再送出，NO_REPLY／生成錯誤也能清理；全部 88 項 Node 測試通過。Discord 仍可能延遲顯示已發出的 typing 事件，不能保證客戶端立刻消失。



## 記憶輸出職責調整

現在由本插件生產原生對話與通用來源檔，外部插件自行歸納／寫入長期記憶，不需要為本插件另外授權記憶寫入工具。原先 memU 專用綁定建議不再是本插件使用前提；要使用 memU 的自動記憶功能時，其綁定與整理工作仍由 memU 管理。新 UI／資料格式／排程詳見 [MEMORY-OUTPUT.md](MEMORY-OUTPUT.md)。


## 最新流程（人格日記、外部入庫與安全）

依最新要求，「記憶輸出」預設改為工作區人格撰寫 AI 日記，再經連接器呼叫 memU 私有記憶工具；逐則來源另存 `.sources.md`，UI 可看日記及實際入庫收據。外部寫入器與唯讀文化檢索提供者皆可註冊，不直接修改第三方資料庫。詳見 MEMORY-OUTPUT.md 與 MEDIA-CULTURE-AND-SECURITY.md。

其他使用者私訊的預設工作區現為 `discord/other-dm/{userId}`。群聊與非管理者每次回覆均禁止 Agent 工具；管理者一對一私訊才可使用明確授權的工具。群聊仍可透過受限發送器聊天、發 GIF／表情與已知本服貼圖。
