/**
 * src/history.js — 對話記憶 (group history store)
 * ============================================================================
 * 功能：
 *   1. 保存每個頻道最近的訊息（含作者、附件、貼圖、回覆引用、表情統計）
 *   2. 提供給自動回覆 / 閒聊的上下文文字
 *   3. 表情統計（reaction tally），讓 AI 知道大家對訊息按了什麼
 *   4. 依 retentionDays 過期、依 maxPerChannel 截斷，並定期落地到 data/history.json
 * ============================================================================
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { nowIso, truncate } from './util.js';
import { describeRichContent } from './persona.js';

const MAX_CHANNELS = 400;
const reactionSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * 把兩個介面回報的原始訊息正規化成內部格式。
 * @param {Record<string, any>} raw
 * @param {'user'|'bot'} transport
 */
export function normalizeMessage(raw, transport, selfId = '') {
  const author = raw.author || {};
  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments.map((att) => ({
        name: att.name || att.filename || 'attachment',
        url: att.url || '',
        contentType: att.contentType || att.content_type || '',
        size: att.size || 0,
        durationSecs: Number(att.durationSecs ?? att.duration_secs) || undefined,
        waveform: typeof att.waveform === 'string' ? att.waveform.slice(0, 344) : undefined,
      }))
    : [];
  const stickers = Array.isArray(raw.stickers || raw.sticker_items)
    ? (raw.stickers || raw.sticker_items).map((st) => ({
        id: String(st.id),
        name: st.name || st.id,
        description: String(st.description || '').slice(0, 300),
        ...([1, 2, 3, 4].includes(Number(st.formatType ?? st.format_type))
          ? { formatType: Number(st.formatType ?? st.format_type) }
          : {}),
      }))
    : [];
  const mentions = (raw.mentions || []).map((m) =>
    typeof m === 'string'
      ? { id: m, name: '' }
      : {
          id: String(m.id || ''),
          name:
            m.member?.nick || m.displayName || m.display_name || m.name || m.global_name || m.username || '',
        },
  );
  const guildId = raw.guildId || raw.guild_id || undefined;
  const embedDetails = (raw.embedDetails || (Array.isArray(raw.embeds) ? raw.embeds : []))
    .slice(0, 5)
    .map((e) => ({
      type: String(e.type || ''),
      title: String(e.title || '').slice(0, 300),
      description: String(e.description || '').slice(0, 500),
      url: String(e.url || '').slice(0, 1000),
      provider: String(e.provider?.name || e.provider || '').slice(0, 100),
      imageUrl: String(e.imageUrl || e.image?.url || e.thumbnail?.url || e.video?.url || '').slice(0, 1000),
      thumbnailUrl: String(e.thumbnailUrl || e.thumbnail?.url || '').slice(0, 1000),
      videoUrl: String(e.videoUrl || e.video?.url || '').slice(0, 1000),
    }));
  const cleanName = (value) =>
    typeof value === 'string'
      ? value
          .replace(/[\r\n\x00-\x1f]/g, ' ')
          .trim()
          .slice(0, 100)
      : '';
  const guildNickname = guildId ? cleanName(raw.member?.nick || author.guildNickname) : '';
  const displayName = cleanName(
    author.displayName ||
      author.display_name ||
      author.global_name ||
      author.globalName ||
      author.name ||
      author.username ||
      raw.authorName,
  );
  const stamp = raw.ts || raw.createdAt || raw.timestamp || nowIso();
  return {
    id: String(raw.id || ''),
    channelId: String(raw.channelId || raw.channel_id || ''),
    channelName: raw.channelName || '',
    guildId,
    guildName: raw.guildName || '',
    transport,
    author: {
      id: String(author.id || raw.authorId || ''),
      name: guildNickname || displayName || '未知使用者',
      username: cleanName(author.username),
      displayName,
      guildNickname,
      tag: author.tag || raw.authorTag || '',
      bot: Boolean(author.bot ?? raw.authorBot),
    },
    content: String(raw.content || ''),
    interactionInput: raw.interactionInput === true,
    interactionAccountId: raw.interactionInput === true ? String(raw.interactionAccountId || '') : undefined,
    isVoiceMessage: Boolean(raw.isVoiceMessage || (Number(raw.flags) || 0) & 8192),
    ts: typeof stamp === 'number' ? new Date(stamp).toISOString() : stamp,
    replyTo: raw.replyTo || raw.message_reference?.message_id || raw.referenced_message?.id || undefined,
    replyToAuthorId: raw.replyToAuthorId || raw.referenced_message?.author?.id || undefined,
    attachments,
    stickers,
    // 呼叫端有時傳「數量」（bot 的 REST 映射）有時傳「陣列」，兩種都要吃。
    embeds: typeof raw.embeds === 'number' ? raw.embeds : Array.isArray(raw.embeds) ? raw.embeds.length : 0,
    embedDetails,
    reactions: Array.isArray(raw.reactions)
      ? raw.reactions.map((r) => ({
          emoji: typeof r.emoji === 'string' ? r.emoji
            : r.emoji?.id ? `${r.emoji.name || 'emoji'}:${r.emoji.id}`
              : typeof r.emoji?.name === 'string' ? r.emoji.name : '',
          count: Number(r.count) || 1,
        })).filter((r) => r.emoji)
      : [],
    mentions,
    isDm: raw.isDm !== undefined ? Boolean(raw.isDm) : !guildId,
    isGroupDm: Boolean(raw.isGroupDm || raw.channelType === 3 || raw.channelType === 'group'),
    isMention: Boolean(
      raw.isMention ||
      (selfId &&
        (mentions.some((m) => m.id === selfId) ||
          String(raw.content || '').includes(`<@${selfId}>`) ||
          String(raw.content || '').includes(`<@!${selfId}>`))),
    ),
    edited: Boolean(raw.edited),
    stickerText: raw.stickerText || '',
  };
}

