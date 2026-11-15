import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { knowledgeCatalog } from './knowledge-tools.js';
import { MEMORY_SYSTEMS } from './memory-connectors.js';

const get = (ctx, key) => {
  try {
    return ctx.get?.(key) || ctx[key];
  } catch {
    return null;
  }
};
const safely = (fn, fallback) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const safeId = (value) =>
  String(value || '')
    .slice(0, 180)
    .replace(/[^a-zA-Z0-9_@./:-]/g, '_');
const safeLabel = (value) =>
  String(value || '')
    .slice(0, 100)
    .replace(/https?:\/\/\S+|\b(?:sk-|mfa\.)\S+|Bearer\s+\S+/gi, '〔已隱藏〕');
const toolFor = (ctx, name) => {
  try {
    return get(ctx, 'tools')?.get?.(name);
  } catch {
    return null;
  }
};
const deadline = async (work) => {
  let timer;
  try {
    return await Promise.race([
      work,
      new Promise((_, reject) => (timer = setTimeout(() => reject(Error('timeout')), 2000))),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

// Only controlled summaries escape this classifier. Raw provider errors may
// include credentials, prompts, transcripts or URLs and are never retained.
const ISSUES = {
  AUTH: ['金鑰或授權被拒絕', '到原服務檢查金鑰、地域與帳號；確認後再手動重試。'],
  PERMISSION: ['缺少所需權限', '到原服務開啟對應 API 權限，或檢查頻道／工具授權。'],
  QUOTA: ['額度或預算不足', '檢查本插件預算與服務商餘額；不要立即反覆重試。'],
  RATE_LIMIT: ['服務要求降低頻率', '等待原服務的限制解除，再手動重試。'],
  TIMEOUT: ['等待服務逾時', '檢查原服務及網路；寫入或交付請先核對結果，避免重複操作。'],
  OFFLINE: ['服務接口無法使用', '確認原插件已載入、接口位址與版本正確，再更新能力狀態。'],
  UNAVAILABLE: ['服務暫時無法使用', '檢查原服務狀態；若為寫入或交付，先核對結果再手動重試。'],
  SETUP: ['設定或模型尚未就緒', '在原插件完成金鑰、模型、音色或後端設定；安裝不代表已就緒。'],
  UNSUPPORTED: ['此接口未宣告所需能力', '選擇可回傳音訊／所需操作的接口，或請原插件提供能力契約。'],
  SCOPE: ['目前對話沒有授權或綁定', '檢查對象授權、允許名單與 DSH 會話／工作區綁定。'],
  CANCELLED: ['工作已取消', '確認是否由停止、插話、設定變更或離線取消；不自動重送。'],
  UNCERTAIN: ['結果未確認', '先到原服務或目的地核對；不要直接重送可能已完成的工作。'],
  INVALID: ['回傳格式或成品未通過檢查', '查看原插件診斷及接口版本；不要將預演或一般文字當成可交付成品。'],
  UNKNOWN: ['尚無法確認失敗原因', '到原插件查看受保護的詳細紀錄；此頁不複製原始錯誤或私人正文。'],
};
export function diagnoseCapabilityFailure(error) {
  const text = String(error?.message || error?.error || error?.code || error || '');
  const status =
    Number(error?.status || error?.statusCode) || Number(/(?:HTTP[_ :]*|status\D*)(\d{3})/i.exec(text)?.[1]);
  let code = Object.hasOwn(ISSUES, error?.diagnosticCode)
    ? error.diagnosticCode
    : /uncertain|結果.*(?:不明|未確認)|待確認/i.test(text)
      ? 'UNCERTAIN'
      : /models_read|voices_read|permission|forbidden|access.?denied|insufficient.?scope|權限|权限/i.test(
            text,
          ) || status === 403
        ? 'PERMISSION'
        : status === 401 ||
            /api.?key|unauthori[sz]ed|unauthenticated|credential|signature|金鑰|金钥|憑證|凭证/i.test(text)
          ? 'AUTH'
          : status === 402 || /quota|budget|額度|额度|預算|余额/i.test(text)
            ? 'QUOTA'
            : status === 429 || /rate.?limit/i.test(text)
              ? 'RATE_LIMIT'
              : /timeout|timed out|逾時|超時|超时/i.test(text)
                ? 'TIMEOUT'
                : /cancel|abort|取消|中止|插話|插话|已停止|已離開/i.test(text)
                  ? 'CANCELLED'
                  : /scope|workspace|binding|授權|授权|綁定|绑定|越界/i.test(text)
                    ? 'SCOPE'
                    : /unsupported|不支援|不支持|未宣告|沒有回傳可交付音訊/i.test(text)
                      ? 'UNSUPPORTED'
                      : status === 404 ||
                          /ECONN|ENOTFOUND|fetch failed|offline|卸載|卸载|未註冊|未注册|斷線|断线/i.test(text)
                        ? 'OFFLINE'
                        : status >= 500
                          ? 'UNAVAILABLE'
                          : /未就緒|未就绪|未設定|未设置|missing|unprepared|未配置/i.test(text)
                            ? 'SETUP'
                            : status === 400 || /invalid|格式|成品|驗證|验证|不完整|truncat/i.test(text)
                              ? 'INVALID'
                              : 'UNKNOWN';
  return {
    code,
    summary: ISSUES[code][0],
    fix: ISSUES[code][1],
    retry: code === 'UNCERTAIN' ? 'verify-first' : code === 'CANCELLED' ? 'manual-only' : 'after-fix',
    ...(Number.isInteger(status) && status >= 400 && status <= 599 ? { httpStatus: status } : {}),
    ...(/models_read/.test(text)
      ? { permission: 'models_read' }
      : /voices_read/.test(text)
        ? { permission: 'voices_read' }
        : {}),
  };
}

const MEMORY_PACKAGES = {
  memu: ['dsh-memu-memory'],
  meow: ['meow-memory'],
  fish: ['dsh-feiyu-memory'],
  prime: ['dsh-prime-memory'],
  mnemon: ['dsh-mnemon'],
  lingshu: ['@furongjun1999/dsh-memory'],
  openviking: ['@openviking/dsh-memory-plugin'],
  hindsight: ['@vectorize-io/hindsight-coding-agents'],
  soul: ['dsh-soul-md'],
};
const feature = (id, label, supported) => ({ id, label, supported });

export class CapabilityDiagnostics {
  constructor({
    ctx,
    getConfig,
    voice,
    diaryAgent,
    musicProviders,
    moodAdapter,
    companion,
    now = Date.now,
    simulation = false,
    baselineUrl = new URL('./capability-baseline.json', import.meta.url),
  } = {}) {
    Object.assign(this, {
      ctx,
      getConfig,
      voice,
      diaryAgent,
      musicProviders,
      moodAdapter,
      companion,
      now,
      simulation,
      baselineUrl,
    });
    this.records = new Map();
    this.identities = new WeakMap();
    this.counter = 0;
    this.inventory = { bundles: [], plugins: [], known: false };
    this.inFlight = null;
    this.extensions = new Map();
    this.closed = false;
  }
  identity(value) {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) return null;
    if (!this.identities.has(value)) this.identities.set(value, ++this.counter);
    return this.identities.get(value);
  }
  async init() {
    try {
      const baseline = JSON.parse(await readFile(this.baselineUrl, 'utf8'));
      if (
        !Array.isArray(baseline.files) ||
        !baseline.files.length ||
        baseline.files.length > 256 ||
        !Array.isArray(baseline.groups)
      )
        throw Error('invalid baseline');
      const files = [];
      for (const entry of baseline.files) {
        const url = new URL(entry.path, import.meta.url);
        if (
          !(
            (/^\.\/[a-zA-Z0-9_./-]+$/.test(entry.path) && !entry.path.includes('..')) ||
            /^\.\.\/bridge\/[a-z_]+\.py$/.test(entry.path)
          ) ||
          url.protocol !== 'file:'
        )
          throw Error('invalid baseline');
        files.push({ path: entry.path, hash: hash(await readFile(url, 'utf8')) });
      }
      this.baseline = {
        valid: hash(files) === baseline.digest,
        at: baseline.at,
        groups: baseline.groups || [],
      };
    } catch {
      this.baseline = { valid: false, groups: [] };
    }
  }
  async refreshInventory() {
    const service = get(this.ctx, 'pluginManager');
    if (!service?.listBundles || !service.listPlugins) {
      this.inventory = { bundles: [], plugins: [], known: false };
      return;
    }
    try {
      const [bundles, plugins] = await deadline(Promise.all([service.listBundles(), service.listPlugins()]));
      this.inventory = {
        known: true,
        bundles: Array.isArray(bundles) ? bundles.slice(0, 1000) : [],
        plugins: Array.isArray(plugins) ? plugins.slice(0, 1500) : [],
      };
    } catch {
      this.inventory = { bundles: [], plugins: [], known: false };
    }
  }
  presence(names = []) {
    const bundles = this.inventory.bundles.filter((b) => names.includes(b.name)),
      plugins = this.inventory.plugins.filter((p) => names.includes(p.moduleName));
    const loaded = plugins.some((p) => p.fiberPhase === 'active')
      ? 'yes'
      : plugins.some((p) => p.fiberPhase === 'loading')
        ? 'loading'
        : plugins.length || (bundles.length && bundles.every((b) => b.enabled === false))
          ? 'no'
          : 'unknown';
    return {
      installed:
        loaded === 'yes' || bundles.some((b) => b.installed || b.version)
          ? 'yes'
          : bundles.length
            ? 'no'
            : 'unknown',
      loaded,
      versions: bundles
        .filter((b) => b.version)
        .map((b) => safeLabel(b.version))
        .slice(0, 4),
      inventoryKnown: this.inventory.known,
    };
  }
  descriptors() {
    const c = this.getConfig(),
      rows = [],
      tools = get(this.ctx, 'tools');
    let caps = {},
      speech = { providers: [] };
    try {
      caps = this.voice?.tts?.capabilities?.() || {};
    } catch {}
    try {
      speech = get(this.ctx, 'speechToText')?.snapshot?.() || speech;
    } catch {}
    const add = (id, category, name, options = {}) =>
      rows.push({
        id,
        category,
        name,
        section: options.section || 'advanced',
        packages: [],
        state: 'unknown',
        registered: false,
        features: [],
        ...options,
      });
    const ttsNames =
      caps.serviceId === 'dshTts' || caps.adapter === 'dsh-tts'
        ? // DSH 聲音工坊：改名後的套件名在前，改名前（以及上游）的套件名仍然認得。
          ['dsh-sound-atelier', '@goodandready/dsh-tts']
        : caps.adapter === 'memef1f1y'
          ? ['@memef1f1y/dsh-plugin-tts']
          : [];
    add('tts.selected', 'tts', '目前選用的語音合成', {
      section: 'voice',
      packages: ttsNames,
      registered:
        caps.adapter === 'service'
          ? !!get(this.ctx, caps.serviceId || 'dshTts')?.synthesize
          : !!this.voice?.tts?.snapshot?.base,
      state: caps.engine?.ready ? 'ready' : 'blocked',
      issue: caps.engine?.ready
        ? null
        : diagnoseCapabilityFailure(caps.engine?.unavailableReason || '尚未設定 TTS'),
      detail: '只讀服務回報；尚未合成不代表音色或帳號實測成功。',
      selection: [caps.serviceId || caps.adapter || '未選擇', caps.provider || '']
        .filter(Boolean)
        .map(safeLabel)
        .join(' · '),
      enabled: !!(c.voiceEnabled || c.voiceMessageEnabled),
      token: [
        this.identity(get(this.ctx, caps.serviceId || 'dshTts')),
        this.voice?.tts?.signature?.(),
        c.voiceTtsVoice,
        caps.provider,
        caps.engine?.selection,
      ],
      group: 'tts',
      features: [
        feature('audio', '回傳完整音訊', caps.engine?.ready ? true : null),
        feature('pcm', 'PCM 串流', !!safely(() => this.voice?.tts?.canStream?.(), false)),
        feature('direction', '語氣提示', caps.engine?.speechInstruction ?? null),
      ],
    });
    const ttsPackages = [
      ...new Set(
        [
          ...this.inventory.bundles.map((b) => b.name),
          ...this.inventory.plugins.map((p) => p.moduleName),
        ].filter((n) => typeof n === 'string' && /tts/i.test(n) && !ttsNames.includes(n)),
      ),
    ].slice(0, 40);
    for (const name of ttsPackages)
      add('tts.plugin:' + name, 'tts', name, {
        section: 'voice',
        packages: [name],
        state: 'unknown',
        detail: '宿主清單中的其他 TTS 插件；未據此推定已接入、已選用或可回傳音訊。',
        features: [feature('audio', '音訊交付接口', null)],
      });
    const stt = get(this.ctx, 'speechToText'),
      selected = c.voiceSttProvider || speech.selection?.providerId,
      provider = speech.providers?.find((p) => p.id === selected),
      phase = provider?.preparation?.phase;
    add('stt.selected', 'stt', '目前選用的語音辨識', {
      section: 'voice',
      packages:
        selected === 'external:dsh-voice'
          ? ['@goodandready/dsh-voice']
          : selected === 'sensevoice-local'
            ? [
                '@deepseek-ai/dsh-experimental-speech-to-text-sensevoice',
                '@deepseek-ai/dsh-experimental-voice-input-bundle',
              ]
            : [],
      registered: !!stt?.transcribe,
      state:
        !stt?.transcribe || !provider
          ? 'blocked'
          : selected === 'external:dsh-voice'
            ? 'unknown'
            : ['ready', 'standby'].includes(phase)
              ? 'ready'
              : ['loading', 'waking', 'checking', 'downloading'].includes(phase)
                ? 'preparing'
                : 'blocked',
      selection: safeLabel(provider?.name || selected || '沿用宿主選擇'),
      issue:
        !stt?.transcribe || !provider
          ? diagnoseCapabilityFailure('STT 服務或所選 Provider 未註冊')
          : ['ready', 'standby'].includes(phase)
            ? null
            : diagnoseCapabilityFailure('STT 模型未就緒'),
      detail:
        selected === 'external:dsh-voice'
          ? '橋接已註冊不等於原 dsh-voice 的辨識鏈已就緒；本頁不呼叫原服務。'
          : phase === 'standby'
            ? '模型待命，首次辨識可能需要喚醒。'
            : '讀取模型準備狀態，不送錄音、不呼叫辨識。',
      enabled: !!(c.voiceReceiveEnabled || c.voiceMessageEnabled),
      token: [this.identity(stt), selected, provider?.preparation?.phase],
      group: 'stt',
      features: [
        feature('transcribe', '音訊轉文字', !!stt?.transcribe),
        feature(
          'local',
          '本機處理',
          provider && selected !== 'external:dsh-voice' ? provider.location === 'host-local' : null,
        ),
      ],
    });
    for (const writer of safely(() => this.diaryAgent?.connectors?.(), []) || []) {
      const selected = (c.memoryDiaryWriter || 'memu') === writer.id;
      add('memory.writer:' + writer.id, 'memory', writer.name, {
        section: 'memoryOutput',
        packages: MEMORY_PACKAGES[writer.id] || [],
        registered: !!writer.registered && !!writer.available,
        state: writer.mode === 'tool' ? (writer.available ? 'unknown' : 'blocked') : 'delegated',
        enabled: selected && !!c.memoryDiaryWriteEnabled,
        selection: selected ? '目前選用' : '其他交付路線',
        detail: writer.note,
        issue:
          writer.mode === 'tool' && !writer.available
            ? diagnoseCapabilityFailure('記憶寫入工具未註冊')
            : null,
        token: [
          this.identity(toolFor(this.ctx, writer.tool)?.execute),
          this.identity(this.diaryAgent?.writers?.get(writer.id)),
          writer.available,
        ],
        group: 'memory',
        features: [
          feature('write', '有明確外部寫入接口', writer.mode === 'tool' && !!writer.available),
          feature('receipt', '長期入庫需核對回執', null),
        ],
      });
    }
    const knownWriters = new Set(
      rows.filter((r) => r.id.startsWith('memory.writer:')).map((r) => r.id.slice(14)),
    );
    const selectedWriter = c.memoryDiaryWriter || 'memu';
    for (const id of new Set([
      ...[...(this.diaryAgent?.writers?.keys?.() || [])].slice(0, 100),
      selectedWriter,
    ]))
      if (!knownWriters.has(id)) {
        const valid = /^[a-zA-Z0-9_.-]{1,64}$/.test(id),
          registered = valid && !!this.diaryAgent?.writers?.has(id);
        add(
          'memory.writer:' + (valid ? id : 'invalid'),
          'memory',
          valid ? '自訂記憶交付 · ' + id : '記憶交付方式格式不正確',
          {
            section: 'memoryOutput',
            registered,
            state: registered ? 'unknown' : 'blocked',
            enabled: id === selectedWriter && !!c.memoryDiaryWriteEnabled,
            issue: registered
              ? null
              : diagnoseCapabilityFailure(valid ? '記憶寫入器未註冊' : 'invalid writer ID'),
            detail: '自訂寫入器仍須核對原插件的作用域及回執，不因函式存在就宣稱已入庫。',
            token: this.identity(this.diaryAgent?.writers?.get(id)),
            group: 'memory',
          },
        );
      }
    for (const system of MEMORY_SYSTEMS.filter((s) => !['memu', 'meow'].includes(s.id)))
      add('memory.system:' + system.id, 'memory', system.name, {
        section: 'memoryOutput',
        packages: MEMORY_PACKAGES[system.id] || [],
        state: 'delegated',
        detail: system.note,
        selection: system.routes,
        group: 'memory',
        features: [feature('capture', '由外部插件自行捕獲／匯入', null)],
      });
    for (const contract of get(this.ctx, 'discordMemoryMaintenance')?.contracts?.catalog?.() || [])
      add('memory.maintenance:' + contract.id, 'memory', contract.name + ' · 維護能力', {
        section: 'memoryOutput',
        packages: MEMORY_PACKAGES[contract.id] || [],
        registered: contract.registered,
        state: contract.available ? 'unknown' : contract.registered ? 'blocked' : 'unsupported',
        detail: contract.note,
        token: [
          this.identity(get(this.ctx, 'discordMemoryMaintenance')?.contracts?.adapters?.get(contract.id)),
          contract.available,
          get(this.ctx, 'discordMemoryMaintenance')?.contracts?.signature?.(contract.id),
        ],
        group: 'memory',
        features: ['correct', 'forget', 'delete'].map((a) =>
          feature(
            a,
            { correct: '更正指定記憶', forget: '忘記／停止召回', delete: '永久刪除指定記憶' }[a],
            contract.actions[a].supported,
          ),
        ),
      });
    {
      const meme = get(this.ctx, 'discordMemeImages')?.catalog?.();
      add('meme.images', 'delivery', 'dsh-meme 表情圖片交付', {
        section: 'reaction',
        packages: ['dsh-meme'],
        registered: !!meme?.available,
        state: meme?.available ? 'unknown' : 'blocked',
        detail: meme?.note || '尚未取得圖庫服務',
        token: this.identity(get(this.ctx, 'dshMeme')),
        group: 'voiceDelivery',
        features: [feature('image', '選圖後上傳真實圖片附件', !!meme?.available)],
      });
    }
    for (const row of knowledgeCatalog(this.ctx).slice(0, 100)) {
      const allowedFor = ['adminDm', 'adminGroup', 'othersDm', 'othersGroup'].filter(
        (scope) =>
          row.eligible &&
          (row.publicData || scope === 'adminDm') &&
          c.replyEngine === 'dsh' &&
          ((c[scope + '_knowledgeLookupEnabled'] ?? c.knowledgeLookupEnabled) ||
            (row.name === 'multi_search' && (c[scope + '_webLookupEnabled'] ?? c.webLookupEnabled)) ||
            (row.name === 'search_meme_wiki' && (c[scope + '_memeLookupEnabled'] ?? c.memeLookupEnabled))),
      );
      add('knowledge:' + row.name, 'knowledge', row.name, {
        section: 'companion',
        packages:
          row.name === 'multi_search'
            ? ['dsh-free-search']
            : row.name === 'search_meme_wiki'
              ? ['dsh-memewiki']
              : [],
        registered: true,
        allowedFor,
        enabled: allowedFor.length > 0,
        state: row.eligible ? 'unknown' : 'unsupported',
        detail: row.eligible ? '工具已宣告可用契約；不代表已成功查到資料或每位操作者有權限。' : row.reason,
        issue: row.eligible ? null : diagnoseCapabilityFailure('工具未宣告所需唯讀能力'),
        token: [this.identity(toolFor(this.ctx, row.name)?.execute), row.eligible, row.publicData],
        group: 'knowledge',
        features: [
          feature('readonly', '唯讀知識契約', row.eligible),
          feature('public', '可供群聊的公開來源', row.publicData),
        ],
      });
    }
    for (const p of (safely(() => this.musicProviders?.catalog?.(), []) || []).slice(0, 100))
      add('music:' + p.id, 'music', p.name, {
        section: 'voice',
        packages: p.type === 'legacy' ? ['dsh-music-panel'] : [],
        registered: ['registered', 'discovered'].includes(p.type),
        state: p.type === 'unverified' ? 'unsupported' : 'unknown',
        issue: p.type === 'unverified' ? diagnoseCapabilityFailure('此來源未宣告可回傳音訊') : null,
        detail: p.note || '已宣告音訊接口，尚未取得音訊不代表可播放。',
        token: [
          p.id,
          p.type,
          this.identity(
            p.id.startsWith('tool:')
              ? toolFor(this.ctx, p.id.slice(5))?.execute
              : this.musicProviders?.providers?.get(p.id.slice(7)),
          ),
        ],
        group: 'music',
        features: [
          feature('audio', '回傳可交付音訊', ['registered', 'discovered'].includes(p.type) ? true : null),
          feature('search', '曲目搜尋', p.search ?? null),
          feature('bounded', '有界串流', p.boundedStream ?? null),
        ],
      });
    for (const [id, name, packages, names] of [
      ['singing.download', '歌曲音源下載', ['dsh-discord-cyberfriend'], ['video_info', 'video_download']],
      [
        'singing.cover',
        '翻唱引擎與成品',
        ['dsh-cover-pipeline'],
        ['cover_doctor', 'cover_separate', 'cover_convert', 'cover_mix', 'cover_verify'],
      ],
    ]) {
      // 音源下載已內建在本插件；別的插件註冊了同名工具時翻唱流程會優先用它。
      const builtin = id === 'singing.download';
      const present = builtin ? names : names.filter((n) => toolFor(this.ctx, n));
      add(id, 'singing', name, {
        section: 'singing',
        packages,
        registered: present.length === names.length,
        state: present.length === names.length ? 'unknown' : 'blocked',
        detail: builtin
          ? '找歌與下載音源由本插件內建，需要的 yt-dlp 會在第一次使用時自動下載；本頁不下載。'
          : '工具存在不等於引擎、音色及成品已就緒；本頁不下載、不推理。',
        issue: present.length === names.length ? null : diagnoseCapabilityFailure('歌曲工具未註冊'),
        token: names.map((n) => this.identity(toolFor(this.ctx, n)?.execute)),
        group: 'singing',
        features: names.map((n) => feature(n, n, builtin || !!toolFor(this.ctx, n))),
      });
    }
    const rooms = [...(this.voice?.sessions?.values?.() || [])];
    add('discord.voice', 'delivery', 'Discord 語音交付', {
      section: 'voice',
      packages: ['dsh-discord-cyberfriend'],
      registered: typeof this.voice?.speak === 'function',
      state: rooms.some((s) => s.adapter?.connected) ? 'ready' : 'unknown',
      enabled: !!c.voiceEnabled,
      detail: '未加入房間不代表故障；成功只表示單次本機傳輸完成，不代表遠端成員實際聽到。',
      group: 'voiceDelivery',
      token: rooms.map((s) => [s.kind, s.nonce, s.selfId, s.channelId, s.textChannelId]),
      features: [
        feature(
          'joined',
          '目前有已連線房間',
          rooms.some((s) => s.adapter?.connected),
        ),
      ],
    });
    add('delivery.bridge', 'delivery', '其他通訊插件語音交付', {
      section: 'voice',
      packages: ['dsh-speech-bridge'],
      registered: !!toolFor(this.ctx, 'send_speech_reply'),
      state: toolFor(this.ctx, 'send_speech_reply') ? 'unknown' : 'blocked',
      issue: toolFor(this.ctx, 'send_speech_reply') ? null : diagnoseCapabilityFailure('交付工具未註冊'),
      detail: '工具可見不代表目前 OneBot／QQBot／IM 會話可送出；登記附件也不代表平台已送達。',
      token: this.identity(toolFor(this.ctx, 'send_speech_reply')?.execute),
      features: [feature('tool', 'send_speech_reply 工具已註冊', !!toolFor(this.ctx, 'send_speech_reply'))],
    });
    const mood = safely(() => this.moodAdapter?.status?.(), {}) || {};
    add('mood.feiyu', 'mood', '大肥魚心情', {
      section: 'companion',
      packages: ['dsh-feiyu-mood'],
      registered: !!this.moodAdapter,
      state: 'unknown',
      detail: '原生 Agent 沿用外部注入；快照是否可讀需選定會話檢查，不在此讀取私人心情。',
      token: [this.identity(this.moodAdapter), c.feiyuMoodEnabled, c.feiyuMoodSlot],
      group: 'mood',
      features: [feature('snapshot', '明確會話綁定的唯讀快照', mood.available ? true : null)],
    });
    add('schedule.host', 'schedule', 'DSH 一次性排程', {
      section: 'companion',
      registered: !!get(this.ctx, 'schedule')?.create,
      state: get(this.ctx, 'schedule')?.create ? 'ready' : 'blocked',
      issue: get(this.ctx, 'schedule')?.create ? null : diagnoseCapabilityFailure('排程服務未註冊'),
      detail: '服務存在不等於到期已喚醒；此頁不建立排程。',
      token: this.identity(get(this.ctx, 'schedule')),
      group: 'schedule',
      features: [
        feature('once', '建立一次性工作', !!get(this.ctx, 'schedule')?.create),
        feature('proactive', 'Discord 主動關心開關', !!c.proactiveEnabled),
      ],
    });
    return rows;
  }
  fingerprint(row) {
    return hash([row.id, row.token]);
  }
  /* 觀測操作（每次合成、每個語音句段、每次辨識…）只需要其中一列的指紋：一秒內共用同一份清單，不每次重建。
   清單過時最多一秒，方向是保守的：結果會記在舊指紋下，不會被當成新來源的證明。 */
  recentDescriptors() {
    const now = this.now();
    if (!this.recentRows || now < this.recentAt || now - this.recentAt >= 1000) {
      this.recentRows = this.descriptors();
      this.recentAt = now;
    }
    return this.recentRows;
  }
  begin(id) {
    if (this.closed) return null;
    try {
      const row = this.recentDescriptors().find((r) => r.id === id);
      if (!row) return null;
      return { id, fingerprint: this.fingerprint(row), at: this.now(), simulation: this.simulation };
    } catch {
      return null;
    }
  }
  toolTickets(names, { simulated = false } = {}) {
    const rows = new Map(this.recentDescriptors().map((r) => [r.id, r]));
    return new Map(
      names.map((name) => {
        const row = rows.get('knowledge:' + name),
          ticket = row
            ? { id: row.id, fingerprint: this.fingerprint(row), at: this.now(), simulation: this.simulation }
            : null;
        if (ticket && simulated) ticket.simulation = true;
        return [name, ticket];
      }),
    );
  }
  captureToolResults(tickets, events) {
    const calls = new Map();
    for (const event of events) {
      if (event.type === 'tool/call') calls.set(event.data.callId, event.data.name);
      else if (event.type === 'tool/result') {
        const message = event.data.message,
          ticket = tickets.get(calls.get(message?.toolCallId));
        if (!ticket) continue;
        const hasContent = Array.isArray(message.content) && message.content.length > 0;
        let failure = message.isError === true,
          error = event.data.error;
        for (const block of message.content || [])
          if (block.type === 'text' && block.text?.length < 100000) {
            try {
              const value = JSON.parse(block.text);
              if (value?.ok === false) {
                failure = true;
                error = value.error || { diagnosticCode: 'INVALID' };
              }
            } catch {}
          }
        this.record(ticket, {
          state: failure ? 'failed' : hasContent ? 'passed' : 'unconfirmed',
          operation: 'knowledge-tool',
          ...(failure
            ? { error: error?.reason || error?.code || error || { diagnosticCode: 'UNKNOWN' } }
            : {}),
        });
      }
    }
  }
  record(ticket, { state = 'passed', error, operation = 'operation' } = {}) {
    if (!ticket || this.closed) return;
    this.cached = null;
    const channel = ticket.simulation ? 'simulation' : 'runtime',
      key = ticket.id + ':' + channel;
    this.records.set(key, {
      state,
      at: this.now(),
      durationMs: Math.max(0, this.now() - ticket.at),
      fingerprint: ticket.fingerprint,
      operation: safeId(operation),
      ...(error ? { issue: diagnoseCapabilityFailure(error) } : {}),
    });
    while (this.records.size > 300) this.records.delete(this.records.keys().next().value);
  }
  async observe(id, operation, work, { outcome, simulated = false, failure } = {}) {
    const ticket = this.begin(id);
    if (ticket && simulated) ticket.simulation = true;
    try {
      const result = await work();
      const state = outcome ? outcome(result) : result?.ok === false ? 'failed' : 'passed';
      this.record(ticket, {
        state,
        operation,
        ...(state === 'failed'
          ? { error: failure?.(result) || result?.error || { diagnosticCode: 'INVALID' } }
          : {}),
      });
      return result;
    } catch (error) {
      this.record(ticket, { state: 'failed', operation, error });
      throw error;
    }
  }
  proof(id, fingerprint, channel) {
    const record = this.records.get(id + ':' + channel);
    if (!record) return { state: 'not-run' };
    return {
      ...record,
      state: record.fingerprint !== fingerprint || this.now() - record.at > 86400000 ? 'stale' : record.state,
    };
  }
  withMissingSources(rows) {
    const ids = new Set(rows.map((r) => r.id));
    for (const id of new Set([...this.records.keys()].map((k) => k.replace(/:(simulation|runtime)$/, ''))))
      if (!ids.has(id)) {
        const category = id.startsWith('knowledge:')
          ? 'knowledge'
          : id.startsWith('music:')
            ? 'music'
            : id.startsWith('memory.')
              ? 'memory'
              : null;
        if (!category) continue;
        rows.push({
          id,
          category,
          name: id,
          section: category === 'knowledge' ? 'companion' : category === 'memory' ? 'memoryOutput' : 'voice',
          packages: [],
          registered: false,
          state: 'blocked',
          features: [],
          issue: diagnoseCapabilityFailure('來源接口已卸載'),
          detail: '此來源曾回報呼叫，現在已不在目錄；舊成功不代表目前可用。',
          token: null,
        });
      }
    return rows;
  }
  async snapshot({ force = false } = {}) {
    if (this.inFlight) return this.inFlight;
    if (!force && this.cached && this.now() - this.cachedAt < 3000) return this.cached;
    this.inFlight = (async () => {
      await this.refreshInventory();
      const rows = this.withMissingSources(this.descriptors()).map((row) => {
        const fingerprint = this.fingerprint(row),
          runtime = this.proof(row.id, fingerprint, 'runtime'),
          simulation = this.proof(row.id, fingerprint, 'simulation'),
          presence = this.presence(row.packages);
        return {
          id: row.id,
          category: row.category,
          name: safeLabel(row.name),
          section: row.section,
          presence,
          registered: row.registered,
          readiness: row.state,
          enabled: row.enabled ?? null,
          allowedFor: row.allowedFor,
          selection: safeLabel(row.selection),
          detail: safeLabel(row.detail),
          features: row.features,
          issue: runtime.state === 'failed' ? runtime.issue : row.issue || null,
          verification: {
            contract: {
              state: this.baseline?.groups.includes(row.group)
                ? this.baseline.valid
                  ? 'passed'
                  : 'stale'
                : 'not-run',
              at: this.baseline?.at,
              scope: '本插件介面契約模擬；不是外部服務實測',
            },
            simulation,
            runtime,
          },
        };
      });
      this.cachedAt = this.now();
      return (this.cached = {
        ok: true,
        version: 1,
        checkedAt: this.now(),
        inventoryKnown: this.inventory.known,
        rows,
        receivePolicy: this.receivePolicy(),
        note: '僅讀取清單與回報，不試用外部服務。實際呼叫結果只保留於本次啟動，重啟清空；設定／接口變更或超過24小時標為舊證據。',
      });
    })().finally(() => (this.inFlight = null));
    return this.inFlight;
  }
  receivePolicy() {
    const c = this.getConfig(),
      ids = c.voiceReceiveUserIds || [];
    return {
      enabled: !!c.voiceReceiveEnabled,
      consent: !!c.voiceReceiveConsent,
      allowedCount: ids.length,
      onlyAdmin: !!c.adminUserId && ids.length === 1 && ids[0] === c.adminUserId,
      autoReply: !!c.voiceReceiveAutoReply,
      provider: safeLabel(c.voiceSttProvider || '沿用宿主'),
      dailySeconds: c.voiceSttDailySeconds || 0,
      note: '待在房內不持續呼叫 LLM。有效發言送 STT；自動回覆才呼叫模型，雲端 STT／TTS 另依服務計費。',
    };
  }
  close() {
    this.closed = true;
    this.records.clear();
    this.cached = null;
    this.recentRows = null;
  }
}

export function observeCapability(ctx, id, operation, work, options) {
  const diagnostics = get(ctx, 'discordCapabilities');
  return diagnostics?.observe ? diagnostics.observe(id, operation, work, options) : work();
}
export async function* observeCapabilityStream(ctx, id, operation, source) {
  const diagnostics = get(ctx, 'discordCapabilities'),
    ticket = diagnostics?.begin?.(id);
  let complete = false,
    bytes = 0;
  try {
    for await (const value of source) {
      bytes += value?.byteLength || 0;
      yield value;
    }
    complete = true;
    diagnostics?.record?.(ticket, {
      state: bytes ? 'passed' : 'failed',
      operation,
      ...(!bytes ? { error: { diagnosticCode: 'INVALID' } } : {}),
    });
  } catch (error) {
    complete = true;
    diagnostics?.record?.(ticket, { state: 'failed', operation, error });
    throw error;
  } finally {
    if (!complete)
      diagnostics?.record?.(ticket, { state: 'failed', operation, error: { diagnosticCode: 'CANCELLED' } });
  }
}
