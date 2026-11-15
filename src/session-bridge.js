import { knowledgeToolsFor } from './knowledge-tools.js';
import { tokenBudgetFor, eventUsage, sessionEventIndex } from './token-budget.js';
import { allowedReplyTools } from './security.js';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { describeRichContent, wrapUntrusted } from './persona.js';
import { resolveRoute } from './llm.js';
import { migrateWorkspace } from './session-migration.js';

export class DiscordSessions {
  constructor({ ctx, file, workspace, getConfig, log }) {
    Object.assign(this, { ctx, file, workspace, getConfig, log });
    this.bindings = {};
    this.live = new Map();
    this.queues = new Map();
    this.closed = false;
  }
  service(name) {
    return typeof this.ctx.get === 'function' ? this.ctx.get(name) : this.ctx[name];
  }
  async init() {
    try {
      this.bindings = JSON.parse(await readFile(this.file, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const registry = this.service('workspaceRegistry'),
      persistence = this.service('sessionPersistence');
    let changed = false;
    if (registry?.create && persistence?.stat)
      for (const b of Object.values(this.bindings)) {
        try {
          if (!(await persistence.stat(b.sessionId))) continue;
          const title = /guild-(\d+)$/.exec(b.cwd)?.[1];
          const workspace = await registry.create(
            b.cwd,
            title ? `Discord · 伺服器 ${title}` : /(?:user|bot)-[^\\/]+$/.test(b.cwd)
              ? `Discord · ${b.transport === 'bot' ? 'Bot' : '使用者帳號'} ${b.accountId}` : 'Discord · 私訊',
          );
          await workspace.attachSession(b.sessionId);
          if (b.workspaceId !== workspace.id) {
            b.workspaceId = workspace.id;
            changed = true;
          }
        } catch {
          this.log?.warn('session.workspace', '工作區綁定將在下次回覆時重新檢查', { sessionId: b.sessionId });
        }
      }
    if (changed) await this.save();
  }
  async save() {
    this.saves = (this.saves || Promise.resolve())
      .catch(() => {})
      .then(async () => {
        await mkdir(dirname(this.file), { recursive: true });
        await writeFile(this.file + '.tmp', JSON.stringify(this.bindings, null, 2) + '\n');
        await rename(this.file + '.tmp', this.file);
      });
    await this.saves;
  }
  identity(message, transport) {
    return `${transport.kind}:${transport.selfId}:${message.channelId}`;
  }
  workspaceFor(message, config, transport) {
    const root = resolve(config.sessionWorkspaceRoot || this.workspace);
    if (config.sessionWorkspaceGrouping === 'account') {
      if (!['user', 'bot'].includes(transport?.kind) || !/^[a-zA-Z0-9_-]{1,80}$/.test(String(transport?.selfId || '')))
        throw Error('尚未取得登入帳號，無法決定共用工作區');
      return join(root, 'discord', `${transport.kind}-${transport.selfId}`);
    }
    if (message.isDm && !message.isGroupDm) {
      if (String(message.author?.id) === config.adminUserId)
        return resolve(config.adminSessionWorkspace || join(root, 'discord', 'admin-dm'));
      const user = String(message.author?.id || 'unknown')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 80);
      return join(resolve(config.otherSessionWorkspace || join(root, 'discord', 'other-dm')), user);
    }
    return join(root, 'discord', message.guildId ? `guild-${message.guildId}` : `group-${message.channelId}`);
  }
  list() {
    // carry 是待補寫的訊息內容，不經由清單對外提供，只回報筆數。
    return Object.entries(this.bindings).map(([key, { carry, ...b }]) => ({
      key,
      ...b,
      ...(carry?.length ? { carried: carry.length } : {}),
      running: this.service('agents')?.get(b.sessionId)?.status === 'running',
      accountWorkspaceEnabled: this.getConfig().sessionWorkspaceGrouping === 'account',
    }));
  }
  async reset(key) {
    if (this.queues.has(key)) throw Error('此會話仍有待處理的回覆');
    const id = this.bindings[key]?.sessionId,
      state = this.live.get(id);
    if (state) {
      await state.dispose();
      this.live.delete(id);
    }
    if (this.bindings[key])
      this.bindings[key] = { ...this.bindings[key], sessionId: `session-${randomUUID()}` };
    await this.save();
  }
  async bind(key, { sessionId, cwd, useAccountWorkspace = false }) {
    if (!this.bindings[key]) throw Error('找不到 Discord 綁定');
    if (this.queues.has(key)) throw Error('會話仍有待處理回覆');
    if (useAccountWorkspace) {
      const config = this.getConfig(), binding = this.bindings[key];
      if (config.sessionWorkspaceGrouping !== 'account' || sessionId)
        throw Error('請先選擇依登入帳號共用工作區');
      const target = this.workspaceFor({}, config, { kind: binding.transport, selfId: binding.accountId });
      return this.inOrder(key, async () => {
        const result = await migrateWorkspace(this, key, target, { manualCwd: false });
        if (!result.changed) {
          const previous = this.bindings[key];
          this.bindings[key] = { ...previous, manualCwd: false };
          try { await this.save(); } catch (error) { this.bindings[key] = previous; throw error; }
        }
        return result;
      });
    }
    if (!sessionId) return this.inOrder(key, () => migrateWorkspace(this, key, cwd));
    return this.inOrder(key, async () => {
      if (Object.entries(this.bindings).some(([k, b]) => k !== key && b.sessionId === sessionId))
        throw Error('此會話已綁定另一段 Discord 對話');
      const original = this.bindings[key], agents = this.service('agents');
      const check = () => {
        const current = agents.get(original.sessionId);
        if (current && (current.status !== 'idle' || current.inbox?.nextTurn?.length || current.inbox?.nextStep?.length))
          throw Error('目前會話仍在執行或排隊，請稍後再綁定');
        if (agents.get(sessionId)) throw Error('請先關閉此 DSH 會話的執行工作再綁定');
      };
      check();
      const stored = await this.service('sessionPersistence').stat(sessionId);
      if (!stored?.header?.cwd) throw Error('找不到可綁定的 DSH 會話');
      const targetCwd = stored.header.cwd;
      if (!isAbsolute(targetCwd)) throw Error('請提供工作區的完整絕對路徑');
      const workspace = await this.service('workspaceRegistry').create(targetCwd);
      await workspace.attachSession(sessionId);
      check();
      if (this.bindings[key] !== original) throw Error('綁定已變更，未覆蓋');
      this.bindings[key] = { ...original, sessionId, cwd: resolve(targetCwd), workspaceId: workspace.id, manualCwd: true };
      try { await this.save(); } catch (error) { this.bindings[key] = original; throw error; }
      const state = this.live.get(original.sessionId);
      if (state && !state.borrowed && state.agent.status === 'idle' &&
          !state.agent.inbox?.nextTurn?.length && !state.agent.inbox?.nextStep?.length) {
        this.live.delete(original.sessionId);
        await state.dispose().catch(() => this.log?.warn('session.bind', '舊會話釋放未完成'));
      }
      return { changed: true, sessionId, cwd: targetCwd, oldSessionRetained: true };
    });
  }

  async run(message, transport, config, options) {
    const key = this.identity(message, transport);
    return this.inOrder(key, () => {
      const meter = tokenBudgetFor(this.ctx);
      const state = this.live.get(this.bindings[key]?.sessionId);
      /* 估算預留額度需要整段會話的大小：以增量索引取得位元組數，不再每次回覆把全部歷史序列化成字串。 */ const session =
        state?.agent?.session;
      return meter
        ? meter.run(
            'native-reply',
            {
              ...options,
              usageScope: this.bindings[key]?.sessionId || key,
              extraInputBytes: session ? sessionEventIndex(session).bytes + 1 : 3,
            },
            (reservation) =>
              this.runOne(key, message, transport, config, { ...options, budgetReservation: reservation.id }),
          )
        : this.runOne(key, message, transport, config, options);
    });
  }
  async inOrder(key, job) {
    const previous = this.queues.get(key) || Promise.resolve();
    const result = previous.catch(() => {}).then(job);
    const tail = result.catch(() => {});
    this.queues.set(key, tail);
    try {
      return await result;
    } finally {
      if (this.queues.get(key) === tail) this.queues.delete(key);
    }
  }
  sourceId(message) {
    return /^\d{15,22}$/.test(message.id || '') ? `discord:${message.channelId}:${message.id}` : null;
  }
  hasSource(agent, message) {
    const id = this.sourceId(message);
    return id && sessionEventIndex(agent.session).ids.has(id);
  }
  async archive(message, transport, config) {
    const key = this.identity(message, transport);
    return this.inOrder(key, async () => {
      if (this.closed) throw Error('會話服務已關閉');
      const { agent } = await this.acquire(key, message, transport, {
        ...config,
        llmMode: config.llmMode === 'custom' ? 'auto' : config.llmMode,
      });
      if (this.hasSource(agent, message)) return { sessionId: agent.id, duplicate: true };
      if (agent.status !== 'idle') throw Error('會話仍在執行，管理者訊息將稍後保存');
      await this.flushCarry(key, agent);
      const media = [...(message.attachments || []), ...(message.stickers || [])]
        .map((a) => a.url)
        .filter(Boolean)
        .join('\n');
      const text =
        `[Discord 管理者對話紀錄；${message.simulated ? '接口模擬資料，並非實際 Discord 發言；' : ''}作者 ${message.author?.name || message.author?.id} (${message.author?.id})；頻道 ${message.channelId}；時間 ${message.timestamp || message.id}；僅保存，不要求回覆]\n` +
        wrapUntrusted(
          describeRichContent(message.content, message.stickers, message.attachments, message.embeds) +
            (media ? '\n' + media : ''),
          16000,
        );
      await agent.runMaintenance(async () => {
        // DSH requires the system surface head before any archived user surface.
        // AdminJournal retains this message durably and retries after the first turn.
        if (!sessionEventIndex(agent.session).hasSystemMessage)
          throw Error('會話尚未建立系統開頭，管理者訊息保留待寫入');
        if (!this.hasSource(agent, message))
          agent.session.append(
            'user/message',
            {
              id: this.sourceId(message) || randomUUID(),
              role: 'user',
              content: [{ type: 'text', text }],
              source: { kind: 'user' },
            },
            { surfaceOp: 'append' },
          );
      });
      return { sessionId: agent.id, duplicate: false };
    });
  }
  /** 換會話時帶過來的管理者訊息：等新會話有系統開頭之後才補寫，寫完就從綁定移除。 */
  async flushCarry(key, agent) {
    const binding = this.bindings[key];
    if (!binding?.carry?.length || binding.sessionId !== agent.id || agent.status !== 'idle') return;
    if (!sessionEventIndex(agent.session).hasSystemMessage) return;
    await agent.runMaintenance(async () => {
      const seen = sessionEventIndex(agent.session).ids;
      for (const data of binding.carry)
        if (!data?.id || !seen.has(data.id)) agent.session.append('user/message', data, { surfaceOp: 'append' });
    });
    delete binding.carry;
    await this.save();
  }
  async acquire(key, message, transport, config) {
    const agents = this.service('agents');
    if (!agents?.create || !agents.resume || !this.service('sessionPersistence'))
      throw Error('DSH Agent／Session 持久化服務尚未就緒');
    const cwd = this.bindings[key]?.manualCwd ? this.bindings[key].cwd : this.workspaceFor(message, config, transport);
    if (this.bindings[key] && resolve(this.bindings[key].cwd) !== resolve(cwd))
      await migrateWorkspace(this, key, cwd, { manualCwd: false, config });
    await mkdir(cwd, { recursive: true });
    const workspaces = this.service('workspaceRegistry');
    if (!workspaces?.create) throw Error('DSH 工作區註冊服務未就緒');
    const workspace = await workspaces.create(
      cwd,
      config.sessionWorkspaceGrouping === 'account'
        ? `Discord · ${transport.kind === 'bot' ? 'Bot' : '使用者帳號'} ${transport.selfId}`
        : message.guildId
        ? `Discord · 伺服器 ${message.guildId}`
        : message.isDm && !message.isGroupDm
          ? `Discord · ${String(message.author?.id) === config.adminUserId ? '管理者' : '其他使用者'}私訊`
          : `Discord · 群組 ${message.channelId}`,
    );
    let binding = this.bindings[key];
    if (!binding || binding.cwd !== cwd) {
      binding = {
        sessionId: `session-${randomUUID()}`,
        cwd,
        channelId: message.channelId,
        transport: transport.kind,
        accountId: transport.selfId,
        title: `Discord ${transport.kind} · ${message.channelName || message.author?.name || message.channelId}`,
      };
      this.bindings[key] = binding;
      await this.save();
    }
    // 使用者在 DSH 把這個頻道綁定的會話封存，代表不想再續用它（例如上下文已滿）。
    // 下一則訊息改用新會話；舊會話維持封存、檔案不動，舊 ID 記在 binding.replaced。
    const archivedIds = workspaces.archivedSessionIds;
    if (archivedIds && typeof archivedIds !== 'string' && [...archivedIds].map(String).includes(binding.sessionId)) {
      const old = binding.sessionId,
        liveState = this.live.get(old);
      if (agents.get(old) && agents.get(old).status !== 'idle')
        throw Error('已封存的舊會話仍在執行中，請等待工作結束後重試；不在執行中更換會話');
      if (liveState) {
        this.live.delete(old);
        if (!liveState.borrowed) await liveState.dispose();
      }
      binding.sessionId = `session-${randomUUID()}`;
      binding.replaced = [...(binding.replaced || []), old].slice(-10);
      await this.save();
      this.log?.info('session.replaced', '綁定的 DSH 會話已被封存，改用新會話（舊會話保留）', {
        previous: old,
        sessionId: binding.sessionId,
        reason: 'archived',
      });
    }
    const unsafeCarry = (agent) => {
      if (!agent || sessionEventIndex(agent.session).firstMessageType !== 'user/message') return [];
      const events = agent?.session.snapshotEvents?.() || [];
      return events.filter((e) => e.type === 'user/message' && e.data).map((e) => e.data);
    };
    let state = this.live.get(binding.sessionId);
    const loadedCarry = unsafeCarry(agents.get(binding.sessionId));
    if (loadedCarry.length && agents.get(binding.sessionId)?.status !== 'idle')
      throw Error('舊會話正在使用中，請等待工作結束後重試；不在執行中更換會話');
    if (state && agents.get(binding.sessionId) === state.agent && !loadedCarry.length) return state;
    if (state) {
      this.live.delete(binding.sessionId);
      if (loadedCarry.length && !state.borrowed) await state.dispose();
    }
    const existing = agents.get(binding.sessionId);
    state = { options: {}, system: '', binding, error: null };
    const route = resolveRoute(this.ctx, config);
    if (!route) throw Error('DSH 會話模式需要選擇 DSH 模型；自訂 API 請使用獨立模式');
    const mount = (scope) => {
      const disposers = [];
      const release = () => {
        for (const dispose of disposers.reverse()) if (typeof dispose === 'function') dispose();
      };
      try {
        if (scope.tools.guard)
          disposers.push(
            scope.tools.guard((exec) =>
              ((exec.definition?.name || exec.name) === 'discord_cyberfriend_companion_resume' &&
                this.service('discordCompanion')?.canResume(exec.agent?.id || exec.agent?.session?.id)) ||
              (state.inFlight && state.allowedTools?.includes(exec.definition?.name || exec.name))
                ? undefined
                : 'Discord 回覆未授權此工具',
            ),
          );
        disposers.push(
          scope.systemPrompt.section({
            name: 'discord-channel-contract',
            order: 990,
            text: () => state.system,
            interpolate: false,
          }),
        );
        disposers.push(
          scope.on('agent/request', async (event, next) => {
            const request = {
              ...(await next()),
              maxTokens: Math.max(1600, state.options.maxTokens || 1600),
              temperature: state.options.temperature ?? 0.8,
            };
            if (state.inFlight && state.options.budgetReservation)
              await tokenBudgetFor(this.ctx)?.guardNative(state.options.budgetReservation, request);
            return request;
          }),
        );
        disposers.push(
          scope.on('agent/error', ({ error }) => {
            state.error = error;
          }),
        );
        return release;
      } catch (error) {
        release();
        throw error;
      }
    };
    state.mount = mount;
    const setup = async (scope) => {
      mount(scope);
    };
    const common = { agentOptions: { ...route, maxTokens: 3200 }, setup };
    const create = () =>
      agents.create({ ...common, sessionId: binding.sessionId, meta: { cwd, title: binding.title } });
    // 舊版曾在系統開頭建立之前寫入管理者訊息。那種會話第一次回覆後，系統訊息會排在使用者訊息之後，
    // 宿主下次就拒絕載入。這裡在回覆之前換成新會話（舊檔保留不動），並把已保存的訊息帶過去。
    const replace = async (reason, carry = []) => {
      const old = binding.sessionId;
      binding.sessionId = `session-${randomUUID()}`;
      binding.replaced = [...(binding.replaced || []), old].slice(-10);
      if (carry.length) binding.carry = [...(binding.carry || []), ...carry].slice(-50);
      await this.save();
      this.log?.warn('session.replaced', '原 DSH 會話無法安全續用，已換成新會話（舊檔保留）', {
        previous: old,
        sessionId: binding.sessionId,
        reason,
        carried: carry.length,
      });
      return create();
    };
    let handle;
    if (loadedCarry.length) {
      // 已由介面或宿主載入的舊會話也可能只有管理者訊息；不把它當成安全的借用會話。
      // 借用中的原 Agent 不關閉、不寫入，插件建立自己的新會話。
      handle = await replace('loaded-user-before-system', loadedCarry);
    } else if (existing) {
      state.borrowed = true;
      handle = { agent: existing, dispose: async () => {} };
    } else {
      const stored = await this.service('sessionPersistence').stat(binding.sessionId);
      if (!stored) handle = await create();
      else {
        try {
          handle = await agents.resume({ ...common, resumeSessionId: binding.sessionId });
        } catch (error) {
          if (!/SessionPersistenceCorruption|protected first surface/i.test(`${error?.name} ${error?.message}`))
            throw error;
          handle = await replace('corrupt');
        }
        if (binding.sessionId === handle.agent.id) {
          const events = handle.agent.session.snapshotEvents?.() || [];
          const users = events.filter((e) => e?.type === 'user/message' && e.data);
          if (users.length && !events.some((e) => e?.type === 'system/message' || e?.type === 'assistant/message')) {
            await handle.dispose();
            handle = await replace(
              'user-before-system',
              users.map((e) => e.data),
            );
          }
        }
      }
    }
    state.agent = handle.agent;
    state.dispose = handle.dispose;
    this.live.set(binding.sessionId, state);
    if (!workspace?.attachSession) throw Error('DSH 工作區不支援會話綁定');
    await workspace.attachSession(binding.sessionId);
    binding.workspaceId = workspace.id;
    await this.save();
    try {
      await this.service('sessionController')?.rename({ sessionId: binding.sessionId, title: binding.title });
    } catch {}
    this.log?.info('session.bound', 'Discord 已連接 DSH 會話', { sessionId: binding.sessionId, cwd });
    return state;
  }
  async runOne(key, message, transport, config, options) {
    if (this.closed || options.signal?.aborted) return { ok: false, code: 'CANCELLED', error: '回覆已取消' };
    try {
      const state = await this.acquire(key, message, transport, config),
        agent = state.agent;
      if (options.signal?.aborted) return { ok: false, code: 'CANCELLED', error: '回覆已取消' };
      if (agent.status !== 'idle') return { ok: false, error: 'DSH 會話正在被其他工作使用' };
      state.message = message;
      state.options = {
        ...options,
        maxTokens: options.images?.length
          ? Math.max(options.maxTokens || 400, config.mediaReplyTokens || 3200)
          : Math.max(1600, options.maxTokens || 400),
      };
      state.system = options.system || '';
      state.error = null;
      let route = resolveRoute(this.ctx, config);
      if (!route) throw Error('DSH 會話模式需要 DSH 模型');
      if (options.images?.length && config.mediaVisionMode !== 'native') {
        const llm = this.service('llm');
        const info = await llm.resolveModelInfo?.(route.provider, route.model);
        if (config.mediaVisionMode === 'modlens' || !info?.inputModalities?.includes('image')) {
          const providers = llm.listProviders?.() || [];
          const candidates = [
            `modlens-${route.provider}`,
            ...(route.provider === 'deepseek-official' ? ['deepseek-modlens'] : []),
          ];
          for (const provider of candidates) {
            if (!providers.some((p) => (p.id || p.provider) === provider)) continue;
            try {
              const wrapped = await llm.resolveModelInfo(provider, route.model);
              if (wrapped.inputModalities?.includes('image')) {
                route = { ...route, provider };
                break;
              }
            } catch {}
          }
        }
      }
      let images = [];
      if (options.images?.length) {
        const refs = await this.service('attachments').saveImages(
          options.images.map((f, i) => ({
            data: new Uint8Array(Buffer.from(f.data, 'base64')),
            mediaType: f.mediaType,
            name: `discord-frame-${i}-${f.timeMs}ms.jpg`,
          })),
        );
        images = refs.flatMap((attachment, i) => [
          { type: 'text', text: `${options.images[i].source || '媒體'} ${options.images[i].timeMs}ms` },
          { type: 'image', attachment },
        ]);
      }
      const from = agent.session.seq;
      const abort = () => {
        if (state.inFlight) agent.cancel({ kind: 'user' }, { keepInbox: false });
      };
      const signal = AbortSignal.any([
        ...(options.signal ? [options.signal] : []),
        AbortSignal.timeout(120000),
      ]);
      signal.addEventListener('abort', abort, { once: true });
      let release, previousModel, releaseAccess, releaseGuard, releaseStream;
      try {
        if (signal.aborted) return { ok: false, code: 'CANCELLED', error: '回覆已取消' };
        if (agent.status !== 'idle') return { ok: false, error: 'DSH 會話正在生成其他回覆，請稍後重試' };
        if (state.borrowed) {
          previousModel = agent.model.current?.();
          if (config.llmMode === 'auto' && !options.images?.length && previousModel) route = previousModel;
          release = state.mount(agent.ctx);
        }
        const actor = options.actorId || message.author?.id;
        const catalog = this.service('tools');
        const configured = allowedReplyTools(
          { ...config, webLookupEnabled: false, memeLookupEnabled: false },
          message,
          actor,
        );
        const lookup = knowledgeToolsFor(this.ctx, config, message, actor);
        const allow = [...new Set([...configured, ...lookup])].filter(
          (name) => !catalog?.get || catalog.get(name),
        );
        if (options.onTextDelta && allow.length === 0) {
          let attempt;
          releaseStream = agent.ctx.on('agent/assistant-stream', (event) => {
            if (event.agent !== agent || !state.inFlight || signal.aborted) return;
            const frame = event.frame;
            if (frame?.type === 'start') {
              if (attempt && attempt !== frame.attemptId) options.onStreamReset?.();
              attempt = frame.attemptId;
            } else if (
              frame?.type === 'chunk' &&
              frame.attemptId === attempt &&
              frame.chunk?.type === 'text-delta'
            )
              options.onTextDelta(frame.chunk.text);
          });
        }
        if (options.onTextDelta && allow.length)
          options.onStreamReset?.('本次可使用工具，保留完整回覆後朗讀');
        state.allowedTools = allow;
        releaseAccess = agent.ctx.tools.restrict({ allow });
        releaseGuard = agent.ctx.tools.guard?.((exec) =>
          allow.includes(exec.name) ? undefined : '此 Discord 操作者／場景未授權 Agent 工具',
        );
        const diagnosticTickets = this.service('discordCapabilities')?.toolTickets?.(lookup, {
          simulated: !!message.simulated,
        });
        state.inFlight = true;
        agent.model.select(route);
        agent.followup({
          id: (!this.hasSource(agent, message) && this.sourceId(message)) || randomUUID(),
          role: 'user',
          content: [{ type: 'text', text: options.user }, ...images],
          source: { kind: 'user' },
        });
        await agent.whenIdle();
        if (diagnosticTickets)
          this.service('discordCapabilities')?.captureToolResults?.(
            diagnosticTickets,
            agent.session.snapshotEvents(from),
          );
        if (signal.aborted) return { ok: false, code: 'CANCELLED', error: '回覆已取消' };
        if (state.error) throw state.error;
        const events = agent.session.snapshotEvents(from);
        const end = events.findLast((e) => e.type === 'turn/end')?.data.reason;
        if (end?.kind && end.kind !== 'completed') throw Error(`DSH 回覆未完成 (${end.kind})`);
        const answers = events.filter(
          (e) =>
            e.type === 'assistant/message' &&
            !e.data.interrupted &&
            !e.data.message.content.some((b) => b.type === 'tool-call'),
        );
        const text =
          answers
            .at(-1)
            ?.data.message.content.filter((b) => b.type === 'text')
            .map((b) => b.text)
            .join('\n') || '';
        if (!text) throw Error('DSH 會話沒有產生文字答案');
        await this.flushCarry(key, agent).catch(() => {});
        return {
          ok: true,
          usage: eventUsage(events),
          text,
          provider: route.provider,
          model: route.model,
          sessionId: agent.id,
          imagesSent: images.filter((b) => b.type === 'image').length,
        };
      } finally {
        signal.removeEventListener('abort', abort);
        try {
          releaseStream?.();
          releaseAccess?.();
          releaseGuard?.();
          release?.();
          if (state.borrowed && previousModel && state.inFlight) agent.model.select(previousModel);
        } finally {
          state.inFlight = false;
        }
      }
    } catch (error) {
      this.log?.warn('session.error', 'DSH 會話回覆失敗', { code: error.code || error.name });
      return {
        ok: false,
        code: error.code,
        error: `DSH 會話回覆失敗：${String(error.message).slice(0, 250)}`,
      };
    }
  }
  async dispose() {
    this.closed = true;
    for (const state of this.live.values())
      if (!state.borrowed || state.inFlight) state.agent.cancel({ kind: 'disposed' }, { keepInbox: false });
    await Promise.allSettled([...this.live.values()].map((s) => s.dispose()));
    this.live.clear();
  }
}
