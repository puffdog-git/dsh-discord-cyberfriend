# 個人帳號狀態與活動（2026-11-12）

使用者帳號頁新增「帳號狀態與活動」卡片。

1. 開啟「由插件管理帳號外觀」。預設關閉，避免升級時覆蓋原有 Discord 外觀。
2. 設定上線／閒置／請勿打擾／隱藏。
3. 選擇活動類型：不顯示、正在遊玩、正在聆聽、正在觀看、正在競賽，並輸入文字。
4. 可另外設定自訂狀態文字及一個 Unicode 表情或 Discord 自訂表情代碼。
5. 儲存後即時套用；登入／Gateway 重連恢復時自動重新套用。關閉管理只停止自動套用，不清除當前 Discord 外觀。

「不顯示活動」清除活動；自訂文字與表情皆留空時清除自訂狀態。這些是帳號外觀設定，其他 Discord 登入裝置也可能同步變更。

「重新套用已儲存外觀」只作用於個人帳號；有外觀草稿、未連線、未啟用管理或僅觀察模式時停用。僅觀察模式仍可讀取狀態。

「讀取 Discord 狀態」透過套件的 Gateway 狀態及原生 fetch_settings 重新讀取；此連線狀態與帳號整體狀態可能不同。更新成功文字只表示請求已接受，不聲稱已從另一位使用者畫面確認。

## 接口與保護

- GET /api/discord-cyberfriend/presence：讀取；refresh=1 額外重新抓取 Discord 設定。
- POST /api/discord-cyberfriend/presence：transport 可選 user、bot、both，預設 user。各帳號分別回報，任一失敗則整體 ok=false。
- 單純切換 status 保留活動；完整外觀使用 activityType、activityText、customStatusText、customStatusEmoji。
- 持久儲存走 POST /config，回傳 liveResults.userPresence 區分已儲存、離線待套用與套用失敗。
- 沒有重新取得或更新 Token；狀態更新不需要重新登入。
- 文字上限 128 字元、類型白名單及表情格式驗證。Python 層再次驗證，僅觀察模式禁止修改。

## 驗證

111 項 Node 測試、72 項前端互動檢查、32 項 Python 測試、25 項隔離 REST 檢查通過。

實際連線驗證：設定儲存及套用成功；從 Gateway 讀到測試活動，從 Discord 設定讀到測試自訂文字與表情。最後已還原原設定及原外觀。沒有發送 Discord 訊息。

登入／RESUME 恢復、僅觀察禁止修改、狀態單獨更新保留活動、多帳號結果隔離等由測試覆蓋；沒有操作另一個 Discord 客戶端做肉眼顯示驗證。

證據：data/presence-live-verification.json。
