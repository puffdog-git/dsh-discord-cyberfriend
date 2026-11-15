# 外部記憶維護契約

此功能位於「記憶輸出 → 外部記憶維護能力與回執」。本插件來源清理與外部記憶操作分開預覽、分開確認、分開回報。更正單則來源不會直接把該段文字蓋到整筆外部推論記憶。

## 操作與結果

|操作|可接受的外部明確效果|意義|
|---|---|---|
|更正 correct|corrected|替換選定記憶的正文；需自行提供完整新正文|
|忘記 forget|archived / suppressed / deleted|依契約歸檔、停止召回或刪除此筆；介面顯示實際效果|
|永久刪除 delete|deleted|原插件明確回報已刪除指定記憶；不能以歸檔代替|

只有一般 ok、文字說成功、缺少 ID、作用域不符、回傳其他效果，均不當成操作完成。逾時、呼叫中斷、回執無法保存會標記「結果未確認」，保留鎖定，不自動重送。同一作用域、同一記憶在其他日記出現的回執也共用鎖定。

重新啟動時 prepared/running 外部操作轉為 uncertain。需先到原插件核對，才能按「我已到原插件核對」並再次確認解除鎖定；人工核對標記不是插件驗證成功。仍未結束的本機外部呼叫不能解除鎖定；晚到成功不會覆蓋 uncertain 紀錄。確認碼僅記憶體保存、五分鐘、一次有效；預覽與更新能力不執行修改。

## 目前內建與限制

- memU：依已安裝插件的公開 memu_private_list / memu_private_update / memu_private_archive 工具支援更正、歸檔。**沒有永久刪除契約**，不直接寫其資料庫、不呼叫內部 delete helper。更正正文依原工具描述限制50–170字。
- 需原日記的真實 DSH Agent 已載入，session header ID、cwd 及原記憶庫皆相符。插件不偽造 Agent、不建立或切換外部記憶庫；請在 DSH 開啟原會話後再操作。保留原工具自身作用域與權限檢查。
- 新 memU 寫入會透過唯讀目錄取得庫 ID，寫入回執附 maintenance.scopeKey/sessionId。舊回執缺少作用域，或 pending_review/未確認入庫，不能靠 ID 猜庫；需到原插件處理。
- memU 目前只讀取目錄前200筆，核對 ID／庫／目錄狀態，找不到會拒絕。目錄沒有完整正文修訂號、原子 compare-and-swap；不能宣稱阻止其他程序同時改寫正文。操作前請核對原插件，整筆替換需使用者明確確認。
- 喵記憶、魚的記憶、Prime、Mnemon、OpenViking、Hindsight、Soul 的既有輸出／捕獲相容保留。它們未註冊維護契約時會明示「到原插件操作」，不代表其原插件完全沒有維護功能；目前沒有冒稱逐一原生修改／刪除驗收。
- session 自動捕獲或 files 匯入後未提供精確記憶 ID/作用域的資料不能定位；不以關鍵字搜尋刪除、不清空整庫。DSH 正式會話、Discord 原訊息、其他插件、備份不在外部單筆操作範圍。

本地來源清理會先保留外部回執定位資料到 manifest.maintenanceReferences，再移除本地衍生檔；不會因為清掉匯出索引就遺失仍需核對的外部記憶。只保留 IDs、scope、session、cwd、evidence 與結果，不把外部正文、更正正文或原始服務錯誤寫進維護回執。

## 插件擴充介面

透過 ctx.get('discordMemoryMaintenance').contracts.register(adapter)，或 globalThis.__DSH_DISCORD_PYSELF_LAB__.registerMemoryMaintenanceAdapter(adapter) 註冊明確的維護介面，回傳解除註冊函式。這是本機插件契約，不授予模型任意修改工具。

adapter 欄位：id（對應 writer）、name、actions、可選 available()、inspect({reference,signal})、execute({reference,action,replacement,expectedRevision,signal})。

inspect 必須唯讀，回傳 {found:true,scopeKey,revision}；不得建立／改綁庫。execute 只操作 reference.memoryId，回傳 {status,ids:[reference.memoryId],scopeKey}；status 必須等於該 action 宣告的效果。支援原子版本檢查的插件應使用 expectedRevision 拒絕衝突。inspect 與 execute 均需遵守 AbortSignal；預設30秒未確認即鎖定，不假設遠端已停止。

