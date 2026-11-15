/**
 * src/transports.js — 介面管理
 * ============================================================================
 * 同時管理兩個 Discord 介面：
 *   user = 你自己的帳號（discord.py-self 獨立程序）
 *   bot  = 機器人（Gateway v10 + REST，顯示為 BOT）
 * 一則訊息由「接收它的介面」處理；回覆預設由同一個介面發出，
 * 也可以在設定裡指定「一律用某個介面回覆」。
 * ============================================================================
 */
import { BotTransport } from './transport/bot.js';
import { PySelfTransport } from './transport/pyself.js';

export class TransportManager {
  constructor({
    log,
    history,
    onMessage,
    onReaction,
    onInteraction,
    onMessageChange,
    onOwnMessage,
    onConnectionLost,
    onMemberUpdate,
  }) {
    this.log = log;
    this.history = history;
    this.handlers = { onMessage, onReaction, onInteraction };
    this.byKind = {
      user: new PySelfTransport({
        log,
        onOwnMessage,
        onMemberUpdate: (e) => onMemberUpdate?.(e, this.byKind.user),
        onMessage: (message, raw) => this.dispatch('user', message, raw),
        onReaction: (event) => this.dispatchReaction('user', event),
        onMessageChange: (event) => onMessageChange?.(event, this.byKind.user),
        onConnectionLost: () => onConnectionLost?.(this.byKind.user),
      }),
      bot: new BotTransport({
        onMemberUpdate: (e) => onMemberUpdate?.(e, this.byKind.bot),
        log,
        onMessageChange: (event) => onMessageChange?.(event, this.byKind.bot),
        onMessage: (message, raw) => this.dispatch('bot', message, raw),
        onReaction: (event) => this.dispatchReaction('bot', event),
        onInteraction: (payload) => this.dispatchInteraction(payload),
      }),
    };
    this.config = {};
  }

  configure(config) {
    this.config = config;
    this.byKind.user.configure(config);
    this.byKind.bot.config = config;
    this.history?.configure?.(config);
  }

  dispatch(kind, message, raw) {
    try {
      return this.handlers.onMessage?.(message, this.byKind[kind], raw);
    } catch (error) {
      this.log?.error('transport.dispatch', '處理訊息時發生錯誤', { transport: kind, error: error.message });
    }
  }

  dispatchReaction(kind, event) {
    try {
      return this.handlers.onReaction?.(event, this.byKind[kind]);
    } catch (error) {
      this.log?.warn('transport.reaction', '處理表情事件時發生錯誤', {
        transport: kind,
        error: error.message,
      });
    }
  }

  // 回傳 Promise，處理函式的同步與非同步錯誤都在這裡記錄，不會變成未處理的 rejection。
  async dispatchInteraction(payload) {
    try {
      return await this.handlers.onInteraction?.(payload, this.byKind.bot);
    } catch (error) {
      this.log?.warn('transport.interaction', '處理互動事件時發生錯誤', { error: error.message });
    }
  }

  get(kind) {
    return this.byKind[kind] || null;
  }

  /** 目前用來「接收」的介面（兩個都可能在接收，這裡只回主要的那個）。 */
  primary() {
    const kind = this.config.primaryTransport === 'bot' ? 'bot' : 'user';
    return this.byKind[kind];
  }

  /** 決定用哪個介面發送回覆。 */
  replyTransportFor(receivedOn) {
    const preference = this.config.replyTransport || 'auto';
    if (preference === 'user' || preference === 'bot') {
      const candidate = this.byKind[preference];
      if (candidate?.ready) return candidate;
      return receivedOn;
    }
    return receivedOn?.ready ? receivedOn : this.primary();
  }

  /** 沒有指定介面時（例如工具呼叫）用哪個。 */
  defaultSender() {
    const preference = this.config.sendTransportDefault || 'auto';
    if (preference === 'user' || preference === 'bot') {
      const candidate = this.byKind[preference];
      if (candidate?.ready) return candidate;
    }
    const primary = this.primary();
    if (primary?.ready) return primary;
    const other = Object.values(this.byKind).find((transport) => transport?.ready);
    if (other) return other;
    throw new Error('沒有任何介面已登入，請先在設定中登入使用者帳號或機器人');
  }

  resolve(kindOrAuto) {
    if (!kindOrAuto || kindOrAuto === 'auto' || kindOrAuto === 'primary') return this.defaultSender();
    const transport = this.byKind[kindOrAuto];
    if (!transport) throw new Error(`未知的介面：${kindOrAuto}（可用 user / bot）`);
    if (!transport.ready) throw new Error(`${kindOrAuto} 介面尚未登入`);
    return transport;
  }

  status() {
    return {
      primaryTransport: this.config.primaryTransport || 'user',
      replyTransport: this.config.replyTransport || 'auto',
      user: this.byKind.user.getStatus(),
      bot: this.byKind.bot.getStatus(),
    };
  }

  async start(kind, config) {
    const transport = this.byKind[kind];
    if (!transport) return { ok: false, error: '未知的介面' };
    if (config.enabled === false || config[kind === 'user' ? 'userEnabled' : 'botEnabled'] === false) {
      return { ok: false, error: '此介面已停用，請先在設定啟用' };
    }
    const result = await transport.connect(config);
    if (result.ok) {
      this.history?.setSelfId?.(kind, transport.selfId);
    }
    return result;
  }

  async startEnabled(config) {
    this.configure(config);
    const results = {};
    if (config.userEnabled && config.userAutoStart && config.userToken) {
      results.user = await this.byKind.user
        .connect(config)
        .catch((error) => ({ ok: false, error: error.message }));
    }
    if (config.botEnabled && config.botAutoStart && config.botToken) {
      results.bot = await this.byKind.bot
        .connect(config)
        .catch((error) => ({ ok: false, error: error.message }));
    }
    return results;
  }

  async stop(kind) {
    const transport = this.byKind[kind];
    if (!transport) return { ok: false, error: '未知的介面' };
    return transport.disconnect();
  }

  async stopAll() {
    await Promise.all(Object.values(this.byKind).map((transport) => transport.disconnect().catch(() => {})));
  }

  async restart(kind, config) {
    await this.stop(kind);
    return this.start(kind, config);
  }
}
