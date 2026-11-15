import { extractFrames } from './media.js';
import { mkdir, open, realpath, stat, writeFile, readdir, unlink } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { observeCapability } from './capability-diagnostics.js';
const hash = (b) => createHash('sha256').update(b).digest('hex');
const get = (ctx) => {
  try {
    return ctx.get?.('dshMeme') || ctx.dshMeme;
  } catch {
    return null;
  }
};
export function memeImageType(b) {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) return 'jpg';
  if (/^GIF8[79]a$/.test(b.toString('ascii', 0, 6))) return 'gif';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  throw Error('圖庫沒有提供可上傳的圖片格式');
}
export class MemeImages {
  constructor({ ctx, root, now = Date.now, random = Math.random }) {
    Object.assign(this, { ctx, root, now, random });
    this.last = new Map();
    this.pending = new Set();
  }
  catalog() {
    const s = get(this.ctx);
    if (s?.contractVersion !== 1 || typeof s.pick !== 'function' || typeof s.packs !== 'function')
      return {
        available: false,
        packs: [],
        note: '請載入提供dshMeme v1服務的dsh-meme；不把網頁表情標記當成Discord圖片',
      };
    try {
      return {
        available: true,
        packs: s
          .packs()
          .slice(0, 100)
          .map((p) => ({ id: p.id, name: p.name, count: p.count })),
        note: '使用已啟用圖庫的本機圖片，由Discord插件上傳附件；不呼叫send_meme或其他通道',
      };
    } catch {
      return { available: false, packs: [], note: '圖庫清單暫時無法讀取' };
    }
  }
  async prune() {
    await mkdir(this.root, { recursive: true });
    let bytes = 0,
      count = 0;
    for (const name of await readdir(this.root)) {
      if (!/^[a-f0-9-]{36}\.(?:png|jpg|gif|webp)$/.test(name)) continue;
      const file = join(this.root, name),
        info = await stat(file);
      if (this.now() - info.mtimeMs > 86400000) await unlink(file);
      else {
        bytes += info.size;
        count++;
      }
    }
    if (bytes > 64 * 1024 * 1024 || count >= 64) throw Error('表情暫存已達上限，請稍後再試');
  }
  async prepare({ query, config, message, transport, signal }) {
    if (!config.memeImagesEnabled || !query || message.simulated || signal?.aborted) return null;
    const requested =
      /(?:發|发|給|给|來|来|送|貼|贴|要|想看|想要|send|show).{0,16}(?:表情|meme|梗圖|梗图)|(?:表情|meme|梗圖|梗图).{0,12}(?:給我|给我|please)/i.test(
        message.content || '',
      );
    if (config.memeImageMode === 'requested' && !requested) return null;
    if (!requested && this.random() * 100 >= Number(config.memeImageChancePercent ?? 25)) return null;
    const key = [transport.kind, transport.selfId, message.channelId].join(':');
    if (
      this.pending.has(key) ||
      this.now() - (this.last.get(key) ?? -Infinity) < Number(config.memeImageCooldownSeconds ?? 60) * 1000
    )
      return null;
    const s = get(this.ctx);
    if (!this.catalog().available) return null;
    this.pending.add(key);
    try {
      signal?.throwIfAborted();
      await this.prune();
      const packs = s
        .packs()
        .filter((p) => !(config.memeImagePackIds || []).length || config.memeImagePackIds.includes(p.id));
      const tags = config.memeImageTags || [];
      const chosen = await observeCapability(
        this.ctx,
        'meme.images',
        'pick-image',
        async () => {
          const args = {
            query: String(query).slice(0, 120),
            ...(tags.length ? { tag: tags[0] } : {}),
            limit: 30,
          };
          if (typeof s.search === 'function') {
            let result = await s.search(args);
            if (!result?.memes?.length && tags.length) result = await s.search({ ...args, query: '' });
            const row = (result?.memes || []).find(
              (r) => packs.some((p) => p.id === r.pack) && (!tags.length || tags.includes(r.tag)),
            );
            return row ? { ok: true, ...row } : { ok: false };
          }
          return s.pick(args);
        },
        { outcome: (r) => (r?.ok && r.path ? 'unconfirmed' : 'failed') },
      );
      signal?.throwIfAborted();
      if (!chosen?.ok || !isAbsolute(chosen.path || '') || (tags.length && !tags.includes(chosen.tag)))
        return null;
      const pack = packs.find((p) => p.id === chosen.pack);
      if (!pack) return null;
      const root = await realpath(pack.path),
        source = await realpath(chosen.path),
        rel = relative(root, source);
      if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw Error('表情檔案不在已允許圖庫內');
      const file = await open(source, 'r');
      let data;
      try {
        const before = await file.stat(),
          again = await realpath(source),
          current = await stat(again);
        if (
          again !== source ||
          before.ino !== current.ino ||
          before.dev !== current.dev ||
          !before.isFile() ||
          before.size <= 0 ||
          before.size > 8 * 1024 * 1024
        )
          throw Error('表情圖片超過8MiB或來源已變更');
        data = await file.readFile();
        if (data.length !== before.size || data.length > 8 * 1024 * 1024) throw Error('圖片讀取期間已變更');
      } finally {
        await file.close();
      }
      signal?.throwIfAborted();
      const type = memeImageType(data);
      await extractFrames(data, { ...config, gifFrameCount: 2 }, signal);
      const path = join(this.root, randomUUID() + '.' + type);
      await writeFile(path, data, { flag: 'wx' });
      if (signal?.aborted) {
        await unlink(path).catch(() => {});
        signal.throwIfAborted();
      }
      this.last.set(key, this.now());
      if (this.last.size > 500) this.last.delete(this.last.keys().next().value);
      return { path, pack: pack.id, rootHash: hash(root), hash: hash(data) };
    } finally {
      this.pending.delete(key);
    }
  }
  async release(image) {
    if (!image?.path) return;
    const rel = relative(resolve(this.root), resolve(image.path));
    if (!rel || rel.startsWith('..') || isAbsolute(rel) || !/^[a-f0-9-]{36}\.(?:png|jpg|gif|webp)$/.test(rel))
      return;
    await unlink(image.path).catch(() => {});
  }
  async validate(image, config) {
    if (!config.memeImagesEnabled) throw Error('本對象的表情圖片發送已關閉');
    const s = get(this.ctx);
    if (s?.contractVersion !== 1) throw Error('表情圖庫接口已卸載');
    const pack = s
      .packs()
      .find(
        (p) =>
          p.id === image.pack &&
          (!(config.memeImagePackIds || []).length || config.memeImagePackIds.includes(p.id)),
      );
    if (!pack || hash(await realpath(pack.path)) !== image.rootHash) throw Error('原圖庫已停用或改變');
    const file = await realpath(image.path),
      root = await realpath(this.root),
      rel = relative(root, file);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw Error('表情暫存路徑無效');
    const handle = await open(file, 'r');
    try {
      const info = await handle.stat();
      if (
        info.size > 8 * 1024 * 1024 ||
        this.now() - info.mtimeMs > 86400000 ||
        hash(await handle.readFile()) !== image.hash
      )
        throw Error('表情暫存已改變或到期');
    } finally {
      await handle.close();
    }
    return true;
  }
}
