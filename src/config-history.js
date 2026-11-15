/**
 * src/config-history.js — 設定的復原紀錄與匯出／匯入
 * ============================================================================
 * - 復原紀錄：每次儲存記下「哪些設定從什麼改成什麼」，最多保留十筆，可用來回到改之前的值。
 *   機密欄位（Token、金鑰）只記「有改過」，不記任何值，所以機密的變更不能用這裡復原。
 * - 匯出／匯入：一律不含機密；分享模式另外拿掉個人 ID、名單與本機路徑。
 * ============================================================================
 */
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DEFAULTS, SECRET_KEYS } from './config.js';
import { CoalescedWriter } from './util.js';

export const CONFIG_HISTORY_LIMIT = 10;
export const EXPORT_SCHEMA = 'dsh.discord-cyberfriend.config';
const EXPORT_VERSION = 1;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isSecret = (key) => SECRET_KEYS.includes(key);
// 分享給別人時不該帶走的欄位：管理者與各種 ID 名單、本機路徑。
const PERSONAL_KEY = /(^adminUserId$|UserIds?$|ChannelIds?$|GuildIds?$|DestinationIds$|Directory$|Path$)/;

export class ConfigHistory {
  constructor({ file, limit = CONFIG_HISTORY_LIMIT, now = Date.now } = {}) {
    Object.assign(this, { file, limit, now });
    this.entries = [];
    this.writer = new CoalescedWriter(async () => {
      if (!this.file) return;
      await mkdir(dirname(this.file), { recursive: true });
      await writeFile(
        this.file + '.tmp',
        JSON.stringify({ version: 1, entries: this.entries }) + '\n',
        'utf8',
      );
      await rename(this.file + '.tmp', this.file);
    });
    this.pending = Promise.resolve();
  }

  async init() {
    try {
      const data = JSON.parse(await readFile(this.file, 'utf8'));
      if (Array.isArray(data.entries))
        this.entries = data.entries
          .filter((row) => row && typeof row.id === 'string' && Array.isArray(row.changes))
          .slice(0, this.limit);
    } catch (error) {
      if (error.code !== 'ENOENT') this.entries = [];
    }
  }

  /** 記下一次儲存；回傳紀錄，沒有任何變更時回傳 null。 */
  record(before, after, changedKeys, source = 'ui') {
    const changes = [];
    const secretKeys = [];
    for (const key of changedKeys || []) {
      if (isSecret(key)) secretKeys.push(key);
      else if (!same(before?.[key], after?.[key]))
        changes.push({ key, from: before?.[key], to: after?.[key] });
    }
    if (!changes.length && !secretKeys.length) return null;
    const entry = {
      id: randomUUID(),
      at: this.now(),
      source: String(source).slice(0, 40),
      changes,
      secretKeys,
    };
    this.entries = [entry, ...this.entries].slice(0, this.limit);
    this.pending = this.writer.save().catch(() => {});
    return entry;
  }

  list() {
    return this.entries.map((entry) => ({
      ...entry,
      changes: entry.changes.map((change) => ({ ...change })),
      secretKeys: [...entry.secretKeys],
    }));
  }

  /** 回到某一次儲存「之前」的值所需要的設定。 */
  undoPatch(id) {
    const entry = this.entries.find((row) => row.id === id);
    if (!entry) throw Object.assign(Error('找不到這筆設定紀錄，可能已被較新的紀錄取代'), { status: 404 });
    if (!entry.changes.length)
      throw Object.assign(Error('這次儲存只改了機密欄位，機密的值沒有保存，無法復原'), { status: 400 });
    return Object.fromEntries(entry.changes.map((change) => [change.key, change.from]));
  }

  async flush() {
    await this.pending;
  }
}

/** 匯出目前設定。不含機密；share 為真時另外排除個人 ID、名單與本機路徑。 */
export function exportConfig(config, { share = false, now = Date.now } = {}) {
  const values = {};
  for (const key of Object.keys(DEFAULTS)) {
    if (isSecret(key) || !(key in config)) continue;
    if (share && PERSONAL_KEY.test(key)) continue;
    values[key] = config[key];
  }
  return {
    schema: EXPORT_SCHEMA,
    version: EXPORT_VERSION,
    exportedAt: new Date(now()).toISOString(),
    share: Boolean(share),
    values,
  };
}

/** 檢查匯入檔，回傳要套用的差異與被略過的欄位。機密與不認得的欄位一律略過。 */
export function importPatch(payload, current) {
  const fail = (message) => Object.assign(Error(message), { status: 400 });
  if (
    !payload ||
    typeof payload !== 'object' ||
    payload.schema !== EXPORT_SCHEMA ||
    !payload.values ||
    typeof payload.values !== 'object' ||
    Array.isArray(payload.values)
  )
    throw fail('這不是 Discord 賽博群友的設定匯出檔');
  if (payload.version !== EXPORT_VERSION) throw fail('設定檔版本不相容（需要版本 ' + EXPORT_VERSION + '）');
  const patch = {};
  const ignored = [];
  for (const [key, value] of Object.entries(payload.values)) {
    if (!(key in DEFAULTS) || isSecret(key)) ignored.push(key);
    else if (!same(value, current?.[key])) patch[key] = value;
  }
  return { patch, ignored };
}
