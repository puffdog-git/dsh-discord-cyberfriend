// 使用者帳號需要的 Python 執行環境：由設定頁的按鈕一鍵安裝。
//
// 做的事和 scripts/setup.ps1 相同，但不需要使用者開終端機，也不限 Windows：
//   1. 找一個 Python 3.11 以上（優先用 DSH 自己內附的那一份）
//   2. 建立虛擬環境（市集安裝放在資料資料夾，更新插件時不會被清掉；來源安裝放在套件的 .venv）
//   3. 依 requirements.lock.txt 安裝固定版本的套件（只從 pypi.org）
//   4. 執行 scripts/check-runtime.py 做離線檢查（不登入、不連 Discord）
// 只由使用者在設定頁觸發；不是模型可以呼叫的工具。使用者自己填了 Python 路徑時不安裝。
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { externalDataDir, installedAsPackage } from './data-location.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIN_VERSION = [3, 11];
const STEP_LABEL = {
  python: '尋找 Python',
  venv: '建立執行環境',
  tools: '準備安裝工具',
  packages: '下載並安裝套件',
  check: '檢查執行環境',
};
const PIP_BASE = ['-m', 'pip', 'install', '--isolated', '--disable-pip-version-check', '--use-deprecated=legacy-certs'];
const PIP_INDEX = ['--index-url', 'https://pypi.org/simple'];

/** 虛擬環境的位置：和 pyself.js 尋找 Python 的規則一致。 */
export function venvDir({ root = ROOT, env = process.env, home = homedir() } = {}) {
  return installedAsPackage(root) ? join(externalDataDir({ env, home }), 'venv') : join(root, '.venv');
}

export function venvPython(dir, platform = process.platform) {
  return platform === 'win32' ? join(dir, 'Scripts', 'python.exe') : join(dir, 'bin', 'python');
}

/** 可能的 Python 來源，依優先順序。file 是完整路徑；command 交給系統從 PATH 找。 */
export function basePythonCandidates({
  env = process.env,
  home = homedir(),
  platform = process.platform,
  execPath = process.execPath,
} = {}) {
  const names = platform === 'win32' ? ['python.exe'] : [join('bin', 'python3'), 'python3', 'python'];
  const runtime = join('dependencies', 'python');
  const folders = [
    join(home, '.dsh', 'dsh-runtimes', 'dsh-primary-runtime', runtime),
    ...(env.DSH_HOME ? [join(env.DSH_HOME, 'dsh-runtimes', 'dsh-primary-runtime', runtime)] : []),
    join(dirname(execPath), 'resources', 'runtime', 'primary-runtime', runtime),
    ...(env.LOCALAPPDATA
      ? [join(env.LOCALAPPDATA, 'Programs', 'DeepSeek Harness', 'resources', 'runtime', 'primary-runtime', runtime)]
      : []),
  ];
  const files = folders.flatMap((folder) => names.map((name) => ({ file: join(folder, name), args: [], source: 'dsh' })));
  const commands =
    platform === 'win32'
      ? [
          { file: 'py', args: ['-3'], source: 'system' },
          { file: 'python', args: [], source: 'system' },
        ]
      : [
          { file: 'python3', args: [], source: 'system' },
          { file: 'python', args: [], source: 'system' },
        ];
  return [...files.filter((item, index, all) => all.findIndex((other) => other.file === item.file) === index), ...commands];
}

export function versionOk(text) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(String(text || '').trim());
  if (!match) return false;
  const [major, minor] = [Number(match[1]), Number(match[2])];
  return major > MIN_VERSION[0] || (major === MIN_VERSION[0] && minor >= MIN_VERSION[1]);
}

/** 把輸出裡的使用者資料夾換成 ~，並只留最後一段，避免把私人路徑帶進介面或記錄。 */
export function tidyOutput(text, home = homedir()) {
  let value = String(text || '');
  for (const variant of [home, home.split('\\').join('/'), home.split('\\').join('\\\\')])
    if (variant) value = value.split(variant).join('~');
  return value.trim().slice(-600);
}

