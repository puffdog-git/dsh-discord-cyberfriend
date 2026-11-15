import { audienceConfig } from '../config.js';
/**
 * src/features/gate.js — 回覆守門員
 * ============================================================================
 * 所有「要不要回這則訊息」的判斷都集中在這裡，方便 UI 上的每個開關都對應到
 * 一行實際生效的邏輯。回傳 { ok, kind, reason }。
 * ============================================================================
 */
import { Cooldown, KeyedRateWindow, RateWindow } from '../util.js';
import { accessReason, hasReplyContent } from './message-policy.js';
import { describeRichContent } from '../persona.js';

const KIND_LABEL = { mention: '@ 回覆', dm: '私訊回覆', cochat: '閒聊插話' };

export class ReplyGate {
  constructor({ config, ledger, log }) {
    this.config = config;
    this.ledger = ledger;
    this.log = log;
    this.admissions = new Map();
    this.controlWindow = new KeyedRateWindow(8, 60000);
    this.cooldowns = new Cooldown();
    // 私訊的每小時上限：每個自家帳號各一個計數器（鍵是「介面:帳號 ID」）。
    this.hourlyDm = new Map();
    this.hourly = {
      mention: new RateWindow(20, 60 * 60 * 1000),
      dm: new RateWindow(20, 60 * 60 * 1000),
      cochat: new RateWindow(20, 60 * 60 * 1000),
    };
  }

  configure(config) {
    this.config = config;
    // 只調整上限、保留已累計的次數：任何一次設定存檔都會走到這裡，重建計數器等於把每小時上限清零。
    const limit = Math.max(1, Number(config.maxRepliesPerHour) || 20);
    this.hourly.mention.setLimit(limit);
    this.hourly.dm.setLimit(limit);
    for (const window of this.hourlyDm.values()) window.setLimit(limit);
    this.hourly.cochat.setLimit(Math.min(limit, 30));
  }

  /** 私訊每小時上限的計數器：使用者帳號與機器人各自計算；缺少帳號資訊時退回共用的那一個。 */
  dmWindow(context, message) {
    const transport = context.transport || message.transport,
      selfId = context.selfId;
    if (!transport || !selfId) return this.hourly.dm;
    const key = `${transport}:${selfId}`;
    let window = this.hourlyDm.get(key);
    if (!window) {
      window = new RateWindow(this.hourly.dm.limit, 60 * 60 * 1000);
      this.hourlyDm.set(key, window);
    }
    return window;
  }

  reset() {
    this.cooldowns = new Cooldown();
    this.hourlyDm = new Map();
    for (const kind of Object.keys(this.hourly)) this.hourly[kind] = new RateWindow(20, 60 * 60 * 1000);
    this.configure(this.config);
  }

