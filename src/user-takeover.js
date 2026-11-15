import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
export class UserTakeover {
  constructor({ file, now = () => Date.now(), onPause = () => {} }) {
    Object.assign(this, { file, now, onPause });
    this.rows = new Map();
    this.queue = Promise.resolve();
  }
  async init() {
    try {
      const data = JSON.parse(await readFile(this.file, 'utf8'));
      for (const row of data.entries || [])
        if (
          /^\d{15,22}$/.test(row.channelId) &&
          (row.until === null || (Number.isFinite(row.until) && row.until > this.now()))
        )
          this.rows.set(row.channelId, row);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  active(channelId) {
    const row = this.rows.get(String(channelId));
    if (row && row.until !== null && row.until <= this.now()) {
      this.rows.delete(String(channelId));
      return null;
    }
    return row || null;
  }
  status() {
    return {
      entries: [...this.rows.keys()].map((id) => this.active(id)).filter(Boolean),
      serverTime: this.now(),
    };
  }
  async save() {
    this.queue = this.queue
      .catch(() => {})
      .then(async () => {
        await mkdir(dirname(this.file), { recursive: true });
        await writeFile(this.file + '.tmp', JSON.stringify({ version: 1, ...this.status() }, null, 2) + '\n');
        await rename(this.file + '.tmp', this.file);
      });
    return this.queue;
  }
  async pause(channelId, { seconds = 1800, label = '' } = {}) {
    channelId = String(channelId);
    if (!/^\d{15,22}$/.test(channelId))
      throw Object.assign(Error('請選擇對話或輸入有效頻道 ID'), { status: 400 });
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 86400)
      throw Object.assign(Error('暫停時間需介於 0 至 86400 秒；0 代表手動恢復'), { status: 400 });
    if (typeof label !== 'string' || label.length > 150)
      throw Object.assign(Error('對話名稱過長'), { status: 400 });
    const row = {
      channelId,
      label: label.trim(),
      startedAt: this.now(),
      until: seconds ? this.now() + seconds * 1000 : null,
    };
    this.rows.set(channelId, row);
    const cancelled = this.onPause(channelId);
    await this.save();
    return { ok: true, cancelled, entry: row, ...this.status() };
  }
  async resume(channelId) {
    channelId = String(channelId);
    if (!/^\d{15,22}$/.test(channelId)) throw Object.assign(Error('頻道 ID 無效'), { status: 400 });
    this.rows.delete(channelId);
    await this.save();
    return { ok: true, ...this.status() };
  }
  async flush() {
    await this.queue;
  }
}
