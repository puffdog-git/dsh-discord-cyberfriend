import { NATIVE_COMMANDS, commandKey } from '../native-interactions.js';
import { botChannelRead, botChannelWrite } from '../channel-bot.js';
/**
 * src/transport/bot.js — Discord 機器人 (Bot) 傳輸層
 * ============================================================================
 * 不需要任何第三方套件：直接用 Node 內建的 WebSocket + fetch 走 Gateway v10 / REST v10。
 * 機器人介面的差異（與使用者帳號相比）：
 *   - 需要 Bot Token，並在 Developer Portal 開啟 MESSAGE CONTENT INTENT
 *   - 只看得到「有權限且已 @ 它或私訊它」的訊息（除非關閉內容意圖限制）
 *   - 可以建立 Thread、使用 Slash Command、Embed 回覆
 * ============================================================================
 */
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { normalizeMessage } from '../history.js';
import { sleep, truncate } from '../util.js';
import { setTimeout as abortableDelay } from 'node:timers/promises';

const API = 'https://discord.com/api/v10';
const GATEWAY = 'wss://gateway.discord.gg/?v=10&encoding=json';

/** 本插件註冊的斜線指令（用 cyberfriend- 前綴避開 /help、/reset 之類的常見名稱）。 */
const HUB_COMMANDS = [
  { name: 'cyberfriend-help', description: '顯示 Discord 賽博群友的指令說明' },
  { name: 'cyberfriend-status', description: '查看目前連線與今日統計' },
  { name: 'cyberfriend-reset', description: '清除這個頻道的對話記憶' },
];
// 改名前註冊過的指令（pyself-lab-*）：註冊或清除時一併刪掉，只認本插件自己用過的名稱。
const LEGACY_PREFIX = 'pyself-lab-';
const isLegacyCommand = (command) =>
  (command.type ?? 1) === 1 &&
  String(command.name || '').startsWith(LEGACY_PREFIX) &&
  [...HUB_COMMANDS, ...NATIVE_COMMANDS].some(
    (ours) =>
      (ours.type ?? 1) === 1 && ours.name === 'cyberfriend-' + command.name.slice(LEGACY_PREFIX.length),
  );

const INTENTS = {
  GUILDS: 1 << 0,
  GUILD_VOICE_STATES: 1 << 7,
  GUILD_MEMBERS: 1 << 1,
  GUILD_MESSAGE_REACTIONS: 1 << 10,
  DIRECT_MESSAGES: 1 << 12,
  DIRECT_MESSAGE_REACTIONS: 1 << 13,
  GUILD_MESSAGES: 1 << 9,
  MESSAGE_CONTENT: 1 << 15,
};

