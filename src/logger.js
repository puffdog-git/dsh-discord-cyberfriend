/**
 * src/logger.js — 事件日誌
 * ============================================================================
 * 兩個輸出：
 *   1. 記憶體環形緩衝（UI 即時查看，上限由 logMaxEntries 控制）
 *   2. data/logs/discord-cyberfriend-YYYY-MM-DD.jsonl（可關閉，7 天後自動清除）
 * 另外提供 subscribe()，讓 REST SSE / 輪詢可以拿到即時事件。
 * ============================================================================
 */
import { appendFile, mkdir, readdir, unlink, rename } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { nowIso, truncate } from './util.js';
import { redactDiagnostic } from './security.js';
import { SECRET_KEYS } from './config.js';

const LEVEL_WEIGHT = { debug: 10, info: 20, warn: 30, error: 40 };

export class HubLogger {
  constructor(options = {}) {
    this.dir = options.dir || '';
    this.enabled = options.enabled !== false;
    this.level = options.level || 'info';
    this.maxEntries = Math.max(50, Number(options.maxEntries) || 500);
    this.toFile = options.toFile !== false;
    this.retentionDays = Math.max(1, Number(options.retentionDays) || 7);
    this.contentEnabled = options.contentEnabled !== false;
    this.entries = [];
    this.listeners = new Set();
    this.seq = 0;
    this.secretValues = new Set();
    this.fileWritable = Boolean(this.dir);
    this.consoleLogger = options.console || console;
  }

  configure(options = {}) {
    for (const key of SECRET_KEYS)
      if (typeof options[key] === 'string' && options[key].length >= 4) this.secretValues.add(options[key]);
    // 接受兩種命名：logger 自己的欄位名，以及設定檔的 logXxx 欄位名。
    const pick = (short, long) => (options[short] !== undefined ? options[short] : options[long]);
    const enabled = pick('enabled', 'logEnabled');
    const level = pick('level', 'logLevel');
    const maxEntries = pick('maxEntries', 'logMaxEntries');
    const toFile = pick('toFile', 'logToFile');
    const retentionDays = pick('retentionDays', 'logRetentionDays');
    const contentEnabled = pick('contentEnabled', 'logMessageContent');
    if (enabled !== undefined) this.enabled = Boolean(enabled);
    if (level) this.level = level;
    if (maxEntries) this.maxEntries = Math.max(50, Number(maxEntries) || 500);
    if (toFile !== undefined) this.toFile = Boolean(toFile);
    if (retentionDays) this.retentionDays = Math.max(1, Number(retentionDays) || 7);
    if (contentEnabled !== undefined) this.contentEnabled = Boolean(contentEnabled);
    this.trim();
  }

  get minWeight() {
    return LEVEL_WEIGHT[this.level] ?? LEVEL_WEIGHT.info;
  }

  shouldLog(level) {
    return this.enabled && (LEVEL_WEIGHT[level] ?? LEVEL_WEIGHT.info) >= this.minWeight;
  }

  /**
   * 寫入一則事件。
   * @param {'debug'|'info'|'warn'|'error'} level
   * @param {string} event 事件代號，例如 message / reply / login
   * @param {string} summary 人類可讀摘要
   * @param {Record<string, unknown>} [data] 結構化細節（會被截斷）
   */
  log(level, event, summary, data) {
    if (!this.shouldLog(level)) return null;
    const entry = {
      id: `e${(this.seq += 1)}`,
      t: nowIso(),
      level,
      event,
      summary: truncate(redactDiagnostic(summary, [...this.secretValues]), 300),
      data: data ? this.scrub(data) : undefined,
    };
    this.entries.push(entry);
    this.trim();
    this.emit(entry);
    this.writeFile(entry);
    return entry;
  }

  debug(event, summary, data) {
    return this.log('debug', event, summary, data);
  }

  info(event, summary, data) {
    return this.log('info', event, summary, data);
  }

  warn(event, summary, data) {
    return this.log('warn', event, summary, data);
  }

  error(event, summary, data) {
    return this.log('error', event, summary, data);
  }

