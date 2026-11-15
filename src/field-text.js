// 設定欄位的白話標籤與說明。
//
// 這裡只覆寫顯示文字，不改變欄位的鍵、型別、預設值或任何行為。
// 寫法原則：說明這個設定做什麼、什麼時候該開、有什麼要注意；不寫實作細節
// （套件名、協定版本、內部流程），那些留在 docs/。未列在這裡的欄位沿用 config.js 的原文字。
export const FIELD_TEXT = {
  // ---- 基本設定
  adminUserId: {
    label: '管理者的 Discord 使用者 ID',
    help: '填你自己的使用者 ID。這個帳號會套用「管理者」的回覆設定，並可用表情叫 AI 停止、重答或解釋；其他人套用「其他使用者」設定。留空表示尚未綁定。',
  },
  enabled: { help: '總開關。關閉後使用者帳號與機器人都會登出並停止收發訊息。' },
  primaryTransport: {
    label: '主要使用的帳號',
    help: '同時連線使用者帳號與機器人時，沒有特別指定的操作預設用哪一個。',
  },
  replyTransport: {
    label: '自動回覆用哪個帳號',
    help: '「自動」表示誰收到訊息就由誰回覆；也可以固定由某一個帳號回覆。',
  },
  sendTransportDefault: {
    label: 'AI 主動發訊息用哪個帳號',
    help: 'AI 透過工具主動發訊息時預設使用的帳號。「自動」會先用主要帳號，未連線時改用另一個。',
  },

  // ---- 使用者帳號
  userEnabled: { label: '啟用使用者帳號', help: '允許以一般 Discord 帳號的 Token 連線。' },
  userAutoStart: { help: 'DSH 啟動後自動用已儲存的 Token 連線。預設關閉。' },
  userPythonExecutable: {
    label: 'Python 執行檔路徑（進階）',
    help: '一般留空，插件會使用你照安裝說明建立的 Python 環境。只有想改用自己另外準備的 Python 時才填完整路徑。',
  },
  userReceiveOnly: {
    label: '僅觀察（不發言）',
    help: '開啟時只接收訊息，不會發言、按表情或修改狀態，也不會讓 AI 產生回覆。第一次測試連線時建議保持開啟。',
  },
  userAutoReply: {
    label: '讓 AI 自動回覆',
    help: '需先關閉「僅觀察」。試跑模式開啟時，AI 只會產生回覆內容而不送出。',
  },
  userWatchDms: { label: '回覆私訊', help: '收到新私訊時交給回覆規則處理；仍受私訊回覆開關與每日上限限制。' },
  userChannelIds: {
    label: '參與閒聊的頻道',
    help: '只在這些頻道主動參與一般聊天。被直接 @ 或回覆時不需要列在這裡。',
  },
  userToken: {
    help: 'Discord 一般帳號的授權 Token（不是 Bot Token）。只儲存在這台電腦的插件設定檔。',
  },
  userAutoTakeoverEnabled: {
    label: '我親自回覆時暫停 AI',
    help: '你在手機或電腦上用這個帳號親自發言時，AI 會暫時停止在該對話回覆，避免兩邊同時說話。',
  },
  userAutoTakeoverMinutes: {
    label: '暫停多久（分鐘）',
    help: '每次你親自發言就重新計時。不會縮短已設定的暫停，也不會解除手動設定的無限期暫停。',
  },
  userInboxEnabled: {
    label: '收集待回覆訊息',
    help: '把新私訊與直接 @ 放進上方的待回覆清單。關閉後保留既有項目，但不會補收關閉期間的訊息。',
  },
  userPresenceEnabled: {
    label: '由插件設定帳號狀態',
    help: '開啟後由這裡決定線上狀態與活動文字，儲存即套用。關閉只是停止管理，Discord 上目前的狀態會保留。',
  },
  userActivityText: { help: '例如：Stardew Valley。最多 128 個字。' },
  userCustomStatusText: { help: '例如：今天想安靜聊天。最多 128 個字；文字與表情都留空會清除自訂狀態。' },
  userCustomStatusEmoji: { help: '貼上一個表情符號（例如 🐟），或 Discord 自訂表情代碼。' },
  userReconnect: {
    label: '斷線時自動重新連線',
    help: '網路短暫中斷時自動恢復連線。Token 失效時不會重試；斷線期間的訊息不會補發。',
  },
  userContextBootstrap: {
    label: '回覆前先讀近期對話',
    help: '回覆前讀取該頻道最近約 20 則訊息與被引用的內容，讓 AI 接得上話。不會因此回覆舊訊息。',
  },
  userSimulateTyping: {
    label: '回覆時顯示「正在輸入」',
    help: 'AI 產生回覆期間顯示正在輸入的提示。試跑與僅觀察模式不會顯示。',
  },
  userAutoCreateThreads: {
    label: '自動開討論串',
    help: '被 @ 且話題需要深入討論時，自動建立討論串。頻道不允許建立時會留在原頻道回覆。',
  },
  userThreadNameTemplate: { help: '可使用 {topic}（話題）、{author}（發問者）、{channel}（頻道）。' },
  userThreadArchiveMinutes: { help: '討論串閒置多久後自動封存。' },

  // ---- 機器人
  botEnabled: {
    label: '啟用機器人',
    help: '允許以 Bot Token 連線。機器人需已加入伺服器，並在 Developer Portal 開啟 Message Content Intent。',
  },
  botToken: { help: '在 Discord Developer Portal 的 Bot 頁面按 Reset Token 取得。' },
  botProxyUrl: { help: '選填。需要透過代理連線 Discord 時才填。' },
  botMessageContentIntent: {
    label: '讀取訊息內容（Message Content Intent）',
    help: '機器人讀取訊息內容的必要權限。需同時在 Developer Portal 開啟，否則收到的訊息會是空的。',
  },
  botNativeInteractions: {
    label: '斜線指令與右鍵選單功能',
    help: '提供提問、語音、音樂、話題等斜線指令，以及訊息右鍵的朗讀、解釋、重答。需同時開啟下方「註冊斜線指令」。',
  },
  botSlashCommands: {
    help: '登入時向 Discord 註冊斜線指令。Discord 同步全域指令需要一些時間才會出現。',
  },
  botContextBootstrap: {
    label: '回覆前先讀近期對話',
    help: '回覆前讀取該頻道最近約 20 則訊息與被引用的內容。機器人需要有讀取歷史訊息的權限。',
  },
  botMembersIntent: {
    label: '接收成員暱稱更新（Server Members Intent）',
    help: '需要即時更新成員暱稱時開啟。必須先在 Developer Portal 啟用同名權限，否則機器人會連線失敗。',
  },
  botAutoCreateThreads: {
    label: '自動開討論串',
    help: '被 @ 且話題需要深入討論時建立討論串；簡短問題與看圖留在原頻道。',
  },
  botThreadNameTemplate: { help: '可使用 {topic}（訊息開頭）、{user}（發問者）、{date}（日期）。' },
  botEmbedReplies: {
    label: '用卡片樣式回覆（Embed）',
    help: '機器人的回覆以帶標題與顏色的卡片呈現。使用者帳號不支援這種格式。',
  },
  botActivityText: { help: '例如「陪你聊天」。留空表示不顯示活動。' },

  // ---- 模型
  llmMode: {
    help: '「自動」會用 DSH 新對話目前使用的模型，失敗時改用下方的自訂 API。想固定用某個模型，選「DSH 訂閱模型」再填下面兩欄。',
  },
  subscriptionProvider: {
    label: '訂閱服務',
    help: 'DSH 已登入的模型服務代號。用 DSH 自帶的 DeepSeek 帳號就填 deepseek-account；清單裡會列出你的 DSH 目前有的服務。',
  },
  customLlmApiKey: { label: '自訂 API 金鑰', help: 'OpenAI 相容服務的金鑰。' },
  customLlmApiBase: {
    label: '自訂 API 網址',
    help: 'OpenAI 相容服務的網址，例如 https://api.deepseek.com 。',
  },
  maxReplyTokens: {
    label: '回覆長度上限',
    help: '單次回覆最多產生多少 token（約略等於字數）。會先思考再回答的模型，思考也算在裡面；設太小可能還沒寫出答案就用完。',
  },
  temperature: { label: '隨機度', help: '數值越高回覆越多變，越低越穩定。' },
  mediaVisionMode: {
    label: '圖片辨識方式',
    help: '「自動」會優先用目前模型本身的看圖能力；模型不支援時改用已安裝的看圖插件。',
  },
  mediaReplyTokens: {
    label: '看圖回覆的長度上限',
    help: '只在訊息附有圖片時使用。看圖需要較多分析空間，建議比一般回覆上限大。',
  },

  // ---- 會話與人格
  replyEngine: {
    label: '回覆方式',
    help: '「DSH 正式會話」會使用 DSH 的人格與記憶，建議使用。使用自訂 API 時只能選獨立模式。',
  },
  sessionWorkspaceRoot: {
    label: 'Discord 工作區存放目錄',
    help: '一般留空。共用工作區時，各頻道仍保留獨立會話；更改目錄會在下次使用時保留歷史遷移，舊會話保留。',
  },
  sessionWorkspaceGrouping: {
    label: '工作區分組方式',
    help: '同一登入帳號共用：私訊與所有群聊放在同一工作區，方便共用人格與之後的記憶；User 與 Bot 分開，各頻道會話仍獨立。已手動指定的工作區優先。舊外部記憶庫不會自動合併。',
  },
  adminSessionWorkspace: {
    help: '依對象分開模式下，管理者私訊使用的目錄；同帳號共用模式不使用此欄位。',
  },
  otherSessionWorkspace: {
    help: '依對象分開模式下，每位私訊使用者的工作區上層目錄；同帳號共用模式不使用此欄位。外部記憶隔離仍依記憶插件設定。',
  },
  archiveAdminMessages: {
    label: '把管理者的對話存進 DSH 會話',
    help: '保存插件收到的所有管理者訊息（包含沒有 @ AI 的），讓 DSH 的記憶功能可以使用。',
  },
  sessionAllowedTools: {
    label: '額外開放給 AI 的工具（進階）',
    help: '預設不開放任何工具。需要讓 AI 使用記憶插件的工具時，填入工具名稱。變更後需重新載入插件。',
  },
  feiyuMoodEnabled: {
    label: '自訂模型也讀取心情狀態',
    help: '使用自訂 API 時，讓 AI 參考心情插件目前的狀態摘要。使用 DSH 正式會話時由心情插件自己控制。',
  },
  feiyuMoodSlot: { label: '心情狀態代號（選填）', help: '一般留空。有多份心情狀態時，指定要讀哪一份。' },

  // ---- 對象設定
  dmReplyEnabled: {
    label: '回覆這類對象的私訊',
    help: '關閉後不會回覆這類對象傳來的私訊，下方的細部設定也會收起來。',
  },
  dmPersonaPrompt: { help: '私訊回覆時給 AI 的人格與說話方式指示。' },
  mentionReplyEnabled: { help: '在伺服器頻道被 @ 時自動回覆。' },
  mentionPersonaPrompt: { help: '被 @ 時給 AI 的人格與說話方式指示。' },
  followupEnabled: {
    help: '回覆之後的一段時間內，即使對方沒有再 @，AI 也會判斷是否還在同一段對話並接話。',
  },
  followupSeconds: { label: '持續接話的時間（秒）', help: '每次成功接話後重新計時。' },
  coChatEnabled: { label: '主動參與閒聊', help: '在指定頻道像群友一樣自然插話，不需要被 @。' },
  coChatProbability: { help: '每則訊息有多少機率讓 AI 考慮要不要插話。' },
  coChatMinHistoryMessages: { label: '累積幾則訊息才開始插話', help: '避免頻道剛開始聊就插話。' },
  coChatMaxMessageChars: { label: '插話長度上限', help: '插話內容最多幾個字。' },
  monitoredChannelIds: {
    label: '參與閒聊的頻道',
    help: '留空表示不主動閒聊。填入頻道 ID 後，只在這些頻道插話。',
  },
  coChatPersonaPrompt: { help: '閒聊插話時給 AI 的人格與說話方式指示。' },
  replyDeliveryMode: {
    label: '使用者帳號的回覆送出方式',
    help: '「先審稿」時 AI 的回覆只存成草稿，要你在「對話工作台」確認後才送出。只影響使用者帳號。',
  },
  replyChineseScript: {
    help: '把 AI 的回覆統一成繁體或簡體。與介面語言分開設定；程式碼、網址與日文不會被轉換。',
  },
  roundCapPerUser: {
    label: '對同一人連續回覆幾次後暫停',
    help: '避免和同一個人無止盡地來回。0 表示不限制。',
  },
  pluginPersonaEnabled: {
    label: '使用這裡設定的人格',
    help: '關閉後不使用本插件的人格文字，完全交給 DSH 的人格設定。',
  },
  pluginStyleEnabled: {
    label: '使用插件的口吻規則',
    help: '加入朋友口吻、簡短回答等額外要求。已使用 DSH 人格時建議關閉。',
  },
  antiAiFlavorPromptEnabled: { label: '提醒 AI 不要有 AI 腔', help: '在指示中要求 AI 避開制式客套話。' },
  antiAiFlavor: {
    label: '自動刪除 AI 腔的句子',
    help: '送出前移除「作為一個 AI…」「希望這對你有幫助」等制式語句。',
  },
  stripMarkdown: { help: '送出前移除粗體、標題等 Markdown 符號，讓回覆更像一般聊天。' },
  minReplyDelaySeconds: { help: '回覆前先等一下，看起來更像真人。' },
  gifEnabled: { label: '允許 AI 傳 GIF', help: '允許 AI 搜尋並傳送 GIF。' },
  gifVisionEnabled: { help: '讓 AI 看懂別人傳的 GIF。檔案太大或辨識失敗時只參考文字。' },
  imageVisionEnabled: { help: '讓 AI 看懂別人傳的圖片。每則訊息最多處理 3 張。' },
  emojiVisionEnabled: {
    label: '看懂自訂表情',
    help: '讓 AI 看到伺服器自訂表情的實際圖案；一般表情符號仍以文字理解。',
  },
  autoReactionEnabled: { help: '對會回覆的訊息，依機率隨機按一個表情。' },
  stickerUnderstandEnabled: {
    label: '看懂貼圖',
    help: '讓 AI 看到 PNG、APNG、GIF 與 Lottie 的抽樣畫面。Lottie 在本機轉圖；動畫需開啟 GIF 看圖。未安裝轉圖元件或轉圖失敗時只參考名稱，不假裝看過畫面。',
  },
  memeImagesEnabled: {
    label: '允許 AI 傳表情圖片',
    help: '讓 AI 從表情圖庫插件挑圖傳送。需先安裝並啟用表情圖庫插件。',
  },
  musicControlEnabled: {
    label: '允許 AI 點歌',
    help: '讓 AI 搜尋歌曲並排入目前已加入的語音房播放。不會自行加入其他語音房。',
  },
  knowledgeLookupEnabled: {
    label: '允許 AI 查詢知識庫',
    help: '讓 AI 使用已安裝的唯讀知識庫插件。群聊只會用公開資料；私人知識庫只在管理者私訊使用。',
  },
  webLookupEnabled: {
    label: '允許 AI 上網搜尋',
    help: '讓 AI 視問題需要上網查資料。需先安裝搜尋插件，並使用 DSH 正式會話。',
  },
  memeLookupEnabled: { label: '允許 AI 查梗', help: '讓 AI 查詢網路流行語的意思。需使用 DSH 正式會話。' },

  // ---- 名單與範圍、回覆配額
  replyIgnoreSelf: { help: '不回覆自己送出的訊息，避免自己跟自己對話。' },
  replyCooldownExemptUserIds: {
    label: '不受回覆間隔限制的使用者',
    help: '這些人的私訊與 @ 不需要等待冷卻時間。每日上限與黑白名單仍然有效。',
  },
  roundResetMinutes: {
    label: '多久沒回覆就重新計算連續次數（分鐘）',
    help: '距離上次回覆超過這段時間後，連續回覆次數歸零。',
  },
  whitelistUserIds: {
    label: '只回覆這些人（白名單）',
    help: '留空表示所有人都可以。填入後只回覆名單內的人；管理者不受限制。',
  },
  blacklistUserIds: { label: '不回覆這些人（黑名單）', help: '名單內的人一律不回覆，優先於白名單。' },
  monitoredGuildIds: {
    label: '只在這些伺服器回覆',
    help: '留空表示所有伺服器。填入後只在這些伺服器回覆；私訊不受影響。',
  },
  blacklistChannelIds: { label: '不回覆這些頻道', help: '名單內的頻道一律不回覆，也不主動插話。' },
  messageCoalesceEnabled: {
    label: '等對方把話說完再回覆',
    help: '對方短時間內連發多則訊息時，合併成一次回覆。',
  },
  messageCoalesceMs: { label: '等待時間（毫秒）', help: '最多等待 3 秒。' },
  replyOwnership: {
    label: '兩個帳號都收到訊息時由誰回覆',
    help: '使用者帳號與機器人在同一頻道時，避免兩個都回覆同一則訊息。',
  },

  // ---- 反應與貼圖
  autoReactionEmojis: {
    label: '表情池',
    help: 'AI 自動加表情時，從這裡隨機挑一個。留空則跟著群組的習慣：從大家最近在這個頻道與伺服器實際按過的表情裡挑（需要開啟「讓 AI 知道大家按了什麼表情」），還沒有紀錄時用幾個通用表情。可以看圖選擇一般表情或伺服器的自訂表情；自訂表情只能在原本的伺服器使用。',
  },
  reactionFollowEnabled: {
    label: '跟著別人按表情',
    help: '別人對訊息按了表情時，AI 有機率跟著按同一個，讓它看起來像一起參與。對方用的是別的伺服器的自訂表情（需要 Nitro 才能主動使用）也可以跟著按，因為跟按已經存在的反應不需要 Nitro。AI 只會「跟」，不會主動拿這些表情去按別的訊息。',
  },
  reactionFollowChance: {
    label: '跟著按的機率 (%)',
    help: '達到下面的人數門檻後，跟著按的機率。同一則訊息的同一個表情只會跟一次。',
  },
  reactionFollowMinCount: {
    label: '幾個人按了才跟',
    help: '同一個表情至少有這麼多人按過才會跟。設 1 表示有人按就可能跟；人數來自這個插件收到的反應事件，剛啟動時可能偏少。',
  },
  reactionControlUserIds: {
    label: '可以用表情操作別人訊息的使用者',
    help: '預設每個人只能對自己的提問按 🔁 重答、⏹️ 停止、🔍 解釋。名單內的人可以操作其他人的訊息。',
  },
  autoReactionChance: { help: '對會回覆的訊息隨機按表情的機率。' },
  reactionCommandEnabled: {
    label: '用表情叫 AI 回覆',
    help: '有人對訊息按下指定表情時，讓 AI 針對那則訊息回覆。',
  },
  reactionCommandTriggerEmojis: { label: '觸發回覆的表情', help: '按下這些表情時觸發 AI 回覆。' },
  reactionIntelEnabled: { label: '讓 AI 知道大家按了什麼表情', help: '把訊息收到的表情數量提供給 AI 參考。' },
  memeImageChancePercent: { help: '對方沒有明確要圖時，AI 主動配圖的機率。' },
  memeImageCooldownSeconds: { help: '同一頻道兩次傳表情圖片之間的最短間隔。' },
  memeImagePackIds: { label: '只使用這些表情圖庫', help: '留空表示使用表情圖庫插件中所有已啟用的圖庫。' },
  memeImageTags: { label: '只使用這些分類', help: '留空表示不限分類。' },
  stickerAutoSendEnabled: { label: '允許 AI 傳貼圖', help: '讓 AI 在回覆時傳送伺服器的貼圖。' },

  // ---- GIF
  gifProvider: { help: '預設透過已連線的 Discord 帳號搜尋，不需要另外申請金鑰。' },
  gifCustomEndpoint: { label: '自訂搜尋網址', help: '例如 https://example.com/api/gifs?q={query} 。' },
  gifFrameCount: {
    label: '看 GIF 時取幾張畫面',
    help: '取越多張 AI 越看得懂動畫內容，但會增加模型用量。',
  },
  videoVisionEnabled: {
    label: '看懂短影片（MP4／WebM）',
    help: '從影片取幾張畫面給 AI 看，不含聲音。只處理 2 分鐘內的小檔案。',
  },

  // ---- 表情與 GIF 記憶
  mediaPerceptionCacheEnabled: {
    label: '記住看過的圖片與表情',
    help: '同一張圖或表情再次出現時直接使用上次的辨識結果，節省模型用量。',
  },
  mediaPerceptionCacheDays: { label: '記住幾天' },
  cultureLearningEnabled: {
    label: '學習群組怎麼用表情與梗圖',
    help: '記錄群友在什麼情境使用哪些表情與圖片，讓 AI 的用法更貼近這個群。',
  },
  cultureReuseEnabled: { label: '用學到的素材回覆', help: '讓 AI 使用群裡常見的表情與圖片回覆。' },
  cultureChorusEnabled: {
    label: '跟著大家接龍',
    help: '多人連續傳同樣的內容時，AI 也跟一次。仍受閒聊開關、黑名單與上限限制。',
  },
  cultureChorusChannelIds: { label: '可以接龍的頻道', help: '留空表示所有可回覆的群聊頻道。' },
  cultureChorusWindowSeconds: { label: '多少秒內算同一波接龍' },
  cultureChorusMinMessages: { label: '至少幾則才跟' },
  cultureChorusMinUsers: { label: '至少幾個人才跟' },
  cultureChorusCooldownSeconds: { label: '同一頻道多久接龍一次（秒）' },

  // ---- 陪伴
  proactiveEnabled: {
    label: '允許 AI 主動關心',
    help: '對方需先在頻道輸入「!陪伴 同意」才會生效，輸入「!陪伴 停止」可取消。每次只關心一次，對方沒回應不會追問。',
  },
  proactiveDailyLimit: { help: '所有對象合計。0 表示不主動發送。' },
  conversationControlEnabled: {
    label: '可以叫 AI「晚點再回」',
    help: '對 AI 說「半小時後再回我」之類的話時，安排延後回覆。建立前會先跟你確認時間。',
  },
  pendingTopicsEnabled: {
    label: '記住還沒回答的話題',
    help: '追蹤尚未回答的提問，可在「話題與延後回覆」查看。最多 200 筆。',
  },
  quietHoursEnabled: { help: '安靜時段內只用文字回覆，不發語音。以台北時間計算。' },

  // ---- 訊息與論壇、聊天快取
  channelActionsEnabled: {
    label: '允許管理者操作訊息與討論串',
    help: '開放置頂、修改或撤回自己的訊息、轉傳、管理討論串與論壇貼文。每個操作都要先預覽、由你確認後才執行。',
  },
  channelForwardDestinationIds: {
    label: '可以轉傳到哪些頻道',
    help: '只能轉傳到同一伺服器內、列在這裡的頻道。轉傳會包含原訊息與附件。',
  },
  channelLookupEnabled: {
    label: '允許 AI 查看頻道的置頂與歷史訊息',
    help: '讓 AI 在需要時讀取目前頻道的置頂、搜尋歷史訊息、查看論壇貼文。每次最多 20 則，不會讀取其他頻道。',
  },
  memberNameUpdatesEnabled: { help: '群友改暱稱後，AI 稱呼對方時使用新的暱稱。' },
  historyEnabled: {
    label: '保留近期聊天內容',
    help: '在這台電腦保存各頻道最近的訊息，讓 AI 回覆時能參考前文。',
  },
  historyIncludeBots: { help: '是否也保存其他機器人的訊息。' },
  historyStoreAttachments: { help: '保存附件的檔名與連結，不會下載檔案。' },

  // ---- 記憶輸出
  memoryDiaryPersonaEnabled: {
    label: '讓 AI 寫每日日記',
    help: '每天把當天的對話整理成第一人稱的日記，使用對應工作區的人格撰寫。',
  },
  memoryDiaryWriteEnabled: {
    label: '把日記交給記憶插件',
    help: '日記完成後存入記憶插件。存入失敗時會如實顯示，不會當作已記住。',
  },
  memoryDiaryWriter: {
    label: '使用哪個記憶插件',
    help: '填記憶插件的代號：memu、meow、lingshu（靈樞，保留精確維護回執）、files（輸出成檔案供匯入）、session（交給 DSH 會話自動處理）。',
  },
  memoryOutputEnabled: {
    label: '輸出對話紀錄檔',
    help: '把管理者對話與群聊事件輸出成檔案（Markdown／JSON），方便備份或交給其他工具使用。',
  },
  memoryOutputDirectory: { label: '輸出到哪個資料夾', help: '一般留空，使用工作區下的預設資料夾。' },
  memoryGroupChannelIds: { label: '收集哪些群聊頻道', help: '留空表示收集所有收得到的群聊頻道。' },
  memoryOutputTimezone: { help: '用哪個時區決定「一天」的分界，例如 Asia/Taipei。' },
  memoryDiaryHour: { help: '每天這個時間整理前一天的資料。DSH 沒開時會在下次開啟後補做。' },
  memoryDiaryAiOverview: {
    label: '附上當日對話摘要',
    help: '額外產生一段簡短的當日摘要。原始紀錄仍完整保留。',
  },

  // ---- 群聊人格安全
  groupSafetyPrompt: {
    label: '群聊中的額外注意事項',
    help: '可補充在群聊中要遵守的規則。無論這裡怎麼寫，非管理者與群聊都無法讓 AI 操作你的電腦或檔案。',
  },
  groupProtectedData: {
    label: '不能在群聊說出的資料',
    help: '每行一項，例如地址、電話或真實姓名。AI 在群聊與對非管理者的回覆送出前會自動遮蔽這些字串。',
  },

  // ---- 進階與記錄
  maxConcurrentReplies: { help: '同時最多處理幾則回覆。' },
  dryRun: {
    label: '試跑模式（不實際送出）',
    help: 'AI 會產生回覆並寫入執行記錄，但不會對外送出任何訊息或表情。適合測試設定。',
  },
  statusRefreshSeconds: { label: '畫面自動更新間隔（秒）', help: '這個設定頁多久更新一次連線狀態。' },
  tokenBudgetEnabled: {
    label: '限制模型用量',
    help: '開啟後依下方設定在超過用量時提醒或停止回覆。用量一律會記錄。',
  },
  tokenDailyLimit: { label: '每日用量上限（token）', help: '0 表示不限。以台北時間每日重新計算。' },
  tokenMonthlyLimit: { label: '每月用量上限（token）', help: '0 表示不限。' },
  logEnabled: { label: '記錄執行過程', help: '記錄登入、收訊、回覆、錯誤等事件，可在下方即時查看。' },
  logLevel: { label: '記錄詳細程度', help: 'debug 最詳細，error 只記錄錯誤。' },
  logMaxEntries: { label: '畫面上保留幾則', help: '下方即時列表最多顯示多少則。' },
  logToFile: { label: '同時寫入檔案', help: '把記錄存成每日一個檔案，放在你的使用者資料夾：.dsh/data/dsh-discord-cyberfriend/logs。' },
  logRetentionDays: { label: '記錄檔保留天數', help: '超過天數的記錄檔會自動刪除。' },
  logMessageContent: {
    help: '預設關閉：只記錄訊息長度與作者，不記錄內文，較能保護隱私。需要除錯時再開啟，記錄檔會保留聊天內文。',
  },

  // ---- 語音
  voiceEnabled: {
    label: '啟用 Discord 語音',
    help: '允許加入語音房並讓 AI 說話。只會加入你手動指定的房間；被踢出或重啟後不會自動回去。',
  },
  voiceAllowedChannelIds: { help: '留空可加入此帳號有權限的一般語音房；填寫後只能加入清單中的房間。可從下方依名稱選擇。個人帳號與機器人都適用，仍須啟用語音並手動選擇房間加入。' },
  voiceIdleMinutes: { help: '沒有人說話、沒有音樂也沒有待播內容時，過這段時間自動離開。' },
  voiceMaxSessionMinutes: { help: '到這個時間一定會離開語音房，避免一直掛著。' },
  voiceAutoSpeak: {
    label: '朗讀 AI 在文字頻道的回覆',
    help: '加入語音房時可以綁定一個文字頻道，AI 在該頻道的回覆會同時唸出來。私訊不會被唸出。',
  },
  voiceMaxTextChars: { label: '單次朗讀字數上限', help: '回覆超過這個長度時只送出文字，不朗讀。' },
  voiceDailyCharacterLimit: { label: '每日朗讀字數上限', help: '0 表示不限。以台北時間每日重新計算。' },
  voiceTtsVoice: { label: '指定聲音（選填）', help: '留空使用語音插件目前設定的聲音。' },
  voiceTtsAdapter: {
    label: '語音合成來源',
    help: '「自動偵測」會使用已安裝並設定好的語音插件，一般不需要更改。',
  },
  voiceTtsService: {
    label: '使用哪個語音插件',
    help: '同時安裝多個語音插件時，指定要用哪一個。指定後不會自動換成別的，避免聲音突然改變。',
  },
  voiceTtsBaseUrl: {
    label: '語音插件所在的 DSH 網址（進階）',
    help: '一般留空。語音插件裝在另一個 DSH 時才需要填。',
  },
  voiceTtsOptions: { label: '語音合成進階選項（JSON）', help: '一般留空。不要在這裡填金鑰。' },
  voiceLlmCostPerMillion: { label: '模型單價（每百萬 token）', help: '用來估算花費。0 表示不估算。' },
  voiceTtsCostPerMillion: {
    label: '語音合成單價（每百萬字元）',
    help: '只用於下方的成本估算，不影響實際計費。',
  },
  voiceSttCostPerMinute: { label: '語音辨識單價（每分鐘）', help: '0 表示不估算；使用本機模型時可留空。' },
  voiceReceiveEnabled: {
    label: '聽語音房裡的人說話',
    help: '讓 AI 聽懂語音房中指定成員說的話。變更後需重新加入語音房。預設關閉。',
  },
  voiceReceiveConsent: {
    label: '我已告知並取得成員同意',
    help: '請先告訴被收聽的成員用途，以及聲音會送到哪個語音辨識服務。沒有勾選就不會收聽。',
  },
  voiceReceiveUserIds: { label: '收聽哪些成員', help: '必須明確列出使用者 ID；留空不收聽任何人。' },
  voiceReceiveAutoReply: {
    label: '聽到後讓 AI 回話',
    help: '關閉時只在這台電腦顯示辨識出的文字；開啟後 AI 會依回覆規則用語音回應。',
  },
  voiceReplyTextEnabled: {
    label: '語音房的回覆也發到文字頻道',
    help: '關閉後，你在語音房說話得到的回覆只會唸出來，不在文字頻道發文字；朗讀失敗時仍會改發文字。有人打字時 AI 照常用文字回。附圖、貼圖或 GIF 的回覆不受影響。',
  },
  voiceInterruptOnSpeech: {
    label: '有人說話時 AI 停止說話',
    help: '有人開口時讓 AI 停下來聽。外放喇叭可能被 AI 自己的聲音觸發，建議配戴耳機。',
  },
  voiceInterruptMode: {
    label: '怎麼判斷有人插話',
    help: '保守模式會先確認聽到的是有意義的話才停止，較不容易誤判；較快模式反應快但容易被回音觸發。',
  },
  voiceInterruptMinMs: { label: '持續出聲多久才算插話（毫秒）', help: '變更後需重新加入語音房。' },
  voiceInputEchoGuard: {
    label: '忽略 AI 自己的回音',
    help: '聽到的內容和 AI 正在說的話幾乎一樣時視為回音，不回應。',
  },
  voiceMessageEnabled: {
    label: '聽語音訊息並用語音回覆',
    help: '有人傳錄音並 @ AI 時，AI 聽取內容後用語音回覆。不需要加入語音房；需先設定好語音辨識與語音合成。',
  },
  voiceMessageChannelIds: { label: '哪些頻道可以用語音訊息', help: '留空表示不處理任何頻道的錄音。' },
  voiceMessageUserIds: { label: '哪些成員可以用語音訊息', help: '發問的人與錄音的人都必須在名單內。' },
  voiceMessageMaxSeconds: { help: '超過這個長度的錄音不處理。' },
  voiceSttDailySeconds: { label: '每日語音辨識秒數上限', help: '0 表示不限。' },
  voiceSttProvider: {
    label: '語音辨識服務（進階）',
    help: '一般留空，使用 DSH 目前選定的語音辨識服務。',
  },
  voiceSttLanguage: { label: '語音辨識語言', help: '告訴語音辨識主要說的是什麼語言，可提高準確度。' },
  voiceTranscriptScript: {
    label: '辨識結果轉成繁體或簡體',
    help: '把語音辨識出的中文統一成指定字體。使用簡體中文的話，請選「保留辨識原文」。',
  },
  voiceTranscriptTermsEnabled: {
    label: '修正常見的辨識錯字',
    help: '修正品牌名稱等常見錯誤，並套用下方你自訂的對照表。',
  },
  voiceTranscriptGlossary: {
    label: '自訂錯字對照表（JSON）',
    help: '例如 {"大肥余":"大肥魚"}。只填你確定常被辨識錯的詞，最多 100 組。',
  },
  voiceSubtitles: {
    label: '在這個頁面顯示字幕',
    help: '顯示 AI 說的話與聽到的內容。只在這台電腦顯示，不會發到 Discord。',
  },
  voiceMusicMode: {
    label: 'AI 說話時音樂怎麼處理',
    help: '可以選擇暫停音樂，或壓低音量繼續播放（壓低只支援機器人）。',
  },
  voiceMusicPauseReceiveEnabled: {
    label: '音樂／翻唱播放時暫停接收語音指令',
    help: '使用者帳號與 Bot 都適用。房內任一插件帳號播放音樂或翻唱時暫停收聽，包含人聲壓低音樂的期間；播放結束後依原設定恢復。文字指令不受影響。',
  },
  voiceMusicDuckPercent: { label: 'AI 說話時的音樂音量（%）' },
  musicYtdlpPath: {
    label: 'yt-dlp 執行檔路徑（YouTube 點歌用）',
    help: '一般留空就好：YouTube 點歌需要的 yt-dlp 會在第一次使用時自動下載，也可以到語音頁按「下載 yt-dlp」。只有想改用自己安裝的 yt-dlp 時才填完整路徑，例如 C:/tools/yt-dlp.exe；填了之後插件就不會自動下載。',
  },
  voiceStreaming: {
    label: '邊合成邊播放',
    help: '語音還在合成時就開始播放，等待時間較短。需機器人與語音插件都支援。',
  },
  voiceIncrementalReplies: {
    label: 'AI 邊想邊說（進階）',
    help: 'AI 回覆還在產生時就開始說話，反應更快。可能比文字訊息更早出聲，且每一小段都可能計費。',
  },
  voiceSpokenLanguage: {
    label: '說話的語言',
    help: '可讓 AI 文字用中文、語音用日文。使用日文時請在語音插件選擇日文聲音。',
  },
  voiceJapaneseFallback: {
    label: '沒有日文時自動補翻',
    help: 'AI 沒有提供日文版本時，再請模型翻譯一次。失敗時只是不發語音。',
  },
  voiceJapaneseGlossary: {
    label: '日文稱呼對照表（JSON）',
    help: '例如 {"我":"わたし","主人":"ご主人様"}。',
  },
  voiceEmotionMode: { label: '語氣怎麼決定', help: '可由 AI 依對話內容決定語氣，或固定使用某種情緒。' },
  voiceSpeechInstruction: {
    label: '說話語氣指示',
    help: '留空使用語音插件的設定。需語音服務支援語氣指示才有效。',
  },
  voiceReplayEnabled: {
    label: '可以要求重播剛才的語音',
    help: '保留剛說完的語音 3 分鐘。對 AI 說「剛才沒聽清楚」可重播，不會重新計費。',
  },

  // ---- 唱歌
  singingAllowedUserIds: {
    label: '哪些群友可以請 AI 唱歌',
    help: '填使用者 ID，或從清單選人。只開放唱歌，不會開放其他功能。',
  },
  singingAdminGroupEnabled: {
    label: '管理者可以在群聊請 AI 唱歌',
    help: '只有管理者可以在群聊發起；成果傳到目前頻道或已加入的語音房。',
  },
  singingEnabled: {
    label: '管理者可以在私訊請 AI 唱歌',
    help: '需要先安裝翻唱插件（找歌和下載已內建）。AI 會先試唱一小段，你確認後才製作整首。',
  },
};