export function createPythonSetup({
  root = ROOT,
  getConfig = () => ({}),
  log,
  spawnImpl = spawn,
  exists = existsSync,
  platform = process.platform,
  env = process.env,
  home = homedir(),
  execPath = process.execPath,
  now = Date.now,
} = {}) {
  const state = { state: 'idle', step: '', error: '', finishedAt: 0 };
  let running = null;
  let child = null;
  let closed = false;
  let base = null; // { found, version, source, checkedAt }

  function run(file, args, { timeoutMs }) {
    return new Promise((resolve) => {
      let output = '';
      let done = false;
      const finish = (result) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (child === proc) child = null;
        resolve({ ...result, output });
      };
      let proc;
      try {
        proc = spawnImpl(file, args, {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', PIP_NO_INPUT: '1', PIP_NO_COLOR: '1' },
        });
      } catch (error) {
        resolve({ ok: false, code: null, error: String(error?.message || error), output });
        return;
      }
      child = proc;
      const timer = setTimeout(() => {
        try {
          proc.kill();
        } catch {
          /* 已經結束 */
        }
        finish({ ok: false, code: null, error: '逾時' });
      }, timeoutMs);
      const collect = (chunk) => {
        output = (output + String(chunk)).slice(-6000);
      };
      proc.stdout?.on('data', collect);
      proc.stderr?.on('data', collect);
      proc.once('error', (error) => finish({ ok: false, code: null, error: String(error?.message || error) }));
      proc.once('exit', (code) => finish({ ok: code === 0, code }));
    });
  }

  async function findBase() {
    for (const candidate of basePythonCandidates({ env, home, platform, execPath })) {
      if (candidate.source === 'dsh' && !exists(candidate.file)) continue;
      const probe = await run(
        candidate.file,
        [...candidate.args, '-c', "import sys;print('%d.%d.%d'%sys.version_info[:3])"],
        { timeoutMs: 15000 },
      );
      const version = probe.output.trim().split(/\s+/).pop() || '';
      if (probe.ok && versionOk(version)) return { ...candidate, version };
    }
    return null;
  }

  function target() {
    const dir = venvDir({ root, env, home });
    return { dir, python: venvPython(dir, platform) };
  }

  function status() {
    const custom = Boolean(String(getConfig().userPythonExecutable || '').trim());
    return {
      supported: true,
      state: state.state,
      step: state.step,
      stepLabel: STEP_LABEL[state.step] || '',
      error: state.error,
      ready: custom || exists(target().python),
      customPath: custom,
      location: installedAsPackage(root) ? 'data' : 'package',
      base: base ? { found: base.found, version: base.version, source: base.source } : null,
    };
  }

  /** 狀態加上「有沒有可用的 Python」；偵測結果快取一分鐘，安裝中不重新偵測。 */
  async function inspect() {
    if (!running && (!base || now() - base.checkedAt > 60000)) {
      const found = await findBase();
      base = { found: Boolean(found), version: found?.version || '', source: found?.source || '', checkedAt: now() };
    }
    return status();
  }

  async function perform() {
    const fail = (message, output) => {
      const detail = tidyOutput(output, home);
      throw Error(detail ? message + '：' + detail : message);
    };
    state.step = 'python';
    const found = await findBase();
    base = { found: Boolean(found), version: found?.version || '', source: found?.source || '', checkedAt: now() };
    if (!found)
      throw Error(
        '找不到 Python 3.11 以上。DSH 內附的 Python 不在預期的位置，電腦上也沒有安裝；請先安裝 Python，或在下面的欄位填入 Python 的完整路徑',
      );
    const { dir, python } = target();
    state.step = 'venv';
    if (!exists(python)) {
      const made = await run(found.file, [...found.args, '-m', 'venv', dir], { timeoutMs: 5 * 60000 });
      if (!made.ok || !exists(python)) fail('建立執行環境失敗', made.output || made.error);
    }
    state.step = 'tools';
    const tools = await run(python, [...PIP_BASE, ...PIP_INDEX, 'setuptools', 'wheel'], { timeoutMs: 10 * 60000 });
    if (!tools.ok) fail('安裝工具下載失敗（請確認網路可以連到 pypi.org）', tools.output || tools.error);
    state.step = 'packages';
    const packages = await run(
      python,
      [...PIP_BASE, '--no-build-isolation', '--only-binary=Pillow', ...PIP_INDEX, '-r', join(root, 'requirements.lock.txt')],
      { timeoutMs: 20 * 60000 },
    );
    if (!packages.ok) fail('套件安裝失敗', packages.output || packages.error);
    state.step = 'check';
    const check = await run(python, [join(root, 'scripts', 'check-runtime.py')], { timeoutMs: 2 * 60000 });
    if (!check.ok) fail('裝好了但檢查沒有通過', check.output || check.error);
    return { ok: true, pythonVersion: found.version, source: found.source };
  }

  /** 開始安裝；已經在安裝時回傳同一個工作。完成後 state 會是 done 或 failed。 */
  function install() {
    if (running) return running;
    if (closed) return Promise.resolve({ ok: false, error: '插件正在關閉' });
    if (String(getConfig().userPythonExecutable || '').trim())
      return Promise.resolve({
        ok: false,
        error: '你已經在「Python 路徑」填了自己的 Python，所以不會自動安裝；想改用一鍵安裝，請先把那一欄清空並存檔',
      });
    state.state = 'running';
    state.step = 'python';
    state.error = '';
    log?.info?.('python.setup_start', '開始安裝使用者帳號需要的 Python 環境');
    running = perform()
      .then((result) => {
        state.state = 'done';
        state.step = '';
        state.finishedAt = now();
        log?.info?.('python.setup_done', 'Python 環境安裝完成', { pythonVersion: result.pythonVersion, source: result.source });
        return result;
      })
      .catch((error) => {
        const message = closed ? '已取消' : String(error?.message || error);
        state.state = 'failed';
        state.error = message;
        state.finishedAt = now();
        log?.warn?.('python.setup_failed', 'Python 環境安裝失敗', { step: state.step, error: message.slice(0, 300) });
        return { ok: false, error: message };
      })
      .finally(() => {
        running = null;
      });
    return running;
  }

  function close() {
    closed = true;
    try {
      child?.kill();
    } catch {
      /* 已經結束 */
    }
  }

  return { status, inspect, install, close };
}