  scrub(value, depth = 0) {
    if (depth > 4) return '[deep]';
    if (value === null || typeof value !== 'object') {
      if (typeof value === 'string') return truncate(redactDiagnostic(value, [...this.secretValues]), 500);
      return value;
    }
    if (Array.isArray(value)) return value.slice(0, 20).map((item) => this.scrub(item, depth + 1));
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (/token|apikey|api_key|secret|password|authorization/i.test(key)) {
        out[key] = typeof child === 'string' && child ? '***' : child;
        continue;
      }
      if (key === 'content' && !this.contentEnabled) {
        out[key] = typeof child === 'string' ? `<${child.length} chars>` : child;
        continue;
      }
      out[key] = this.scrub(child, depth + 1);
    }
    return out;
  }

  trim() {
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
  }

  emit(entry) {
    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch {
        /* 監聽器失敗不影響主流程 */
      }
    }
  }

  /** 訂閱新事件；回傳取消訂閱函式。 */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 最新 N 則（新到舊或舊到新由 newestFirst 決定）。 */
  recent(limit = 100, newestFirst = false) {
    const size = Math.max(1, Math.min(this.maxEntries, Number(limit) || 100));
    const list = this.entries.slice(-size);
    return newestFirst ? [...list].reverse() : list;
  }

  clear() {
    this.entries = [];
    this.seq = 0;
    return { ok: true };
  }

  async init() {
    if (!this.dir) return;
    try {
      await mkdir(this.dir, { recursive: true });
      await this.pruneFiles();
      await this.redactExistingFiles();
    } catch (error) {
      this.fileWritable = false;
      this.consoleLogger.warn?.(
        `[discord-cyberfriend] 日誌目錄不可用: ${redactDiagnostic(error.message, [...this.secretValues])}`,
      );
    }
  }

  fileName(date = new Date()) {
    const day = date.toISOString().slice(0, 10);
    return join(this.dir, `discord-cyberfriend-${day}.jsonl`);
  }
  async redactExistingFiles() {
    for (const name of await readdir(this.dir)) {
      if (!/^discord-(?:cyberfriend|pyself-lab)-\d{4}-\d{2}-\d{2}\.jsonl$/.test(name)) continue;
      const file = join(this.dir, name),
        tmp = file + '.' + randomUUID() + '.tmp',
        self = this;
      async function* clean() {
        const lines = createInterface({
          input: createReadStream(file, { encoding: 'utf8' }),
          crlfDelay: Infinity,
        });
        try {
          for await (const line of lines) {
            if (!line.trim()) continue;
            try {
              const value = JSON.parse(line),
                entry = self.scrub(value);
              if (typeof entry.summary === 'string')
                entry.summary = redactDiagnostic(entry.summary, [...self.secretValues]);
              yield JSON.stringify(entry) + '\n';
            } catch {
              yield JSON.stringify({ event: 'log.invalid', summary: '舊日誌格式不完整，內容已隱藏' }) + '\n';
            }
          }
        } finally {
          lines.close();
        }
      }
      try {
        await pipeline(Readable.from(clean()), createWriteStream(tmp, { flags: 'wx', mode: 0o600 }));
        await rename(tmp, file);
      } finally {
        await unlink(tmp).catch(() => {});
      }
    }
  }

  writeFile(entry) {
    if (!this.toFile || !this.fileWritable) return;
    appendFile(this.fileName(), `${JSON.stringify(entry)}\n`).catch(() => {
      /* 寫檔失敗不影響執行，避免日誌風暴 */
    });
  }

  async pruneFiles() {
    if (!this.dir) return;
    const cutoff = Date.now() - this.retentionDays * 86_400_000;
    let files = [];
    try {
      files = await readdir(this.dir);
    } catch {
      return;
    }
    for (const file of files) {
      const match = /^discord-(?:cyberfriend|pyself-lab)-(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(file);
      if (!match) continue;
      const stamp = Date.parse(`${match[1]}T00:00:00.000Z`);
      if (Number.isFinite(stamp) && stamp < cutoff) {
        await unlink(join(this.dir, file)).catch(() => {});
      }
    }
  }
}
