---
name: discord-cover-flow
description: 協調獨立的 dsh-ytdlp、cover-pipeline 與 Discord，從指定歌曲來源製作翻唱試唱、確認後製作整曲，再交付附件或播放到已綁定語音房。適用翻唱工作，不用於一般 TTS 朗讀。
---

使用 `song_cover_create`、`song_cover_status`、`song_cover_cancel` 與 `song_cover_forget` 協調工作。下載、分離、換聲、混音與交付由各插件及工作管理器執行，不自行拼接 shell 命令替代它們。

## 開始前

- 確認目前會話能使用 Discord 內建的 `song_cover_*` 工作工具（建立、搜尋、狀態、取消、清理）。管理者私訊、管理者群聊與指定群友 ID 分開授權；Skill 不授予新權限。找歌與下載音源已內建在 Discord 插件；翻唱插件仍須載入；下游工具由固定工作流程委派，不必開放模型任意呼叫所有 video／cover 工具。不再需要獨立的 dsh-song-bridge。
- 有網址時，確認歌手、版本與完整長度。只有歌名時，用 `song_cover_search` 在 YouTube 找候選，請使用者確認是哪一首，再把該筆網址交給 `song_cover_create`；不要自己挑一首就開始。`music_control` 只排程播放器，不回傳可供翻唱的檔案。
- 來源須可取得並可使用。指定音色名稱與移調；TTS voice ID 不等於 DDSP 聲庫，不猜測二者能共用。
- 若要使用自己訓練的演唱聲音，參考 [dsh-train-pipeline](https://github.com/InariNGT-Ofiicial/dsh-train-pipeline)。完成訓練與試聽後，透過 train_register 登記模型及配套設定，再讓 cover-pipeline 重新載入音色；登記成功不代表聽感已通過。
- 若只做模擬，使用隔離測試或原工具 dry-run，不啟動真實下載、GPU 推理或 Discord 外送。預演成功不代表已有音訊。

## 試唱與整曲

1. 先以 `mode: preview` 建立最多 25 秒試唱。`destination: attachment` 回覆目前綁定頻道；`voice-room` 要求原語音功能已開啟、已加入允許房間，並綁定目前文字頻道。工作工具不會自行加入其他房間。
2. 回傳 queued 只表示接受工作。用回傳 id 查詢狀態；長工作可先回覆工作已建立，再按需要查詢，不反覆密集輪詢。
3. doctor 未通過時停止，不先下載素材或用假的成品繼續。驗證失敗、工具／帳號變更、取消及結果不明時，不重送附件或改發其他頻道。
4. 使用者明確聽過並接受試唱後，才以同一來源、音色與移調建立 `mode: full`，帶入 `approvedPreviewId` 與 `approveFull: true`。不得自行把技術檢查通過當作聽感同意。工作器會重新核對音源與模型指紋。
5. delivered 表示本機交付流程完成，不保證所有成員實際聽到。完整歌曲走一般附件或音樂佇列，不套用短句 TTS 的 60 秒上限。

## 工作管理

取消後可能需要等不支援取消的外部程序結束；cancelling 不是已停止。結果不明時先核對平台，避免重複發送。

只使用本工作明確回傳的成品；不抓全域最新檔案、不讀其他會話工作。使用者已取得成品且不再需要由該試唱製作整曲時，可按要求用 forget 清理已結束工作。工作狀態在重啟後不續跑，已有檔案留在該工作區的 `.dsh-song-jobs`。
