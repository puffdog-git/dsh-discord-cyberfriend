import { randomUUID } from 'node:crypto';

export class DeliveryTrace {
  constructor({ limit = 200, now = Date.now } = {}) {
    this.rows = new Map();
    this.limit = limit;
    this.now = now;
  }
  mark(message, transport, phase, reason = '') {
    const id = [transport.kind, message.channelId, message.id].join(':');
    const old = this.rows.get(id);
    this.rows.set(id, {
      id,
      messageId: message.id,
      channelId: message.channelId,
      transport: transport.kind,
      phase,
      reason: String(reason).slice(0, 180),
      at: this.now(),
      since: old?.since || this.now(),
    });
    while (this.rows.size > this.limit) this.rows.delete(this.rows.keys().next().value);
  }
  snapshot() {
    return [...this.rows.values()].sort((a, b) => b.at - a.at);
  }
}

function merge(rows, owner) {
  const unique = [...new Map(rows.map((r) => [r.message.id, r.message])).values()];
  const last = unique.at(-1),
    media = (k) => unique.flatMap((m) => m[k] || []);
  return {
    ...last,
    __conversationControl: rows.find((r) => r.transport === owner && r.message.__conversationControl)?.message
      .__conversationControl,
    voiceMessageSource: unique.find((m) => m.voiceMessageSource)?.voiceMessageSource,
    content: unique
      .map((m) => m.content)
      .filter(Boolean)
      .join('\n'),
    attachments: media('attachments'),
    stickers: media('stickers'),
    embedDetails: media('embedDetails'),
    isMention: rows.some((r) => r.transport === owner && r.message.isMention),
    turnMessageIds: unique.map((m) => m.id),
  };
}

