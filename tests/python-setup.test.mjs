import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import {
  basePythonCandidates,
  createPythonSetup,
  tidyOutput,
  venvDir,
  venvPython,
  versionOk,
} from '../src/python-setup.js';

const home = join('C:', 'Users', 'someone');
const sourceRoot = join('C:', 'work', 'dsh-discord-cyberfriend');
const packageRoot = join(home, '.dsh', 'profiles', 'web', 'node_modules', 'dsh-discord-cyberfriend');
const dshPython = join(home, '.dsh', 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'python', 'python.exe');

/** 假的子程序：依指令內容決定輸出與結束碼，並記下每一次呼叫。 */
function fakeSpawn(script) {
  const calls = [];
  const impl = (file, args, options) => {
    calls.push({ file, args, env: options.env });
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = () => {
      proc.killed = true;
      setImmediate(() => proc.emit('exit', null));
    };
    const result = script({ file, args, proc }) || { code: 0 };
    if (!result.hang)
      setImmediate(() => {
        if (result.out) proc.stdout.emit('data', result.out);
        if (result.err) proc.stderr.emit('data', result.err);
        proc.emit('exit', result.code ?? 0);
      });
    return proc;
  };
  return { impl, calls };
}

const isProbe = (args) => args.includes('-c');
const isVenv = (args) => args.includes('venv');
const isPip = (args) => args.includes('pip');

function setup({ root = packageRoot, config = {}, script, files = [dshPython] } = {}) {
  const present = new Set(files);
  const spawn = fakeSpawn((call) => {
    if (isVenv(call.args)) present.add(venvPython(venvDir({ root, env: {}, home }), 'win32'));
    return script ? script(call) : isProbe(call.args) ? { out: '3.12.4\n' } : { code: 0 };
  });
  const logs = [];
  const python = createPythonSetup({
    root,
    getConfig: () => config,
    spawnImpl: spawn.impl,
    exists: (file) => present.has(file),
    platform: 'win32',
    env: {},
    home,
    execPath: join('D:', 'DSH', 'DeepSeek Harness.exe'),
    log: { info: (event) => logs.push(event), warn: (event) => logs.push(event) },
  });
  return { python, calls: spawn.calls, present, logs };
}

test('the environment goes to the data folder for market installs and to .venv for source installs', () => {
  assert.equal(venvDir({ root: packageRoot, env: {}, home }), join(home, '.dsh', 'data', 'dsh-discord-cyberfriend', 'venv'));
  assert.equal(venvDir({ root: sourceRoot, env: {}, home }), join(sourceRoot, '.venv'));
  assert.equal(venvPython('x', 'win32'), join('x', 'Scripts', 'python.exe'));
  assert.equal(venvPython('x', 'linux'), join('x', 'bin', 'python'));
});

test('DSH bundled Python is tried before whatever is on PATH; versions below 3.11 are refused', () => {
  const win = basePythonCandidates({ env: {}, home, platform: 'win32', execPath: join('D:', 'DSH', 'app.exe') });
  assert.equal(win[0].file, dshPython);
  assert.equal(win[0].source, 'dsh');
  assert.deepEqual(win.slice(-2).map((c) => [c.file, ...c.args]), [['py', '-3'], ['python']]);
  const linux = basePythonCandidates({ env: {}, home: '/home/a', platform: 'linux', execPath: '/opt/dsh/dsh' });
  assert.deepEqual(linux.slice(-2).map((c) => c.file), ['python3', 'python']);
  assert.ok(versionOk('3.11.0') && versionOk('3.12.14') && versionOk('4.0.0'));
  assert.ok(!versionOk('3.10.9') && !versionOk('2.7.18') && !versionOk('') && !versionOk('Python'));
});

