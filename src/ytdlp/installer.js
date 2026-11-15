// 下載 yt-dlp 官方發行的單檔執行檔，放到 <DSH_HOME 或 ~/.dsh>/bin/。
//
// yt-dlp 不放進插件套件：執行檔每個平台一份、各十幾 MB，而且 YouTube 一改版就得更新，
// 放在套件裡很快就會過期；發行版執行檔的授權（GPLv3+）也和本插件（MIT）不同。
// 所以改成需要時從 yt-dlp 的 GitHub 發行頁下載最新版，使用者不必自己動手。
//
// - 只從 github.com/yt-dlp/yt-dlp 的 releases/latest 下載。
// - 用同一個發行版公布的 SHA2-256SUMS 核對檔案；這能擋下載損毀或被中途竄改，
//   但不能防 yt-dlp 的發行頁本身被入侵。
// - 先寫到暫存檔、核對通過才改名成正式檔名；失敗不留下半個檔案。
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { chmod, mkdir, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const BASE = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/';
const MAX_BYTES = 200 * 1024 * 1024;

/** 這個平台對應的發行檔名；不支援的平台回傳 ''。 */
export function ytdlpAsset({ platform = process.platform, arch = process.arch } = {}) {
  if (platform === 'win32') return arch === 'x64' ? 'yt-dlp.exe' : arch === 'arm64' ? 'yt-dlp_arm64.exe' : '';
  if (platform === 'darwin') return 'yt-dlp_macos';
  if (platform === 'linux') return arch === 'x64' ? 'yt-dlp_linux' : arch === 'arm64' ? 'yt-dlp_linux_aarch64' : '';
  return '';
}

export function ytdlpInstallPath({ env = process.env, home = homedir(), platform = process.platform } = {}) {
  return join(env.DSH_HOME || join(home, '.dsh'), 'bin', platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
}

/** 從 SHA2-256SUMS 的內容找出指定檔名的雜湊。 */
export function checksumFor(sums, asset) {
  for (const line of String(sums).split(/\r?\n/)) {
    const match = /^([0-9a-f]{64})\s+\*?(.+)$/i.exec(line.trim());
    if (match && match[2] === asset) return match[1].toLowerCase();
  }
  return '';
}

export function createYtdlpInstaller({
  env = process.env,
  home = homedir(),
  platform = process.platform,
  arch = process.arch,
  fetchImpl = fetch,
  log,
} = {}) {
  let pending;
  let last = { state: 'idle', error: '' };

  async function download(signal) {
    const asset = ytdlpAsset({ platform, arch });
    if (!asset) throw Error('這個系統沒有可自動下載的 yt-dlp，請自行安裝後在設定填入路徑');
    const target = ytdlpInstallPath({ env, home, platform });
    const sumsResponse = await fetchImpl(BASE + 'SHA2-256SUMS', { signal, redirect: 'follow' });
    if (!sumsResponse.ok) throw Error('無法取得 yt-dlp 的校驗清單（HTTP ' + sumsResponse.status + '）');
    const expected = checksumFor(await sumsResponse.text(), asset);
    if (!expected) throw Error('yt-dlp 的校驗清單裡找不到 ' + asset);
    const response = await fetchImpl(BASE + asset, { signal, redirect: 'follow' });
    if (!response.ok || !response.body) throw Error('無法下載 yt-dlp（HTTP ' + response.status + '）');
    await mkdir(join(target, '..'), { recursive: true });
    const temporary = target + '.download-' + process.pid + '-' + Date.now();
    const hash = createHash('sha256');
    let size = 0;
    try {
      const file = createWriteStream(temporary, { flags: 'wx' });
      try {
        for await (const chunk of response.body) {
          size += chunk.length;
          if (size > MAX_BYTES) throw Error('yt-dlp 下載內容超過大小上限');
          hash.update(chunk);
          if (!file.write(chunk)) await new Promise((resolve) => file.once('drain', resolve));
        }
      } finally {
        await new Promise((resolve) => file.end(resolve));
      }
      if (hash.digest('hex') !== expected) throw Error('yt-dlp 下載內容與官方校驗值不符，已捨棄');
      if (platform !== 'win32') await chmod(temporary, 0o755);
      await rename(temporary, target);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => {});
      throw error;
    }
    return { path: target, bytes: size };
  }

  return {
    /** 下載並安裝；同時多次呼叫共用同一次下載。回傳 { ok, path?, error? }，不拋出。 */
    install({ signal = AbortSignal.timeout(5 * 60_000) } = {}) {
      pending ||= (async () => {
        last = { state: 'downloading', error: '' };
        try {
          const done = await download(signal);
          last = { state: 'installed', error: '' };
          log?.info?.('ytdlp.installed', '已下載 yt-dlp', { bytes: done.bytes });
          return { ok: true, path: done.path };
        } catch (error) {
          const message = String(error?.message || error);
          last = { state: 'failed', error: message };
          log?.warn?.('ytdlp.install_failed', 'yt-dlp 下載失敗', { error: message });
          return { ok: false, error: message };
        } finally {
          pending = undefined;
        }
      })();
      return pending;
    },
    status: () => ({ ...last, supported: !!ytdlpAsset({ platform, arch }) }),
  };
}
