/**
 * src/config.js — Discord-cyberfriend（Discord 賽博群友）設定層
 * ============================================================================
 * 單一來源 (single source of truth)：
 *   SECTIONS  設定頁分頁
 *   FIELDS    每個開關 / 欄位的型別、預設值、提示、可用介面
 *   DEFAULTS  由 FIELDS 推導的預設設定
 * 前端不重複宣告欄位：UI 直接讀 GET /api/discord-cyberfriend/schema 後動態渲染，
 * 因此「後端新增一個開關」就等於「UI 自動多一個開關」。
 * ============================================================================
 */

import { DEFAULT_GROUP_SAFETY } from './security.js';
import { createHash } from 'node:crypto';

/** 可用的介面代號。user = Discord 使用者帳號 (selfbot)，bot = Discord 機器人。 */
import { applyFieldText } from './field-text.js';
export const TRANSPORTS = ['user', 'bot'];

export const TRANSPORT_INFO = {
  user: {
    id: 'user',
    label: '使用者帳號（需要 Python）',
    short: '使用者帳號',
    tokenLabel: 'User Token',
    note: '以個人帳號連線。啟用、接收範圍與自動回覆分開設定；請先閱讀下方風險說明。',
  },
  bot: {
    id: 'bot',
    label: '機器人 (Bot)',
    short: '機器人',
    tokenLabel: 'Bot Token',
    note: '以 Bot 身分發言：有「機器人」標籤，需要 Developer Portal 的 Bot Token 與 Message Content Intent。',
  },
};

// 導覽群組：介面先顯示群組，再顯示該群組內的分區（皆為橫排可點模塊）。
export const SECTION_GROUPS = [
  { id: 'start', label: '開始', icon: 'hub', desc: '連線帳號、選擇模型，完成第一次回覆' },
  { id: 'audience', label: '回覆對象', icon: 'chat', desc: '對誰回覆、怎麼回覆、回覆上限' },
  { id: 'interact', label: '互動', icon: 'reaction', desc: '表情、GIF、話題、陪伴與訊息操作' },
  { id: 'voice', label: '語音', icon: 'voice', desc: '語音房、朗讀、音樂與唱歌' },
  { id: 'system', label: '系統', icon: 'advanced', desc: '診斷、快取、記憶輸出與執行記錄' },
];

export const SECTIONS = [
  { id: 'overview', group: 'start', label: '總覽', icon: 'hub', readOnly: true },
  { id: 'general', group: 'start', label: '基本設定', icon: 'settings' },
  { id: 'user', group: 'start', label: '使用者帳號', icon: 'user', transport: 'user' },
  { id: 'bot', group: 'start', label: '機器人', icon: 'bot', transport: 'bot' },
  { id: 'llm', group: 'start', label: '模型', icon: 'model' },
  { id: 'adminDm', group: 'audience', label: '管理者・私訊', icon: 'user' },
  { id: 'adminGroup', group: 'audience', label: '管理者・群聊', icon: 'chat' },
  { id: 'othersDm', group: 'audience', label: '其他使用者・私訊', icon: 'user' },
  { id: 'othersGroup', group: 'audience', label: '其他使用者・群聊', icon: 'chat' },
  // 名單集中在一頁：誰可以互動（管理者、白名單、黑名單）與在哪裡回覆（伺服器、頻道）。
  { id: 'people', group: 'audience', label: '名單與範圍', icon: 'user' },
  { id: 'sessions', group: 'audience', label: 'DSH 會話與人格', icon: 'history' },
  { id: 'reply', group: 'audience', label: '回覆配額', icon: 'reply' },
  { id: 'cochat', group: 'audience', label: '閒聊上限', icon: 'chat' },
  { id: 'safety', group: 'audience', label: '群聊人格安全', icon: 'settings' },
  { id: 'reaction', group: 'interact', label: '反應與貼圖', icon: 'reaction' },
  { id: 'slang', group: 'interact', label: '鄉民語氣', icon: 'chat' },
  { id: 'gif', group: 'interact', label: 'GIF 圖庫', icon: 'gif' },
  { id: 'culture', group: 'interact', label: '表情與 GIF 記憶', icon: 'reaction' },
  { id: 'topics', group: 'interact', label: '話題與延後回覆', icon: 'history', readOnly: true },
  { id: 'companion', group: 'interact', label: '陪伴與訊息診斷', icon: 'chat' },
  { id: 'channelActions', group: 'interact', label: '訊息與論壇', icon: 'chat' },
  { id: 'voice', group: 'voice', label: '語音與音樂', icon: 'voice' },
  { id: 'singing', group: 'voice', label: '唱歌與翻唱', icon: 'voice' },
  { id: 'capabilities', group: 'system', label: '外部能力與診斷', icon: 'settings', readOnly: true },
  { id: 'history', group: 'system', label: '聊天快取', icon: 'history' },
  { id: 'memoryOutput', group: 'system', label: '記憶輸出', icon: 'history' },
  { id: 'advanced', group: 'system', label: '進階', icon: 'advanced' },
  { id: 'log', group: 'system', label: '執行記錄', icon: 'log' },
];

const opt = (value, label) => ({ value, label });
const LEGACY_USER_FIELDS = new Set([
  'userProxyUrl',
  'userJitterMinSeconds',
  'userJitterMaxSeconds',
  'userClientVersion',
  'userClientBuildNumber',
  'userNativeBuildNumber',
  'userBrowserVersion',
  'userBrowser',
  'userBrowserUserAgent',
  'userOsVersion',
]);

/**
 * FIELDS：UI 與設定檔共用的欄位描述。
 * type: boolean | string | password | number | range | select | tags | textarea
 * transport: 'user' | 'bot' | 'both' → 決定「這個開關屬於哪個介面」
 */
