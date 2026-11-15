// Part of the YouTube music source bundled from a locally modified dsh-ytdlp.
// dsh-ytdlp is by tkwkeven (https://github.com/tkwkeven/dsh-ytdlp), MIT License;
// see docs/licenses/dsh-ytdlp-MIT.txt. This file was added in the local modification.
import { mkdtemp, readdir, readFile, realpath, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const MAX_BYTES = 64 * 1024 * 1024;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

// Keep the downloader behind runYt's public-only, DNS-pinned proxy.
// No browser playback, cookies, user-provided paths or arbitrary URLs.
export function createYoutubeMusic(runYt) {
  async function run(args, signal, timeoutMs) {
    signal.throwIfAborted();
    const result = await runYt(args, { signal, timeoutMs, networkPolicy: 'public-only' });
    signal.throwIfAborted();
    if (!result.ok) throw Error(result.error || 'YouTube 音樂載入失敗');
    return result.stdout;
  }
  return {
    async search(query, { signal = AbortSignal.timeout(30000) } = {}) {
      const q = String(query || '').trim();
      if (!q || q.length > 200) throw Error('請提供 1～200 字的歌名或歌手');
      const url = 'https://www.youtube.com/results?' + new URLSearchParams({ search_query: q });
      const output = await run([
        '--flat-playlist', '--playlist-end', '5', '--dump-single-json',
        '--skip-download', '--no-warnings', url,
      ], signal, 30000);
      let data;
      try { data = JSON.parse(output); } catch { throw Error('YouTube 搜尋結果格式不正確'); }
      if (!Array.isArray(data.entries)) throw Error('YouTube 搜尋結果缺少曲目清單');
      return data.entries.filter(row => row && VIDEO_ID.test(row.id || '') &&
        row.ie_key !== 'YoutubeTab' && row.live_status !== 'is_live' && !row.is_live &&
        (!Number.isFinite(row.duration) || row.duration <= 1800))
        .slice(0, 5).map(row => ({ id: row.id, title: String(row.title || row.id).slice(0, 200),
          artist: String(row.uploader || row.channel || '').slice(0, 100) }));
    },
    async load(id, { signal = AbortSignal.timeout(120000) } = {}) {
      if (!VIDEO_ID.test(id || '')) throw Error('需要有效的 YouTube 影片 ID');
      signal.throwIfAborted();
      const dir = await mkdtemp(path.join(tmpdir(), 'dsh-youtube-music-'));
      try {
        await run([
          '--no-playlist', '--no-warnings', '--no-progress',
          '--max-filesize', '64M', '--match-filter', '!is_live & duration <= 1800',
          '-f', 'bestaudio', '-o', path.join(dir, 'audio.%(ext)s'),
          'https://www.youtube.com/watch?v=' + id,
        ], signal, 120000);
        const files = (await readdir(dir)).filter(name => /^audio\.[a-z0-9]+$/i.test(name) &&
          !/\.(part|ytdl|json)$/i.test(name));
        if (files.length !== 1) throw Error('YouTube 未產生可播放音訊（可能是直播、超長曲目或無可用格式）');
        const file = await realpath(path.join(dir, files[0]));
        if (path.dirname(file) !== await realpath(dir)) throw Error('YouTube 音訊超出暫存範圍');
        const info = await stat(file);
        if (!info.isFile() || !info.size || info.size > MAX_BYTES) throw Error('YouTube 音訊為空或超過 64 MiB');
        signal.throwIfAborted();
        const audio = await readFile(file);
        signal.throwIfAborted();
        return audio;
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
}
