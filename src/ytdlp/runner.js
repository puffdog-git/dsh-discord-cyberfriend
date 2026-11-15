// 內建的 yt-dlp 執行器：找到 yt-dlp 執行檔，並一律經由「只允許公開網路」的本機代理執行。
//
// 尋找執行檔與執行的做法改寫自 dsh-ytdlp（作者 tkwkeven，https://github.com/tkwkeven/dsh-ytdlp，MIT 授權；
// 授權全文見 docs/licenses/dsh-ytdlp-MIT.txt）。這裡只保留 YouTube 點歌需要的部分：
// 不註冊 video_info／video_download 工具，不經過 shell，也不提供未受保護的網路模式。
//
// yt-dlp 執行檔本身不隨插件附送；找不到時由 installer.js 從官方發行頁下載。尋找順序：
//   1. 設定 musicYtdlpPath
//   2. <DSH_HOME 或 ~/.dsh>/bin/yt-dlp
//   3. 常見的系統安裝位置（非 Windows）
//   4. PATH 上的 yt-dlp
import { execFile } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { PUBLIC_YTDLP_ARGS, startPublicProxy } from './public-proxy.js';
import { sourceUrl } from './source-url.js';

const execFileAsync = promisify(execFile);
const PROXY_ENV = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy'];

export function ytdlpCandidates({ configured = '', env = process.env, home = homedir(), platform = process.platform } = {}) {
  const list = [];
  if (configured) list.push(configured);
  list.push(join(env.DSH_HOME || join(home, '.dsh'), 'bin', 'yt-dlp'));
  if (platform !== 'win32')
    list.push(join(home, '.local/bin/yt-dlp'), '/usr/local/bin/yt-dlp', '/opt/homebrew/bin/yt-dlp', '/usr/bin/yt-dlp');
  list.push('yt-dlp');
  // Windows 的 CreateProcess 不會自動補 .exe。
  return platform === 'win32'
    ? list.flatMap((c) => (/\.(exe|cmd|bat|com)$/i.test(c) ? [c] : [c + '.exe', c]))
    : list;
}

export function createYtdlpRunner({
  getConfig = () => ({}),
  env = process.env,
  home = homedir(),
  platform = process.platform,
  run = execFileAsync,
  startProxy = startPublicProxy,
  install,
} = {}) {
  let state = { key: undefined, bin: '', version: '' };
  let probing;

  const configured = () => String(getConfig()?.musicYtdlpPath || '').trim();

  async function probe(force = false) {
    const key = configured();
    if (!force && state.key === key && state.bin) return state;
    if (probing?.key === key) return probing.promise;
    const promise = (async () => {
      for (const candidate of ytdlpCandidates({ configured: key, env, home, platform })) {
        try {
          const { stdout } = await run(candidate, ['--version'], {
            timeout: 15000,
            windowsHide: true,
            encoding: 'utf8',
          });
          const version = String(stdout || '').trim().split('\n')[0];
          if (version) return (state = { key, bin: candidate, version });
        } catch {
          // 換下一個候選位置。
        }
      }
      return (state = { key, bin: '', version: '' });
    })().finally(() => {
      if (probing?.promise === promise) probing = undefined;
    });
    probing = { key, promise };
    return promise;
  }

  /** 執行 yt-dlp；失敗不拋出，錯誤放在回傳值。網址（最後一個參數）必須是公開的 HTTP(S) 網址。 */
  async function runYt(args, { timeoutMs = 60000, signal, networkPolicy = 'public-only' } = {}) {
    if (networkPolicy !== 'public-only') return { ok: false, error: '不支援的網路模式' };
    let found = await probe();
    // 第一次使用時還沒有 yt-dlp：自動下載一次。使用者自己填了路徑就不代為下載。
    if (!found.bin && install && !configured()) {
      // 不帶呼叫者的取消訊號：這次搜尋逾時了，下載仍繼續，下一次點歌就能用。
      const installed = await install();
      if (installed.ok) found = await probe(true);
      else return { ok: false, error: 'yt-dlp 自動下載失敗：' + installed.error };
    }
    if (!found.bin)
      return {
        ok: false,
        error:
          '找不到 yt-dlp 執行檔。請到語音頁按「下載 yt-dlp」，或自行安裝後在語音設定的「yt-dlp 執行檔路徑」填入完整路徑。',
      };
    let proxy;
    try {
      sourceUrl(args.at(-1));
      proxy = await startProxy({ signal });
    } catch {
      return { ok: false, error: '公開網路限制設定失敗' };
    }
    try {
      const { stdout, stderr } = await run(
        found.bin,
        [...PUBLIC_YTDLP_ARGS, '--proxy', proxy.url, ...args].map(String),
        {
          timeout: timeoutMs,
          cwd: tmpdir(),
          maxBuffer: 64 * 1024 * 1024,
          windowsHide: true,
          encoding: 'utf8',
          signal,
          env: {
            ...env,
            ...Object.fromEntries(PROXY_ENV.map((k) => [k, proxy.url])),
            NO_PROXY: '',
            no_proxy: '',
          },
        },
      );
      return { ok: true, stdout: String(stdout || ''), stderr: String(stderr || ''), networkPolicy };
    } catch {
      // 不回傳 yt-dlp 的原始錯誤（可能含網址與代理資訊），也不退回未受保護的下載。
      return { ok: false, error: '公開網路限制下下載失敗、取消或逾時；不會改用無保護下載' };
    } finally {
      await proxy.close();
    }
  }

  return {
    runYt,
    probe,
    /** 同步查詢上次偵測結果；設定的路徑變了就在背景重新偵測。 */
    ready() {
      if (state.key !== configured() && !probing) void probe().catch(() => {});
      return state.key === configured() && !!state.bin;
    },
    status: () => ({ found: !!state.bin, version: state.version }),
  };
}