export const FIELDS = [
  { key: 'groupSafetyPrompt', section: 'safety', type: 'textarea', default: DEFAULT_GROUP_SAFETY },
  { key: 'groupProtectedData', section: 'safety', type: 'textarea', default: '' },
  { key: 'mediaPerceptionCacheEnabled', section: 'culture', type: 'boolean', default: true },
  { key: 'mediaPerceptionCacheDays', section: 'culture', type: 'number', default: 30, min: 1, max: 365 },
  { key: 'cultureLearningEnabled', section: 'culture', type: 'boolean', default: true },
  { key: 'cultureReuseEnabled', section: 'culture', type: 'boolean', default: true },
  { key: 'cultureChorusEnabled', section: 'culture', type: 'boolean', default: false },
  { key: 'cultureChorusChannelIds', section: 'culture', type: 'tags', default: [] },
  { key: 'cultureChorusWindowSeconds', section: 'culture', type: 'number', default: 15, min: 5, max: 90 },
  { key: 'cultureChorusMinMessages', section: 'culture', type: 'number', default: 4, min: 3, max: 30 },
  { key: 'cultureChorusMinUsers', section: 'culture', type: 'number', default: 3, min: 2, max: 10 },
  {
    key: 'cultureChorusCooldownSeconds',
    section: 'culture',
    type: 'number',
    default: 90,
    min: 30,
    max: 3600,
  },
  { key: 'memoryDiaryPersonaEnabled', section: 'memoryOutput', type: 'boolean', default: true },
  { key: 'memoryDiaryWriteEnabled', section: 'memoryOutput', type: 'boolean', default: true },
  { key: 'memoryDiaryWriter', section: 'memoryOutput', type: 'string', default: 'memu' },

  { key: 'memoryOutputEnabled', section: 'memoryOutput', type: 'boolean', default: true },
  { key: 'memoryOutputDirectory', section: 'memoryOutput', type: 'string', default: '' },
  { key: 'memoryGroupChannelIds', section: 'memoryOutput', type: 'tags', default: [] },
  {
    key: 'memoryOutputTimezone',
    section: 'memoryOutput',
    type: 'string',
    default: 'Asia/Taipei',
    label: '日記時區',
  },
  {
    key: 'memoryDiaryHour',
    section: 'memoryOutput',
    type: 'number',
    default: 3,
    min: 0,
    max: 23,
    label: '每日輸出時間：時',
  },
  {
    key: 'memoryDiaryMinute',
    section: 'memoryOutput',
    type: 'number',
    default: 0,
    min: 0,
    max: 59,
    label: '每日輸出時間：分',
  },
  { key: 'memoryDiaryAiOverview', section: 'memoryOutput', type: 'boolean', default: false },

  {
    key: 'replyEngine',
    section: 'sessions',
    type: 'select',
    default: 'dsh',
    options: [opt('dsh', 'DSH 正式會話（外部人格／記憶）'), opt('direct', '原有獨立模式')],
  },
  { key: 'sessionWorkspaceRoot', section: 'sessions', type: 'string', default: '' },
  {
    key: 'sessionWorkspaceGrouping',
    section: 'sessions',
    type: 'select',
    default: 'audience',
    options: [opt('audience', '依私訊對象／伺服器分開'), opt('account', '同一登入帳號共用工作區')],
  },
  {
    key: 'adminSessionWorkspace',
    section: 'sessions',
    type: 'string',
    default: '',
    label: '管理者私訊工作區',
  },
  {
    key: 'otherSessionWorkspace',
    section: 'sessions',
    type: 'string',
    default: '',
    label: '其他使用者私訊工作區',
  },
  { key: 'archiveAdminMessages', section: 'sessions', type: 'boolean', default: true },
  { key: 'sessionAllowedTools', section: 'sessions', type: 'tags', default: [] },
  { key: 'pluginPersonaEnabled', section: 'prompt', type: 'boolean', default: false },
  { key: 'pluginStyleEnabled', section: 'prompt', type: 'boolean', default: false },
  { key: 'antiAiFlavorPromptEnabled', section: 'prompt', type: 'boolean', default: false },
  { key: 'adminUserId', section: 'general', type: 'string', default: '' },
  { key: 'followupEnabled', section: 'reply', type: 'boolean', default: true, label: '@ 後持續接話' },
  { key: 'followupSeconds', section: 'reply', type: 'number', default: 180, min: 15, max: 900 },
  { key: 'imageVisionEnabled', section: 'gif', type: 'boolean', default: true, label: '理解收到的圖片' },
  { key: 'emojiVisionEnabled', section: 'gif', type: 'boolean', default: true },
  {
    key: 'mediaVisionMode',
    section: 'llm',
    type: 'select',
    default: 'auto',

    options: [
      opt('auto', '自動（原生／ModLens）'),
      opt('modlens', '優先 ModLens'),
      opt('native', '僅目前模型'),
    ],
  },
  { key: 'mediaReplyTokens', section: 'llm', type: 'number', default: 1600, min: 400, max: 4000 },
  { key: 'gifVisionEnabled', section: 'gif', type: 'boolean', default: true, label: '理解收到的 GIF 畫面' },
  { key: 'gifFrameCount', section: 'gif', type: 'number', default: 4, min: 2, max: 6 },
  // ── 一般 ────────────────────────────────────────────────────────────────
  {
    key: 'enabled',
    section: 'general',
    type: 'boolean',
    default: true,
    label: '啟用 Discord 賽博群友',
  },
  {
    key: 'primaryTransport',
    section: 'general',
    type: 'select',
    default: 'bot',
    options: [opt('user', '使用者帳號（需要 Python）'), opt('bot', '機器人 (Bot)')],
  },
  {
    key: 'replyTransport',
    section: 'general',
    type: 'select',
    default: 'auto',
    options: [opt('auto', '自動（收到訊息的介面）'), opt('user', '一律使用者帳號'), opt('bot', '一律機器人')],
  },
  {
    key: 'sendTransportDefault',
    section: 'general',
    type: 'select',
    default: 'auto',
    options: [opt('auto', '自動選擇'), opt('user', '使用者帳號'), opt('bot', '機器人')],
  },
  {
    key: 'language',
    section: 'gif',
    type: 'select',
    default: 'zh',
    label: 'GIF 搜尋語言',
    help: 'Discord／KLIPY 搜尋使用的語言與地區。',
    options: [opt('zh', '繁體中文'), opt('en', 'English')],
  },

  // ── 使用者帳號 (selfbot) ────────────────────────────────────────────────
  { key: 'userReconnect', section: 'user', type: 'boolean', default: true, transport: 'user' },
  { key: 'userContextBootstrap', section: 'user', type: 'boolean', default: true, transport: 'user' },
  { key: 'reactionControlUserIds', section: 'reaction', type: 'tags', default: [] },
  {
    key: 'userEnabled',
    section: 'user',
    type: 'boolean',
    default: false,
    transport: 'user',
  },
  {
    key: 'userAutoStart',
    section: 'user',
    type: 'boolean',
    default: false,
    transport: 'user',
    label: '啟動時自動連線',
  },
  { key: 'userPythonExecutable', section: 'user', type: 'string', default: '', transport: 'user' },
  { key: 'userReceiveOnly', section: 'user', type: 'boolean', default: true, transport: 'user' },
  { key: 'userAutoReply', section: 'user', type: 'boolean', default: false, transport: 'user' },
  { key: 'userWatchDms', section: 'user', type: 'boolean', default: true, transport: 'user' },
  { key: 'userChannelIds', section: 'user', type: 'tags', default: [], transport: 'user' },
  {
    key: 'userToken',
    section: 'user',
    type: 'password',
    default: '',
    transport: 'user',
    secret: true,
    label: 'User Token',
  },
  {
    key: 'userProxyUrl',
    section: 'user',
    type: 'string',
    default: '',
    transport: 'user',
    label: '代理伺服器',
    help: '選填，例如 http://127.0.0.1:7890 。留空表示直連。',
  },
  { key: 'userAutoTakeoverEnabled', section: 'user', type: 'boolean', default: true, transport: 'user' },
  {
    key: 'userAutoTakeoverMinutes',
    section: 'user',
    type: 'number',
    default: 30,
    min: 1,
    max: 240,
    transport: 'user',
  },
  { key: 'userInboxEnabled', section: 'user', type: 'boolean', default: true, transport: 'user' },
  { key: 'userPresenceEnabled', section: 'user', type: 'boolean', default: false, transport: 'user' },
  {
    key: 'userActivityType',
    section: 'user',
    type: 'select',
    default: 'none',
    transport: 'user',
    label: '活動類型',
    options: [
      opt('none', '不顯示活動'),
      opt('playing', '正在遊玩'),
      opt('listening', '正在聆聽'),
      opt('watching', '正在觀看'),
      opt('competing', '正在競賽'),
    ],
  },
  {
    key: 'userActivityText',
    section: 'user',
    type: 'string',
    default: '',
    transport: 'user',
    label: '活動文字',
  },
  {
    key: 'userCustomStatusText',
    section: 'user',
    type: 'string',
    default: '',
    transport: 'user',
    label: '自訂狀態文字',
  },
  {
    key: 'userCustomStatusEmoji',
    section: 'user',
    type: 'string',
    default: '',
    transport: 'user',
    label: '自訂狀態表情',
  },
  {
    key: 'userStatus',
    section: 'user',
    type: 'select',
    default: 'online',
    transport: 'user',
    label: '線上狀態',
    help: '登入後對外顯示的狀態。',
    options: [opt('online', '上線'), opt('idle', '閒置'), opt('dnd', '請勿打擾'), opt('invisible', '隱藏')],
  },
  {
    key: 'userSimulateTyping',
    section: 'user',
    type: 'boolean',
    default: true,
    transport: 'user',
  },
  {
    key: 'userJitterMinSeconds',
    section: 'user',
    type: 'number',
    default: 2,
    min: 0,
    max: 30,
    transport: 'user',
    label: '最短延遲（秒）',
    help: '模擬輸入的最短等待時間。',
  },
  {
    key: 'userJitterMaxSeconds',
    section: 'user',
    type: 'number',
    default: 5,
    min: 0,
    max: 60,
    transport: 'user',
    label: '最長延遲（秒）',
    help: '模擬輸入的最長等待時間，需大於最短延遲。',
  },

  // ── 使用者帳號的 IDENTIFY 偽裝（實驗性，只在 selfbot 介面生效）───────────
  {
    key: 'userClientVersion',
    section: 'user',
    type: 'string',
    default: '1.0.9210',
    transport: 'user',
    label: 'IDENTIFY client_version',
    help: '實驗性。送給 Gateway 的用戶端版本號，預設沿用 discord.js-selfbot-v13 內建值。只有在自行更新版本號時才需修改。',
  },
  {
    key: 'userClientBuildNumber',
    section: 'user',
    type: 'number',
    default: 455964,
    min: 0,
    max: 99999999,
    transport: 'user',
    label: 'IDENTIFY client_build_number',
    help: '實驗性。官方桌面版內部組建號；太小會被判定為過期用戶端。',
  },
  {
    key: 'userNativeBuildNumber',
    section: 'user',
    type: 'number',
    default: 69976,
    min: 0,
    max: 99999999,
    transport: 'user',
    label: 'IDENTIFY native_build_number',
    help: '實驗性。與 client_build_number 搭配的桌面版原生組建號。',
  },
  {
    key: 'userBrowserVersion',
    section: 'user',
    type: 'string',
    default: '35.3.0',
    transport: 'user',
    label: 'IDENTIFY browser_version',
    help: '實驗性。Discord 內建 Electron/Chrome 版本號。若模仿網頁版，填瀏覽器實際版本（例如 157.0.8103.39）。',
  },
  {
    key: 'userBrowser',
    section: 'user',
    type: 'string',
    default: 'Discord Client',
    transport: 'user',
    label: 'IDENTIFY browser',
    help: '實驗性。聲稱的用戶端種類：Discord Client（桌面版）、Chrome／Firefox（網頁版）。Token 來自瀏覽器時，填該瀏覽器名稱可能更一致。',
  },
  {
    key: 'userBrowserUserAgent',
    section: 'user',
    type: 'string',
    default: '',
    transport: 'user',
    label: 'IDENTIFY browser_user_agent',
    help: '實驗性。留空則沿用套件預設。模仿網頁版時填入瀏覽器實際 UA（Mozilla/5.0 … Chrome/…）。',
  },
  {
    key: 'userOsVersion',
    section: 'user',
    type: 'string',
    default: '10.0.19044',
    transport: 'user',
    label: 'IDENTIFY os_version',
    help: '實驗性。送出作業系統版本字串。',
  },

  { key: 'userAutoCreateThreads', section: 'user', type: 'boolean', default: false, transport: 'user' },
  {
    key: 'userThreadNameTemplate',
    section: 'user',
    type: 'string',
    default: '{topic}',
    transport: 'user',
    label: '討論串命名',
  },
  {
    key: 'userThreadArchiveMinutes',
    section: 'user',
    type: 'select',
    default: '1440',
    transport: 'user',
    label: '討論串自動封存',
    options: [opt('60', '1 小時'), opt('1440', '1 天'), opt('4320', '3 天'), opt('10080', '1 週')],
  },
  // ── 機器人 (bot) ───────────────────────────────────────────────────────
  {
    key: 'botEnabled',
    section: 'bot',
    type: 'boolean',
    default: true,
    transport: 'bot',
  },
  {
    key: 'botAutoStart',
    section: 'bot',
    type: 'boolean',
    default: true,
    transport: 'bot',
    label: '啟動時自動登入',
    help: 'DSH 啟動時自動使用已儲存的 Bot Token 連線。',
  },
  {
    key: 'botToken',
    section: 'bot',
    type: 'password',
    default: '',
    transport: 'bot',
    secret: true,
    label: 'Bot Token',
  },
  {
    key: 'botProxyUrl',
    section: 'bot',
    type: 'string',
    default: '',
    transport: 'bot',
    label: '代理伺服器',
  },
  {
    key: 'botActivityType',
    section: 'bot',
    type: 'select',
    default: 'playing',
    transport: 'bot',
    label: '狀態類型',
    help: '機器人顯示的活動類型。',
    options: [
      opt('playing', '正在遊玩'),
      opt('listening', '正在聆聽'),
      opt('watching', '正在觀看'),
      opt('competing', '正在參加'),
      opt('custom', '自訂狀態'),
    ],
  },
  {
    key: 'botActivityText',
    section: 'bot',
    type: 'string',
    default: '',
    transport: 'bot',
    label: '狀態文字',
  },
  {
    key: 'botMessageContentIntent',
    section: 'bot',
    type: 'boolean',
    default: true,
    transport: 'bot',
  },
  {
    key: 'botNativeInteractions',
    section: 'bot',
    type: 'boolean',
    default: false,
    transport: 'bot',
  },
  {
    key: 'botContextBootstrap',
    section: 'bot',
    type: 'boolean',
    default: true,
    transport: 'bot',
  },
  {
    key: 'botMembersIntent',
    section: 'bot',
    type: 'boolean',
    default: false,
    transport: 'bot',
  },
  {
    key: 'botAutoCreateThreads',
    section: 'bot',
    type: 'boolean',
    default: true,
    transport: 'bot',
  },
  {
    key: 'botThreadNameTemplate',
    section: 'bot',
    type: 'string',
    default: '{topic}',
    transport: 'bot',
    label: '討論串命名',
  },
  {
    key: 'botThreadArchiveMinutes',
    section: 'bot',
    type: 'select',
    default: '1440',
    transport: 'bot',
    label: '討論串自動封存',
    help: '討論串閒置多久後自動封存。',
    options: [opt('60', '1 小時'), opt('1440', '1 天'), opt('4320', '3 天'), opt('10080', '1 週')],
  },
  {
    key: 'botSlashCommands',
    section: 'bot',
    type: 'boolean',
    default: false,
    transport: 'bot',
    label: '註冊斜線指令',
  },
  {
    key: 'botEmbedReplies',
    section: 'bot',
    type: 'boolean',
    default: true,
    transport: 'bot',
  },

  // ── 自動回覆 ────────────────────────────────────────────────────────────
  {
    key: 'mentionReplyEnabled',
    section: 'reply',
    type: 'boolean',
    default: true,
    label: '被 @ 時自動回覆',
  },
  {
    key: 'dmReplyEnabled',
    section: 'reply',
    type: 'boolean',
    default: true,
  },
  {
    key: 'replyQuote',
    section: 'reply',
    type: 'boolean',
    default: true,
    label: '引用原訊息回覆',
    help: '回覆時附帶 Discord 的引用框。',
  },
  {
    key: 'replyIgnoreSelf',
    section: 'reply',
    type: 'boolean',
    default: true,
    label: '忽略自己送出的訊息',
  },
  {
    key: 'replyToBots',
    section: 'reply',
    type: 'boolean',
    default: false,
    label: '也回覆其他機器人',
    help: '預設不回覆其他 Bot，避免 Bot 互相對話。',
  },
  {
    key: 'cooldownSeconds',
    section: 'reply',
    type: 'number',
    default: 20,
    min: 0,
    max: 3600,
    label: '同一對象冷卻（秒）',
    help: '同一個使用者兩次回覆之間的最短間隔。私訊時使用者帳號與機器人各自計算；伺服器裡的 @ 兩個帳號共用。',
  },
  { key: 'replyCooldownExemptUserIds', section: 'people', type: 'tags', default: [] },
  {
    key: 'maxRepliesPerHour',
    section: 'reply',
    type: 'number',
    default: 20,
    min: 1,
    max: 200,
    label: '其他使用者：每小時回覆上限',
    help: '一小時內最多回覆其他使用者幾則，所有人加起來算，不是每人各一份；@ 和私訊分開計算，私訊時使用者帳號與機器人各有一份額度。管理者不受這個上限限制，也不佔用額度。閒聊插話另外用同一個數字當上限（最多 30）。',
  },
  {
    key: 'maxDailyMentionReplies',
    section: 'reply',
    type: 'number',
    default: 60,
    min: 1,
    max: 1000,
    label: '其他使用者：每日 @ 回覆上限',
    help: '一天內最多回覆其他使用者的 @ 幾次，所有人加起來算。管理者 @ 它不受限制，也不佔用額度。',
  },
  {
    key: 'maxDailyDmReplies',
    section: 'reply',
    type: 'number',
    default: 60,
    min: 1,
    max: 1000,
    label: '其他使用者：每日私訊回覆上限',
    help: '一天內最多回覆其他使用者的私訊幾則，所有人加起來算。管理者私訊它不受限制，也不佔用額度。',
  },
  {
    key: 'roundCapPerUser',
    section: 'reply',
    type: 'number',
    default: 5,
    min: 0,
    max: 50,
  },
  { key: 'roundResetMinutes', section: 'reply', type: 'number', default: 10, min: 1, max: 1440 },
  {
    key: 'minReplyDelaySeconds',
    section: 'reply',
    type: 'number',
    default: 1,
    min: 0,
    max: 60,
    label: '回覆前最短延遲（秒）',
  },
  {
    key: 'maxReplyDelaySeconds',
    section: 'reply',
    type: 'number',
    default: 4,
    min: 0,
    max: 120,
    label: '回覆前最長延遲（秒）',
    help: '需大於最短延遲。',
  },
  {
    key: 'contextMessages',
    section: 'reply',
    type: 'number',
    default: 12,
    min: 0,
    max: 50,
    label: '帶入上下文訊息數',
    help: '回覆時附上最近幾則訊息作為上下文。',
  },
  {
    key: 'whitelistUserIds',
    section: 'people',
    type: 'tags',
    default: [],
  },
  {
    key: 'blacklistUserIds',
    section: 'people',
    type: 'tags',
    default: [],
  },
  {
    key: 'monitoredGuildIds',
    section: 'people',
    type: 'tags',
    default: [],
  },
  {
    key: 'blacklistChannelIds',
    section: 'people',
    type: 'tags',
    default: [],
  },

  // ── 群組閒聊 ────────────────────────────────────────────────────────────
  {
    key: 'coChatEnabled',
    section: 'cochat',
    type: 'boolean',
    default: true,
  },
  {
    key: 'coChatProbability',
    section: 'cochat',
    type: 'range',
    default: 25,
    min: 0,
    max: 100,
    step: 5,
    label: '插話機率 (%)',
  },
  {
    key: 'coChatCooldownSeconds',
    section: 'cochat',
    type: 'number',
    default: 60,
    min: 5,
    max: 3600,
    label: '插話冷卻（秒）',
    help: '同一個頻道兩次插話之間的最短間隔。',
  },
  {
    key: 'coChatMinHistoryMessages',
    section: 'cochat',
    type: 'number',
    default: 3,
    min: 0,
    max: 30,
  },
  {
    key: 'maxDailyCoChats',
    section: 'cochat',
    type: 'number',
    default: 80,
    min: 1,
    max: 1000,
    label: '每日插話上限',
    help: '每天最多插話幾次。',
  },
  {
    key: 'coChatMaxMessageChars',
    section: 'cochat',
    type: 'number',
    default: 180,
    min: 20,
    max: 1500,
  },
  {
    key: 'coChatRequireKeyword',
    section: 'cochat',
    type: 'boolean',
    default: false,
    label: '需要命中關鍵字',
    help: '開啟後，只有訊息包含下方關鍵字時才會插話。',
  },
  {
    key: 'interestKeywords',
    section: 'cochat',
    type: 'tags',
    default: ['ai', '遊戲', 'code', 'bug', '吃什麼', '推薦', '伺服器', '更新'],
    label: '興趣關鍵字',
    help: '命中這些詞時提高插話意願。',
  },
  {
    key: 'monitoredChannelIds',
    section: 'cochat',
    type: 'tags',
    default: [],
  },
  {
    key: 'coChatReplyToBots',
    section: 'cochat',
    type: 'boolean',
    default: false,
    label: '允許對機器人插話',
    help: '預設忽略其他 Bot 的訊息。',
  },

  // ── 反應與貼圖 ──────────────────────────────────────────────────────────
  {
    key: 'autoReactionEnabled',
    section: 'reaction',
    type: 'boolean',
    default: true,
    label: '自動按表情反應',
  },
  {
    key: 'autoReactionChance',
    section: 'reaction',
    type: 'range',
    default: 35,
    min: 0,
    max: 100,
    step: 5,
    label: '加表情機率 (%)',
  },
  {
    key: 'autoReactionEmojis',
    section: 'reaction',
    type: 'tags',
    default: ['👍', '❤️', '🔥'],
  },
  {
    key: 'autoReactionOnlyGuild',
    section: 'reaction',
    type: 'boolean',
    default: true,
    label: '只在伺服器頻道加表情',
    help: '關閉後私訊也會加表情。',
  },
  {
    key: 'reactionFollowEnabled',
    section: 'reaction',
    type: 'boolean',
    default: false,
  },
  {
    key: 'reactionFollowChance',
    section: 'reaction',
    type: 'range',
    default: 25,
    min: 0,
    max: 100,
    step: 5,
  },
  {
    key: 'reactionFollowMinCount',
    section: 'reaction',
    type: 'number',
    default: 2,
    min: 1,
    max: 10,
  },
  {
    key: 'reactionCommandEnabled',
    section: 'reaction',
    type: 'boolean',
    default: true,
  },
  {
    key: 'reactionCommandTriggerEmojis',
    section: 'reaction',
    type: 'tags',
    default: ['❓', '🤖'],
  },
  {
    key: 'reactionIntelEnabled',
    section: 'reaction',
    type: 'boolean',
    default: true,
  },
  {
    key: 'stickerUnderstandEnabled',
    section: 'reaction',
    type: 'boolean',
    default: true,
  },
  { key: 'memeImagesEnabled', section: 'reaction', type: 'boolean', default: false },
  {
    key: 'memeImageMode',
    section: 'reaction',
    type: 'select',
    default: 'contextual',
    label: '表情圖片使用時機',
    options: [opt('requested', '只在對方要求表情圖時'), opt('contextual', '依聊天氣氛由AI選擇')],
  },
  {
    key: 'memeImageChancePercent',
    section: 'reaction',
    type: 'number',
    default: 25,
    min: 0,
    max: 100,
    label: '主動配表情圖機率（%）',
  },
  {
    key: 'memeImageCooldownSeconds',
    section: 'reaction',
    type: 'number',
    default: 60,
    min: 0,
    max: 3600,
    label: '表情圖片冷卻（秒）',
  },
  { key: 'memeImagePackIds', section: 'reaction', type: 'tags', default: [] },
  { key: 'memeImageTags', section: 'reaction', type: 'tags', default: [] },
  {
    key: 'memeImageInstruction',
    section: 'reaction',
    type: 'textarea',
    default: '輕鬆聊天時可搭配一張符合情緒的圖；嚴肅、求助或需要完整說明時優先文字，不要每句都發圖。',
    label: '自訂表情使用規則',
  },
  {
    key: 'stickerAutoSendEnabled',
    section: 'reaction',
    type: 'boolean',
    default: false,
  },

  // ── GIF ────────────────────────────────────────────────────────────────
  {
    key: 'gifEnabled',
    section: 'gif',
    type: 'boolean',
    default: true,
  },
  {
    key: 'gifProvider',
    section: 'gif',
    type: 'select',
    default: 'klipy',
    label: 'GIF 來源',
    options: [opt('klipy', 'KLIPY（Discord 搜尋）'), opt('custom', '自訂端點')],
  },
  {
    key: 'gifCustomEndpoint',
    section: 'gif',
    type: 'string',
    default: '',
  },
  {
    key: 'gifMaxResults',
    section: 'gif',
    type: 'number',
    default: 8,
    min: 1,
    max: 20,
    label: '每次結果數',
    help: '一次最多回傳幾個 GIF。',
  },
  {
    key: 'gifAccessMode',
    section: 'gif',
    type: 'select',
    default: 'all',
    label: '使用權限',
    help: '誰可以使用 GIF 功能。',
    options: [opt('all', '所有人'), opt('whitelist', '僅白名單')],
  },
  {
    key: 'gifAccessWhitelist',
    section: 'gif',
    type: 'tags',
    default: [],
    label: 'GIF 白名單',
    help: '啟用「僅白名單」時生效的使用者 ID。',
  },
  {
    key: 'gifSendAsReply',
    section: 'gif',
    type: 'boolean',
    default: true,
    label: '以回覆方式送出 GIF',
    help: '送出 GIF 時引用原訊息。',
  },

  // ── 對話記憶 ────────────────────────────────────────────────────────────
  {
    key: 'channelActionsEnabled',
    section: 'channelActions',
    type: 'boolean',
    default: false,
  },
  { key: 'channelForwardDestinationIds', section: 'channelActions', type: 'tags', default: [] },
  {
    key: 'channelLookupEnabled',
    section: 'history',
    type: 'boolean',
    default: false,
  },
  {
    key: 'memberNameUpdatesEnabled',
    section: 'history',
    type: 'boolean',
    default: true,
    label: '同步成員暱稱更新',
  },
  {
    key: 'historyEnabled',
    section: 'history',
    type: 'boolean',
    default: true,
  },
  {
    key: 'historyRetentionDays',
    section: 'history',
    type: 'number',
    default: 14,
    min: 1,
    max: 365,
    label: '保留天數',
    help: '超過天數的訊息會被清除。',
  },
  {
    key: 'historyMaxPerChannel',
    section: 'history',
    type: 'number',
    default: 200,
    min: 20,
    max: 2000,
    label: '每頻道保留則數',
    help: '單一頻道最多保留多少則。',
  },
  {
    key: 'historyIncludeBots',
    section: 'history',
    type: 'boolean',
    default: false,
    label: '記錄其他機器人',
  },
  {
    key: 'historyStoreAttachments',
    section: 'history',
    type: 'boolean',
    default: true,
    label: '記錄附件資訊',
  },

  // ── 日誌 ────────────────────────────────────────────────────────────────
  {
    key: 'logEnabled',
    section: 'log',
    type: 'boolean',
    default: true,
  },
  {
    key: 'logLevel',
    section: 'log',
    type: 'select',
    default: 'info',
    options: [opt('error', 'error'), opt('warn', 'warn'), opt('info', 'info'), opt('debug', 'debug')],
  },
  {
    key: 'logMaxEntries',
    section: 'log',
    type: 'number',
    default: 500,
    min: 50,
    max: 5000,
  },
  {
    key: 'logToFile',
    section: 'log',
    type: 'boolean',
    default: true,
  },
  {
    key: 'logRetentionDays',
    section: 'log',
    type: 'number',
    default: 7,
    min: 1,
    max: 90,
  },
  {
    key: 'logMessageContent',
    section: 'log',
    type: 'boolean',
    default: false,
    label: '記錄訊息內容',
  },

  // ── 模型 ────────────────────────────────────────────────────────────────
  {
    key: 'llmMode',
    section: 'llm',
    type: 'select',
    default: 'auto',
    label: '模型來源',
    options: [opt('auto', '自動'), opt('subscriptions', 'DSH 訂閱模型'), opt('custom', '自訂 API')],
  },
  {
    key: 'subscriptionProvider',
    section: 'llm',
    type: 'string',
    default: 'deepseek-account',
  },
  {
    key: 'subscriptionModel',
    section: 'llm',
    type: 'string',
    default: 'deepseek-v4-pro',
    label: '訂閱模型',
    help: '例如 deepseek-v4-pro。名稱要和你的 DSH 帳號實際可用的模型一致，存檔後可以按「測試模型」確認。',
  },
  {
    key: 'customLlmApiKey',
    section: 'llm',
    type: 'password',
    default: '',
    secret: true,
  },
  {
    key: 'customLlmApiBase',
    section: 'llm',
    type: 'string',
    default: 'https://api.deepseek.com',
  },
  {
    key: 'customLlmModel',
    section: 'llm',
    type: 'string',
    default: 'deepseek-chat',
    label: '自訂模型名稱',
    help: '例如 deepseek-chat / gpt-4o-mini。',
  },
  {
    key: 'maxReplyTokens',
    section: 'llm',
    type: 'number',
    default: 800,
    min: 64,
    max: 4000,
  },
  {
    key: 'temperature',
    section: 'llm',
    type: 'range',
    default: 0.8,
    min: 0,
    max: 2,
    step: 0.1,
  },

  // ── 提示詞 ──────────────────────────────────────────────────────────────
  {
    key: 'mentionPersonaPrompt',
    section: 'prompt',
    type: 'textarea',
    default:
      '你是一個熱情、友善且精通各類技術與話題的 Discord 好友。\n回覆請自然口語、避免像客服或 AI 助手的制式開場，不要條列式清單，長度 100 字以內。',
    label: '@ 回覆人格',
  },
  {
    key: 'dmPersonaPrompt',
    section: 'prompt',
    type: 'textarea',
    default:
      '你現在代表帳號本人私訊回覆。\n保持禮貌、簡潔、真誠，不透露自己是 AI 或機器人，不知道的事就說「我確認一下」。\n長度 120 字以內。',
    label: '私訊回覆人格',
  },
  {
    key: 'coChatPersonaPrompt',
    section: 'prompt',
    type: 'textarea',
    default:
      '你現在扮演 Discord 群組裡的一位活躍玩家朋友。\n用繁體中文和群組成員自然聊天，語氣輕鬆、偶爾開玩笑，可以附和或吐槽，但不要搶話。\n如果這話題你不該插話，請只輸出 [NO_REPLY]。\n長度 60 字以內。',
    label: '群組閒聊人格',
  },
  {
    key: 'antiAiFlavor',
    section: 'prompt',
    type: 'boolean',
    default: true,
  },
  {
    key: 'stripMarkdown',
    section: 'prompt',
    type: 'boolean',
    default: true,
    label: '移除 Markdown 標記',
  },

  // ── 進階 ────────────────────────────────────────────────────────────────
  {
    key: 'maxConcurrentReplies',
    section: 'advanced',
    type: 'number',
    default: 2,
    min: 1,
    max: 10,
    label: '同時處理上限',
  },
  {
    key: 'dryRun',
    section: 'advanced',
    type: 'boolean',
    default: true,
  },
  {
    key: 'statusRefreshSeconds',
    section: 'advanced',
    type: 'number',
    default: 30,
    min: 5,
    max: 300,
  },
];

