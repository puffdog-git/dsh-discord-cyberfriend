export class AudioReplay {
  constructor({ enabled = () => false, now = Date.now, ttl = 180000, limit = 32 * 1024 * 1024 } = {}) {
    Object.assign(this, { enabled, now, ttl, limit });
    this.rows = new Map();
  }
  prune() {
    if (!this.enabled()) {
      this.rows.clear();
      return;
    }
    for (const [id, row] of this.rows) if (row.until <= this.now()) this.rows.delete(id);
  }
  put(id, scope, data, meta = {}) {
    this.prune();
    if (!this.enabled() || !id || !data?.length || data.length > 16 * 1024 * 1024) return;
    this.rows.set(id, { id, scope, data: Buffer.from(data), meta, until: this.now() + this.ttl });
    while (
      this.rows.size > 8 ||
      [...this.rows.values()].reduce((sum, row) => sum + row.data.length, 0) > this.limit
    )
      this.rows.delete(this.rows.keys().next().value);
  }
  get(id, scope) {
    this.prune();
    const row = this.rows.get(id);
    if (!row || row.scope !== scope)
      throw Error('找不到此對話可重播的音訊，可能已過期；不會自動重新付費合成');
    return { ...row, data: Buffer.from(row.data) };
  }
  list() {
    this.prune();
    return [...this.rows.values()].map(({ id, until, meta }) => ({
      id,
      until,
      kind: meta.kind,
      channelId: meta.channelId,
      delivery: meta.delivery,
    }));
  }
  clear() {
    this.rows.clear();
  }
}
export function pcmWav(bytes) {
  const b = Buffer.alloc(44 + bytes.length);
  b.write('RIFF');
  b.writeUInt32LE(b.length - 8, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(24000, 24);
  b.writeUInt32LE(48000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(bytes.length, 40);
  bytes.copy(b, 44);
  return b;
}
