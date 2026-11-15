import { randomUUID } from 'node:crypto';
const service = (ctx, name) => {
  try {
    return ctx.get?.(name) || ctx[name];
  } catch {
    return null;
  }
};
export function createVoiceOverview({
  ctx,
  voice,
  sessionBridge,
  tokenBudget,
  getConfig,
  fetchImpl = fetch,
}) {
  async function memory(sessionId, req) {
    try {
      const origin = new URL(service(ctx, 'webServer').getOrigin());
      if (!['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) throw Error();
      const r = await fetchImpl(new URL('/dsh-memu-memory/diagnoseSession', origin), {
        method: 'POST',
        redirect: 'error',
        headers: {
          'content-type': 'application/json',
          origin: origin.origin,
          ...(req.headers?.cookie ? { cookie: req.headers.cookie } : {}),
          ...(req.headers?.authorization ? { authorization: req.headers.authorization } : {}),
        },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: randomUUID(),
          method: 'diagnoseSession',
          payload: { sessionId },
        }),
        signal: AbortSignal.timeout(3000),
      });
      if (!r.ok) throw Error();
      const raw = await r.text();
      if (raw.length > 1024 * 1024) throw Error();
      const d = JSON.parse(raw);
      if (!d.result?.ok) throw Error();
      const v = d.result.value;
      return {
        available: true,
        bound: !!v.bound,
        libraryId: v.libraryId || null,
        libraryName: v.libraryName || null,
        useLibrary: v.effective?.useLibrary !== false,
        useGlobal: v.effective?.useGlobal !== false,
        status: !v.bound
          ? 'unbound'
          : v.effective?.useLibrary === false
            ? 'disabled'
            : v.libraryId
              ? 'ready'
              : 'missing-library',
      };
    } catch {
      return { available: false, status: 'unavailable' };
    }
  }
  async function snapshot(req = { headers: {} }, { withMemory = false } = {}) {
    const c = getConfig(),
      bindings = sessionBridge?.list?.() || [],
      rows = [];
    // Bound concurrent metadata probes; no synthesis or memory-library creation.
    for (let at = 0; at < Math.min(bindings.length, 40); at += 4)
      rows.push(
        ...(await Promise.all(
          bindings.slice(at, at + 4).map(async (b) => {
            let sound;
            try {
              sound = await voice.tts?.resolveVoice?.({ sessionId: b.sessionId, workspaceId: b.workspaceId });
            } catch {
              sound = { error: '音色來源暫時無法解析' };
            }
            return {
              sessionId: b.sessionId,
              workspaceId: b.workspaceId,
              title: b.title || b.key,
              transport: b.transport,
              channelId: b.channelId,
              voice: sound
                ? { ...sound, ...(c.voiceTtsVoice ? { voice: c.voiceTtsVoice, manualOverride: true } : {}) }
                : { error: '目前 TTS 未提供音色對照' },
              ...(withMemory ? { memory: await memory(b.sessionId, req) } : {}),
            };
          }),
        )),
      );
    const llm = tokenBudget?.status?.(),
      speech = voice.status().usage,
      translation =
        llm?.calls
          ?.filter((r) => r.category === 'speech-translation')
          .reduce((n, r) => n + (r.totalTokens || 0), 0) || 0;
    const estimate = (units, rate) => (rate > 0 ? Math.round(((units * rate) / 1e6) * 1e6) / 1e6 : null);
    return {
      ok: true,
      bindings: rows.map((r) => ({
        ...r,
        usage: {
          llm:
            llm?.today?.scopes?.[r.sessionId] ||
            llm?.today?.scopes?.[bindings.find((b) => b.sessionId === r.sessionId)?.key] ||
            null,
          speech: speech.scopes?.[r.sessionId] || null,
        },
      })),
      truncated: bindings.length > 40,
      usage: {
        llm,
        speech,
        translation: { recentTokens: translation, window: '最近最多60筆模型記錄，非完整日／月合計' },
        estimatedCost: {
          currency: c.voiceCostCurrency || 'USD',
          todayLlm: estimate(llm?.today?.totalTokens || 0, c.voiceLlmCostPerMillion),
          todayTts: estimate(speech.characters || 0, c.voiceTtsCostPerMillion),
          todayStt:
            c.voiceSttCostPerMinute > 0 ? ((speech.sttSeconds || 0) / 60) * c.voiceSttCostPerMinute : null,
          note: '依使用者填寫的單價及提交量估算；不同模型、重試、快取與服務商帳單可能不同。未填單價顯示未估算。',
        },
      },
      note: '只讀取綁定與統計，不建立記憶庫、不呼叫模型、不向 Discord 傳送訊息。',
    };
  }
  return { snapshot };
}
