// 語音房的回覆是否也發到文字頻道（voiceReplyTextEnabled）。
// 關閉時：語音輸入觸發的回覆只唸不發文字；朗讀排不進去或播放失敗時退回發文字；被使用者中止時不補發。
import test from 'node:test';
import assert from 'node:assert/strict';
import { createResponder } from '../src/features/responder.js';
import { HistoryStore } from '../src/history.js';
import { sanitizeConfig } from '../src/config.js';

const tick = () => new Promise((r) => setTimeout(r, 10));
function fixture({ textEnabled, speakOnly, beginSpeech, kind = 'bot', reply = '好的，收到。' }) {
  const config = sanitizeConfig({
    enabled: true,
    dryRun: false,
    replyEngine: 'direct',
    llmMode: 'subscriptions',
    subscriptionProvider: 'fixture',
    subscriptionModel: 'test',
    historyEnabled: false,
    botEmbedReplies: false,
    minReplyDelaySeconds: 0,
    maxReplyDelaySeconds: 0,
    gifEnabled: false,
    stickerAutoSendEnabled: false,
    autoReactionEnabled: false,
    antiAiFlavor: false,
    voiceReplyTextEnabled: textEnabled,
    voiceIncrementalReplies: Boolean(beginSpeech),
  });
  const sent = [],
    delivered = [],
    spoken = [];
  const llm = {
    listProviders: () => [{ id: 'fixture' }],
    prepareCall: async () => ({
      config: {},
      stream: async function* () {
        yield { type: 'text-delta', text: reply };
        yield { type: 'finish', reason: { kind: 'stop' } };
      },
    }),
  };
  const responder = createResponder({
    ctx: { get: (n) => (n === 'llm' ? llm : null) },
    getConfig: () => config,
    history: new HistoryStore({ config }),
    ledger: { record() {} },
    log: { info() {}, warn() {}, error() {} },
    semaphore: { run: (fn) => fn() },
    beginSpeech,
    onTextDelivered: (_m, _t, text) => delivered.push(text),
    speakOnly: (_m, _t, text) => {
      spoken.push(text);
      return speakOnly(text);
    },
  });
  const transport = {
    kind,
    selfId: '1560000000000000001',
    sendMessage: async (_c, options) => {
      sent.push(options.content);
      return { ok: true, messageId: '1560000000000000010' };
    },
  };
  const message = (extra = {}) => ({
    id: 'voice-fixture',
    voiceInput: true,
    guildId: '400000000000000004',
    channelId: '400000000000000008',
    author: { id: '400000000000000001' },
    content: '你好',
    attachments: [],
    stickers: [],
    ...extra,
  });
  return { config, sent, delivered, spoken, responder, transport, message };
}

test('default keeps sending the text reply for voice input', async () => {
  assert.equal(sanitizeConfig({}).voiceReplyTextEnabled, true);
  const f = fixture({ textEnabled: true, speakOnly: () => ({ done: Promise.resolve({ ok: true }) }) });
  assert.equal((await f.responder.respond(f.message(), 'mention', f.transport)).ok, true);
  assert.deepEqual(f.sent, ['好的，收到。']);
  assert.deepEqual(f.spoken, []);
  assert.equal(f.delivered.length, 1);
});

test('turned off: a voice-triggered reply is spoken once and no text is sent', async () => {
  const f = fixture({ textEnabled: false, speakOnly: () => ({ done: Promise.resolve({ ok: true }) }) });
  const result = await f.responder.respond(f.message(), 'mention', f.transport);
  await tick();
  assert.equal(result.ok, true);
  assert.equal(result.voiceOnly, true);
  assert.deepEqual(f.spoken, ['好的，收到。']);
  assert.deepEqual(f.sent, []);
  assert.deepEqual(f.delivered, []);
});

test('turned off: typed messages still get a text reply', async () => {
  const f = fixture({ textEnabled: false, speakOnly: () => ({ done: Promise.resolve({ ok: true }) }) });
  await f.responder.respond(
    f.message({ id: '1570000000000000001', voiceInput: false }),
    'mention',
    f.transport,
  );
  assert.deepEqual(f.sent, ['好的，收到。']);
  assert.deepEqual(f.spoken, []);
});

test('turned off: speech that cannot be queued falls back to text without a second reading', async () => {
  for (const speakOnly of [
    () => {
      throw Error('今日 TTS 字數預算不足');
    },
    () => null,
    () => ({ ok: true, skipped: true }),
  ]) {
    const f = fixture({ textEnabled: false, speakOnly });
    assert.equal((await f.responder.respond(f.message(), 'mention', f.transport)).ok, true);
    assert.deepEqual(f.sent, ['好的，收到。']);
    assert.deepEqual(f.delivered, []);
  }
});

test('turned off: playback failure sends the text afterwards; a deliberate stop does not', async () => {
  const failed = fixture({
    textEnabled: false,
    speakOnly: () => ({ done: Promise.resolve({ ok: false, error: 'TTS 失敗' }) }),
  });
  await failed.responder.respond(failed.message(), 'mention', failed.transport);
  await tick();
  assert.deepEqual(failed.sent, ['好的，收到。']);
  assert.deepEqual(failed.delivered, []);
  const stopped = fixture({
    textEnabled: false,
    speakOnly: () => ({ done: Promise.resolve({ ok: false, cancelled: true }) }),
  });
  await stopped.responder.respond(stopped.message(), 'mention', stopped.transport);
  await tick();
  assert.deepEqual(stopped.sent, []);
});

for (const kind of ['user', 'bot']) {
  test(kind + ' voice-only incremental playback survives reply cleanup until audio finishes', async () => {
    const parts = [],
      cancellations = [];
    let finishPlayback,
      ended = false;
    const done = new Promise((resolve) => {
      finishPlayback = resolve;
    });
    const f = fixture({
      kind,
      textEnabled: false,
      reply: '第一句完整。第二句也完整。測試完成。',
      speakOnly: () => {
        throw Error('must reuse incremental playback');
      },
      beginSpeech: () => ({
        started: true,
        done,
        push: (text) => parts.push(text),
        end() {
          ended = true;
        },
        cancel(reason) {
          cancellations.push(reason);
        },
        reference() {},
      }),
    });
    const result = await f.responder.respond(f.message(), 'mention', f.transport);
    assert.equal(result.ok, true);
    assert.equal(result.voiceOnly, true);
    assert.notEqual(result.uncertain, true);
    assert.equal(ended, true);
    assert.deepEqual(cancellations, []);
    assert.equal(parts.join(''), '第一句完整。第二句也完整。測試完成。');
    assert.deepEqual(f.sent, []);
    assert.deepEqual(f.spoken, []);
    finishPlayback({ ok: true });
    await tick();
    assert.deepEqual(cancellations, []);
    assert.deepEqual(f.sent, []);
    f.responder.dispose?.();
  });
}
