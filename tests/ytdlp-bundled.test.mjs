import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { createYtdlpRunner, ytdlpCandidates } from '../src/ytdlp/runner.js';
import { createYoutubeMusic } from '../src/ytdlp/youtube-music.js';
import { youtubeMusicProvider } from '../src/music-youtube.js';
import { MusicProviders } from '../src/music-providers.js';
import { toolConfigProtected } from '../src/security.js';

const proxy = () => ({ url: 'http://job:token@127.0.0.1:1', close: async () => {} });

test('candidates: configured path first, then the DSH bin folder, then PATH; Windows adds .exe', () => {
  const win = ytdlpCandidates({ configured: 'D:/tools/yt-dlp.exe', env: { DSH_HOME: 'D:/dsh' }, home: 'C:/Users/u', platform: 'win32' });
  assert.equal(win[0], 'D:/tools/yt-dlp.exe');
  assert.equal(win[1], path.join('D:/dsh', 'bin', 'yt-dlp') + '.exe');
  assert.deepEqual(win.slice(-2), ['yt-dlp.exe', 'yt-dlp']);
  const linux = ytdlpCandidates({ env: {}, home: '/home/u', platform: 'linux' });
  assert.equal(linux[0], path.join('/home/u', '.dsh', 'bin', 'yt-dlp'));
  assert.ok(linux.includes('/usr/local/bin/yt-dlp'));
  assert.equal(linux.at(-1), 'yt-dlp');
});

test('runner finds the first working binary, caches it and re-probes when the configured path changes', async () => {
  let configured = '';
  const probes = [];
  const runner = createYtdlpRunner({
    getConfig: () => ({ musicYtdlpPath: configured }),
    env: { DSH_HOME: '/dsh' },
    home: '/home/u',
    platform: 'linux',
    run: async (bin, args) => {
      probes.push(bin);
      if (args[0] !== '--version') throw Error('unexpected');
      if (bin === '/custom/yt-dlp' || bin === 'yt-dlp') return { stdout: '2026.01.01\n' };
      throw Error('ENOENT');
    },
    startProxy: proxy,
  });
  assert.equal(runner.ready(), false);
  assert.equal((await runner.probe()).bin, 'yt-dlp');
  assert.equal(runner.ready(), true);
  const count = probes.length;
  await runner.probe();
  assert.equal(probes.length, count, '找到之後不重複偵測');
  configured = '/custom/yt-dlp';
  assert.equal(runner.ready(), false, '路徑變了要重新偵測才算可用');
  assert.equal((await runner.probe()).bin, '/custom/yt-dlp');
  assert.deepEqual(runner.status(), { found: true, version: '2026.01.01' });
});

test('every run goes through the public-only proxy with hardened arguments and never falls back', async () => {
  const calls = [];
  let closed = 0;
  const runner = createYtdlpRunner({
    env: { KEEP: '1', HTTPS_PROXY: 'http://corp-proxy' },
    home: '/home/u',
    platform: 'linux',
    run: async (bin, args, options) => {
      if (args[0] === '--version') return { stdout: '2026.01.01' };
      calls.push({ args, options });
      return { stdout: 'out', stderr: '' };
    },
    startProxy: async () => ({ url: 'http://job:token@127.0.0.1:1', close: async () => void closed++ }),
  });
  const ok = await runner.runYt(['--dump-single-json', 'https://www.youtube.com/results?search_query=a']);
  assert.deepEqual({ ok: ok.ok, stdout: ok.stdout }, { ok: true, stdout: 'out' });
  const { args, options } = calls[0];
  for (const flag of ['--ignore-config', '--no-plugin-dirs', '--no-js-runtimes', '--proxy']) assert.ok(args.includes(flag), flag);
  assert.equal(args[args.indexOf('--proxy') + 1], 'http://job:token@127.0.0.1:1');
  assert.equal(options.env.HTTPS_PROXY, 'http://job:token@127.0.0.1:1', '使用者環境的代理不能繞過檢查');
  assert.equal(options.env.NO_PROXY, '');
  assert.equal(options.env.KEEP, '1');
  assert.equal(closed, 1);
  // 私有位址、其他網路模式一律拒絕，而且不會執行 yt-dlp。
  assert.equal((await runner.runYt(['http://127.0.0.1/secret'])).ok, false);
  assert.equal((await runner.runYt(['https://www.youtube.com/'], { networkPolicy: 'any' })).ok, false);
  assert.equal(calls.length, 1);
});