FIELDS.push(
  { key: 'voiceEnabled', section: 'voice', type: 'boolean', default: false },
  {
    key: 'voiceAllowedChannelIds',
    section: 'voice',
    type: 'tags',
    default: [],
    label: '允許加入的語音房（留空不限）',
  },
  {
    key: 'voiceIdleMinutes',
    section: 'voice',
    type: 'number',
    default: 5,
    min: 1,
    max: 240,
    label: '閒置自動退出（分鐘）',
  },
  {
    key: 'voiceMaxSessionMinutes',
    section: 'voice',
    type: 'number',
    default: 120,
    min: 5,
    max: 720,
    label: '最長連線時間（分鐘）',
  },
  { key: 'voiceAutoSpeak', section: 'voice', type: 'boolean', default: false },
  {
    key: 'voiceVolume',
    section: 'voice',
    type: 'number',
    default: 65,
    min: 1,
    max: 100,
    label: '輸出音量（%）',
  },
  {
    key: 'voiceMaxSpeechSeconds',
    section: 'voice',
    type: 'number',
    default: 60,
    min: 5,
    max: 180,
    label: '單次語音上限（秒）',
  },
  {
    key: 'voiceMaxMusicMinutes',
    section: 'voice',
    type: 'number',
    default: 30,
    min: 1,
    max: 120,
    label: '單首音樂上限（分鐘）',
  },
  { key: 'voiceMaxTextChars', section: 'voice', type: 'number', default: 500, min: 20, max: 2000 },
  { key: 'voiceDailyCharacterLimit', section: 'voice', type: 'number', default: 10000, min: 0, max: 1000000 },
  { key: 'voiceTtsVoice', section: 'voice', type: 'string', default: '' },
  {
    key: 'voiceTtsAdapter',
    section: 'voice',
    type: 'select',
    default: 'auto',
    options: [
      opt('auto', '自動偵測'),
      opt('service', '宿主語音服務（小米 TTS 等）'),
      opt('dsh-tts', '目前自訂的 dsh-tts'),
      opt('memef1f1y', 'dsh-plugin-tts（Edge／RVC 等）'),
    ],
  },
  {
    key: 'voiceTtsService',
    section: 'voice',
    type: 'select',
    default: 'auto',
    options: [
      opt('auto', '自動：優先 DSH 聲音工坊'),
      opt('dshTts', 'DSH 聲音工坊（DSH-sound-atelier）'),
      opt('speechSynthesis', '宿主語音服務（小米 TTS 等）'),
    ],
  },
  { key: 'voiceTtsBaseUrl', section: 'voice', type: 'string', default: '' },
  { key: 'voiceTtsOptions', section: 'voice', type: 'textarea', default: '' },
  { key: 'voiceLlmCostPerMillion', section: 'voice', type: 'number', default: 0, min: 0, max: 100000 },
  { key: 'voiceTtsCostPerMillion', section: 'voice', type: 'number', default: 0, min: 0, max: 100000 },
  { key: 'voiceSttCostPerMinute', section: 'voice', type: 'number', default: 0, min: 0, max: 100000 },
  { key: 'voiceCostCurrency', section: 'voice', type: 'text', default: 'USD', label: '估算幣別' },
  { key: 'videoVisionEnabled', section: 'gif', type: 'boolean', default: false },
  { key: 'voiceReceiveEnabled', section: 'voice', type: 'boolean', default: false },
  { key: 'voiceReceiveConsent', section: 'voice', type: 'boolean', default: false },
  { key: 'voiceReceiveUserIds', section: 'voice', type: 'tags', default: [] },
  { key: 'voiceReceiveAutoReply', section: 'voice', type: 'boolean', default: false },
  { key: 'voiceReplyTextEnabled', section: 'voice', type: 'boolean', default: true },
  { key: 'voiceInterruptOnSpeech', section: 'voice', type: 'boolean', default: true },
  {
    key: 'voiceInterruptMode',
    section: 'voice',
    type: 'select',
    default: 'transcript',
    options: [opt('transcript', '辨識出文字後中止（較保守）'), opt('acoustic', '持續發聲後中止（較快）')],
  },
  { key: 'voiceInterruptMinMs', section: 'voice', type: 'number', default: 400, min: 200, max: 2000 },
  { key: 'voiceInputEchoGuard', section: 'voice', type: 'boolean', default: true },
  { key: 'voiceMessageEnabled', section: 'voice', type: 'boolean', default: false },
  { key: 'voiceMessageChannelIds', section: 'voice', type: 'tags', default: [] },
  { key: 'voiceMessageUserIds', section: 'voice', type: 'tags', default: [] },
  {
    key: 'voiceMessageMaxSeconds',
    section: 'voice',
    type: 'range',
    default: 60,
    min: 5,
    max: 120,
    step: 5,
    label: '單則錄音時長上限（秒）',
  },
  {
    key: 'voiceInputMaxSeconds',
    section: 'voice',
    type: 'number',
    default: 15,
    min: 2,
    max: 30,
    label: '每句收聽最長秒數',
  },
  { key: 'voiceSttDailySeconds', section: 'voice', type: 'number', default: 600, min: 0, max: 86400 },
  { key: 'voiceSttProvider', section: 'voice', type: 'text', default: '' },
  { key: 'voiceSttLanguage', section: 'voice', type: 'text', default: 'auto' },
  {
    key: 'voiceTranscriptScript',
    section: 'voice',
    type: 'select',
    default: 'twp',
    options: [
      { value: 'original', label: '保留辨識原文' },
      { value: 'tw', label: '繁體字形' },
      { value: 'twp', label: '繁體與常用詞' },
    ],
  },
  { key: 'voiceTranscriptTermsEnabled', section: 'voice', type: 'boolean', default: true },
  { key: 'voiceTranscriptGlossary', section: 'voice', type: 'textarea', default: '{}' },
  { key: 'voiceSubtitles', section: 'voice', type: 'boolean', default: false },
  {
    key: 'voiceMusicMode',
    section: 'voice',
    type: 'select',
    default: 'pause',
    options: [opt('pause', '暫停後接續'), opt('duck', 'Bot 雙音軌壓低／漸變')],
  },
  { key: 'voiceMusicPauseReceiveEnabled', section: 'voice', type: 'boolean', default: true },
  { key: 'voiceMusicDuckPercent', section: 'voice', type: 'number', default: 20, min: 0, max: 100 },
  { key: 'musicYtdlpPath', section: 'voice', type: 'string', default: '' },
  { key: 'voiceStreaming', section: 'voice', type: 'boolean', default: true },
  { key: 'voiceIncrementalReplies', section: 'voice', type: 'boolean', default: false },
  {
    key: 'voiceSpokenLanguage',
    section: 'voice',
    type: 'select',
    default: 'original',
    options: [opt('original', '與文字相同'), opt('ja', '日文配音，保留中文回覆')],
  },
  { key: 'voiceJapaneseFallback', section: 'voice', type: 'boolean', default: true },
  { key: 'voiceJapaneseGlossary', section: 'voice', type: 'textarea', default: '{}' },
  {
    key: 'voiceEmotionMode',
    section: 'voice',
    type: 'select',
    default: 'context',
    options: [opt('context', '依聊天上下文'), opt('fixed', '固定情緒'), opt('off', '沿用 TTS 設定')],
  },
  {
    key: 'voiceFixedEmotion',
    section: 'voice',
    type: 'select',
    default: 'neutral',
    label: '固定情緒',
    options: ['neutral', 'happy', 'excited', 'sad', 'calm', 'angry', 'afraid', 'surprised', 'whisper'].map(
      (id, i) => opt(id, ['自然', '開心', '興奮', '傷心', '平靜', '堅定生氣', '不安', '驚訝', '耳語'][i]),
    ),
  },
  {
    key: 'voiceEmotionIntensity',
    section: 'voice',
    type: 'number',
    default: 0.5,
    min: 0,
    max: 1,
    label: '固定情緒強度（0–1）',
  },
  {
    key: 'voiceEmotionPace',
    section: 'voice',
    type: 'select',
    default: 'normal',
    label: '固定語速傾向',
    options: [opt('normal', '自然'), opt('slow', '稍慢'), opt('fast', '稍快')],
  },
  { key: 'voiceSpeechInstruction', section: 'voice', type: 'textarea', default: '' },
);
FIELDS.push(
  { key: 'voiceReplayEnabled', section: 'voice', type: 'boolean', default: false },
  { key: 'proactiveEnabled', section: 'companion', type: 'boolean', default: false },
  {
    key: 'proactiveDailyLimit',
    section: 'companion',
    type: 'number',
    default: 1,
    min: 0,
    max: 10,
    label: '每日主動關心上限',
  },
  { key: 'conversationControlEnabled', section: 'companion', type: 'boolean', default: true },
  { key: 'pendingTopicsEnabled', section: 'companion', type: 'boolean', default: true },
  {
    key: 'pendingTopicsRetentionDays',
    section: 'companion',
    type: 'number',
    default: 14,
    min: 1,
    max: 30,
    label: '話題狀態保留天數',
  },
  { key: 'quietHoursEnabled', section: 'companion', type: 'boolean', default: false, label: '夜間只回文字' },
  {
    key: 'quietHoursStart',
    section: 'companion',
    type: 'number',
    default: 23,
    min: 0,
    max: 23,
    label: '安靜時段開始（時）',
  },
  {
    key: 'quietHoursEnd',
    section: 'companion',
    type: 'number',
    default: 8,
    min: 0,
    max: 23,
    label: '安靜時段結束（時）',
  },
  { key: 'singingAllowedUserIds', section: 'singing', type: 'tags', default: [] },
  { key: 'singingAdminGroupEnabled', section: 'singing', type: 'boolean', default: false },
  { key: 'singingEnabled', section: 'singing', type: 'boolean', default: false },
  { key: 'musicControlEnabled', section: 'reply', type: 'boolean', default: false },
  { key: 'knowledgeLookupEnabled', section: 'reply', type: 'boolean', default: false },
  { key: 'webLookupEnabled', section: 'reply', type: 'boolean', default: false },
  { key: 'memeLookupEnabled', section: 'reply', type: 'boolean', default: false },
  { key: 'messageCoalesceEnabled', section: 'reply', type: 'boolean', default: true },
  { key: 'messageCoalesceMs', section: 'reply', type: 'number', default: 650, min: 100, max: 2500 },
  {
    key: 'replyOwnership',
    section: 'reply',
    type: 'select',
    default: 'shared',
    options: [opt('shared', '同人格只回覆一次'), opt('separate', '明確使用不同人格，各自回覆')],
  },
  { key: 'feiyuMoodEnabled', section: 'sessions', type: 'boolean', default: true },
  { key: 'feiyuMoodSlot', section: 'sessions', type: 'string', default: '' },
);
FIELDS.push({
  key: 'replyChineseScript',
  section: 'reply',
  type: 'select',
  default: 'original',
  options: [opt('original', '保留模型輸出'), opt('traditional', '繁體中文'), opt('simplified', '简体中文')],
  label: 'AI 回覆字體',
});
FIELDS.push({
  key: 'replyDeliveryMode',
  section: 'reply',
  type: 'select',
  default: 'auto',
  options: [opt('auto', '自動送出'), opt('review', '先審稿')],
});
FIELDS.push(
  { key: 'tokenBudgetEnabled', section: 'advanced', type: 'boolean', default: false },
  {
    key: 'tokenBudgetMode',
    section: 'advanced',
    type: 'select',
    default: 'warn',
    label: '超額處理',
    options: [opt('warn', '提醒並繼續'), opt('block', '阻擋新模型呼叫')],
  },
  { key: 'tokenDailyLimit', section: 'advanced', type: 'number', default: 0, min: 0, max: 1000000000 },
  { key: 'tokenMonthlyLimit', section: 'advanced', type: 'number', default: 0, min: 0, max: 10000000000 },
);
// 語氣樣本（鄉民語氣）：前三個欄位每個對象各有一份，其餘是所有對象共用。
FIELDS.push(
  { key: 'slangToneEnabled', section: 'slang', type: 'boolean', default: false },
  {
    key: 'slangToneMode',
    section: 'slang',
    type: 'select',
    default: 'both',
    options: [opt('both', '看情境，沒有合適情境時再看機率'), opt('context', '只看情境'), opt('chance', '只看機率')],
  },
  { key: 'slangToneChance', section: 'slang', type: 'range', default: 15, min: 0, max: 100, step: 5 },
  { key: 'slangToneCooldownTurns', section: 'slang', type: 'number', default: 3, min: 0, max: 20 },
  { key: 'slangToneGroupFollow', section: 'slang', type: 'boolean', default: true },
  { key: 'slangToneTopicMatch', section: 'slang', type: 'boolean', default: true },
  {
    key: 'slangToneTriggerWords',
    section: 'slang',
    type: 'tags',
    default: ['笑死', '鄉民', 'PTT', '八卦', '推爆', '先推', '樓上', '樓下', '五樓', '酸民', '肥宅', '歐印', '韭菜', '塊陶', '4樓', '哈哈哈', 'XD', 'QQ'],
  },
  {
    key: 'slangToneSeriousWords',
    section: 'slang',
    type: 'tags',
    default: ['過世', '去世', '往生', '告別式', '喪禮', '癌', '住院', '手術', '急診', '車禍', '自殺', '想死', '憂鬱', '焦慮', '失眠', '確診', '生病', '受傷', '分手', '離婚', '吵架', '失業', '被騙', '被罵', '霸凌', '難過', '想哭', '崩潰', '低潮', '壓力', '心情很差', '心情不好', '好累'],
  },
  { key: 'slangToneSources', section: 'slang', type: 'tags', default: [] },
  { key: 'slangToneBlockWords', section: 'slang', type: 'tags', default: [] },
  { key: 'slangToneExcludedChannelIds', section: 'slang', type: 'tags', default: [] },
);
// 套用白話標籤與說明（只改顯示文字）；必須在產生各對象欄位之前，讓它們沿用同一份文字。
applyFieldText(FIELDS);
const COMMON_AUDIENCE_KEYS = [
  'slangToneEnabled',
  'slangToneMode',
  'slangToneChance',
  'memeImagesEnabled',
  'musicControlEnabled',
  'knowledgeLookupEnabled',
  'webLookupEnabled',
  'memeLookupEnabled',
  'replyChineseScript',
  'replyDeliveryMode',
  'cooldownSeconds',
  'roundCapPerUser',
  'contextMessages',
  'replyQuote',
  'pluginPersonaEnabled',
  'pluginStyleEnabled',
  'antiAiFlavorPromptEnabled',
  'antiAiFlavor',
  'stripMarkdown',
  'minReplyDelaySeconds',
  'maxReplyDelaySeconds',
  'gifEnabled',
  'gifVisionEnabled',
  'imageVisionEnabled',
  'emojiVisionEnabled',
  'autoReactionEnabled',
  'stickerUnderstandEnabled',
];
export const AUDIENCE_FIELDS = [];
for (const audience of ['admin', 'others']) {
  for (const scope of ['Dm', 'Group']) {
    const keys = [
      ...COMMON_AUDIENCE_KEYS,
      ...(scope === 'Dm'
        ? ['dmReplyEnabled', 'dmPersonaPrompt']
        : [
            'mentionReplyEnabled',
            'followupEnabled',
            'followupSeconds',
            'coChatEnabled',
            'coChatProbability',
            'coChatCooldownSeconds',
            'coChatMinHistoryMessages',
            'coChatMaxMessageChars',
            'coChatRequireKeyword',
            'interestKeywords',
            'monitoredChannelIds',
            'mentionPersonaPrompt',
            'coChatPersonaPrompt',
          ]),
    ];
    for (const baseKey of keys) {
      const original = FIELDS.find((f) => f.key === baseKey);
      if (!original) continue;
      // 其他使用者的私訊預設不回覆；需要時到對象設定開啟。已儲存過設定的安裝不受影響。
      const audienceDefault =
        audience === 'others' && scope === 'Dm' && baseKey === 'dmReplyEnabled' ? { default: false } : {};
      const field = {
        ...original,
        ...audienceDefault,
        key: `${audience}${scope}_${baseKey}`,
        section: `${audience}${scope}`,
        audienceBaseKey: baseKey,
        help: original.help || '',
      };
      FIELDS.push(field);
      AUDIENCE_FIELDS.push(field);
    }
  }
}