寫入回執須為 stored/deduplicated，帶真實 ids、evidenceIds 與 maintenance:{version:1,scopeKey,sessionId}；artifact 需原 cwd。只有直接呼叫寫入函式不代表已提供維護契約。無任何依工具名稱推測刪除能力的自動探索。

確認前會重新核對回執指紋、原作用域、記憶快照與註冊的 adapter；介面改選目標、操作、正文會清除舊預覽。一次只處理一筆明確記憶，可能包含多個來源，預覽顯示來源數及整筆影響警示。

管理 API 沿用宿主驗證、Origin/FetchSite、JSON 保護：

- GET /memory-maintenance：契約、已知目標、分層回執；不呼叫外部插件讀取記憶。
- POST /memory-maintenance/external/preview：targetKey、action、可選 replacement。
- POST /memory-maintenance/external/apply：id、confirmed:true。
- POST /memory-maintenance/external/acknowledge：id、confirmed:true，僅記錄人工核對。

外部操作結果也出現在統一能力診斷中，metadata、模擬契約通過與實際操作結果分開。診斷只保留固定錯誤分類與建議，不保留原始服務錯誤或私人正文。

## 測試範圍

使用替身記憶插件、真本插件類別與管理 API 進行更正／忘記／刪除測試；memU 工具回傳依安裝版本的公開工具程式格式建立替身。驗證scope/ID/effect、預覽不修改、一次確認、逾時晚回、別名鎖定、重啟、磁碟失敗、原插件卸載、舊回執及本地清理保留指標。另有實際瀏覽器正向與繁簡／窄版驗證。沒有修改使用者真實記憶庫、付費模型、真排程或測試Discord外送。


## 靈樞 dsh-memory：待審更正與忘記（2026-11-15）

已加入 lingshu 直接寫入器與維護介面卡，使用安裝插件的公開工具，不直接改其資料庫。需要靈樞啟用 brain 工具集及 lingshu 相容別名，公開提供 lingshu_mdcg_whoami、lingshu_mdcg_get、lingshu_mdcg_remember、lingshu_cg。只有 core 工具集時顯示缺少維護工具，不假裝可用。memU 仍為預設，不會自動切換寫入器。

直接寫入後先核對精確 ID、正文及圖庫／租戶／操作者作用域，再保存可維護回執。只有 session 自動捕獲的舊記憶，沒有這類回執時仍需到靈樞處理；不按關鍵字猜測應刪哪筆。

更正保留原節點屬性，忘記是軟刪除／停止召回，均不提供永久刪除。操作不覆寫受保護節點、不自動核准審核。原插件回傳提案時顯示「等待原插件審核」，保存提案 ID 與更正正文的雜湊，鎖住重送，重啟後仍保留。此時不可用人工核對按鈕直接解除鎖定。

到原插件審核後，按「核對待審結果（不自動核准）」：只呼叫 records／verify_record 與精確記憶讀取；核對審核決定、作用域及實際正文／停止召回結果，才顯示已更正／已停止召回。拒絕、待審與不明結果各自顯示。逾時、工具替換、保存失敗、服務卸載皆不把晚到結果當成功。

新增管理 API：POST /memory-maintenance/external/reconcile，參數 {id}，只核對已存在的靈樞待審回執；沿用宿主驗證與來源防護，不接受任意記憶 ID。

實際安裝版 0.10.3 的公開工具及 Python MCP 後端，已在獨立臨時圖庫測過寫入 → 更正待審 → 測試人員核准 → 讀回一致，以及忘記待審 → 核准 → 停止召回。核准僅存在於隔離測試腳本，產品介面卡沒有審核決定呼叫。正式記憶庫沒有修改。

靈樞預覽會檢查正文與中繼資料修訂快照，但公開工具未提供原子 compare-and-swap；無法禁止其他程序在核對與提交之間改寫同一筆。最終讀回只證明核對當下相符，不保證之後不被其他寫入改變。
