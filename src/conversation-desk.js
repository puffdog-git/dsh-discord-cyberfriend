import { diagnoseCapabilityFailure } from './capability-diagnostics.js';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  sourceFingerprint,
  resolveConversationTime,
  parseConversationAction,
  readConversationSource,
} from './conversation-time.js';
import { redactSensitive } from './security.js';
import { CoalescedWriter } from './util.js';
const active = new Set([
  'pending',
  'generating',
  'draft',
  'deferred',
  'planning',
  'failed',
  'blocked',
  'cancelled',
]);
const scoped = (m, t) => [t.kind, t.selfId, m.channelId, m.author?.id].join(':');
const snowflake = (id) => /^\d{15,22}$/.test(id || '');

export class ConversationDesk {
  constructor({
    file,
    getConfig,
    getManager,
    history,
    bridge,
    companion,
    validate = () => {},
    cancelReply = () => {},
    dispatch,
    sourcePolicy = () => null,
    now = Date.now,
  }) {
    Object.assign(this, {
      file,
      getConfig,
      getManager,
      history,
      bridge,
      companion,
      validate,
      cancelReply,
      dispatch,
      sourcePolicy,
      now,
    });
    this.topics = new Map();
    this.plans = new Map();
    this.timeRequests = new Map();
    this.saves = Promise.resolve();
    this.closed = false;
  }
  async init() {
    try {
      const data = JSON.parse(await readFile(this.file, 'utf8'));
      for (const row of data.topics || [])
        if (typeof row.id === 'string' && Array.isArray(row.sourceIds)) {
          if (['generating', 'planning', 'sending'].includes(row.state)) {
            row.state = 'uncertain';
            row.reason = '重啟前的執行結果未確認，不自動重跑';
          }
          this.topics.set(row.id, row);
        }
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    this.prune();
  }
  prune() {
    const cutoff =
      this.now() -
      Math.max(1, Math.min(30, Number(this.getConfig().pendingTopicsRetentionDays) || 14)) * 86400000;
    const scheduled = new Set(
      this.companion.data.jobs
        .filter((j) => ['creating', 'waiting', 'queued', 'running', 'resuming'].includes(j.state))
        .map((j) => j.topicId),
    );
    for (const [id, t] of this.topics) if (t.updatedAt < cutoff && !scheduled.has(id)) this.topics.delete(id);
    while (this.topics.size > 200) {
      const obsolete = [...this.topics.keys()].find((id) => !scheduled.has(id));
      if (!obsolete) break;
      this.topics.delete(obsolete);
    }
    for (const [id, p] of this.plans) if (p.expiresAt < this.now()) this.plans.delete(id);
    for (const [id, p] of this.timeRequests) if (p.expiresAt < this.now()) this.timeRequests.delete(id);
  }
  save() {
    this.prune();
    this.writer ||= new CoalescedWriter(async () => {
      await mkdir(dirname(this.file), { recursive: true });
      await writeFile(
        this.file + '.tmp',
        JSON.stringify({ version: 1, topics: [...this.topics.values()] }) + '\n',
      );
      await rename(this.file + '.tmp', this.file);
    });
    return (this.saves = this.writer.save());
  }
  begin(message, transport, { turnId, topicId } = {}) {
    if (this.closed || this.getConfig().pendingTopicsEnabled === false || message.simulated) return null;
    let row = topicId
      ? this.topics.get(topicId)
      : [...this.topics.values()].find((t) => t.turnId === turnId && t.key === scoped(message, transport));
    if (!row) {
      if (this.topics.size >= 200) {
        const ended = [...this.topics.values()].find((t) => ['answered', 'closed'].includes(t.state));
        if (ended) this.topics.delete(ended.id);
        else {
          this.lastError = '未答話題已達200筆，請先結束不需要的話題';
          return null;
        }
      }
      row = {
        id: randomUUID(),
        key: scoped(message, transport),
        kind: transport.kind,
        selfId: transport.selfId,
        channelId: message.channelId,
        guildId: message.guildId || null,
        userId: message.author?.id,
        sourceIds: [],
        interactionSource: message.interactionInput
          ? { accountId: transport.selfId, digest: sourceFingerprint(message) }
          : null,
        createdAt: this.now(),
        revision: 0,
      };
      this.topics.set(row.id, row);
    }
    if (row.key !== scoped(message, transport) || row.state === 'closed') return null;
    row.sourceIds = [...new Set([...row.sourceIds, ...(message.turnMessageIds || [message.id])])].slice(-8);
    Object.assign(row, {
      state: 'pending',
      reason: '等待回覆',
      turnId,
      revision: row.revision + 1,
      updatedAt: this.now(),
    });
    void this.save().catch(() => {
      this.lastError = '話題狀態未能保存，請檢查本機儲存';
    });
    return { id: row.id, revision: row.revision };
  }
  update(ticket, state, reason = '', extra = {}) {
    const row = this.topics.get(ticket?.id);
    if (!row || row.revision !== ticket.revision || row.state === 'closed') return false;
    Object.assign(row, { state, reason, updatedAt: this.now(), ...extra });
    void this.save().catch(() => {
      this.lastError = '話題狀態未能保存，請檢查本機儲存';
    });
    return true;
  }
  target(ticket, message, transport) {
    this.update(ticket, 'generating', '正在產生回覆', {
      targetChannelId: message.channelId,
      replyKind: transport.kind,
      replySelfId: transport.selfId,
    });
  }
  settle(ticket, result) {
    if (!ticket) return;
    this.update(
      ticket,
      result?.uncertain
        ? 'uncertain'
        : result?.messageId
          ? 'answered'
          : result?.draft
            ? 'draft'
            : result?.cancelled
              ? 'cancelled'
              : result?.ok
                ? 'blocked'
                : 'failed',
      (result?.error ? diagnoseCapabilityFailure(result.error).summary : result?.reason) ||
        (result?.messageId ? '回覆已交付' : result?.draft ? '草稿待審閱' : '未交付回覆'),
      { replyMessageId: result?.messageId || null },
    );
  }
  phase(ticket, phase) {
    if (phase === 'sending') this.update(ticket, 'sending', '已開始交付，取消不保證未送達');
  }
  preview(row) {
    const original = this.history?.find?.(row.channelId, row.sourceIds.at(-1));
    const forgotten = row.sourceIds.some((id) => !!this.sourcePolicy(row.channelId, id));
    return {
      ...row,
      code: row.id.slice(0, 8),
      preview: forgotten
        ? '來源已要求忘記'
        : redactSensitive(
            String(original?.content || '')
              .replace(/\s+/g, ' ')
              .slice(0, 100),
            this.getConfig(),
            { privateData: true },
          ).text,
      authorName: forgotten ? '' : String(original?.author?.name || '').slice(0, 100),
      sourceAvailable: !forgotten && snowflake(row.sourceIds.at(-1)),
    };
  }
  list({ scope, includeAnswered = false } = {}) {
    this.prune();
    return [...this.topics.values()]
      .filter(
        (t) => (!scope || t.key === scope) && (includeAnswered || !['answered', 'closed'].includes(t.state)),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((t) => this.preview(t));
  }
  scopeRows(message, transport) {
    return this.list({ scope: scoped(message, transport) });
  }
  parse(message, transport, { directed = false } = {}) {
    if (
      this.getConfig().conversationControlEnabled === false ||
      message.edited ||
      message.author?.bot ||
      message.voiceInput
    )
      return null;
    this.prune();
    const hasPlan =
      this.timeRequests.has(scoped(message, transport)) ||
      [...this.plans.values()].some((p) => p.key === scoped(message, transport) && p.expiresAt > this.now());
    const parsed = parseConversationAction(message.content, { selfId: transport.selfId, hasPlan });
    if (parsed?.action === 'confirm' && !hasPlan && !directed) return { action: 'ignore' };
    return parsed && (directed || (parsed.action === 'confirm' && hasPlan)) ? parsed : null;
  }
  row(id, expectedRevision) {
    const row = this.topics.get(id);
    if (!row) throw Error('找不到話題或紀錄已到期');
    if (expectedRevision !== undefined && row.revision !== expectedRevision)
      throw Object.assign(Error('話題狀態已變更，請更新後再操作'), { status: 409 });
    return row;
  }
  transport(row) {
    const t = this.getManager().byKind[row.kind];
    if (!t?.ready || t.selfId !== row.selfId) throw Error('原帳號未連線或已更換，不能改用另一個帳號執行');
    return t;
  }
  async source(row) {
    const t = this.transport(row),
      id = row.sourceIds.at(-1);
    if (!snowflake(id)) throw Error('這個來源無法由 Discord 重新讀取；請提供文字訊息再安排');
    if (row.sourceIds.some((id) => !!this.sourcePolicy(row.channelId, id)))
      throw Error('來源已要求忘記，不重新讀取或回覆');
    let m;
    if (row.interactionSource) {
      const cached = this.history.find(row.channelId, id);
      if (
        row.sourceIds.length !== 1 ||
        !cached?.interactionInput ||
        cached.interactionAccountId !== row.selfId ||
        row.interactionSource.accountId !== row.selfId ||
        cached.author?.id !== row.userId ||
        (cached.guildId || null) !== (row.guildId || null) ||
        sourceFingerprint(cached) !== row.interactionSource.digest
      )
        throw Error('原生提問來源快取已失效，請重新提問');
      m = { ...structuredClone(cached), isMention: true, turnMessageIds: [id] };
    } else
      m = await readConversationSource(t, {
        channelId: row.channelId,
        sourceIds: row.sourceIds,
        userId: row.userId,
        guildId: row.guildId,
      });
    this.transport(row);
    await this.validate(m, t);
    return { message: m, transport: t };
  }
  binding(message, t) {
    const binding = this.bridge.bindings[this.bridge.identity(message, t)];
    if (!binding) throw Error('請先建立此對話的正式 DSH 會話，再安排延後回覆');
    return { sessionId: binding.sessionId, cwd: binding.cwd };
  }
  select(message, transport, intent) {
    const rows = this.scopeRows(message, transport);
    let matches =
      intent.action === 'defer' && this.timeRequests.has(scoped(message, transport))
        ? rows.filter((r) => r.id === this.timeRequests.get(scoped(message, transport)).topicId)
        : intent.topicCode
          ? rows.filter((r) => r.code === intent.topicCode)
          : message.replyTo
            ? rows.filter(
                (r) => r.sourceIds.includes(message.replyTo) || r.replyMessageId === message.replyTo,
              )
            : rows;
    if (matches.length !== 1)
      throw Error(
        matches.length
          ? '有多個未答話題，請引用原問題或指定話題代碼。'
          : '沒有可操作的未答話題；請先提出問題，或到話題頁查看。',
      );
    return this.row(matches[0].id);
  }
  async plan(id, { action = 'defer', when = '', expectedRevision } = {}) {
    const row = this.row(id, expectedRevision);
    if (!active.has(row.state) && row.state !== 'uncertain') throw Error('此話題已結束；不自動重新回答');
    if (row.state === 'uncertain') throw Error('原交付結果未確認，請先核對 Discord，再由介面明確結束此話題');
    const timing = action === 'defer' ? resolveConversationTime(when, this.now()) : { ok: true };
    if (!timing.ok) {
      if (this.timeRequests.size < 100)
        this.timeRequests.set(row.key, { topicId: row.id, expiresAt: this.now() + 300000 });
      return { ok: true, needsTime: true, message: timing.error, topicId: row.id };
    }
    const { message, transport } = await this.source(row),
      binding = this.binding(message, transport);
    if (this.companion.policy(message, transport).mode === 'listen')
      throw Error('目前是只聽模式，請先恢復正常回覆');
    this.timeRequests.delete(row.key);
    for (const [key, p] of this.plans) if (p.key === row.key) this.plans.delete(key);
    if (this.plans.size >= 100) throw Error('確認工作已達上限，請稍後重試');
    const code = randomUUID().slice(0, 8),
      plan = {
        id: randomUUID(),
        code,
        key: row.key,
        topicId: row.id,
        revision: row.revision,
        action,
        dueAt: timing.dueAt,
        sourceId: message.id,
        digest: sourceFingerprint(message),
        binding,
        expiresAt: this.now() + 300000,
      };
    this.plans.set(plan.id, plan);
    return {
      ok: true,
      plan: {
        id: plan.id,
        code,
        topicId: row.id,
        revision: row.revision,
        action,
        dueAt: plan.dueAt,
        expiresAt: plan.expiresAt,
      },
      message:
        action === 'defer'
          ? '請確認原問題與執行時間，再輸入「確認安排 ' + code + '」。'
          : '將重新讀取原問題、核對權限並重新回答；請輸入「確認安排 ' + code + '」。',
    };
  }
  async confirm(id, code, { scope } = {}) {
    const plan = this.plans.get(id);
    if (
      !plan ||
      plan.expiresAt < this.now() ||
      plan.code !== String(code).toLowerCase() ||
      (scope && plan.key !== scope)
    )
      throw Error('確認碼無效、已使用、已到期或不屬於此對話');
    this.plans.delete(id);
    const row = this.row(plan.topicId, plan.revision);
    if (!active.has(row.state)) throw Error('話題已結束或結果尚未確認');
    const { message, transport } = await this.source(row);
    if (
      message.id !== plan.sourceId ||
      sourceFingerprint(message) !== plan.digest ||
      JSON.stringify(this.binding(message, transport)) !== JSON.stringify(plan.binding)
    )
      throw Error('原問題或 DSH 會話已變更，請重新安排');
    if (plan.action === 'defer' && plan.dueAt - this.now() < 60000)
      throw Error('確認時已不足一分鐘，請重新指定時間');
    const before = { ...row, sourceIds: [...row.sourceIds] };
    row.revision++;
    row.state = 'planning';
    row.updatedAt = this.now();
    await this.save();
    let stopped;
    try {
      stopped = await this.cancelReply(before);
    } catch {
      row.state = 'uncertain';
      row.reason = '舊回覆停止結果未確認，請先核對';
      await this.save();
      throw Error(row.reason);
    }
    if (stopped?.uncertain) {
      row.state = 'uncertain';
      row.reason = '舊草稿可能已開始送出，請先核對';
      await this.save();
      throw Error(row.reason);
    }
    try {
      if (plan.action === 'defer') {
        for (const job of this.companion.data.jobs.filter(
          (j) =>
            j.type === 'defer' &&
            j.kind === row.kind &&
            j.selfId === row.selfId &&
            j.channelId === row.channelId &&
            j.userId === row.userId &&
            row.sourceIds.includes(j.messageId) &&
            ['waiting', 'queued'].includes(j.state),
        )) {
          await this.companion.cancel(job.id);
          if (job.cancelUnconfirmed) throw Error('舊工作移除未確認，暫不建立新安排');
        }
        const result = await this.companion.create(
          {
            kind: row.kind,
            channelId: row.channelId,
            messageId: plan.sourceId,
            type: 'defer',
            afterMinutes: Math.ceil((plan.dueAt - this.now()) / 60000),
          },
          {
            dueAt: plan.dueAt,
            onDeferred: () => {},
            prepareSource: () => this.source(row).then((r) => r.message),
            sourceIds: [...row.sourceIds],
            validateSource: (source, binding) => {
              if (
                row.state === 'closed' ||
                sourceFingerprint(source) !== plan.digest ||
                binding.sessionId !== plan.binding.sessionId ||
                binding.cwd !== plan.binding.cwd
              )
                throw Error('原問題或話題狀態已變更');
            },
            sourceFingerprint: plan.digest,
            topicId: row.id,
            topicRevision: row.revision,
          },
        );
        if (row.state === 'closed') {
          if (result.state !== 'cancelled') await this.companion.cancel(result.id);
          return { ok: true, cancelled: true, message: '話題已結束，不會繼續交付' };
        }
        row.state =
          result.state === 'waiting' ? 'deferred' : result.state === 'cancelled' ? 'closed' : 'uncertain';
        row.jobId = result.id;
        row.reason = '已交給 DSH 排程；到期仍會核對來源與權限';
        row.updatedAt = this.now();
        await this.save();
        return { ok: true, scheduled: row.state === 'deferred', message: row.reason, id: result.id };
      }
      return await this.resume(row.id, row.revision);
    } catch (error) {
      if (row.state !== 'closed') {
        row.state = 'uncertain';
        row.reason = '安排結果未確認，請核對宿主排程與診斷，不自動重送';
        row.updatedAt = this.now();
        await this.save();
      }
      throw error;
    }
  }
  async closeTopic(id, expectedRevision) {
    const row = this.row(id, expectedRevision),
      wasSending = ['sending', 'uncertain'].includes(row.state),
      before = { ...row, sourceIds: [...row.sourceIds] };
    row.state = 'closed';
    row.reason = wasSending
      ? '話題已結束，但先前交付可能已送達，請核對 Discord'
      : '已結束，不再自動回答此來源';
    row.revision++;
    row.updatedAt = this.now();
    this.timeRequests.delete(row.key);
    for (const [id, p] of this.plans) if (p.topicId === row.id) this.plans.delete(id);
    await this.save();
    const stopped = await this.cancelReply(before);
    if (stopped?.uncertain) row.reason = '話題已結束，但舊草稿可能已開始送出，請核對 Discord';
    for (const job of this.companion.data.jobs.filter(
      (j) =>
        j.type === 'defer' &&
        j.kind === row.kind &&
        j.selfId === row.selfId &&
        j.channelId === row.channelId &&
        j.userId === row.userId &&
        row.sourceIds.includes(j.messageId) &&
        ['creating', 'waiting', 'queued', 'running', 'resuming'].includes(j.state),
    ))
      await this.companion.cancel(job.id);
    if (this.companion.data.jobs.some((j) => j.topicId === row.id && j.cancelUnconfirmed))
      row.reason = '本地已停止交付；宿主排程移除未確認，請核對 DSH 排程';
    await this.save();
    return {
      ok: true,
      message: row.reason,
      uncertain:
        wasSending ||
        !!stopped?.uncertain ||
        this.companion.data.jobs.some((j) => j.topicId === row.id && j.cancelUnconfirmed),
    };
  }
  async resume(id, expectedRevision) {
    const row = this.row(id, expectedRevision);
    if (row.state === 'closed' || row.state === 'uncertain')
      throw Error('已結束或結果不明的話題不能直接重跑');
    const { message, transport } = await this.source(row);
    for (const job of this.companion.data.jobs.filter(
      (j) =>
        j.type === 'defer' &&
        j.kind === row.kind &&
        j.selfId === row.selfId &&
        j.channelId === row.channelId &&
        j.userId === row.userId &&
        row.sourceIds.includes(j.messageId) &&
        ['waiting', 'queued'].includes(j.state),
    )) {
      await this.companion.cancel(job.id);
      if (job.cancelUnconfirmed) throw Error('舊排程移除未確認，暫不重新回答');
    }
    if (row.state === 'closed') return { ok: true, cancelled: true };
    const result = await this.dispatch(message, transport, {
      turn: { turnId: randomUUID(), revision: 1 },
      conversationTopicId: row.id,
    });
    return {
      ...result,
      message: result?.messageId
        ? '已重新回答原問題'
        : result?.draft
          ? '已產生待審草稿，尚未送出'
          : result?.uncertain
            ? '交付結果未確認，請先核對 Discord'
            : result?.error || result?.reason || '目前條件未允許交付，請查看話題狀態',
    };
  }
  async handle(message, transport, intent) {
    if (message.simulated)
      return { ok: true, control: true, message: '模擬訊息只解析，不建立排程或更改話題。' };
    const scope = scoped(message, transport);
    if (intent.action === 'list')
      return {
        ok: true,
        message:
          this.scopeRows(message, transport)
            .slice(0, 8)
            .map(
              (r) =>
                '#' +
                r.code +
                ' · ' +
                r.state +
                ' · ' +
                (r.preview || r.sourceIds.at(-1)).replace(/<@!?\d+>|@everyone|@here/g, '〔提及〕'),
            )
            .join('\n') || '目前沒有未答話題。',
      };
    if (intent.action === 'confirm') {
      const p = [...this.plans.values()].find((p) => p.key === scope && p.code === intent.code);
      return this.confirm(p?.id, intent.code, { scope });
    }
    const row = this.select(message, transport, intent);
    if (intent.action === 'close') return this.closeTopic(row.id, row.revision);
    return this.plan(row.id, { action: intent.action, when: intent.when, expectedRevision: row.revision });
  }
  allowsDraft(ticket) {
    const row = this.topics.get(ticket?.id);
    return (
      !!row &&
      row.revision === ticket.revision &&
      !['closed', 'deferred', 'planning', 'uncertain'].includes(row.state)
    );
  }
  canRunScheduled(job) {
    const row = this.topics.get(job.topicId);
    return (
      !!row &&
      row.state !== 'closed' &&
      row.revision === job.topicRevision &&
      !row.sourceIds.some((id) => !!this.sourcePolicy(row.channelId, id))
    );
  }
  scheduled(job, result) {
    if (job.topicId) this.settle({ id: job.topicId, revision: job.topicRevision }, result);
  }
  status(options = {}) {
    return {
      ok: true,
      topics: this.list(options),
      lastError: this.lastError || null,
      retentionDays: this.getConfig().pendingTopicsRetentionDays || 14,
    };
  }
  async close() {
    this.closed = true;
    this.plans.clear();
    this.timeRequests.clear();
    await this.saves;
  }
}