const AUDIENCE_FIELDS_BY_SECTION = new Map();
function audienceFieldsOf(section) {
  let list = AUDIENCE_FIELDS_BY_SECTION.get(section);
  if (!list) {
    list = AUDIENCE_FIELDS.filter((f) => f.section === section);
    AUDIENCE_FIELDS_BY_SECTION.set(section, list);
  }
  return list;
}

export function audienceConfig(config, userId, isDm = false) {
  const admin = Boolean(config.adminUserId && String(userId) === config.adminUserId);
  const prefix = `${admin ? 'admin' : 'others'}${isDm ? 'Dm' : 'Group'}`;
  const next = { ...config };
  // 只走該對象的欄位（每種約 30 個），不再每次比對全部對象欄位。
  for (const f of audienceFieldsOf(prefix))
    if (config[f.key] !== undefined) next[f.audienceBaseKey] = config[f.key];
  if (config.adminUserId)
    next.replyCooldownExemptUserIds = (config.replyCooldownExemptUserIds || []).filter(
      (id) => id !== config.adminUserId,
    );
  if (config.adminUserId)
    next.reactionControlUserIds = [
      ...new Set([...(config.reactionControlUserIds || []), config.adminUserId]),
    ];
  return next;
}

/** Bot 說明指令的內容：開關狀態取自發問者實際適用的對象設定（群聊看群聊對象、私訊看私訊對象）。 */
export function interactionHelpText(config, userId) {
  const group = audienceConfig(config, userId, false),
    dm = audienceConfig(config, userId, true);
  const flag = (value) => (value ? '開' : '關');
  return [
    '**Discord 賽博群友**',
    '/cyberfriend-help — 這份說明',
    '/cyberfriend-status — 連線狀態與今日統計',
    '/cyberfriend-reset — 清除本頻道的對話記憶',
    '',
    `目前介面：${TRANSPORT_INFO[config.primaryTransport]?.label || config.primaryTransport}，` +
      `對你的設定：@ 回覆 ${flag(group.mentionReplyEnabled)}、私訊 ${flag(dm.dmReplyEnabled)}、閒聊 ${flag(group.coChatEnabled)}`,
  ].join('\n');
}

