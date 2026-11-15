import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { checksumFor, createYtdlpInstaller, ytdlpAsset, ytdlpInstallPath } from '../src/ytdlp/installer.js';
import { createYtdlpRunner } from '../src/ytdlp/runner.js';

const sha = (data) => createHash('sha256').update(data).digest('hex');
async function home(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cyberfriend-ytdlp-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}
// 假的 GitHub：只回應校驗清單與執行檔兩個網址，並記錄被要求了什麼。
function github({ body = Buffer.from('fake-binary'), sums, status = 200, requests = [] } = {}) {
  return async (url) => {
    requests.push(String(url));
    if (String(url).endsWith('/SHA2-256SUMS'))
      return new Response(sums ?? sha(body) + '  yt-dlp.exe\n' + sha('other') + '  yt-dlp_linux\n', { status });
    return new Response(body, { status });
  };
}

test('asset names and install path follow the platform', () => {
  assert.equal(ytdlpAsset({ platform: 'win32', arch: 'x64' }), 'yt-dlp.exe');
  assert.equal(ytdlpAsset({ platform: 'linux', arch: 'arm64' }), 'yt-dlp_linux_aarch64');
  assert.equal(ytdlpAsset({ platform: 'darwin', arch: 'arm64' }), 'yt-dlp_macos');
  assert.equal(ytdlpAsset({ platform: 'freebsd', arch: 'x64' }), '');
  assert.equal(
    ytdlpInstallPath({ env: { DSH_HOME: path.join('D:', 'dsh') }, home: 'x', platform: 'win32' }),
    path.join('D:', 'dsh', 'bin', 'yt-dlp.exe'),
  );
  assert.equal(ytdlpInstallPath({ env: {}, home: path.join('h'), platform: 'linux' }), path.join('h', '.dsh', 'bin', 'yt-dlp'));
});

test('checksum lookup matches the exact file name only', () => {
  const sums = 'a'.repeat(64) + '  yt-dlp.exe\n' + 'b'.repeat(64) + ' *yt-dlp_linux\n' + 'c'.repeat(64) + '  yt-dlp.exe.sig\n';
  assert.equal(checksumFor(sums, 'yt-dlp.exe'), 'a'.repeat(64));
  assert.equal(checksumFor(sums, 'yt-dlp_linux'), 'b'.repeat(64));
  assert.equal(checksumFor(sums, 'yt-dlp_macos'), '');
});

test('a verified download is installed under the DSH bin folder, from the official release only', async (t) => {
  const dir = await home(t),
    requests = [];
  const installer = createYtdlpInstaller({ env: { DSH_HOME: dir }, platform: 'win32', arch: 'x64', fetchImpl: github({ requests }) });
  const result = await installer.install();
  assert.equal(result.ok, true);
  assert.equal(result.path, path.join(dir, 'bin', 'yt-dlp.exe'));
  assert.equal(await fs.readFile(result.path, 'utf8'), 'fake-binary');
  assert.deepEqual(requests, [
    'https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS',
    'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
  ]);
  assert.equal(installer.status().state, 'installed');
  assert.deepEqual(await fs.readdir(path.join(dir, 'bin')), ['yt-dlp.exe']);
});

test('a checksum mismatch discards the download and keeps any existing binary', async (t) => {
  const dir = await home(t);
  await fs.mkdir(path.join(dir, 'bin'));
  await fs.writeFile(path.join(dir, 'bin', 'yt-dlp.exe'), 'old-good');
  const installer = createYtdlpInstaller({
    env: { DSH_HOME: dir },
    platform: 'win32',
    arch: 'x64',
    fetchImpl: github({ sums: sha('something else') + '  yt-dlp.exe\n' }),
  });
  const result = await installer.install();
  assert.equal(result.ok, false);
  assert.match(result.error, /校驗值不符/);
  assert.equal(await fs.readFile(path.join(dir, 'bin', 'yt-dlp.exe'), 'utf8'), 'old-good');
  assert.deepEqual(await fs.readdir(path.join(dir, 'bin')), ['yt-dlp.exe'], '不留下暫存檔');
  assert.equal(installer.status().state, 'failed');
});

test('missing checksum entry, HTTP errors and unsupported platforms fail without writing anything', async (t) => {
  const dir = await home(t);
  const cases = [
    [{ sums: sha('x') + '  yt-dlp_linux\n' }, { platform: 'win32', arch: 'x64' }, /找不到 yt-dlp\.exe/],
    [{ status: 503 }, { platform: 'win32', arch: 'x64' }, /HTTP 503/],
    [{}, { platform: 'freebsd', arch: 'x64' }, /沒有可自動下載/],
  ];
  for (const [server, target, expected] of cases) {
    const result = await createYtdlpInstaller({ env: { DSH_HOME: dir }, ...target, fetchImpl: github(server) }).install();
    assert.equal(result.ok, false);
    assert.match(result.error, expected);
  }
  assert.ok(!existsSync(path.join(dir, 'bin', 'yt-dlp.exe')));
});

test('concurrent installs share one download', async (t) => {
  const dir = await home(t),
    requests = [];
  const installer = createYtdlpInstaller({ env: { DSH_HOME: dir }, platform: 'win32', arch: 'x64', fetchImpl: github({ requests }) });
  const [a, b] = await Promise.all([installer.install(), installer.install()]);
  assert.equal(a.ok && b.ok, true);
  assert.equal(requests.length, 2);
});

test('the runner downloads on first use, but never when the user configured their own path', async () => {
  let installs = 0,
    installed = false;
  const make = (configured) =>
    createYtdlpRunner({
      getConfig: () => ({ musicYtdlpPath: configured }),
      env: {},
      home: '/home/u',
      platform: 'linux',
      run: async (bin, args) => {
        if (args[0] === '--version') {
          if (installed) return { stdout: '2026.01.01' };
          throw Error('ENOENT');
        }
        return { stdout: 'out', stderr: '' };
      },
      startProxy: async () => ({ url: 'http://job:t@127.0.0.1:1', close: async () => {} }),
      install: async () => {
        installs++;
        installed = true;
        return { ok: true };
      },
    });
  const auto = await make('').runYt(['https://www.youtube.com/watch?v=abcdefghijk']);
  assert.equal(auto.ok, true);
  assert.equal(installs, 1);
  installed = false;
  const manual = await make('/my/yt-dlp').runYt(['https://www.youtube.com/watch?v=abcdefghijk']);
  assert.equal(manual.ok, false);
  assert.match(manual.error, /找不到 yt-dlp/);
  assert.equal(installs, 1, '使用者指定了路徑就不代為下載');
});
