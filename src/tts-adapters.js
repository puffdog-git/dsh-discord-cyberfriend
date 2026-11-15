import { observeCapability, observeCapabilityStream } from './capability-diagnostics.js';
import { pcmSource } from './pcm-stream.js';
import { directionForEngine } from './speech-direction.js';
// Discord-owned adapters. TTS plugins only synthesize audio; all channel
// selection, permissions, audio conversion and delivery remain in Discord.
const MAX_AUDIO = 64 * 1024 * 1024;
const HTTP_ADAPTERS = ['dsh-tts', 'memef1f1y'];
const abortError = (signal) => signal?.reason || Error('語音合成已取消');

function optionsOf(cfg) {
  if (!cfg.voiceTtsOptions?.trim()) return {};
  let value;
  try {
    value = JSON.parse(cfg.voiceTtsOptions);
  } catch {
    throw Error('TTS 進階選項必須是 JSON 物件');
  }
  if (!value || Array.isArray(value) || typeof value !== 'object')
    throw Error('TTS 進階選項必須是 JSON 物件');
  const allowed = new Set(['provider', 'model', 'style', 'custom', 'prosody']);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw Error(`不支援的 TTS 選項：${key}`);
  return value;
}

function nativeService(ctx, selection = 'auto') {
  for (const name of selection === 'auto' || !selection ? ['dshTts', 'speechSynthesis'] : [selection])
    try {
      const service = ctx.get?.(name) || ctx[name];
      if (typeof service?.synthesize === 'function') return service;
    } catch {}
  return null;
}

async function limitedBytes(response, limit = MAX_AUDIO) {
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel();
    throw Error('TTS 回應超過大小限制');
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw Error('TTS 回應超過大小限制');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

function bytesFromBase64(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > Math.ceil(MAX_AUDIO / 3) * 4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  )
    throw Error('TTS 沒有回傳有效音訊');
  const data = Buffer.from(value, 'base64');
  if (!data.length || data.length > MAX_AUDIO) throw Error('TTS 音訊為空或超過大小限制');
  return data;
}

function chunksOf(text, limit = 900) {
  const points = Array.from(text),
    out = [];
  while (points.length) {
    let end = Math.min(limit, points.length);
    if (end < points.length) {
      for (let i = end - 1; i >= Math.floor(end / 2); i--)
        if (/[。！？.!?\n]/.test(points[i])) {
          end = i + 1;
          break;
        }
    }
    const part = points.splice(0, end).join('').trim();
    if (part) out.push(part);
  }
  return out;
}

