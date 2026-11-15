import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createVideoTools } from '../src/ytdlp/video-tools.js';
import { createSongWorkflow } from '../src/song-workflow/index.js';
import { allowedReplyTools } from '../src/security.js';

test('built-in video_info always uses the public-only policy and returns the fields the cover flow needs', async () => {
  const calls = [];
  const tools = createVideoTools({
    runYt: async (args, options) => {
      calls.push({ args, options });
      return {
        ok: true,
        networkPolicy: 'public-only',
        stdout: JSON.stringify({ id: 'abcdefghijk', title: '歌', uploader: '歌手', duration: 201, webpage_url: 'https://www.youtube.com/watch?v=abcdefghijk' }),
      };
    },
  });
  assert.ok(tools.video_info.parameters.properties.networkPolicy.enum.includes('public-only'));
  const info = await tools.video_info.execute({ url: 'https://www.youtube.com/watch?v=abcdefghijk', networkPolicy: 'public-only' });
  assert.deepEqual(
    { ok: info.ok, title: info.title, duration: info.duration, policy: info.networkPolicy, page: info.webpageUrl },
    { ok: true, title: '歌', duration: '3:21', policy: 'public-only', page: 'https://www.youtube.com/watch?v=abcdefghijk' },
  );
  assert.equal(calls[0].options.networkPolicy, 'public-only');
  assert.ok(calls[0].args.includes('--no-playlist'));
  await assert.rejects(tools.video_info.execute({ url: 'https://a.example/', networkPolicy: 'any' }), /網路模式/);
});

test('built-in video_download only extracts audio into an absolute folder and names files by video id', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cyberfriend-vt-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const ffmpeg = path.join(dir, 'ffmpeg.exe');
  await fs.writeFile(ffmpeg, 'x');
  const calls = [];
  const tools = createVideoTools({
    ffmpegPath: ffmpeg,
    runYt: async (args, options) => {
      calls.push({ args, options });
      const out = path.join(path.dirname(args[args.indexOf('-o') + 1]), 'abcdefghijk.wav');
      await fs.writeFile(out, 'audio');
      return { ok: true, networkPolicy: 'public-only', stdout: out + '\n' };
    },
  });
  const outdir = path.join(dir, 'download');
  const done = await tools.video_download.execute({ url: 'https://www.youtube.com/watch?v=abcdefghijk', audioOnly: true, audioFormat: 'wav', outdir, playList: false });
  assert.equal(done.ok, true);
  assert.equal(done.networkPolicy, 'public-only');
  assert.deepEqual(done.files.map((f) => f.name), ['abcdefghijk.wav']);
  const { args } = calls[0];
  assert.equal(args[args.indexOf('-o') + 1], path.join(outdir, '%(id)s.%(ext)s'));
  assert.equal(args[args.indexOf('--ffmpeg-location') + 1], dir);
  assert.deepEqual(args.slice(args.indexOf('-x'), args.indexOf('-x') + 3), ['-x', '--audio-format', 'wav']);
  assert.ok(args.includes('--no-playlist'));
  for (const bad of [
    { url: 'https://a.example/', audioOnly: true, outdir: 'relative' },
    { url: 'https://a.example/', audioOnly: false, outdir },
    { url: 'https://a.example/', audioOnly: true, outdir, audioFormat: 'exe' },
    { url: 'https://a.example/', audioOnly: true, outdir, playList: true },
  ])
    assert.equal((await tools.video_download.execute(bad)).ok, false);
  assert.equal(calls.length, 1, '參數不合規時不會執行 yt-dlp');
});

function workflow({ registered = {}, config = { singingEnabled: true }, searchSongs } = {}) {
  const builtin = createVideoTools({ runYt: async () => ({ ok: false, error: 'unused' }) });
  const agent = { session: { id: 's' } };
  const flow = createSongWorkflow({
    ctx: { get: (name) => (name === 'tools' ? { get: (tool) => registered[tool] } : undefined) },
    delivery: {},
    getConfig: () => config,
    scopeFor: (a) => (a === agent ? { actorId: 'u', message: {} } : null),
    builtinTools: builtin,
    searchSongs,
  });
  return { flow, agent, builtin };
}

test('cover flow uses the built-in download tools when no other plugin registered them, and prefers a registered one', () => {
  const none = workflow();
  const byName = (flow) => Object.fromEntries(flow.status().tools.map((row) => [row.name, row]));
  assert.deepEqual(
    { registered: byName(none.flow).video_info.registered, builtin: byName(none.flow).video_info.builtin },
    { registered: true, builtin: true },
  );
  assert.equal(byName(none.flow).video_download.builtin, true);
  assert.equal(byName(none.flow).cover_doctor.registered, false, '翻唱引擎仍然需要外部插件');
  const external = { name: 'video_info', execute() {} };
  const withExternal = workflow({ registered: { video_info: external } });
  assert.equal(byName(withExternal.flow).video_info.builtin, false);
});

test('song_cover_search returns YouTube candidates as URLs, only when singing is enabled and in a Discord turn', async () => {
  const queries = [];
  const searchSongs = async (query) => {
    queries.push(query);
    return [{ id: 'abcdefghijk', title: '歌', artist: '歌手' }];
  };
  const { flow, agent } = workflow({ searchSongs });
  const search = flow.definitions.find((d) => d.name === 'song_cover_search');
  const result = await search.execute({ query: '歌名' }, { agent, signal: new AbortController().signal });
  assert.deepEqual(result, { ok: true, candidates: [{ title: '歌', uploader: '歌手', url: 'https://www.youtube.com/watch?v=abcdefghijk' }] });
  assert.deepEqual(queries, ['歌名']);
  await assert.rejects(search.execute({ query: '歌名' }, { agent: {}, signal: new AbortController().signal }), /Discord/);
  const off = workflow({ searchSongs, config: {} });
  await assert.rejects(
    off.flow.definitions.find((d) => d.name === 'song_cover_search').execute({ query: 'x' }, { agent: off.agent }),
    /啟用/,
  );
  assert.equal(queries.length, 1);
  assert.equal(workflow().flow.definitions.some((d) => d.name === 'song_cover_search'), false, '沒有搜尋來源就不提供搜尋工具');
});

test('the search tool is granted together with the other cover tools', () => {
  const admin = { adminUserId: '1', singingEnabled: true };
  const dm = { isDm: true, isGroupDm: false, author: { id: '1' } };
  assert.ok(allowedReplyTools(admin, dm, '1').includes('song_cover_search'));
  assert.ok(!allowedReplyTools({ adminUserId: '1' }, dm, '1').includes('song_cover_search'));
});
