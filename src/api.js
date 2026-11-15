import { knowledgeCatalog } from './knowledge-tools.js';
import { userPresence, validatePresence } from './user-presence.js';
import { managementRejection } from './http-security.js';
import { redactDiagnostic, redactDiagnosticPayload } from './security.js';
import { SECRET_KEYS } from './config.js';
/**
 * src/api.js — 前端用的 REST 介面
 * ============================================================================
 * 全部掛在 /api/discord-cyberfriend 之下（webServer 以 prefix 註冊）。
 * 前端 client.js 只透過這些端點操作，不直接碰 Discord。
 * ============================================================================
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { searchGifs } from './gif.js';
import { generateReply, listHostProviders, testLlm } from './llm.js';
import { prepareGif, mediaUrl } from './media.js';
import { describeSchema, publicConfig, tokenFingerprint } from './config.js';
import { exportConfig, importPatch } from './config-history.js';
import { truncate } from './util.js';
import { checkDiscordToken, tokenCheckSummary } from './transport/tokenCheck.js';

const MAX_BODY = 512 * 1024;

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload ?? null);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(body);
}

/** 請求本身的問題（驗證失敗 400、服務未就緒 409、內容過大 413）；與未預期的伺服器錯誤（500）分開。 */
const bad = (message, status = 400) => Object.assign(new Error(message), { status });

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw bad('請求內容過大', 413);
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    throw bad('請求內容不是合法的 JSON');
  }
}

function queryOf(req) {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  return Object.fromEntries(url.searchParams.entries());
}

/**
 * @param {{getConfig:Function, setConfig:Function, getManager:Function, getLedger:Function,
 *          getHistory:Function, getLogger:Function, ctx:object, restart:Function, publicConfigFn:Function}} deps
 */
export const API_PREFIX = '/api/discord-cyberfriend';
/** 改名前的 API 路徑；保留為別名。 */
export const LEGACY_API_PREFIX = '/api/discord-pyself-lab';

