import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { attachVoiceReceiver } from './voice-receive.js';
import { VoiceMixer } from './voice-mixer.js';
import { musicPcm } from './voice-stream.js';
import { FFMPEG } from './voice-audio.js';
export class UserVoice {
  constructor(transport) {
    this.transport = transport;
    this.connected = false;
    this.supportsMixing = true;
    this.streamStarts = new Map();
    transport.voiceOutput = this;
  }
  async join({ guildId, channelId, receive, onUnavailable }) {
    this.nonce = randomUUID();
    Object.assign(this, { guildId, channelId, receive, onUnavailable, selfId: this.transport.selfId });
    const r = await this.transport.rpc(
      'voice_join',
      { guildId, channelId, nonce: this.nonce, receive: !!receive, expectedSelfId: this.selfId },
      30000,
    );
    if (!r.ok) throw Error(r.error || '使用者帳號語音連線失敗');
    this.connected = true;
    this.inputs = new Map();
    const speaking = new EventEmitter();
    this.receiver = {
      speaking,
      subscribe: (id) => {
        const stream = new PassThrough({ objectMode: true, highWaterMark: 50 });
        const row = { stream, timer: null };
        this.inputs.set(id, row);
        stream.once('close', () => {
          clearTimeout(row.timer);
          if (this.inputs.get(id) === row) this.inputs.delete(id);
        });
        return stream;
      },
    };
    if (receive)
      this.receiveClose = attachVoiceReceiver(
        { receiver: this.receiver },
        { EndBehaviorType: { AfterSilence: 1 } },
        receive,
      );
    return r;
  }
  packet(p) {
    if (!this.connected || this.transport.selfId !== this.selfId || p.nonce !== this.nonce) return;
    if (p.event === 'voice_stream_started') {
      this.streamStarts.get(p.streamId)?.();
      return;
    }
    if (p.event === 'voice_receive_error') {
      this.receive?.onError?.('使用者帳號語音封包未通過解密或格式驗證');
      return;
    }
    if (
      p.event !== 'voice_opus' ||
      !this.receive?.allowed(p.userId) ||
      p.accountId !== this.selfId ||
      p.channelId !== this.channelId ||
      p.guildId !== this.guildId ||
      typeof p.opus !== 'string' ||
      p.opus.length > 5500
    )
      return;
    const opus = Buffer.from(p.opus, 'base64');
    if (!opus.length || opus.length > 4000 || opus.toString('base64') !== p.opus) return;
    if (!this.inputs.has(p.userId)) {
      if (this.inputs.size >= 2) return;
      this.receiver.speaking.emit('start', p.userId);
    }
    const row = this.inputs.get(p.userId);
    if (!row) return;
    clearTimeout(row.timer);
    if (!row.stream.write(opus)) {
      row.stream.destroy();
      this.receive.onError?.('語音接收忙碌，已丟棄本句');
      return;
    }
    row.timer = setTimeout(() => row.stream.end(), 800);
  }
  async refresh() {
    const r = await this.transport.rpc('voice_status', {}, 5000);
    if (
      !r.ok ||
      !r.connected ||
      (r.channelId && r.channelId !== this.channelId) ||
      (this.receive && r.receiving === false)
    ) {
      if (this.connected) {
        this.connected = false;
        this.shutdownReceive();
        this.onUnavailable?.('使用者帳號語音連線中斷');
      }
    }
  }
  lost(reason = '使用者帳號Gateway已斷線') {
    if (!this.connected) return;
    this.connected = false;
    this.shutdownReceive();
    this.mixer?.stop();
    this.mixer = null;
    this.onUnavailable?.(reason);
  }
  shutdownReceive() {
    this.receiveClose?.();
    this.receiveClose = null;
    for (const r of this.inputs?.values() || []) {
      clearTimeout(r.timer);
      r.stream.destroy();
    }
    this.inputs?.clear();
    this.receive?.onStop?.();
  }
  async play(path, options) {
    if (this.mixer?.accepting) {
      const pcm = musicPcm(path, options.signal);
      try {
        const r = await this.mixer.add('voice', pcm.stream, options);
        if (r.ok) await pcm.done;
        return r;
      } finally {
        await pcm.remove();
      }
    }
    const abort = () => void this.transport.rpc('voice_stop', {}, 5000);
    options.signal?.addEventListener('abort', abort, { once: true });
    try {
      if (options.signal?.aborted) return { ok: false, interrupted: true };
      return await this.transport.rpc(
        'voice_play',
        { path, ffmpeg: FFMPEG, durationMs: options.durationMs, expectedSelfId: this.selfId },
        options.durationMs + 20000,
      );
    } finally {
      options.signal?.removeEventListener('abort', abort);
    }
  }
  playStream(stream, options) {
    return this.mixer?.accepting ? this.mixer.add('voice', stream, options) : this.playRaw(stream, options);
  }
  async playRaw(stream, { signal, durationMs = 180000, onStarted } = {}) {
    const streamId = randomUUID(),
      params = { streamId, durationMs, expectedSelfId: this.selfId, nonce: this.nonce };
    let opened = false,
      started = false;
    const began = () => {
        if (!started) {
          started = true;
          onStarted?.();
        }
      },
      abort = () => {
        stream.destroy?.(Error('串流播放已停止'));
        void this.transport.rpc('voice_stop', {}, 5000);
      };
    this.streamStarts.set(streamId, began);
    signal?.addEventListener('abort', abort, { once: true });
    const expires = Date.now() + durationMs + 15000;
    try {
      signal?.throwIfAborted();
      const r = await this.transport.rpc('voice_stream_start', params, 5000);
      if (!r.ok) throw Error(r.error || '無法開始PCM播放');
      opened = true;
      let sequence = 0;
      for await (const b of stream) {
        if (!Buffer.isBuffer(b) || b.length % 4) throw Error('PCM串流格式不正確');
        for (let at = 0; at < b.length; at += 38400) {
          const pcm = b.subarray(at, at + 38400).toString('base64');
          let accepted = false;
          while (!accepted) {
            signal?.throwIfAborted();
            if (!this.connected || this.transport.selfId !== this.selfId || Date.now() > expires)
              throw Error('語音串流已失效或逾時');
            const sent = await this.transport.rpc('voice_stream_write', { ...params, pcm, sequence }, 5000);
            if (!sent.ok) throw Error(sent.error || 'PCM串流交付失敗');
            if (sent.started) began();
            accepted = !!sent.accepted;
            if (!accepted) await new Promise((r) => setTimeout(r, 20));
          }
          sequence++;
        }
      }
      signal?.throwIfAborted();
      const end = await this.transport.rpc('voice_stream_end', params, 5000);
      if (!end.ok) throw Error('PCM串流結束未確認');
      const result = await this.transport.rpc('voice_stream_wait', params, durationMs + 20000);
      opened = false;
      if (result.started) began();
      return result;
    } catch {
      return {
        ok: false,
        started,
        interrupted: !!signal?.aborted,
        error: '使用者帳號PCM播放未完成，不自動重播',
      };
    } finally {
      signal?.removeEventListener('abort', abort);
      this.streamStarts.delete(streamId);
      if (opened) {
        await this.transport.rpc('voice_stop', {}, 5000).catch(() => {});
        await this.transport.rpc('voice_stream_wait', params, 5000).catch(() => {});
      }
    }
  }
  async playMusic(path, { signal, durationMs, duck = 0.2 } = {}) {
    if (this.mixer?.accepting) throw Error('混音軌道已在使用');
    const mixer = new VoiceMixer({ duck }),
      pcm = musicPcm(path, signal);
    this.mixer = mixer;
    const track = mixer.add('music', pcm.stream, { signal }),
      playback = this.playRaw(mixer, { signal, durationMs });
    try {
      const result = await track;
      if (result.ok) await pcm.done;
      const sent = await playback;
      return { ...result, ok: result.ok && sent.ok };
    } finally {
      mixer.stop();
      if (this.mixer === mixer) this.mixer = null;
      await pcm.remove();
    }
  }
  async stop() {
    this.mixer?.stop();
    this.mixer = null;
    return this.transport.rpc('voice_stop', {}, 5000);
  }
  async leave() {
    this.connected = false;
    this.shutdownReceive();
    this.mixer?.stop();
    this.mixer = null;
    return this.transport.rpc('voice_leave', {}, 5000);
  }
}
