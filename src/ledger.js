/**
 * src/ledger.js — 每日額度與對話輪數記帳
 * ============================================================================
 * 目的與來源插件的 ledger 相同：限制每日自動回覆 / 插話次數，並記錄每位
 * 使用者的連續對話輪數，避免對同一個人無止境地回覆。
 * 狀態存在 data/ledger.json，跨重啟保留，日期變更時自動歸零。
 * ============================================================================
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

function todayKey() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function emptyState() {
  return {
    date: todayKey(),
    mentionReplies: 0,
    dmReplies: 0,
    coChats: 0,
    reactions: 0,
    gifs: 0,
    errors: 0,
    users: {},
    updatedAt: new Date().toISOString(),
  };
}

export class Ledger {
  constructor(options = {}) {
    this.file = options.file || '';
    this.log = options.log || console;
    this.state = emptyState();
    this.saveTimer = null;
    this.dirty = false;
  }

  async load() {
    if (!this.file) return this.state;
    try {
      const raw = await readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      this.state = { ...emptyState(), ...parsed };
      if (!this.state.users || typeof this.state.users !== 'object') this.state.users = {};
      for (const entry of Object.values(this.state.users)) {
        // Migrate old ledgers once; later reactions must not prolong the reply window.
        if (!entry.lastReplyAt) entry.lastReplyAt = entry.lastAt || null;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.log.warn?.('ledger', `讀取記帳檔失敗: ${error.message}`);
      }
      this.state = emptyState();
    }
    this.rolloverIfNeeded();
    return this.state;
  }

  rolloverIfNeeded() {
    const today = todayKey();
    if (this.state.date === today) return false;
    const users = {};
    // 只保留連續輪數（同一人跨日仍可在對話中），每日統計歸零
    // 超過七天沒有互動的使用者與對話不再帶到新的一天（連續輪數早已過期），避免記帳檔只增不減。
    const cutoff = Date.now() - 7 * 86_400_000;
    const fresh = (stamp) => Date.parse(stamp || '') >= cutoff;
    for (const [id, entry] of Object.entries(this.state.users || {})) {
      if (!fresh(entry.lastAt) && !fresh(entry.lastReplyAt)) continue;
      const conversations = {};
      for (const [key, row] of Object.entries(entry.conversations || {}))
        if (fresh(row?.lastReplyAt)) conversations[key] = row;
      users[id] = {
        rounds: entry.rounds || 0,
        lastAt: entry.lastAt || null,
        lastReplyAt: entry.lastReplyAt || entry.lastAt || null,
        conversations,
      };
    }
    this.state = { ...emptyState(), date: today, users };
    this.markDirty();
    return true;
  }

  markDirty() {
    this.dirty = true;
    if (!this.file) return;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save().catch(() => {});
    }, 1500);
    if (typeof this.saveTimer.unref === 'function') this.saveTimer.unref();
  }

  async save() {
    if (!this.file || !this.dirty) return;
    this.dirty = false;
    this.state.updatedAt = new Date().toISOString();
    try {
      await mkdir(dirname(this.file), { recursive: true });
      await writeFile(this.file, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (error) {
      this.log.warn?.('ledger', `寫入記帳檔失敗: ${error.message}`);
    }
  }

  async flush() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.save();
  }

  user(id) {
    if (!this.state.users[id]) {
      this.state.users[id] = { rounds: 0, lastAt: null };
    }
    return this.state.users[id];
  }

  /** 檢查某一類配額是否還有空間（不改動計數）。 */
  can(kind, config) {
    this.rolloverIfNeeded();
    const s = this.state;
    if (kind === 'mention') return s.mentionReplies < (config?.maxDailyMentionReplies ?? 60);
    if (kind === 'dm') return s.dmReplies < (config?.maxDailyDmReplies ?? 60);
    if (kind === 'cochat') return s.coChats < (config?.maxDailyCoChats ?? 80);
    return true;
  }

  /** 記一次成功的事件。 */
  record(kind, details = {}) {
    this.rolloverIfNeeded();
    const s = this.state;
    if (kind === 'mention') s.mentionReplies += 1;
    else if (kind === 'dm') s.dmReplies += 1;
    else if (kind === 'cochat') s.coChats += 1;
    else if (kind === 'reaction') s.reactions += 1;
    else if (kind === 'gif') s.gifs += 1;
    else if (kind === 'error') s.errors += 1;
    if (details.userId) {
      const user = this.user(details.userId);
      user.lastAt = new Date().toISOString();
      if (kind === 'mention' || kind === 'dm') {
        this.expireRounds(user, this.config || {});
        user.rounds = (user.rounds || 0) + 1;
        user.lastReplyAt = new Date().toISOString();
        const conversation = this.conversation(user, details);
        if (conversation !== user) {
          this.expireRounds(conversation, this.config || {});
          conversation.rounds = (conversation.rounds || 0) + 1;
          conversation.lastReplyAt = user.lastReplyAt;
        }
      }
    }
    this.markDirty();
    return this.getDailyStats();
  }

  /** 使用者的連續輪數是否已達上限。 */
  roundsExceeded(userId, config, scope = {}) {
    const cap = Number(config?.roundCapPerUser ?? 5);
    const user = this.conversation(this.user(userId), scope);
    this.expireRounds(user, config);
    return cap > 0 && (user.rounds || 0) >= cap;
  }

  conversation(user, scope = {}) {
    if (!scope.transport || !scope.channelId) return user;
    const key = `${scope.transport}:${scope.channelId}`;
    user.conversations ||= {};
    if (!user.conversations[key]) {
      // Legacy totals mixed transports/channels and cannot be attributed reliably.
      user.conversations[key] = { rounds: 0, lastReplyAt: null };
      const keys = Object.keys(user.conversations);
      if (keys.length > 200) {
        const oldest = keys
          .filter((k) => k !== key)
          .sort((a, b) =>
            String(user.conversations[a].lastReplyAt || '').localeCompare(
              String(user.conversations[b].lastReplyAt || ''),
            ),
          )[0];
        delete user.conversations[oldest];
      }
    }
    return user.conversations[key];
  }

  expireRounds(user, config) {
    const last = Date.parse(user.lastReplyAt || user.lastAt || '');
    const gap = Math.max(1, Number(config?.roundResetMinutes) || 10) * 60000;
    if (user.rounds && (!Number.isFinite(last) || Date.now() - last >= gap)) {
      user.rounds = 0;
      this.markDirty();
    }
  }

  /** 今天某一類事件已經用掉多少額度。 */
  usedToday(kind) {
    this.rolloverIfNeeded();
    const s = this.state;
    if (kind === 'mention') return s.mentionReplies;
    if (kind === 'dm') return s.dmReplies;
    if (kind === 'cochat') return s.coChats;
    if (kind === 'reaction') return s.reactions;
    if (kind === 'gif') return s.gifs;
    if (kind === 'error') return s.errors;
    return 0;
  }

  /** 記住目前設定（給 can() 使用）。 */
  configure(config) {
    this.config = config || {};
  }

  /** 手動歸零今日統計（連續輪數一併清除）。 */
  reset() {
    this.state = emptyState();
    this.markDirty();
    return this.getDailyStats();
  }

  resetRounds(userId) {
    if (userId) {
      this.user(userId).rounds = 0;
      this.user(userId).conversations = {};
    } else {
      for (const entry of Object.values(this.state.users)) {
        entry.rounds = 0;
        entry.conversations = {};
      }
    }
    this.markDirty();
  }

  getDailyStats() {
    this.rolloverIfNeeded();
    const s = this.state;
    return {
      date: s.date,
      mentionReplies: s.mentionReplies,
      dmReplies: s.dmReplies,
      coChats: s.coChats,
      reactions: s.reactions,
      gifs: s.gifs,
      errors: s.errors,
      activeUsers: Object.keys(s.users || {}).length,
      updatedAt: s.updatedAt,
    };
  }
}

export function ledgerFilePath(dataDir) {
  return join(dataDir, 'ledger.json');
}