export function createApiHandler(deps) {
  const { getConfig, setConfig, getManager, getLedger, getHistory, getLogger, ctx, simulateInbound } = deps;
  const secretValues = () => {
    const c = getConfig?.() || {};
    return SECRET_KEYS.map((k) => c[k]).filter((v) => typeof v === 'string' && v.length >= 4);
  };

  /**
   * 解析要用的介面；未登入時 getManager().resolve() 會丟錯，
   * 這裡轉成 { error } 讓各端點回 400 而不是 500。
   */
  function resolveTransport(kind) {
    try {
      return { transport: getManager().resolve(kind) };
    } catch (error) {
      return { error: error.message };
    }
  }

  const noTransport = (error) => ({ status: 400, body: { ok: false, error } });

  const routes = {
    'GET /conversation/topics': async (req) =>
      deps.conversation?.status({ includeAnswered: queryOf(req).includeAnswered === '1' }) || {
        ok: false,
        error: '話題服務尚未載入',
      },
    'POST /conversation/plan': async (req) => {
      const b = await readJson(req);
      if (!Number.isInteger(b.expectedRevision)) throw bad('請先更新話題狀態');
      if (!['defer', 'resume'].includes(b.action)) throw bad('只支援延後或重新回答的確認預覽');
      return deps.conversation.plan(String(b.topicId || ''), {
        action: b.action,
        when: b.when,
        expectedRevision: b.expectedRevision,
      });
    },
    'POST /conversation/confirm': async (req) => {
      const b = await readJson(req);
      return deps.conversation.confirm(String(b.planId || ''), String(b.code || ''));
    },
    'POST /conversation/close': async (req) => {
      const b = await readJson(req);
      if (!Number.isInteger(b.expectedRevision)) throw bad('請先更新話題狀態');
      if (b.confirmed !== true) throw bad('請明確確認結束此話題');
      return deps.conversation.closeTopic(String(b.topicId || ''), b.expectedRevision);
    },
    'GET /capabilities': async (req) =>
      deps.capabilities
        ? deps.capabilities.snapshot({ force: queryOf(req).refresh === '1' })
        : { ok: false, error: '統一能力診斷尚未載入' },
    'GET /voice/overview': async (req) =>
      deps.voiceOverview.snapshot(req, { withMemory: queryOf(req).memory === '1' }),
    'POST /voice/input/stop': async () => {
      deps.voice.input.close();
      return { ok: true };
    },
    'POST /voice/transcribe': async (req) => {
      const b = await readJson(req);
      if (typeof b.audioBase64 !== 'string' || b.audioBase64.length > 450000) throw bad('測試WAV過大');
      const audio = Buffer.from(b.audioBase64, 'base64');
      if (audio.toString('base64') !== b.audioBase64) throw bad('音訊編碼不正確');
      return deps.voice.input.acceptWav(String(b.userId || ''), audio, { kind: b.kind || 'bot' });
    },
    'GET /voice': async () => deps.voice?.status() || { ok: false, error: '語音服務未就緒' },
    'GET /voice/check': async () => {
      await deps.voice.tts.refresh({ force: true });
      return deps.voice.diagnostics();
    },
    'POST /voice/join': async (req) => deps.voice.join(await readJson(req)),
    'POST /voice/leave': async (req) => deps.voice.leave((await readJson(req)).kind),
    'POST /voice/stop': async (req) => deps.voice.stop((await readJson(req)).kind),
    'POST /voice/speak': async (req) => {
      const b = await readJson(req);
      await deps.voice.tts.refresh();
      const { done, ...result } = deps.voice.speak({
        kind: b.kind,
        text: b.text,
        speechInstruction: b.speechInstruction,
      });
      return result;
    },
    'GET /voice/replays': async () => ({ ok: true, items: deps.voice?.replays.list() || [] }),
    'POST /voice/replay': async (req) => {
      const b = await readJson(req);
      return deps.voice.replay({ kind: b.kind, id: String(b.id || '') });
    },
    'GET /voice/music-providers': async () => ({
      ok: true,
      providers: deps.musicProviders?.catalog() || [],
      ytdlp: deps.ytdlp?.status(),
    }),
    // 下載（或更新）yt-dlp：從官方發行頁取得並核對校驗值，只由使用者在設定頁觸發。
    'POST /voice/ytdlp/install': async () => {
      const result = await deps.ytdlp.install();
      if (!result.ok) throw Error('yt-dlp 下載失敗：' + result.error);
      return result;
    },
    // 使用者帳號需要的 Python 環境：狀態，以及由使用者在設定頁觸發的一鍵安裝。
    // 安裝要幾分鐘，所以這裡只負責開始；進度由介面讀取狀態。
    'GET /user/python': async () => ({ ok: true, python: await deps.pythonSetup.inspect() }),
    'POST /user/python/install': async () => {
      const before = deps.pythonSetup.status();
      if (before.customPath) throw Error('你已經填了自己的 Python 路徑，不會自動安裝；想用一鍵安裝請先清空那一欄並存檔');
      deps.pythonSetup.install();
      return { ok: true, started: true, python: deps.pythonSetup.status() };
    },
    'GET /voice/music': async (req) => deps.voice.library(req, queryOf(req)),
    'POST /voice/music': async (req) => {
      const b = await readJson(req);
      return deps.voice.music({
        kind: b.kind,
        path: b.path,
        provider: b.provider,
        trackId: b.trackId,
        label: b.label,
        req,
      });
    },
    'POST /test-diary': async (req) => {
      const input = await readJson(req);
      if (!deps.memoryOutput || !deps.sessionBridge) throw bad('日記服務尚未就緒', 409);
      const cwd = join(
        deps.sessionBridge.workspace,
        'discord',
        input.scope === 'second' ? 'diary-verification-2' : 'diary-verification',
      );
      await mkdir(cwd, { recursive: true });
      const date = new Intl.DateTimeFormat('en-CA', {
          timeZone: deps.memoryOutput.timeZone(),
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date()),
        path = join(cwd, 'diary-verification.md');
      const data = {
        date,
        channelId: 'system-verification',
        cwd,
        diaryPath: path,
        reactionEvents: [],
        cultureEvents: [],
        messages: [
          {
            source: 'diagnostic',
            admin: false,
            message: {
              id: 'system-verification',
              author: { id: 'dsh-system', name: 'DSH系統驗證' },
              content:
                '這是使用者授權的系統功能驗證，並非群聊或個人生活。正在驗證：工作區人格撰寫 AI 日記，經外部記憶插件依工作區分庫；工具回傳必須核對，不能由 AI 自稱成功。請記錄一條標記「系統測試」的功能驗證摘要，勿寫人物事實。',
              ts: new Date().toISOString(),
            },
          },
        ],
      };
      const diary = await deps.memoryOutput.diaryAgent.write(data, {
        onDraft: async (d) => writeFile(path, '# 系統測試日記\n\n' + d.text + '\n', 'utf8'),
      });
      await writeFile(join(cwd, 'diary-verification.json'), JSON.stringify(diary, null, 2) + '\n', 'utf8');
      return { ok: !diary.error, path, ...diary };
    },
    'GET /culture/assets': async (req) =>
      deps.culture ? deps.culture.listAssets(queryOf(req)) : { ok: false, error: '素材服務尚未就緒' },
    'POST /culture/assets/update': async (req) => {
      const b = await readJson(req);
      return deps.culture
        ? deps.culture.updateAsset(String(b.id || ''), b)
        : { ok: false, error: '素材服務尚未就緒' };
    },
    'GET /token-budget': async () => ({ ok: true, ...deps.tokenBudget?.status() }),
    'GET /user-behavior': async () => ({ ok: true, ...deps.behavior?.status() }),
    'POST /user-behavior': async (req) => {
      const b = await readJson(req);
      if (b.action === 'capture') return deps.behavior.capture(b);
      if (b.action === 'apply') return deps.behavior.applyPreset(b.id, b.profile);
      if (b.action === 'removePreset') return deps.behavior.removePreset(b.id);
      if (b.action === 'putRule') return deps.behavior.putRule(b);
      if (b.action === 'removeRule') return deps.behavior.removeRule(b.id);
      return { status: 400, body: { ok: false, error: '不支援的偏好操作' } };
    },
    'GET /user-review': async () => ({ ok: true, ...deps.review?.status() }),
    'POST /user-review/approve': async (req) => {
      const b = await readJson(req);
      return deps.review.approve(b.id, b);
    },
    'POST /user-review/discard': async (req) => {
      const b = await readJson(req);
      const row = deps.review.rows.get(b.id),
        source = row?.source?.id,
        uncertain = row?.state === 'uncertain';
      const result = await deps.review.discard(b.id, b.version, b.acknowledgeUncertain === true);
      if (source) {
        if (uncertain) await deps.inbox?.resolve(source, 'uncertain-reviewed');
        else await deps.inbox?.mark(source, 'pending', '草稿已捨棄，可重新產生');
      }
      return result;
    },
    'POST /user-inbox/retry': async (req) => {
      const b = await readJson(req);
      return deps.retryInbox(String(b.messageId || ''));
    },
    'GET /user-inbox': async () => ({ ok: true, ...deps.inbox?.status() }),
    'POST /user-inbox/resolve': async (req) => {
      const b = await readJson(req);
      if (!deps.inbox) throw bad('收件匣尚未就緒', 409);
      return deps.inbox.resolve(String(b.messageId || ''));
    },
    'POST /user-message/edit': async (req) => {
      const b = await readJson(req);
      return getManager().byKind.user.editMessage(
        String(b.channelId || ''),
        String(b.messageId || ''),
        b.content,
      );
    },
    'POST /user-message/delete': async (req) => {
      const b = await readJson(req);
      if (b.confirmed !== true) return { status: 400, body: { ok: false, error: '請明確確認撤回訊息' } };
      return getManager().byKind.user.deleteMessage(String(b.channelId || ''), String(b.messageId || ''));
    },
    'GET /user-takeover': async () => ({ ok: true, ...deps.takeover?.status() }),
    'POST /user-takeover': async (req) => {
      const b = await readJson(req);
      if (!deps.takeover) throw bad('人工接管服務未就緒', 409);
      if (b.action === 'resume') return deps.takeover.resume(b.channelId);
      if (b.action !== 'pause')
        return { status: 400, body: { ok: false, error: 'action 需為 pause 或 resume' } };
      return deps.takeover.pause(b.channelId, { seconds: b.seconds, label: b.label });
    },
    'GET /culture': async () => ({ ok: true, culture: deps.culture?.status() || null }),
    'POST /culture/invalidate': async (req) => {
      const b = await readJson(req);
      return deps.culture ? deps.culture.invalidate(String(b.id || '')) : { ok: false };
    },
    'GET /companion': async () => ({ ok: true, ...deps.companion?.status() }),
    'POST /companion/mode': async (req) => deps.companion.setMode(await readJson(req)),
    'POST /companion/consent': async (req) => deps.companion.grantAdmin(await readJson(req)),
    'POST /companion/schedule': async (req) => deps.companion.create(await readJson(req)),
    'POST /companion/forget': async (req) => deps.companion.forget(String((await readJson(req)).id || '')),
    'POST /companion/cancel': async (req) => deps.companion.cancel(String((await readJson(req)).id || '')),
    'POST /mood/check': async (req) => {
      const b = await readJson(req),
        binding = deps.sessionBridge?.bindings[b.key];
      if (!binding) throw bad('請先選擇已綁定的 Discord 會話');
      return {
        ok: true,
        mood: await deps.moodAdapter.snapshot({
          sessionId: binding.sessionId,
          cwd: binding.cwd,
          slotId: getConfig().feiyuMoodSlot || undefined,
        }),
      };
    },
    'POST /singing/doctor': async () => ({ ok: true, diagnostic: await deps.songWorkflow.doctor() }),
    'POST /singing/cancel': async (req) => ({
      ok: true,
      job: deps.songWorkflow.jobs.cancelManaged(String((await readJson(req)).id || '')),
    }),
    'GET /singing': async () => ({
      ok: true,
      singing: deps.songWorkflow?.status() || { integrated: false, tools: [], jobs: [] },
    }),
    'GET /interaction': async () => ({
      ok: true,
      interaction: deps.turns?.snapshot() || { trace: [] },
      knowledge: knowledgeCatalog(ctx),
      mood: deps.moodAdapter?.status() || { available: false, reason: '心情適配器未載入' },
    }),
    'POST /memory-maintenance/external/preview': async (req) =>
      deps.memoryMaintenance.previewExternal(await readJson(req)),
    'POST /memory-maintenance/external/apply': async (req) => {
      const b = await readJson(req);
      if (b.confirmed !== true) throw bad('請明確確認外部操作範圍');
      return deps.memoryMaintenance.applyExternal(String(b.id || ''));
    },
    'POST /memory-maintenance/external/reconcile': async (req) => {
      const { id } = await readJson(req);
      if (!deps.memoryMaintenance) throw bad('記憶維護服務尚未就緒');
      return deps.memoryMaintenance.reconcileExternal(String(id || ''));
    },
    'POST /memory-maintenance/external/acknowledge': async (req) => {
      const b = await readJson(req);
      if (b.confirmed !== true) throw bad('請先到原插件核對結果');
      return deps.memoryMaintenance.acknowledgeExternal(String(b.id || ''));
    },
    'GET /channel-actions': async () => deps.channelActions.status(),
    'POST /channel-actions/query': async (req) => {
      const b = await readJson(req);
      return deps.channelActions.read(await deps.channelActions.uiScope(b), b);
    },
    'POST /channel-actions/preview': async (req) => {
      const b = await readJson(req);
      return deps.channelActions.preview(await deps.channelActions.uiScope(b), b);
    },
    'POST /channel-actions/confirm': async (req) => {
      const b = await readJson(req);
      if (b.confirmed !== true) throw bad('請先核對預覽並明確確認');
      return deps.channelActions.apply(String(b.id || ''));
    },
    'POST /channel-actions/acknowledge': async (req) => {
      const b = await readJson(req);
      if (b.confirmed !== true) throw bad('請先人工核對 Discord 結果');
      return deps.channelActions.acknowledge(String(b.id || ''));
    },
    'GET /member-names': async () => ({ ok: true, ...deps.memberNames?.status() }),
    // 設定介面挑選使用者 ID 用：來自本機聊天快取，只有 ID、顯示名稱與最後發言時間。
    'GET /recent-authors': async () => ({ ok: true, authors: getHistory().recentAuthors(60) }),
    // 設定介面把已儲存的 ID 顯示成名稱：只查本機聊天快取與已連線帳號自己的身分，不向 Discord 查詢。
    'POST /names': async (req) => {
      const b = await readJson(req),
        ids = Array.isArray(b.ids) ? b.ids.slice(0, 500).map(String) : [],
        names = getHistory().knownNames(ids),
        status = getManager().status();
      for (const kind of ['user', 'bot']) {
        const u = status?.[kind]?.user;
        if (u?.id && ids.includes(String(u.id))) names[String(u.id)] ||= u.tag || u.username || '';
      }
      return { ok: true, names };
    },
    'GET /meme-images': async () => ({ ok: true, ...deps.memeImages?.catalog() }),
    'GET /memory-maintenance': async () => ({ ok: true, ...deps.memoryMaintenance?.status() }),
    'POST /memory-maintenance/preview': async (req) => {
      if (!deps.memoryMaintenance) throw bad('記憶維護未載入', 409);
      return deps.memoryMaintenance.preview(await readJson(req));
    },
    'POST /memory-maintenance/apply': async (req) => {
      const b = await readJson(req);
      if (b.confirmed !== true) throw bad('請先核對預覽並明確確認');
      return deps.memoryMaintenance.apply(String(b.id || ''));
    },
    'GET /memory-output': async () => ({ ok: true, memoryOutput: deps.memoryOutput?.status() || null }),
    'GET /memory-output/read': async (req) => {
      if (!deps.memoryOutput) throw bad('記憶輸出服務尚未就緒', 409);
      const q = queryOf(req);
      return { ok: true, ...(await deps.memoryOutput.read(q.id, q.format || 'markdown')) };
    },
    'POST /memory-output/export': async (req) => {
      if (!deps.memoryOutput) throw bad('記憶輸出服務尚未就緒', 409);
      const b = await readJson(req);
      return {
        ...(await deps.memoryOutput.exportDay(String(b.date || ''), { force: b.force === true })),
        memoryOutput: deps.memoryOutput.status(),
      };
    },

    'GET /sessions': async () => ({ ok: true, sessions: deps.sessionBridge?.list() || [] }),
    'POST /sessions/reset': async (req) => {
      const { key } = await readJson(req);
      if (!deps.sessionBridge?.bindings[key])
        return { status: 400, body: { ok: false, error: '找不到會話綁定' } };
      await deps.sessionBridge.reset(key);
      return { ok: true };
    },
    'POST /sessions/bind': async (req) => {
      const { key, sessionId, cwd, useAccountWorkspace } = await readJson(req);
      if (!deps.sessionBridge) return { ok: false, error: 'DSH 會話服務未就緒' };
      const result = await deps.sessionBridge.bind(String(key || ''), {
        sessionId: sessionId ? String(sessionId) : undefined,
        useAccountWorkspace: useAccountWorkspace === true,
        cwd,
      });
      return { ok: true, ...result };
    },
    'POST /test-session': async (req) => {
      const body = await readJson(req),
        { transport, error } = resolveTransport(body.transport || 'auto');
      if (!transport) return { status: 400, body: { ok: false, error } };
      if (!deps.sessionBridge) return { ok: false, error: 'DSH 會話服務未就緒' };
      const message = {
        id: 'diagnostic',
        channelId: `diagnostic-${String(body.key || 'test')
          .replace(/[^a-z0-9-]/gi, '')
          .slice(0, 40)}`,
        isDm: true,
        author: { id: getConfig().adminUserId || 'diagnostic', name: '測試管理者' },
      };
      return deps.sessionBridge.run(message, transport, getConfig(), {
        system: '這是 Discord 會話相容性診斷；沿用 DSH 目前人格，不使用工具。',
        user: String(body.text || '請簡短自我介紹。').slice(0, 2000),
        maxTokens: 3200,
        temperature: 0,
      });
    },
    'GET /schema': async () => ({ ok: true, schema: describeSchema(getConfig()) }),
    'GET /config': async () => ({
      ok: true,
      config: publicConfig(getConfig()),
      schema: describeSchema(getConfig()),
    }),
    'POST /config': async (req) => {
      const patch = await readJson(req);
      const result = await setConfig(patch, { source: 'ui' });
      if (!result.ok) return { status: 400, body: { ok: false, error: result.error } };
      return {
        ok: true,
        config: publicConfig(getConfig()),
        changed: result.changed || [],
        restarted: result.restarted || [],
        live: result.live || [],
        liveResults: result.liveResults || {},
      };
    },
    // 設定復原：列出最近幾次儲存改了什麼；復原是把那一次改動的欄位設回改之前的值（機密欄位不在其中）。
    'GET /config/history': async () => ({ ok: true, entries: deps.configHistory?.list() || [] }),
    'POST /config/undo': async (req) => {
      const body = await readJson(req);
      if (!deps.configHistory) throw bad('設定紀錄未載入', 409);
      const result = await setConfig(deps.configHistory.undoPatch(String(body.id || '')), { source: 'undo' });
      if (!result.ok) return { status: 400, body: { ok: false, error: result.error } };
      return {
        ok: true,
        config: publicConfig(getConfig()),
        changed: result.changed || [],
        restarted: result.restarted || [],
      };
    },
    // 設定匯出／匯入：一律不含 Token 與金鑰。匯入先回預覽，帶 confirmed 才套用。
    'GET /config/export': async (req) => ({
      ok: true,
      export: exportConfig(getConfig(), {
        share: new URL(req.url, 'http://local').searchParams.get('share') === '1',
      }),
    }),
    'POST /config/import': async (req) => {
      const body = await readJson(req);
      const { patch, ignored } = importPatch(body.payload, getConfig());
      const current = getConfig();
      const changes = Object.entries(patch).map(([key, to]) => ({ key, from: current[key], to }));
      if (body.confirmed !== true) return { ok: true, preview: true, changes, ignored };
      if (!changes.length)
        return { ok: true, applied: 0, changes: [], ignored, config: publicConfig(current) };
      const result = await setConfig(patch, { source: 'import' });
      if (!result.ok) return { status: 400, body: { ok: false, error: result.error } };
      return {
        ok: true,
        applied: (result.changed || []).length,
        changes,
        ignored,
        restarted: result.restarted || [],
        config: publicConfig(getConfig()),
      };
    },
    'GET /status': async () => {
      const manager = getManager();
      const history = getHistory();
      return {
        ok: true,
        status: manager.status(),
        config: publicConfig(getConfig()),
        dailyStats: getLedger().getDailyStats(),
        history: history.stats(),
        channels: history.listChannels().slice(0, 60),
        logs: getLogger().recent(30),
        providers: listHostProviders(ctx),
        sessions: deps.sessionBridge?.list() || [],
        memoryOutput: deps.memoryOutput?.status() || null,
        culture: deps.culture?.status() || null,
      };
    },
    'POST /login': async (req) => {
      const body = await readJson(req);
      const kind = body.transport === 'bot' ? 'bot' : 'user';
      const config = getConfig();
      const next = { ...config };
      if (typeof body.token === 'string' && body.token.trim()) {
        next[kind === 'bot' ? 'botToken' : 'userToken'] = body.token.trim();
      }
      const manager = getManager();
      manager.configure(next);
      const result = await manager.start(kind, next);
      if (!result.ok) {
        getLogger().warn('api.login', `${kind} 登入失敗`, { error: result.error });
        return { status: 400, body: { ok: false, error: result.error } };
      }
      getLogger().info('api.login', result.pending ? '等待 Python Gateway 登入完成' : `${kind} 登入成功`, {
        userId: result.user?.id,
      });
      try {
        await setConfig(
          { [kind === 'bot' ? 'botToken' : 'userToken']: next[kind === 'bot' ? 'botToken' : 'userToken'] },
          { source: 'login', silent: true, skipRestart: true },
        );
      } catch {
        await Promise.resolve(manager.stop?.(kind)).catch(() => {});
        manager.configure(config);
        throw Error('憑證未能安全保存，已停止這次登入；原設定保留，請稍後重試');
      }
      return {
        ok: true,
        pending: Boolean(result.pending),
        transport: kind,
        user: result.user,
        status: manager.status(),
      };
    },
    'POST /logout': async (req) => {
      const body = await readJson(req);
      const kind = body.transport === 'bot' ? 'bot' : 'user';
      const result = await getManager().stop(kind);
      return { ok: result.ok, status: getManager().status(), error: result.error };
    },
    'GET /guilds': async (req) => {
      const { transport, error } = resolveTransport(queryOf(req).transport);
      if (error) return noTransport(error);
      const result = await transport.getGuilds();
      return result.ok
        ? { ok: true, transport: transport.kind, guilds: result.guilds }
        : noTransport(result.error);
    },
    // 表情選擇器：列出某個伺服器的自訂表情。
    'GET /emojis': async (req) => {
      const query = queryOf(req);
      const { transport, error } = resolveTransport(query.transport);
      if (error) return noTransport(error);
      if (typeof transport.getEmojis !== 'function') return noTransport('這個帳號不支援列出表情');
      const result = await transport.getEmojis(query.guildId || '');
      return result.ok
        ? { ok: true, transport: transport.kind, emojis: result.emojis || [] }
        : noTransport(result.error);
    },
    'GET /channels': async (req) => {
      const query = queryOf(req);
      const { transport, error } = resolveTransport(query.transport);
      if (error) return noTransport(error);
      const result = await transport.getChannels(query.guildId || undefined, { includeVoice: query.includeVoice === '1' });
      return result.ok
        ? { ok: true, transport: transport.kind, channels: result.channels }
        : noTransport(result.error);
    },
    'GET /dms': async (req) => {
      const { transport, error } = resolveTransport(queryOf(req).transport);
      if (error) return noTransport(error);
      const result = await transport.getDMs();
      return result.ok ? { ok: true, transport: transport.kind, dms: result.dms } : noTransport(result.error);
    },
    'GET /stickers': async (req) => {
      const query = queryOf(req);
      const { transport, error } = resolveTransport(query.transport);
      if (error) return noTransport(error);
      const result = await transport.searchStickers(query.q || '', { channelId: query.channelId });
      return result.ok
        ? {
            ok: true,
            transport: transport.kind,
            stickers: result.stickers,
            warning: result.warning,
            note: result.note,
          }
        : noTransport(result.error);
    },
    'GET /messages': async (req) => {
      const query = queryOf(req);
      const { transport, error } = resolveTransport(query.transport);
      if (error) return noTransport(error);
      const result = await transport.getMessages(query.channelId, Number(query.limit) || 20);
      return result.ok
        ? { ok: true, transport: transport.kind, messages: result.messages }
        : noTransport(result.error);
    },
    'POST /send': async (req) => {
      const body = await readJson(req);
      const config = getConfig();
      const { transport, error } = resolveTransport(body.transport);
      if (error) return noTransport(error);
      const type = body.type || 'text';
      const options = {
        content: String(body.content || ''),
        replyToMessageId: body.replyToMessageId ? String(body.replyToMessageId) : undefined,
        mention: body.mention === true,
        simulateTyping: config.simulateTyping !== false,
      };
      if (type === 'image' || type === 'file') {
        const target = String(body.imagePath || body.filePath || body.content || '').trim();
        if (/^https?:\/\//i.test(target)) options.fileUrls = [target];
        else options.files = [target];
        options.content = String(body.caption || '');
      } else if (type === 'sticker') {
        options.stickerIds = [String(body.stickerId || '').trim()].filter(Boolean);
        options.content = '';
      } else if (type === 'reaction') {
        const messageId = String(body.messageId || body.replyToMessageId || '').trim();
        const emoji = String(body.emoji || body.content || '').trim();
        if (!messageId || !emoji)
          return { status: 400, body: { ok: false, error: '需要 messageId 與 emoji' } };
        const reaction = await transport.sendReaction(String(body.channelId || ''), messageId, emoji);
        if (!reaction.ok) return { status: 400, body: { ok: false, error: reaction.error } };
        getLogger().info('api.reaction', '由 UI 加入表情', {
          transport: transport.kind,
          channelId: body.channelId,
          emoji,
        });
        return { ok: true, transport: transport.kind, added: true, emoji };
      }
      const result = await transport.sendMessage(String(body.channelId || ''), options);
      if (!result.ok) return { status: 400, body: { ok: false, error: result.error } };
      if (transport.kind === 'user' && body.replyToMessageId)
        await deps.inbox?.resolve(String(body.replyToMessageId), 'manual-reply', result.messageId);
      getLogger().info('api.send', '由 UI 送出訊息', {
        transport: transport.kind,
        channelId: body.channelId,
        type,
        chars: options.content?.length || 0,
      });
      return { ok: true, transport: transport.kind, ...result };
    },
    'GET /logs': async (req) => {
      const query = queryOf(req);
      const limit = Math.max(1, Math.min(300, Number(query.limit) || 50));
      return { ok: true, logs: getLogger().recent(limit) };
    },
    'POST /logs/clear': async () => {
      getLogger().clear();
      return { ok: true, logs: [] };
    },
    'GET /history': async (req) => {
      const query = queryOf(req);
      const history = getHistory();
      const limit = Math.max(1, Math.min(200, Number(query.limit) || 40));
      if (query.channelId) return { ok: true, messages: history.recent(query.channelId, limit) };
      return { ok: true, channels: history.listChannels().slice(0, 80), stats: history.stats() };
    },
    'POST /history/clear': async (req) => {
      const body = await readJson(req);
      const history = getHistory();
      if (body.channelId) history.clear(String(body.channelId));
      else if (body.confirmed !== true)
        return { status: 400, body: { ok: false, error: '清除全部聊天快取前請先明確確認' } };
      else history.clear();
      return { ok: true, stats: history.stats() };
    },
    'GET /gif': async (req) => {
      const query = queryOf(req);
      const { transport } = resolveTransport(query.transport || 'auto');
      const result = await searchGifs(
        { ...getConfig(), gifMaxResults: Number(query.limit) || 8 },
        query.q || '',
        { transport },
      );
      return result.ok
        ? { ok: true, results: result.results }
        : { status: 400, body: { ok: false, error: result.error } };
    },
    'GET /llm-providers': async () => ({ ok: true, providers: listHostProviders(ctx) }),
    'POST /probe-token': async (req) => {
      // 只打 GET /users/@me 驗證 Token 本身，不建立 Gateway 連線，
      // 檢查當下 REST 認證結果；不代表 Gateway 或後續操作一定成功。
      const body = await readJson(req);
      const kind = String(body.transport || 'user') === 'bot' ? 'bot' : 'user';
      const config = getConfig();
      const token = String(body.token || (kind === 'bot' ? config.botToken : config.userToken) || '').trim();
      if (!token) return { status: 400, body: { ok: false, error: '尚未填寫 Token' } };
      const check = await checkDiscordToken(token, { kind });
      const { valid, status } = check;
      // 指紋讓我們能分辨「剛貼上的 Token」與「設定裡存的那把」是不是同一把，
      // 又不會把 Token 本身寫進日誌。
      const fingerprint = tokenFingerprint(token);
      const result = {
        ...check,
        ok: valid === true,
        transport: kind,
        fingerprint,
        user: check.user || null,
        hint:
          valid === true
            ? '此結果只代表當下 REST 認證成功，不保證 Gateway 連線或長期有效。'
            : valid === false
              ? '此憑證目前被拒絕；僅憑此結果無法判定是輸入錯誤、過期或撤銷。'
              : '驗證結果不確定，請先檢查網路或稍後重試，不要據此判定 Token 已失效。',
      };
      getLogger()?.[valid === true ? 'info' : 'warn']('api.probeToken', tokenCheckSummary(check), {
        transport: kind,
        status,
        outcome: check.outcome,
        error: result.error,
        fingerprint,
      });
      return result;
    },
    'POST /test-llm': async () => {
      const result = await testLlm(ctx, getConfig());
      getLogger()[result.ok ? 'info' : 'warn']('api.testLlm', result.ok ? '模型連線正常' : '模型連線失敗', {
        ms: result.ms,
        error: result.error,
      });
      return { ok: result.ok, result };
    },
    // Diagnostic only: never sends a Discord message or changes connection settings.
    'POST /test-media': async (req) => {
      const body = await readJson(req);
      const url = mediaUrl(String(body.url || ''));
      if (!url)
        return { status: 400, body: { ok: false, error: '請提供支援圖庫或 Discord CDN 的 HTTPS 圖片網址' } };
      const controller = new AbortController();
      const abort = () => controller.abort();
      req.once('aborted', abort);
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(90000)]);
      try {
        if (body.cache === true && deps.culture) {
          const { transport } = resolveTransport('auto');
          const message = {
            id: 'diagnostic-media',
            channelId: 'media-verification',
            isDm: true,
            author: { id: getConfig().adminUserId || 'diagnostic' },
            content: url,
          };
          const media = await deps.culture.prepare(
            message,
            transport || {},
            getConfig(),
            signal,
            prepareGif,
            { refreshUrls: transport?.refreshAttachmentUrls?.bind(transport) },
          );
          return {
            ok: !!media.observations?.length,
            observations: media.observations || [],
            framesSentToReply: media.images.length,
            error: media.error || null,
            culture: deps.culture.status(),
          };
        }
        const media = await prepareGif({ content: url }, getConfig(), signal);
        if (!media.images.length) return { ok: false, error: media.error || '沒有啟用此媒體的辨識' };
        const result = await generateReply(ctx, getConfig(), {
          signal,
          images: media.images,
          system:
            '這是圖片辨識測試。用繁體中文簡短描述實際提供的畫面；依時間順序理解動畫抽樣，不要猜測看不見的部分。',
          user: `請描述這些媒體畫格。來源共有 ${media.totalFrames} 格，本次取樣 ${media.images.length} 格。`,
          maxTokens: 240,
          temperature: 0,
        });
        const summary = {
          ok: result.ok,
          framesExtracted: media.images.length,
          framesSent: result.imagesSent || 0,
          provider: result.provider,
          model: result.model,
          visionWarning: result.visionWarning,
          text: result.ok ? result.text : undefined,
          error: result.error,
        };
        getLogger()[result.ok ? 'info' : 'warn']('api.testMedia', '媒體辨識測試（不發 Discord 訊息）', {
          frames: summary.framesSent,
          provider: summary.provider,
          model: summary.model,
          code: summary.visionWarning,
        });
        return summary;
      } finally {
        req.removeListener('aborted', abort);
      }
    },
    'POST /test-reply': async (req) => {
      const body = await readJson(req);
      const text = String(body.text || '請說一句話證明你在線上。').slice(0, 500);
      const result = await testLlm(ctx, getConfig());
      return { ok: result.ok, sample: result.text, error: result.error, prompt: truncate(text, 200) };
    },
    'GET /presence': async (req) => {
      const current = await getManager().byKind.user.getPresence(queryOf(req).refresh === '1');
      return { ok: !!current.ok, current, ...(!current.ok ? { error: current.error } : {}) };
    },
    'POST /presence': async (req) => {
      const body = await readJson(req),
        target = body.transport || 'user';
      if (!['user', 'bot', 'both'].includes(target))
        return { status: 400, body: { ok: false, error: '請指定 user、bot 或 both' } };
      const manager = getManager(),
        results = {};
      const explicit = [
        'status',
        'activityType',
        'activityText',
        'customStatusText',
        'customStatusEmoji',
      ].some((k) => k in body);
      let presence;
      try {
        presence = validatePresence(explicit ? body : target === 'bot' ? {} : userPresence(getConfig()));
      } catch (e) {
        return { status: 400, body: { ok: false, error: e.message } };
      }
      if (target === 'user' || target === 'both') {
        if (!explicit && !getConfig().userPresenceEnabled)
          results.user = { ok: false, error: '尚未啟用由插件管理帳號外觀' };
        else
          try {
            results.user = await manager.byKind.user.applyPresence(presence);
          } catch (e) {
            results.user = { ok: false, error: e.message };
          }
      }
      if (target === 'bot' || target === 'both') {
        const bot = manager.byKind.bot;
        if (!bot?.ready) results.bot = { ok: false, error: 'Bot 尚未連線' };
        else if (body.customStatusText !== undefined || body.customStatusEmoji !== undefined)
          results.bot = { ok: false, error: 'Bot 介面不支援自訂狀態文字與表情' };
        else
          try {
            // Direct application changes this transport only; persistence uses /config.
            if (body.activityText !== undefined || body.activityType !== undefined)
              bot.config = {
                ...getConfig(),
                botActivityText:
                  presence.activityType === 'none' ? '' : (body.activityText ?? getConfig().botActivityText),
                botActivityType:
                  body.activityType === 'none'
                    ? getConfig().botActivityType
                    : (body.activityType ?? getConfig().botActivityType),
              };
            results.bot = await bot.setActivity(body.status);
          } catch (e) {
            results.bot = { ok: false, error: e.message };
          }
      }
      const ok = Object.values(results).every((r) => r?.ok === true);
      return { ok, results, ...(!ok ? { error: '部分或全部帳號未能套用外觀；請查看各帳號結果' } : {}) };
    },
    'POST /stats/reset': async () => {
      getLedger().reset?.();
      return { ok: true, dailyStats: getLedger().getDailyStats() };
    },
    'GET /schema-only': async () => ({ ok: true, schema: describeSchema() }),
    'POST /simulate': async (req) => {
      if (typeof simulateInbound !== 'function') return { ok: false, error: '這個版本沒有模擬功能' };
      const body = await readJson(req);
      try {
        const result = await simulateInbound(body);
        getLogger().info('api.simulate', '模擬訊息已處理', {
          channelId: body.channelId,
          replied: result.replied,
          kind: result.result?.kind,
        });
        return {
          ok: true,
          replied: result.replied,
          result: result.result,
          message: result.message,
          event: result.event,
        };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    },
  };

  return async function handler(req, res) {
    const rejection = await managementRejection(req, ctx);
    if (rejection)
      return sendJson(res, rejection, {
        ok: false,
        error: {
          401: '請先登入 DSH',
          403: '不允許此請求來源',
          415: '此操作需要 application/json',
          503: 'DSH 驗證服務尚未就緒',
        }[rejection],
      });
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    // 改名前的路徑 /api/discord-pyself-lab 仍然接受，既有的腳本與書籤不會失效。
    const prefix = [API_PREFIX, LEGACY_API_PREFIX].find((item) => url.pathname.startsWith(item)) || '';
    let path = url.pathname.slice(prefix.length);
    if (!path.startsWith('/')) path = `/${path}`;
    const key = `${req.method || 'GET'} ${path}`;
    const route = routes[key];
    if (!route) {
      const allowed = Object.keys(routes)
        .filter((entry) => entry.endsWith(` ${path}`))
        .map((entry) => entry.split(' ')[0]);
      if (allowed.length) {
        sendJson(res, 405, { ok: false, error: `不支援的方法，請使用 ${allowed.join(' / ')}` });
        return;
      }
      sendJson(res, 404, { ok: false, error: `找不到端點 ${path}` });
      return;
    }
    try {
      const result = await route(req, res);
      if (result && typeof result === 'object' && 'status' in result && 'body' in result) {
        sendJson(res, result.status, redactDiagnosticPayload(result.body, secretValues()));
      } else {
        sendJson(res, 200, redactDiagnosticPayload(result, secretValues()));
      }
    } catch (error) {
      const status =
        Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
      if (status >= 500)
        getLogger().error('api.error', '處理 API 請求時發生錯誤', { path, error: error.message });
      else getLogger().warn?.('api.rejected', '請求未被接受', { path, status, error: error.message });
      sendJson(res, status, {
        ok: false,
        error: truncate(redactDiagnostic(error.message, secretValues()), 400),
      });
    }
  };
}