/** 給模型看的單行格式。 */
export function formatForPrompt(entry) {
  const time = new Date(entry.ts);
  const clock = Number.isFinite(time.getTime())
    ? `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`
    : '--:--';
  const who = entry.author?.name || '某人';
  const bits = [];
  const rich = describeRichContent(entry.content, entry.stickers, entry.attachments, entry.embedDetails);
  if (rich) bits.push(rich);
  if (entry.stickerText) bits.push(entry.stickerText);
  if (entry.reactions?.length) {
    bits.push(`[表情 ${entry.reactions.map((r) => `${r.emoji}×${r.count}`).join(' ')}]`);
  }
  if (!bits.length) bits.push('[無文字內容]');
  return `[${clock}] ${who}${entry.author?.id ? ' [ID ' + entry.author.id + ']' : ''}${entry.author?.bot ? '(bot)' : ''}: ${truncate(bits.join(' '), 400)}`;
}

export class HistoryStore {
  constructor(options = {}) {
    this.file = options.file || '';
    this.log = options.log || console;
    this.config = options.config || {};
    this.channels = new Map();
    this.saveTimer = null;
    // 這只是快取：變動後最多等 10 秒才整檔寫入一次（卸載時仍會立即寫入）。
    this.saveDelayMs = 10000;
    this.prunedAt = 0;
    this.dirty = false;
    this.revisions = new Map();
    this.messageRevisions = new Map();
    this.deleted = new Set();
  }

  configure(config) {
    this.config = config;
    this.prune();
  }

  enabled() {
    return this.config?.historyEnabled !== false;
  }

  retentionMs() {
    return Math.max(1, Number(this.config?.historyRetentionDays) || 14) * 86_400_000;
  }

  maxPerChannel() {
    return Math.max(20, Number(this.config?.historyMaxPerChannel) || 200);
  }

  async load() {
    if (!this.file) return;
    try {
      const raw = await readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      const channels = parsed?.channels || {};
      for (const [channelId, list] of Object.entries(channels)) {
        if (Array.isArray(list)) this.channels.set(channelId, list);
      }
      this.prune();
    } catch (error) {
      if (error.code !== 'ENOENT') this.log.warn?.('history', `讀取對話記憶失敗: ${error.message}`);
    }
  }