function encodeEmoji(emoji) {
  const text = String(emoji || '').trim();
  const custom = /^<a?:(\w+):(\d+)>$/.exec(text) || /^(\w+):(\d+)$/.exec(text);
  if (custom) return encodeURIComponent(`${custom[1]}:${custom[2]}`);
  return encodeURIComponent(text);
}

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export class BotTransport {
  constructor({
    log,
    onMessage,
    onReaction,
    onInteraction,
    onMessageChange,
    onMemberUpdate,
    WebSocketImpl = globalThis.WebSocket,
    random = Math.random,
  } = {}) {
    this.WebSocketImpl = WebSocketImpl;
    this.random = random;
    // Discord 沒有回應時不要無限期卡住（會佔住並行名額）；上傳檔案的請求給四倍時間。
    this.restTimeoutMs = 30000;
    this.downloadTimeoutMs = 20000;
    this.resumeGatewayUrl = '';
    this.gatewayGuard = null;
    this.lastDisconnect = null;
    this.disconnectCount = 0;
    this.kind = 'bot';
    this.log = log;
    this.onMessage = onMessage;
    this.onMessageChange = onMessageChange;
    this.onMemberUpdate = onMemberUpdate;
    this.onReaction = onReaction;
    this.onInteraction = onInteraction;
    this.ws = null;
    this.state = 'disconnected';
    this.message = '尚未登入';
    this.selfId = '';
    this.selfName = '';
    this.applicationId = '';
    this.sessionId = '';
    this.seq = null;
    this.heartbeatTimer = null;
    this.heartbeatInterval = 0;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.config = {};
    this.startedAt = 0;
    this.guildCount = 0;
    this.ping = 0;
    this.closing = false;
    this.presenceStatus = 'online';
    this.awaitingAck = false;
    this.lastBeat = 0;
  }

  get ready() {
    return this.state === 'connected' && Boolean(this.selfId);
  }

  getStatus() {
    return {
      transport: 'bot',
      ok: this.ready,
      state: this.state,
      message: this.message,
      user: this.selfId
        ? {
            id: this.selfId,
            tag: this.selfName,
            username: this.selfName,
            displayName: this.selfName,
            avatarUrl: '',
            bot: true,
          }
        : null,
      ping: Math.round(this.ping || 0),
      disconnectCount: this.disconnectCount,
      reconnectAttempts: this.reconnectAttempts,
      lastDisconnect: this.lastDisconnect,
      guildCount: this.guildCount,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
    };
  }

  // ---------------------------------------------------------------- REST ---
  async rest(method, path, options = {}) {
    const token = String(this.config.botToken || '').trim();
    if (!token) throw new Error('尚未填寫 Bot Token');
    const headers = { authorization: `Bot ${token}`, 'user-agent': 'DiscordHub (dsh, 1.0.0)' };
    let body;
    if (options.form) {
      body = options.form;
    } else if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    const timeoutMs = Math.max(1, Number(options.timeoutMs) || this.restTimeoutMs * (options.form ? 4 : 1));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const timeout = AbortSignal.timeout(timeoutMs);
      let response;
      try {
        response = await fetch(`${API}${path}`, {
          method,
          headers,
          body,
          signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
        });
      } catch (error) {
        // 只有「我們自己的逾時」才改寫成逾時錯誤；呼叫端的取消照原樣拋出。
        if (timeout.aborted && !options.signal?.aborted)
          throw Object.assign(new Error(`Discord API 逾時（${Math.round(timeoutMs / 1000)} 秒沒有回應）`), {
            code: 'DISCORD_TIMEOUT',
          });
        throw error;
      }
      if (response.status === 429) {
        let waitMs = 1000;
        try {
          const payload = await response.json();
          waitMs = Math.max(200, Math.ceil((payload.retry_after || 1) * 1000));
        } catch {
          /* 用預設值 */
        }
        await abortableDelay(waitMs, undefined, { signal: options.signal });
        continue;
      }
      const text = await response.text();
      if (!response.ok) {
        let detail = truncate(text, 300);
        try {
          detail = JSON.parse(text)?.message || detail;
        } catch {
          /* 保留原文 */
        }
        const error = new Error(`Discord API ${response.status}: ${detail}`);
        error.status = response.status;
        throw error;
      }
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }
    throw new Error('Discord API 連續被限流，請稍後再試');
  }

  // ------------------------------------------------------------- Gateway ---
  async searchGifs(query, options = {}) {
    const params = new URLSearchParams({
      q: String(query).slice(0, 120),
      provider: 'klipy',
      media_format: 'gif',
      locale: options.locale || 'zh-TW',
      limit: '20',
    });
    try {
      return {
        ok: true,
        items: await this.rest('GET', `/gifs/search?${params}`, { signal: options.signal }),
      };
    } catch {
      return { ok: false, error: 'Discord KLIPY 搜尋失敗' };
    }
  }
  async refreshAttachmentUrls(urls, options = {}) {
    try {
      return {
        ok: true,
        items:
          (
            await this.rest('POST', '/attachments/refresh-urls', {
              body: { attachment_urls: urls.slice(0, 3) },
              signal: options.signal,
            })
          ).refreshed_urls || [],
      };
    } catch {
      return { ok: false, error: '附件網址更新失敗' };
    }
  }

  async connect(config = {}) {
    if (this.state === 'connecting') return { ok: false, error: '正在連線中，請稍候' };
    this.config = config;
    const token = String(config.botToken || '').trim();
    if (!token) {
      this.state = 'error';
      this.message = '尚未填寫 Bot Token';
      return { ok: false, error: this.message };
    }
    this.closing = false;
    this.state = 'connecting';
    this.message = '正在驗證 Bot Token…';
    try {
      const me = await this.rest('GET', '/users/@me');
      this.selfId = me.id;
      this.selfName = me.username;
      this.applicationId = me.id;
    } catch (error) {
      this.state = 'error';
      this.message = truncate(error.message, 300);
      this.log?.error('bot.login', 'Bot Token 驗證失敗', { error: error.message });
      return { ok: false, error: this.message };
    }
    try {
      await this.openGateway();
    } catch (error) {
      this.state = 'error';
      this.message = truncate(error.message, 300);
      return { ok: false, error: this.message };
    }
    return new Promise((resolvePromise) => {
      const deadline = Date.now() + 20000;
      const timer = setInterval(() => {
        if (this.state === 'connected' || Date.now() > deadline) {
          clearInterval(timer);
          resolvePromise(
            this.state === 'connected'
              ? { ok: true, user: this.getStatus().user }
              : { ok: false, error: this.message || 'Gateway 連線逾時' },
          );
        }
      }, 250);
    });
  }

  intents() {
    let value =
      INTENTS.GUILDS |
      INTENTS.GUILD_VOICE_STATES |
      INTENTS.GUILD_MESSAGES |
      INTENTS.DIRECT_MESSAGES |
      INTENTS.GUILD_MESSAGE_REACTIONS |
      INTENTS.DIRECT_MESSAGE_REACTIONS;
    if (this.config.botMessageContentIntent !== false) value |= INTENTS.MESSAGE_CONTENT;
    if (this.config.botMembersIntent) value |= INTENTS.GUILD_MEMBERS;
    return value;
  }

  gatewayUrl() {
    const url = new URL((this.sessionId && this.seq !== null && this.resumeGatewayUrl) || GATEWAY);
    if (
      url.protocol !== 'wss:' ||
      !(url.hostname === 'gateway.discord.gg' || url.hostname.endsWith('.discord.gg')) ||
      url.username ||
      url.password
    )
      throw new Error('Invalid Discord Gateway URL');
    url.searchParams.set('v', '10');
    url.searchParams.set('encoding', 'json');
    return url.href;
  }

  clearSession() {
    this.sessionId = '';
    this.seq = null;
    this.resumeGatewayUrl = '';
  }

  clearGatewayGuard() {
    clearTimeout(this.gatewayGuard);
    this.gatewayGuard = null;
  }

  openGateway() {
    if (this.closing) return Promise.reject(new Error('Gateway 已停止'));
    if (this.ws && this.ws.readyState < 2) return Promise.resolve();
    return new Promise((resolvePromise, rejectPromise) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        if (error) rejectPromise(error);
        else resolvePromise();
      };
      let socket;
      try {
        socket = new this.WebSocketImpl(this.gatewayUrl());
      } catch (error) {
        finish(error);
        return;
      }
      this.ws = socket;
      this.clearGatewayGuard();
      this.gatewayGuard = setTimeout(() => {
        if (this.ws !== socket || this.closing) return;
        finish(new Error('Gateway 握手逾時'));
        this.restartGateway('handshake timeout');
      }, 30000);
      socket.addEventListener('open', () => {
        if (this.ws === socket && !this.closing) finish();
      });
      socket.addEventListener('error', () => {
        if (this.ws !== socket || this.closing) return;
        finish(new Error('無法連線到 Discord Gateway'));
        this.restartGateway('socket error');
      });
      socket.addEventListener('close', (event) => {
        // A late close from a logged-out socket must never stop the replacement's heartbeat.
        if (this.ws !== socket) {
          finish(new Error('Gateway 已被替換'));
          return;
        }
        this.ws = null;
        this.clearGatewayGuard();
        this.stopHeartbeat();
        if (!this.closing) {
          const code = event?.code ?? 1006;
          this.lastDisconnect = { code, at: new Date().toISOString() };
          this.disconnectCount++;
          this.log?.warn('bot.disconnect', 'Gateway 連線中斷', {
            code,
            resumable: !!this.sessionId,
            attempts: this.reconnectAttempts,
          });
          if ([4004, 4010, 4011, 4012, 4013, 4014].includes(code)) {
            this.state = 'error';
            this.message = 'Discord 拒絕連線（' + code + '），請檢查 Token、Intents 或分片設定';
            this.closing = true;
          } else {
            if ([1000, 1001, 4007, 4009].includes(code)) this.clearSession();
            this.state = 'connecting';
            this.message = '連線中斷（' + code + '），正在重新連線…';
            this.scheduleReconnect();
          }
        }
        finish(new Error('Gateway 連線關閉'));
      });
      socket.addEventListener('message', (event) => {
        if (this.ws !== socket || this.closing) return;
        let payload;
        try {
          payload = JSON.parse(String(event.data));
        } catch {
          return;
        }
        this.handleGateway(payload).catch((error) =>
          this.log?.warn('bot.gateway', '處理 Gateway 事件失敗', { error: error.message }),
        );
      });
    });
  }

  /** 執行事件處理函式；同步或非同步失敗都只記錄，不中斷 Gateway 事件處理。 */
  settleHandler(run) {
    try {
      Promise.resolve(run()).catch((error) =>
        this.log?.warn('bot.gateway', '事件處理函式失敗', { error: error?.message }),
      );
    } catch (error) {
      this.log?.warn('bot.gateway', '事件處理函式失敗', { error: error?.message });
    }
  }

  sendSocket(payload) {
    try {
      if (this.ws && this.ws.readyState === 1) {
        this.ws.send(JSON.stringify(payload));
        return true;
      }
    } catch {
      this.log?.debug('bot.socket', '送出失敗');
    }
    return false;
  }

  restartGateway(reason, minDelay = 0) {
    const socket = this.ws;
    this.ws = null; // invalidate handlers before close (also protects synchronous mocks)
    this.clearGatewayGuard();
    this.stopHeartbeat();
    this.state = 'connecting';
    try {
      socket?.close(4000, reason);
    } catch {
      /* already closed */
    }
    this.scheduleReconnect(minDelay);
  }

  sendHeartbeat() {
    if (this.sendSocket({ op: 1, d: this.seq })) {
      this.lastBeat = Date.now();
      this.awaitingAck = true;
    }
  }

  startHeartbeat(interval) {
    this.stopHeartbeat();
    this.heartbeatInterval = interval;
    const socket = this.ws;
    const beat = () => {
      if (this.ws !== socket || this.closing) return;
      if (this.awaitingAck) {
        this.log?.warn('bot.heartbeat', '心跳沒有回應，重新建立連線');
        this.restartGateway('heartbeat timeout');
        return;
      }
      this.sendHeartbeat();
      this.heartbeatTimer = setTimeout(beat, interval);
    };
    // The next full interval starts AFTER the jittered first beat, not at HELLO.
    this.heartbeatTimer = setTimeout(beat, Math.floor(interval * this.random()));
  }

  stopHeartbeat() {
    clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.awaitingAck = false;
  }

  scheduleReconnect(minDelay = 0) {
    if (this.closing || this.reconnectTimer) return;
    this.reconnectAttempts++;
    const delay = Math.max(
      minDelay,
      Math.min(30000, 1000 * 2 ** Math.min(this.reconnectAttempts, 5)) + Math.floor(this.random() * 1000),
    );
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.closing) return;
      try {
        await this.openGateway();
      } catch {
        if (!this.closing) this.scheduleReconnect();
      }
    }, delay);
  }

  async handleGateway(payload) {
    const { op, d, t } = payload;
    if (typeof payload.s === 'number') this.seq = payload.s;
    switch (op) {
      case 10: // HELLO
        this.startHeartbeat(d?.heartbeat_interval || 41250);
        if (this.sessionId && this.seq !== null) {
          this.sendSocket({
            op: 6,
            d: { token: this.config.botToken, session_id: this.sessionId, seq: this.seq },
          });
        } else {
          this.sendSocket({
            op: 2,
            d: {
              token: this.config.botToken,
              intents: this.intents(),
              properties: {
                os: process.platform,
                browser: 'dsh-discord-cyberfriend',
                device: 'dsh-discord-cyberfriend',
              },
              presence: this.buildPresence(),
            },
          });
        }
        break;
      case 11: // HEARTBEAT ACK
        this.awaitingAck = false;
        this.ping = this.lastBeat ? Date.now() - this.lastBeat : 0;
        break;
      case 1: // 要求立即心跳
        this.sendHeartbeat();
        break;
      case 7: // RECONNECT: preserve the resumable session with a non-normal close.
        this.message = 'Discord 要求重新連線…';
        this.log?.info('bot.reconnect.request', 'Discord 要求恢復 Gateway');
        this.restartGateway('server reconnect');
        break;
      case 9: // INVALID SESSION: true resumes; false starts a new session on a new socket.
        if (!d) this.clearSession();
        this.message = d ? '正在恢復 Discord 連線…' : 'Discord 工作階段已失效，重新登入…';
        this.log?.warn('bot.session', 'Discord 工作階段失效', { resumable: !!d });
        this.restartGateway('invalid session', 1000 + Math.floor(this.random() * 4000));
        break;
      default:
        break;
    }
    if (op !== 0 || !t) return;
    if (t === 'VOICE_STATE_UPDATE' || t === 'VOICE_SERVER_UPDATE') this.voiceGateway?.(t, d);
    if (
      this.config.memberNameUpdatesEnabled !== false &&
      (t === 'GUILD_MEMBER_UPDATE' || (t === 'VOICE_STATE_UPDATE' && d.member))
    ) {
      const m = d.member || d,
        u = m.user || d.user || {};
      this.onMemberUpdate?.({
        guildId: d.guild_id,
        userId: u.id || d.user_id,
        ...(Object.hasOwn(u, 'username') ? { username: u.username } : {}),
        ...(Object.hasOwn(u, 'global_name') ? { displayName: u.global_name } : {}),
        ...(Object.hasOwn(m, 'nick') ? { guildNickname: m.nick } : {}),
      });
    }
    switch (t) {
      case 'READY': {
        this.clearGatewayGuard();
        this.sessionId = d?.session_id || '';
        this.resumeGatewayUrl = d?.resume_gateway_url || '';
        this.selfId = d?.user?.id || this.selfId;
        this.selfName = d?.user?.username || this.selfName;
        this.applicationId = d?.application?.id || this.applicationId;
        this.guildCount = Array.isArray(d?.guilds) ? d.guilds.length : this.guildCount;
        this.state = 'connected';
        this.startedAt = Date.now();
        this.reconnectAttempts = 0;
        this.message = `已以 ${this.selfName}#${d?.user?.discriminator || '0'} 登入`;
        this.log?.info('bot.ready', this.message, { userId: this.selfId, guildCount: this.guildCount });
        if (this.config.botSlashCommands) this.registerSlashCommands({ onReady: true }).catch(() => {});
        break;
      }
      case 'RESUMED':
        this.clearGatewayGuard();
        this.reconnectAttempts = 0;
        this.log?.info('bot.resumed', '已恢復 Gateway 連線');
        this.state = 'connected';
        this.message = '已恢復連線';
        break;
      case 'MESSAGE_CREATE':
        this.handleMessage(d);
        break;
      case 'MESSAGE_UPDATE':
        this.settleHandler(() =>
          this.onMessageChange?.({
            event: d.edited_timestamp ? 'message_edit' : 'message_preview',
            channelId: d.channel_id,
            messageId: d.id,
            guildId: d.guild_id,
            embedDetails: normalizeMessage(d, 'bot', this.selfId).embedDetails,
          }),
        );
        break;
      case 'MESSAGE_DELETE':
      case 'MESSAGE_DELETE_BULK':
        for (const messageId of d.ids || [d.id])
          this.settleHandler(() =>
            this.onMessageChange?.({
              event: 'message_delete',
              channelId: d.channel_id,
              messageId,
              guildId: d.guild_id,
            }),
          );
        break;
      case 'MESSAGE_REACTION_REMOVE':
      case 'MESSAGE_REACTION_ADD':
        this.settleHandler(() =>
          this.onReaction?.({
            transport: 'bot',
            guildId: d?.guild_id || null,
            removed: t === 'MESSAGE_REACTION_REMOVE',
            channelId: d?.channel_id,
            messageId: d?.message_id,
            emoji: d?.emoji?.id ? `${d.emoji.name}:${d.emoji.id}` : d?.emoji?.name || '',
            userId: d?.user_id,
            dm: Boolean(d?.guild_id === undefined),
          }),
        );
        break;
      case 'INTERACTION_CREATE':
        this.settleHandler(() => this.onInteraction?.(d));
        break;
      default:
        break;
    }
  }

  /**
   * 組 presence 物件。
   * 注意：`since` 一定要存在（null 或 0），少了它 Discord 會回 4002
   * 「Error while decoding payload」並直接關閉 Gateway 連線。
   */
  buildPresence(status) {
    const typeMap = { playing: 0, listening: 2, watching: 3, custom: 4, competing: 5 };
    const text = String(this.config.botActivityText || '').trim();
    const type = typeMap[this.config.botActivityType] ?? 0;
    let activities = [];
    if (text) {
      // 自訂狀態（type 4）的文字放在 state，name 只放固定字串。
      activities = type === 4 ? [{ name: 'Custom Status', type: 4, state: text }] : [{ name: text, type }];
    }
    return {
      status: status || this.presenceStatus || 'online',
      since: null,
      afk: false,
      activities,
    };
  }

  async setActivity(status) {
    if (status) this.presenceStatus = status;
    const payload = this.buildPresence();
    const sent = this.sendSocket({ op: 3, d: payload });
    return sent
      ? { ok: true, status: payload.status, activity: payload.activities[0]?.name || '' }
      : { ok: false, error: 'Gateway 尚未連線' };
  }

  handleMessage(d) {
    try {
      const selfId = this.selfId;
      const normalized = normalizeMessage({ ...d, edited: Boolean(d.edited_timestamp) }, 'bot', selfId);
      if (d.type === 19 && d.referenced_message) normalized.replyTo = d.referenced_message.id;
      return Promise.resolve(this.onMessage?.(normalized, d)).catch(() =>
        this.log?.warn('bot.message', '訊息處理失敗'),
      );
    } catch (error) {
      this.log?.warn('bot.message', '解析訊息失敗', { error: error.message });
    }
  }

  async disconnect() {
    this.closing = true;
    const socket = this.ws;
    this.ws = null;
    this.clearGatewayGuard();
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      if (socket && socket.readyState < 2) socket.close(1000, 'logout');
    } catch {
      /* 已關閉 */
    }
    this.clearSession();
    this.state = 'disconnected';
    this.message = '已登出';
    this.startedAt = 0;
    this.log?.info('bot.logout', '已登出機器人');
    await this.voiceOutput?.leave().catch(() => {});
    return { ok: true };
  }

  // ---------------------------------------------------------------- API ---
  async sendTyping(channelId, durationMs = 1500) {
    try {
      await this.rest('POST', `/channels/${channelId}/typing`);
      await sleep(Math.max(0, durationMs));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: truncate(error.message, 200) };
    }
  }

  /**
   * @param {string} channelId
   * @param {{content?:string, replyToMessageId?:string, mention?:boolean, simulateTyping?:boolean,
   *          files?:string[], fileUrls?:string[], stickerIds?:string[], embed?:object}} options
   */
  async sendMessage(channelId, options = {}) {
    const content = String(options.content || '');
    const files = (options.files || []).filter(Boolean);
    const fileUrls = (options.fileUrls || []).filter(Boolean);
    const stickerIds = (options.stickerIds || []).filter(Boolean);
    const vm = options.voiceMessage;
    if (vm) {
      const waveform = typeof vm.waveform === 'string' ? Buffer.from(vm.waveform, 'base64') : Buffer.alloc(0);
      if (
        content.trim() ||
        files.length !== 1 ||
        fileUrls.length ||
        stickerIds.length ||
        options.embed ||
        !Number.isFinite(vm.durationSecs) ||
        vm.durationSecs <= 0 ||
        vm.durationSecs > 600 ||
        !waveform.length ||
        waveform.length > 256 ||
        waveform.toString('base64') !== vm.waveform
      )
        return { ok: false, error: '語音訊息格式不正確' };
    }
    if (!content.trim() && !files.length && !fileUrls.length && !stickerIds.length && !options.embed) {
      return { ok: false, error: '訊息內容為空' };
    }
    try {
      if (options.simulateTyping) await this.sendTyping(channelId, 1200 + Math.random() * 1500);
      const payload = {
        content: content || undefined,
        allowed_mentions: { repliedUser: options.mention !== false },
      };
      if (vm) payload.flags = 8192;
      if (options.replyToMessageId) {
        payload.message_reference = {
          message_id: String(options.replyToMessageId),
          fail_if_not_exists: false,
          type: 0,
        };
      }
      if (stickerIds.length) payload.sticker_ids = stickerIds.map(String);
      if (options.embed) payload.embeds = [options.embed];
      if (files.length || fileUrls.length) {
        // Discord 不接受「外部網址」當作 attachment（會回 Invalid Form Body），
        // 所以網址一律先下載再以 multipart 上傳；下載失敗才退回貼連結。
        const form = new FormData();
        const attachmentMeta = [];
        let index = 0;
        const addBuffer = (buffer, name) => {
          if (vm && buffer.length > 8 * 1024 * 1024) throw Error('語音訊息超過8MiB');
          form.append(`files[${index}]`, new Blob([buffer], vm ? { type: 'audio/ogg' } : undefined), name);
          attachmentMeta.push({
            id: String(index),
            filename: name,
            ...(vm ? { duration_secs: vm.durationSecs, waveform: vm.waveform } : {}),
          });
          index += 1;
        };
        for (const filePath of files.slice(0, 5)) {
          addBuffer(await readFile(filePath), basename(filePath));
        }
        const failedUrls = [];
        for (const url of fileUrls.slice(0, 5)) {
          try {
            const res = await fetch(url, {
              redirect: 'follow',
              signal: AbortSignal.timeout(this.downloadTimeoutMs),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            if (Number(res.headers.get('content-length')) > MAX_ATTACHMENT_BYTES) throw new Error('檔案過大');
            const buffer = Buffer.from(await res.arrayBuffer());
            if (buffer.length > MAX_ATTACHMENT_BYTES) throw new Error('檔案過大');
            if (!buffer.length) throw new Error('空檔案');
            const mime = String(res.headers.get('content-type') || '')
              .split(';')[0]
              .trim();
            const ext =
              {
                'image/png': 'png',
                'image/jpeg': 'jpg',
                'image/gif': 'gif',
                'image/webp': 'webp',
                'image/apng': 'apng',
                'video/mp4': 'mp4',
                'video/webm': 'webm',
              }[mime] || 'bin';
            let name = 'attachment';
            try {
              name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '') || 'attachment';
            } catch {
              /* 用預設名 */
            }
            name = name.replace(/[^\w.\-]/g, '').slice(0, 48) || 'attachment';
            if (!/\.[A-Za-z0-9]{2,5}$/.test(name)) name = `${name}.${ext}`;
            addBuffer(buffer, name);
          } catch (error) {
            failedUrls.push(url);
            this.log?.warn('bot.send', '附件網址下載失敗，改用連結', {
              url: url.slice(0, 80),
              error: error?.message,
            });
          }
        }
        if (failedUrls.length) {
          payload.content = [payload.content, failedUrls.join('\n')].filter(Boolean).join('\n');
        }
        if (index === 0) {
          const fallback = await this.rest('POST', `/channels/${channelId}/messages`, { body: payload });
          return { ok: true, messageId: fallback?.id, channelId, note: '附件網址無法下載，已改為文字連結' };
        }
        payload.attachments = [...(payload.attachments || []), ...attachmentMeta];
        form.append('payload_json', JSON.stringify(payload));
        const message = await this.rest('POST', `/channels/${channelId}/messages`, { form });
        return { ok: true, messageId: message?.id, channelId };
      }
      const message = await this.rest('POST', `/channels/${channelId}/messages`, { body: payload });
      return { ok: true, messageId: message?.id, channelId };
    } catch (error) {
      // 引用回覆失敗（例如訊息已被刪除或 id 不合法）時，退回一般訊息再送一次，
      // 不要讓「能不能引用」決定整個回覆的成敗。
      if (
        !vm &&
        error?.status === 400 &&
        /message_reference|Invalid Form Body/i.test(String(error.message))
      ) {
        try {
          const retryPayload = { content: content || undefined, allowed_mentions: { repliedUser: false } };
          if (stickerIds.length) retryPayload.sticker_ids = stickerIds.map(String);
          if (options.embed) retryPayload.embeds = [options.embed];
          const fallback = await this.rest('POST', `/channels/${channelId}/messages`, { body: retryPayload });
          this.log?.warn('bot.send', '引用回覆失敗，已改為一般訊息送出', {
            error: truncate(error.message, 160),
          });
          return { ok: true, messageId: fallback?.id, channelId, note: '引用回覆失敗，已改為一般訊息' };
        } catch (retryError) {
          error = retryError;
        }
      }
      this.log?.warn('bot.send', '發送訊息失敗', { error: error.message });
      // 請求已送出但沒等到回應：Discord 可能已收下，回報為結果不確定，讓上層不要重送。
      return {
        ok: false,
        ...(error?.code === 'DISCORD_TIMEOUT' ? { uncertain: true } : {}),
        error: truncate(error.message, 300),
      };
    }
  }

  async sendReaction(channelId, messageId, emoji) {
    try {
      await this.rest(
        'PUT',
        `/channels/${channelId}/messages/${messageId}/reactions/${encodeEmoji(emoji)}/@me`,
      );
      return { ok: true };
    } catch (error) {
      return { ok: false, error: truncate(error.message, 200) };
    }
  }

  async removeReaction(channelId, messageId, emoji) {
    try {
      await this.rest(
        'DELETE',
        `/channels/${channelId}/messages/${messageId}/reactions/${encodeEmoji(emoji)}/@me`,
      );
      return { ok: true };
    } catch (error) {
      return { ok: false, error: truncate(error.message, 200) };
    }
  }

  async memberName(guildId, userId) {
    if (!/^\d{15,22}$/.test(String(userId)) || (guildId && !/^\d{15,22}$/.test(String(guildId))))
      return { ok: false };
    try {
      const m = guildId
        ? await this.rest('GET', `/guilds/${guildId}/members/${userId}`)
        : { user: await this.rest('GET', `/users/${userId}`) };
      return {
        ok: true,
        author: {
          username: m.user?.username,
          displayName: m.user?.global_name,
          guildNickname: m.nick ?? null,
        },
      };
    } catch {
      return { ok: false, error: '無法讀取此成員稱呼' };
    }
  }
  async getMessage(channelId, messageId, options = {}) {
    try {
      const accountId = this.selfId;
      const raw = await this.rest('GET', `/channels/${channelId}/messages/${messageId}`, options);
      if (raw.id !== messageId || raw.channel_id !== channelId) throw Error('訊息來源不符');
      // REST 訊息通常沒有 guild_id；向 Discord 查證頻道，不能用呼叫端期待的伺服器補值。
      if (raw.guild_id === undefined) {
        const channel = await this.rest('GET', `/channels/${channelId}`, options);
        if (channel.id !== channelId || (!channel.guild_id && ![1, 3].includes(channel.type)))
          throw Error('無法確認訊息所屬頻道');
        raw.guild_id = channel.guild_id || null;
      }
      if (this.selfId !== accountId) throw Error('讀取期間帳號已變更');
      return { ok: true, message: normalizeMessage(raw, 'bot', this.selfId) };
    } catch {
      return { ok: false, error: '無法讀取訊息預覽' };
    }
  }

  channelRead(action, args) {
    return botChannelRead(this, action, args);
  }
  channelWrite(action, args) {
    return botChannelWrite(this, action, args);
  }
  editMessage(channelId, messageId, content) {
    return this.rest('PATCH', `/channels/${channelId}/messages/${messageId}`, {
      body: { content, allowed_mentions: { parse: [] } },
    });
  }
  deleteMessage(channelId, messageId) {
    return this.rest('DELETE', `/channels/${channelId}/messages/${messageId}`);
  }
  async getPins(channelId, limit = 20) {
    if (!/^\d{15,22}$/.test(String(channelId))) return { ok: false, error: '頻道 ID 無效' };
    try {
      const count = Math.max(1, Math.min(20, Math.floor(Number(limit) || 20)));
      const result = await this.rest('GET', `/channels/${channelId}/messages/pins?limit=${count}`);
      if (!Array.isArray(result?.items)) return { ok: false, error: '置頂服務回傳格式不相容' };
      return {
        ok: true,
        messages: result.items
          .slice(0, count)
          .map((item) => normalizeMessage(item.message, 'bot', this.selfId)),
        hasMore: !!result.has_more,
      };
    } catch {
      return { ok: false, error: '無法讀取置頂訊息；請確認檢視頻道與讀取訊息歷史權限' };
    }
  }
  async getMessages(channelId, limit = 20) {
    try {
      const list = await this.rest(
        'GET',
        `/channels/${channelId}/messages?limit=${Math.max(1, Math.min(50, Number(limit) || 20))}`,
      );
      return {
        ok: true,
        messages: (list || [])
          .reverse()
          .map((d) => normalizeMessage({ ...d, edited: Boolean(d.edited_timestamp) }, 'bot', this.selfId)),
      };
    } catch (error) {
      return { ok: false, error: truncate(error.message, 300) };
    }
  }

  /** 伺服器的自訂表情（給設定介面的表情選擇器）。 */
  async getEmojis(guildId) {
    if (!/^\d{17,20}$/.test(String(guildId || ''))) return { ok: false, error: '需要伺服器 ID' };
    try {
      const list = await this.rest('GET', `/guilds/${guildId}/emojis`);
      return {
        ok: true,
        emojis: (Array.isArray(list) ? list : []).slice(0, 500).map((emoji) => ({
          id: String(emoji.id),
          name: String(emoji.name || 'emoji'),
          animated: Boolean(emoji.animated),
          available: emoji.available !== false,
          code: `<${emoji.animated ? 'a' : ''}:${emoji.name || 'emoji'}:${emoji.id}>`,
          url: `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'webp'}?size=48`,
        })),
      };
    } catch (error) {
      return { ok: false, error: truncate(error.message, 300) };
    }
  }

  async getGuilds() {
    try {
      const list = await this.rest('GET', '/users/@me/guilds?with_counts=true');
      return {
        ok: true,
        guilds: (list || []).map((guild) => ({
          id: guild.id,
          name: guild.name,
          memberCount: guild.approximate_member_count ?? null,
          iconUrl: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64` : '',
        })),
      };
    } catch (error) {
      return { ok: false, error: truncate(error.message, 300) };
    }
  }

  async getChannels(guildId, { includeVoice = false } = {}) {
    try {
      if (!guildId) {
        const guilds = await this.getGuilds();
        const channels = [];
        for (const guild of (guilds.guilds || []).slice(0, 12)) {
          const list = await this.rest('GET', `/guilds/${guild.id}/channels`).catch(() => []);
          for (const channel of list || []) {
            if (channel.type === 0 || channel.type === 5 || (includeVoice && channel.type === 2)) {
              channels.push({
                id: channel.id,
                name: channel.name,
                type: channel.type,
                guildId: guild.id,
                guildName: guild.name,
              });
            }
          }
        }
        return { ok: true, channels };
      }
      const list = await this.rest('GET', `/guilds/${guildId}/channels`);
      return {
        ok: true,
        channels: (list || [])
          .filter((channel) => channel.type === 0 || channel.type === 5 || (includeVoice && channel.type === 2))
          .map((channel) => ({ id: channel.id, name: channel.name, type: channel.type, guildId })),
      };
    } catch (error) {
      return { ok: false, error: truncate(error.message, 300) };
    }
  }

  async getDMs() {
    try {
      const list = await this.rest('GET', '/users/@me/channels');
      return {
        ok: true,
        dms: (list || [])
          .filter((channel) => channel.type === 1 || channel.type === 3)
          .map((channel) => ({
            id: channel.id,
            recipient: {
              id: channel.recipients?.[0]?.id,
              name: channel.recipients?.[0]?.global_name || channel.recipients?.[0]?.username,
              tag: channel.recipients?.[0]?.username,
            },
          })),
      };
    } catch (error) {
      return { ok: false, error: truncate(error.message, 300) };
    }
  }

  async resolveMediaAsset({ type, id, guildId, channelId }) {
    try {
      const channel = await this.rest('GET', `/channels/${channelId}`);
      if (String(channel.guild_id) !== String(guildId)) return { ok: false };
      if (type === 'emoji') {
        const e = await this.rest('GET', `/guilds/${guildId}/emojis/${id}`);
        if (e.available === false) return { ok: false };
        return { ok: true, type, text: `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>` };
      }
      if (type === 'sticker') {
        const list = await this.rest('GET', `/guilds/${guildId}/stickers`);
        const found = list.find((s) => String(s.id) === String(id) && s.available !== false);
        return found ? { ok: true, type, id: String(id) } : { ok: false };
      }
    } catch {}
    return { ok: false };
  }
  async searchStickers(query = '', { channelId } = {}) {
    try {
      const channel = channelId ? await this.rest('GET', `/channels/${channelId}`) : null;
      const guilds = channel?.guild_id
        ? { guilds: [{ id: channel.guild_id, name: channel.guild_id }] }
        : await this.getGuilds();
      const needle = String(query || '')
        .toLowerCase()
        .trim();
      const stickers = [];
      for (const guild of (guilds.guilds || []).slice(0, 8)) {
        const list = await this.rest('GET', `/guilds/${guild.id}/stickers`).catch(() => []);
        for (const sticker of list || []) {
          if (
            sticker.available !== false &&
            (!needle ||
              String(sticker.name || '')
                .toLowerCase()
                .includes(needle))
          ) {
            stickers.push({ id: sticker.id, name: sticker.name, guildName: guild.name });
          }
        }
      }
      let warning;
      // Official packs are public catalog metadata. Keep guild matches first,
      // and cache the bounded catalog so automatic replies do not fetch it each turn.
      if (stickers.length < 40) {
        try {
          if (!this.standardStickerCatalog || this.standardStickerCatalog.until < Date.now()) {
            const catalog = await this.rest('GET', '/sticker-packs');
            const rows = [];
            for (const pack of (catalog?.sticker_packs || []).slice(0, 100)) {
              for (const sticker of (pack.stickers || []).slice(0, 100)) {
                if (rows.length >= 2000) break;
                if (sticker.type !== 1 || !/^\d{15,22}$/.test(String(sticker.id))) continue;
                rows.push({
                  id: String(sticker.id), name: String(sticker.name || '').slice(0, 100),
                  description: String(sticker.description || '').slice(0, 300),
                  tags: String(sticker.tags || '').slice(0, 500),
                  kind: 'standard', formatType: Number(sticker.format_type),
                });
              }
            }
            this.standardStickerCatalog = { rows, until: Date.now() + 300000 };
          }
          for (const sticker of this.standardStickerCatalog.rows) {
            if (stickers.length >= 40) break;
            if ((!needle || [sticker.name, sticker.description, sticker.tags].join(' ').toLowerCase().includes(needle)) &&
                !stickers.some((row) => row.id === sticker.id)) stickers.push(sticker);
          }
        } catch {
          warning = '官方貼圖包暫時無法讀取；仍顯示已取得的伺服器貼圖';
        }
      }
      return { ok: true, stickers: stickers.slice(0, 40), ...(warning ? { warning } : {}) };
    } catch (error) {
      return { ok: false, error: truncate(error.message, 300) };
    }
  }

  /** 為「機器人 @ 訊息」建立原生 Thread（上游 dsh-im 群組頻道的做法）。 */
  async createThread(channelId, messageId, name, archiveMinutes = 1440) {
    try {
      const thread = await this.rest('POST', `/channels/${channelId}/messages/${messageId}/threads`, {
        body: {
          name: truncate(name || 'DSH 對話', 90),
          auto_archive_duration: Number(archiveMinutes) || 1440,
        },
      });
      return { ok: true, threadId: thread?.id };
    } catch (error) {
      return { ok: false, error: truncate(error.message, 200) };
    }
  }

  async listCommands() {
    const list = await this.rest('GET', `/applications/${this.applicationId}/commands`);
    return Array.isArray(list) ? list : [];
  }

  /**
   * 註冊本插件的斜線指令。
   * 刻意「逐個新增／更新」，不用 PUT 整批覆蓋——同一個機器人應用程式可能還有
   * 其他系統（例如 AstrBot）註冊的指令，整批覆蓋會把它們全部刪掉。
   * 指令名稱加 cyberfriend- 前綴，避免與 /help /reset 這類常見名稱衝突。
   */
  async registerSlashCommands({ onReady = false } = {}) {
    try {
      const commands = this.config.botNativeInteractions
        ? [...HUB_COMMANDS, ...NATIVE_COMMANDS]
        : HUB_COMMANDS;
      // 重新連線（READY 再次到達）時，同一個應用程式、同一份指令已成功註冊過就不重送；手動註冊一律執行。
      const signature = this.applicationId + ':' + JSON.stringify(commands);
      if (onReady && this.registeredCommands === signature)
        return { ok: true, created: 0, updated: 0, skipped: true };
      this.registeredCommands = '';
      const existing = await this.listCommands();
      const byName = new Map(existing.map((command) => [commandKey(command), command]));
      let created = 0;
      let updated = 0;
      for (const command of commands) {
        const found = byName.get(commandKey(command));
        if (found) {
          await this.rest('PATCH', `/applications/${this.applicationId}/commands/${found.id}`, {
            body: command,
          });
          updated += 1;
        } else {
          await this.rest('POST', `/applications/${this.applicationId}/commands`, { body: command });
          created += 1;
        }
      }
      for (const old of existing.filter(isLegacyCommand))
        await this.rest('DELETE', `/applications/${this.applicationId}/commands/${old.id}`);
      if (!this.config.botNativeInteractions)
        for (const old of existing.filter((c) =>
          NATIVE_COMMANDS.some((n) => commandKey(n) === commandKey(c)),
        ))
          await this.rest('DELETE', `/applications/${this.applicationId}/commands/${old.id}`);
      this.log?.info('bot.commands', '已註冊斜線指令', {
        created,
        updated,
        total: existing.length + created,
        ours: commands.map((command) => `/${command.name}`),
      });
      this.registeredCommands = signature;
      return { ok: true, created, updated };
    } catch (error) {
      this.log?.warn('bot.commands', '註冊斜線指令失敗', { error: truncate(error.message, 200) });
      return { ok: false, error: truncate(error.message, 200) };
    }
  }

  /** 只刪除本插件自己的指令，其他人的指令原封不動。 */
  async clearSlashCommands() {
    this.registeredCommands = '';
    try {
      const existing = await this.listCommands();
      const ours = existing.filter(
        (command) =>
          isLegacyCommand(command) ||
          [...HUB_COMMANDS, ...NATIVE_COMMANDS].some((hub) => commandKey(hub) === commandKey(command)),
      );
      for (const command of ours) {
        await this.rest('DELETE', `/applications/${this.applicationId}/commands/${command.id}`);
      }
      this.log?.info('bot.commands', '已移除本插件的斜線指令', {
        removed: ours.length,
        kept: existing.length - ours.length,
      });
      return { ok: true, removed: ours.length, kept: existing.length - ours.length };
    } catch (error) {
      return { ok: false, error: truncate(error.message, 200) };
    }
  }

  async interactionCallback(p, type, data) {
    try {
      const response = await fetch(API + '/interactions/' + p.id + '/' + p.token + '/callback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type, data }),
        signal: AbortSignal.timeout(2500),
      });
      return { ok: response.ok };
    } catch {
      return { ok: false, error: '互動回應未確認' };
    }
  }
  async editInteraction(p, data) {
    try {
      const response = await fetch(
        API + '/webhooks/' + this.applicationId + '/' + p.token + '/messages/@original',
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(data),
          signal: AbortSignal.timeout(10000),
        },
      );
      return { ok: response.ok };
    } catch {
      return { ok: false, error: '互動狀態更新未確認' };
    }
  }
  async followupInteraction(p, data) {
    try {
      const response = await fetch(API + '/webhooks/' + this.applicationId + '/' + p.token, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...data, flags: 64, allowed_mentions: { parse: [] } }),
        signal: AbortSignal.timeout(10000),
      });
      return { ok: response.ok };
    } catch {
      return { ok: false, error: '互動後續回應未確認' };
    }
  }
  async replyInteraction(interactionId, interactionToken, content, ephemeral = true) {
    return this.interactionCallback({ id: interactionId, token: interactionToken }, 4, {
      content: truncate(content, 1900),
      flags: ephemeral ? 64 : 0,
      allowed_mentions: { parse: [] },
    });
  }
}
