// 鄉民語氣：從候選裡挑哪幾句樣本。
import test from 'node:test';
import assert from 'node:assert/strict';
import { STYLE_REGISTRY, buildBlock, chooseSamples, createSlangTone, toneRichness } from '../src/features/slang-tone.js';
import { sanitizeConfig, audienceConfig } from '../src/config.js';

const s = (text) => ({ text, source: 'A' });

test('口氣：語助詞與口頭禪越多分數越高；單純陳述事情的句子是 0', () => {
  assert.equal(toneRichness('大巨蛋租的到嗎'), 0);
  assert.ok(toneRichness('笑死 根本亂來啦') >= 3);
  assert.ok(toneRichness('真的假的 太扯了吧') > toneRichness('明天開盤見'));
});

test('挑樣本：話題對不上時優先挑有口氣的句子，同分維持提供者給的順序', () => {
  const picked = chooseSamples([s('大巨蛋租的到嗎'), s('主辦還要出獎金'), s('笑死 根本亂來啦'), s('明天開盤見'), s('真的假的啦'), s('太扯了吧')], 0);
  assert.deepEqual(picked.map((x) => x.text), ['笑死 根本亂來啦', '真的假的啦', '太扯了吧']);
  assert.deepEqual(chooseSamples([s('一'), s('二'), s('三'), s('四')], 0).map((x) => x.text), ['一', '二', '三']);
});

test('挑樣本：話題對得上的留最多兩句在最前面，剩下的位置給有口氣的', () => {
  const picked = chooseSamples([s('台積電法說會前先觀望'), s('法說會後再進場'), s('台積電長期看好'), s('笑死 韭菜啦'), s('普通的一句')], 3);
  assert.deepEqual(picked.map((x) => x.text), ['台積電法說會前先觀望', '法說會後再進場', '笑死 韭菜啦']);
  assert.equal(chooseSamples([], 2).length, 0);
});

test('向提供者要樣本時帶上訊息編號當打散的依據，一次要 12 句；預覽用訊息內容當依據', () => {
  const calls = [];
  const provider = { id: 'ptt', lookup: (o) => (calls.push(o), { samples: [s('笑死 這也太扯')], matched: 0, total: 1 }) };
  const tone = createSlangTone({ root: { [STYLE_REGISTRY]: { providers: new Map([['ptt', provider]]) } }, roll: () => 0 });
  const config = audienceConfig(sanitizeConfig({ othersGroup_slangToneEnabled: true }), '2', false);
  tone.decide({ message: { id: 'm-123', channelId: 'c1', content: '你好啊' }, config, scope: 'bot:9:c1' });
  assert.deepEqual([calls[0].seed, calls[0].count, calls[0].query], ['m-123', 12, '你好啊']);
  tone.sampleFor('預覽這一句', config);
  assert.equal(calls[1].seed, 'preview:預覽這一句');
});

test('預設的嚴肅話題包含情緒低落與壓力', () => {
  const words = sanitizeConfig({}).slangToneSeriousWords;
  for (const w of ['壓力', '焦慮', '心情很差', '住院', '過世', '想哭']) assert.ok(words.includes(w), w);
});

test('附上去的文字要求只改口氣、不改內容與立場', () => {
  const block = buildBlock([s('笑死')]);
  assert.match(block, /只改變說話的口氣，回答的內容與立場照原本的來/);
  assert.match(block, /不要因此變得比較酸、比較武斷/);
});
