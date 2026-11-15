import { userPresence, validatePresence } from '../user-presence.js';
import { audienceConfig } from '../config.js';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { normalizeMessage } from '../history.js';
import { addressedTo } from '../features/message-policy.js';
import { externalDataDir } from '../data-location.js';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url);
const WORKER = fileURLToPath(new URL('bridge/worker.py', ROOT));
export function pythonExecutable(config = {}) {
  const explicit = String(config.userPythonExecutable || '').trim();
  const relative = process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python';
  // 先找套件目錄的 .venv（來源安裝），再找資料目錄的 venv（市集安裝，更新套件時不會被清掉）。
  const bundled = fileURLToPath(new URL('.venv/' + relative, ROOT));
  const external = join(externalDataDir(), 'venv', relative);
  const selected = explicit || (existsSync(bundled) || !existsSync(external) ? bundled : external);
  if (!existsSync(selected))
    throw Error(
      '找不到 Python 環境。使用者帳號需要先照安裝說明執行一次 Python 設定指令；已經有自己的 Python 環境的話，請在設定填入它的路徑',
    );
  return selected;
}

// Only non-secret runtime switches are sent by configure. Credentials travel once over stdin.
function settings(config) {
  return {
    memberNameUpdatesEnabled: config.memberNameUpdatesEnabled !== false,
    channelActionsEnabled:
      config.channelActionsEnabled === true && config.enabled !== false && config.userEnabled !== false,
    receiveOnly: config.userReceiveOnly !== false,
    autoReply: config.userAutoReply === true && config.enabled !== false && config.userEnabled !== false,
    voiceReceiveEnabled:
      config.enabled !== false && config.userEnabled !== false && !!config.voiceReceiveEnabled,
    voiceReceiveConsent: !!config.voiceReceiveConsent,
    voiceReceiveUserIds: (config.voiceReceiveUserIds || []).slice(0, 128),
    dryRun: Boolean(config.dryRun),
    typingEnabled: config.userSimulateTyping !== false,
    reconnect: config.userReconnect !== false,
  };
}

