// 即時音樂來源：登記處的 openLive、音量與收尾、語音佇列的即時播放。
import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough, Readable } from 'node:stream';
import { MusicProviders } from '../src/music-providers.js';
import { livePcm } from '../src/voice-stream.js';
import { DiscordVoice } from '../src/voice.js';

const collect = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
};
const signal = () => new AbortController().signal;

test('登記處：有 openLive 的來源標成即時，回傳的必須是串流；一般來源不能當即時用', async () => {
  const p = new MusicProviders();
  const source = new PassThrough();
  let seen;
  p.register({ id: 'live', load: async () => Buffer.from('x'), openLive: async (id, ctx) => ((seen = [id, !!ctx.signal]), { stream: source }) });
  p.register({ id: 'file', load: async () => Buffer.from('x') });
  p.register({ id: 'broken', load() {}, openLive: async () => ({ stream: 'not a stream' }) });
  const catalog = Object.fromEntries(p.catalog().map((row) => [row.id, row]));
  assert.equal(catalog['plugin:live'].live, true);
  assert.equal('live' in catalog['plugin:file'], false);
  assert.equal(p.isLive('plugin:live'), true);
  assert.equal(p.isLive('plugin:file'), false);
  assert.equal(p.isLive('tool:live'), false);
  const opened = await p.openLive('plugin:live', 'app:spotify', { signal: signal() });
  assert.equal(opened.stream, source);
  assert.deepEqual(seen, ['app:spotify', true]);
  await assert.rejects(p.openLive('plugin:file', 'x', { signal: signal() }), /不提供即時串流/);
  await assert.rejects(p.openLive('plugin:broken', 'x', { signal: signal() }), /沒有回傳音訊串流/);
  await assert.rejects(p.openLive('plugin:live', '', { signal: signal() }), /有效曲目/);
  // 逐首決定：同一個來源裡 live: 開頭的即時播放，其他照一般方式載入。
  p.register({ id: 'mixed', load: async () => Buffer.from('file'), openLive: async () => ({ stream: new PassThrough() }), isLiveTrack: (track) => track.startsWith('live:') });
  assert.equal(p.isLive('plugin:mixed'), true, '沒給曲目時回答有沒有即時播放的能力');
  assert.equal(p.isLive('plugin:mixed', 'live:abc'), true);
  assert.equal(p.isLive('plugin:mixed', 'abc'), false);
  assert.equal(p.catalog().find((row) => row.id === 'plugin:mixed').live, true);
  await assert.rejects(p.openLive('plugin:mixed', 'abc', { signal: signal() }), /不提供即時串流/);
  assert.ok((await p.openLive('plugin:mixed', 'live:abc', { signal: signal() })).stream);
  assert.equal((await p.load('plugin:mixed', 'abc', { signal: signal() })).toString(), 'file');
  p.register({ id: 'throws', load() {}, openLive() {}, isLiveTrack: () => { throw Error('x'); } });
  assert.equal(p.isLive('plugin:throws', 'a'), false);
});

test('登記處：開啟期間被取消時，之後才開好的串流會被關掉', async () => {
  const p = new MusicProviders();
  const late = new PassThrough();
  let release;
  p.register({ id: 'slow', load() {}, openLive: () => new Promise((resolve) => (release = () => resolve({ stream: late }))) });
  const controller = new AbortController();
  const pending = p.openLive('plugin:slow', 'x', { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending);
  release();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(late.destroyed, true);
});

test('livePcm：套用音量、每一塊都是 4 的倍數、到上限就正常結束並關掉來源', async () => {
  const sample = (v) => {
    const b = Buffer.alloc(2);
    b.writeInt16LE(v);
    return b;
  };
  const frame = Buffer.concat([sample(1000), sample(-2000)]);
  // 故意切成不對齊的小塊。
  const whole = Buffer.concat([frame, frame, frame]);
  const source = Readable.from([whole.subarray(0, 3), whole.subarray(3, 9), whole.subarray(9)]);
  const half = await collect(livePcm(source, { volume: 0.5 }));
  assert.equal(half.length, 12);
  assert.deepEqual([half.readInt16LE(0), half.readInt16LE(2)], [500, -1000]);

  const endless = new PassThrough();
  const limited = livePcm(endless, { volume: 1, maxBytes: 8 });
  const sizes = [];
  limited.on('data', (chunk) => sizes.push(chunk.length));
  endless.write(Buffer.concat([frame, frame, frame, frame]));
  const out = await collect(limited).catch(() => Buffer.alloc(0));
  assert.ok(sizes.every((n) => n % 4 === 0));
  assert.equal(sizes.reduce((a, b) => a + b, 0) + out.length, 8);
  assert.equal(endless.destroyed, true);
});

function fakeVoice(adapter) {
  const v = Object.create(DiscordVoice.prototype);
  v.check = () => {};
  v.now = () => 1000;
  v.day = () => 'd';
  v.usage = { days: {} };
  v.save = async () => {};
  const s = { adapter, queue: [], closed: false };
  return { v, s };
}
const cfg = { voiceVolume: 100, voiceMaxMusicMinutes: 10 };

test('語音佇列：即時來源直接把串流送進語音房，結束後關掉來源', async () => {
  const source = new PassThrough();
  let played;
  const { v, s } = fakeVoice({
    playStream: async (stream) => {
      played = collect(stream);
      source.end(Buffer.alloc(8, 1));
      await played;
      return { ok: true, started: true };
    },
  });
  let result;
  const j = { id: 'j', type: 'music', live: true, controller: new AbortController(), open: async () => ({ stream: source }), resolve: (r) => (result = r) };
  await v.playLive(s, j, cfg, setTimeout(() => {}, 0));
  assert.equal((await played).length, 8);
  assert.equal(result.ok, true);
  assert.equal(s.lastResult.live, true);
  assert.equal(source.destroyed, true);
  assert.equal(j.phase, 'playing');
});

test('語音佇列：有人要說話時讓出，之後重新排回去；播放失敗也會關掉來源', async () => {
  const first = new PassThrough();
  const { v, s } = fakeVoice({ playStream: async () => ({ ok: false, interrupted: true }) });
  s.queue.push({ type: 'speech' });
  let resolved = false;
  const j = { id: 'j', type: 'music', live: true, resumeAfterSpeech: true, controller: new AbortController(), open: async () => ({ stream: first }), resolve: () => (resolved = true) };
  await v.playLive(s, j, cfg, setTimeout(() => {}, 0));
  assert.equal(resolved, false, '還沒結束，不回報結果');
  assert.equal(s.queue.at(-1), j);
  assert.equal(j.phase, 'queued');
  assert.equal(first.destroyed, true, '讓出時關掉來源，之後重新開');

  const second = new PassThrough();
  const broken = fakeVoice({ playStream: async () => Promise.reject(Error('boom')) });
  const k = { id: 'k', type: 'music', live: true, controller: new AbortController(), open: async () => ({ stream: second }), resolve() {} };
  await assert.rejects(broken.v.playLive(broken.s, k, cfg, setTimeout(() => {}, 0)), /boom/);
  assert.equal(second.destroyed, true);

  const none = fakeVoice({});
  await assert.rejects(none.v.playLive(none.s, k, cfg, setTimeout(() => {}, 0)), /不支援即時串流/);
});
