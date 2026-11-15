import { observeCapability } from './capability-diagnostics.js';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FFMPEG } from './voice-audio.js';
import { discordAttachmentUrl } from './media.js';
import { normalizeTranscript } from './transcript-normalization.js';
import { createJapaneseSpeech } from './speech-language.js';
import { redactSensitive } from './security.js';

const MAX_BYTES = 8 * 1024 * 1024;
export function isAudioAttachment(a) {
  return (
    /^audio\//i.test(a?.contentType || a?.content_type || '') ||
    /\.(ogg|opus|mp3|wav|m4a|webm)$/i.test(a?.name || a?.filename || '')
  );
}
function ffmpeg(bytes, args, signal, limit = MAX_BYTES) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const p = spawn(
      FFMPEG,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-protocol_whitelist',
        'pipe',
        '-i',
        'pipe:0',
        ...args,
        'pipe:1',
      ],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] },
    );
    let size = 0;
    const chunks = [];
    const abort = () => p.kill(),
      timer = setTimeout(abort, 15000);
    signal?.addEventListener('abort', abort, { once: true });
    p.stdout.on('data', (b) => {
      size += b.length;
      if (size > limit) abort();
      else chunks.push(b);
    });
    p.stdin.on('error', () => {});
    p.once('error', () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(Error('語音訊息轉換器無法啟動'));
    });
    p.once('close', (code) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (code || signal?.aborted || size > limit || !size) reject(Error('語音訊息解碼失敗、逾時或超限'));
      else resolve(Buffer.concat(chunks));
    });
    p.stdin.end(bytes);
  });
}
export function pcmWav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF');
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(16000, 24);
  h.writeUInt32LE(32000, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
export async function decodeVoiceMessage(bytes, signal, maxSeconds = 60) {
  const pcm = await ffmpeg(
    bytes,
    ['-vn', '-t', String(maxSeconds + 1), '-ar', '16000', '-ac', '1', '-f', 's16le'],
    signal,
    Math.ceil((maxSeconds + 1) * 32000),
  );
  if (pcm.length / 32000 > maxSeconds) throw Error('錄音超過語音訊息時長上限');
  return { pcm, audio: pcmWav(pcm), seconds: pcm.length / 32000 };
}
export function voiceWaveform(pcm) {
  const count = Math.min(256, Math.max(1, Math.ceil(pcm.length / 3200))),
    result = Buffer.alloc(count),
    samples = Math.floor(pcm.length / 2);
  for (let i = 0; i < count; i++) {
    let sum = 0,
      n = 0;
    for (let k = Math.floor((i * samples) / count); k < Math.floor(((i + 1) * samples) / count); k++) {
      const v = pcm.readInt16LE(k * 2) / 32768;
      sum += v * v;
      n++;
    }
    result[i] = Math.min(255, Math.round(Math.sqrt(sum / Math.max(n, 1)) * 255));
  }
  return result.toString('base64');
}
export class VoiceMessages {
  constructor({ ctx, voice, getConfig, fetchImpl = fetch }) {
    Object.assign(this, { ctx, voice, getConfig, fetchImpl });
    this.japanese = voice.japanese || createJapaneseSpeech({ ctx });
    this.active = 0;
    this.controllers = new Set();
    this.pendingMentions = new Map();
    this.recentAudio = new Map();
  }
  async routeIncoming(message, transport) {
    const c = this.getConfig();
    if (
      message.simulated ||
      !c.voiceMessageEnabled ||
      !c.voiceMessageChannelIds?.includes(String(message.channelId)) ||
      !c.voiceMessageUserIds?.includes(String(message.author?.id))
    )
      return message;
    const at = Date.now(),
      key = [transport.kind, transport.selfId, message.channelId, message.author.id].join(':'),
      audio = message.attachments?.some(isAudioAttachment),
      direct =
        message.isMention ||
        message.replyToAuthorId === transport.selfId ||
        (message.isDm && !message.isGroupDm);
    for (const map of [this.pendingMentions, this.recentAudio])
      for (const [k, v] of map) if (at - v.at > 90000) map.delete(k);
    const bareMention =
      direct &&
      !audio &&
      !message.replyTo &&
      !String(message.content || '')
        .replace(/<@!?\d+>/g, '')
        .trim();
    if (audio) {
      if (direct) {
        this.pendingMentions.delete(key);
        this.recentAudio.delete(key);
        return message;
      }
      this.recentAudio.set(key, { at, message });
      if (this.pendingMentions.has(key)) {
        this.pendingMentions.delete(key);
        this.recentAudio.delete(key);
        return { ...message, isMention: true, memoryOnly: false };
      }
      return null;
    }
    if (bareMention) {
      let prior = this.recentAudio.get(key)?.message;
      if (prior) {
        this.recentAudio.delete(key);
        return { ...message, voiceMessageSource: prior };
      }
      this.pendingMentions.set(key, { at });
      return null;
    }
    if (direct) this.pendingMentions.delete(key);
    return message;
  }
  admitted(message, kind) {
    const c = this.getConfig();
    return !!(
      c.voiceMessageEnabled &&
      ['mention', 'dm'].includes(kind) &&
      c.voiceMessageChannelIds?.includes(String(message.channelId)) &&
      c.voiceMessageUserIds?.includes(String(message.author?.id))
    );
  }
  async download(a, signal, transport) {
    let url = discordAttachmentUrl(a.url);
    if (!url || a.size > MAX_BYTES) throw Error('僅接受 Discord 附件，最大8MiB');
    let r = await this.fetchImpl(url.href, { signal, redirect: 'error' });
    if ([403, 404].includes(r.status) && transport.refreshAttachmentUrls) {
      await r.body?.cancel();
      const refreshed = await transport.refreshAttachmentUrls([url.href]);
      const item = refreshed.items?.[0];
      const fresh = discordAttachmentUrl(item?.refreshed || item?.refreshed_url);
      if (fresh && fresh.pathname === url.pathname)
        r = await this.fetchImpl(fresh.href, { signal, redirect: 'error' });
      else throw Error('錄音附件網址已過期');
    }
    if (!r.ok || !r.body) {
      await r.body?.cancel();
      throw Error('錄音附件下載失敗');
    }
    if (Number(r.headers.get('content-length')) > MAX_BYTES) {
      await r.body.cancel();
      throw Error('錄音附件超過8MiB');
    }
    const reader = r.body.getReader(),
      chunks = [];
    let size = 0;
    try {
      while (true) {
        signal.throwIfAborted();
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) throw Error('錄音附件超過8MiB');
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    return Buffer.concat(chunks);
  }
  async prepareIncoming(message, transport, { kind, signal } = {}) {
    if (message.simulated || message.voiceInput || !this.admitted(message, kind)) return null;
    let source = message.voiceMessageSource || message,
      files = source.attachments?.filter(isAudioAttachment) || [];
    if (!files.length && message.replyTo && transport.getMessage) {
      const r = await transport.getMessage(message.channelId, message.replyTo);
      if (r.ok && String(r.message?.channelId || r.message?.channel_id) === String(message.channelId)) {
        source = r.message;
        files = source.attachments?.filter(isAudioAttachment) || [];
      }
    }
    if (!files.length) return null;
    if (!this.getConfig().voiceMessageUserIds.includes(String(source.author?.id)))
      throw Error('該錄音作者未列入語音訊息允許名單');
    if (files.length > 1 && message.turnMessageIds?.length > 1) {
      if (files.length > 3) throw Error('連發回合最多辨識三段錄音，請分批提供');
      const rows = [];
      for (const file of files) {
        signal?.throwIfAborted();
        rows.push(
          await this.prepareIncoming(
            { ...message, attachments: [file], voiceMessageSource: { ...source, attachments: [file] } },
            transport,
            { kind, signal },
          ),
        );
      }
      return {
        text: rows.map((row, index) => '錄音 ' + (index + 1) + '：' + row.text).join('\n'),
        audioSeconds: rows.reduce((sum, row) => sum + row.audioSeconds, 0),
        sourceMessageIds: message.turnMessageIds,
      };
    }
    if (files.length !== 1) throw Error('每次請只提供一個錄音附件');
    if (this.active >= 2) throw Error('語音訊息辨識忙碌中');
    const controller = new AbortController(),
      combined = AbortSignal.any([
        controller.signal,
        ...(signal ? [signal] : []),
        AbortSignal.timeout(45000),
      ]);
    this.controllers.add(controller);
    this.active++;
    try {
      const c = this.getConfig(),
        decoded = await decodeVoiceMessage(
          await this.download(files[0], combined, transport),
          combined,
          c.voiceMessageMaxSeconds || 60,
        ),
        stt = this.ctx.get?.('speechToText') || this.ctx.speechToText;
      if (!stt?.transcribe) throw Error('DSH 本機語音辨識尚未準備');
      const u = (this.voice.usage.days[this.voice.day()] ||= {
        characters: 0,
        playedMs: 0,
        completed: 0,
        failed: 0,
      });
      if (c.voiceSttDailySeconds > 0 && (u.sttSeconds || 0) + decoded.seconds > c.voiceSttDailySeconds)
        throw Error('今日 STT 秒數預算不足');
      u.sttSeconds = (u.sttSeconds || 0) + decoded.seconds;
      await this.voice.save();
      const result = await observeCapability(
        this.ctx,
        'stt.selected',
        'transcribe-recording',
        () =>
          stt.transcribe(
            stt.resolve({
              audio: decoded.audio,
              providerId: c.voiceSttProvider || undefined,
              language: c.voiceSttLanguage || 'auto',
            }),
            combined,
          ),
        { simulated: !!message.simulated, outcome: (r) => (r?.text?.trim() ? 'passed' : 'unconfirmed') },
      );
      combined.throwIfAborted();
      if (!this.admitted(message, kind)) throw Error('語音訊息辨識已停用');
      const { text, normalization } = normalizeTranscript(result.text, this.getConfig());
      if (!text) throw Error('錄音未辨識到語音');
      return { text, normalization, audioSeconds: decoded.seconds, sourceMessageId: source.id };
    } finally {
      this.active--;
      this.controllers.delete(controller);
    }
  }
  async sendReply(message, transport, text, options, meta = {}) {
    const c = this.getConfig();
    if (!this.admitted(message, meta.kind) || options.signal?.aborted) throw Error('語音訊息回覆已取消');
    if (!text?.trim() || text.length > c.voiceMaxTextChars) throw Error('語音回覆超過文字上限');
    const sourceText = redactSensitive(text, c, { privateData: true }).text;
    let prepared;
    try {
      prepared = await this.japanese.prepare(sourceText, c, options.signal, {
        provided: sourceText === text ? meta.spokenText : undefined,
        scope:
          meta.sessionId ||
          [transport.kind, transport.selfId, message.channelId, message.author?.id].join(':'),
      });
    } catch (error) {
      if (options.signal?.aborted || !this.admitted(message, meta.kind)) throw error;
      const { signal, ...delivery } = options;
      const result = await transport.sendMessage(message.channelId, {
        ...delivery,
        content: sourceText,
        files: [],
        fileUrls: [],
        stickerIds: [],
        embed: undefined,
      });
      return { ...result, voiceSkipped: true, warning: '日文配音未完成，已保留文字回覆；沒有改讀中文。' };
    }
    const spoken = redactSensitive(prepared.text, c, { privateData: true }).text;
    if (!spoken.trim() || spoken.length > c.voiceMaxTextChars) throw Error('配音文字超過單次語音上限');
    options.signal?.throwIfAborted();
    if (!this.admitted(message, meta.kind)) throw Error('語音訊息回覆已取消');
    await this.voice.tts.refresh();
    const u = (this.voice.usage.days[this.voice.day()] ||= {
      characters: 0,
      playedMs: 0,
      completed: 0,
      failed: 0,
    });
    if (c.voiceDailyCharacterLimit > 0 && u.characters + spoken.length > c.voiceDailyCharacterLimit)
      throw Error('今日 TTS 字數預算不足');
    u.characters += spoken.length;
    await this.voice.save();
    const audio = await this.voice.tts.synthesize({
        diagnosticSimulation: !!message.simulated,
        text: spoken,
        sourceText,
        format: 'wav',
        voice: c.voiceTtsVoice || undefined,
        sessionId: meta.sessionId,
        speechDirection: meta.speech,
        spokenLanguage: prepared.language,
        maxDurationMs: c.voiceMaxSpeechSeconds * 1000,
        signal: options.signal,
      }),
      decoded = await decodeVoiceMessage(audio.data, options.signal, c.voiceMaxSpeechSeconds),
      ogg = await ffmpeg(
        decoded.audio,
        ['-vn', '-ar', '48000', '-ac', '1', '-c:a', 'libopus', '-b:a', '32k', '-f', 'ogg'],
        options.signal,
      ),
      dir = await mkdtemp(join(tmpdir(), 'dsh-discord-voice-message-')),
      file = join(dir, 'voice-message.ogg');
    try {
      await writeFile(file, ogg);
      if (!this.admitted(message, meta.kind) || options.signal?.aborted) throw Error('語音訊息回覆已取消');
      const { signal, ...delivery } = options;
      const result = await transport.sendMessage(message.channelId, {
        ...delivery,
        content: '',
        files: [file],
        fileUrls: [],
        stickerIds: [],
        embed: undefined,
        voiceMessage: { durationSecs: decoded.seconds, waveform: voiceWaveform(decoded.pcm) },
      });
      if (result.ok)
        this.voice.replays?.put(
          result.messageId,
          ['recorded', transport.kind, transport.selfId, message.channelId, message.author?.id].join(':'),
          ogg,
          {
            kind: transport.kind,
            channelId: message.channelId,
            delivery: 'message',
            durationSecs: decoded.seconds,
            waveform: voiceWaveform(decoded.pcm),
          },
        );
      if (result.ok && prepared.language === 'ja' && !signal?.aborted && this.admitted(message, meta.kind)) {
        try {
          const caption = await transport.sendMessage(message.channelId, {
            ...delivery,
            content: sourceText,
            files: [],
            fileUrls: [],
            stickerIds: [],
            embed: undefined,
          });
          return {
            ...result,
            textDelivered: caption.ok === true,
            textMessageId: caption.messageId,
            warning: caption.ok ? undefined : '語音已送出，中文文字未確認送達；不會重送語音。',
          };
        } catch {
          return {
            ...result,
            textDelivered: false,
            warning: '語音已送出，中文文字未確認送達；不會重送語音。',
          };
        }
      }
      return result;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  async replay(message, transport) {
    if (!this.admitted(message, 'mention')) throw Error('此頻道／使用者的語音訊息已停用');
    const row = this.voice.replays.get(
      message.replyTo,
      ['recorded', transport.kind, transport.selfId, message.channelId, message.author?.id].join(':'),
    );
    const dir = await mkdtemp(join(tmpdir(), 'dsh-discord-replay-')),
      file = join(dir, 'voice-message.ogg');
    try {
      await writeFile(file, row.data);
      return await transport.sendMessage(message.channelId, {
        content: '',
        files: [file],
        voiceMessage: { durationSecs: row.meta.durationSecs, waveform: row.meta.waveform },
        mention: false,
        replyToMessageId: message.id,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  close() {
    for (const c of this.controllers) c.abort();
    this.pendingMentions.clear();
    this.recentAudio.clear();
  }
}
