# 互動與外部能力

2026-11-13。本插件管理 Discord 訊息、權限與音訊交付；人格、心情、記憶、搜尋、下載、翻唱與 TTS 引擎由各自插件負責。

## 訊息協調

同一使用者在同一對話連發文字，預設等待 650 ms 合併，最長等候 3 秒；最多 8 則、12,000 字。真人語音輸入不等待這個文字合併視窗。生成中補充會取消舊生成並重新理解；已開始交付便不重送。取消無法證明外部平台沒有接收時顯示結果不明。

同一來源由兩個帳號接收，預設只有一方回覆。明確提及優先，其次私訊、追問、閒聊；不同人格確實需要各自回覆時可設定獨立帳號身份。群聊追問保存多位參與者，不將另一人加入視為清空原使用者；明確回覆別人的訊息不直接搶答。診斷只保存有限訊息 ID、階段及原因，不複製正文。

## 心情

原生 DSH Agent 沿用已載入 dsh-feiyu-mood 的注入規則。自訂模型可啟用唯讀快照適配，依明確音色槽／會話綁定／工作區匹配，不使用全域 lastActive 借用其他對話心情。不複製私人事件理由，不自行產生新心情。

目前適配已安裝 0.9.3 的 0–100 維度、衰減、注入模式、信心門檻與更新／頻次限制，亦讀舊格式。自訂快照以本插件檢查點避免重複；這不是與外部插件共用的原子配額交易。診斷可顯示綁定快照是否可讀；不等於外部插件已執行新一輪心情判斷。

## 唯讀知識工具

各對象設定的「自動接入外部唯讀知識工具」依真實 DSH 工具目錄探索。已知 free-search 的 multi_search 與 memewiki 的 search_meme_wiki 可接入。其他工具需宣告 readOnlyHint:true、非 destructiveHint，並具知識檢索用途。群聊另需 dataScope:public；未知／私人範圍只限管理者私訊。SQL、任意執行、檔案與寫入工具不自動放行。

建議第三方工具 annotations 使用 `{readOnlyHint:true, destructiveHint:false, knowledgeSource:true, dataScope:'public'}`。只有符合契約且已載入的工具才自動加入當次原生 Agent 白名單；不代表所有插件、所有資料庫都可無條件執行。

## 對話模式與 DSH 排程

「陪伴與訊息診斷」提供正常／只聽／文字優先／安靜陪伴及期限。夜間設定以 Asia/Taipei 判斷，仍可文字回覆；夜間與安靜陪伴不執行主動關心。

延後回覆、一次主動關心使用 DSH schedule 服務的一次性工作，須已有正式會話與可重新讀取的來源訊息。到期重新核對來源、帳號、會話、工作區、授權與開關。沒有新增另一套常駐排程器；宿主到期喚醒及回覆可能各自消耗模型額度。

主動關心預設關閉。對方須在原對話輸入 `!陪伴 同意`，以 `!陪伴 停止` 撤回；模擬事件不能授予同意。管理介面只可代管理者本人確認。每日上限預設 1；上次關心後沒有新回覆便不再追問。重新啟動時執行中的工作標記結果不明，不自行重跑。可取消、清理已結束工作；已新增固定句型的自然語言延後／取消與未答話題；仍需來源與時間預覽、一次確認碼，見 [操作說明](CONVERSATION-ACTIONS.md)。任意時間敘述不直接建立排程。

## 更正／忘記來源

記憶輸出分區提供來源頻道／訊息 ID → 預覽各層範圍 → 明確確認 → 每層回執。更正／忘記處理本插件聊天快取、來源事件及自有衍生匯出，保存來源政策避免重新匯入；來源變更後舊預覽失效。

Discord 原訊息、DSH 正式會話、已入庫的外部記憶、其他輸出／備份不會自動刪除。因此回執可為「部分完成」，不能視為跨插件永久抹除；需依回執另外維護外部副本。未對私人記憶執行測試清除。

## 音訊重播

可選啟用已完成音訊快取。只在 RAM 保存最多 8 項、合計 32 MiB、單項 16 MiB，3 分鐘到期；重啟消失。引用剛才 AI 回覆並說「剛才沒聽清楚」可重播，或在語音控制台操作。不重新合成、不重新翻譯；仍受房間／帳號／權限隔離及播放時長配額限制。未保留或過期便明確告知，不自行重新付費合成。

