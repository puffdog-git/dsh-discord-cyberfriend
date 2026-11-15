# 外部 TTS 插件模擬相容性

2026-11-13。這份紀錄針對 Discord 作為音訊消費端，不把外部插件的瀏覽器朗讀視為 Discord 已取得音訊。

| 插件 | 檢查版本／commit | 模擬結果 |
|---|---|---|
| [ppy-web/dsh-plugin-xiaomi-mimo-tts](https://github.com/ppy-web/dsh-plugin-xiaomi-mimo-tts)（套件 dsh-xiaomi-tts） | 5.3.0／a45b46f5304b29e7db350ad6f119e87bf734017a | 可經 speechSynthesis 宿主服務回傳 WAV，再由 Discord 轉成 Opus 播放 |
| [Yuuyuko-uu/dsh-tts-bridge](https://github.com/Yuuyuko-uu/dsh-tts-bridge) | 1.3.3／02060a151ade616cbc69a89a8dd63728417408d8 | 文字排隊與擴充回執正常；沒有音訊回傳接口，不能直接當 Discord 的 TTS 音源 |

## 小米插件

使用其真實 HostSpeechService 原始碼，保留文字預處理、Provider 請求構造、音訊解碼、時長與錯誤處理。以 undici MockAgent 取代最終雲端 API，禁用真實網路，使用測試用假金鑰及人工產生的 2 秒 WAV；未讀取正式憑證。

Discord 實際 DiscordTts → 小米 HostSpeechService → 模擬 API → WAV 路徑通過。確認音色及語氣各自傳遞；小米會正規化標點，但中文字與結尾保留，語氣沒有混入朗讀正文。接著以實際 DiscordVoice 佇列、FFmpeg 轉碼送到播放替身，收到包含 OpusHead 的 Ogg，約 1.994 秒。

另確認 401 不自動換 Provider 重送、損毀音訊拒絕、超過請求時長拒絕、請求前取消不發起合成、缺金鑰時未就緒並阻止合成。共五次 Provider 請求皆由 MockAgent 處理，沒有網際網路合成請求。

本次測的是完整 WAV 合成及交付，沒有測小米 PCM 串流、其他內建 Provider、瀏覽器語音或真實帳戶品質。上游標示 Node >=24.9／DSH 0.2.2 系列相依需求；隔離來源測試使用 Node 22.22.1，通過不代表覆蓋其完整發行環境安裝要求。

**多插件並存限制**：Discord 現有 auto／service 選擇會先找 dshTts，再找 speechSynthesis。這次隔離測試只提供小米 speechSynthesis，證明該路徑可用；若我們自己的 dshTts 同時存在，仍優先使用它。現有 service 選項不能再以名稱指定是哪套服務，不宣稱兩套同裝時已自動切到小米。

## 朗讀橋

載入其真實 lib/index.js，執行真正的 /say → /next → /playing → /ack 路由與文字佇列；使用隔離 DSH_HOME、假會話與擴充替身。僅將啟動時的 node:http createServer 換成不綁埠的替身，未開啟實際瀏覽器、DeepSeek 網頁或固定本機連接埠。插件可能輸出「本機接口已就位」日誌，那是本測試的監聽替身，不是正式服務已啟動。

/next 回傳文字及項目 ID，/ack 接受完成狀態；它沒有把 WAV／MP3／PCM 或音訊 URL 回傳給 Discord，也未提供 speechSynthesis 服務。Discord 在沒有其他 TTS 服務時保持未就緒並拒絕合成，不會把排隊成功誤認成有聲音。

若未來要相容，需要朗讀橋／瀏覽器擴充提供具有工作關聯的音訊匯出、取消及完整性回執，再由 Discord 消費；單純新增一個呼叫 /say 的適配器不足以完成語音交付。本次只做模擬驗證，沒有修改第三方插件、捕捉系統音效或實作該擴充。

## 證據與界線

開發工作區 `.audit/external-tts-compat.mjs` 及 `.json` 記錄此輪結果。實際使用上游程式及真實本機轉碼，但合成內容為測試波形；沒有驗收真實聲音、平台接收或真人聽感。正式 DSH 設定及插件開關未修改，沒有重啟宿主、付費 API、LLM 呼叫或 Discord 外送。
