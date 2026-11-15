# 翻唱工作與 Discord 交付

2026-11-13。歌曲工作協調已合併至 Discord 插件，不再載入獨立 dsh-song-bridge。原版 dsh-cover-pipeline 1.1.3 與具 Windows 修正的 dsh-ytdlp 0.1.0 維持獨立；TTS 不包含下載、分離或歌聲轉換引擎。

## 工作流程

DSH 依 `discord-cover-flow` Skill 調度 `song_cover_create`，背景工作依序執行環境檢查、來源資訊、下載、試唱裁段、分離、選用移調、換聲、混音、技術驗收、Discord 交付。status、cancel、forget 限原會話及工作建立者；管理者可管理同會話工作。

預設最多 25 秒試唱，先裁音源再做分離。整曲要求同會話已交付的試唱、相同來源／音色／移調與明確確認，另比對音源及模型雜湊。技術驗收成功不代表使用者已認可聽感。

交付目的地由真實 Agent 綁定捕獲，不能由工具參數指定任意頻道。附件使用 MP3；語音房使用既有音樂佇列，且必須已加入與文字會話綁定的房間。最長來源 10 分鐘，交付上限 24 MiB；不套用短句 TTS 的 60 秒截段。來源超限直接拒絕。

單次只執行一個工作。工作檔案留在原工作區 `.dsh-song-jobs/<id>`，可清理已結束且本會話擁有的工作。取消會阻止後續階段；外部程序不接受取消時顯示 cancelling，待程序結束才釋放。發送結果不明不自動重送，重啟不自動續跑。

## 模擬驗收界線

Discord Node 測試 265／265、前端 smoke 97／97 通過。整合測試載入實際 ytdlp 與 cover 插件、啟動實際子程序、執行真 FFmpeg 及 Discord multipart／Opus 準備。下載器、MSST、DDSP、混音及品質檢查後端為明確替身；最後 HTTP 與語音連線介面截取，不對外發送。

已驗證試唱附件、確認後整曲播放、非零移調，以及 70 秒音訊不受短句 60 秒限制。也驗證驗收失敗、取消、跨會話、帳號變更、越界成品與缺少真實引擎時阻止下載或交付。這不證明真實翻唱品質、平台接收或真人聽感。

## 正式使用前仍需配置

- 在 cover-pipeline 配置真正 MSST／DDSP 執行環境及聲庫，不能使用測試替身。
- 在「唱歌與翻唱」分別啟用管理者私訊、管理者群聊，或填寫允許群友的使用者 ID。只委派固定階段，不需給模型任意 video／cover 權限。
- 語音房播放須原本允許並已加入房間；本次維持語音房功能關閉。
- 目前建立工作接受公開音源 URL，沒有新增只憑歌名搜尋的工具。先透過既有搜尋取得正確來源，再建立工作。

Skill 現隨 Discord 插件的 `skills/discord-cover-flow/SKILL.md` 發布，由原生提供者 `dsh-discord` 註冊，詳見 [技能目錄](SKILLS.md)。Skill 減少調度歧義與重試，不會加快 GPU 推理，也不繞過工具權限。

## 使用自己訓練的聲音

若想要用自己訓練的聲音，請參考 [dsh-train-pipeline](https://github.com/InariNGT-Ofiicial/dsh-train-pipeline)。完成訓練與短句試聽後，使用 train_register 登記模型及配套設定，再讓 cover-pipeline 重新載入音色。這是演唱聲庫流程，不等於一般 TTS 的音色 ID。UI 同步提供連結及操作說明。
