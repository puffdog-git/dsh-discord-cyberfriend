# Typing 與用戶端實作評估

日期：2026-11-11；評估對象為本機實際安裝的 discord.py-self 2.1.0。

## 結論

沿用 discord.py-self 的原生網路層與 typing 實作。Discord 賽博群友 是 DSH 與此套件之間的橋接，不是另一個獨立的防偵測引擎，沒有可比較的兩套防偵測成功率。

目前可以比較的是實作是否重複、額外請求與等待、生命週期清理。這些指標不等於能否避開 Discord 的帳號判定；未做防偵測成功率或跨方案 CPU／延遲 A/B 基準測試。

| 項目 | 插件原先狀態 | discord.py-self／此次採用 |
| --- | --- | --- |
| Token 登入 | Python 橋接呼叫 Client.start | 保留原生登入及協定處理，不另外拼 IDENTIFY |
| 用戶端資訊／網路行為 | 舊 JS 設定仍有不生效的版本覆寫欄位；Python 橋接未使用 | 保留已生效的 upstream Headers.default 與 curl_cffi session；不疊加舊版本欄位 |
| 網路資源 | 一個長存 Python 程序 | 共用 upstream session；不為每則訊息建立新程序／新 client |
| typing | sendTyping 為空操作，所以完全不顯示 | 使用 channel.typing() 原生非同步 context，在模型生成時開始 |
| typing 更新 | 未實作 | 原生約每 5 秒更新；同一頻道多個回覆共用一個 context |
| 額外延遲 | 原有回覆延遲設定 1–4 秒（由使用者設定） | 保留使用者設定；typing 本身不再添加一段假打字等待 |
| 任務清理 | 未實作 typing 工作 | 完成、NO_REPLY、模型錯誤、發送錯誤、關閉開關、斷線均清理；孤立工作最多 120 秒 |

原生網路層已在之前成功的真實 Token／AI 私訊測試中使用，因此沒有必要再「加入另一套 account automation detection」。此次新增的是原生 typing 的橋接與減少重複工作的管理。

## Typing 行為

- 「使用者帳號 → 回覆時顯示正在輸入」預設開啟。
- 在模型生成之前啟動，和模型生成並行，typing API 失敗不阻擋文字回覆。
- 同一對話的並行回覆取得獨立租約，共用一個更新工作；最後一個回覆完成才停止更新。
- 演練、僅觀察、關閉自動回覆或 typing 開關時不會由 AI 啟動 typing；關閉設定會停止既有更新工作。
- 沒有協定層的「立即清除 typing」請求；停止表示停止續送，Discord 畫面可能到該狀態自然到期才清除。
- 手動發送工具可用 simulate_typing 控制一次 typing；不加入額外等待。
- 這是功能性的輸入狀態提示，不是驗證碼或帳號限制的繞過機制。

## 驗證

Python 測試直接使用已安裝套件的 Typing context，替換 HTTP 端點為隔離 fixture：兩個並行回覆只送一次初始 typing、最後租約結束時清理、啟動前取消不留下工作、設定切換會取消更新。Node 測試包含模型成功／失敗、NO_REPLY、發送失敗、演練及關閉 typing 等分支。

主要來源：

- [discord.py-self 2.1.0 的 HTTP 實作](https://github.com/dolfies/discord.py-self/blob/v2.1.0/discord/http.py)
- [discord.py-self 2.1.0 的 Typing context](https://github.com/dolfies/discord.py-self/blob/v2.1.0/discord/context_managers.py)
- 本插件 `bridge/worker.py`、`src/transport/pyself.js`、`src/features/responder.js`。

## 2026-11-13 全輸出路徑補查

已檢查文字／附件／GIF連結／貼圖、引用、表情、編輯刪除、typing、Presence 與語音輸出，使用者帳號均由 discord.py-self 執行。文字／表情／編輯刪除／Presence 共用 Python mutations lock；typing 有自己的租約工作，語音由 VoiceOutput 與 SDK 語音封包路徑執行，不共用文字發送佇列。不是每種輸出皆有同一段人工延遲，也沒有統一「防偵測通過」判定。

SDK 外的例外是設定頁 Token 檢查：Node 直接 GET /users/@me，屬明確觸發的唯讀診斷，非訊息／語音輸出。Bot transport 與媒體／TTS／LLM 網路請求需按身分與用途另行區分。

「Prevents user account automation detection」是上游 README 的功能描述，不是保證。Discord 官方仍禁止一般使用者帳號自動化，見 [官方說明](https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots)。本輪未新增規避偵測的行為或對真實 Discord 做偵測實驗。

本輪 Python43／Node pyself12項隔離回歸全部通過，未外送、未進房，正式執行程式未改，不需要重啟宿主。完整操作對照見開發工作區 `Discord-使用者帳號輸出路徑檢查-2026-11-13.md`。