  /**
   * @param {object} message 正規化後的訊息
   * @param {string} kind 'mention'|'dm'|'cochat'
   * @param {{selfId:string, transportEnabled:boolean}} context
   */
  check(message, kind, context) {
    const config =
      context.effectiveConfig ||
      audienceConfig(this.config, message.author?.id, message.isDm && !message.isGroupDm);
    const deny = (reason) => ({ ok: false, kind, reason });

    if (!config.enabled) return deny('插件已停用');
    if (!context.transportEnabled) return deny(`${context.transport} 介面未啟用`);
    if (!hasReplyContent(message)) return deny('訊息沒有內容');
    if (message.author?.id && message.author.id === context.selfId) return deny('自己送出的訊息');
    if (message.author?.bot && !(kind === 'cochat' ? config.coChatReplyToBots : config.replyToBots)) {
      return deny('其他機器人的訊息');
    }

    const userId = String(message.author?.id || '');
    const channelId = String(message.channelId || '');
    const guildId = String(message.guildId || '');
    const denied = accessReason(message, config);
    if (denied) return deny(denied);
    if (kind === 'mention' && !config.mentionReplyEnabled) return deny('@ 回覆已關閉');
    if (kind === 'dm' && !config.dmReplyEnabled) return deny('私訊回覆已關閉');
    if (kind === 'cochat' && !config.coChatEnabled) return deny('群組閒聊已關閉');
    if (config.dryRun) return { ok: true, kind, reason: '模擬模式（不會真的發送）', dryRun: true };

    const dailyCap =
      kind === 'mention'
        ? config.maxDailyMentionReplies
        : kind === 'dm'
          ? config.maxDailyDmReplies
          : config.maxDailyCoChats;
    // 管理者的 @ 與私訊不受每日、每小時總量上限限制，也不佔用額度（上限是給其他使用者的）。
    // 閒聊插話是 AI 主動發言，不算在內，仍照原本的上限。
    const adminExempt = kind !== 'cochat' && Boolean(config.adminUserId) && userId === String(config.adminUserId);
    const dailyUsed = this.ledger?.usedToday?.(kind) ?? 0;
    if (!adminExempt && Number(dailyCap) > 0 && dailyUsed >= Number(dailyCap))
      return deny(`已達今日${KIND_LABEL[kind]}上限 (${dailyCap})`);

    if (
      this.ledger?.roundsExceeded?.(userId, config, {
        transport: context.transport || message.transport || 'unknown',
        channelId,
      })
    ) {
      return deny(
        `與該使用者的連續對話已達 ${config.roundCapPerUser} 輪；最後一次回覆 ${config.roundResetMinutes || 10} 分鐘後恢復`,
      );
    }

    const admission = context.admission
      ? [context.admission, context.transport, channelId, userId, kind].join(':')
      : null;
    for (const [id, at] of this.admissions) if (Date.now() - at > 300000) this.admissions.delete(id);
    if (admission && this.admissions.has(admission))
      return { ok: true, kind, reason: '同回合補充，沿用已通過的節奏配額' };
    const cooldownMs = Math.max(0, Number(config.cooldownSeconds) || 0) * 1000;
    if (kind === 'cochat') {
      const window = this.hourly.cochat;
      if (!window.tryPass(channelId)) return deny('閒聊回覆過於頻繁（每小時上限）');
      const cooldown = Math.max(0, Number(config.coChatCooldownSeconds) || 0) * 1000;
      if (
        !this.cooldowns.tryPass(
          `cochat:${config.adminUserId && userId === config.adminUserId ? 'admin' : 'others'}:${channelId}`,
          cooldown,
        )
      )
        return deny('頻道閒聊冷卻中');
    } else {
      if (
        !config.replyCooldownExemptUserIds?.includes(userId) &&
        cooldownMs > 0 &&
        // 私訊：每個自家帳號各自計算（對方先私訊使用者帳號、再私訊機器人，不互相擋）。
        // 伺服器裡的 @ 仍然共用，避免兩個帳號對同一個人接連回覆。
        !this.cooldowns.tryPass(
          kind === 'dm'
            ? `dm:${context.transport || message.transport || ''}:${context.selfId || ''}:${userId}`
            : `${kind}:${userId}`,
          cooldownMs,
        )
      ) {
        return deny('與該使用者的冷卻中');
      }
      const window = kind === 'dm' ? this.dmWindow(context, message) : this.hourly[kind];
      if (!adminExempt && !window.tryPass(userId)) return deny('每小時回覆數已達上限');
    }
    if (admission) {
      this.admissions.set(admission, Date.now());
      if (this.admissions.size > 1000) this.admissions.delete(this.admissions.keys().next().value);
    }
    return { ok: true, kind, reason: '' };
  }

  control(message, context) {
    const c = context.effectiveConfig || this.config,
      kind = message.isDm && !message.isGroupDm ? 'dm' : 'mention';
    const result = this.check(message, kind, { ...context, effectiveConfig: { ...c, dryRun: true } });
    if (!result.ok) return result;
    if (
      !c.dryRun &&
      !this.controlWindow.tryPass([context.transport, message.channelId, message.author?.id].join(':'))
    )
      return { ok: false, reason: '對話控制過於頻繁，請稍後重試' };
    return { ok: true, kind, dryRun: !!c.dryRun };
  }
  /** 閒聊前先看訊息本身值不值得插話（有 @、有回覆、有附件、含關鍵字）。 */
  shouldConsiderCoChat(message, config) {
    config = audienceConfig(config, message.author?.id, false);
    if (!config.coChatEnabled) return { ok: false, reason: '閒聊已關閉' };
    if (message.isMention) return { ok: false, reason: '這是 @ 訊息，交給 @ 回覆處理' };
    const channelId = String(message.channelId || '');
    const monitored = [
      ...(config.monitoredChannelIds || []),
      ...(message.transport === 'user' ? config.userChannelIds || [] : []),
    ];
    if (!monitored.includes(channelId)) return { ok: false, reason: '頻道不在閒聊監控清單' };
    if (!hasReplyContent(message)) return { ok: false, reason: '訊息沒有內容' };
    if (
      !message.stickers?.length &&
      !message.attachments?.length &&
      !message.embeds &&
      String(message.content || '').trim().length < 2
    )
      return { ok: false, reason: '訊息太短' };
    const probability = Math.max(0, Math.min(100, Number(config.coChatProbability) || 0));
    if (probability <= 0) return { ok: false, reason: '插話機率為 0' };
    if (config.coChatRequireKeyword) {
      const keywords = config.interestKeywords || [];
      const text = describeRichContent(
        message.content,
        message.stickers,
        message.attachments,
        message.embedDetails,
      );
      const hit = keywords.some((keyword) => text.toLowerCase().includes(String(keyword).toLowerCase()));
      if (!hit) return { ok: false, reason: '訊息沒有命中興趣關鍵字' };
    }
    const roll = Math.random() * 100;
    if (roll > probability)
      return { ok: false, reason: `未命中插話機率 (${roll.toFixed(0)} > ${probability})` };
    return { ok: true, reason: '' };
  }
}