// 文字欄位的建議值：使用者可以直接從清單挑，也可以自行輸入清單以外的值。
export const FIELD_SUGGESTIONS = {
  memoryOutputTimezone: [
    'Asia/Taipei',
    'Asia/Shanghai',
    'Asia/Hong_Kong',
    'Asia/Tokyo',
    'Asia/Singapore',
    'America/Los_Angeles',
    'America/New_York',
    'Europe/London',
    'UTC',
  ],
  memoryDiaryWriter: ['memu', 'meow', 'files', 'session'],
  subscriptionProvider: ['deepseek-account', 'deepseek-official'],
  subscriptionModel: ['deepseek-v4-pro', 'deepseek-v4-flash'],
  customLlmApiBase: ['https://api.deepseek.com', 'https://api.openai.com/v1', 'https://openrouter.ai/api/v1'],
  customLlmModel: ['deepseek-chat', 'deepseek-reasoner', 'gpt-4o-mini'],
  voiceCostCurrency: ['USD', 'TWD', 'CNY', 'JPY', 'EUR'],
  voiceSttLanguage: ['auto', 'zh', 'en', 'ja', 'ko'],
  voiceSttProvider: ['sensevoice-local', 'external:dsh-voice'],
  userThreadNameTemplate: ['{topic}', '{author}：{topic}'],
  botThreadNameTemplate: ['{topic}', '{user}：{topic}', '{date} {topic}'],
};

/** 把白話文字與建議值套用到欄位定義上（只改顯示用的資訊）。 */
export function applyFieldText(fields) {
  for (const field of fields) {
    const text = FIELD_TEXT[field.key];
    if (!text) continue;
    if (text.label) field.label = text.label;
    if (text.help !== undefined) field.help = text.help;
  }
  for (const field of fields)
    if (FIELD_SUGGESTIONS[field.key]) field.suggestions = FIELD_SUGGESTIONS[field.key];
  return fields;
}
