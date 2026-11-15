import { observeCapability } from '../capability-diagnostics.js';
import { allowedReplyTools } from '../security.js';
import { accessReason } from '../features/message-policy.js';
import { createSongJobs } from './pipeline.js';
const stages = [
  'video_info',
  'video_download',
  'cover_doctor',
  'cover_separate',
  'cover_shift',
  'cover_convert',
  'cover_mix',
  'cover_verify',
];
export function createSongWorkflow({ ctx, delivery, getConfig, scopeFor, builtinTools = {}, searchSongs }) {
  const registry = () => ctx.get?.('tools') || ctx.tools;
  // 下載階段：別的插件有註冊同名工具就用它，否則用插件內建的（src/ytdlp/video-tools.js）。
  const resolve = (name) => registry()?.get?.(name) || builtinTools[name];
  const enabled = () =>
    !!(getConfig().singingEnabled || getConfig().singingAdminGroupEnabled || getConfig().singingAllowedUserIds?.length);
  let doctorBusy = false;
  const doctor = async () => {
    if (doctorBusy) throw Error('正在檢查翻唱環境，請稍候');
    const definition = registry()?.get?.('cover_doctor');
    if (!definition) throw Error('請先載入 cover-pipeline');
    doctorBusy = true;
    let timer;
    try {
      const value = await Promise.race([
        observeCapability(
          ctx,
          'singing.cover',
          'environment-check',
          () => definition.execute({}, { signal: AbortSignal.timeout(30000) }),
          {
            outcome: (r) => (r?.ok === false ? 'failed' : 'unconfirmed'),
            failure: () => ({ diagnosticCode: 'SETUP' }),
          },
        ),
        new Promise(
          (_, reject) => (timer = setTimeout(() => reject(Error('環境檢查逾時，請到翻唱插件核對')), 30000)),
        ),
      ]);
      return {
        ready: value.ok === true,
        checks: Array.isArray(value.checks) ? value.checks.slice(0, 100) : [],
        inferenceVerified: false,
      };
    } finally {
      clearTimeout(timer);
      doctorBusy = false;
    }
  };
  // Deliberate high-level capability: only these fixed stages and pipeline-built
  // arguments are delegated. The model never receives unrestricted stage tools.
  const tools = {
    executable: (name) => (stages.includes(name) ? resolve(name) : undefined),
    execute: async ({ agent, signal, calls }) => {
      if (
        !getConfig().singingEnabled &&
        !getConfig().singingAdminGroupEnabled &&
        !getConfig().singingAllowedUserIds?.length
      )
        throw Error('唱歌工作已停用');
      if (calls.length !== 1 || !stages.includes(calls[0].name)) throw Error('未知歌曲階段');
      const call = calls[0],
        definition = resolve(call.name);
      if (!definition) throw Error('歌曲插件工具已卸載');
      signal.throwIfAborted();
      const value = await observeCapability(
        ctx,
        call.name.startsWith('video_') ? 'singing.download' : 'singing.cover',
        call.name,
        () =>
          definition.execute(JSON.parse(call.arguments), {
            agent,
            ctx: agent.ctx,
            logger: agent.ctx?.logger,
            signal,
          }),
        {
          outcome: (r) =>
            r?.ok === false || (r?.phase === 'executed' && r?.artifactsOk === false)
              ? 'failed'
              : r?.phase === 'executed' && r?.artifactsOk === true
                ? 'passed'
                : 'unconfirmed',
        },
      );
      return { results: [{ result: { isError: false, value } }] };
    },
  };
  const grants = new WeakMap();
  const authorize = (grant) => {
    if (
      !grant ||
      !allowedReplyTools(getConfig(), grant.message, grant.actorId).includes('song_cover_create') ||
      accessReason(grant.message, getConfig())
    )
      throw Error('此使用者／頻道未獲唱歌授權，或授權已撤回');
  };
  const scoped = {
    ...delivery,
    capture(agent, mode) {
      const source = scopeFor?.(agent);
      const grant = source && {
        actorId: source.actorId,
        message: {
          isDm: source.message.isDm,
          isGroupDm: source.message.isGroupDm,
          channelId: source.message.channelId,
          guildId: source.message.guildId,
          author: { id: source.actorId },
        },
      };
      authorize(grant);
      const cap = delivery.capture(agent, mode);
      grants.set(cap, grant);
      return cap;
    },
    check(cap) {
      authorize(grants.get(cap));
      return delivery.check(cap);
    },
    inspect(cap, ...args) {
      this.check(cap);
      return delivery.inspect(cap, ...args);
    },
    deliver(cap, ...args) {
      this.check(cap);
      return delivery.deliver(cap, ...args);
    },
  };
  const jobs = createSongJobs({ tools, delivery: scoped });
  const execution = (e) => {
    const source = scopeFor?.(e.agent);
    if (!source) throw Error('需要 Discord 的目前操作者上下文');
    return { ...e, discordActorId: source.actorId, discordAdmin: source.actorId === getConfig().adminUserId };
  };
  const definitions = [
    {
      name: 'song_cover_create',
      description:
        '建立目前 Discord 正式會話的翻唱工作。先以 preview 試唱；只有使用者明確聽過同參數試唱並同意後才能用 full。URL 為可使用的公開歌曲音源；queued 不是已唱完。',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          voice: { type: 'string' },
          key: { type: 'integer' },
          destination: { type: 'string', enum: ['attachment', 'voice-room'] },
          mode: { type: 'string', enum: ['preview', 'full'] },
          approvedPreviewId: { type: 'string' },
          approveFull: { type: 'boolean' },
        },
        required: ['url'],
      },
      execute: (a, e) => {
        if (
          !getConfig().singingEnabled &&
          !getConfig().singingAdminGroupEnabled &&
          !getConfig().singingAllowedUserIds?.length
        )
          throw Error('請先在唱歌與翻唱分區啟用');
        return jobs.start(a, execution(e));
      },
    },
  ];
  if (searchSongs)
    definitions.push({
      name: 'song_cover_search',
      description:
        '用歌名或歌手在 YouTube 找可翻唱的歌，回傳最多五筆候選（標題、上傳者、網址）。只搜尋、不下載。請先讓使用者確認是哪一首，再把該筆的網址交給 song_cover_create。',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      execute: async (a, e) => {
        if (!enabled()) throw Error('請先在唱歌與翻唱分區啟用');
        execution(e);
        const rows = await searchSongs(String(a.query || ''), { signal: e.signal });
        return {
          ok: true,
          candidates: rows.map((row) => ({
            title: row.title,
            uploader: row.artist || '',
            url: 'https://www.youtube.com/watch?v=' + row.id,
          })),
        };
      },
    });
  for (const action of ['status', 'cancel', 'forget'])
    definitions.push({
      name: 'song_cover_' + action,
      description: {
        status: '查看本會話歌曲工作狀態；不代表已通過聽感驗收',
        cancel: '取消本會話歌曲工作，不再交付',
        forget: '清理本會話已結束歌曲工作；工作仍執行時不能清理',
      }[action],
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      execute: (a, e) => jobs[action](a.id, execution(e)),
    });
  return {
    definitions,
    jobs,
    doctor,
    status: () => ({
      integrated: true,
      workTools: definitions.map((d) => ({
        name: d.name,
        registered: registry()?.get?.(d.name)?.execute === d.execute,
      })),
      enabled: !!(
        getConfig().singingEnabled ||
        getConfig().singingAdminGroupEnabled ||
        getConfig().singingAllowedUserIds?.length
      ),
      adminDmEnabled: !!getConfig().singingEnabled,
      adminGroupEnabled: !!getConfig().singingAdminGroupEnabled,
      tools: stages.map((name) => ({
        name,
        registered: !!resolve(name),
        builtin: !registry()?.get?.(name) && !!builtinTools[name],
      })),
      engineVerified: false,
      engineNote: '工具已載入不等於推理引擎與音色已配置；請在 cover-pipeline 執行環境診斷。',
      jobs: jobs.summary(),
    }),
    close: () => jobs.close(),
  };
}
