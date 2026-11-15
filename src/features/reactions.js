import { audienceConfig } from '../config.js';
/**
 * src/features/reactions.js — 表情反應
 * ============================================================================
 * 三件事：
 *   1. 自動按表情：看到有感訊息，隨機挑一個表情按上去（可限制只在伺服器頻道）
 *   2. 表情指令：使用者對著訊息按觸發表情（預設 ❓ / 🤖）時，叫模型回覆
 *   3. 表情情報：把別人對訊息的表情統計寫進歷史，讓模型知道大家對哪句話有反應
 * ============================================================================
 */
import { truncate } from '../util.js';
import { accessReason } from './message-policy.js';

export function createReactionEngine({ ctx, getConfig, history, ledger, log, semaphore, responder, gate }) {
  const lastReactionAt = new Map();
  const pendingCommand = new Set();

  // 表情池留空時的通用表情：這個群組還沒有任何反應紀錄時才會用到。
  const GENERIC_REACTIONS = ['👍', '❤️', '😂', '🔥', '👀', '🎉'];
  /**
   * 挑一個要按的表情。
   * - 表情池有內容：只從表情池隨機挑。
   * - 表情池留空：跟著這個群組的習慣，從大家最近實際按過的表情裡依次數加權挑；
   *   沒有紀錄時從幾個通用表情挑。不另外呼叫模型。
   */
  function pickEmoji(config, message) {
    const pool = Array.isArray(config.autoReactionEmojis) ? config.autoReactionEmojis.filter(Boolean) : [];
    if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
    const common = message
      ? history?.commonReactions?.({ channelId: message.channelId, guildId: message.guildId }) || []
      : [];
    if (!common.length) return GENERIC_REACTIONS[Math.floor(Math.random() * GENERIC_REACTIONS.length)];
    let roll = Math.random() * common.reduce((sum, row) => sum + row.weight, 0);
    for (const row of common) {
      roll -= row.weight;
      if (roll <= 0) return row.emoji;
    }
    return common[0].emoji;
  }

  /** 自動按表情（在訊息進來時呼叫）。 */
  async function autoReact(message, transport, { decision, effectiveConfig } = {}) {
    if (!decision?.ok) return { ok: false, reason: '訊息未通過回覆檢查' };
    const config =
      effectiveConfig || audienceConfig(getConfig(), message.author?.id, message.isDm && !message.isGroupDm);
    if (!config.autoReactionEnabled) return { ok: false, reason: '自動表情已關閉' };
    if (config.dryRun) return { ok: true, dryRun: true, skipped: true, reason: '演練模式不送出表情反應' };
    if (config.autoReactionOnlyGuild && !message.guildId) return { ok: false, reason: '非伺服器訊息' };
    const denied = accessReason(message, config);
    if (denied) return { ok: false, reason: denied };
    if (message.author?.id === transport.selfId) return { ok: false, reason: '自己的訊息' };
    if (config.blacklistChannelIds?.includes(String(message.channelId)))
      return { ok: false, reason: '頻道在黑名單' };
    const chance = Math.max(0, Math.min(100, Number(config.autoReactionChance) || 0));
    if (chance <= 0 || Math.random() * 100 > chance) return { ok: false, reason: '未命中機率' };
    const key = `${message.channelId}:${message.id}`;
    if (lastReactionAt.has(key)) return { ok: false, reason: '已處理' };
    lastReactionAt.set(key, Date.now());
    if (lastReactionAt.size > 500) lastReactionAt.delete(lastReactionAt.keys().next().value);

    const emoji = pickEmoji(config, message);
    const result = await transport.sendReaction(message.channelId, message.id, emoji);
    if (result.ok) {
      ledger.record('reaction', { userId: message.author?.id });
      log.info('reaction.auto', '自動按表情', { emoji, channelId: message.channelId, messageId: message.id });
    } else {
      log.debug('reaction.auto', '按表情失敗', { error: result.error });
    }
    return result;
  }

  const followed = new Set();
  const lastFollowAt = new Map();
  /**
   * 跟著按表情：別人對訊息按了表情時，有機率跟著按同一個。
   * 只跟「已經存在於那則訊息上的反應」，所以別的伺服器的自訂表情也能跟（不需要 Nitro）；
   * 這些表情不會進入主動加表情的挑選範圍。不呼叫模型。
   * @param {{channelId:string,messageId:string,emoji:string,userId:string,guildId?:string|null,removed?:boolean,dm?:boolean}} event
   */
  async function followReaction(event, transport) {
    const config = getConfig();
    if (!config.reactionFollowEnabled) return { ok: false, reason: '跟著按表情已關閉' };
    if (!event?.channelId || !event?.messageId || !event?.emoji || event.removed)
      return { ok: false, reason: '不是新增表情事件' };
    if (String(event.userId) === String(transport.selfId)) return { ok: false, reason: '自己按的表情' };
    if (config.autoReactionOnlyGuild && !event.guildId) return { ok: false, reason: '非伺服器訊息' };
    const denied = accessReason(
      { channelId: event.channelId, guildId: event.guildId, author: { id: event.userId } },
      config,
    );
    if (denied) return { ok: false, reason: denied };
    // 觸發表情指令的表情交給表情指令處理，不跟。
    const plain = (value) => String(value ?? '').replace(/\uFE0F/g, '');
    if (
      config.reactionCommandEnabled &&
      (config.reactionCommandTriggerEmojis || []).some((item) => plain(item) === plain(event.emoji))
    )
      return { ok: false, reason: '這是表情指令' };
    const key = `${event.channelId}:${event.messageId}:${plain(event.emoji)}`;
    if (followed.has(key)) return { ok: false, reason: '已經跟過' };
    const entry = history?.find?.(event.channelId, event.messageId);
    const count = entry?.reactions?.find((row) => plain(row.emoji) === plain(event.emoji))?.count || 1;
    if (count < Math.max(1, Number(config.reactionFollowMinCount) || 1))
      return { ok: false, reason: '按的人還不夠多' };
    // 同一個頻道十秒內最多跟一次，避免表情洗版時連續跟按。
    if (Date.now() - (lastFollowAt.get(event.channelId) || 0) < 10000)
      return { ok: false, reason: '剛跟過，稍後再說' };
    const chance = Math.max(0, Math.min(100, Number(config.reactionFollowChance) || 0));
    if (chance <= 0 || Math.random() * 100 >= chance) return { ok: false, reason: '未命中機率' };
    followed.add(key);
    if (followed.size > 1000) followed.delete(followed.values().next().value);
    lastFollowAt.set(event.channelId, Date.now());
    if (lastFollowAt.size > 400) lastFollowAt.delete(lastFollowAt.keys().next().value);
    if (config.dryRun) return { ok: true, dryRun: true, skipped: true, reason: '演練模式不送出表情反應' };
    const result = await transport.sendReaction(event.channelId, event.messageId, event.emoji);
    if (result.ok) {
      ledger.record('reaction', { userId: event.userId });
      log.info('reaction.follow', '跟著按表情', {
        emoji: event.emoji,
        channelId: event.channelId,
        messageId: event.messageId,
      });
    } else {
      log.debug('reaction.follow', '跟著按表情失敗', { error: result.error });
    }
    return result;
  }

  /**
   * 表情指令：使用者對某則訊息按了觸發表情 → 讓模型針對那則訊息回覆。
   * @param {{channelId:string,messageId:string,emoji:string,userId:string,userName?:string,dm?:boolean,transport:string}} event
   */
  async function handleReaction(event, transport) {
    const config = getConfig();
    if (!config.reactionCommandEnabled) return { ok: false, reason: '表情指令已關閉' };
    if (!event?.channelId || !event?.messageId) return { ok: false, reason: '事件資料不完整' };
    const triggers = Array.isArray(config.reactionCommandTriggerEmojis)
      ? config.reactionCommandTriggerEmojis
      : [];
    // Discord 送來的表情可能帶或不帶變體選擇符（U+FE0F），比對前先去掉。
    const plainEmoji = (value) => String(value ?? '').replace(/\uFE0F/g, '');
    if (!triggers.some((item) => plainEmoji(item) === plainEmoji(event.emoji)))
      return { ok: false, reason: '非觸發表情' };
    if (event.userId === transport.selfId) return { ok: false, reason: '自己按的表情' };
    if (config.blacklistUserIds?.includes(String(event.userId)))
      return { ok: false, reason: '使用者不在允許名單' };
    // 表情指令一律走正式回覆流程（存取檢查、配額、審稿）；沒有回覆服務時不自行呼叫模型。
    if (!responder || !gate) return { ok: false, reason: '回覆服務尚未就緒' };
    if (pendingCommand.has(event.messageId)) return { ok: false, reason: '已在處理中' };
    pendingCommand.add(event.messageId);
    try {
      const fetched = await transport.getMessages(event.channelId, 40);
      const target = fetched.ok ? fetched.messages.find((item) => item.id === event.messageId) : null;
      if (!target) return { ok: false, reason: '找不到目標訊息' };
      {
        const c = audienceConfig(getConfig(), event.userId, Boolean(event.dm));
        const kind = event.dm ? 'dm' : 'mention';
        const input = {
          ...target,
          author: { id: String(event.userId), name: event.userName || String(event.userId) },
        };
        const denied = accessReason(input, c);
        if (denied) return { ok: false, reason: denied };
        const decision = gate.check(input, kind, {
          selfId: transport.selfId,
          transportEnabled: c.botEnabled,
          transport: transport.kind,
        });
        if (!decision.ok) return decision;
        return responder.respond(input, kind, transport, {
          requesterId: String(event.userId),
          instruction: '使用者以表情要求你回應此則目標訊息。',
        });
      }
    } catch (error) {
      log.error('reaction.command', '表情指令處理失敗', { error: error.message });
      return { ok: false, error: truncate(error.message, 200) };
    } finally {
      pendingCommand.delete(event.messageId);
    }
  }

  /** 表情情報：別人按了表情就更新歷史統計。 */
  function recordIntel(event) {
    const config = getConfig();
    if (!config.reactionIntelEnabled) return;
    history.tallyReaction(event.channelId, event.messageId, event.emoji, event.removed ? -1 : 1);
  }

  return { autoReact, handleReaction, followReaction, recordIntel };
}