export class DiscordTts {
  constructor({ ctx, getConfig, fetchImpl = fetch, mergeAudio }) {
    Object.assign(this, { ctx, getConfig, fetch: fetchImpl, mergeAudio });
    this.snapshot = null;
    this.refreshedAt = 0;
    this.refreshing = null;
  }
  baseUrl() {
    const configured = this.getConfig().voiceTtsBaseUrl?.trim();
    let base = configured;
    if (!base) {
      try {
        const web = this.ctx.get?.('webServer') || this.ctx.webServer;
        base = web?.getOrigin?.();
      } catch {}
    }
    if (!base) throw Error('尚無可用的 DSH 語音 API 位址');
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
      throw Error('TTS API 位址必須是 HTTP(S) 基底網址');
    return url.href.replace(/\/?$/, '/');
  }
  signature() {
    const c = this.getConfig();
    return JSON.stringify([
      c.voiceTtsAdapter || 'auto',
      c.voiceTtsBaseUrl || '',
      c.voiceTtsOptions || '',
      c.voiceTtsService || 'auto',
    ]);
  }
  serviceCapabilities() {
    const service = nativeService(this.ctx, this.getConfig().voiceTtsService);
    if (!service) return null;
    try {
      const c = service.capabilities?.() || {},
        engine = c.engine || c.providers?.find((p) => p.id === c.provider);
      return {
        ...c,
        adapter: 'service',
        serviceId:
          this.getConfig().voiceTtsService && this.getConfig().voiceTtsService !== 'auto'
            ? this.getConfig().voiceTtsService
            : nativeService(this.ctx, 'dshTts') === service
              ? 'dshTts'
              : 'speechSynthesis',
        engine: {
          ...engine,
          name: engine?.name || c.provider || '外部 TTS 宿主服務',
          ready: engine?.ready === true,
        },
      };
    } catch {
      return null;
    }
  }
  capabilities() {
    const mode = this.getConfig().voiceTtsAdapter || 'auto',
      service = this.serviceCapabilities();
    if ((mode === 'auto' || mode === 'service') && service?.engine.ready) return service;
    if (
      mode === 'service' ||
      (mode === 'auto' && this.getConfig().voiceTtsService && this.getConfig().voiceTtsService !== 'auto')
    )
      return (
        service || {
          adapter: mode,
          engine: { ready: false, unavailableReason: '指定的語音服務尚未就緒；不會自動改用其他服務' },
        }
      );
    if (this.snapshot?.signature === this.signature()) return this.snapshot.capabilities;
    return {
      adapter: mode,
      engine: { ready: false, unavailableReason: '尚未偵測到可用 TTS，請按「檢查語音環境」' },
    };
  }
  async request(base, route, { signal, method = 'GET', body, timeoutMs = 90000, audio = false } = {}) {
    const url = new URL(route.replace(/^\//, ''), base);
    if (url.origin !== new URL(base).origin || !['http:', 'https:'].includes(url.protocol))
      throw Error('TTS 音訊網址不屬於指定服務');
    const response = await this.fetch(url.href, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      redirect: 'error',
      signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(timeoutMs)]),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw Object.assign(Error(`TTS API HTTP ${response.status}`), { status: response.status });
    }
    const bytes = await limitedBytes(response, audio ? MAX_AUDIO : MAX_AUDIO * 1.4);
    if (audio) {
      const mime = response.headers.get('content-type') || 'application/octet-stream';
      if (!/^audio\//i.test(mime) && !/^application\/octet-stream/i.test(mime))
        throw Error('TTS 下載回應不是音訊');
      if (!bytes.length) throw Error('TTS 音訊為空');
      return { data: bytes, contentType: mime };
    }
    try {
      return JSON.parse(bytes.toString('utf8'));
    } catch {
      throw Error('TTS API 沒有回傳有效 JSON');
    }
  }
  async refresh({ force = false } = {}) {
    const signature = this.signature(),
      mode = this.getConfig().voiceTtsAdapter || 'auto';
    if (!force && this.snapshot?.signature === signature && Date.now() - this.refreshedAt < 30000)
      return this.capabilities();
    if ((mode === 'auto' || mode === 'service') && this.serviceCapabilities()?.engine.ready)
      return this.capabilities();
    if (
      (mode === 'auto' || mode === 'service') &&
      this.getConfig().voiceTtsService &&
      this.getConfig().voiceTtsService !== 'auto'
    )
      return this.capabilities();
    if (this.refreshing) {
      await this.refreshing;
      return this.capabilities();
    }
    this.refreshing = (async () => {
      let base;
      try {
        optionsOf(this.getConfig());
        base = this.baseUrl();
      } catch (error) {
        this.snapshot = {
          signature,
          capabilities: { adapter: mode, engine: { ready: false, unavailableReason: error.message } },
        };
        return;
      }
      for (const adapter of mode === 'auto' ? HTTP_ADAPTERS : HTTP_ADAPTERS.includes(mode) ? [mode] : []) {
        try {
          const probe = await this.request(
            base,
            adapter === 'dsh-tts' ? '/dsh-tts/config' : '/dsh-tts-api/cloud-config',
            { timeoutMs: 3000 },
          );
          if (
            adapter === 'dsh-tts'
              ? !probe?.ok || !Array.isArray(probe.config?.chain)
              : typeof probe?.cloud?.apiKeySet !== 'boolean'
          )
            continue;
          const provider =
            optionsOf(this.getConfig()).provider ||
            (adapter === 'dsh-tts'
              ? probe.config.roles?.reply?.provider || probe.config.chain[0]?.provider
              : 'edge-tts');
          const model =
            optionsOf(this.getConfig()).model ||
            probe.config?.roles?.reply?.model ||
            probe.config?.chain?.find((e) => e.provider === provider)?.model ||
            {
              doubao: 'seed-tts-2.0',
              openai: 'gpt-4o-mini-tts',
              openrouter: 'openai/gpt-4o-mini-tts-2025-12-15',
              siliconflow: 'FunAudioLLM/CosyVoice2-0.5B',
              elevenlabs: 'eleven_multilingual_v2',
            }[provider] ||
            '';
          const engine = {
            ready: true,
            name: adapter === 'dsh-tts' ? '@goodandready/dsh-tts' : '@memef1f1y/dsh-plugin-tts',
            speechInstruction:
              adapter === 'dsh-tts' &&
              ((provider === 'local-tts' &&
                ['qwen3', 'index2', 'index2.5', 'breeze', 'irodori', 'cosyvoice'].includes(
                  probe.config?.localTtsFamily,
                )) ||
                ['fish', 'dashscope'].includes(provider) ||
                (provider === 'inworld' && (!model || model === 'inworld-tts-2')) ||
                provider === 'mimo' ||
                provider === 'google' ||
                (provider === 'deepinfra' && /^Qwen\/Qwen3-TTS/.test(model || '')) ||
                (provider === 'groq' && (!model || model === 'canopylabs/orpheus-v1-english')) ||
                (provider === 'cosyvoice' && (probe.config?.cosyvoiceMode || '').startsWith('instruct')) ||
                (provider === 'siliconflow' && /cosyvoice/i.test(model || '')) ||
                (provider === 'openai' &&
                  !/^tts-1/.test(model || '') &&
                  (!/realtime/.test(model || '') || /^gpt-realtime(?:-|$)/.test(model || ''))) ||
                (provider === 'elevenlabs' && /^eleven_v[34]/.test(model || '')) ||
                (provider === 'openrouter' && /^(openai|google|fish-audio)\//.test(model || '')) ||
                (provider === 'doubao' && model === 'seed-tts-2.0')),
          };
          this.snapshot = {
            signature,
            adapter,
            base,
            speechApi: probe.speechApi,
            config: probe.config,
            capabilities: { provider, adapter, engine },
          };
          this.refreshedAt = Date.now();
          return;
        } catch (error) {
          this.lastProbeError = error.message;
        }
      }
      this.refreshedAt = Date.now();
      this.snapshot = {
        signature,
        capabilities: {
          adapter: mode,
          engine: { ready: false, unavailableReason: '找不到可用 TTS 宿主服務或受支援插件 API' },
        },
      };
    })();
    try {
      await this.refreshing;
    } finally {
      this.refreshing = null;
    }
    return this.capabilities();
  }
  async resolveVoice(request) {
    if (this.capabilities().adapter !== 'service') return undefined;
    const service = nativeService(this.ctx, this.getConfig().voiceTtsService);
    return typeof service?.resolveVoice === 'function' ? service.resolveVoice(request) : undefined;
  }
  canStream() {
    const c = this.capabilities(),
      service = nativeService(this.ctx, this.getConfig().voiceTtsService);
    return (
      (c.adapter === 'service' &&
        !!service?.streamPcm &&
        (c.extensions?.pcmStream === true || c.engine?.streaming === true)) ||
      (c.adapter === 'dsh-tts' &&
        this.snapshot?.speechApi?.version === 1 &&
        !!this.snapshot.speechApi.streamEndpoint)
    );
  }
  async *streamPcm(options) {
    options.signal?.throwIfAborted();
    await this.refresh();
    yield* observeCapabilityStream(this.ctx, 'tts.selected', 'stream-audio', this.rawStreamPcm(options));
  }
  rawStreamPcm(options) {
    const self = this;
    return pcmSource(async (signal, consume) => {
      await self.refresh();
      if (!self.canStream()) throw Error('此 TTS 接口未提供 PCM 串流');
      const caps = self.capabilities();
      if (caps.adapter === 'dsh-tts') {
        const snapshot = self.snapshot,
          url = new URL(snapshot.speechApi.streamEndpoint.replace(/^\//, ''), snapshot.base);
        if (url.origin !== new URL(snapshot.base).origin) throw Error('串流網址不屬於指定 TTS');
        const { signal: _signal, onPrepared, onStreamInfo, ...body } = options;
        const r = await self.fetch(url.href, {
          method: 'POST',
          redirect: 'error',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...body,
            ...optionsOf(self.getConfig()),
            ...(body.spokenLanguage === 'ja' && body.sourceText
              ? { text: body.sourceText, spokenText: body.text }
              : {}),
          }),
          signal,
        });
        if (!r.ok || !r.body) {
          await r.body?.cancel();
          throw Error('TTS 串流 HTTP ' + r.status);
        }
        const reader = r.body.getReader(),
          decoder = new TextDecoder();
        let buffered = '',
          complete = false,
          bytes = 0;
        const line = async (text) => {
          if (!text.trim()) return;
          const frame = JSON.parse(text);
          if (complete) throw Error('完整標記之後仍有音訊');
          if (frame.type === 'error') throw Error('TTS 串流未完成');
          if (frame.type === 'prepared') {
            onPrepared?.(frame);
            return;
          }
          if (frame.type === 'complete') {
            complete = true;
            onStreamInfo?.(frame);
            return;
          }
          if (frame.type !== 'pcm' || frame.sampleRate !== 24000 || frame.channels !== 1)
            throw Error('TTS PCM 格式不相容');
          const pcm = bytesFromBase64(frame.audioBase64);
          bytes += pcm.length;
          if (bytes > MAX_AUDIO) throw Error('串流音訊超過大小上限');
          await consume(pcm);
        };
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffered += decoder.decode(value, { stream: true });
            if (buffered.length > 2 * 1024 * 1024) throw Error('串流封包超過上限');
            let at;
            while ((at = buffered.indexOf('\n')) >= 0) {
              const text = buffered.slice(0, at);
              buffered = buffered.slice(at + 1);
              await line(text);
            }
          }
          buffered += decoder.decode();
          if (buffered.trim()) await line(buffered);
          if (!complete || !bytes) throw Error('TTS 串流缺少完整音訊確認');
        } finally {
          await reader.cancel().catch(() => {});
          reader.releaseLock();
        }
        return;
      }
      const { speechDirection, sessionId, sourceText, spokenLanguage, onStreamInfo, onPrepared, ...request } =
        options;
      request.signal = signal;
      if (caps.extensions?.contextRouting)
        Object.assign(request, { speechDirection, sessionId, sourceText, spokenLanguage, onPrepared });
      else if (!request.speechInstruction && speechDirection) {
        const mapped = directionForEngine(speechDirection, {
          provider: caps.provider,
          engine: caps.engine,
          model: caps.engine?.selection?.model,
          text: options.text,
        });
        if (mapped.instruction) request.speechInstruction = mapped.instruction;
      }
      const info = await nativeService(self.ctx, self.getConfig().voiceTtsService).streamPcm(
        request,
        consume,
      );
      onStreamInfo?.(info);
      return info;
    }, options.signal);
  }
  async synthesize(options) {
    const { diagnosticSimulation, ...request } = options;
    request.signal?.throwIfAborted();
    await this.refresh();
    return observeCapability(
      this.ctx,
      'tts.selected',
      'synthesize-audio',
      () => this.rawSynthesize(request),
      { simulated: !!diagnosticSimulation, outcome: (r) => (r?.data?.byteLength ? 'passed' : 'unconfirmed') },
    );
  }
  async rawSynthesize(options) {
    if (options.signal?.aborted) throw abortError(options.signal);
    await this.refresh();
    const caps = this.capabilities(),
      mode = this.getConfig().voiceTtsAdapter || 'auto';
    if (!caps.engine?.ready) throw Error(caps.engine?.unavailableReason || '外部 TTS 尚未就緒');
    let directionWarning;
    if (
      !options.speechInstruction &&
      options.speechDirection &&
      caps.adapter === 'service' &&
      !caps.extensions?.expression
    ) {
      const mapped = directionForEngine(options.speechDirection, {
        provider: caps.provider,
        engine: caps.engine,
        model: caps.engine?.selection?.model,
        text: options.text,
      });
      options = { ...options, speechInstruction: mapped.instruction || undefined };
      directionWarning = mapped.warning;
    }
    // Resolve once. A failed synthesis never switches providers and repeats a
    // possibly billed request without the user's choice.
    if (caps.adapter === 'service' && (mode === 'auto' || mode === 'service')) {
      const { speechDirection, sessionId, sourceText, spokenLanguage, onPrepared, ...request } = options;
      if (caps.extensions?.contextRouting)
        Object.assign(request, { speechDirection, sessionId, sourceText, spokenLanguage, onPrepared });
      const result = await nativeService(this.ctx, this.getConfig().voiceTtsService)?.synthesize(request);
      if (options.signal?.aborted) throw abortError(options.signal);
      if (!result?.data?.length || result.data.length > MAX_AUDIO) throw Error('外部 TTS 回傳無效音訊');
      return {
        ...result,
        warning: [result.warning, directionWarning].filter(Boolean).join('；') || undefined,
      };
    }
    const snapshot = this.snapshot,
      parts = [],
      settings = optionsOf(this.getConfig());
    let warning;
    if (options.speechInstruction && !caps.engine.speechInstruction)
      warning = '目前 TTS 接口不支援自然語言語氣提示；已使用原本的聲音設定。';
    if (snapshot.adapter === 'dsh-tts') {
      if (snapshot.speechApi?.version === 1) {
        const out = await this.request(snapshot.base, snapshot.speechApi.endpoint, {
          method: 'POST',
          signal: options.signal,
          body: {
            ...options,
            signal: undefined,
            ...settings,
            text: options.spokenLanguage === 'ja' && options.sourceText ? options.sourceText : options.text,
            ...(options.spokenLanguage === 'ja' ? { spokenText: options.text } : {}),
            format: 'wav',
          },
        });
        if (!out.ok) throw Error(out.error?.message || '語音合成失敗');
        return {
          data: bytesFromBase64(out.audioBase64),
          contentType: out.mime,
          format: out.format,
          warning: out.warning,
          voiceBinding: out.voiceBinding,
        };
      }
      const cfg = snapshot.config,
        role = cfg.roles?.reply || {},
        provider = settings.provider || role.provider || cfg.chain[0]?.provider;
      const first = cfg.chain.find((e) => e.provider === provider) || {},
        ownRole =
          !settings.provider ||
          settings.provider === role.provider ||
          settings.provider === cfg.chain[0]?.provider
            ? role
            : {};
      const tuning = ownRole.tuningEnabled ? ownRole : cfg;
      const effectiveModel = settings.model || ownRole.model || first.model;
      const baseOptions = {
        ...JSON.parse(cfg.providerOptions || '{}')[provider],
        ...(first.options ? JSON.parse(first.options) : {}),
      };
      const mapped =
        !options.speechInstruction && options.speechDirection
          ? directionForEngine(options.speechDirection, {
              provider,
              model: effectiveModel,
              cfg: { ...cfg, providerOptions: JSON.stringify({ [provider]: baseOptions }) },
              engine: caps.engine,
              text: options.text,
            })
          : {};
      warning = mapped.warning || warning;
      const directedOptions = mapped.options ? JSON.stringify(mapped.options) : first.options;
      const instruction = options.speechInstruction || mapped.instruction;
      for (const text of chunksOf(options.text)) {
        const overrides = !!(
          options.voice ||
          (instruction && caps.engine.speechInstruction) ||
          mapped.options ||
          settings.style ||
          settings.provider ||
          settings.model
        );
        const body = overrides
          ? {
              provider,
              model: settings.model || ownRole.model || first.model,
              voice: options.voice || ownRole.voice || first.voice,
              text: options.spokenLanguage === 'ja' && options.sourceText ? options.sourceText : text,
              ...(options.spokenLanguage ? { spokenLanguage: options.spokenLanguage } : {}),
              ...(options.spokenLanguage === 'ja' ? { spokenText: text } : {}),
              tuning: {
                rate: tuning.rate,
                volume: tuning.volume,
                pitch: tuning.pitch,
                voaiPitch: tuning.voaiPitch,
                doubaoPitch: tuning.doubaoPitch,
                styleWeight: tuning.styleWeight,
                breathPause: tuning.breathPause,
                style: settings.style || ownRole.style || first.style,
                ...(directedOptions ? { options: directedOptions } : {}),
                ...(first.baseUrl ? { baseUrl: first.baseUrl } : {}),
                ...(first.keyEnv ? { keyEnv: first.keyEnv } : {}),
                ...(first.referenceAsset ? { referenceAsset: first.referenceAsset } : {}),
                instruction: mapped.options
                  ? ''
                  : instruction ||
                    ownRole.instruction ||
                    (provider === 'doubao'
                      ? cfg.doubaoInstruction
                      : provider === 'mimo'
                        ? cfg.mimoInstruction
                        : cfg.speechInstruction),
                voiceDesign:
                  ownRole.voiceDesign ||
                  (provider === 'deepinfra' ? cfg.deepinfraVoiceDesign : cfg.mimoVoiceDesign),
              },
            }
          : {
              text: options.spokenLanguage === 'ja' && options.sourceText ? options.sourceText : text,
              channel: 'web',
              ...(options.spokenLanguage ? { spokenLanguage: options.spokenLanguage } : {}),
              ...(options.spokenLanguage === 'ja' ? { spokenText: text } : {}),
            };
        const out = await this.request(snapshot.base, overrides ? '/dsh-tts/preview' : '/dsh-tts/speak', {
          method: 'POST',
          body,
          signal: options.signal,
        });
        if (!out?.ok) throw Error(out?.error?.message || 'TTS 合成失敗');
        parts.push({
          data: bytesFromBase64(out.audioBase64),
          contentType: out.mime,
          rate: out.rate,
          volume: out.volume,
        });
      }
    } else if (snapshot.adapter === 'memef1f1y') {
      let jobId;
      const download = async (url) => {
        const target = new URL(url, snapshot.base);
        const prefix = new URL('dsh-tts-audio/', snapshot.base);
        if (target.origin !== prefix.origin || !target.pathname.startsWith(prefix.pathname))
          throw Error('TTS 音訊網址不屬於指定插件');
        const part = await this.request(snapshot.base, target.href, { audio: true, signal: options.signal });
        if (parts.reduce((n, p) => n + p.data.length, part.data.length) > MAX_AUDIO)
          throw Error('TTS 音訊超過大小限制');
        parts.push(part);
      };
      try {
        const out = await this.request(snapshot.base, '/dsh-tts-api/speak', {
          method: 'POST',
          signal: options.signal,
          body: { text: options.text, ...settings, voice: options.voice || undefined },
        });
        jobId = out.jobId;
        if (out.url) await download(out.url);
        else if (jobId && Array.isArray(out.chunks) && Number.isInteger(out.total) && out.total <= 256) {
          for (const url of out.chunks) {
            if (!url) throw Error('TTS 有片段合成失敗，取消本次語音');
            await download(url);
          }
          while (parts.length < out.total) {
            const next = await this.request(
              snapshot.base,
              `/dsh-tts-api/rvc-next?job=${encodeURIComponent(jobId)}`,
              { signal: options.signal },
            );
            if (!next.url || next.skipped) throw Error('TTS 長文音訊不完整，取消本次語音');
            await download(next.url);
          }
        } else throw Error('TTS 沒有回傳音訊網址');
      } finally {
        if (jobId)
          await this.request(
            snapshot.base,
            `/dsh-tts-api/rvc-next?job=${encodeURIComponent(jobId)}&cancel=1`,
            { timeoutMs: 3000 },
          ).catch(() => {});
      }
    } else throw Error('尚未連接支援的 TTS');
    if (options.signal?.aborted) throw abortError(options.signal);
    if (parts.reduce((n, p) => n + p.data.length, 0) > MAX_AUDIO) throw Error('TTS 音訊超過大小限制');
    const result =
      parts.length === 1 && (parts[0].rate ?? 1) === 1 && (parts[0].volume ?? 1) === 1
        ? parts[0]
        : await this.mergeAudio(parts, options);
    return { ...result, provider: caps.provider, warning };
  }
}