/** 由 FIELDS 推導的完整預設設定。 */
export const DEFAULTS = Object.freeze(
  FIELDS.reduce((acc, field) => {
    acc[field.key] = Array.isArray(field.default) ? [...field.default] : field.default;
    return acc;
  }, {}),
);

export const FIELD_BY_KEY = new Map(FIELDS.map((f) => [f.key, f]));

/** UI conditions describe real backend gates; values are preserved while inactive. */
export function uiConditions(key) {
  const conditions = [];
  const when = (key, values, reason) => conditions.push({ key, values, reason });
  const audience = /^(adminDm|adminGroup|othersDm|othersGroup)_(.+)$/.exec(key);
  if (audience) {
    const [, prefix, base] = audience;
    if (base === 'antiAiFlavor')
      when(prefix + '_antiAiFlavorPromptEnabled', [true], '先開啟此對象的去 AI 味提示');
    if (base === 'dmPersonaPrompt' || base === 'mentionPersonaPrompt' || base === 'coChatPersonaPrompt')
      when(prefix + '_pluginPersonaEnabled', [true], '先啟用此對象的插件人格');
    if (base === 'followupSeconds') when(prefix + '_followupEnabled', [true], '先開啟 @ 後的延續對話');
    if (
      /^coChat(Probability|CooldownSeconds|MinHistoryMessages|MaxMessageChars|RequireKeyword)$/.test(base) ||
      base === 'interestKeywords'
    )
      when(prefix + '_coChatEnabled', [true], '先開啟此對象的閒聊插話');
    if (base === 'interestKeywords') when(prefix + '_coChatRequireKeyword', [true], '先啟用關鍵字條件');
  }
  if (
    [
      'userStatus',
      'userActivityType',
      'userActivityText',
      'userCustomStatusText',
      'userCustomStatusEmoji',
    ].includes(key)
  )
    when('userPresenceEnabled', [true], '先開啟由插件管理帳號外觀');
  if (key === 'userActivityText')
    when('userActivityType', ['playing', 'listening', 'watching', 'competing'], '先選擇要顯示的活動類型');
  if (key === 'userAutoTakeoverMinutes') when('userAutoTakeoverEnabled', [true], '先啟用自動接管');
  if (
    /(?:knowledgeLookupEnabled|webLookupEnabled|memeLookupEnabled|musicControlEnabled)$/.test(key) ||
    /^singing/.test(key)
  )
    when('replyEngine', ['dsh'], '需使用 DSH 正式會話模式');
  if (key === 'gifCustomEndpoint') when('gifProvider', ['custom'], '搜尋來源選擇自訂服務時才使用');
  if (key === 'gifAccessWhitelist') when('gifAccessMode', ['whitelist'], '先選擇 GIF 白名單模式');
  if (['customLlmApiKey', 'customLlmApiBase', 'customLlmModel'].includes(key))
    when('llmMode', ['custom'], '先選擇自訂模型 API');
  if (['subscriptionProvider', 'subscriptionModel'].includes(key))
    when('llmMode', ['subscriptions'], '先選擇訂閱模型');
  if (
    [
      'historyRetentionDays',
      'historyMaxPerChannel',
      'historyIncludeBots',
      'historyStoreAttachments',
    ].includes(key)
  )
    when('historyEnabled', [true], '先開啟歷史紀錄');
  if (['userThreadNameTemplate', 'userThreadArchiveMinutes'].includes(key))
    when('userAutoCreateThreads', [true], '先允許使用者帳號建立深入討論串');
  if (['botThreadNameTemplate', 'botThreadArchiveMinutes'].includes(key))
    when('botAutoCreateThreads', [true], '先允許模型建立長議題討論串');
  if (key === 'mediaPerceptionCacheDays') when('mediaPerceptionCacheEnabled', [true], '先開啟辨識快取');
  if (/^cultureChorus/.test(key) && key !== 'cultureChorusEnabled')
    when('cultureChorusEnabled', [true], '先開啟群聊接龍');
  if (['reactionFollowChance', 'reactionFollowMinCount'].includes(key))
    when('reactionFollowEnabled', [true], '先開啟「跟著別人按表情」');
  if (['memoryDiaryWriteEnabled', 'memoryDiaryWriter'].includes(key))
    when('memoryDiaryPersonaEnabled', [true], '先開啟人格日記');
  if (key === 'memoryDiaryWriter') when('memoryDiaryWriteEnabled', [true], '先開啟記憶插件入庫');
  if (['logLevel', 'logMaxEntries', 'logToFile', 'logMessageContent'].includes(key))
    when('logEnabled', [true], '先開啟除錯 log');
  if (key === 'logRetentionDays') when('logToFile', [true], '先開啟 log 檔案輸出');
  return conditions;
}

