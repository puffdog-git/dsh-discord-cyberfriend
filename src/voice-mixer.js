import { Readable } from 'node:stream';
// Exactly two bounded PCM48k stereo tracks. The player supplies backpressure.
export class VoiceMixer extends Readable {
  constructor({ duck = 0.2, fadeMs = 140, frameMs = 20 } = {}) {
    super({ highWaterMark: 3840 });
    Object.assign(this, { duck, fadeMs, frameMs });
    this.tracks = new Map();
    this.musicGain = 1;
    this.voiceGain = 0;
    this.demand = false;
    this.accepting = true;
    this.hadTrack = false;
    this.pumping = false;
    this.on('error', () => {});
  }
  _read() {
    this.demand = true;
    this.pump();
  }
  pump() {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.demand && this.accepting && this.frame()) {}
    } finally {
      this.pumping = false;
    }
  }
  _destroy(error, done) {
    this.accepting = false;
    for (const t of [...this.tracks.values()]) this.finish(t, false, error?.message || '混音已停止');
    done(error);
  }
  finish(t, ok, error) {
    if (t.settled) return;
    t.settled = true;
    this.tracks.delete(t.kind);
    t.signal?.removeEventListener('abort', t.abort);
    t.wake?.();
    t.source.destroy?.();
    queueMicrotask(() => this.pump());
    t.resolve({ ok, started: t.started, durationMs: t.bytes / 192, ...(error ? { error } : {}) });
  }
  add(kind, source, { signal, onStarted } = {}) {
    if (!this.accepting || !['music', 'voice'].includes(kind) || this.tracks.has(kind))
      throw Error('混音軌道已在使用或已關閉');
    this.hadTrack = true;
    let resolve;
    const result = new Promise((r) => (resolve = r)),
      t = {
        kind,
        source,
        signal,
        onStarted,
        resolve,
        buffer: Buffer.alloc(0),
        ended: false,
        settled: false,
        started: false,
        bytes: 0,
      };
    t.abort = () => this.finish(t, false, '音軌已停止');
    this.tracks.set(kind, t);
    signal?.addEventListener('abort', t.abort, { once: true });
    if (signal?.aborted) t.abort();
    void (async () => {
      try {
        for await (const b of source) {
          if (t.settled) break;
          if (!Buffer.isBuffer(b) || b.length % 4 || b.length > 1024 * 1024)
            throw Error('混音 PCM 格式不正確');
          t.buffer = Buffer.concat([t.buffer, b]);
          this.pump();
          while (t.buffer.length >= 192000 && !t.settled) await new Promise((r) => (t.wake = r));
        }
        t.ended = true;
        this.pump();
      } catch {
        this.finish(t, false, '音軌資料中斷');
      }
    })();
    return result;
  }
  frame() {
    if (!this.demand || !this.accepting) return;
    for (const t of [...this.tracks.values()]) if (t.ended && !t.buffer.length) this.finish(t, true);
    if (!this.tracks.size) {
      if (this.hadTrack) {
        this.accepting = false;
        this.push(null);
      }
      return;
    }
    const music = this.tracks.get('music'),
      voice = this.tracks.get('voice');
    // Only consume complete stereo frames until EOF; pipe chunk boundaries are not audio frames.
    const ready = (t) => t && (t.buffer.length >= 3840 || (t.ended && t.buffer.length));
    const musicReady = ready(music),
      voiceReady = ready(voice);
    if (!musicReady && !voiceReady) return false;
    const frame = Buffer.alloc(3840),
      speech = !!voice && (voice.started || !!voice.buffer.length),
      step = this.frameMs / Math.max(this.frameMs, this.fadeMs),
      target = speech ? this.duck : 1;
    this.musicGain += Math.sign(target - this.musicGain) * Math.min(step, Math.abs(target - this.musicGain));
    this.voiceGain = speech ? Math.min(1, this.voiceGain + this.frameMs / 40) : 0;
    for (const t of [music, voice])
      if (ready(t) && !t.started) {
        t.started = true;
        t.onStarted?.();
      }
    for (let i = 0; i < 3840; i += 2) {
      const m = musicReady && i + 1 < music.buffer.length ? music.buffer.readInt16LE(i) : 0,
        v = voiceReady && i + 1 < voice.buffer.length ? voice.buffer.readInt16LE(i) : 0;
      frame.writeInt16LE(
        Math.max(-32768, Math.min(32767, Math.round(m * this.musicGain + v * this.voiceGain))),
        i,
      );
    }
    for (const t of [music, voice])
      if (ready(t)) {
        const used = Math.min(3840, t.buffer.length);
        t.bytes += used;
        t.buffer = t.buffer.subarray(used);
        if (t.buffer.length < 192000) t.wake?.();
      }
    this.demand = this.push(frame);
    return true;
  }
  stop() {
    this.destroy();
  }
}
