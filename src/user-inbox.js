import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { CoalescedWriter } from './util.js';
export class UserInbox {
  constructor({ file, now = () => Date.now() }) {
    Object.assign(this, { file, now });
    this.items = new Map();
    this.queue = Promise.resolve();
    this.truncated = false;
    this.locks = new Set();
  }
  async init() {
    try {
      const d = JSON.parse(await readFile(this.file, 'utf8'));
      for (const item of d.items || []) {
        if (item.phase === 'sending') {
          item.phase = 'uncertain';
          item.reason = '上次發送中斷，請先核對 Discord';
        } else if (['generating', 'retrying'].includes(item.phase)) {
          item.phase = 'pending';
          item.reason = '上次生成中斷，可重新產生';
        }
        this.items.set(item.id, item);
      }
      this.truncated = !!d.truncated;
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  status() {
    const items = [...this.items.values()]
      .filter((i) => !i.resolvedAt)
      .sort((a, b) => b.receivedAt - a.receivedAt);
    return {
      items: items.map((i) => ({
        ...i,
        canRetry: !['generating', 'retrying', 'sending', 'uncertain', 'draft'].includes(i.phase),
      })),
      total: items.length,
      truncated: this.truncated,
    };
  }
  async save() {
    this.writer ||= new CoalescedWriter(async () => {
      await mkdir(dirname(this.file), { recursive: true });
      await writeFile(
        this.file + '.tmp',
        JSON.stringify({ version: 1, truncated: this.truncated, items: [...this.items.values()] }) + '\n',
      );
      await rename(this.file + '.tmp', this.file);
    });
    return (this.queue = this.writer.save());
  }
  async record(m, t) {
    if (
      t.kind !== 'user' ||
      m.simulated ||
      m.author?.id === t.selfId ||
      m.author?.bot ||
      !/^\d{15,22}$/.test(m.id) ||
      !/^\d{15,22}$/.test(m.channelId) ||
      !((m.isDm && !m.isGroupDm) || m.isMention)
    )
      return;
    if (this.items.has(m.id)) return;
    this.items.set(m.id, {
      id: m.id,
      channelId: m.channelId,
      guildId: m.guildId || null,
      authorId: m.author?.id,
      author: m.author?.name || m.author?.username || m.author?.id || '使用者',
      content: String(m.content || '').slice(0, 1200) || '[圖片、GIF 或貼圖]',
      receivedAt: this.now(),
    });
    if (this.items.size > 1000) {
      const oldest = [...this.items.values()].sort(
        (a, b) => Number(!!b.resolvedAt) - Number(!!a.resolvedAt) || a.receivedAt - b.receivedAt,
      )[0];
      this.items.delete(oldest.id);
      if (!oldest.resolvedAt) this.truncated = true;
    }
    await this.save();
  }
  async mark(id, phase, reason = '') {
    const r = this.items.get(String(id));
    if (!r || r.resolvedAt) return;
    r.phase = phase;
    r.reason = String(reason).slice(0, 500);
    r.lastAttemptAt = this.now();
    await this.save();
  }
  async retry(id, run) {
    const r = this.items.get(String(id));
    if (!r || r.resolvedAt) throw Object.assign(Error('此訊息已處理或不存在'), { status: 404 });
    if (this.locks.has(id) || ['generating', 'retrying', 'sending', 'uncertain', 'draft'].includes(r.phase))
      throw Object.assign(Error('此訊息正在處理、等待審稿或送出結果不確定，請先核對'), { status: 409 });
    this.locks.add(id);
    try {
      await this.mark(id, 'retrying', '重新讀取來源訊息');
      return await run(r);
    } catch (e) {
      if (this.items.get(String(id))?.phase === 'retrying') await this.mark(id, 'failed', e.message);
      throw e;
    } finally {
      this.locks.delete(id);
    }
  }
  async change(event, message) {
    const item = this.items.get(String(event.messageId));
    if (!item || item.resolvedAt) return;
    if (event.event === 'message_delete') return this.resolve(item.id, 'deleted');
    if (event.event === 'message_edit' && message) {
      item.content = String(message.content || '').slice(0, 1200) || '[圖片、GIF 或貼圖]';
      item.edited = true;
      await this.save();
    }
  }
  async resolve(id, reason = 'manual', replyId = null) {
    const item = this.items.get(String(id));
    if (!item) return { ok: true, missing: true, ...this.status() };
    item.resolvedAt = this.now();
    item.reason = reason;
    item.replyId = replyId;
    await this.save();
    return { ok: true, ...this.status() };
  }
  async flush() {
    await this.queue;
  }
}
