# 媒體辨識與 KLIPY 回覆

日期：2026-11-11（UTC+8）。此更新僅修改 Discord 賽博群友。

## 收到圖片時

- PNG／JPEG／WebP Discord 附件與支援來源的圖片連結會下載並轉為可送模型的 JPEG。
- GIF／動畫 WebP／APNG 使用 [Pillow](https://github.com/python-pillow/Pillow) 13.0.0，按播放時間取樣，包含第一格及最後一格。Pillow 處理 GIF 合成、透明與 disposal。預設最多 4 格，可設 2–6；重複時間取樣可能得到較少格。
- `<:名稱:ID>` 與 `<a:名稱:ID>` 會以 ID 取得 Discord CDN 表情圖片，動畫表情也抽幀。Unicode emoji 仍以文字處理。貼圖 sticker 的既有名稱／描述理解保持原行為。
- 每則最多 3 個媒體、合計最多 6 格。每個下載最多 12 MiB；HTML 頁最多 2 MiB；每張最多 1600 萬像素、每段最多 300 格／累計解碼 2 億像素。動畫長邊 512，靜態長邊 1280。下載及整批處理期限 18 秒，單次 Python 解碼 6 秒，全插件最多 2 個並行媒體作業。
- 僅 HTTPS、已列出的 Discord／Tenor／Giphy／KLIPY 媒體主機；重新導向也逐跳檢查。未使用 Discord Token 下載公開媒體。Python 解碼是獨立短程序，不需要小號登入，因此 Bot 單獨在線也可辨識。
- KLIPY 分享頁可能 403，會使用 Discord 預覽提供的 CDN URL。必要時等待 700 ms 並讀取原訊息的最新預覽（最多等 2.5 秒）。MP4／WebM 本次不解碼；若僅取得靜態預覽，明確當單格圖片，不宣稱理解完整動作。
- GIF 的「送出」與「理解收到的畫面」是獨立開關。停用送出 GIF 不會停用看圖。

## 模型與 ModLens

實際讀取本機 DSH 程式確認：圖片必須先由 `ctx.get('attachments').saveImages()` 建立 durable attachment，再以 `{type:'image',attachment:ref}` 送入 LLM；不是把 base64 塞進文字 prompt。自訂 OpenAI 相容 API 則使用 `image_url` data URL。

`mediaVisionMode` 預設 `auto`：原生模型宣告支援 image 時直接使用；否則查找已註冊的 `modlens-原provider`（或 deepseek-official 的 legacy wrapper），確認同一 model 存在且支援 image，再使用包裝路徑。`modlens` 是優先使用包裝路徑，找不到時沿用目前模型；`native` 不另找包裝路徑。

本機安裝的 [ModLens](https://github.com/liustack/modlens) 3.27.3 提供此 DSH wrapper。插件沿用 ModLens 的視覺引擎、快取和既有授權，不讀寫其憑證，也不啟用新的 CLI 帳號重用。原模型仍負責人格及最後回覆。ModLens／圖片輸入不可用時，日誌顯示原因，提示模型只能根據文字資訊回答。

DSH 附件服務會保存準備好的圖片，ModLens 也可能使用其既有 evidence cache；並非只存在於插件記憶體。插件自身 history.json 不存 base64。媒體辨識會使用所選模型／ModLens 引擎的圖片用量。

看圖回覆另有 `mediaReplyTokens`（預設 1600），與一般回覆預算取較大值；一般文字仍為原設定。本次真實測試發現 high reasoning 在診斷用 240 tokens 時會在完成答案前停止，因此增加媒體分析空間，文字長度限制不變。

## 用 GIF 回覆

- 新預設為 Discord 的 KLIPY 搜尋；舊 `gifProvider:tenor` 自動正規化為 `klipy`，不再呼叫 Tenor API。無須新增 GIF API Key。自訂端點保留。
- Bot REST 與小號 Python HTTP 均使用 `/gifs/search`，provider=klipy、media_format=gif、locale 與設定一致。Discord 要求搜尋 limit 至少 20，再依插件結果數裁切。
- 模型決定是否輸出 `[GIF:簡短英文動作或情緒]`。實質問答必須先有文字；輕鬆情緒互動可只回 GIF。收到 GIF 不等於一定要回 GIF。關閉／無權限／未連線時不向模型提供 GIF 能力。
- 搜尋結果按來源排序選擇，略過該介面／頻道上次成功送出的相同連結。最多一張，GIF 白名單也套用於自動回覆。
- 直接送出原始分享網址供 Discord 預覽；不把 KLIPY 分享頁當檔案上傳，不移除 URL 參數。Bot Embed 文字與分享連結可並存。成功送出才計 GIF 次數；搜尋失敗會保留文字，若只產生 GIF 指令則再請模型產生純文字。
- 搜尋支援取消／逾時。編輯、刪除、停止回覆仍可取消待送訊息。

## 驗證證據與限制

- 70 項 Node 測試、24 項 Python 測試通過（媒體預算追加測試獨立重跑 12 項）；45 項前端 smoke、23 項隔離 REST smoke、host 載入／卸載通過。測試包含真實 Pillow 子程序、動畫顏色及 disposal、尺寸／流量限制、取消、重導向限制、兩種帳號的模型圖片內容、ModLens 同模型選路及 GIF 權限／文字備援。
- 已用目前 Bot 憑證對 Discord 做唯讀搜尋，HTTP 200，回傳 KLIPY 資料。production BotTransport → searchGifs → prepareGif 成功，18 格動畫取 4 格，約 473 ms。未發送測試 Discord 訊息。
- 舊 Tenor 分享連結實際取得 106 格動畫並抽出 4 格；其中一個舊 Discord CDN GIF 已 404，正確降級而非聲稱辨識成功。
- 實際 host 測試：`deepseek-account / deepseek-flash`、reasoningEffort=high，4 格成功送入原生圖片介面並回傳小貓站立、抬爪及黃色盆的描述。已目視核對抽出畫格，內容相符。
- 已註冊 `modlens-deepseek-account`，但目前模型宣告原生 image；ModLens 的 `shouldWrap`／`resolveModel` 主動排除此類模型。暫時切「優先 ModLens」再測也正確維持原生路徑，已恢復 auto。**ModLens 備援完成離線整合測試，目前模型沒有實際使用外部 ModLens 視覺引擎，不宣稱已實測其辨識品質或速度。**
- 首次查核小號 GatewayConnectError；使用者重載後兩者 connected。修正媒體預算後經已安裝的 DSH Desktop Restart 介面重啟（activeAgents=0），Bot／小號均自動恢復 connected。待使用者傳入新訊息驗證實際媒體收發。

重載後可由大號分別傳圖片、GIF、自訂表情，並要求一次 GIF 回覆。日誌 `media.frames` 表示媒體準備；`media.vision` 表示實際圖片數與模型路徑；`reply.sent` 才表示 Discord 已送出。

另有 `POST /api/discord-cyberfriend/test-media`，body 為 `{url:支援的圖片URL}`。只測圖片到模型，回傳抽幀數、圖片輸入數、provider/model 與描述，絕不發送 Discord 訊息。可用於區分下載／抽幀問題與外部模型問題。

## 來源與授權

- Pillow：[GitHub](https://github.com/python-pillow/Pillow)、[ImageSequence](https://pillow.readthedocs.io/en/stable/reference/ImageSequence.html)。MIT-CMU 授權副本見 [Pillow-LICENSE.txt](licenses/Pillow-LICENSE.txt)。安裝官方 cp312 win_amd64 wheel，核對 PyPI SHA256；沒有複製第三方抽幀腳本。
- [ModLens](https://github.com/liustack/modlens)：使用已安裝插件的公開 DSH provider；沒有複製或更改 ModLens 程式。
- [Discord September 8 patch notes](https://discord.com/blog/discord-patch-notes-september-8-2026) 記載 KLIPY 搜尋整合；[KLIPY 文件](https://docs.klipy.com/) 用於確認媒體網域。此插件使用 Discord 的搜尋介面，沒有另接 KLIPY Partner API。

## 2026-11-11 實測後修正

使用者確認自訂表情可辨識。12:34:55 UTC 的 GIF 失敗為 MEDIA_HTTP_404，並非大小／抽幀上限；12:35:17、12:35:48 UTC 的 106 格動畫在 Bot／小號均抽出 4 格。失效來源無法靠增加抽幀修復。

修正 Bot 原本每次 mention 都建討論串：短訊息／看圖／GIF 直接留原頻道；長內容或深入討論要求才進入模型分類，只有精確 THREAD 判定才建立。確認頻道為一般文字／公告頻道，已有討論串不另建；每頻道 30 分鐘最多一次分類，演練模式不建立。判斷失敗保留原頻道。

Python 抽幀失敗現在保留 INPUT_SIZE／PIXEL_LIMIT／ANIMATION_LIMIT／UNSUPPORTED_FORMAT 原因，不再全部顯示 DECODE_FAILED。14 項相關 Node 測試通過。需要重新載入插件；此次檢查時原宿主連接埠已停止服務，未宣稱新版已在線套用。

## 簽章預覽與 @ 後接話窗口

提供的 ConvertToGIF0.gif 完整簽章網址實測 HTTP 200、882124 bytes、12 格，成功抽出 4 格。舊訊息 content 是無簽章網址，imageUrl 的預覽才帶有效 ex/is/hm；原本只等待 KLIPY 預覽，現擴展到 Discord 附件／Tenor／Giphy。此次 404 原因可透過 Discord 補上的有效預覽修復，並非檔案過大。

新增 followupEnabled（預設 true）及 followupSeconds（預設 180）。伺服器成功 @ 回覆後建立每介面／連線／頻道的窗口；未 @ 訊息先由模型判斷是否仍在對話或延續議題，只有 YES 才按 mention 流程回覆，不依隨機閒聊機率或監控頻道。黑白名單、回覆開關、冷卻與配額仍生效。成功接話續期；無關訊息不續期；換連線不沿用。小號接收層同步開放有限窗口，避免訊息在進入模型前就被擋掉。

74 項 Node 測試通過，包含窗口隔離、到期、停用與模型判斷。實際未 @ 延續收發仍需由使用者傳入新訊息驗證。

更新線上驗證：新版已重啟，Bot／小號均 connected，接話窗口 enabled／180 秒。指定 GIF 的 4 格已實際送入 deepseek-account/deepseek-flash 並回傳粉髮動畫人物及細微構圖變化的描述。此 GIF 在 high reasoning、1600 tokens 時另碰到 max-tokens；本機 mediaReplyTokens 已調至 3200 後成功。一般文字回覆預算不變。診斷沒有發送 Discord 訊息。尚待實際「@ 後不再 @」訊息驗證。

## 接話對象與日常換話題修正

20:59（UTC+8）日誌確認「你洗澡了嗎」被 followup 分類拒絕，之後「我吃了」通過；不是冷卻。窗口現在保存最近交談者 ID：同一人沒有指定其他收件者而直接稱呼「你／妳／您／you」時承接，即使換日常話題。其他訊息由模型依對話對象、短句、省略主詞、日常話題轉換與上下文判斷；不再要求同議題。分類錯誤與模型判 NO 在日誌分開。模型不可用時僅對同一交談者的明確問句提供保守備援。

補充回覆角色規則：先答尚未被回答的問題，不把對方問「你」的事反問對方。25 項 followup／parity 測試通過，涵蓋同人換話題、不同人與明確 @ 他人。


### 2026-11-11：Discord CDN 附件連結更新

Discord 無簽章附件網址可能回 404，即使訊息預覽也沒有附上新網址。僅在 Discord attachments URL 下載回 403／404 時，透過現有 Bot／小號 REST 連線呼叫 `/attachments/refresh-urls`，驗證回傳網址仍為同來源、同附件路徑後重試一次。更新結果短期快取；CDN 下載不附帳號 Token。沒有改動抽幀上限。兩張原失敗 GIF 已分別成功取 4 幀；小號 G1 真實收發也已成功。