/**
 * 沒有實際作用、因此不在介面顯示的欄位（鍵與已儲存的值保留，相容舊設定）：
 * - replyIgnoreSelf：插件永遠不回覆自己送出的訊息，開或關結果相同。
 * - botProxyUrl：Bot 的 REST 與 Gateway 連線都沒有讀這個設定。
 */
const UI_HIDDEN_FIELDS = new Set(['replyIgnoreSelf', 'botProxyUrl']);
const AUDIENCE_BASE_KEYS = new Set(AUDIENCE_FIELDS.map((f) => f.audienceBaseKey));

/** UI 需要的欄位描述（不含秘密值本身）。 */
export function describeSchema() {
  return {
    sections: SECTIONS,
    groups: SECTION_GROUPS,
    transports: TRANSPORTS,
    transportInfo: TRANSPORT_INFO,
    fields: FIELDS.filter(
      (field) =>
        !LEGACY_USER_FIELDS.has(field.key) &&
        !UI_HIDDEN_FIELDS.has(field.key) &&
        !AUDIENCE_BASE_KEYS.has(field.key),
    ).map((field) => ({
      key: field.key,
      enabledWhen: uiConditions(field.key),
      section: field.section,
      type: field.type,
      label: field.label,
      help: field.help || '',
      transport: field.transport || 'both',
      options: field.options || null,
      suggestions: field.suggestions || null,
      min: field.min ?? null,
      max: field.max ?? null,
      step: field.step ?? null,
      secret: Boolean(field.secret),
      default: field.secret ? '' : field.default,
    })),
  };
}