  markDirty() {
    this.dirty = true;
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save().catch(() => {});
    }, this.saveDelayMs);
    if (typeof this.saveTimer.unref === 'function') this.saveTimer.unref();
  }

  async save() {
    if (!this.file || !this.dirty) return;
    this.dirty = false;
    // 保留天數原本只在載入與設定變更時套用；運作中每小時最多清一次過期訊息。
    if (Date.now() - this.prunedAt >= 3600000) {
      this.prune();
      this.prunedAt = Date.now();
    }
    const channels = {};
    for (const [channelId, list] of this.channels) channels[channelId] = list.slice(-this.maxPerChannel());
    try {
      await mkdir(dirname(this.file), { recursive: true });
      await writeFile(this.file, JSON.stringify({ savedAt: nowIso(), channels }), 'utf8');
    } catch (error) {
      this.log.warn?.('history', `寫入對話記憶失敗: ${error.message}`);
    }
  }

  async flush() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.save();
  }

  /** 記錄一則訊息（已存在的 id 會被忽略）。 */
  record(raw, transport = 'user') {
    if (!this.enabled()) return null;
    const entry = normalizeMessage(raw, transport);
    if (!entry.id || !entry.channelId) return null;
    const policy = this.sourcePolicyFor?.(entry.channelId, entry.id);
    if (policy?.action === 'forget') return null;
    if (policy?.action === 'correct') {
      entry.content = policy.content;
      entry.edited = true;
    }
    if (this.deleted.has(`${entry.channelId}:${entry.id}`)) return null;
    if (entry.author.bot && !this.config?.historyIncludeBots) {
      // 自己送出的訊息仍要記錄，才不會讓上下文缺一腳
      const self = this.selfId(transport);
      if (entry.author.id !== self) return null;
    }
    const list = this.channels.get(entry.channelId) || [];
    // historyStoreAttachments 關閉時只留附件數量，不保存網址（省空間、少敏感資料）。
    if (this.config?.historyStoreAttachments === false && entry.attachments?.length) {
      const count = entry.attachments.length;
      entry.attachments = [];
      entry.attachmentCount = count;
    }
    // 從尾端往前找：重複或被編輯的幾乎都是最近的訊息。
    const index = list.findLastIndex((item) => item.id === entry.id);
    if (index >= 0) {
      // 編輯訊息：就地更新
      list[index] = { ...list[index], ...entry, edited: entry.edited || list[index].edited };
      this.markDirty();
      return list[index];
    }
    // 訊息幾乎都依時間順序到達：只有新訊息比目前最後一則早（補抓歷史、亂序）時才重新排序整個頻道。
    const last = list[list.length - 1];
    list.push(entry);
    if (last && (new Date(last.ts) - new Date(entry.ts) || last.id.localeCompare(entry.id)) > 0)
      list.sort((a, b) => new Date(a.ts) - new Date(b.ts) || a.id.localeCompare(b.id));
    if (list.length > this.maxPerChannel()) list.splice(0, list.length - this.maxPerChannel());
    this.channels.set(entry.channelId, list);
    if (this.channels.size > MAX_CHANNELS) {
      const oldest = this.channels.keys().next().value;
      if (oldest && oldest !== entry.channelId) this.channels.delete(oldest);
    }
    this.markDirty();
    return entry;
  }

  selfIds = new Map();

  revision(channelId, messageId) {
    return messageId
      ? this.messageRevisions.get(`${channelId}:${messageId}`) || 0
      : this.revisions.get(String(channelId)) || 0;
  }

  invalidate(channelId, messageId, deleted = false) {
    channelId = String(channelId);
    messageId = String(messageId);
    this.revisions.set(channelId, this.revision(channelId) + 1);
    this.messageRevisions.set(`${channelId}:${messageId}`, this.revision(channelId, messageId) + 1);
    if (this.messageRevisions.size > 10000)
      this.messageRevisions.delete(this.messageRevisions.keys().next().value);
    if (deleted) {
      this.deleted.add(`${channelId}:${messageId}`);
      if (this.deleted.size > 10000) this.deleted.delete(this.deleted.values().next().value);
    }
    // Remove immediately so a failed edit fetch cannot leave stale text in prompts.
    const list = this.channels.get(channelId);
    if (list)
      this.channels.set(
        channelId,
        list.filter((item) => item.id !== messageId),
      );
    this.markDirty();
  }

  find(channelId, messageId) {
    return (this.channels.get(String(channelId)) || []).find((item) => item.id === String(messageId));
  }

  setSelfId(transport, id) {
    if (id) this.selfIds.set(transport, String(id));
  }

  selfId(transport) {
    return this.selfIds.get(transport) || '';
  }

  /** 加上表情統計。 */
  tallyReaction(channelId, messageId, emoji, delta = 1) {
    if (this.config?.reactionIntelEnabled === false) return;
    const list = this.channels.get(String(channelId));
    if (!list) return;
    const entry = list.find((item) => item.id === String(messageId));
    if (!entry) return;
    entry.reactions = entry.reactions || [];
    const found = entry.reactions.find((r) => r.emoji === emoji);
    if (found) found.count = Math.max(0, found.count + delta);
    else if (delta > 0) entry.reactions.push({ emoji, count: delta });
    entry.reactions = entry.reactions.filter((r) => r.count > 0);
    this.markDirty();
  }

  /**
   * 這個群組最近實際被按過的表情（表情池留空時用來「跟著群組習慣」）。
   * 同頻道的次數算三倍、同伺服器其他頻道算一倍；只列一般表情，
   * 因為伺服器自訂表情不一定能由這個帳號使用。
   */
  commonReactions({ channelId, guildId, limit = 12 } = {}) {
    const weights = new Map();
    for (const [id, list] of this.channels) {
      const sameChannel = id === String(channelId);
      if (!sameChannel && !(guildId && list[list.length - 1]?.guildId === String(guildId))) continue;
      for (const entry of list)
        for (const reaction of entry.reactions || []) {
          const emoji = String(reaction.emoji || '');
          if (
            !emoji || /\d{15,}/.test(emoji) || emoji.length > 32 ||
            !/[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u.test(emoji) ||
            [...reactionSegmenter.segment(emoji)].length !== 1
          ) continue;
          weights.set(
            emoji,
            (weights.get(emoji) || 0) + (Number(reaction.count) || 0) * (sameChannel ? 3 : 1),
          );
        }
    }
    return [...weights]
      .filter(([, weight]) => weight > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.max(1, limit))
      .map(([emoji, weight]) => ({ emoji, weight }));
  }

  /** 最近 N 則（舊到新）。 */
  recent(channelId, limit = 10) {
    const list = this.channels.get(String(channelId)) || [];
    return list.slice(-Math.max(1, limit));
  }

  /** 給模型看的上下文文字。 */
  contextText(channelId, limit = 12) {
    return this.recent(channelId, limit)
      .map((entry) => formatForPrompt(entry))
      .join('\n');
  }

  size(channelId) {
    return (this.channels.get(String(channelId)) || []).length;
  }

  /** 把 ID 對應成名稱（給設定介面顯示用）：使用者→顯示名稱、頻道→「# 名稱」、伺服器→名稱。查不到的不回傳。 */
  knownNames(ids) {
    const wanted = new Set(
      (Array.isArray(ids) ? ids : [])
        .slice(0, 500)
        .map(String)
        .filter((id) => /^\d{17,20}$/.test(id)),
    );
    const names = {};
    const stamps = {};
    if (!wanted.size) return names;
    for (const [channelId, list] of this.channels) {
      const last = list[list.length - 1];
      if (wanted.has(channelId) && last?.channelName) names[channelId] = '# ' + last.channelName;
      if (last?.guildId && wanted.has(last.guildId) && last.guildName) names[last.guildId] = last.guildName;
      for (const entry of list) {
        const id = entry.author?.id;
        if (!id || !wanted.has(id) || !entry.author.name) continue;
        const at = Date.parse(entry.ts) || 0;
        if (!(id in stamps) || at >= stamps[id]) {
          stamps[id] = at;
          names[id] = entry.author.name;
        }
      }
    }
    return names;
  }

  /** 最近說過話的人（給設定介面挑選使用者 ID）：只回 ID、目前顯示名稱與最後發言時間，不含訊息內容。 */
  recentAuthors(limit = 60) {
    const selves = new Set(this.selfIds.values());
    const seen = new Map();
    for (const list of this.channels.values())
      for (const entry of list) {
        const id = entry.author?.id;
        if (!id || entry.author.bot || selves.has(id)) continue;
        const at = Date.parse(entry.ts) || 0;
        const previous = seen.get(id);
        if (!previous || at >= previous.at) seen.set(id, { id, name: entry.author.name || id, at });
      }
    return [...seen.values()]
      .sort((a, b) => b.at - a.at)
      .slice(0, Math.max(1, Math.min(200, Number(limit) || 60)))
      .map((row) => ({ id: row.id, name: row.name, lastSeen: new Date(row.at).toISOString() }));
  }

  prune() {
    const cutoff = Date.now() - this.retentionMs();
    for (const [channelId, list] of this.channels) {
      const kept = list.filter((entry) => {
        const stamp = Date.parse(entry.ts);
        return !Number.isFinite(stamp) || stamp >= cutoff;
      });
      const capped = kept.slice(-this.maxPerChannel());
      if (capped.length === 0) this.channels.delete(channelId);
      else this.channels.set(channelId, capped);
    }
  }

  clear(channelId) {
    if (channelId) this.channels.delete(String(channelId));
    else this.channels.clear();
    this.markDirty();
    return { ok: true, channels: this.channels.size };
  }

  stats() {
    let messages = 0;
    for (const list of this.channels.values()) messages += list.length;
    return { channels: this.channels.size, messages, retentionDays: this.config?.historyRetentionDays };
  }

  listChannels() {
    return [...this.channels.entries()]
      .map(([channelId, list]) => {
        const last = list[list.length - 1];
        return {
          channelId,
          channelName: last?.channelName || last?.author?.name || channelId,
          guildName: last?.guildName || '',
          count: list.length,
          lastTs: last?.ts || null,
        };
      })
      .sort((a, b) => String(b.lastTs || '').localeCompare(String(a.lastTs || '')));
  }
}