test('a failing download reports a fixed message, closes the proxy and exposes no raw yt-dlp output', async () => {
  let closed = 0;
  const runner = createYtdlpRunner({
    env: {},
    home: '/home/u',
    platform: 'linux',
    run: async (bin, args) => {
      if (args[0] === '--version') return { stdout: '1' };
      throw Object.assign(Error('boom'), { stderr: 'ERROR: http://job:token@127.0.0.1:1 secret detail' });
    },
    startProxy: async () => ({ url: 'http://job:token@127.0.0.1:1', close: async () => void closed++ }),
  });
  const r = await runner.runYt(['https://www.youtube.com/watch?v=abcdefghijk']);
  assert.equal(r.ok, false);
  assert.doesNotMatch(r.error, /token|secret|127\.0\.0\.1/);
  assert.equal(closed, 1);
});

test('without a yt-dlp binary the built-in source is unavailable and explains what to do', async () => {
  const runner = createYtdlpRunner({
    env: {},
    home: '/home/u',
    platform: 'linux',
    run: async () => {
      throw Error('ENOENT');
    },
    startProxy: proxy,
  });
  const builtin = { service: createYoutubeMusic(runner.runYt), ready: () => runner.ready() };
  const providers = new MusicProviders({ scopeFor: () => ({ workspace: 'test' }) });
  providers.register(youtubeMusicProvider({ get: () => undefined }, builtin));
  await runner.probe();
  assert.equal(providers.catalog().find((p) => p.id === 'plugin:youtube').available, false);
  await assert.rejects(providers.search('plugin:youtube', '歌'), /yt-dlp 執行檔/);
});

test('built-in source searches and loads through the runner; an external service still takes priority', async () => {
  let dir;
  const runner = {
    ready: () => true,
    runYt: async (args, options) => {
      assert.equal(options.networkPolicy, 'public-only');
      if (args.includes('--flat-playlist'))
        return { ok: true, stdout: JSON.stringify({ entries: [{ id: 'abcdefghijk', title: '歌', uploader: '歌手' }, { id: 'bbbbbbbbbbb', is_live: true }] }) };
      dir = path.dirname(args[args.indexOf('-o') + 1]);
      await writeFile(path.join(dir, 'audio.webm'), 'audio');
      return { ok: true, stdout: '' };
    },
  };
  let external;
  const builtin = { service: createYoutubeMusic(runner.runYt), ready: runner.ready };
  const providers = new MusicProviders({ scopeFor: () => ({ workspace: 'test' }) });
  providers.register(youtubeMusicProvider({ get: () => external }, builtin));
  assert.equal(providers.catalog().find((p) => p.id === 'plugin:youtube').available, true);
  const found = await providers.search('plugin:youtube', '歌');
  assert.deepEqual(found.map((r) => r.title), ['歌']);
  const signal = new AbortController().signal;
  assert.equal((await providers.load('plugin:youtube', 'abcdefghijk', { signal })).toString(), 'audio');
  await assert.rejects(access(dir), '暫存資料夾要清掉');
  external = { search: async () => [{ id: 'ccccccccccc', title: '外部' }], load: async () => Buffer.from('ext') };
  assert.equal((await providers.search('plugin:youtube', '歌'))[0].title, '外部');
});

test('executable paths cannot be changed through the model-facing config tool', () => {
  assert.equal(toolConfigProtected('musicYtdlpPath'), true);
  assert.equal(toolConfigProtected('userPythonExecutable'), true);
});
