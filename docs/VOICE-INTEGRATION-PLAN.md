# 外部 TTS／音樂與 Discord 語音整合方案

2026-11-12 初始規劃。使用者後續已授權實作；目前完成範圍與驗證請看 [VOICE-FEATURES.md](./VOICE-FEATURES.md)。下文保留當時技術調查，並非最新安裝狀態。收聽／STT、同時混音與串流 TTS adapter 尚未實作。

## 已安裝介面

- dsh-xiaomi-tts 5.2.2：公開 host service `ctx.speechSynthesis` 提供 `capabilities()`、`synthesize()`、`exportAudio()` 與 `registerDelivery()`／`deliver()`。合成回傳 Buffer、格式與時長，不必經桌面喇叭。支援 AbortSignal、單次聲音／語氣、時長限制與受管理暫存檔。
- 瀏覽器 `ctx.xiaomiMimoTts.play()` 只播放到瀏覽器，不能直接當 Discord 發話。不複製 TTS API Key／私有供應商請求。
- dsh-music-panel 0.26.0：本機 `/music/stream?path=...` 支援 Range；線上 `/music/online/stream` 為現有代理。`music_control` 控制瀏覽器播放器，不會路由音訊到 Discord。需要公開音訊來源／host 服務，不能拿桌面 loopback 或麥克風錄音替代。
- 本插件兩種 transport 都沒有語音加入／收發能力。

## 傳輸選擇

目前 Discord 語音要求 DAVE，不能沿用舊式連線範例：[官方最低版本說明](https://support.discord.com/hc/en-us/articles/38025123604631-Minimum-Client-Version-Requirements-for-Voice-Chat)。

Bot 可評估 [@discordjs/voice](https://discord.js.org/docs/packages/voice/main)，透過現有 Gateway adapter 接 VOICE_STATE_UPDATE／VOICE_SERVER_UPDATE、送 op 4，補 GUILD_VOICE_STATES intent。現行套件要求 Node >=24.17.0；外部 Node 26.13 符合，但 DSH 內嵌 runtime 尚未確認。必要時使用獨立 voice worker。

個人帳號可隔離評估維護者的 [discord-native-voice](https://github.com/dolfies/discord-native-voice)：支援 discord.py-self、DAVE、音訊來源及收發，仍在開發中。需另驗目前固定的 discord.py-self 2.1.0、Windows wheel、FFmpeg、斷線恢復。它不要求 PyNaCl，不能因目前未安裝 PyNaCl 就判定不可行。

## 分階段方案

1. **只輸出語音**：明確授權的加入／離開／停止，限定房間與最大時長。註冊 TTS delivery adapter，將既有文字回覆轉音訊，再送入指定 transport。失敗留文字退路。
2. **佇列與混音**：一次一段、可取消打斷；說話時降低音樂音量，結束恢復；音量限制、閒置離線、暫存清理。沿音樂插件權限與代理，不複製憑證。
3. **自願開啟收聽**：VAD、外部 STT、依實際 speaker ID 分流，處理回音、重疊及中途打斷。預設不收聽、不留原始錄音；聲音相似不能授予管理者權限。
4. **沿用人格與記憶**：共用 DSH 工作區／會話、對象偏好與安全政策。審稿核准後才合成；確定播放才記成送達。中斷／回執不明不自動重播。

## UI、預算與驗證

獨立語音頁顯示房間、連線／說話／音樂狀態、加入／離開／停止、允許房間、聲音提供者、音量／時長及是否同步文字。只有支援的能力才顯示可操作控制。

TTS 字數、音訊秒數、STT 時長須與 LLM Token 分開統計。這批預算不能冒稱涵蓋 TTS／音樂成本。沒取得實際 usage／定價前不顯示虛構金額。

先用 mock 和本機音訊檔測佇列、取消、混音與清理，再於指定測試房驗證兩種帳號；不自動跟隨陌生人、加入使用中的房間或播放測試音效。
