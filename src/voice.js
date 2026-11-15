import { UserVoice } from './voice-user.js';
import { observeCapability } from './capability-diagnostics.js';
import { SpeechTextQueue } from './incremental-speech.js';
import { CoalescedWriter } from './util.js';
import { AudioReplay, pcmWav } from './audio-replay.js';
import { VoiceInput } from './voice-input.js';
import { prepareVoiceStream } from './voice-stream.js';
import { createJapaneseSpeech } from './speech-language.js';
import { resolveDirection } from './speech-direction.js';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { BotVoice } from './voice-bot.js';
import {
  audioFile,
  prepareVoiceAudio,
  FFMPEG,
  musicRequest,
  DIRECT_AUDIO_PROCESSING,
} from './voice-audio.js';
import { redactSensitive } from './security.js';
import { DiscordTts } from './tts-adapters.js';
import { mergeTtsAudio } from './tts-audio.js';
const currentReceiveAllowed = (kind, c) =>
  c.enabled !== false &&
  !c.dryRun &&
  c[kind + 'Enabled'] !== false &&
  (kind !== 'user' || c.userReceiveOnly === false);
const discordId = (x) => /^\d{15,22}$/.test(String(x || ''));
async function abortable(work, signal) {
  if (signal.aborted) throw Error('播放已取消');
  let abort;
  const cancelled = new Promise((_, reject) => {
    abort = () => reject(Error('播放已取消'));
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    return await Promise.race([work, cancelled]);
  } finally {
    signal.removeEventListener('abort', abort);
  }
}
export class DiscordVoice {
  constructor({
    ctx,
    getConfig,
    getManager,
    file,
    log,
    now = () => Date.now(),
    adapterFactory,
    prepare = prepareVoiceAudio,
    makeFile = audioFile,
    prepareStream = prepareVoiceStream,
    onTranscript,
    onInputInterrupt,
    onInputCandidate,
    scopeForChannel,
    musicProviders,
  }) {
    Object.assign(this, {
      ctx,
      getConfig,
      getManager,
      file,
      log,
      now,
      prepare,
      makeFile,
      prepareStream,
      scopeForChannel,
    });
    this.adapters = adapterFactory || ((kind, t) => (kind === 'bot' ? new BotVoice(t) : new UserVoice(t)));
    this.input = new VoiceInput({
      ctx,
      voice: this,
      getConfig,
      onTranscript,
      onInterrupt: onInputInterrupt,
      onCandidate: onInputCandidate,
    });
    this.replays = new AudioReplay({ enabled: () => !!getConfig().voiceReplayEnabled, now });
    this.musicProviders = musicProviders;
    this.japanese = createJapaneseSpeech({ ctx });
    this.tts = new DiscordTts({ ctx, getConfig, mergeAudio: mergeTtsAudio });
    this.captions = [];
    this.sessions = new Map();
    this.joining = new Set();
    this.joinGeneration = new Map();
    this.work = new Set();
    this.usage = { days: {} };
    this.saves = Promise.resolve();
    this.closed = false;
  }
  async init() {
    try {
      this.usage = JSON.parse(await readFile(this.file, 'utf8'));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    this.timer = setInterval(() => void this.tick().catch(() => {}), 1000);
    this.timer.unref?.();
  }
  async diagnostics() {
    await this.tts.refresh();
    let bot;
    try {
      const v = await import('@discordjs/voice'),
        r = v.generateDependencyReport();
      bot = {
        available: /@snazzah\/davey: (?!not found)\S+/.test(r) && /libopus: yes/.test(r),
        dave: /@snazzah\/davey: (?!not found)\S+/.test(r),
        ffmpeg: /libopus: yes/.test(r),
      };
    } catch {
      bot = { available: false, error: 'Bot 語音依賴無法載入' };
    }
    const user = this.getManager().byKind.user;
    const r = user?.ready
      ? await user.rpc('voice_status', {}, 5000)
      : { available: false, error: '個人帳號尚未連線' };
    return {
      ok: true,
      node: process.versions.node,
      bot,
      user: { available: !!r.available, error: r.error || null },
      tts: this.status().tts,
    };
  }
  caption(s, j, phase, meta = {}) {
    if (!this.getConfig().voiceSubtitles) {
      this.captions = [];
      return;
    }
    const old = this.captions.find((r) => r.id === j.id) || {
      id: j.id,
      kind: s.kind,
      channelId: s.channelId,
      sourceText: j.sourceText || j.text,
      spokenText: j.text,
    };
    Object.assign(old, { phase, at: this.now(), ...meta });
    old.sourceText = String(old.sourceText || '').slice(0, 3000);
    old.spokenText = String(old.spokenText || '').slice(0, 3000);
    this.captions = this.captions
      .filter((r) => r.id !== j.id && this.now() - r.at < 300000)
      .concat(old)
      .slice(-20);
  }
  noteUsage(scope, metrics) {
    const u = (this.usage.days[this.day()] ||= { characters: 0, playedMs: 0, completed: 0, failed: 0 });
    u.scopes ||= {};
    const key =
        scope &&
        !['__proto__', 'constructor', 'prototype'].includes(scope) &&
        (Object.hasOwn(u.scopes, scope) || Object.keys(u.scopes).length < 200)
          ? scope
          : 'unscoped',
      r = (u.scopes[key] ||= { characters: 0, playedMs: 0, sttSeconds: 0 });
    for (const [k, v] of Object.entries(metrics)) r[k] = (r[k] || 0) + v;
  }
  day() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(this.now()));
  }
  save() {
    this.writer ||= new CoalescedWriter(async () => {
      await mkdir(dirname(this.file), { recursive: true });
      const keys = Object.keys(this.usage.days).sort();
      for (const k of keys.slice(0, -100)) delete this.usage.days[k];
      await writeFile(this.file + '.tmp', JSON.stringify(this.usage) + '\n');
      await rename(this.file + '.tmp', this.file);
    });
    return (this.saves = this.writer.save());
  }
  speech() {
    return this.tts;
  }
  policy(kind) {
    const c = this.getConfig(),
      t = this.getManager().byKind[kind];
    if (
      this.closed ||
      !['user', 'bot'].includes(kind) ||
      !c.enabled ||
      !c.voiceEnabled ||
      c.dryRun ||
      !t?.ready ||
      c[kind === 'user' ? 'userEnabled' : 'botEnabled'] === false
    )
      throw Error('語音未啟用、帳號未連線或仍在演練模式');
    if (kind === 'user' && c.userReceiveOnly !== false) throw Error('僅觀察模式禁止加入或播放語音');
    return { c, t };
  }
  check(s) {
    const p = this.policy(s.kind);
    if (
      s.closed ||
      this.sessions.get(s.kind) !== s ||
      p.t.selfId !== s.selfId ||
      (p.c.voiceAllowedChannelIds?.length && !p.c.voiceAllowedChannelIds.includes(s.channelId))
    )
      throw Error('語音連線或允許房間已變更');
    return p;
  }
  status() {
    let capabilities = null;
    try {
      const c = this.speech()?.capabilities();
      if (c) {
        const engine = c.engine || c.providers?.find((p) => p.id === c.provider);
        capabilities = {
          provider: c.provider,
          adapter: c.adapter,
          serviceId: c.serviceId || null,
          speechInstruction: engine?.speechInstruction,
          ready: !!engine?.ready,
          name: c.engine?.name || c.provider,
          maxTextLength: engine?.maxTextLength,
          unavailableReason: engine?.unavailableReason || null,
          // 給「聲音工坊 → 語音交付」顯示連線方式：宿主內服務不經網路；HTTP 接法回報連到哪個位址（只有來源，不含路徑與金鑰）。
          link: (() => {
            try {
              if (c.adapter === 'service') return { mode: 'service' };
              const base = this.speech()?.snapshot?.base;
              return base ? { mode: 'http', origin: new URL(base).origin } : { mode: 'http', origin: null };
            } catch {
              return null;
            }
          })(),
        };
      }
    } catch {}
    const cfg = this.getConfig();
    return {
      ok: true,
      enabled: !!cfg.voiceEnabled,
      tts: capabilities,
      receiveSupported: true,
      audioProcessing: DIRECT_AUDIO_PROCESSING,
      incremental: this.lastIncremental || null,
      input: this.input.status(),
      captions: this.getConfig().voiceSubtitles
        ? this.captions.filter((r) => this.now() - r.at < 300000)
        : [],
      receiveNote:
        '收聽預設關閉；需明確啟用、確認同意及指定使用者與房間。兩種帳號共用名單與STT預算；同房共用回覆模式只由一個介面收聽。',
      idleMinutes: cfg.voiceIdleMinutes,
      sessions: [...this.sessions.values()].map((s) => ({
        kind: s.kind,
        channelId: s.channelId,
        guildId: s.guildId,
        textChannelId: s.textChannelId,
        selfId: s.selfId,
        connected: s.adapter.connected,
        receiving: !!s.receiving,
        receiveActive: this.canReceive(s),
        receivePausedForMusic: this.musicReceivePaused(s),
        connection: s.adapter.status || { phase: s.adapter.connected ? 'connected' : 'disconnected' },
        joinedAt: s.joinedAt,
        phase: s.closed ? 'leaving-error' : s.current ? s.current.phase : s.music ? 'music' : 'idle',
        current: s.current ? { id: s.current.id, type: s.current.type, label: s.current.label } : null,
        queue: s.queue.map((j) => ({ id: j.id, type: j.type, label: j.label })),
        music: s.music ? { id: s.music.id, label: s.music.label } : null,
        idleExitAt:
          !s.closed && !s.current && !s.music && !s.queue.length
            ? s.idleSince + cfg.voiceIdleMinutes * 60000
            : null,
        lastResult: s.lastResult || null,
        lastMusicResult: s.lastMusicResult || null,
      })),
      joining: [...this.joining],
      usage: {
        day: this.day(),
        ...(this.usage.days[this.day()] || { characters: 0, playedMs: 0, completed: 0, failed: 0 }),
        characterLimit: cfg.voiceDailyCharacterLimit || 0,
      },
      note: '播放成功表示本機傳輸完成，不能證明每個成員實際聽到；TTS 字數與秒數不包含在 LLM Token 預算。',
    };
  }
  async join({ kind = 'bot', channelId, guildId, textChannelId = '' }) {
    const { c, t } = this.policy(kind);
    if (!discordId(channelId) || !discordId(guildId) || (textChannelId && !discordId(textChannelId)))
      throw Error('請填寫有效的伺服器／語音／文字頻道 ID');
    if (c.voiceAllowedChannelIds?.length && !c.voiceAllowedChannelIds.includes(channelId))
      throw Error('請先把語音頻道加入允許清單並儲存');
    if (this.sessions.has(kind) || this.joining.has(kind)) throw Error('此帳號已加入或正在連線，請先離開');
    this.joining.add(kind);
    const generation = this.joinGeneration.get(kind) || 0,
      adapter = this.adapters(kind, t),
      selfId = t.selfId;
    try {
      if (textChannelId) {
        const r =
          kind === 'bot'
            ? await t.rest('GET', `/channels/${textChannelId}`)
            : await t.rpc('voice_text_channel', { channelId: textChannelId, guildId });
        if (kind === 'bot' ? r.guild_id !== guildId || ![0, 5, 15, 2].includes(r.type) : !r.ok)
          throw Error('綁定文字頻道必須位於相同伺服器');
      }
      const receiving = this.input.enabled();
      if (receiving && (!textChannelId || !this.input.status().available))
        throw Error('收聽需要綁定文字頻道，並先在 DSH 啟用語音輸入模型');
      const receive = receiving
        ? {
            allowed: (id) =>
              this.canReceive(this.sessions.get(kind)) &&
              this.input.enabled() &&
              this.getConfig().voiceReceiveUserIds.includes(id) &&
              currentReceiveAllowed(kind, this.getConfig()) &&
              id !== selfId,
            maxSeconds: c.voiceInputMaxSeconds,
            threshold: 0.015,
            onStop: () => this.input.close(kind),
            minSpeechMs: c.voiceInterruptMinMs,
            onAudio: (id, pcm, meta) => this.input.acceptPcm(id, pcm, { ...meta, kind }),
            onSpeech: (id) => this.input.interrupt(id, true, kind),
            onError: (reason) => this.log?.warn('voice.input', reason),
          }
        : undefined;
      await adapter.join({
        guildId,
        channelId,
        receive,
        onUnavailable: (reason) => this.connectionLost(kind, adapter, reason),
      });
      const current = this.policy(kind);
      if (
        this.closed ||
        (this.joinGeneration.get(kind) || 0) !== generation ||
        current.t.selfId !== selfId ||
        (current.c.voiceAllowedChannelIds?.length && !current.c.voiceAllowedChannelIds.includes(channelId))
      )
        throw Error('連線已取消或設定已變更');
      const s = {
        nonce: randomUUID(),
        kind,
        channelId,
        guildId,
        textChannelId,
        selfId,
        adapter,
        receiving,
        joinedAt: this.now(),
        idleSince: this.now(),
        queue: [],
        current: null,
        closed: false,
      };
      this.sessions.set(kind, s);
      this.log?.info('voice.join', '已加入語音頻道', { kind, channelId });
      return { ok: true, ...this.status() };
    } catch (e) {
      await adapter.leave().catch(() => {});
      throw e;
    } finally {
      this.joining.delete(kind);
    }
  }
  musicReceivePaused(s) {
    if (!s || this.getConfig().voiceMusicPauseReceiveEnabled === false) return false;
    return [...this.sessions.values()].some(
      (peer) =>
        !peer.closed &&
        peer.guildId === s.guildId &&
        peer.channelId === s.channelId &&
        (peer.music ||
          peer.current?.type === 'music' ||
          peer.queue?.some((job) => job.type === 'music' && job.offset > 0)),
    );
  }
  canReceive(s) {
    if (!s || !s.receiving || s.closed || this.musicReceivePaused(s)) return false;
    const c = this.getConfig();
    if (c.replyOwnership === 'separate') return true;
    const peers = [...this.sessions.values()].filter(
      (x) => x.receiving && !x.closed && x.guildId === s.guildId && x.channelId === s.channelId,
    );
    const owner =
      peers.find((x) => x.kind === c.primaryTransport) || peers.sort((a, b) => a.joinedAt - b.joinedAt)[0];
    return owner === s;
  }
  session(kind) {
    const s = this.sessions.get(kind);
    if (!s) throw Error('此帳號尚未加入語音頻道');
    this.check(s);
    return s;
  }
  pendingCharacters() {
    return [...this.sessions.values()].reduce(
      (n, s) => n + s.queue.concat(s.current || []).reduce((x, j) => x + (j.reservedCharacters || 0), 0),
      0,
    );
  }
  add(s, data) {
    this.check(s);
    if (s.queue.length >= 8) throw Error('語音佇列已滿（最多 8 筆），請稍後再試');
    const job = { id: randomUUID(), phase: 'queued', ...data };
    job.done = new Promise((r) => (job.resolve = r));
    if (job.type === 'speech') {
      const c = this.getConfig(),
        limit = c.voiceDailyCharacterLimit || 0;
      if (
        limit &&
        (this.usage.days[this.day()]?.characters || 0) +
          this.pendingCharacters() +
          (job.maxCharacters || job.text?.length || 0) >
          limit
      )
        throw Error('今日 TTS 字數預算不足');
      job.reservedCharacters = job.maxCharacters || job.text?.length || 0;
      const firstMusic = s.queue.findIndex((x) => x.type === 'music');
      s.queue.splice(firstMusic < 0 ? s.queue.length : firstMusic, 0, job);
      if (s.current?.type === 'music' && s.current.phase === 'playing') {
        s.current.resumeAfterSpeech = true;
        s.current.controller.abort();
      }
    } else s.queue.push(job);
    void observeCapability(this.ctx, 'discord.voice', 'voice-transmission', () => job.done, {
      outcome: (r) => (r?.uncertain ? 'unconfirmed' : r?.ok ? 'passed' : 'failed'),
      failure: (r) => r?.error || { diagnosticCode: r?.interrupted ? 'CANCELLED' : 'INVALID' },
    }).catch(() => {});
    const work = this.pump(s);
    this.work.add(work);
    work.then(
      () => this.work.delete(work),
      () => this.work.delete(work),
    );
    return job;
  }
  speak({
    kind = 'bot',
    text,
    automatic = false,
    sourceChannelId,
    signal,
    audio,
    speechInstruction,
    speechDirection,
    spokenText,
    sessionId,
    replayRef,
  }) {
    const s = this.session(kind),
      c = this.getConfig();
    sessionId ||= this.scopeForChannel?.(s);
    if (automatic && (!c.voiceAutoSpeak || sourceChannelId !== s.textChannelId))
      return { ok: true, skipped: true };
    if (!audio && !this.status().tts?.ready) throw Error('外部 TTS 尚未就緒，請先在語音插件設定金鑰與聲音');
    if (
      automatic &&
      kind === 'user' &&
      ((s.textChannelId && this.getManager().byKind.user.isPaused?.(s.textChannelId)) || !c.userAutoReply)
    )
      return { ok: true, skipped: true };
    text = redactSensitive(String(text || ''), c, { privateData: true }).text.trim();
    if (!text || text.length > c.voiceMaxTextChars)
      throw Error(`語音文字需為 1 至 ${c.voiceMaxTextChars} 字元`);
    const instruction =
      typeof speechInstruction === 'string'
        ? redactSensitive(speechInstruction, c, { privateData: true }).text.slice(0, 2000)
        : undefined;
    const job = this.add(s, {
      type: 'speech',
      text,
      sourceText: text,
      spokenText:
        typeof spokenText === 'string'
          ? redactSensitive(spokenText, c, { privateData: true }).text
          : undefined,
      spokenLanguage: c.voiceSpokenLanguage || 'original',
      speechInstruction: instruction,
      speechDirection,
      sessionId,
      label: text.slice(0, 50),
      automatic,
      sourceChannelId,
      externalSignal: signal,
      audio,
      replayRef,
    });
    return { ok: true, queued: true, id: job.id, done: job.done };
  }
  replayScope(s) {
    return [s.kind, s.selfId, s.channelId, s.textChannelId, s.nonce || s.joinedAt].join(':');
  }
  cacheReplay(s, j, bytes) {
    this.replays.put(j.replayRef || j.id, this.replayScope(s), bytes, {
      kind: s.kind,
      channelId: s.textChannelId,
      delivery: 'room',
      text: j.sourceText || j.text,
    });
  }
  replay({ kind, id }) {
    const s = this.session(kind);
    this.check(s);
    const row = this.replays.get(id, this.replayScope(s));
    return this.speak({
      kind,
      text: row.meta.text,
      audio: { data: row.data, mime: 'audio/wav' },
      replayRef: id,
      sourceChannelId: s.textChannelId,
    });
  }
  beginIncremental(
    message,
    transport,
    { signal, onStarted, maxChars = 1500, validate, modelStartedAt } = {},
  ) {
    const c = this.getConfig(),
      s = this.sessions.get(transport.kind);
    const reason = !c.voiceIncrementalReplies
      ? '未啟用模型增量語音'
      : !message.voiceInput
        ? '僅限真人語音對話'
        : message.simulated
          ? '模擬輸入不外送'
          : !s?.adapter.connected || s.guildId !== message.guildId || s.textChannelId !== message.channelId
            ? '尚未綁定此語音房'
            : !c.voiceAutoSpeak || c.voiceStreaming === false
              ? '自動朗讀或串流未啟用'
              : c.voiceSpokenLanguage === 'ja'
                ? '日文配音保留完整上下文翻譯'
                : !this.tts.canStream() || !s.adapter.playStream
                  ? '目前 TTS／帳號未提供 PCM 串流'
                  : null;
    if (reason) {
      this.lastIncremental = { at: this.now(), reason };
      return null;
    }
    this.check(s);
    const queue = new SpeechTextQueue(signal);
    let j;
    try {
      j = this.add(s, {
        type: 'speech',
        text: '',
        sourceText: '',
        maxCharacters: Math.min(c.voiceMaxTextChars, maxChars),
        automatic: true,
        sourceChannelId: message.channelId,
        externalSignal: signal,
        sessionId: this.scopeForChannel?.(s),
        label: '正在產生語音回覆',
        incremental: true,
        segments: queue,
        onStarted,
        validate,
        voiceTiming: message.voiceTiming,
        modelToFirstSentenceMs: modelStartedAt ? Math.max(0, this.now() - modelStartedAt) : undefined,
      });
    } catch (error) {
      queue.end();
      throw error;
    }
    j.done.then((result) => {
      if (!result.ok) queue.fail(Error(result.error || '增量語音已中止'));
      else queue.end();
    });
    this.lastIncremental = { at: this.now(), reason: '模型句段 → TTS → Discord，僅限無工具回覆' };
    return {
      get started() {
        return !!j.startedAt;
      },
      push: (text) => queue.push(text),
      end: () => queue.end(),
      cancel: (reason) => {
        queue.fail(Error(reason));
        j.cancelReason = reason;
        j.controller?.abort();
      },
      reference: (id) => (j.replayRef = id),
      done: j.done,
    };
  }
  async playIncremental(s, j, cfg, prepTimer) {
    const self = this,
      service = this.speech(),
      began = this.now(),
      chunks = [];
    const abortText = () => j.segments.fail(Error(j.cancelReason || '增量語音已取消'));
    j.controller.signal.addEventListener('abort', abortText, { once: true });
    if (j.controller.signal.aborted) abortText();
    let bytes = 0,
      retain = !!cfg.voiceReplayEnabled;
    const selection = (c) =>
      JSON.stringify([
        c.voiceTtsAdapter,
        c.voiceTtsService,
        c.voiceTtsBaseUrl,
        c.voiceTtsVoice,
        c.voiceTtsOptions,
        c.voiceSpokenLanguage,
      ]);
    const expected = selection(cfg);
    const source = async function* () {
      for await (const text of j.segments) {
        self.check(s);
        const current = self.getConfig();
        if (
          (j.validate && !j.validate()) ||
          selection(current) !== expected ||
          !current.voiceAutoSpeak ||
          !current.voiceIncrementalReplies
        )
          throw Error('語音設定已變更，停止增量回覆');
        j.controller.signal.throwIfAborted();
        if (j.text.length + text.length > j.maxCharacters) throw Error('增量語音超過文字上限');
        j.text += text;
        j.sourceText = j.text;
        const u = (self.usage.days[self.day()] ||= { characters: 0, playedMs: 0, completed: 0, failed: 0 });
        if (current.voiceDailyCharacterLimit && u.characters + text.length > current.voiceDailyCharacterLimit)
          throw Error('今日 TTS 字數預算不足');
        u.characters += text.length;
        j.reservedCharacters = Math.max(0, j.reservedCharacters - text.length);
        self.noteUsage(j.sessionId, { characters: text.length });
        await self.save();
        for await (const pcm of service.streamPcm({
          text,
          sourceText: text,
          spokenLanguage: 'original',
          voice: cfg.voiceTtsVoice || undefined,
          sessionId: j.sessionId,
          format: 'wav',
          maxDurationMs: cfg.voiceMaxSpeechSeconds * 1000,
          signal: j.controller.signal,
        })) {
          bytes += pcm.length;
          if (bytes > cfg.voiceMaxSpeechSeconds * 48000) throw Error('增量語音超過播放時長上限');
          if (retain) {
            if (bytes <= 16 * 1024 * 1024) chunks.push(Buffer.from(pcm));
            else {
              retain = false;
              chunks.length = 0;
            }
          }
          yield pcm;
        }
      }
    };
    const prepared = this.prepareStream(source(), {
      signal: j.controller.signal,
      volume: cfg.voiceVolume / 100,
    });
    prepared.done.catch(() => j.controller.abort());
    let result;
    try {
      j.phase = 'buffering';
      result = await s.adapter.playStream(prepared.stream, {
        signal: j.controller.signal,
        durationMs: cfg.voiceMaxSpeechSeconds * 1000,
        onStarted: () => {
          j.phase = 'playing';
          j.startedAt = this.now();
          j.firstAudioMs = this.now() - began;
          j.inputReadyToFirstAudioMs = j.voiceTiming?.inputReadyAt
            ? Math.max(0, this.now() - j.voiceTiming.inputReadyAt)
            : undefined;
          clearTimeout(prepTimer);
          j.onStarted?.();
        },
      });
      if (!result.ok) j.controller.abort();
      await prepared.done;
      j.controller.signal.throwIfAborted();
      if (!bytes) throw Error('沒有完整語音');
      const u = (this.usage.days[this.day()] ||= { characters: 0, playedMs: 0, completed: 0, failed: 0 }),
        elapsed = bytes / 48;
      u.playedMs += elapsed;
      this.noteUsage(j.sessionId, { playedMs: elapsed });
      u[result.ok ? 'completed' : 'failed']++;
      if (result.ok && retain && chunks.length) this.cacheReplay(s, j, pcmWav(Buffer.concat(chunks)));
      s.lastResult = {
        id: j.id,
        type: 'speech',
        ok: result.ok,
        streaming: true,
        streamMode: 'incremental',
        firstAudioMs: j.firstAudioMs,
        inputReadyToFirstAudioMs: j.inputReadyToFirstAudioMs,
        sttMs: j.voiceTiming?.sttMs,
        modelToFirstSentenceMs: j.modelToFirstSentenceMs,
        at: this.now(),
        error: result.error || null,
      };
      j.resolve(result);
      await this.save();
    } finally {
      j.controller.signal.removeEventListener('abort', abortText);
      j.segments.end();
      await prepared.remove().catch(() => {});
    }
  }
  /** 這則回覆送出後是否會自動朗讀；條件與 autoSpeak 相同，供組提示詞時決定要不要附語音段落。 */
  expectsSpeech(message, transport) {
    if (!this.getConfig().voiceAutoSpeak || message?.simulated || !message?.guildId) return false;
    const s = this.sessions.get(transport?.kind);
    return Boolean(s && s.guildId === message.guildId && s.textChannelId === message.channelId);
  }
  async autoSpeak(message, transport, text, meta = {}) {
    if (!this.getConfig().voiceAutoSpeak || message.simulated || !message.guildId) return;
    const s = this.sessions.get(transport.kind);
    if (!s || s.guildId !== message.guildId || s.textChannelId !== message.channelId) return;
    try {
      this.speak({
        kind: transport.kind,
        text,
        automatic: true,
        sourceChannelId: message.channelId,
        speechDirection: meta.speech,
        spokenText: meta.spokenText,
        sessionId: meta.sessionId,
        replayRef: meta.replyMessageId,
      });
    } catch (e) {
      this.log?.warn('voice.auto', '文字已送出，語音未排入', { reason: e.message });
    }
  }
  music({ kind = 'bot', path, provider, trackId, label = '', req }) {
    const s = this.session(kind);
    let route;
    if (this.musicProviders && /^(plugin|tool):/.test(provider || '')) {
      const job = this.add(s, {
        type: 'music',
        label: String(label || trackId).slice(0, 100),
        load: (signal) => this.musicProviders.load(provider, String(trackId), { signal, kind, session: s }),
        offset: 0,
      });
      return { ok: true, queued: true, id: job.id };
    }

    if (path && typeof path === 'string' && path.length < 1500)
      route = '/music/stream?' + new URLSearchParams({ path });
    else if (['netease', 'qq', 'kugou'].includes(provider) && /^[\w-]{1,150}$/.test(String(trackId || '')))
      route = '/music/online/stream?' + new URLSearchParams({ provider, id: String(trackId) });
    else throw Error('請選擇音樂插件中的曲目');
    const job = this.add(s, {
      type: 'music',
      label: String(label || '音樂').slice(0, 100),
      load: (signal) =>
        observeCapability(
          this.ctx,
          'music:music-panel',
          'load-audio',
          () => musicRequest(req, route, { signal, binary: true }),
          { outcome: (r) => (r?.byteLength ? 'passed' : 'unconfirmed') },
        ),
      offset: 0,
    });
    return { ok: true, queued: true, id: job.id };
  }
  playArtifact({ kind = 'bot', path, sourceChannelId, label = '翻唱成品', signal }) {
    const s = this.session(kind);
    this.check(s);
    if (!sourceChannelId || s.textChannelId !== sourceChannelId)
      throw Error('歌曲只能播放到綁定目前文字頻道的語音房');
    const job = this.add(s, {
      type: 'music',
      label: String(label).slice(0, 100),
      load: async (activeSignal) => {
        activeSignal.throwIfAborted();
        const bytes = await readFile(path);
        activeSignal.throwIfAborted();
        if (!bytes.length || bytes.length > 64 * 1024 * 1024) throw Error('歌曲播放檔案過大');
        return bytes;
      },
      externalSignal: signal,
      offset: 0,
    });
    return { ok: true, queued: true, id: job.id, done: job.done };
  }
  async library(req, query = {}) {
    if (query.provider && /^(plugin|tool):/.test(query.provider)) {
      const tracks = await this.musicProviders.search(query.provider, query.q, {
        signal: AbortSignal.timeout(10000),
      });
      return { ok: true, tracks };
    }
    const payload = await observeCapability(
      this.ctx,
      'music:music-panel',
      'read-library',
      () => musicRequest(req, '/music/library'),
      { outcome: (r) => (r?.ok === false ? 'failed' : 'unconfirmed') },
    );
    const q = String(query.q || '').toLowerCase();
    return {
      ok: true,
      tracks: (payload.tracks || [])
        .filter((t) => !q || `${t.title || ''} ${t.artist || ''} ${t.path || ''}`.toLowerCase().includes(q))
        .slice(0, 100)
        .map((t) => ({
          path: t.path,
          title: t.title || t.name || '音樂',
          artist: t.artist || '',
          duration: t.duration,
        })),
    };
  }
  async pump(s) {
    if (s.running || s.closed) return;
    s.running = true;
    try {
      while (s.queue.length && !s.closed) {
        if (s.music && s.queue[0]?.type === 'music') break;
        const j = s.queue.shift();
        s.current = j;
        if (j.type === 'music' && this.getConfig().voiceMusicPauseReceiveEnabled !== false) {
          for (const peer of this.sessions.values())
            if (peer.guildId === s.guildId && peer.channelId === s.channelId) this.input.close(peer.kind);
        }
        j.controller = new AbortController();
        const abort = () => j.controller.abort();
        j.externalSignal?.addEventListener('abort', abort, { once: true });
        if (j.externalSignal?.aborted) abort();
        const prepTimer = setTimeout(abort, 120000);
        prepTimer.unref?.();
        let prepared,
          requeue = false;
        try {
          this.check(s);
          if (j.controller.signal.aborted) throw Error('播放已取消');
          if (
            j.automatic &&
            (!this.getConfig().voiceAutoSpeak || this.getManager().byKind[s.kind].isPaused?.(s.textChannelId))
          )
            throw Error('自動語音已停用或人工接管');
          j.phase = 'preparing';
          const cfg = this.getConfig();
          await s.adapter.waitReady?.(j.controller.signal);
          this.check(s);
          if (j.incremental) {
            await this.playIncremental(s, j, cfg, prepTimer);
            continue;
          }
          if (!j.file) {
            let bytes;
            if (j.type === 'speech') {
              const service = this.speech();
              if (!service && !j.audio) throw Error('未連接可用的 TTS 插件');
              if (!j.audio && j.spokenLanguage === 'ja') {
                const translated = await this.japanese.prepare(
                  j.sourceText || j.text,
                  { ...cfg, voiceSpokenLanguage: 'ja' },
                  j.controller.signal,
                  { provided: j.spokenText, scope: j.sessionId || s.textChannelId },
                );
                j.text = redactSensitive(translated.text, cfg, { privateData: true }).text;
                if (j.text.length > cfg.voiceMaxTextChars)
                  throw Error('日文配音超過單次 TTS 文字上限，請調高上限或縮短回覆');
                j.translationOrigin = translated.origin;
                j.reservedCharacters = j.text.length;
              }
              if (!j.audio) {
                const day = this.day(),
                  u = (this.usage.days[day] ||= { characters: 0, playedMs: 0, completed: 0, failed: 0 });
                if (
                  cfg.voiceDailyCharacterLimit > 0 &&
                  u.characters + j.text.length > cfg.voiceDailyCharacterLimit
                )
                  throw Error('今日 TTS 字數預算不足');
                u.characters += j.text.length;
                this.noteUsage(j.sessionId, { characters: j.text.length });
                j.reservedCharacters = 0;
                await this.save();
              }
              if (j.controller.signal.aborted) throw Error('播放已取消');
              const request = {
                onPrepared: (meta) => {
                  j.captionMeta = {
                    sourceText: meta.sourceText,
                    spokenText: meta.text,
                    spokenLanguage: meta.spokenLanguage,
                  };
                  this.caption(s, j, 'buffering', j.captionMeta);
                },
                text: j.text,
                sourceText: j.sourceText,
                spokenLanguage: j.spokenLanguage,
                format: 'wav',
                maxDurationMs: cfg.voiceMaxSpeechSeconds * 1000,
                voice: cfg.voiceTtsVoice || undefined,
                ...(() => {
                  const selected = resolveDirection(cfg, j.speechDirection, j.speechInstruction);
                  j.direction = selected.direction;
                  j.directionSource = selected.source;
                  return {
                    speechInstruction: selected.instruction,
                    speechDirection: selected.direction,
                    sessionId: j.sessionId,
                  };
                })(),
                signal: j.controller.signal,
              };
              if (
                !j.audio &&
                cfg.voiceStreaming !== false &&
                typeof s.adapter.playStream === 'function' &&
                service.canStream?.()
              ) {
                this.check(s);
                j.streaming = true;
                j.phase = 'buffering';
                const began = this.now();
                const source = service.streamPcm({
                    ...request,
                    onStreamInfo: (info) => {
                      j.streamMode = info?.mode;
                    },
                  }),
                  chunks = [];
                let captured = 0,
                  retain = !!cfg.voiceReplayEnabled;
                const tee = async function* () {
                  for await (const chunk of source) {
                    if (retain) {
                      captured += chunk.length;
                      if (captured <= 16 * 1024 * 1024) chunks.push(Buffer.from(chunk));
                      else {
                        retain = false;
                        chunks.length = 0;
                      }
                    }
                    yield chunk;
                  }
                };
                prepared = this.prepareStream(tee(), {
                  signal: j.controller.signal,
                  volume: cfg.voiceVolume / 100,
                });
                prepared.done.catch(() => j.controller.abort());
                const result = await s.adapter.playStream(prepared.stream, {
                  signal: j.controller.signal,
                  durationMs: cfg.voiceMaxSpeechSeconds * 1000,
                  onStarted: () => {
                    j.phase = 'playing';
                    this.caption(s, j, 'playing', j.captionMeta);
                    j.startedAt = this.now();
                    j.firstAudioMs = this.now() - began;
                    clearTimeout(prepTimer);
                  },
                });
                if (!result.ok) j.controller.abort();
                await prepared.done;
                if (j.controller.signal.aborted) throw Error('串流播放已中斷，未自動重播');
                const elapsed = Math.min(
                    cfg.voiceMaxSpeechSeconds * 1000,
                    Math.max(0, this.now() - (j.startedAt || this.now())),
                  ),
                  u = (this.usage.days[this.day()] ||= {
                    characters: 0,
                    playedMs: 0,
                    completed: 0,
                    failed: 0,
                  });
                u.playedMs += elapsed;
                this.noteUsage(j.sessionId, { playedMs: elapsed });
                u[result.ok ? 'completed' : 'failed']++;
                if (result.ok && retain && chunks.length)
                  this.cacheReplay(s, j, pcmWav(Buffer.concat(chunks)));
                s.lastResult = {
                  id: j.id,
                  type: 'speech',
                  ok: !!result.ok,
                  streaming: true,
                  streamMode: j.streamMode,
                  firstAudioMs: j.firstAudioMs,
                  speechDirection: j.direction,
                  speechDirectionSource: j.directionSource,
                  at: this.now(),
                  error: result.error || null,
                };
                this.caption(s, j, result.ok ? 'complete' : 'failed', j.captionMeta);
                j.resolve(result);
                await this.save();
                continue;
              }
              const audio = j.audio || (await abortable(service.synthesize(request), j.controller.signal));
              bytes = audio.data;
              if (cfg.voiceReplayEnabled) j.replayAudio = bytes;
              if (audio.warning) this.log?.warn('voice.tts', audio.warning);
            } else bytes = await j.load(j.controller.signal);
            if (j.controller.signal.aborted) throw Error('播放已取消');
            j.file = await this.makeFile(bytes);
          }
          this.check(s);
          prepared = await this.prepare(j.file.path, {
            signal: j.controller.signal,
            seconds:
              j.type === 'speech'
                ? cfg.voiceMaxSpeechSeconds
                : Math.max(1, cfg.voiceMaxMusicMinutes * 60 - (j.offset || 0)),
            volume: cfg.voiceVolume / 100,
            offset: j.offset || 0,
          });
          this.check(s);
          if (j.controller.signal.aborted) throw Error('播放已取消');
          clearTimeout(prepTimer);
          j.phase = 'playing';
          if (j.type === 'speech') this.caption(s, j, 'playing', j.captionMeta);
          j.startedAt = this.now();
          if (
            j.type === 'music' &&
            cfg.voiceMusicMode === 'duck' &&
            s.adapter.supportsMixing &&
            typeof s.adapter.playMusic === 'function'
          ) {
            const retained = prepared,
              file = j.file;
            prepared = null;
            j.file = null;
            requeue = true;
            s.music = j;
            const background = (async () => {
              try {
                const result = await s.adapter.playMusic(retained.path, {
                  signal: j.controller.signal,
                  durationMs: retained.durationMs,
                  duck: (cfg.voiceMusicDuckPercent ?? 20) / 100,
                });
                const elapsed = Math.min(retained.durationMs, Math.max(0, this.now() - j.startedAt)),
                  u = (this.usage.days[this.day()] ||= {
                    characters: 0,
                    playedMs: 0,
                    completed: 0,
                    failed: 0,
                  });
                u.playedMs += elapsed;
                u[result.ok ? 'completed' : 'failed']++;
                s.lastMusicResult = {
                  id: j.id,
                  ok: !!result.ok,
                  at: this.now(),
                  error: result.error || null,
                };
                j.resolve(result);
                await this.save();
              } catch {
                const u = (this.usage.days[this.day()] ||= {
                  characters: 0,
                  playedMs: 0,
                  completed: 0,
                  failed: 0,
                });
                u.failed++;
                s.lastMusicResult = { id: j.id, ok: false, at: this.now(), error: '背景音樂中斷' };
                j.resolve({ ok: false, error: '背景音樂中斷' });
                await this.save();
              } finally {
                await retained.remove().catch(() => {});
                await file?.remove().catch(() => {});
                if (s.music === j) s.music = null;
                s.idleSince = this.now();
                if (!s.closed) {
                  const next = this.pump(s);
                  this.work.add(next);
                  next.then(
                    () => this.work.delete(next),
                    () => this.work.delete(next),
                  );
                }
              }
            })();
            this.work.add(background);
            background.then(
              () => this.work.delete(background),
              () => this.work.delete(background),
            );
            continue;
          }
          const result = await s.adapter.play(prepared.path, {
            signal: j.controller.signal,
            durationMs: prepared.durationMs,
          });
          const elapsed = Math.min(prepared.durationMs, Math.max(0, this.now() - j.startedAt)),
            day = this.day(),
            u = (this.usage.days[day] ||= { characters: 0, playedMs: 0, completed: 0, failed: 0 });
          u.playedMs += elapsed;
          this.noteUsage(j.sessionId, { playedMs: elapsed });
          if (
            j.resumeAfterSpeech &&
            !s.closed &&
            s.queue.some((x) => x.type === 'speech') &&
            (j.offset || 0) + elapsed / 1000 < cfg.voiceMaxMusicMinutes * 60
          ) {
            j.offset = (j.offset || 0) + elapsed / 1000;
            j.resumeAfterSpeech = false;
            j.phase = 'queued';
            s.queue.push(j);
            requeue = true;
          } else {
            if (result.ok && j.type === 'speech' && j.replayAudio) this.cacheReplay(s, j, j.replayAudio);
            if (j.type === 'speech') this.caption(s, j, result.ok ? 'complete' : 'failed', j.captionMeta);
            u[result.ok ? 'completed' : 'failed']++;
            s.lastResult = {
              id: j.id,
              type: j.type,
              ok: !!result.ok,
              ...(j.type === 'speech'
                ? { speechDirection: j.direction, speechDirectionSource: j.directionSource }
                : {}),
              at: this.now(),
              error: j.cancelReason || result.error || (!result.ok ? '播放中斷，未自動重播' : null),
            };
            j.resolve(j.cancelReason ? { ...result, cancelled: true } : result);
          }
          await this.save();
        } catch (e) {
          if (j.type === 'speech') this.caption(s, j, 'failed', j.captionMeta);
          s.lastResult = {
            id: j.id,
            type: j.type,
            ok: false,
            at: this.now(),
            error: String(j.cancelReason || e.message).slice(0, 180),
          };
          j.resolve({
            ok: false,
            error: s.lastResult.error,
            ...(j.cancelReason ? { cancelled: true } : {}),
          });
          const u = (this.usage.days[this.day()] ||= { characters: 0, playedMs: 0, completed: 0, failed: 0 });
          u.failed++;
          await this.save();
          this.log?.warn('voice.play', '語音未完成', {
            kind: s.kind,
            type: j.type,
            reason: s.lastResult.error,
          });
        } finally {
          clearTimeout(prepTimer);
          j.externalSignal?.removeEventListener('abort', abort);
          await prepared?.remove().catch(() => {});
          if (!requeue) await j.file?.remove().catch(() => {});
          s.current = null;
          s.idleSince = this.now();
        }
      }
    } finally {
      s.running = false;
    }
  }
  interruptForInput(kind, expectedJobId) {
    const s = this.sessions.get(kind);
    if (!s || (expectedJobId && s.current?.id !== expectedJobId)) return;
    if (s.current?.type === 'speech') {
      s.current.cancelReason = '偵測到允許使用者的聲音，已依插話設定中止播放';
      this.log?.info('voice.input.interrupt', s.current.cancelReason, { kind });
      s.current.controller.abort(new Error(s.current.cancelReason));
    }
    for (const j of s.queue.filter((j) => j.type === 'speech' && j.automatic))
      j.resolve({ ok: false, error: '使用者插話，略過尚未播放的自動回覆' });
    s.queue = s.queue.filter((j) => !(j.type === 'speech' && j.automatic));
  }
  connectionLost(kind, adapter, reason) {
    const s = this.sessions.get(kind);
    if (!s || s.adapter !== adapter) return;
    this.input.close(kind);
    if (s.current) {
      s.current.cancelReason = reason;
      s.current.resumeAfterSpeech = false;
      s.current.controller?.abort();
    }
    if (s.music) s.music.controller.abort();
    for (const j of s.queue.splice(0)) {
      j.resolve({ ok: false, error: reason });
      void j.file?.remove().catch(() => {});
    }
    s.lastConnectionEvent = { at: this.now(), reason };
  }
  async stop(kind) {
    const s = this.sessions.get(kind);
    if (!s) return { ok: true };
    for (const j of s.queue.splice(0)) {
      j.resolve({ ok: false, error: '佇列已清空' });
      await j.file?.remove().catch(() => {});
    }
    if (s.music) s.music.controller.abort();
    if (s.current) {
      s.current.resumeAfterSpeech = false;
      s.current.controller.abort();
    }
    await s.adapter.stop().catch(() => {});
    s.idleSince = this.now();
    return { ok: true };
  }
  async leave(kind, reason = '手動離開') {
    this.input.close(kind);
    this.joinGeneration.set(kind, (this.joinGeneration.get(kind) || 0) + 1);
    const s = this.sessions.get(kind);
    if (!s) return { ok: true };
    s.closed = true;
    await this.stopSession(s);
    s.lastLeaveAttempt = this.now();
    let result;
    try {
      result = await s.adapter.leave();
    } catch {
      result = { ok: false };
    }
    if (!result?.ok) {
      s.lastResult = { ok: false, at: this.now(), error: '離開語音尚未確認，會繼續嘗試清理；也可再次按離開' };
      return { ok: false, error: s.lastResult.error };
    }
    this.sessions.delete(kind);
    this.log?.info('voice.leave', reason, { kind, channelId: s.channelId });
    return { ok: true };
  }
  async stopSession(s) {
    for (const j of s.queue.splice(0)) {
      j.resolve({ ok: false, error: '已離開語音' });
      await j.file?.remove().catch(() => {});
    }
    if (s.music) s.music.controller.abort();
    if (s.current) {
      s.current.resumeAfterSpeech = false;
      s.current.controller.abort();
    }
    await s.adapter.stop().catch(() => {});
  }
  async tick() {
    void this.tts.refresh().catch(() => {});
    if (this.ticking) return;
    this.ticking = true;
    try {
      for (const s of this.sessions.values()) {
        if (s.closed) {
          if (this.now() - (s.lastLeaveAttempt || 0) >= 5000) await this.leave(s.kind, '重試語音離線清理');
          continue;
        }
        try {
          this.check(s);
          if (s.receiving && !this.input.enabled()) throw Error('收聽已關閉');
        } catch {
          await this.leave(s.kind, '設定或帳號變更，自動離開');
          continue;
        }
        if (s.adapter.refresh && (!s.lastProbe || this.now() - s.lastProbe > 5000)) {
          s.lastProbe = this.now();
          await s.adapter.refresh();
        }
        if (!s.adapter.connected && !s.adapter.recovering) {
          await this.leave(s.kind, '語音連線中斷');
          continue;
        }
        const c = this.getConfig();
        if (this.now() - s.joinedAt >= c.voiceMaxSessionMinutes * 60000) {
          await this.leave(s.kind, '達到最長連線時間');
          continue;
        }
        if (
          !s.current &&
          !s.music &&
          !s.queue.length &&
          this.now() - s.idleSince >= c.voiceIdleMinutes * 60000
        )
          await this.leave(s.kind, '語音閒置逾時，自動退出');
      }
    } finally {
      this.ticking = false;
    }
  }
  async dispose() {
    this.replays.clear();
    this.closed = true;
    this.input.close();
    this.japanese.clear();
    clearInterval(this.timer);
    await Promise.all([...this.sessions.keys()].map((k) => this.leave(k, '插件關閉')));
    await Promise.allSettled([...this.work]);
    await this.saves;
  }
}
