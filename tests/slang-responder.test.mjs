// 鄉民語氣接進真正的回覆流程：送給模型的內容在該附的時候有樣本、不該附的時候完全沒有。
import test from 'node:test';
import assert from 'node:assert/strict';
import { HistoryStore } from '../src/history.js';
import { createResponder } from '../src/features/responder.js';
import { STYLE_REGISTRY, createSlangTone } from '../src/features/slang-tone.js';
import { sanitizeConfig } from '../src/config.js';

const quiet = { info() {}, debug() {}, warn() {}, error() {} };
const message = (content, over = {}) => ({ id: '1560000000000000007', channelId: '1560000000000000004', isDm: true, author: { id: 'sender', name: 'sender' }, content, ts: '2026-11-11T09:00:00Z', ...over });
const config = (over = {}) => sanitizeConfig({ enabled: true, userEnabled: true, userAutoReply: true, userReceiveOnly: false, dryRun: false, minReplyDelaySeconds: 0, maxReplyDelaySeconds: 0, userSimulateTyping: false, ...over });

/** 跑一次真正的 respond()，回傳送給模型的系統段落與使用者訊息。 */
async function run({ cfg, text = '今天晚餐吃什麼', roll = () => 0, spoken = false, samples = [{ text: '笑死 這也太扯', source: 'C_Chat' }, { text: '樓上說得好 給推', source: 'C_Chat' }] } = {}) {
  const sent = [];
  const prompts = [];
  const llm = {
    listProviders: () => [{ provider: 'fixture' }],
    prepareCall: async (c) => ({
      config: c,
      async *stream(request) {
        prompts.push(request.messages);
        yield { type: 'text-delta', text: '好喔' };
        yield { type: 'finish', reason: { kind: 'stop' } };
      },
    }),
  };
  const root = { [STYLE_REGISTRY]: { version: 1, providers: new Map([['ptt', { id: 'ptt', lookup: () => ({ samples, matched: 0, total: samples.length }) }]]) } };
  const history = new HistoryStore({ config: cfg });
  const slangTone = createSlangTone({ history, log: quiet, root, roll });
  const responder = createResponder({ slangTone, ctx: { get: () => llm }, getConfig: () => cfg, history, ledger: { record() {} }, log: quiet, semaphore: { run: (fn) => fn() }, speechExpected: () => spoken });
  const transport = { kind: 'user', epoch: 1, selfId: 'self', sendMessage: async (_channel, options) => (sent.push(options), { ok: true, messageId: '1560000000000000099' }) };
  await responder.respond(message(text), 'dm', transport);
  const flat = (role) => prompts.flatMap((m) => m.filter((x) => x.role === role).flatMap((x) => x.content.filter((b) => b.type === 'text').map((b) => b.text))).join('\n');
  return { system: flat('system'), user: flat('user'), sent, status: slangTone.status() };
}

test('開啟且機率抽中：使用者訊息後面附上語氣參考與樣本；系統段落和沒附時完全一樣', async () => {
  const on = await run({ cfg: config({ othersDm_slangToneEnabled: true, othersDm_dmReplyEnabled: true }) });
  assert.match(on.user, /語氣參考/);
  assert.match(on.user, /・笑死 這也太扯/);
  assert.ok(!on.system.includes('語氣參考'));
  assert.equal(on.status.usedToday, 1);
  const off = await run({ cfg: config({ othersDm_slangToneEnabled: false, othersDm_dmReplyEnabled: true }) });
  assert.ok(!off.user.includes('語氣參考') && !off.user.includes('笑死'));
  assert.equal(off.system, on.system);
  assert.ok(on.user.startsWith(off.user)); // 差別只有後面多的那一段
  assert.equal(off.status.usedToday, 0);
});

test('沒抽中、嚴肅話題、會被朗讀時，送給模型的內容沒有任何樣本', async () => {
  const base = { othersDm_slangToneEnabled: true, othersDm_dmReplyEnabled: true };
  const miss = await run({ cfg: config(base), roll: () => 99 });
  assert.ok(!miss.user.includes('語氣參考'));
  const serious = await run({ cfg: config(base), text: '我阿公昨天過世了' });
  assert.ok(!serious.user.includes('語氣參考'));
  assert.equal(serious.status.byReason.SKIP_SERIOUS, 1);
  const spoken = await run({ cfg: config(base), spoken: true });
  assert.ok(!spoken.user.includes('語氣參考'));
  assert.equal(spoken.status.byReason.SKIP_VOICE, 1);
});

test('對象各自獨立：只開群聊時，私訊不附', async () => {
  const r = await run({ cfg: config({ othersGroup_slangToneEnabled: true, othersDm_slangToneEnabled: false, othersDm_dmReplyEnabled: true }) });
  assert.ok(!r.user.includes('語氣參考'));
});
