const validId = (value) => /^\d{15,22}$/.test(String(value || ''));
const clean = (value) =>
  typeof value === 'string'
    ? value
        .replace(/[\x00-\x1f\x7f]/g, ' ')
        .trim()
        .slice(0, 100)
    : null;
const fields = ['username', 'displayName', 'guildNickname'];

// Names are presentation data. Authorization always uses the original user ID.
export class MemberNames {
  constructor({ getConfig, history, now = Date.now, lookupTimeoutMs = 1500 }) {
    Object.assign(this, { getConfig, history, now, lookupTimeoutMs });
    this.rows = new Map();
    this.pending = new Map();
    this.updates = 0;
  }
  key(t, guildId, userId) {
    return [t.kind, t.selfId, guildId || '@me', userId].join(':');
  }
  update(event, t, { observed = false } = {}) {
    if (
      this.getConfig().memberNameUpdatesEnabled === false ||
      !t?.selfId ||
      !validId(event.userId) ||
      (event.guildId && !validId(event.guildId))
    )
      return;
    const guildId = event.guildId || null,
      key = this.key(t, guildId, event.userId);
    const patch = {};
    for (const field of fields)
      if (Object.hasOwn(event, field) && event[field] !== undefined && (guildId || field !== 'guildNickname'))
        patch[field] = clean(event[field]);
    if (!Object.keys(patch).length) return;
    // 每則訊息都會帶著發話者名稱進來；名稱與已知的相同時，快取早已是最新，不必再掃過全部歷史訊息。
    const known = this.rows.get(key);
    if (observed && known && Object.keys(patch).every((field) => known[field] === patch[field])) {
      this.rows.delete(key);
      this.rows.set(key, known);
      return;
    }
    const row = { ...known, ...patch, id: event.userId, at: this.now() };
    this.rows.delete(key);
    this.rows.set(key, row);
    if (!guildId)
      for (const [k, r] of this.rows) {
        if (k.startsWith(t.kind + ':' + t.selfId + ':') && r.id === event.userId)
          this.rows.set(k, { ...r, ...patch, at: this.now() });
      }
    while (this.rows.size > 1000) this.rows.delete(this.rows.keys().next().value);
    if (!observed) this.updates++;
    let changed = false;
    for (const entries of this.history?.channels?.values?.() || [])
      for (const m of entries) {
        if (m.author?.id !== event.userId || (guildId && m.guildId !== guildId)) continue;
        const prior = JSON.stringify(m.author);
        Object.assign(m.author, patch);
        m.author.name =
          (m.guildId && m.author.guildNickname) || m.author.displayName || m.author.username || event.userId;
        changed ||= JSON.stringify(m.author) !== prior;
      }
    if (changed) this.history.markDirty?.();
  }
  observe(message, t) {
    if (!message.author?.id) return;
    const a = message.author,
      event = { userId: a.id, guildId: message.guildId };
    for (const field of fields) if (Object.hasOwn(a, field)) event[field] = a[field];
    if (!Object.hasOwn(a, 'displayName') && a.name) event.displayName = a.name;
    this.update(event, t, { observed: true });
  }
  decorate(message, t) {
    if (this.getConfig().memberNameUpdatesEnabled === false || !message.author?.id) return message;
    const row = this.rows.get(this.key(t, message.guildId, message.author.id));
    const global = this.rows.get(this.key(t, null, message.author.id));
    if (!row && !global) return message;
    const author = { ...message.author };
    for (const source of [global, row])
      for (const field of fields) if (source && Object.hasOwn(source, field)) author[field] = source[field];
    author.name =
      (message.guildId && author.guildNickname) || author.displayName || author.username || author.id;
    return { ...message, author };
  }
  author(t, userId, guildId) {
    const row = this.rows.get(this.key(t, guildId, userId));
    const global = this.rows.get(this.key(t, null, userId));
    return {
      id: userId,
      name:
        row?.guildNickname ||
        row?.displayName ||
        global?.displayName ||
        row?.username ||
        global?.username ||
        '語音參與者',
      username: row?.username || global?.username,
      displayName: row?.displayName || global?.displayName,
      guildNickname: row?.guildNickname,
      bot: false,
    };
  }
  async resolve(t, userId, guildId) {
    if (!validId(userId) || (guildId && !validId(guildId)))
      return { id: userId, name: '語音參與者', bot: false };
    if (this.getConfig().memberNameUpdatesEnabled === false)
      return { id: userId, name: '語音參與者', bot: false };
    const key = this.key(t, guildId, userId),
      prior = this.rows.get(key);
    if (!prior || this.now() - prior.at > 300000) {
      if (!this.pending.has(key) && this.pending.size < 20) {
        const selfId = t.selfId,
          epoch = t.epoch,
          generation = t.connectionGeneration;
        const job = (async () => {
          try {
            const value = await t.memberName?.(guildId, userId);
            if (
              value?.ok &&
              selfId === t.selfId &&
              epoch === t.epoch &&
              generation === t.connectionGeneration &&
              this.rows.get(key) === prior
            )
              this.update({ userId, guildId, ...value.author }, t, { observed: true });
          } catch {
            /* Cache miss must not block speech. */
          }
        })().finally(() => this.pending.delete(key));
        this.pending.set(key, job);
      }
      let timer;
      try {
        await Promise.race([
          this.pending.get(key),
          new Promise((resolve) => {
            timer = setTimeout(resolve, this.lookupTimeoutMs);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    }
    return this.author(t, userId, guildId);
  }
  status() {
    return {
      enabled: this.getConfig().memberNameUpdatesEnabled !== false,
      cached: this.rows.size,
      updates: this.updates,
      botMembersIntent: !!this.getConfig().botMembersIntent,
      note: '暱稱只供顯示，權限依使用者 ID 判斷。不掃描全服；Bot 完整接收成員更新需啟用 Members Intent；使用者帳號依 Discord 下發事件與成員快取範圍。',
    };
  }
}