export class PySelfTransport {
  constructor({
    log,
    onMessage,
    onOwnMessage,
    onReaction,
    onMessageChange,
    onConnectionLost,
    onMemberUpdate,
    spawnProcess = spawn,
    resolvePython = pythonExecutable,
    worker = WORKER,
  } = {}) {
    Object.assign(this, {
      kind: 'user',
      log,
      onMessage,
      onOwnMessage,
      onReaction,
      onMessageChange,
      onConnectionLost,
      onMemberUpdate,
      spawnProcess,
      resolvePython,
      worker,
    });
    this.config = {};
    this.process = null;
    this.state = 'disconnected';
    this.message = '尚未啟動 Python Token 測試';
    this.selfId = '';
    this.selfName = '';
    this.user = null;
    this.startedAt = 0;
    this.pending = new Map();
    this.sequence = 0;
    this.epoch = 0;
    this.seen = new Set();
    this.receivedCount = 0;
    this.guildCount = 0;
    this.libraryVersion = null;
    this.readyTimer = null;
    this.connectionGeneration = 0;
    this.replayBuffer = new Map();
    this.conversationChannels = new Set();
    this.sentIds = new Set();
    this.followupUntil = new Map();
    this.followupSpan = new Map();
  }
  /** 記下追問視窗與當時對象的追問秒數；回覆後延長時沿用同一個秒數。 */
  rememberFollowup(channelId, seconds) {
    const span = Math.max(1, Number(seconds) || 180);
    this.followupSpan.delete(channelId);
    this.followupSpan.set(channelId, span);
    this.followupUntil.delete(channelId);
    this.followupUntil.set(channelId, Date.now() + span * 1000);
    while (this.followupUntil.size > 400) {
      const oldest = this.followupUntil.keys().next().value;
      this.followupUntil.delete(oldest);
      this.followupSpan.delete(oldest);
    }
  }
  get ready() {
    return this.state === 'connected' && Boolean(this.process && this.selfId);
  }
  getStatus() {
    return {
      transport: 'user',
      mode: 'pyself',
      ok: this.ready,
      state: this.state,
      message: this.message,
      user: this.user,
      guildCount: this.guildCount,
      ping: null,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
      workerRunning: Boolean(this.process),
      libraryVersion: this.libraryVersion,
      receivedCount: this.receivedCount,
      lastError: this.lastError || null,
      presenceManaged: !!this.config.userPresenceEnabled,
      presence: this.lastPresence || null,
      gatewayHost: this.gatewayHost || null,
      receiveOnly: this.config.userReceiveOnly !== false,
      autoReply: this.config.userAutoReply === true,
      capabilities: {
        presence: true,
        activities: true,
        customStatus: true,
        text: true,
        files: true,
        quotedReplies: true,
        reactions: true,
        stickers: true,
        userIdToDm: false,
      },
    };
  }
  configure(config) {
    this.config = config;
    if (this.process) this.rpc('configure', settings(config)).catch(() => {});
  }
  rpc(method, params = {}, timeoutMs = 20000) {
    const child = this.process;
    if (!child?.stdin?.writable) return Promise.resolve({ ok: false, error: 'Python 程序未啟動' });
    const id = ++this.sequence;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({
          ok: false,
          uncertain: method === 'send',
          error: 'Python 回應逾時；發送不會自動重試，請先確認結果',
        });
      }, timeoutMs);
      this.pending.set(id, { resolve, timer });
      child.stdin.write(JSON.stringify({ id, method, params }) + '\n', (error) => {
        if (error) this.resolvePending(id, { ok: false, error: 'Python 通訊已中斷' });
      });
    });
  }
  resolvePending(id, result) {
    const item = this.pending.get(id);
    if (!item) return;
    clearTimeout(item.timer);
    this.pending.delete(id);
    item.resolve(result);
  }
  event(packet) {
    if (packet.id !== undefined) return this.resolvePending(packet.id, packet.result);
    if (packet.event === 'member_name_update') {
      this.onMemberUpdate?.(packet);
      return;
    }
    if (['voice_opus', 'voice_receive_error', 'voice_stream_started'].includes(packet.event)) {
      this.voiceOutput?.packet?.(packet);
      return;
    }
    if (packet.event === 'typing' && ['started', 'stopped', 'failed'].includes(packet.state)) {
      this.log?.[packet.state === 'failed' ? 'debug' : 'info'](
        'user.pyself.typing',
        packet.state === 'started'
          ? '已顯示正在輸入'
          : packet.state === 'stopped'
            ? '已停止更新輸入狀態'
            : '輸入狀態失敗；文字回覆繼續',
        { state: packet.state },
      );
      return;
    }
    if (packet.event === 'gateway_connect' && /^[a-z0-9.-]+\.discord\.gg$/i.test(packet.host || '')) {
      this.gatewayHost = packet.host;
      this.log?.info('user.pyself.gateway', '正在連接 Gateway', { host: packet.host });
      return;
    }
    if (packet.event === 'ready') {
      if (!/^\d{15,22}$/.test(packet.user?.id || '')) return;
      clearTimeout(this.readyTimer);
      this.user = packet.user;
      this.selfId = packet.user.id;
      this.selfName = packet.user.displayName || packet.user.username;
      this.guildCount = Number(packet.guildCount) || 0;
      this.libraryVersion = packet.libraryVersion;
      this.startedAt ||= Date.now();
      this.liveSince ||= Date.now();
      this.state = 'connected';
      this.message = `discord.py-self ${this.libraryVersion} 已連線`;
      this.lastError = null;
      this.log?.info('user.pyself.ready', this.message, { userId: this.selfId });
      this.flushReplay();
      this.restorePresence();
    } else if (packet.event === 'resumed') {
      clearTimeout(this.readyTimer);
      this.state = 'connected';
      this.lastError = null;
      this.message = 'Python Gateway 已恢復連線';
      this.log?.info('user.pyself.resumed', this.message);
      this.flushReplay();
      this.restorePresence();
    } else if (packet.event === 'disconnected' || packet.event === 'reconnecting') {
      this.connectionGeneration++;
      this.voiceOutput?.lost?.();
      this.onConnectionLost?.();
      if (packet.terminal) this.replayBuffer.clear();
      if (this.state !== 'error') {
        this.state =
          !packet.terminal && this.config.userReconnect !== false ? 'reconnecting' : 'disconnected';
        this.message =
          this.state === 'reconnecting'
            ? 'Python Gateway 重連中（最多 5 次連接嘗試／90 秒）'
            : 'Python Gateway 已斷線';
      }
    } else if (packet.event === 'error') {
      this.replayBuffer.clear();
      clearTimeout(this.readyTimer);
      this.state = 'error';
      // Never display raw Python tracebacks, request headers or exception messages.
      const code = String(packet.code || 'unknown')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 60);
      this.lastError = {
        code,
        ...(Number.isInteger(packet.closeCode) ? { closeCode: packet.closeCode } : {}),
        ...(Number.isInteger(packet.curlCode) ? { curlCode: packet.curlCode } : {}),
        ...(Number.isInteger(packet.httpStatus) ? { httpStatus: packet.httpStatus } : {}),
      };
      this.message =
        packet.curlCode === 6
          ? `Gateway 主機名稱解析失敗（DNS／curl 6${this.gatewayHost ? `：${this.gatewayHost}` : ''}）；這不是 Token 被拒絕的證據`
          : `Python 連線失敗（${code}${this.lastError.closeCode ? ` / Gateway ${this.lastError.closeCode}` : this.lastError.curlCode ? ` / curl ${this.lastError.curlCode}` : ''}），不自動重新登入`;
      this.log?.warn('user.pyself.error', this.message, this.lastError);
      if (code === 'ReconnectLimitError')
        this.message = '自動重連已達上限（5 次連接嘗試／90 秒），請檢查網路後重新連線';
      this.onConnectionLost?.();
    } else if (['message_edit', 'message_delete', 'message_preview', 'reaction'].includes(packet.event)) {
      const memoryEvent =
        this.config.memoryOutputEnabled !== false &&
        ((Boolean(packet.guildId) &&
          (!(this.config.memoryGroupChannelIds || []).length ||
            this.config.memoryGroupChannelIds.includes(String(packet.channelId)))) ||
          this.conversationChannels.has(packet.channelId));
      if (!memoryEvent && !this.watches(packet.channelId, !packet.guildId)) return;
      if (packet.event === 'reaction') {
        if (
          !this.ready ||
          (!memoryEvent && (this.config.userReceiveOnly !== false || this.config.userAutoReply !== true))
        )
          return;
        Promise.resolve(this.onReaction?.(packet)).catch(() =>
          this.log?.warn('user.pyself.reaction', '表情事件處理失敗'),
        );
      } else {
        if (packet.event === 'message_preview') {
          const buffered = this.replayBuffer.get(packet.messageId);
          if (buffered)
            buffered.message = {
              ...buffered.message,
              embedDetails: packet.embedDetails,
              embeds: packet.embedDetails?.length || 0,
            };
        } else this.replayBuffer.delete(packet.messageId);
        Promise.resolve(this.onMessageChange?.(packet)).catch(() =>
          this.log?.warn('user.pyself.edit', '訊息同步失敗'),
        );
      }
    } else if (packet.event === 'message') {
      const message = normalizeMessage(packet.message, 'user', this.selfId);
      if (!/^\d{15,22}$/.test(message.id) || this.seen.has(message.id)) return;
      if (this.state === 'reconnecting' && this.selfId) {
        this.replayBuffer.set(message.id, packet);
        if (this.replayBuffer.size > 100) this.replayBuffer.delete(this.replayBuffer.keys().next().value);
        return;
      }
      this.seen.add(message.id);
      if (this.seen.size > 10000) this.seen.delete(this.seen.values().next().value);
      this.receivedCount++;
      if (
        this.ready &&
        packet.origin === 'manual' &&
        message.author.id === this.selfId &&
        Number((BigInt(message.id) >> 22n) + 1420070400000n) >= this.liveSince
      )
        Promise.resolve(this.onOwnMessage?.(message)).catch(() =>
          this.log?.warn('user.takeover', '自動接管失敗'),
        );
      const archiveAdmin =
        this.config.archiveAdminMessages !== false &&
        this.config.adminUserId &&
        message.author.id === this.config.adminUserId;
      const memoryGroup =
        this.config.memoryOutputEnabled !== false &&
        Boolean(message.guildId || message.isGroupDm) &&
        (!(this.config.memoryGroupChannelIds || []).length ||
          this.config.memoryGroupChannelIds.includes(message.channelId));
      const inboxAddressed = addressedTo(message, this.selfId, this.sentIds);
      if (inboxAddressed) message.isMention = true;
      const inboxMessage =
        this.config.userInboxEnabled !== false &&
        ((message.isDm && !message.isGroupDm && this.config.userWatchDms !== false) || inboxAddressed) &&
        !this.config.blacklistChannelIds?.includes(message.channelId);
      if (inboxMessage && (this.config.userReceiveOnly !== false || this.config.userAutoReply !== true))
        message.memoryOnly = true;
      if (
        !this.ready ||
        (!archiveAdmin &&
          !memoryGroup &&
          !inboxMessage &&
          (this.config.userReceiveOnly !== false || this.config.userAutoReply !== true))
      )
        return;
      if (
        (!memoryGroup && message.author.id === this.selfId) ||
        Number((BigInt(message.id) >> 22n) + 1420070400000n) < this.liveSince
      )
        return;
      const audience = audienceConfig(this.config, message.author?.id, message.isDm && !message.isGroupDm);
      const addressed = inboxAddressed;
      if (addressed) message.isMention = true;
      if (addressed && message.guildId && audience.followupEnabled !== false) {
        this.rememberFollowup(message.channelId, audience.followupSeconds);
      }
      const followup =
        audience.followupEnabled !== false && this.followupUntil.get(message.channelId) > Date.now();
      const watchedByAudience =
        !this.config.blacklistChannelIds?.includes(message.channelId) &&
        audience.monitoredChannelIds?.includes(message.channelId);
      const watched = this.watches(message.channelId, message.isDm, addressed || followup, false);
      if (!archiveAdmin && !watchedByAudience && !watched && !memoryGroup) return;
      if (memoryGroup && !archiveAdmin && !watchedByAudience && !watched) message.memoryOnly = true;
      this.conversationChannels.add(message.channelId);
      if (this.conversationChannels.size > 400)
        this.conversationChannels.delete(this.conversationChannels.values().next().value);
      Promise.resolve(this.onMessage?.(message, null)).catch(() =>
        this.log?.warn('user.pyself.message', '訊息處理失敗'),
      );
    }
  }
  flushReplay() {
    const packets = [...this.replayBuffer.values()];
    this.replayBuffer.clear();
    for (const packet of packets) this.event(packet);
  }
  watches(channelId, isDm, addressed = false, includeConversations = true) {
    if (this.config.blacklistChannelIds?.includes(channelId)) return false;
    return isDm
      ? this.config.userWatchDms !== false
      : addressed ||
          (includeConversations && this.conversationChannels.has(channelId)) ||
          [...(this.config.userChannelIds || []), ...(this.config.monitoredChannelIds || [])].includes(
            channelId,
          );
  }
  connect(config = {}) {
    if (this.connectingPromise) return this.connectingPromise;
    this.connectingPromise = this.open(config).finally(() => {
      this.connectingPromise = null;
    });
    return this.connectingPromise;
  }
  async open(config = {}) {
    if (this.process && ['connecting', 'connected', 'reconnecting'].includes(this.state))
      return { ok: true, pending: !this.ready, user: this.user };
    await this.disconnect();
    this.configure(config);
    const token = String(config.userToken || '').trim();
    if (!token) return { ok: false, error: '請在此測試插件填入 User Token；不會讀取原插件或瀏覽器的憑證' };
    let executable;
    try {
      executable = this.resolvePython(config);
    } catch (error) {
      return { ok: false, error: error.message };
    }
    const epoch = ++this.epoch;
    this.state = 'connecting';
    this.message = 'Python 正在建立 Gateway 連線';
    this.receivedCount = 0;
    this.seen.clear();
    this.lastError = null;
    this.libraryVersion = null;
    this.gatewayHost = null;
    let child;
    try {
      child = this.spawnProcess(executable, ['-u', this.worker], {
        cwd: fileURLToPath(ROOT),
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      this.state = 'error';
      this.message = '無法啟動 Python';
      return { ok: false, error: this.message };
    }
    this.process = child;
    child.stdin.on('error', () => {});
    const lines = createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      if (epoch !== this.epoch) return;
      try {
        this.event(JSON.parse(line));
      } catch {
        /* Non-protocol output is not logged. */
      }
    });
    child.stderr.on('data', () => {}); // Do not leak dependencies' raw diagnostics.
    const finish = () => {
      if (epoch !== this.epoch) return;
      clearTimeout(this.readyTimer);
      this.process = null;
      this.startedAt = 0;
      this.connectionGeneration++;
      this.voiceOutput?.lost?.();
      this.onConnectionLost?.();
      if (this.state !== 'error') {
        this.state = 'disconnected';
        this.message = 'Python 程序已結束';
      }
      for (const id of this.pending.keys())
        this.resolvePending(id, { ok: false, error: 'Python 程序已結束' });
    };
    child.once('error', () => {
      if (epoch === this.epoch) {
        this.state = 'error';
        this.message = 'Python 啟動失敗，請確認執行檔與依賴';
        finish();
      }
    });
    child.once('exit', finish);
    this.readyTimer = setTimeout(() => {
      if (epoch !== this.epoch || this.ready) return;
      this.state = 'error';
      this.message = 'Python 登入 100 秒內未完成，已停止連線';
      child.kill();
    }, 100000);
    const result = await this.rpc('start', { token, ...settings(config) }, 15000);
    if (!result.ok) {
      await this.disconnect();
      this.state = 'error';
      this.message = 'Python 初始化失敗，請先執行依賴檢查';
      return { ok: false, error: this.message };
    }
    return { ok: true, pending: !this.ready, user: this.user };
  }
  async disconnect() {
    const child = this.process;
    this.process = null;
    this.epoch++;
    clearTimeout(this.readyTimer);
    this.selfId = '';
    this.selfName = '';
    this.user = null;
    this.startedAt = 0;
    this.liveSince = 0;
    this.connectionGeneration++;
    this.onConnectionLost?.();
    this.replayBuffer.clear();
    this.conversationChannels.clear();
    this.sentIds.clear();
    this.followupUntil.clear();
    this.followupSpan.clear();
    for (const id of this.pending.keys()) this.resolvePending(id, { ok: false, error: '連線已取消' });
    if (child && child.exitCode === null) {
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          child.kill();
          resolve();
        }, 1500);
        child.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
        child.stdin.end(JSON.stringify({ id: 0, method: 'shutdown', params: {} }) + '\n');
      });
    }
    this.state = 'disconnected';
    this.message = '已停止 Python Token 測試';
    return { ok: true };
  }
  async request(method, params = {}, mutation = false) {
    if (!this.ready) return { ok: false, error: 'Python 使用者介面尚未登入' };
    if (params.options?.autoReply && this.isPaused?.(params.channelId))
      return { ok: false, cancelled: true, error: '此對話由人工接管' };
    if (mutation && this.config.userReceiveOnly !== false)
      return { ok: false, error: '僅觀察模式禁止發送或修改 Discord 狀態' };
    if (params.options?.autoReply && !this.config.userAutoReply)
      return { ok: false, error: 'AI 自動回覆已關閉' };
    if (params.options?.sessionEpoch !== undefined && params.options.sessionEpoch !== this.epoch)
      return { ok: false, error: '登入工作階段已更換，已取消舊回覆' };
    if (params.options?.expectedSelfId && params.options.expectedSelfId !== this.selfId)
      return { ok: false, error: '登入帳號已更換，已取消舊回覆' };
    if (
      params.options?.connectionGeneration !== undefined &&
      params.options.connectionGeneration !== this.connectionGeneration
    )
      return { ok: false, error: '連線曾中斷，已取消舊回覆' };
    if (
      mutation &&
      params.options?.autoReply &&
      (this.config.dryRun || this.config.enabled === false || this.config.userEnabled === false)
    )
      return { ok: false, error: '目前設定禁止自動發送' };
    return this.rpc(method, params);
  }
  async sendMessage(channelId, options = {}) {
    const result = await this.request('send', { channelId, options }, true);
    if (result.ok && result.messageId) {
      if (options.autoReply && this.followupUntil.has(channelId))
        this.rememberFollowup(channelId, this.followupSpan.get(channelId));
      this.sentIds.add(String(result.messageId));
      if (this.sentIds.size > 500) this.sentIds.delete(this.sentIds.values().next().value);
    }
    return result;
  }
  cancelReply(replyId) {
    return this.rpc('cancel_reply', { replyId }, 3000);
  }
  async startTyping(channelId, options = {}) {
    if (this.isPaused?.(channelId)) return null;
    if (this.config.dryRun || this.config.userSimulateTyping === false) return { ok: true, skipped: true };
    const epoch = this.epoch;
    const result = await this.request(
      'typing_start',
      { channelId, options: { ...options, expectedSelfId: this.selfId, sessionEpoch: epoch } },
      true,
    );
    return { ...result, epoch };
  }
  stopTyping(lease) {
    if (!lease?.typingId || lease.epoch !== this.epoch) return Promise.resolve({ ok: true, skipped: true });
    return this.rpc('typing_stop', { typingId: lease.typingId }, 3000);
  }
  sendTyping(channelId) {
    if (this.config.dryRun || this.config.userSimulateTyping === false)
      return Promise.resolve({ ok: true, skipped: true });
    return this.request('typing_once', { channelId }, true);
  }
  getMessages(channelId, limit = 20) {
    return this.request('messages', { channelId, limit });
  }
  channelRead(action, args) {
    return this.request('conversation_read', { ...args, action });
  }
  channelWrite(action, args) {
    return this.request(
      'conversation_write',
      {
        ...args,
        action,
        expectedSelfId: this.selfId,
        options: { expectedSelfId: this.selfId, autoReply: false },
      },
      true,
    );
  }
  getPins(channelId, limit = 20) {
    return this.request('pins', { channelId, limit });
  }
  getMessage(channelId, messageId) {
    return this.request('message', { channelId, messageId });
  }
  getGuilds() {
    return this.request('guilds');
  }
  getEmojis(guildId) {
    return this.request('emojis', { guildId });
  }
  getChannels(guildId) {
    return this.request('channels', { guildId });
  }
  getDMs() {
    return this.request('dms');
  }
  sendReaction(channelId, messageId, emoji) {
    if (this.isPaused?.(channelId)) return Promise.resolve({ ok: false, error: '此對話由人工接管' });
    return this.request('reaction', { channelId, messageId, emoji }, true);
  }
  removeReaction(channelId, messageId, emoji) {
    return this.request('removeReaction', { channelId, messageId, emoji }, true);
  }
  memberName(guildId, userId) {
    return this.request('member_name', { guildId, userId });
  }
  getThreadParent(channelId) {
    return this.request('thread_parent', { channelId });
  }
  createThread(channelId, messageId, name, archiveMinutes = 1440) {
    return this.request(
      'thread_create',
      {
        channelId,
        messageId,
        name,
        archiveMinutes,
        options: { autoReply: true, expectedSelfId: this.selfId },
      },
      true,
    );
  }
  async applyPresence(input = userPresence(this.config)) {
    try {
      const params = validatePresence(typeof input === 'string' ? { status: input } : input);
      const result = await this.request('presence', params, true);
      this.lastPresence = {
        ...result,
        requested: params,
        updatedAt: new Date().toISOString(),
        verification: result.ok ? 'request-accepted' : 'failed',
      };
      return this.lastPresence;
    } catch (e) {
      return (this.lastPresence = {
        ok: false,
        error: e.message,
        verification: 'failed',
        updatedAt: new Date().toISOString(),
      });
    }
  }
  getPresence(refresh = false) {
    return this.request('presence_get', { refresh });
  }
  restorePresence() {
    if (this.config.userPresenceEnabled)
      this.applyPresence()
        .then((r) => {
          if (!r.ok) this.log?.warn('user.presence', '帳號外觀套用失敗', { error: r.error });
        })
        .catch(() => {});
  }

  resolveMediaAsset(asset) {
    return this.request('media_asset', asset);
  }
  searchStickers(query = '', options = {}) {
    return this.request('stickers', { query: String(query).slice(0, 120), channelId: options.channelId });
  }
  editMessage(channelId, messageId, content) {
    return this.request('edit_message', { channelId, messageId, content }, true);
  }
  deleteMessage(channelId, messageId) {
    return this.request('delete_message', { channelId, messageId }, true);
  }
  searchGifs(query, options = {}) {
    return this.request('gifs', { query: String(query).slice(0, 120), locale: options.locale || 'zh-TW' });
  }
  refreshAttachmentUrls(urls) {
    return this.request('refresh_attachments', { urls: urls.slice(0, 3) });
  }
}