## 音樂能力接口

### YouTube 點歌

啟用新版 `dsh-ytdlp` 後，來源清單會顯示 `plugin:youtube` 與 `available:true`。
在對應對象設定開啟「允許 AI 點歌」，並先在語音控制台加入房間、綁定發話的文字頻道，
即可說「從 YouTube 找 Cheel 的 Blue Dream，在語音房播放」。
AI 依序使用 `discord_cyberfriend_music_sources`、`discord_cyberfriend_music_search`
（provider=`plugin:youtube`、query=歌名／歌手），再將搜尋結果 id 交給 `discord_cyberfriend_music_play`。
不會自動加入房間；queued 只代表排隊，實際結果見語音控制台。

下載器透過 `youtubeMusic` 宿主服務提供搜尋與音訊，不把音訊內容放進模型工具結果。
搜尋最多五筆；拒絕直播與超過 30 分鐘的曲目；音訊上限 64 MiB、載入最多 120 秒，
播放仍受原本語音配額限制。使用原公開網路 DNS 固定代理，不使用登入 cookies，
不繞過地區、登入或網站限制；取消或失敗會清理專用暫存目錄。
YouTube 限流或格式不可用時會明確失敗，不會把下載或排隊當成完成播放。

### 其他音樂來源

未來 KKBOX、Spotify 等插件也可使用下列通用接口；來源須依法且依服務授權取得實際音訊。
只有曲目資料、網頁網址或官方播放器遙控能力不足以送音訊進 Discord。

DSH 可探索宣告可回傳音訊的來源，而不是逐家增加播放器代碼。Discord 對外提供 `discordMusic.register(provider)` 服務（亦可由本機公開物件 registerMusicProvider 使用）；register 回傳卸載函數。

```js
const remove = ctx.get('discordMusic').register({
  id: 'my-music', name: '我的音樂來源',
  async search(query, {signal}) { return [{id: 'track-1', title: '曲目'}] },
  async load(id, {signal, workspace}) { return {audioBase64: '...'} }
});
ctx.on('dispose', remove);
```

也可讓工具宣告 annotations：readOnlyHint:true、destructiveHint:false、musicProvider:{audio:true,idField:'trackId',name:'來源'}，parameters.properties 宣告該曲目欄位。原生 Agent 用 discord_cyberfriend_music_sources/search/play，原有音樂面板路由仍保留。自動來源須有目前正式會話；只將已回傳音訊交付原綁定且已加入的房間。

支援 Buffer／Uint8Array、audioBase64、MCP audio block、目前工作區內檔案及有界 async stream；載入最多 120 秒、64 MiB。不任意抓 URL、不讀全域最新檔案。串流目前先收集後播放，不是無限電台即時轉送。只在電腦出聲的 music_control 或桌面播放器會標示未確認，不能自動轉成 Discord 音訊；本插件不錄製系統聲音。

## 唱歌

歌曲工作已合併至 Discord；只需獨立安裝下載器與翻唱引擎。管理者私訊、管理者群聊、特定群友 ID 各自授權，預設不擴權。固定工作流程委派下游階段，模型不因此獲得任意執行權。環境檢查只診斷、不下載或推理。

自訓聲音導覽位於「唱歌與翻唱 → 使用自己訓練的聲音」，連結 [dsh-train-pipeline](https://github.com/InariNGT-Ofiicial/dsh-train-pipeline)，說明訓練／試聽、train_register、cover-pipeline 重新載入。詳見 SONG-WORKFLOW.md。

## 驗證界線

隔離測試使用真實主程式、閘門、會話綁定、來源匯出、安裝插件工具契約及 FFmpeg／Opus；模型、歌曲下載／歌聲引擎、STT 回覆及最終 Discord 連線以替身截取。Host 排程只驗證契約，不建立真實喚醒。沒有付費 API、私人資料清除、真歌下載或 Discord 測試外送；模擬通過不代表歌聲品質或所有第三方的真實服務皆已驗收。

## 外部記憶維護追加

已新增分開預覽／確認的外部單筆更正、忘記、刪除契約與執行回執。memU 內建更正／歸檔，歸檔不是永久刪除；其他插件仍需提供維護契約或在原插件操作。見 [完整說明](MEMORY-MAINTENANCE-CONTRACT.md)。
