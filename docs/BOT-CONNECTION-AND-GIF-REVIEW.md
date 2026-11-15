# Bot 連線及 GIF 理解檢查

日期：2026-11-11（UTC+8）。

## Bot 狀態與根因

即時 API 顯示 Bot「大肥魚」為 connected，Gateway ping 約 208–226 ms，連線持續超過 4 分鐘。19:27:43 成功登入；19:28:17、19:28:43 的 Bot 私訊都進入回覆流程，但被連續 5 輪上限擋下。

原輪數以對方 userId 為唯一鍵，因此大號與使用者小號的回覆也消耗了 Bot 的同一份輪數。這是回覆規則阻擋，不是 Bot Token 或 Gateway 失聯。

修正：連續輪數以接收 transport、原始 channelId、對方 userId 分開累計；跨 transport 發送或 Bot 開新討論串時，仍記回原始接收對話。保留總每日統計、配額、10 分鐘重置與指定對象冷卻豁免。舊混合輪數無法可靠歸屬各對話，不灌入新分組；舊每日統計保留。

驗證：54 項 Node 測試通過，包含小號滿 5 輪時 Bot／其他頻道不受影響、舊資料遷移、持久化／跨日保留、到期恢復與手動重置。需要重載插件以載入新的記帳邏輯。

已完成線上驗證：重載後 19:34:10 收到 Bot 私訊，19:34:17 成功送出模型回覆；使用者回報「ok」。目前 Bot 回覆正常。

## GIF 能力核對

以下是抽幀實作前的檢查結果；後續已新增圖片、動畫抽幀、ModLens 選路及 KLIPY 搜尋，最新行為見 [MEDIA-VISION-AND-KLIPY.md](MEDIA-VISION-AND-KLIPY.md)。

檢查了三份來源：GitHub 原版、DSH 原本的 Discord Hub、本機 Discord 賽博群友。

- [GitHub 原版 mentionReply.ts](https://github.com/Raxytw/dsh-discord-plugin/blob/main/src/duty/mentionReply.ts) 取用 rawMsg.content 組成文字提示。
- [GitHub 原版 llm.ts](https://github.com/Raxytw/dsh-discord-plugin/blob/main/src/lib/llm.ts) 的宿主呼叫只送 text content，其他模型呼叫同樣使用文字 prompt；沒有 GIF 抽幀或圖片 content part。
- 本機 Hub 的 src/gif.js 是 Tenor／自訂來源的 GIF 搜尋及發送，並非辨識器。
- Lab 新增名稱、附件 MIME、連結預覽標題／描述及 GIF 更新處理，可回應 GIF 分享，但模型輸入仍只有文字中繼資料。

因此「GIF 可以收到文字回覆」不等同於「模型看到 GIF 畫面」。本次沒有把原本存在的視覺功能移除；目前也沒有新增動畫辨識。要辨識動畫，需另行取得媒體、抽取多個畫格、接入支援圖片輸入的模型，並對超限／不支援模型提供明確狀態。