function cleanStr(value, fallback = '') {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function cleanBool(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', '是', '開啟'].includes(v)) return true;
    if (['0', 'false', 'no', 'off', '否', '關閉'].includes(v)) return false;
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

function cleanNum(value, field, fallback) {
  const num = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').trim());
  if (!Number.isFinite(num)) return fallback;
  const min = field.min ?? -Infinity;
  const max = field.max ?? Infinity;
  const clamped = Math.min(max, Math.max(min, num));
  return field.type === 'number' || Number.isInteger(field.step) ? Math.round(clamped * 100) / 100 : clamped;
}

function cleanArr(value, fallback) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,\n;]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return Array.isArray(fallback) ? [...fallback] : [];
}

/**
 * 把任意來源（設定檔 / 前端 / 舊版設定）整理成合法設定。
 * 只保留 FIELDS 宣告過的鍵，其餘一律丟棄。
 * @param {Record<string, unknown>} raw
 * @returns {Record<string, unknown>}
 */
export function sanitizeConfig(raw) {
  const source = raw && typeof raw === 'object' ? { ...raw } : {};
  for (const f of AUDIENCE_FIELDS)
    if (source[f.key] === undefined && Object.hasOwn(source, f.audienceBaseKey))
      source[f.key] = source[f.audienceBaseKey];
  const next = {};
  for (const field of FIELDS) {
    const hasValue = Object.hasOwn(source, field.key);
    const value = hasValue ? source[field.key] : undefined;
    const fallback = Array.isArray(field.default) ? [...field.default] : field.default;
    switch (field.type) {
      case 'boolean':
        next[field.key] = cleanBool(value, fallback);
        break;
      case 'number':
      case 'range':
        next[field.key] = cleanNum(value, field, fallback);
        break;
      case 'select': {
        const text = cleanStr(value, String(fallback));
        const allowed = (field.options || []).map((option) => option.value);
        next[field.key] = allowed.includes(text) ? text : fallback;
        break;
      }
      case 'tags':
        next[field.key] = cleanArr(value, fallback);
        break;
      case 'textarea':
        next[field.key] = typeof value === 'string' ? value : fallback;
        break;
      case 'password':
        next[field.key] = typeof value === 'string' ? value.trim() : fallback;
        break;
      case 'string':
      default:
        next[field.key] = cleanStr(value, fallback);
        break;
    }
  }
  if (next.userJitterMaxSeconds < next.userJitterMinSeconds) {
    next.userJitterMaxSeconds = next.userJitterMinSeconds;
  }
  if (next.maxReplyDelaySeconds < next.minReplyDelaySeconds) {
    next.maxReplyDelaySeconds = next.minReplyDelaySeconds;
  }
  next.singingAllowedUserIds = (next.singingAllowedUserIds || []).filter((id) => /^\d{15,22}$/.test(id));
  if (next.adminUserId && !/^\d{15,22}$/.test(next.adminUserId)) next.adminUserId = '';
  for (const prefix of ['adminDm', 'adminGroup', 'othersDm', 'othersGroup']) {
    const min = `${prefix}_minReplyDelaySeconds`,
      max = `${prefix}_maxReplyDelaySeconds`;
    if (next[max] < next[min]) next[max] = next[min];
  }
  return next;
}

