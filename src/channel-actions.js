import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { audienceConfig } from './config.js';
import { accessReason } from './features/message-policy.js';
import { trustedAdmin, redactSensitive, redactDiagnosticPayload } from './security.js';
import { snowflake } from './channel-bot.js';
const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const READ_ACTIONS = ['search', 'pins', 'info', 'archives', 'posts', 'post_read', 'members'];
export const WRITE_ACTIONS = [
  'pin',
  'unpin',
  'edit',
  'delete',
  'forward',
  'join',
  'leave',
  'thread_edit',
  'forum_create',
];
const limited = (value, max) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw Error('文字為空或超過長度限制');
  return value.trim();
};
const safeSource = (m) => ({
  id: m.id,
  channelId: m.channelId,
  authorId: m.author?.id,
  content: m.content,
  attachments: (m.attachments || []).map((a) => ({
    name: a.name,
    size: a.size,
    url: String(a.url || '').split('?')[0],
  })),
  stickers: m.stickers || [],
  embeds: m.embedDetails || [],
});
export class ChannelActions {
  constructor({
    file,
    getConfig,
    getManager,
    bridge,
    sourcePolicy = () => null,
    now = Date.now,
    timeoutMs = 30000,
  }) {
    Object.assign(this, { file, getConfig, getManager, bridge, sourcePolicy, now, timeoutMs });
    this.plans = new Map();
    this.receipts = [];
    this.inflight = new Set();
    this.saves = Promise.resolve();
    this.closed = false;
  }
  async init() {
    if (!this.file) return;
    try {
      const r = JSON.parse(await readFile(this.file, 'utf8'));
      this.receipts = (r.receipts || []).filter((x) => x && typeof x.id === 'string').slice(-500);
      for (const row of this.receipts) if (row.state === 'running') row.state = 'uncertain';
      await this.save();
    } catch (e) {
      if (e.code !== 'ENOENT')
        this.storageError = '操作回執無法讀取，寫入功能已停用；請人工核對本機資料後重載。';
    }
  }
  save() {
    if (this.closed) return Promise.resolve();
    if (this.storageError) return Promise.reject(Error(this.storageError));
    if (!this.file) return Promise.resolve();
    const data = JSON.stringify({ version: 1, receipts: this.receipts });
    const task = this.saves.then(async () => {
      await mkdir(dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      await writeFile(tmp, data, 'utf8');
      await rename(tmp, this.file);
    });
    this.saves = task.catch(() => {});
    return task;
  }
  config(scope, write = false) {
    const c = audienceConfig(this.getConfig(), scope.actorId, !scope.guildId && !scope.isGroupDm);
    const t = this.getManager().byKind[scope.kind];
    if (
      this.closed ||
      !c.enabled ||
      !(scope.kind === 'user' ? c.userEnabled : c.botEnabled) ||
      !t?.ready ||
      t.selfId !== scope.selfId ||
      !snowflake(scope.channelId) ||
      !snowflake(scope.actorId) ||
      accessReason({ channelId: scope.channelId, guildId: scope.guildId, author: { id: scope.actorId } }, c)
    )
      throw Object.assign(new Error('目前帳號或對話未授權'), { status: 403 });
    if (write && this.storageError) throw Error(this.storageError);
    if (write && (!c.channelActionsEnabled || !trustedAdmin(c, scope.actorId)))
      throw Object.assign(new Error('只有管理者可建立已啟用的訊息操作'), { status: 403 });
    return { c, t };
  }
  toolScope(exec) {
    const id = exec?.agent?.session?.id || exec?.agent?.id,
      b = Object.values(this.bridge.bindings).find((x) => x.sessionId === id),
      state = this.bridge.live.get(id),
      m = state?.message;
    if (
      !b ||
      !state?.inFlight ||
      !m ||
      state.options?.actorId !== m.author?.id ||
      b.channelId !== m.channelId ||
      exec.signal?.aborted
    )
      throw Error('需要目前 Discord 正式會話');
    const s = {
      kind: b.transport,
      selfId: b.accountId,
      channelId: b.channelId,
      guildId: m.guildId || null,
      isGroupDm: !!m.isGroupDm,
      actorId: m.author.id,
    };
    this.config(s);
    return { scope: s, state, message: m };
  }
  async uiScope(spec) {
    const t = this.getManager().byKind[spec.kind];
    const scope = {
      kind: spec.kind,
      selfId: t?.selfId,
      channelId: String(spec.channelId || ''),
      actorId: this.getConfig().adminUserId,
      guildId: null,
    };
    if (!trustedAdmin(this.getConfig(), scope.actorId)) throw Error('請先設定管理者 ID');
    this.config(scope);
    const info = await t.channelRead('info', { channelId: scope.channelId });
    if (!info?.ok || info.channel?.id !== scope.channelId) throw Error('無法核對頻道');
    scope.guildId = info.channel.guildId || null;
    scope.isGroupDm = info.channel.type === 3;
    this.config(scope);
    return scope;
  }
  sanitize(value, scope) {
    const c = this.getConfig();
    const walk = (x) =>
      typeof x === 'string'
        ? redactSensitive(x, c, { privateData: !!scope.guildId || !!scope.isGroupDm }).text.slice(0, 2400)
        : Array.isArray(x)
          ? x.slice(0, 50).map(walk)
          : x && typeof x === 'object'
            ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, walk(v)]))
            : x;
    return walk(redactDiagnosticPayload(value, [c.userToken, c.botToken, c.customLlmApiKey, c.gifApiKey]));
  }
  async readSource(scope, id) {
    const { t } = this.config(scope);
    if (this.sourcePolicy(scope.channelId, id)?.action === 'forget') throw Error('來源已要求忘記');
    const r = await t.getMessage(scope.channelId, id);
    this.config(scope);
    const policy = this.sourcePolicy(scope.channelId, id);
    if (
      !r?.ok ||
      r.message?.id !== id ||
      r.message.channelId !== scope.channelId ||
      policy?.action === 'forget'
    )
      throw Error('來源無法讀取');
    return {
      ok: true,
      message:
        policy?.action === 'correct' ? { ...r.message, content: policy.content, edited: true } : r.message,
    };
  }
  async read(scope, input) {
    const { c, t } = this.config(scope);
    if (!c.channelLookupEnabled) throw Error('請先開啟頻道查詢');
    const action = input.action;
    if (!READ_ACTIONS.includes(action)) throw Error('未知查詢');
    const p = {
      channelId: scope.channelId,
      limit: Math.max(1, Math.min(20, Math.floor(Number(input.limit) || 20))),
    };
    if (action === 'search') {
      p.query = limited(input.query, 200);
      const before = input.before ? Date.parse(input.before) : this.now(),
        after = input.after ? Date.parse(input.after) : before - 30 * 86400000;
      if (
        !Number.isFinite(before) ||
        !Number.isFinite(after) ||
        before <= after ||
        before - after > 366 * 86400000 ||
        after < 1420070400000
      )
        throw Error('請提供有效日期範圍，最多366天');
      p.before = new Date(before).toISOString();
      p.after = new Date(after).toISOString();
    }
    let post = null;
    if (action === 'post_read') {
      if (!snowflake(input.postId)) throw Error('請提供論壇貼文／討論串 ID');
      const parent = await t.channelRead('info', { channelId: scope.channelId }),
        r = await t.channelRead('info', { channelId: input.postId });
      if (
        !parent?.ok ||
        ![0, 5, 15, 16].includes(parent.channel?.type) ||
        !r?.ok ||
        ![10, 11, 12].includes(r.channel?.type) ||
        r.channel?.parentId !== scope.channelId ||
        r.channel.guildId !== scope.guildId ||
        accessReason(
          { channelId: input.postId, guildId: scope.guildId, author: { id: scope.actorId } },
          this.getConfig(),
        )
      )
        throw Error('貼文不屬於目前允許的父頻道');
      post = r.channel;
    }
    const epoch = t.epoch,
      generation = t.connectionGeneration;
    const r =
      action === 'post_read'
        ? await t.getMessages(post.id, p.limit)
        : action === 'pins'
          ? await t.getPins(p.channelId, p.limit)
          : await t.channelRead(action, p);
    this.config(scope);
    if (epoch !== t.epoch || generation !== t.connectionGeneration) throw Error('連線已變更，結果已捨棄');
    if (!r?.ok) throw Error('查詢失敗，請確認權限、索引或稍後重試');
    if (r.messages)
      r.messages = r.messages
        .filter(
          (m) =>
            m.channelId === (post?.id || scope.channelId) &&
            (!m.guildId || m.guildId === scope.guildId) &&
            this.sourcePolicy(post?.id || scope.channelId, m.id)?.action !== 'forget',
        )
        .slice(0, p.limit)
        .map((m) => {
          const policy = this.sourcePolicy(scope.channelId, m.id);
          return policy?.action === 'correct' ? { ...m, content: policy.content, edited: true } : m;
        });
    if (r.threads)
      r.threads = r.threads
        .filter((row) => row.parentId === scope.channelId && (!row.guildId || row.guildId === scope.guildId))
        .slice(0, p.limit);
    if (post) {
      r.post = post;
      if (
        accessReason(
          { channelId: post.id, guildId: scope.guildId, author: { id: scope.actorId } },
          this.getConfig(),
        )
      )
        throw Error('貼文權限設定已改變');
    }
    if (r.channel && r.channel.id !== scope.channelId) throw Error('頻道不一致');
    if (action === 'info' && r.channel.parentId) {
      const parent = await t.channelRead('info', { channelId: r.channel.parentId });
      if (parent?.ok && parent.channel?.guildId === scope.guildId) r.forumTags = parent.channel.tags;
      this.config(scope);
    }
    return { dataOnly: true, ...this.sanitize(r, scope) };
  }
  args(input) {
    const action = input.action;
    if (!WRITE_ACTIONS.includes(action)) throw Error('未知操作');
    const p = {};
    if (['pin', 'unpin', 'edit', 'delete', 'forward'].includes(action)) {
      if (!snowflake(input.messageId)) throw Error('請提供來源訊息 ID');
      p.messageId = input.messageId;
    }
    if (['edit', 'forum_create'].includes(action)) p.content = limited(input.content, 2000);
    if (action === 'forward') {
      if (!snowflake(input.destinationId)) throw Error('請提供目的頻道 ID');
      p.destinationId = input.destinationId;
    }
    if (action === 'forum_create' || (action === 'thread_edit' && input.name))
      p.name = limited(input.name, 100);
    if (action === 'thread_edit' && typeof input.archived === 'boolean') p.archived = input.archived;
    if (['thread_edit', 'forum_create'].includes(action) && input.tags !== undefined) {
      if (!Array.isArray(input.tags) || input.tags.length > 5 || input.tags.some((t) => !snowflake(t)))
        throw Error('最多5個有效標籤 ID');
      p.tags = [...new Set(input.tags)];
    }
    if (input.postId !== undefined) {
      if (!['join', 'leave', 'thread_edit'].includes(action) || !snowflake(input.postId))
        throw Error('貼文目標只適用討論串操作');
      p.postId = input.postId;
    }
    if (action === 'thread_edit' && !['name', 'archived', 'tags'].some((k) => Object.hasOwn(p, k)))
      throw Error('請填名稱、封存狀態或標籤');
    return p;
  }
  async inspect(scope, action, args) {
    const { t, c } = this.config(scope, true);
    const r = await t.channelRead('info', { channelId: scope.channelId });
    if (
      !r?.ok ||
      r.channel?.id !== scope.channelId ||
      (r.channel.guildId || null) !== (scope.guildId || null)
    )
      throw Error('來源頻道不一致');
    const parentInfo = r.channel;
    let info = parentInfo;
    if (['pin', 'unpin'].includes(action) && [2, 13].includes(info.type))
      throw Object.assign(Error('Discord 語音／舞台頻道的文字聊天不支援置頂，請改用文字頻道或討論串'), { status: 400 });
    if (args.postId) {
      const post = await t.channelRead('info', { channelId: args.postId });
      if (
        !post?.ok ||
        post.channel?.parentId !== scope.channelId ||
        post.channel.guildId !== scope.guildId ||
        accessReason(
          { channelId: args.postId, guildId: scope.guildId, author: { id: scope.actorId } },
          this.getConfig(),
        )
      )
        throw Error('討論串不屬於目前允許的父頻道');
      info = post.channel;
    }
    let source = null,
      dest = null;
    if (args.messageId) {
      if (this.sourcePolicy(scope.channelId, args.messageId))
        throw Error('來源已有更正／忘記政策，請先人工核對');
      const r = await t.getMessage(scope.channelId, args.messageId);
      if (!r?.ok || r.message?.id !== args.messageId || r.message.channelId !== scope.channelId)
        throw Error('無法讀取來源訊息');
      source = r.message;
      if (this.sourcePolicy(scope.channelId, args.messageId)) throw Error('來源政策已改變');
      if (['edit', 'delete'].includes(action) && source.author?.id !== scope.selfId)
        throw Object.assign(new Error('只能修改或撤回自己發出的訊息'), { status: 403 });
      if (action === 'edit' && source.isVoiceMessage) throw Error('Discord 原生語音訊息不能編輯');
    }
    if (['join', 'leave', 'thread_edit'].includes(action) && ![10, 11, 12].includes(info.type))
      throw Error('此頻道不是討論串');
    if (action === 'forum_create' && ![15, 16].includes(info.type)) throw Error('此頻道不是論壇');
    if (args.tags) {
      let parent = info;
      if (info.parentId) {
        const r = await t.channelRead('info', { channelId: info.parentId });
        if (!r?.ok || r.channel.guildId !== scope.guildId) throw Error('論壇父頻道不一致');
        parent = r.channel;
      }
      const valid = new Set(parent.tags?.map((x) => x.id));
      if (args.tags.some((id) => !valid.has(id))) throw Error('請先查詢可用論壇標籤');
    }
    if (action === 'forward') {
      if (!scope.guildId || !c.channelForwardDestinationIds?.includes(args.destinationId))
        throw Error('轉傳目的地尚未加入允許清單；不允許私訊轉公開');
      const r = await t.channelRead('info', { channelId: args.destinationId });
      dest = r.channel;
      if (
        !r?.ok ||
        dest?.id !== args.destinationId ||
        dest.guildId !== scope.guildId ||
        accessReason({ channelId: dest.id, guildId: dest.guildId, author: { id: scope.actorId } }, c)
      )
        throw Error('目的地必須是同伺服器允許頻道');
      const text = JSON.stringify(safeSource(source));
      if (redactSensitive(text, c, { privateData: true }).count)
        throw Error('來源含已設定敏感資料，禁止原生轉傳');
    }
    this.config(scope, true);
    return {
      info,
      source,
      dest,
      fingerprint: hash({ parentInfo, info, source: source && safeSource(source), dest }),
    };
  }
  prune() {
    for (const [id, p] of this.plans) if (p.expires < this.now()) this.plans.delete(id);
  }
  async preview(scope, input) {
    this.prune();
    if (this.plans.size >= 100) throw Error('待確認操作已達上限');
    this.config(scope, true);
    const args = this.args(input),
      action = input.action;
    const checked = await this.inspect(scope, action, args);
    const plan = {
      id: randomUUID(),
      scope: { ...scope },
      action,
      args,
      fingerprint: checked.fingerprint,
      expires: this.now() + 300000,
    };
    plan.sourcePreview = this.publicPlan(plan, checked.source).sourcePreview;
    this.plans.set(plan.id, plan);
    return { ok: true, plan: this.publicPlan(plan, checked.source) };
  }
  publicPlan(p, source) {
    return this.sanitize(
      {
        id: p.id,
        kind: p.scope.kind,
        channelId: p.scope.channelId,
        actorId: p.scope.actorId,
        action: p.action,
        args: p.args,
        expires: p.expires,
        sourcePreview: source
          ? {
              authorId: source.author?.id,
              text: source.content?.slice(0, 500),
              attachments: source.attachments?.map((a) => a.name),
              stickerNames: source.stickers?.map((s) => s.name),
            }
          : p.sourcePreview,
        warning:
          p.action === 'forward'
            ? '原生轉傳會包含來源快照及附件；請核對目的頻道能否接收這些資料。'
            : '確認後會改變 Discord 中的訊息或討論串。',
      },
      p.scope,
    );
  }
  sameScope(a, b) {
    return ['kind', 'selfId', 'channelId', 'actorId', 'guildId', 'isGroupDm'].every(
      (k) => (a[k] || null) === (b[k] || null),
    );
  }
  async apply(id, scope) {
    this.prune();
    const p = this.plans.get(id);
    if (!p || (scope && !this.sameScope(p.scope, scope))) throw Error('確認已過期或範圍不符');
    this.plans.delete(id);
    const { c, t } = this.config(p.scope, true);
    if (c.dryRun || (p.scope.kind === 'user' && c.userReceiveOnly)) throw Error('模擬／僅觀察模式不執行寫入');
    const checked = await this.inspect(p.scope, p.action, p.args);
    if (p.expires < this.now()) throw Error('確認已過期，請重新預覽');
    if (checked.fingerprint !== p.fingerprint) throw Error('來源、頻道或標籤已改變，請重新預覽');
    const effectKey = hash({
      kind: p.scope.kind,
      selfId: p.scope.selfId,
      channelId: p.scope.channelId,
      action: p.action,
      args: p.args,
    });
    if (this.receipts.some((r) => r.effectKey === effectKey && ['running', 'uncertain'].includes(r.state)))
      throw Error('同一操作結果不明，請先人工核對');
    if (this.receipts.length >= 500) {
      const i = this.receipts.findIndex((r) => !['running', 'uncertain'].includes(r.state));
      if (i < 0) throw Error('待核對紀錄過多');
      this.receipts.splice(i, 1);
    }
    const row = {
      id: p.id,
      kind: p.scope.kind,
      channelId: p.scope.channelId,
      action: p.action,
      effectKey,
      state: 'running',
      at: this.now(),
    };
    this.receipts.push(row);
    await this.save();
    this.inflight.add(row.id);
    let timer,
      pending = false;
    try {
      const latest = this.config(p.scope, true).c;
      if (p.expires < this.now() || latest.dryRun || (p.scope.kind === 'user' && latest.userReceiveOnly))
        throw Error('write_disabled');
      if (p.args.messageId && this.sourcePolicy(p.scope.channelId, p.args.messageId))
        throw Error('source_policy_changed');
      if (
        p.action === 'forward' &&
        (!latest.channelForwardDestinationIds?.includes(p.args.destinationId) ||
          redactSensitive(JSON.stringify(safeSource(checked.source)), latest, { privateData: true }).count)
      )
        throw Error('forward_policy_changed');
      const operation = Promise.resolve(
        t.channelWrite(p.action, {
          ...p.args,
          channelId: p.args.postId || p.scope.channelId,
          expectedSelfId: p.scope.selfId,
          ...(checked.source
            ? { expectedContent: checked.source.content, expectedAuthorId: checked.source.author?.id }
            : {}),
        }),
      );
      pending = true;
      operation.then(
        () => {
          pending = false;
          this.inflight.delete(row.id);
        },
        () => {
          pending = false;
          this.inflight.delete(row.id);
        },
      );
      const r = await Promise.race([
        operation,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error('timeout')), this.timeoutMs);
        }),
      ]);
      if (!r?.ok) {
        const error = Error('not_confirmed');
        error.status = r?.httpStatus;
        throw error;
      }
      if (this.closed) throw Error('service_closed');
      row.state = 'succeeded';
      row.result = { messageId: r.messageId, threadId: r.threadId };
      await this.save();
      return { ok: true, receipt: { ...row } };
    } catch (error) {
      const rejected = [400, 401, 403, 404, 405, 429].includes(error.status);
      row.state = rejected ? 'rejected' : 'uncertain';
      if (rejected) row.httpStatus = error.status;
      await this.save().catch(() => {});
      return {
        ok: false,
        uncertain: !rejected,
        receipt: { ...row },
        error: rejected
          ? 'Discord 拒絕此操作，請確認內容／權限／頻道狀態；不會自動重試'
          : '執行結果未確認，請先核對 Discord；不會自動重試',
      };
    } finally {
      clearTimeout(timer);
      if (!pending) this.inflight.delete(row.id);
    }
  }
  async acknowledge(id) {
    const row = this.receipts.find((r) => r.id === id);
    if (!row || row.state !== 'uncertain' || this.inflight.has(id)) throw Error('此回執目前不能解除鎖定');
    row.state = 'acknowledged';
    await this.save();
    return { ok: true, receipt: row, warning: '僅記錄人工核對，不代表原操作成功' };
  }
  status() {
    this.prune();
    return {
      ok: true,
      storageError: this.storageError || null,
      reads: READ_ACTIONS,
      writes: WRITE_ACTIONS,
      plans: [...this.plans.values()].map((p) => this.publicPlan(p)),
      receipts: this.receipts.slice(-100),
      enabled: !!this.getConfig().channelActionsEnabled,
    };
  }
  definitions() {
    const execRead = async (a, e) => {
      try {
        const start = this.toolScope(e),
          r = await this.read(start.scope, a),
          current = this.toolScope(e);
        if (current.state !== start.state || current.message !== start.message) throw Error('turn changed');
        return r;
      } catch {
        return { ok: false, error: '目前會話未授權、範圍已變更或查詢失敗，請確認設定與權限' };
      }
    };
    return [
      {
        name: 'discord_cyberfriend_channel_query',
        description:
          '唯讀查詢目前 Discord 頻道：search限定日期歷史搜尋、info論壇標籤、archives公開封存討論串、posts目前論壇／媒體貼文索引、post_read讀取同父頻道的一篇貼文最近訊息、members目前討論串成員、pins。最多20則，不全服搜尋、不加入、不寫入。',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: READ_ACTIONS },
            query: { type: 'string' },
            postId: { type: 'string' },
            after: { type: 'string' },
            before: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 20 },
          },
          required: ['action'],
        },
        execute: execRead,
      },
      {
        name: 'discord_cyberfriend_channel_prepare',
        description:
          '管理者明確要求時，建立目前頻道訊息／討論串操作預覽。這不執行，必須到 Discord 原生確認入口或插件訊息操作工作台，由管理者核對後確認；AI沒有確認工具。',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: WRITE_ACTIONS },
            messageId: { type: 'string' },
            postId: { type: 'string' },
            destinationId: { type: 'string' },
            content: { type: 'string' },
            name: { type: 'string' },
            archived: { type: 'boolean' },
            tags: { type: 'array', items: { type: 'string' }, maxItems: 5 },
          },
          required: ['action'],
        },
        execute: async (a, e) => {
          try {
            const start = this.toolScope(e);
            const result = await this.preview(start.scope, a);
            const current = this.toolScope(e);
            if (current.state !== start.state || current.message !== start.message) {
              this.plans.delete(result.plan.id);
              throw Error('turn changed');
            }
            return result;
          } catch {
            return { ok: false, error: '未授權或無法核對操作，請確認來源、目的地、權限與設定' };
          }
        },
      },
    ];
  }
  async close() {
    this.closed = true;
    this.plans.clear();
    await this.saves;
  }
}
