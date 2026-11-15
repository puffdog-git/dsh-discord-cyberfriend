import { sourceFingerprint, readConversationSource } from './conversation-time.js';
import { observeCapability } from './capability-diagnostics.js';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
const key = (m, t) => [t.kind, t.selfId, m.channelId, m.author?.id].join(':');
const validId = (id) => /^\d{15,22}$/.test(id || '');
export class CompanionControls {
  constructor({ file, getConfig, getManager, bridge, ctx, dispatch, onMode = () => {}, now = Date.now }) {
    Object.assign(this, { file, getConfig, getManager, bridge, ctx, dispatch, onMode, now });
    this.data = { version: 1, modes: {}, consents: {}, jobs: [], contacts: {}, days: {} };
    this.saves = Promise.resolve();
    this.work = new Set();
    this.closed = false;
  }
  async init() {
    try {
      this.data = JSON.parse(await readFile(this.file, 'utf8'));
      for (const job of this.data.jobs)
        if (['queued', 'running', 'creating', 'resuming'].includes(job.state)) job.state = 'uncertain';
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  async save() {
    this.saves = this.saves
      .catch(() => {})
      .then(async () => {
        await mkdir(dirname(this.file), { recursive: true });
        await writeFile(this.file + '.tmp', JSON.stringify(this.data, null, 2) + '\n');
        await rename(this.file + '.tmp', this.file);
      });
    await this.saves;
  }
  observe(message, transport, { simulation = false } = {}) {
    if (simulation || message.simulated || message.author?.bot) return false;
    const id = key(message, transport),
      text = String(message.content || '').trim();
    if (text === '!陪伴 同意') {
      if (!this.data.consents[id] && Object.keys(this.data.consents).length >= 400) {
        this.lastError = '同意紀錄已達上限';
        return true;
      }
      this.data.consents[id] = {
        at: this.now(),
        lastInboundAt: this.now(),
        userId: message.author.id,
        channelId: message.channelId,
      };
      void this.save().catch(() => {
        this.lastError = '同意設定保存失敗，請核對本機儲存';
      });
      return true;
    }
    if (text === '!陪伴 停止') {
      delete this.data.consents[id];
      void this.cancelScope(id).catch(() => {
        this.lastError = '停止工作未完全確認，請在介面核對';
      });
      return true;
    }
    if (this.data.consents[id]) this.data.consents[id].lastInboundAt = this.now();
    return false;
  }
  policy(message, transport) {
    const c = this.getConfig(),
      row = this.data.modes[key(message, transport)],
      mode = row && (!row.until || row.until > this.now()) ? row.mode : 'normal';
    let quiet = mode === 'text' || mode === 'quiet',
      quietHours = false;
    if (c.quietHoursEnabled) {
      const hour = Number(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Taipei',
          hour: '2-digit',
          hourCycle: 'h23',
        }).format(this.now()),
      );
      const start = Number(c.quietHoursStart ?? 23),
        end = Number(c.quietHoursEnd ?? 8);
      quietHours =
        start === end ||
        (start < end && hour >= start && hour < end) ||
        (start > end && (hour >= start || hour < end));
      quiet ||= quietHours;
    }
    const deferred = this.data.jobs.some(
      (job) =>
        job.key === key(message, transport) &&
        job.type === 'defer' &&
        ['creating', 'waiting', 'queued'].includes(job.state),
    );
    return {
      mode,
      reply: mode !== 'listen' && !deferred,
      speech: !quiet && mode !== 'listen',
      quietHours,
      deferred,
    };
  }
  apply(config, message, transport) {
    const p = this.policy(message, transport);
    return { ...config, voiceOutputSuppressed: !p.speech };
  }
  async setMode({ kind, channelId, userId, mode, minutes = 0 }) {
    const t = this.getManager().byKind[kind];
    if (
      !t?.selfId ||
      !validId(channelId) ||
      !validId(userId) ||
      !['normal', 'listen', 'text', 'quiet'].includes(mode)
    )
      throw Error('請指定帳號、頻道、使用者及有效模式');
    if (!Number.isFinite(Number(minutes)) || minutes < 0 || minutes > 10080)
      throw Error('模式期限需為 0–10080 分鐘');
    const message = { channelId, author: { id: userId } },
      id = key(message, t);
    this.data.modes[id] = {
      kind,
      channelId,
      userId,
      mode,
      until: minutes ? this.now() + minutes * 60000 : 0,
    };
    if (mode !== 'normal') await this.onMode(channelId, t, userId);
    await this.save();
    return { ok: true, policy: this.policy(message, t) };
  }
  service() {
    try {
      return this.ctx.get?.('schedule');
    } catch {
      return null;
    }
  }
  status() {
    return {
      schedulerAvailable: !!this.service()?.create,
      lastError: this.lastError || null,
      modes: Object.values(this.data.modes),
      consents: Object.entries(this.data.consents).map(([id, c]) => ({
        id,
        userId: c.userId,
        channelId: c.channelId,
        at: c.at,
      })),
      jobs: this.data.jobs.map(({ id, type, state, kind, channelId, userId, dueAt, error }) => ({
        id,
        type,
        state,
        kind,
        channelId,
        userId,
        dueAt,
        error,
      })),
    };
  }
  async grantAdmin({ kind, channelId, userId }) {
    if (userId !== this.getConfig().adminUserId) throw Error('其他使用者須自行在該頻道輸入 !陪伴 同意');
    const t = this.getManager().byKind[kind];
    if (!t?.selfId || !validId(channelId)) throw Error('請選取有效帳號與頻道');
    this.data.consents[key({ channelId, author: { id: userId } }, t)] = {
      at: this.now(),
      userId,
      channelId,
      lastInboundAt: this.now(),
    };
    await this.save();
    return { ok: true };
  }
  async create({ kind, channelId, messageId, type, afterMinutes = 30 }, internal = {}) {
    if (this.closed) throw Error('陪伴控制已停用');
    if (!['defer', 'checkin'].includes(type) || !validId(channelId) || !validId(messageId))
      throw Error('需要有效來源訊息及工作類型');
    const t = this.getManager().byKind[kind],
      c = this.getConfig(),
      service = this.service();
    if (!t?.ready || !service?.create) throw Error('帳號或 DSH 排程服務未就緒');
    if (
      !c.enabled ||
      c.dryRun ||
      c[kind + 'Enabled'] === false ||
      (kind === 'user' && (c.userReceiveOnly || c.userAutoReply === false))
    )
      throw Error('目前為停用、僅觀察或演練模式，不能建立真實排程');
    if (!Number.isInteger(Number(afterMinutes)) || afterMinutes < 1 || afterMinutes > 10080)
      throw Error('延後時間需為 1–10080 分鐘');
    const expectedSelfId = t.selfId;
    const fetched = await t.getMessage(channelId, messageId);
    if (!fetched?.ok) throw Error('無法讀取原訊息');
    const message = internal.prepareSource ? await internal.prepareSource(fetched.message) : fetched.message,
      idKey = key(message, t),
      binding = this.bridge.bindings[this.bridge.identity(message, t)];
    if (!binding) throw Error('請先建立此 Discord 對話的正式 DSH 會話');
    if (!t.ready || t.selfId !== expectedSelfId) throw Error('來源帳號已變更');
    await internal.validateSource?.(message, binding);
    if (type === 'checkin' && (!c.proactiveEnabled || !this.data.consents[idKey]))
      throw Error('主動關心尚未啟用或對方尚未同意');
    if (
      this.data.jobs.some(
        (j) => j.key === idKey && ['creating', 'waiting', 'queued', 'running'].includes(j.state),
      )
    )
      throw Error('此對話已有待處理工作');
    if (this.data.jobs.length >= 100) throw Error('本機工作紀錄已達上限，請先清理已結束工作');
    const delaySeconds =
      internal.dueAt === undefined ? afterMinutes * 60 : Math.ceil((internal.dueAt - this.now()) / 1000);
    if (!Number.isInteger(delaySeconds) || delaySeconds < 60 || delaySeconds > 604800)
      throw Error('確認後的執行時間需介於一分鐘與七天');
    const job = {
      id: randomUUID(),
      sourceFingerprint: internal.sourceFingerprint,
      sourceIds: internal.sourceIds,
      topicId: internal.topicId,
      topicRevision: internal.topicRevision,
      guildId: message.guildId || null,
      type,
      kind,
      channelId,
      messageId,
      userId: String(message.author?.id),
      selfId: t.selfId,
      key: idKey,
      sessionId: binding.sessionId,
      cwd: binding.cwd,
      state: 'creating',
      dueAt: internal.dueAt ?? this.now() + afterMinutes * 60000,
    };
    this.data.jobs.push(job);
    await this.save();
    try {
      const task = await observeCapability(
        this.ctx,
        'schedule.host',
        'create-schedule',
        () =>
          service.create({
            title: type === 'checkin' ? 'Discord：一次主動關心' : 'Discord：延後回覆',
            prompt:
              '僅呼叫工具 discord_cyberfriend_companion_resume，參數 ' +
              JSON.stringify({ id: job.id }) +
              '。不要直接發送訊息或使用其他工具；此工具會重新核對同意、來源與頻道。',
            timing: { kind: 'after', after_seconds: delaySeconds },
            target: { kind: 'session', sessionId: binding.sessionId },
          }),
        { outcome: (r) => (r?.id || r?.record?.id ? 'passed' : 'unconfirmed') },
      );
      job.scheduleId = task.id || task.record?.id;
      if (!job.scheduleId) throw Error('宿主未回傳排程 ID');
      if (job.state === 'cancelled' || (job.type === 'checkin' && !this.getConfig().proactiveEnabled)) {
        job.state = 'cancelled';
        await service.edit({ id: job.scheduleId, action: 'delete' });
        await this.save();
        return { ok: true, id: job.id, state: 'cancelled' };
      }
      job.state = 'waiting';
      if (type === 'defer') await (internal.onDeferred || this.onMode)(channelId, t, job.userId);
      await this.save();
      return { ok: true, id: job.id, state: job.state };
    } catch (error) {
      job.state = 'uncertain';
      job.error = '排程結果未確認，請先核對 DSH 排程，勿重複建立';
      await this.save();
      throw error;
    }
  }
  async cancel(id) {
    const job = this.data.jobs.find((j) => j.id === id);
    if (!job) throw Error('找不到工作');
    const active = ['running', 'resuming'].includes(job.state);
    job.state = 'cancelled';
    if (active) await this.onMode(job.channelId, this.getManager().byKind[job.kind], job.userId);
    await this.save();
    if (job.scheduleId)
      try {
        const scheduler = this.service();
        if (!scheduler?.edit) throw Error('排程服務未就緒');
        const receipt = await scheduler.edit({ id: job.scheduleId, action: 'delete' });
        if (receipt?.ok === false) throw Error('排程移除未確認');
      } catch {
        job.cancelUnconfirmed = true;
        job.error = '本地已停止交付；宿主排程移除未確認';
        await this.save();
      }
    return { ok: true };
  }
  async forget(id) {
    const job = this.data.jobs.find((j) => j.id === id);
    if (!job) throw Error('找不到工作');
    if (
      !['delivered', 'skipped', 'failed', 'cancelled', 'draft'].includes(job.state) ||
      job.cancelUnconfirmed
    )
      throw Error('工作仍在執行或宿主停止結果未確認，不能清理');
    this.data.jobs = this.data.jobs.filter((j) => j !== job);
    await this.save();
    return { ok: true };
  }
  async cancelScope(id) {
    for (const j of this.data.jobs.filter(
      (j) => j.key === id && ['creating', 'waiting', 'queued', 'running', 'resuming'].includes(j.state),
    ))
      await this.cancel(j.id);
    await this.save();
  }
  guard(exec) {
    const sessionId = exec.agent?.id || exec.agent?.session?.id;
    if (!this.data.jobs.some((j) => j.sessionId === sessionId)) return;
    const state = this.bridge.live?.get(sessionId);
    if (state?.inFlight) return;
    if ((exec.definition?.name || exec.name) !== 'discord_cyberfriend_companion_resume')
      return '此排程只允許回復已核准的 Discord 工作';
  }
  canResume(sessionId) {
    return this.data.jobs.some(
      (job) => job.sessionId === sessionId && job.state === 'waiting' && job.dueAt <= this.now(),
    );
  }
  async stopCheckins() {
    for (const job of this.data.jobs.filter(
      (j) =>
        j.type === 'checkin' && ['waiting', 'queued', 'running', 'resuming', 'creating'].includes(j.state),
    ))
      await this.cancel(job.id);
    return { ok: true };
  }
  async resume(id, exec) {
    const job = this.data.jobs.find((j) => j.id === id);
    if (!job || job.sessionId !== (exec.agent?.id || exec.agent?.session?.id))
      throw Error('工作不屬於目前會話');
    if (job.state !== 'waiting') return { ok: true, skipped: true, state: job.state };
    if (this.now() < job.dueAt) return { ok: false, skipped: true, reason: '尚未到排定時間' };
    job.state = 'queued';
    await this.save();
    const work = Promise.resolve(exec.agent.whenIdle())
      .then(() => this.run(job))
      .catch(async () => {
        if (job.state === 'cancelled') return;
        job.state = 'failed';
        job.error = '排程回復失敗，請核對診斷';
        await this.save();
      })
      .finally(() => this.work.delete(work));
    this.work.add(work);
    return { ok: true, queued: true };
  }
  async run(job) {
    if (this.closed || job.state !== 'queued') return;
    job.state = 'resuming';
    let c = this.getConfig();
    const t = this.getManager().byKind[job.kind];
    const stop = async (reason) => {
      if (job.state === 'cancelled') return;
      this.ctx.get?.('discordConversation')?.scheduled?.(job, { ok: false, reason });
      job.state = 'skipped';
      job.error = reason;
      await this.save();
    };
    if (!c.enabled || !t?.ready || t.selfId !== job.selfId) return stop('帳號或插件狀態已變更');
    const desk = this.ctx.get?.('discordConversation');
    if (desk?.sourcePolicy?.(job.channelId, job.messageId) || (job.topicId && !desk?.canRunScheduled(job)))
      return stop('來源或話題狀態已變更，不重新讀取舊內容');
    let source;
    try {
      if (job.topicId && typeof desk?.source === 'function' && typeof desk?.row === 'function') {
        const topic = desk.row(job.topicId);
        if (
          topic.kind !== job.kind ||
          topic.selfId !== job.selfId ||
          topic.channelId !== job.channelId ||
          topic.userId !== job.userId
        )
          throw Error('topic scope changed');
        source = { ok: true, message: (await desk.source(topic)).message };
      } else
        source = job.sourceIds
          ? {
              ok: true,
              message: await readConversationSource(t, {
                channelId: job.channelId,
                sourceIds: job.sourceIds,
                userId: job.userId,
                guildId: job.guildId,
              }),
            }
          : await t.getMessage(job.channelId, job.messageId);
    } catch {
      return stop('來源已刪除或作者／頻道改變');
    }
    if (!source?.ok || String(source.message?.author?.id) !== job.userId) return stop('來源已刪除或作者改變');
    c = this.getConfig();
    if (job.state === 'cancelled') return;
    if (!t.ready || t.selfId !== job.selfId) return stop('來源帳號已變更');
    const consent = this.data.consents[job.key];
    const message = source.message,
      binding = this.bridge.bindings[this.bridge.identity(message, t)];
    if (
      binding?.sessionId !== job.sessionId ||
      binding?.cwd !== job.cwd ||
      (!binding?.manualCwd && this.bridge.workspaceFor && this.bridge.workspaceFor(message, c, t) !== job.cwd)
    )
      return stop('正式會話綁定已變更');
    if (job.sourceFingerprint && sourceFingerprint(message) !== job.sourceFingerprint)
      return stop('原問題已變更，不按舊確認繼續');
    if (job.topicId && !this.ctx.get?.('discordConversation')?.canRunScheduled?.(job))
      return stop('話題狀態已變更');
    const policy = this.policy(message, t);
    if (!policy.reply) return stop('目前只聽模式');
    if (job.type === 'checkin') {
      if (policy.quietHours || policy.mode === 'quiet') return stop('安靜時段或安靜陪伴模式，不主動打擾');
      if (!c.proactiveEnabled || !consent) return stop('主動關心已停用或同意已撤回');
      if (this.data.contacts[job.key] && (consent.lastInboundAt || 0) <= this.data.contacts[job.key])
        return stop('上次關心後未收到回覆，不再追問');
      const day = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(this.now());
      if ((this.data.days[day] || 0) >= Math.max(0, Number(c.proactiveDailyLimit) || 0))
        return stop('已達今日主動關心上限');
      this.data.days[day] = (this.data.days[day] || 0) + 1;
      this.data.contacts[job.key] = this.now();
    }
    if (job.state !== 'resuming') return;
    job.state = 'running';
    await this.save();
    if (job.state === 'cancelled' || this.closed) return;
    if (job.type === 'checkin' && (!this.getConfig().proactiveEnabled || !this.data.consents[job.key]))
      return stop('同意或主動關心已撤回');
    const result = await this.dispatch({ ...message, isMention: true }, t, {
      turn: { turnId: job.id, revision: 1 },
      conversationTopicId: job.topicId,
      companionInstruction:
        job.type === 'checkin'
          ? '這是對方同意的一次定時主動關心。下方是先前對話，不是剛收到的新訊息。自然關心一至兩句，不催促或要求對方回應。'
          : '這是使用者已明確確認的延後回覆；重新理解原訊息及現在的對話再回覆。',
    });
    if (job.state === 'cancelled') return;
    this.ctx.get?.('discordConversation')?.scheduled?.(job, result);
    job.state = result?.uncertain
      ? 'uncertain'
      : result?.messageId
        ? 'delivered'
        : result?.draft
          ? 'draft'
          : 'skipped';
    job.error = result?.error || result?.reason || undefined;
    await this.save();
  }
  definitions() {
    return [
      {
        name: 'discord_cyberfriend_companion_resume',
        description: '回復 DSH 排程中已核准、同會話的 Discord 延後回覆／一次關心工作；不建立新同意。',
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        execute: (a, e) => this.resume(a.id, e),
      },
    ];
  }
  async close() {
    this.closed = true;
    await this.saves;
    await Promise.allSettled([...this.work]);
  }
}
