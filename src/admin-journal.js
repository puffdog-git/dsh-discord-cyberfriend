import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

// Native Session events are the durable destination; this journal only retries delivery.
export class AdminJournal {
  constructor({ file, bridge, getConfig, log }) {
    Object.assign(this, { file, bridge, getConfig, log });
    this.pending = {};
    this.processing = new Set();
  }
  async init() {
    try {
      this.pending = JSON.parse(await readFile(this.file, 'utf8'));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  async save() {
    this.saves = (this.saves || Promise.resolve())
      .catch(() => {})
      .then(async () => {
        await mkdir(dirname(this.file), { recursive: true });
        await writeFile(this.file + '.tmp', JSON.stringify(this.pending, null, 2) + '\n');
        await rename(this.file + '.tmp', this.file);
      });
    await this.saves;
  }
  async capture(message, transport, job) {
    const config = this.getConfig();
    if (
      !config.enabled ||
      config.archiveAdminMessages === false ||
      !config.adminUserId ||
      String(message?.author?.id) !== config.adminUserId ||
      message.author.id === transport.selfId
    )
      return job();
    const key = `${this.bridge.identity(message, transport)}:${message.id}`;
    if (this.processing.has(key)) return null;
    this.processing.add(key);
    try {
      this.pending[key] = { message, transport: { kind: transport.kind, selfId: transport.selfId } };
      await this.save(); // Persist before reply gates or a model call can fail.
      return await job();
    } finally {
      this.processing.delete(key);
      await this.deliver(key);
    }
  }
  async deliver(key) {
    const entry = this.pending[key];
    if (!entry || this.processing.has(key)) return;
    try {
      const result = await this.bridge.archive(entry.message, entry.transport, this.getConfig());
      delete this.pending[key];
      await this.save();
      this.log?.info('session.admin', '管理者訊息已保存至 DSH', {
        sessionId: result.sessionId,
        messageId: entry.message.id,
        duplicate: result.duplicate,
      });
    } catch (error) {
      this.log?.debug('session.admin.pending', '管理者訊息保留待寫入', {
        messageId: entry.message.id,
        error: String(error.message).slice(0, 180),
      });
    }
  }
  async drain() {
    if (this.draining) return;
    this.draining = true;
    try {
      for (const key of Object.keys(this.pending).slice(0, 20)) await this.deliver(key);
    } finally {
      this.draining = false;
    }
  }
}
