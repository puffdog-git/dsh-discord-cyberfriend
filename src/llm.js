import { tokenBudgetFor } from './token-budget.js';
/**
 * src/llm.js — 模型呼叫層
 * ============================================================================
 * 兩種來源：
 *   1. DSH 內建模型（ctx.llm）：走宿主已註冊的 provider，不需額外金鑰。
 *   2. 自訂 OpenAI 相容 API：自訂 Base / Key / Model，適合 DeepSeek、Groq 等。
 * 預設 auto：先用 DSH 預設模型（agentDefaultModel 的 currentSelection），
 * 失敗才退回自訂 API。
 * ============================================================================
 */
import { tidyText, truncate } from './util.js';

// 環境變數只在「名稱對應的服務商」就是目的主機時才使用，避免把某一家的金鑰送到另一家的網址。
const ENV_KEY_HOSTS = {
  DEEPSEEK_API_KEY: ['deepseek.com'],
  OPENAI_API_KEY: ['openai.com'],
  GROQ_API_KEY: ['groq.com'],
  SILICONFLOW_API_KEY: ['siliconflow.cn', 'siliconflow.com'],
  MOONSHOT_API_KEY: ['moonshot.cn', 'moonshot.ai'],
};

/** 自訂 API 的金鑰：明確填寫的優先；否則只用與目的主機相符的環境變數。不讀宿主憑證檔。 */
export async function resolveApiKey(config = {}) {
  if (config.customLlmApiKey) return config.customLlmApiKey.trim();
  let host = '';
  try {
    host = new URL(config.customLlmApiBase || 'https://api.deepseek.com').hostname.toLowerCase();
  } catch {
    return '';
  }
  for (const [name, domains] of Object.entries(ENV_KEY_HOSTS)) {
    if (!domains.some((domain) => host === domain || host.endsWith('.' + domain))) continue;
    const value = process.env[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/** 目前 DSH 註冊了哪些 provider。 */
export function listHostProviders(ctx) {
  try {
    const llm = typeof ctx.get === 'function' ? ctx.get('llm') : ctx.llm;
    const providers = llm?.listProviders?.() || [];
    return providers
      .map((entry) => {
        const id = entry.provider || entry.id || entry.name;
        return id ? { id, displayName: entry.displayName || id } : null;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** 決定要用哪個 provider/model。 */
export function resolveRoute(ctx, config = {}) {
  const providers = listHostProviders(ctx);
  const ids = providers.map((p) => p.id);
  // 設定的服務不存在時：優先用 DSH 自帶的 DeepSeek 帳號（不必另外填金鑰），再來才是清單第一個。
  const fallbackProvider = ids.includes('deepseek-account') ? 'deepseek-account' : ids[0] || 'deepseek-account';
  if (config.llmMode === 'custom') return null;
  if (config.llmMode === 'subscriptions') {
    const provider =
      config.subscriptionProvider && ids.includes(config.subscriptionProvider)
        ? config.subscriptionProvider
        : fallbackProvider;
    return { provider, model: (config.subscriptionModel || '').trim() || undefined };
  }
  // auto：優先用 DSH 目前建立的預設模型（與新對話相同）
  try {
    const service = typeof ctx.get === 'function' ? ctx.get('agentDefaultModel') : undefined;
    const selection = service?.currentSelection?.();
    if (selection?.provider && selection?.model) {
      return {
        provider: selection.provider,
        model: selection.model,
        reasoningEffort: selection.reasoningEffort,
      };
    }
  } catch {
    /* 沒有這個服務就往下退 */
  }
  return {
    provider: fallbackProvider,
    model: (config.subscriptionModel || '').trim() || undefined,
  };
}

function buildMessages(system, user, images = []) {
  const messages = [];
  if (system) {
    messages.push({ role: 'system', content: [{ type: 'text', text: system }] });
  }
  messages.push({ role: 'user', content: [{ type: 'text', text: user }, ...images] });
  return messages;
}

/**
 * 呼叫 DSH 內建模型。
 * @returns {Promise<{ok:true,text:string,provider:string,model:string}|{ok:false,error:string,code?:string}>}
 */
async function rawHostLlm(ctx, route, options = {}) {
  const llm = typeof ctx.get === 'function' ? ctx.get('llm') : ctx.llm;
  if (!llm || typeof llm.prepareCall !== 'function') {
    return { ok: false, error: 'DSH LLM 服務未就緒', code: 'NO_LLM' };
  }
  const config = {
    provider: route.provider,
    model: route.model,
    maxTokens: Math.max(64, Number(options.maxTokens) || 400),
    ...(options.temperature !== undefined ? { temperature: Number(options.temperature) } : {}),
    ...(route.reasoningEffort ? { reasoningEffort: route.reasoningEffort } : {}),
  };
  let prepared;
  try {
    prepared = await llm.prepareCall(config);
    if (
      options.images?.length &&
      options.visionMode !== 'native' &&
      (options.visionMode === 'modlens' || !prepared.inputModalities?.includes('image')) &&
      !/^(modlens-|deepseek-modlens$)/.test(config.provider)
    ) {
      const candidates = [
        `modlens-${config.provider}`,
        ...(config.provider === 'deepseek-official' ? ['deepseek-modlens'] : []),
      ];
      const known = new Set(listHostProviders(ctx).map((p) => p.id));
      for (const provider of candidates.filter((p) => known.has(p))) {
        try {
          const models = await llm.listModels(provider);
          const model = config.model || prepared.config?.model;
          if (!models.some((m) => m.id === model && m.inputModalities?.includes('image'))) continue;
          const wrapped = await llm.prepareCall({ ...config, provider, model });
          if (!wrapped.inputModalities?.includes('image')) continue;
          prepared = wrapped;
          config.provider = provider;
          config.model = model;
          break;
        } catch {
          /* Keep the original route and report a text-only fallback if needed. */
        }
      }
    }
  } catch (error) {
    return { ok: false, error: `無法準備模型呼叫: ${error.message}`, code: error.code };
  }
  let text = '';
  if (options.signal?.aborted) return { ok: false, code: 'CANCELLED', error: '回覆已取消' };
  const frames = options.images || [];
  let images = [],
    visionWarning;
  if (frames.length) {
    const attachments = typeof ctx.get === 'function' ? ctx.get('attachments') : ctx.attachments;
    if (!prepared.inputModalities?.includes('image')) visionWarning = 'MODEL_IMAGE_INPUT_UNAVAILABLE';
    else if (!attachments?.saveImages) visionWarning = 'ATTACHMENT_SERVICE_UNAVAILABLE';
    else {
      try {
        const refs = await attachments.saveImages(
          frames.map((frame, i) => ({
            data: new Uint8Array(Buffer.from(frame.data, 'base64')),
            mediaType: frame.mediaType,
            name: `discord-media-${i + 1}-${frame.timeMs}ms.jpg`,
          })),
        );
        images = refs.flatMap((attachment, i) => [
          {
            type: 'text',
            text: `${frames[i].source || '媒體'}，抽樣畫格 ${i + 1}，時間 ${frames[i].timeMs} ms：`,
          },
          { type: 'image', attachment },
        ]);
      } catch {
        visionWarning = 'FRAME_ADMISSION_FAILED';
      }
    }
  }
  if (options.signal?.aborted) return { ok: false, code: 'CANCELLED', error: '回覆已取消' };
  let usage;
  let finishReason = 'stop';
  let failure;
  try {
    for await (const chunk of prepared.stream({
      ...prepared.config,
      signal: options.signal,
      messages: buildMessages(
        options.system,
        options.user +
          (visionWarning
            ? '\n[圖片輸入不可用：本次沒有提供任何畫格，只能根據文字資訊回覆，不可描述未看見的畫面。]'
            : ''),
        images,
      ),
    })) {
      if (options.signal?.aborted) return { ok: false, code: 'CANCELLED', error: '回覆已取消' };
      if (chunk.usage) usage = chunk.usage;
      else if (chunk.type === 'usage') usage = chunk;
      else if (chunk.metadata?.usage) usage = chunk.metadata.usage;
      if (chunk.type === 'text-delta') {
        text += chunk.text;
        await options.onTextDelta?.(chunk.text);
      } else if (chunk.type === 'finish') {
        finishReason = chunk.reason?.kind || 'stop';
        failure = chunk.reason?.failure;
      }
    }
  } catch (error) {
    return { ok: false, error: `模型串流失敗: ${error.message}`, code: error.code };
  }
  if (finishReason !== 'stop' || failure) {
    const code = failure?.code || finishReason;
    return {
      ok: false,
      error: `模型回覆未完成 (${code}): ${truncate(failure?.message || '', 200)}`,
      code,
      provider: config.provider,
      model: config.model,
      imagesSent: images.filter((x) => x.type === 'image').length,
      visionWarning,
    };
  }
  return {
    ok: true,
    usage,
    text: tidyText(text),
    provider: config.provider,
    model: config.model,
    imagesSent: images.filter((x) => x.type === 'image').length,
    visionWarning,
  };
}

/**
 * 呼叫自訂 OpenAI 相容 API。
 */
async function rawCustomLlm(config = {}, options = {}) {
  const apiKey = await resolveApiKey(config);
  if (!apiKey) {
    return {
      ok: false,
      error: '沒有可用的 API Key（請在設定填寫，或設定 DEEPSEEK_API_KEY 等環境變數）',
      code: 'MISSING_CREDENTIAL',
    };
  }
  const base = (config.customLlmApiBase || 'https://api.deepseek.com').replace(/\/+$/, '');
  const model = config.customLlmModel || 'deepseek-chat';
  const body = {
    model,
    messages: [
      ...(options.system ? [{ role: 'system', content: options.system }] : []),
      {
        role: 'user',
        content: options.images?.length
          ? [
              { type: 'text', text: options.user },
              ...options.images.flatMap((frame, i) => [
                {
                  type: 'text',
                  text: `${frame.source || '媒體'}，抽樣畫格 ${i + 1}，時間 ${frame.timeMs} ms：`,
                },
                { type: 'image_url', image_url: { url: `data:${frame.mediaType};base64,${frame.data}` } },
              ]),
            ]
          : options.user,
      },
    ],
    max_tokens: Math.max(64, Number(options.maxTokens) || 400),
    temperature: Number.isFinite(Number(options.temperature)) ? Number(options.temperature) : 0.8,
    stream: false,
  };
  let response;
  try {
    response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (error) {
    return { ok: false, error: `連線自訂 API 失敗: ${error.message}`, code: 'NETWORK' };
  }
  const raw = await response.text();
  if (!response.ok) {
    let detail = truncate(raw, 300);
    try {
      const parsed = JSON.parse(raw);
      detail = parsed?.error?.message || detail;
    } catch {
      /* 保持原始文字 */
    }
    const code =
      response.status === 401
        ? 'AUTH'
        : response.status === 402
          ? 'INSUFFICIENT_BALANCE'
          : response.status === 429
            ? 'RATE_LIMIT'
            : `HTTP_${response.status}`;
    return { ok: false, error: `自訂 API 失敗 (${response.status}): ${detail}`, code };
  }
  try {
    const parsed = JSON.parse(raw);
    const text = parsed?.choices?.[0]?.message?.content ?? '';
    return {
      ok: true,
      usage: parsed.usage,
      text: tidyText(typeof text === 'string' ? text : JSON.stringify(text)),
      provider: 'custom',
      model,
      imagesSent: options.images?.length || 0,
    };
  } catch (error) {
    return { ok: false, error: `自訂 API 回應解析失敗: ${error.message}`, code: 'BAD_RESPONSE' };
  }
}

export async function callHostLlm(ctx, route, options = {}) {
  const meter = tokenBudgetFor(ctx);
  return meter
    ? meter.run(options.usageCategory || (options.images?.length ? 'vision' : 'text-model'), options, () =>
        rawHostLlm(ctx, route, options),
      )
    : rawHostLlm(ctx, route, options);
}
export async function callCustomLlm(config = {}, options = {}) {
  const meter = options.__meter;
  return meter
    ? meter.run(
        options.usageCategory || (options.images?.length ? 'vision-custom' : 'text-custom'),
        options,
        () => rawCustomLlm(config, options),
      )
    : rawCustomLlm(config, options);
}

/**
 * 對外統一入口：依 llmMode 選路，auto 會自動退回自訂 API。
 */
export async function generateReply(ctx, config, options = {}) {
  options = { ...options, __meter: tokenBudgetFor(ctx) };
  if (options.signal?.aborted) return { ok: false, code: 'CANCELLED', error: '回覆已取消' };
  if (options.images?.length)
    options = {
      ...options,
      maxTokens: Math.max(
        Number(options.maxTokens) || 400,
        Math.min(4000, Number(config.mediaReplyTokens) || 1600),
      ),
    };
  const errors = [];
  let hostFailure;
  if (config.llmMode !== 'custom') {
    const route = resolveRoute(ctx, config);
    if (route) {
      const result = await callHostLlm(ctx, route, {
        ...options,
        visionMode: config.mediaVisionMode || 'auto',
      });
      if (result.ok && result.text) return result;
      if (result.code === 'TOKEN_BUDGET') return result;
      hostFailure = result;
      errors.push(result.error);
      if (config.llmMode === 'subscriptions') return { ...result, ok: false, error: errors.join(' / ') };
    }
  }
  if (options.signal?.aborted) return { ok: false, code: 'CANCELLED', error: '回覆已取消' };
  const custom = await callCustomLlm(config, options);
  if (custom.ok && custom.text) return custom;
  if (custom.code === 'TOKEN_BUDGET') return custom;
  errors.push(custom.error);
  return { ...hostFailure, ok: false, error: errors.filter(Boolean).join(' / ') || '模型沒有回覆內容' };
}

/** 給 UI 的「測試模型」功能。 */
export async function testLlm(ctx, config) {
  const started = Date.now();
  const result = await generateReply(ctx, config, {
    system: '你是一個測試助手，請用一句話回答。',
    user: '請說「模型連線正常」。',
    maxTokens: 64,
    temperature: 0,
  });
  return {
    ok: result.ok,
    code: result.code,
    ms: Date.now() - started,
    text: result.ok ? truncate(result.text, 200) : '',
    error: result.ok ? undefined : result.error,
    route: resolveRoute(ctx, config),
    providers: listHostProviders(ctx),
  };
}
