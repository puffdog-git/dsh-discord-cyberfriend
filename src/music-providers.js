import { observeCapability } from './capability-diagnostics.js';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
const MAX = 64 * 1024 * 1024;
async function abortable(work, signal) {
  signal.throwIfAborted();
  let abort;
  const cancelled = new Promise((_, reject) => {
    abort = () => reject(Error('音樂來源已取消或逾時'));
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    return await Promise.race([work, cancelled]);
  } finally {
    signal.removeEventListener('abort', abort);
  }
}
async function audioBytes(value, { signal, workspace } = {}) {
  signal.throwIfAborted();
  if (value?.structuredContent) value = value.structuredContent;
  if (value?.content?.some?.((row) => row.type === 'audio')) {
    const row = value.content.find((row) => row.type === 'audio');
    value = { audioBase64: row.data };
  }
  if (value?.data instanceof Uint8Array) value = value.data;
  if (typeof value?.audioBase64 === 'string') {
    if (
      value.audioBase64.length > Math.ceil((MAX * 4) / 3) + 4 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(value.audioBase64)
    )
      throw Error('音樂來源回傳無效音訊');
    value = Buffer.from(value.audioBase64, 'base64');
  }
  if (value?.path) {
    if (!workspace) throw Error('缺少目前工作區');
    const file = await realpath(value.path),
      root = await realpath(workspace),
      relative = path.relative(root, file);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
      throw Error('音樂成品超出目前工作區');
    const info = await stat(file);
    if (!info.isFile() || info.size > MAX) throw Error('音樂成品超過大小限制');
    value = await readFile(file);
  }
  if (value instanceof Uint8Array) {
    if (!value.length || value.length > MAX) throw Error('音樂音訊為空或超過 64 MiB');
    return Buffer.from(value);
  }
  const stream = value?.stream || value;
  if (stream?.[Symbol.asyncIterator]) {
    let total = 0,
      abort;
    const chunks = [],
      cancel = new Promise((_, reject) => {
        abort = () => reject(Error('音樂載入已取消'));
        signal.addEventListener('abort', abort, { once: true });
      }),
      iterator = stream[Symbol.asyncIterator]();
    try {
      while (true) {
        signal.throwIfAborted();
        const next = await Promise.race([iterator.next(), cancel]);
        if (next.done) break;
        const chunk = Buffer.from(next.value);
        total += chunk.length;
        if (total > MAX) throw Error('音樂串流超過 64 MiB');
        chunks.push(chunk);
      }
      if (!total) throw Error('音樂串流為空');
      return Buffer.concat(chunks);
    } finally {
      signal.removeEventListener('abort', abort);
      Promise.resolve(iterator.return?.()).catch(() => {});
    }
  }
  throw Error('此插件沒有回傳可交付音訊；只在電腦播放或只給網址，不代表能送入 Discord');
}
export class MusicProviders {
  constructor({ ctx, scopeFor } = {}) {
    this.ctx = ctx;
    this.scopeFor = scopeFor;
    this.providers = new Map();
  }
  register(provider) {
    if (
      !/^[a-zA-Z0-9_.-]{1,64}$/.test(provider?.id || '') ||
      typeof provider.load !== 'function' ||
      this.providers.has(provider.id)
    )
      throw Error('音樂 Provider 需要唯一 ID 與 load 方法');
    const token = { provider };
    this.providers.set(provider.id, token);
    return () => {
      if (this.providers.get(provider.id) === token) this.providers.delete(provider.id);
    };
  }
  tools() {
    try {
      return (this.ctx?.get?.('tools') || this.ctx?.tools)?.definitions?.() || [];
    } catch {
      return [];
    }
  }
  discovered() {
    return this.tools().filter((tool) => {
      const a = tool.annotations || {},
        out = tool.output?.schema?.properties || {};
      return (
        a.readOnlyHint === true &&
        a.destructiveHint !== true &&
        typeof tool.execute === 'function' &&
        (a.musicProvider?.audio === true ||
          (/music|歌曲|音樂|音乐/i.test(tool.name + ' ' + tool.description) && !!out.audioBase64))
      );
    });
  }
  catalog() {
    const discovered = this.discovered();
    return [
      {
        id: 'music-panel',
        name: '既有音樂面板',
        type: 'legacy',
        boundedStream: true,
        note: '沿用 /music/library、/music/stream 與 /music/online/stream；此列不代表插件已載入。',
      },
      ...[...this.providers.values()].map(({ provider: p }) => ({
        id: 'plugin:' + p.id,
        name: p.name || p.id,
        type: 'registered',
        search: typeof p.search === 'function',
        // 即時來源：聲音是邊收邊播的串流（例如另一個插件即時轉送的聲音），沒有檔案、不能預先載入。
        ...(typeof p.openLive === 'function' ? { live: true } : {}),
        ...(p.available ? { available: p.available() } : {}),
        boundedStream: true,
      })),
      ...discovered.map((d) => ({
        id: 'tool:' + d.name,
        name: d.annotations.musicProvider?.name || d.name,
        type: 'discovered',
        boundedStream: true,
        search: false,
      })),
      ...this.tools()
        .filter(
          (d) =>
            /music|音樂|音乐/i.test(d.name) &&
            !/^discord_cyberfriend_/.test(d.name) &&
            !discovered.includes(d),
        )
        .map((d) => ({
          id: 'unverified:' + d.name,
          name: d.name,
          type: 'unverified',
          boundedStream: false,
          note: '未宣告可交付音訊，可能只在電腦播放；不能自動當作 Discord 音訊來源。',
        })),
    ];
  }
  search(id, query, context = {}) {
    return observeCapability(this.ctx, 'music:' + id, 'search-music', () =>
      this.rawSearch(id, query, context),
    );
  }
  async rawSearch(id, query, context = {}) {
    if (!id.startsWith('plugin:')) throw Error('此來源未宣告曲目搜尋；請提供曲目 ID');
    const row = this.providers.get(id.slice(7));
    if (!row?.provider.search) throw Error('此來源不提供搜尋');
    const signal = AbortSignal.any([...(context.signal ? [context.signal] : []), AbortSignal.timeout(30000)]);
    const rows = await abortable(
      row.provider.search(String(query || '').slice(0, 200), { ...context, signal }),
      signal,
    );
    if (!Array.isArray(rows)) throw Error('音樂搜尋回傳格式不正確');
    return rows
      .slice(0, 100)
      .map((row) => ({
        id: String(row.id || '').slice(0, 300),
        title: String(row.title || row.name || row.id || '曲目').slice(0, 200),
        artist: String(row.artist || '').slice(0, 100),
        provider: id,
      }))
      .filter((row) => row.id);
  }
  /**
   * 這個來源（的這首歌）是不是即時播放。登記時有提供 openLive 就是即時來源；
   * 來源另外提供 isLiveTrack(曲目 ID) 時，由它決定每一首是即時播放還是照一般方式載入
   * （同一個來源可以有的歌即時、有的歌下載）。沒給曲目 ID 時回答「這個來源有沒有即時播放的能力」。
   */
  isLive(id, trackId) {
    if (typeof id !== 'string' || !id.startsWith('plugin:')) return false;
    const provider = this.providers.get(id.slice(7))?.provider;
    if (typeof provider?.openLive !== 'function') return false;
    if (trackId === undefined || typeof provider.isLiveTrack !== 'function') return true;
    try {
      return provider.isLiveTrack(String(trackId)) === true;
    } catch {
      return false;
    }
  }
  /**
   * 開啟即時來源。提供者的 openLive(trackId, { signal }) 要回傳 { stream }：
   * 一條 48000 Hz／雙聲道／16 位元 PCM 的可讀串流；signal 中止時提供者要自己收尾。
   * 開啟最多等 20 秒；串流本身播到結束、被停止或超過音樂時間上限為止。
   */
  openLive(id, trackId, context) {
    return observeCapability(this.ctx, 'music:' + id, 'load-audio', () => this.rawOpenLive(id, trackId, context), {
      outcome: (r) => (r?.stream ? 'passed' : 'unconfirmed'),
    });
  }
  async rawOpenLive(id, trackId, context) {
    if (typeof trackId !== 'string' || !trackId.trim() || trackId.length > 300) throw Error('需要有效曲目 ID');
    const row = this.isLive(id, trackId) ? this.providers.get(id.slice(7)) : null;
    if (!row) throw Error('這個音樂來源不提供即時串流，或已卸載');
    const opening = AbortSignal.any([context.signal, AbortSignal.timeout(20000)]);
    const pending = Promise.resolve(row.provider.openLive(trackId, { signal: context.signal }));
    let value;
    try {
      value = await abortable(pending, opening);
    } catch (e) {
      // 等不及或被取消：之後才開好的串流要關掉，不能留著繼續擷取。
      pending.then((late) => late?.stream?.destroy?.()).catch(() => {});
      throw e;
    }
    const stream = value?.stream;
    if (!stream || typeof stream.pipe !== 'function' || typeof stream.destroy !== 'function')
      throw Error('即時音樂來源沒有回傳音訊串流');
    if (this.providers.get(id.slice(7)) !== row) {
      stream.destroy();
      throw Error('音樂來源在開啟期間已變更');
    }
    return { stream };
  }
  load(id, trackId, context) {
    return observeCapability(
      this.ctx,
      'music:' + id,
      'load-audio',
      () => this.rawLoad(id, trackId, context),
      { outcome: (r) => (r?.byteLength ? 'passed' : 'unconfirmed') },
    );
  }
  async rawLoad(id, trackId, context) {
    if (typeof trackId !== 'string' || !trackId.trim() || trackId.length > 300)
      throw Error('需要有效曲目 ID');
    const signal = AbortSignal.any([context.signal, AbortSignal.timeout(120000)]),
      scope = await this.scopeFor?.(context);
    let value;
    if (id.startsWith('plugin:')) {
      const row = this.providers.get(id.slice(7));
      if (!row) throw Error('音樂來源已卸載');
      value = await abortable(row.provider.load(trackId, { ...scope, signal }), signal);
      if (this.providers.get(id.slice(7)) !== row) throw Error('音樂來源在載入期間已變更');
    } else if (id.startsWith('tool:')) {
      const definition = this.discovered().find((d) => d.name === id.slice(5));
      if (!definition) throw Error('工具未宣告可回傳音訊，或已卸載');
      if (!scope?.agent) throw Error('自動探索的音樂來源需綁定已載入的 DSH 會話');
      const metadata = definition.annotations.musicProvider || {},
        properties = definition.parameters?.properties || {},
        field =
          metadata.idField ||
          ['id', 'trackId', 'track_id', 'query'].find((name) => Object.hasOwn(properties, name));
      if (!field || !Object.hasOwn(properties, field)) throw Error('音樂工具未宣告曲目欄位');
      value = await abortable(
        definition.execute(
          { [field]: trackId },
          { agent: scope.agent, ctx: scope.agent.ctx, logger: scope.agent.ctx?.logger, signal },
        ),
        signal,
      );
    } else throw Error('未註冊的音樂來源');
    signal.throwIfAborted();
    if (id.startsWith('tool:') && !this.discovered().some((d) => d.name === id.slice(5)))
      throw Error('音樂工具在載入期間已卸載');
    const latest = await this.scopeFor?.(context);
    if (
      scope?.workspace !== latest?.workspace ||
      (scope?.agent?.id || scope?.agent?.session?.id) !== (latest?.agent?.id || latest?.agent?.session?.id)
    )
      throw Error('音樂會話或工作區已變更');
    return audioBytes(value, { signal, workspace: scope?.workspace });
  }
}
export { audioBytes as musicAudioBytes };
