# 訊息、論壇與原生互動

2026-11-13。此文件涵蓋使用者指定的「使用者高～中、Bot高～中高」功能，以及追加的兩種帳號論壇／媒體貼文、標籤與封存功能。均以模擬驗證；未進行新帳號實測。

## 入口與開關

- 「聊天快取 → 允許 AI 查詢目前頻道置頂」同時控制限定歷史搜尋、置頂、目前頻道／論壇標籤、貼文索引、公開封存討論串與成員查詢。原設定名稱保留，說明已更新。預設關閉。
- 新增「訊息與論壇」分區，提供操作設定與「訊息、論壇與討論串工作台」。先選帳號、填來源頻道，再選查詢或操作。這是原插件內的介面，不新增外部插件。
- 「允許管理者確認訊息與討論串操作」預設關閉。只允許已設定的管理者 ID，且模擬模式／使用者帳號僅觀察模式禁止寫入。
- 原生轉傳另需設定「允許原生轉傳的目的頻道 ID」，預設空白；只能同伺服器，不允許私訊轉公開。
- Bot 的「原生互動與訊息右鍵選單」預設關閉；需搭配既有斜線指令註冊開關才會註冊指令。既有 Bot／使用者發送、語音、金鑰與 Intent 設定保留。

AI 查詢／提出操作使用既有 DSH 正式會話工具；沒有正式會話的直接模型模式仍可從工作台手動操作，不會另造工具執行引擎。

## 共用能力

|功能|使用者帳號|Bot|
|---|---|---|
|限定歷史搜尋|SDK Messageable.search|官方 guild search，必帶目前頻道過濾|
|置頂讀取|SDK pins iterator|新版 Channel Pins API|
|置頂／取消置頂|SDK Message.pin/unpin|新版 pin API|
|自己的文字修改／撤回|SDK Message.edit/delete|REST PATCH/DELETE，重核作者|
|原生轉傳|SDK PartialMessage.forward|message_reference FORWARD 原生快照|
|討論串加入／離開|SDK Thread.join/leave|thread-members/@me|
|討論串成員|SDK fetch_members，最多輸出50筆|單次最多50筆|
|論壇／媒體頻道標籤|SDK ForumChannel，type15/16共用|Channel available_tags|
|目前貼文索引|SDK 已下發快取，介面明示可能不完整|讀同伺服器 active thread metadata 後僅保留指定父頻道|
|讀取一篇貼文內容|核對父頻道／伺服器後，讀該篇最近20則|同左|
|公開封存貼文／討論串|單次 bounded archived_threads|public archived endpoint|
|論壇／媒體貼文建立|SDK ForumChannel.create_thread|forum/media thread endpoint|
|修改名稱、套用／清除既有標籤、封存／解除封存|SDK Thread.edit|PATCH channel|

新增建立入口目前提供文字內容與既有標籤，沒有另造媒體檔案選取／上傳器；媒體頻道存取與權限仍依 Discord 規則。不是建立／刪除整個標籤目錄或管理伺服器權限。

搜尋預設近30天，可指定最多366天，每次最多20筆；不全服訊息爬取、不自動分頁。Bot 需要讀取歷史與 Message Content Intent，索引未就緒不假稱沒有結果。貼文內容須提供 postId，且 parentId 必須是目前允許的父頻道。若已在貼文內，可直接以該討論串作來源頻道操作；也可從父頻道指定 postId 來加入／離開、改標籤或封存。

## 寫入與回執

寫入一律先預覽，再由管理者明確確認；AI只有 prepare 工具，沒有 confirm 工具。預覽最多保存100筆、5分鐘有效、單次使用，綁定帳號、使用者、頻道與伺服器。確認時重新核對來源內容／作者／附件摘要、頻道與標籤、目的地允許清單、目前設定；新來源政策或帳號切換會拒絕。

回執先保存再呼叫外部寫入，最多500筆；running／uncertain不被自動清除。逾時後不把晚回覆提升為成功，也不自動重送；仍在後端執行時不能人工解除鎖定。重載時 running 轉 uncertain。成功、明確HTTP拒絕、結果不明及人工核對分開顯示。人工核對只解除工作流鎖定，不宣稱原操作成功。回執保存失敗會阻止新寫入或保守回報不明；回執損壞只停用這個寫入功能，不拖垮一般聊天／查詢。