/**
 * 給 DSH loader / plugin manager 的設定 schema（寬鬆、避免任何值被吃掉）。
 * @param {any} z schemastery
 */
export function buildConfigSchema(z) {
  const shape = {};
  for (const field of FIELDS) {
    if (LEGACY_USER_FIELDS.has(field.key)) continue;
    let schema;
    switch (field.type) {
      case 'boolean':
        schema = z.boolean();
        break;
      case 'number':
      case 'range':
        schema = z.number();
        break;
      case 'tags':
        schema = z.array(z.string());
        break;
      case 'textarea':
        schema = z.string().description(field.label);
        if (typeof schema.role === 'function') schema = schema.role('textarea');
        break;
      case 'password':
        schema = z.string().description(field.label);
        if (typeof schema.role === 'function') schema = schema.role('secret');
        break;
      default:
        schema = z.string().description(field.label);
        break;
    }
    if (typeof schema.extra === 'function') schema = schema.extra('volatile', true);
    shape[field.key] = schema;
  }
  return z.object(shape);
}

/** 秘密欄位（不可回傳給前端明文，改回傳是否已設定）。 */
// gifApiKey 已不是設定欄位，但留在機密清單：舊設定檔若還帶著它，保存與遮蔽時仍要當成機密處理。
export const SECRET_KEYS = [...FIELDS.filter((field) => field.secret).map((field) => field.key), 'gifApiKey'];

/**
 * Token 指紋：只回傳 sha256 的前 8 碼。
 * 用途是分辨「你剛剛貼上的 Token」與「已經存進去的 Token」是不是同一把，
 * 又不會把 Token 本身寫進日誌或回給前端。
 */
export function tokenFingerprint(token) {
  const text = String(token || '').trim();
  if (!text) return null;
  return createHash('sha256').update(text).digest('hex').slice(0, 8);
}

/** 給前端的安全檢視：秘密欄位以 boolean 呈現「是否已設定」。 */
export function publicConfig(config) {
  const view = { ...config };
  for (const key of SECRET_KEYS) {
    // 已移除的舊機密欄位（gifApiKey）：設定裡沒有就不回傳幽靈欄位。
    if (!FIELD_BY_KEY.has(key) && config[key] === undefined) continue;
    const value = typeof config[key] === 'string' ? config[key] : '';
    view[key] = '';
    view[`${key}__set`] = value.length > 0;
    view[`${key}__fp`] = tokenFingerprint(value);
  }
  return view;
}