// The timer only coalesces ingress; it is not a second proactive scheduling service.
export class TurnCoordinator {
  constructor({ dispatch, cancel, trace = new DeliveryTrace(), now = Date.now }) {
    Object.assign(this, { dispatch, cancel, trace, now });
    this.groups = new Map();
    this.byScope = new Map();
    this.claims = new Map();
    this.closed = false;
  }
  accept(message, transport, { config, kind, identity = 'shared' } = {}) {
    if (this.closed) return Promise.resolve({ ok: false, cancelled: true });
    const scope = [
      identity,
      message.guildId || 'dm',
      message.channelId,
      message.author?.id,
      message.replyToAuthorId || '',
    ].join(':');
    const claim = [identity, message.channelId, message.id].join(':');
    for (const [id, row] of this.claims) if (this.now() - row.at > 300000) this.claims.delete(id);
    const previous = this.claims.get(claim);
    if (previous?.group?.committed || previous?.done)
      return Promise.resolve({ ok: true, skipped: true, reason: '此訊息已由同人格的另一介面接手' });
    let group = previous?.group || this.byScope.get(scope);
    const coalesce =
      config.messageCoalesceEnabled !== false &&
      ['dm', 'mention', 'followup', 'shadow-mention'].includes(kind) &&
      !message.voiceInput &&
      !message.interactionInput &&
      !message.__conversationControl;
    if (
      !previous &&
      group &&
      (group.committed ||
        !coalesce ||
        group.rows.some((r) => r.kind === 'cochat') ||
        group.rows.filter((r) => r.message.id !== message.id).length >= 8 ||
        group.rows.reduce((n, r) => n + (r.message.content?.length || 0), 0) +
          (message.content?.length || 0) >
          12000)
    )
      group = null;
    if (previous?.group && previous.group !== group)
      return Promise.resolve({ ok: true, skipped: true, reason: '另一回合已接手此訊息' });
    if (!group) {
      if (this.groups.size >= 200)
        return Promise.resolve({ ok: false, reason: '等待回合已達上限，請稍後重試' });
      group = {
        id: randomUUID(),
        scope,
        rows: [],
        waiters: [],
        claims: new Set(),
        revision: 0,
        startedAt: this.now(),
        committed: false,
      };
      this.groups.set(group.id, group);
      this.byScope.set(scope, group);
    }
    group.rows.push({ message, transport, kind, config });
    group.revision++;
    this.claims.set(claim, { at: this.now(), group });
    group.claims.add(claim);
    while (this.claims.size > 2000) this.claims.delete(this.claims.keys().next().value);
    this.trace.mark(
      message,
      transport,
      'waiting',
      previous ? '正在選擇單一回覆介面' : '等待同一人的補充訊息',
    );
    if (group.running && !group.committed) {
      group.controller?.abort();
      this.cancel(group.replyMessage || group.message, group.replyTransport || group.owner);
    }
    clearTimeout(group.timer);
    const wait = coalesce ? Math.max(100, Math.min(2500, Number(config.messageCoalesceMs) || 650)) : 100;
    const remaining = Math.max(0, 3000 - (this.now() - group.startedAt));
    group.timer = setTimeout(() => void this.flush(group), Math.min(wait, remaining));
    return new Promise((resolve) => group.waiters.push(resolve));
  }
  async flush(group) {
    if (this.closed) return;
    const revision = group.revision;
    group.controller = new AbortController();
    const rank = (r) =>
      (r.kind === 'mention' ? 100 : r.kind === 'dm' ? 80 : r.kind === 'followup' ? 60 : 10) +
      (r.config.primaryTransport === r.transport.kind ? 1 : 0);
    const choice = [...group.rows].sort((a, b) => rank(b) - rank(a))[0];
    group.owner = choice.transport;
    group.message = merge(group.rows, choice.transport);
    group.running = true;
    const message = group.message;
    this.trace.mark(
      message,
      choice.transport,
      'generating',
      '已合併 ' + message.turnMessageIds.length + ' 則，使用單一回覆介面',
    );
    let result;
    try {
      result = await this.dispatch(message, choice.transport, {
        turnId: group.id,
        revision,
        signal: group.controller.signal,
        sourceIds: message.turnMessageIds,
        kind: choice.kind,
      });
    } catch {
      result = { ok: false, error: '回合處理失敗，請查看診斷' };
    }
    if (revision !== group.revision) return;
    this.groups.delete(group.id);
    if (this.byScope.get(group.scope) === group) this.byScope.delete(group.scope);
    for (const key of group.claims) {
      const found = this.claims.get(key);
      if (found) found.done = true;
    }
    for (const row of group.rows)
      this.trace.mark(
        row.message,
        row.transport,
        row.transport !== choice.transport
          ? 'handled-elsewhere'
          : result?.uncertain
            ? 'uncertain'
            : result?.cancelled
              ? 'cancelled'
              : result?.draft
                ? 'draft'
                : result?.messageId
                  ? 'delivered'
                  : result?.ok
                    ? 'skipped'
                    : 'failed',
        row.transport !== choice.transport
          ? '由 ' + choice.transport.kind + ' 接手，未重複呼叫模型'
          : result?.error || result?.reason ||
            (result?.uncertain ? '交付結果未確認，未自動重試' :
              result?.cancelled ? '回覆已取消' :
                result?.draft ? '回覆已保留待審' :
                  result?.messageId ? '回覆已交付' :
                    result?.ok ? '未符合回覆條件或模型選擇略過' : '回合處理失敗，請查看診斷'),
      );
    for (const resolve of group.waiters) resolve(result);
  }
  assign(id, message, transport) {
    const group = this.groups.get(id);
    if (group) {
      group.replyMessage = message;
      group.replyTransport = transport;
    }
  }
  phase(message, transport, phase, reason) {
    this.trace.mark(message, transport, phase, reason);
    if (phase === 'sending')
      for (const group of this.groups.values()) if (group.message?.id === message.id) group.committed = true;
  }
  cancelPending({ channelId, messageId, transport, actorId } = {}) {
    for (const [key, g] of this.groups) {
      if (
        (actorId && !g.rows.some((r) => r.message.author?.id === actorId)) ||
        (channelId && g.rows[0].message.channelId !== channelId) ||
        (transport && !g.rows.some((r) => r.transport === transport)) ||
        (messageId && !g.rows.some((r) => r.message.id === messageId))
      )
        continue;
      clearTimeout(g.timer);
      g.controller?.abort();
      this.cancel(
        g.replyMessage || g.message || g.rows[0].message,
        g.replyTransport || g.owner || g.rows[0].transport,
      );
      g.revision++;
      this.groups.delete(key);
      if (this.byScope.get(g.scope) === g) this.byScope.delete(g.scope);
      for (const claim of g.claims) {
        const row = this.claims.get(claim);
        if (row) row.done = true;
      }
      for (const row of g.rows)
        this.trace.mark(
          row.message,
          row.transport,
          g.committed ? 'uncertain' : 'cancelled',
          g.committed ? '已開始交付，請核對結果，系統不自動重送' : '來源變動或連線狀態已改變',
        );
      for (const resolve of g.waiters)
        resolve({ ok: !g.committed, cancelled: true, uncertain: !!g.committed });
    }
  }
  close() {
    this.closed = true;
    this.cancelPending();
    this.claims.clear();
  }
  snapshot() {
    return { pending: this.groups.size, claims: this.claims.size, trace: this.trace.snapshot() };
  }
}
