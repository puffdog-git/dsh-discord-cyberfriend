// 第五批：答案明確時不另外呼叫模型（追問判斷 F1／D6、開討論串判斷 D7）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { FollowupWindow } from '../src/features/followup.js';
import { shouldCreateThread } from '../src/features/thread-policy.js';

// 會記錄呼叫次數的模型替身；回覆內容可指定。
function fakeHost(answer = 'YES') {
  const calls = [];
  const llm = {
    listProviders: () => [{ id: 'fixture' }],
    prepareCall: async (request) => ({ config: request, async *stream() { calls.push(request); yield { type: 'text-delta', text: answer }; } }),
  };
  return { ctx: { llm }, calls };
}
const config = { llmMode: 'subscriptions', followupEnabled: true, followupSeconds: 180 };
const transport = { kind: 'bot', epoch: 1, selfId: 'ai' };
const base = { guildId: 'g', channelId: 'c', mentions: [] };

function windowWith(authorId = 'u1') {
  const w = new FollowupWindow();
  w.remember({ ...base, id: 'm0', author: { id: authorId } }, transport, config);
  return w;
}

test('F1：剛對話過的人接著問問題，直接判定為延續，不問模型', async () => {
  const host = fakeHost('NO');
  const w = windowWith('u1');
  for (const content of ['那怎麼做？', '晚餐吃了嗎', '為何會這樣', '然後呢']) {
    const d = await w.decide(host.ctx, config, { ...base, id: 'q' + content, author: { id: 'u1' }, content }, '歷史', transport);
    assert.equal(d.relevant, true, content);
    assert.equal(d.reason, 'SAME_SPEAKER_QUESTION');
  }
  assert.equal(host.calls.length, 0);
});

test('F1：直接回覆 AI 的訊息判定為延續，不問模型', async () => {
  const host = fakeHost('NO');
  const w = windowWith('u1');
  const d = await w.decide(host.ctx, config, { ...base, id: 'r1', author: { id: 'u2' }, content: '我也這麼覺得', replyToAuthorId: 'ai' }, '歷史', transport);
  assert.deepEqual(d, { relevant: true, reason: 'REPLY_TO_AI' });
  assert.equal(host.calls.length, 0);
});

test('F1：沒和 AI 對話過的旁人只貼圖或丟很短的反應，直接判定不延續', async () => {
  const host = fakeHost('YES');
  const w = windowWith('u1');
  for (const content of ['', '笑死', '+1', 'XD', '<:pepe:123456789012345678>']) {
    const d = await w.decide(host.ctx, config, { ...base, id: 'b' + content, author: { id: 'u2' }, content }, '歷史', transport);
    assert.equal(d.relevant, false, JSON.stringify(content));
    assert.equal(d.reason, 'BYSTANDER_SHORT_REACTION');
  }
  assert.equal(host.calls.length, 0);
});

test('F1：答案不明確的情況仍交給模型判斷', async () => {
  const host = fakeHost('YES');
  const w = windowWith('u1');
  const cases = [
    { author: { id: 'u2' }, content: '我覺得剛剛那個說法有點問題耶' },
    { author: { id: 'u2' }, content: '真的嗎' },
    { author: { id: 'u1' }, content: '好喔那我先去洗澡' },
  ];
  for (const [i, row] of cases.entries()) {
    const d = await w.decide(host.ctx, config, { ...base, id: 'x' + i, ...row }, '歷史', transport);
    assert.equal(d.reason, 'MODEL_DECISION', row.content);
  }
  assert.equal(host.calls.length, cases.length);
});

test('F1：同一則訊息重複判斷時沿用結果，不重複呼叫模型', async () => {
  const host = fakeHost('YES');
  const w = windowWith('u1');
  const message = { ...base, id: 'same', author: { id: 'u2' }, content: '我覺得剛剛那個說法有點問題耶' };
  const first = await w.decide(host.ctx, config, message, '歷史', transport);
  const second = await w.decide(host.ctx, config, message, '歷史', transport);
  assert.deepEqual(second, first);
  assert.equal(host.calls.length, 1);
});

test('F1：明確對別人說話仍優先判定為不延續', async () => {
  const host = fakeHost('YES');
  const w = windowWith('u1');
  const d = await w.decide(host.ctx, config, { ...base, id: 'o1', author: { id: 'u1' }, content: '你覺得呢？', mentions: [{ id: 'u9' }] }, '歷史', transport);
  assert.deepEqual(d, { relevant: false, reason: 'EXPLICIT_OTHER_RECIPIENT' });
  assert.equal(host.calls.length, 0);
});

test('D7：明確要求開討論串直接成立；明確說不要開則直接不開；其餘長議題仍問模型', async () => {
  const host = fakeHost('INLINE');
  const message = (content) => ({ guildId: 'g', channelId: 'c', content });
  assert.equal(await shouldCreateThread(host.ctx, config, message('這題幫我開一個討論串')), true);
  assert.equal(await shouldCreateThread(host.ctx, config, message('請建立討論串來聊這個')), true);
  assert.equal(await shouldCreateThread(host.ctx, config, message('不要開討論串，直接在這裡回')), false);
  assert.equal(await shouldCreateThread(host.ctx, config, message('不用建立討論串')), false);
  assert.equal(host.calls.length, 0);
  assert.equal(await shouldCreateThread(host.ctx, config, message('幫我做一份完整規劃')), false);
  assert.equal(host.calls.length, 1, '沒有明確要求時仍由模型判斷');
  assert.equal(await shouldCreateThread(host.ctx, config, message('嗨')), false);
  assert.equal(host.calls.length, 1, '不是候選訊息時本來就不問');
});