test('one click: find Python, create the environment, install pinned packages from pypi.org only, then check', async () => {
  const f = setup();
  assert.equal(f.python.status().ready, false);
  const result = await f.python.install();
  assert.deepEqual(result, { ok: true, pythonVersion: '3.12.4', source: 'dsh' });
  const venv = join(home, '.dsh', 'data', 'dsh-discord-cyberfriend', 'venv');
  const py = join(venv, 'Scripts', 'python.exe');
  const [probe, create, tools, packages, check] = f.calls;
  assert.equal(probe.file, dshPython);
  assert.deepEqual([create.file, ...create.args], [dshPython, '-m', 'venv', venv]);
  assert.equal(tools.file, py);
  assert.ok(tools.args.includes('setuptools') && tools.args.includes('wheel'));
  assert.equal(packages.file, py);
  assert.equal(packages.args.at(-1), join(packageRoot, 'requirements.lock.txt'));
  for (const call of [tools, packages]) {
    assert.equal(call.args[call.args.indexOf('--index-url') + 1], 'https://pypi.org/simple');
    assert.ok(call.args.includes('--isolated'));
    assert.ok(!call.args.some((arg) => /trusted-host|no-verify|extra-index/.test(arg)), '不關閉憑證檢查、不加其他來源');
    assert.equal(call.env.PIP_NO_INPUT, '1');
  }
  assert.deepEqual([check.file, ...check.args], [py, join(packageRoot, 'scripts', 'check-runtime.py')]);
  assert.equal(f.calls.length, 5);
  const status = f.python.status();
  assert.deepEqual(
    { state: status.state, ready: status.ready, error: status.error, location: status.location },
    { state: 'done', ready: true, error: '', location: 'data' },
  );
  assert.deepEqual(f.logs, ['python.setup_start', 'python.setup_done']);
});

test('an existing environment is repaired in place, and two clicks share one run', async () => {
  const venv = join(sourceRoot, '.venv');
  const f = setup({ root: sourceRoot, files: [dshPython, join(venv, 'Scripts', 'python.exe')] });
  assert.equal(f.python.status().ready, true);
  const first = f.python.install();
  const second = f.python.install();
  assert.equal(first, second);
  assert.equal(f.python.status().state, 'running');
  await first;
  assert.ok(!f.calls.some((call) => isVenv(call.args)), '已經有環境就不重建');
  assert.equal(f.calls.filter((call) => isPip(call.args)).length, 2);
});

test('failures stop at the failing step with a readable reason and no private paths', async () => {
  const f = setup({
    script: ({ args }) =>
      isProbe(args)
        ? { out: '3.12.4\n' }
        : args.includes('-r')
          ? { code: 1, err: `ERROR: Could not find a version\n  File "${join(home, 'secret', 'x.py')}"` }
          : { code: 0 },
  });
  const result = await f.python.install();
  assert.equal(result.ok, false);
  assert.match(result.error, /^套件安裝失敗：/);
  assert.ok(!result.error.includes(home), '不帶出使用者資料夾');
  assert.match(result.error, /~/);
  const status = f.python.status();
  assert.deepEqual({ state: status.state, step: status.step }, { state: 'failed', step: 'packages' });
  assert.ok(!f.calls.some((call) => call.args.some((arg) => String(arg).endsWith('check-runtime.py'))), '失敗後不繼續下一步');
  assert.equal(tidyOutput('a'.repeat(2000)).length, 600);
});

test('no usable Python: says so, and never creates anything', async () => {
  const f = setup({ files: [], script: ({ args }) => (isProbe(args) ? { code: 1, err: 'not found' } : { code: 0 }) });
  const inspected = await f.python.inspect();
  assert.deepEqual(inspected.base, { found: false, version: '', source: '' });
  const result = await f.python.install();
  assert.equal(result.ok, false);
  assert.match(result.error, /找不到 Python 3\.11/);
  assert.ok(f.calls.every((call) => isProbe(call.args)));
  const old = setup({ script: ({ args }) => (isProbe(args) ? { out: '3.9.1\n' } : { code: 0 }) });
  assert.equal((await old.python.install()).ok, false, '版本太舊也不使用');
});

test('a Python path filled in by the user is respected: nothing is installed', async () => {
  const f = setup({ config: { userPythonExecutable: join('D:', 'py', 'python.exe') } });
  assert.deepEqual(
    { ready: f.python.status().ready, customPath: f.python.status().customPath },
    { ready: true, customPath: true },
  );
  const result = await f.python.install();
  assert.equal(result.ok, false);
  assert.match(result.error, /自己的 Python/);
  assert.equal(f.calls.length, 0);
});

test('unloading the plugin stops a running install', async () => {
  let started;
  const waiting = new Promise((resolve) => (started = resolve));
  const f = setup({
    script: ({ args }) => {
      if (isProbe(args)) return { out: '3.12.4\n' };
      if (isVenv(args)) return { code: 0 };
      started();
      return { hang: true };
    },
  });
  const run = f.python.install();
  await waiting;
  f.python.close();
  const result = await run;
  assert.deepEqual(result, { ok: false, error: '已取消' });
  assert.equal((await f.python.install()).ok, false, '關閉後不再開始');
});
