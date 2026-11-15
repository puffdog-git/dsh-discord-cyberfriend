// 內建的 video_info／video_download：查詢影片資訊、下載並轉出音訊。
//
// 改寫自 dsh-ytdlp 的同名工具（作者 tkwkeven，https://github.com/tkwkeven/dsh-ytdlp，MIT 授權；
// 授權全文見 docs/licenses/dsh-ytdlp-MIT.txt）。
//
// 這兩個定義只給本插件的翻唱流程在內部使用，**沒有**註冊成模型可以直接呼叫的工具：
// 模型只能透過翻唱工具間接用到它們，參數由翻唱流程決定。差異：
//   - 一律走「只允許公開網路」的代理，沒有其他網路模式。
//   - 下載目錄必須由呼叫端給絕對路徑，沒有預設的下載資料夾。
//   - 轉檔使用插件自己的 FFmpeg，不依賴系統有沒有安裝。
import { existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join } from 'node:path';

const POLICY = { type: 'string', enum: ['public-only'] };

function duration(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

export function createVideoTools({ runYt, ffmpegPath = '', downloadTimeoutMs = 30 * 60_000 } = {}) {
  const policy = (args) => {
    if (args.networkPolicy !== undefined && args.networkPolicy !== 'public-only') throw Error('不支援的網路模式');
  };
  // yt-dlp 的 --ffmpeg-location 接受資料夾；ffmpeg-static 只有 ffmpeg，沒有 ffprobe，轉出音訊夠用。
  const ffmpeg = () => (ffmpegPath && existsSync(ffmpegPath) ? ['--ffmpeg-location', dirname(ffmpegPath)] : []);
  return {
    video_info: {
      name: 'video_info',
      builtin: true,
      parameters: { type: 'object', properties: { url: { type: 'string' }, networkPolicy: POLICY }, required: ['url'] },
      async execute(args, exec = {}) {
        policy(args);
        const url = String(args.url || '').trim();
        if (!url) return { ok: false, error: '缺少 url 參數' };
        const res = await runYt(['-J', '--no-playlist', '--no-warnings', url], {
          timeoutMs: 60000,
          networkPolicy: 'public-only',
          signal: exec.signal,
        });
        if (!res.ok) return { ok: false, error: res.error };
        let info;
        try {
          info = JSON.parse(res.stdout);
        } catch {
          return { ok: false, error: '影片資訊格式不正確' };
        }
        return {
          ok: true,
          networkPolicy: res.networkPolicy,
          title: info.title || info.id || '',
          id: info.id,
          uploader: info.uploader || info.uploader_id || info.channel || '',
          duration: info.duration ? duration(info.duration) : '',
          webpageUrl: info.webpage_url || url,
        };
      },
    },
    video_download: {
      name: 'video_download',
      builtin: true,
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          networkPolicy: POLICY,
          audioOnly: { type: 'boolean' },
          audioFormat: { type: 'string' },
          outdir: { type: 'string' },
          playList: { type: 'boolean' },
        },
        required: ['url', 'outdir'],
      },
      async execute(args, exec = {}) {
        policy(args);
        const url = String(args.url || '').trim(),
          outdir = String(args.outdir || '').trim();
        if (!url) return { ok: false, error: '缺少 url 參數' };
        if (!outdir || !isAbsolute(outdir)) return { ok: false, error: '需要絕對路徑的下載目錄' };
        const audioFormat = String(args.audioFormat || 'wav').toLowerCase();
        if (args.audioOnly !== true) return { ok: false, error: '內建下載只提供音訊' };
        if (!['wav', 'mp3', 'm4a', 'flac', 'opus'].includes(audioFormat)) return { ok: false, error: '不支援的音訊格式' };
        if (args.playList) return { ok: false, error: '內建下載不支援播放清單' };
        await mkdir(outdir, { recursive: true });
        const res = await runYt(
          [
            '-f',
            'bestaudio/best',
            '-o',
            // 檔名只用影片 ID，不讓網站上的標題決定檔名。
            join(outdir, '%(id)s.%(ext)s'),
            '--print',
            'after_move:filepath',
            '--no-warnings',
            '--no-progress',
            '--newline',
            '--no-playlist',
            ...ffmpeg(),
            '-x',
            '--audio-format',
            audioFormat,
            url,
          ],
          { timeoutMs: downloadTimeoutMs, networkPolicy: 'public-only', signal: exec.signal },
        );
        if (!res.ok) return { ok: false, error: res.error };
        const files = [];
        for (const line of res.stdout.split('\n')) {
          const file = line.trim();
          if (file && existsSync(file) && statSync(file).isFile())
            files.push({ path: file, name: basename(file), sizeBytes: statSync(file).size });
        }
        if (!files.length) return { ok: false, error: '下載已執行但找不到輸出檔案' };
        return { ok: true, networkPolicy: res.networkPolicy, files, dir: outdir, audioOnly: true };
      },
    },
  };
}