Discord 沒有訊息修改的 CAS 交易介面；雖然已在執行前重讀核對，最後核對到遠端寫入之間仍存在競態。傳輸層／SDK原有的官方限流處理與本工作流重新執行是不同層次；本工作流不盲目重跑結果不明的操作。

## Bot 原生互動

除了原有 help/status/reset，新增：

- /cyberfriend-ask：沿用原人格、ReplyGate、配額、模型、待審、TTS流程。先defer，再更新進度；不另造AI引擎，不把interaction ID當成可引用的Discord訊息。
- /cyberfriend-voice：目前綁定語音房的狀態、停止、既有紀錄重播；不自行加入房間。
- /cyberfriend-music：探索可回傳音訊的來源、搜尋、將曲目交原音樂佇列及停止；不接受任意檔案／網址，不把電腦播放當成Discord交付。
- /cyberfriend-topics：只列目前操作者／帳號／頻道的未答話題，經原有話題預覽與確認處理重新回答或結束。
- /cyberfriend-actions：選擇本範圍待確認操作，看到完整預覽後才提供確認；內容太長改由工作台完整核對，不讓截斷預覽直接授權。
- 訊息右鍵：DSH朗讀訊息、DSH解釋訊息、DSH重新回答、DSH修改Bot回覆、DSH撤回Bot回覆、DSH管理訊息。
- 使用者右鍵：DSH成員資訊，只使用本次Discord提供的名稱與ID，不擷取私人個人檔案。

按鈕、選單、表單使用5分鐘一次性opaque ticket，綁定原操作者、帳號與頻道，不能代他人點擊。修改表單立即回modal；其他長工作先defer，再編輯原互動回覆。interaction token只在當次handler參數中使用，不保存、不記錄。HTTP回應失敗不假稱成功。指令註冊依(type,name)辨識，逐個新增／更新，不整批覆蓋其他應用的命令。

原生提問來源保存在既有聊天快取與正式DSH會話；後續話題操作核對帳號、作者、摘要與更正／忘記政策，不向Discord要求不存在的interaction訊息。快取被清除或到期後，須重新提問；不補造來源。獨立的原生提問不與其他訊息合併成一個來源。

## 來源政策與外部插件

查詢、貼文內容、右鍵解釋／重答遵守既有更正／忘記政策；更正後只提供新內容，忘記後不重新帶回。操作已有來源政策的原訊息會要求人工核對。文字與圖片／貼圖理解、朗讀、記憶、心情、音樂與翻唱仍走原有服務與插件；不把它們搬進Discord。

## API與工具

管理API沿用宿主驗證與寫入來源檢查：GET /channel-actions；POST /channel-actions/query、preview、confirm、acknowledge。confirm與acknowledge必須 confirmed:true。回執只持久保存必要metadata，不保存正文、金鑰或interaction token。

工具：discord_cyberfriend_channel_query（唯讀）、discord_cyberfriend_channel_prepare（管理者預覽）；既有 read_pins 保留相容性。工具從正在執行的DSH會話取得帳號／操作者／頻道，不接受模型指定另一個來源範圍。

## 驗證

390 Node／65 Python／97 client smoke通過。實index模擬驗證原生ask→原Gate／Responder、原生提問來源快取、工作台API預覽→單次確認；使用者STT→模型→增量TTS／PCM與真本機FFmpeg回歸通過。UI繁簡／390px、開關保存、論壇索引→貼文讀取、子貼文封存確認、使用者建立論壇貼文均以攔截端驗證。116個面板、434個狀態、238次互動無未回應按鈕／JS錯誤。

沒有測試用真實Discord外送、新帳號登入、付費API、真實記憶寫入或真實排程。本批是契約／主流程與UI模擬通過，不等於Discord端權限、網路與聽感的實帳驗收。

官方接口：[Message](https://docs.discord.com/developers/resources/message)、[Channel](https://docs.discord.com/developers/resources/channel)、[Interactions](https://docs.discord.com/developers/interactions/receiving-and-responding)。使用者端固定discord.py-self 2.1.0，媒體channel16由其ForumChannel處理。
