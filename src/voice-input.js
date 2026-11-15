import { observeCapability } from './capability-diagnostics.js';
import { resemblesPlayback } from './voice-activity.js';
import { normalizeTranscript } from './transcript-normalization.js';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { FFMPEG } from './voice-audio.js';
const get = (ctx, key) => {
  try {
    return ctx.get?.(key) || ctx[key];
  } catch {
    return null;
  }
};
export function speechWavInfo(audio, maxSeconds) {
  if (
    !Buffer.isBuffer(audio) ||
    audio.length < 44 ||
    audio.length > 1024 * 1024 ||
    audio.toString('ascii', 0, 4) !== 'RIFF' ||
    audio.toString('ascii', 8, 12) !== 'WAVE'
  )
    throw Error('請提供有效 PCM WAV');
  let bytesPerSecond = 0;
  for (let at = 12; at + 8 <= audio.length;) {
    const length = audio.readUInt32LE(at + 4),
      tag = audio.toString('ascii', at, at + 4);
    if (length > audio.length - at - 8) throw Error('WAV 長度不完整');
    if (tag === 'fmt ') {
      if (
        length < 16 ||
        audio.readUInt16LE(at + 8) !== 1 ||
        audio.readUInt16LE(at + 10) !== 1 ||
        audio.readUInt32LE(at + 12) !== 16000 ||
        audio.readUInt16LE(at + 22) !== 16
      )
        throw Error('STT 使用16kHz單聲道PCM16 WAV');
      bytesPerSecond = 32000;
    }
    if (tag === 'data' && bytesPerSecond) {
      const seconds = length / bytesPerSecond;
      if (seconds <= 0 || seconds > maxSeconds) throw Error('語音輸入超過單句時長上限');
      return seconds;
    }
    at += 8 + length + (length % 2);
  }
  throw Error('WAV 缺少音訊資料');
}
function toWav(pcm, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      FFMPEG,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-f',
        's16le',
        '-ar',
        '48000',
        '-ac',
        '2',
        '-i',
        'pipe:0',
        '-ar',
        '16000',
        '-ac',
        '1',
        '-f',
        's16le',
        'pipe:1',
      ],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] },
    );
    const chunks = [];
    let size = 0,
      failed = false;
    const abort = () => {
        failed = true;
        child.kill();
      },
      timer = setTimeout(abort, 10000),
      clean = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
      };
    signal.addEventListener('abort', abort, { once: true });
    child.on('error', () => {
      clean();
      reject(Error('STT 音訊轉換器無法啟動'));
    });
    child.stdout.on('data', (b) => {
      size += b.length;
      if (size > 1024 * 1024) abort();
      else chunks.push(b);
    });
    child.stdin.on('error', () => {});
    child.on('close', (code) => {
      clean();
      if (code || failed || signal.aborted || !size) return reject(Error('STT 音訊轉換未完成'));
      const h = Buffer.alloc(44);
      h.write('RIFF');
      h.writeUInt32LE(size + 36, 4);
      h.write('WAVEfmt ', 8);
      h.writeUInt32LE(16, 16);
      h.writeUInt16LE(1, 20);
      h.writeUInt16LE(1, 22);
      h.writeUInt32LE(16000, 24);
      h.writeUInt32LE(32000, 28);
      h.writeUInt16LE(2, 32);
      h.writeUInt16LE(16, 34);
      h.write('data', 36);
      h.writeUInt32LE(size, 40);
      resolve(Buffer.concat([h, ...chunks]));
    });
    child.stdin.end(pcm);
    if (signal.aborted) abort();
  });
}
export class VoiceInput {
  constructor({ ctx, voice, getConfig, onTranscript, onInterrupt, onCandidate }) {
    Object.assign(this, { ctx, voice, getConfig, onTranscript, onInterrupt, onCandidate });
    this.pending = new Set();
    this.users = new Set();
    this.recent = [];
    this.decisions = [];
  }
  enabled() {
    const c = this.getConfig();
    return !!(
      c.enabled !== false &&
      !c.dryRun &&
      c.voiceReceiveEnabled &&
      c.voiceReceiveConsent &&
      c.voiceReceiveUserIds?.length
    );
  }
  status() {
    if (!this.getConfig().voiceSubtitles) this.recent = [];
    this.recent = this.recent.filter((r) => Date.now() - r.at < 300000);
    const stt = get(this.ctx, 'speechToText');
    let snapshot;
    try {
      snapshot = stt?.snapshot?.();
    } catch {}
    return {
      enabled: this.enabled(),
      available: !!stt?.transcribe,
      providers: (snapshot?.providers || []).map((p) => ({
        id: p.id,
        name: p.name,
        location: p.location,
        phase: p.preparation?.phase,
      })),
      pending: this.pending.size,
      decisions: this.decisions.filter((r) => Date.now() - r.at < 300000),
      recent: this.getConfig().voiceSubtitles ? this.recent.slice(-10) : [],
      note: '使用者帳號／Bot 各自綁定的房間及明確允許的使用者。音訊留在記憶體，送至選定 STT；不保存錄音，預設不自動回覆。',
    };
  }
  policy(userId, { allowBusy = false, kind = 'bot' } = {}) {
    const c = this.getConfig(),
      s = this.voice.session(kind);
    if (
      (this.voice.canReceive && !this.voice.canReceive(s)) ||
      !this.enabled() ||
      !s.receiving ||
      !s.textChannelId ||
      userId === s.selfId ||
      !c.voiceReceiveUserIds.includes(userId)
    )
      throw Error('語音輸入未啟用或使用者未允許');
    if (!allowBusy && (this.pending.size >= 2 || this.users.has(kind + ':' + userId)))
      throw Error('語音辨識忙碌中');
    return { c, s };
  }
  interrupt(userId, confirmed = true, kind = 'bot') {
    try {
      const { c, s } = this.policy(userId, { kind }),
        j = s.current;
      const target = {
        session: s,
        jobId: j?.type === 'speech' ? j.id : null,
        text: j?.type === 'speech' && j.phase === 'playing' ? j.text : '',
        replyTarget: this.onCandidate?.(userId, s),
        at: Date.now(),
      };
      if (confirmed && c.voiceInterruptOnSpeech && c.voiceInterruptMode === 'acoustic')
        this.commitInterrupt(userId, target, '持續發聲已達門檻');
      return target;
    } catch {
      return null;
    }
  }
  commitInterrupt(userId, target, reason) {
    if (!target || target.committed) return;
    const { c, s } = this.policy(userId, { allowBusy: true, kind: target.session.kind || 'bot' });
    if (!c.voiceInterruptOnSpeech || s !== target.session || Date.now() - target.at > 45000) return;
    target.committed = true;
    const current = s.current;
    if (target.jobId && current?.id === target.jobId)
      this.voice.interruptForInput(s.kind || 'bot', target.jobId);
    this.onInterrupt?.(userId, s, target.replyTarget);
    this.decision(userId, reason);
  }
  decision(userId, reason) {
    this.decisions = this.decisions
      .filter((r) => Date.now() - r.at < 300000)
      .concat({ userId, reason, at: Date.now() })
      .slice(-10);
  }
  async acceptPcm(userId, pcm, { speechContext, kind = 'bot' } = {}) {
    const { c, s } = this.policy(userId, { kind });
    if (!pcm?.length || pcm.length > c.voiceInputMaxSeconds * 192000) throw Error('語音輸入超過上限');
    const target = speechContext || this.interrupt(userId, false, kind),
      controller = new AbortController();
    controller.kind = kind;
    controller.session = s;
    controller.kind = kind;
    controller.inputReadyAt = Date.now();
    this.pending.add(controller);
    this.users.add(kind + ':' + userId);
    try {
      return await this.run(userId, await toWav(pcm, controller.signal), controller, target);
    } finally {
      this.pending.delete(controller);
      this.users.delete(kind + ':' + userId);
    }
  }
  async acceptWav(userId, audio, { kind = 'bot' } = {}) {
    const { s } = this.policy(userId, { kind });
    const target = this.interrupt(userId, false, kind),
      controller = new AbortController();
    controller.session = s;
    controller.kind = kind;
    controller.inputReadyAt = Date.now();
    this.pending.add(controller);
    this.users.add(kind + ':' + userId);
    try {
      return await this.run(userId, audio, controller, target);
    } finally {
      this.pending.delete(controller);
      this.users.delete(kind + ':' + userId);
    }
  }
  async run(userId, audio, controller, target) {
    const kind = controller.kind || 'bot',
      c = this.getConfig(),
      s = this.voice.session(kind);
    if (
      controller.session !== s ||
      (this.voice.canReceive && !this.voice.canReceive(s)) ||
      !this.enabled() ||
      !s.receiving ||
      !c.voiceReceiveUserIds.includes(userId)
    )
      throw Error('語音輸入已停止');
    const seconds = speechWavInfo(audio, c.voiceInputMaxSeconds),
      stt = get(this.ctx, 'speechToText');
    if (!stt?.resolve || !stt.transcribe) throw Error('請先在 DSH 啟用並準備語音輸入模型');
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]),
      spec = stt.resolve({
        audio,
        providerId: c.voiceSttProvider || undefined,
        language: c.voiceSttLanguage || 'auto',
      }),
      u = (this.voice.usage.days[this.voice.day()] ||= {
        characters: 0,
        playedMs: 0,
        completed: 0,
        failed: 0,
      });
    if (c.voiceSttDailySeconds > 0 && (u.sttSeconds || 0) + seconds > c.voiceSttDailySeconds)
      throw Error('今日 STT 秒數預算不足');
    u.sttSeconds = (u.sttSeconds || 0) + seconds;
    this.voice.noteUsage?.(this.voice.scopeForChannel?.(s), { sttSeconds: seconds });
    await this.voice.save();
    signal.throwIfAborted();
    if (
      !this.enabled() ||
      !this.getConfig().voiceReceiveUserIds.includes(userId) ||
      this.voice.sessions.get(kind) !== s ||
      s.closed ||
      (s.adapter && !s.adapter.connected)
    )
      throw Error('語音輸入已停止');
    const sttStartedAt = Date.now(),
      result = await observeCapability(
        this.ctx,
        'stt.selected',
        'transcribe',
        () => stt.transcribe(spec, signal),
        { outcome: (r) => (r?.text?.trim() ? 'passed' : 'unconfirmed') },
      );
    const sttMs = Date.now() - sttStartedAt;
    signal.throwIfAborted();
    const current = this.getConfig();
    if (
      !this.enabled() ||
      !current.voiceReceiveUserIds.includes(userId) ||
      this.voice.sessions.get(kind) !== s ||
      s.closed ||
      (s.adapter && !s.adapter.connected)
    )
      throw Error('語音輸入已停止');
    this.voice.check(s);
    if (this.voice.canReceive && !this.voice.canReceive(s)) throw Error('目前已暫停語音收聽或由另一介面接手');
    const { text, normalization } = normalizeTranscript(result.text, current, { maxChars: 2000 });
    if (!text) return { ok: true, empty: true };
    if (current.voiceInputEchoGuard !== false && target?.text && resemblesPlayback(text, target.text)) {
      this.decision(userId, '辨識文字接近當時 AI 配音，略過疑似回音');
      return { ok: true, echoIgnored: true, submitted: false };
    }
    if (
      current.voiceInterruptMode !== 'acoustic' &&
      (/^[停止等]$/.test(text.trim()) || text.replace(/[^\p{L}\p{N}]/gu, '').length >= 2)
    )
      this.commitInterrupt(userId, target, '語音辨識確認後中止');
    const row = {
      id: 'voice-' + randomUUID(),
      kind,
      userId,
      text,
      normalization,
      at: Date.now(),
      audioSeconds: seconds,
      voiceTiming: { inputReadyAt: controller.inputReadyAt, sttMs },
    };
    if (current.voiceSubtitles) {
      this.recent.push(row);
      this.recent = this.recent.slice(-10);
    }
    if (current.voiceReceiveAutoReply) await this.onTranscript?.(row, s);
    return { ok: true, ...row, submitted: !!current.voiceReceiveAutoReply };
  }
  close(kind) {
    for (const c of this.pending) if (!kind || c.kind === kind) c.abort();
    this.recent = kind ? this.recent.filter((r) => r.kind !== kind) : [];
    this.decisions = [];
  }
}
