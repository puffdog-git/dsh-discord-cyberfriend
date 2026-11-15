// 鄉民語氣的預覽：同一句話各產生一則沒附／有附樣本的回覆，不碰 Discord。
import test from 'node:test';
import assert from 'node:assert/strict';
import { STYLE_REGISTRY, createSlangTone } from '../src/features/slang-tone.js';
import { createSlangPreview } from '../src/features/slang-preview.js';
import { sanitizeConfig } from '../src/config.js';

function setup({ config = {}, samples = [{ text: '笑死 這也太扯', source: 'C_Chat' }, { text: '韭菜表示很痛', source: 'Stock' }], reply = (user) => (user.includes('語氣參考') ? '笑死，這真的有點扯' : '這確實有點誇張。'), fail = false } = {}) {
  const provider = { id: 'ptt', lookup: (o) => ({ samples: o.sources?.length ? samples.filter((s) => o.sources.includes(s.source)) : samples, matched: 0, total: samples.length }), status: () => ({ samples: samples.length }) };
  const root = samples === null ? {} : { [STYLE_REGISTRY]: { version: 1, providers: new Map([['ptt', provider]]) } };
  const calls = [];
  const preview = createSlangPreview({
    ctx: {},
    getConfig: () => sanitizeConfig({ adminUserId: '100000000000000001', pluginPersonaEnabled: true, ...config }),
    slangTone: createSlangTone({ root }),
    selfName: () => '測試 AI',
    generate: async (_ctx, cfg, options) => {
      calls.push({ cfg, options });
      return fail ? { ok: false, error: '模型連線失敗' } : { ok: true, text: reply(options.user) };
    },
  });
  return { preview, calls };
}

test('預覽：呼叫模型兩次，一次沒附樣本、一次有附；回傳兩則回覆與用到的樣本', async () => {
  const { preview, calls } = setup();
  const r = await preview({ text: '今天股市怎麼跌成這樣', audience: 'othersGroup' });
  assert.equal(r.ok, true);
  assert.equal(calls.length, 2);
  assert.ok(!calls[0].options.user.includes('語氣參考'));
  assert.ok(calls[1].options.user.includes('語氣參考') && calls[1].options.user.includes('笑死 這也太扯'));
  assert.equal(calls[0].options.system, calls[1].options.system); // 系統段落完全一樣，差別只在這一則後面附的樣本
  assert.ok(calls[1].options.user.startsWith(calls[0].options.user));
  assert.deepEqual([r.without.text, r.with.text], ['這確實有點誇張。', '笑死，這真的有點扯']);
  assert.deepEqual(r.samples, ['笑死 這也太扯', '韭菜表示很痛']);
  assert.equal(r.audience, 'othersGroup');
});

test('預覽：不需要先開啟功能，也不受機率與冷卻影響；但套用來源限制與禁用詞', async () => {
  const { preview } = setup({ config: { othersGroup_slangToneEnabled: false, slangToneSources: ['Stock'] } });
  const r = await preview({ text: '隨便聊聊天氣', audience: 'othersGroup' });
  assert.deepEqual(r.samples, ['韭菜表示很痛']);
  const blocked = setup({ config: { slangToneBlockWords: ['笑死', '韭菜'] } });
  assert.match((await blocked.preview({ text: '隨便聊聊天氣' })).error, /樣本庫是空的/);
});

test('預覽：嚴肅話題照樣比較，但註明實際回覆時不會帶', async () => {
  const { preview } = setup();
  const r = await preview({ text: '我阿公昨天過世了', audience: 'othersDm' });
  assert.equal(r.serious, true);
  assert.match(r.note, /實際回覆時不會帶鄉民語氣/);
});

test('預覽：依對象套用設定；沒設管理者時不能預覽管理者的對象', async () => {
  const { preview, calls } = setup({ config: { adminDm_maxReplyTokens: 123 } });
  await preview({ text: '測試一下私訊', audience: 'adminDm' });
  assert.match(calls[0].options.system + calls[0].options.user, /私訊/);
  const noAdmin = setup({ config: { adminUserId: '' } });
  assert.match((await noAdmin.preview({ text: '測試一下', audience: 'adminGroup' })).error, /還沒設定管理者/);
  assert.equal((await noAdmin.preview({ text: '測試一下', audience: 'othersGroup' })).ok, true);
});

test('預覽：太短、沒有樣本來源時不呼叫模型；模型失敗時回報原因', async () => {
  const short = setup();
  assert.match((await short.preview({ text: ' a ' })).error, /請輸入/);
  assert.equal(short.calls.length, 0);
  const none = setup({ samples: null });
  assert.match((await none.preview({ text: '測試一下' })).error, /沒有安裝提供語氣樣本的插件/);
  assert.equal(none.calls.length, 0);
  const down = setup({ fail: true });
  const r = await down.preview({ text: '測試一下' });
  assert.deepEqual([r.ok, r.without.ok, r.with.ok, r.without.error], [true, false, false, '模型連線失敗']);
});

test('預覽：同一時間只跑一個', async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const { preview } = setup({ reply: () => '好' });
  const slow = createSlangPreview({
    ctx: {},
    getConfig: () => sanitizeConfig({}),
    slangTone: createSlangTone({ root: { [STYLE_REGISTRY]: { providers: new Map([['p', { lookup: () => ({ samples: [{ text: '樣本一句' }] }) }]]) } } }),
    generate: async () => (await gate, { ok: true, text: '好' }),
  });
  void preview;
  const first = slow({ text: '第一個預覽' });
  assert.match((await slow({ text: '第二個預覽' })).error, /還在進行/);
  release();
  assert.equal((await first).ok, true);
});
