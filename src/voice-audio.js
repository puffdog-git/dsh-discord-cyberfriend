import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import ffmpeg from 'ffmpeg-static';

export const FFMPEG = ffmpeg;
export const DIRECT_AUDIO_PROCESSING = Object.freeze({
  source: 'direct-audio',
  krisp: false,
  noiseSuppression: false,
  echoCancellation: false,
  automaticGainControl: false,
  codec: 'Opus',
  note: '兩種帳號直接傳送音訊，不經桌面麥克風或Krisp；仍有Opus有損壓縮、設定音量及可選的說話時音樂降音量。',
});
export async function audioFile(bytes) {
  if (!bytes?.length || bytes.length > 64 * 1024 * 1024) throw Error('音訊為空或超過 64 MB');
  const dir = await mkdtemp(join(tmpdir(), 'dsh-discord-voice-'));
  try {
    const path = join(dir, 'source.audio');
    await writeFile(path, bytes);
    return { path, remove: () => rm(dir, { recursive: true, force: true }) };
  } catch (e) {
    await rm(dir, { recursive: true, force: true });
    throw e;
  }
}
export async function prepareVoiceAudio(path, { signal, seconds = 60, volume = 0.65, offset = 0 } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-discord-opus-')),
    output = join(dir, 'voice.ogg');
  try {
    await stat(ffmpeg);
    let progress = '';
    await new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(Error('音訊已取消'));
      const args = [
        '-nostdin',
        '-hide_banner',
        '-loglevel',
        'error',
        '-protocol_whitelist',
        'file,pipe',
        '-ss',
        String(Math.max(0, offset)),
        '-i',
        path,
        '-vn',
        '-t',
        String(seconds),
        '-af',
        `volume=${Math.min(1, Math.max(0, volume))}`,
        '-ar',
        '48000',
        '-ac',
        '2',
        '-c:a',
        'libopus',
        '-application',
        'audio',
        '-b:a',
        '96k',
        '-progress',
        'pipe:2',
        '-f',
        'ogg',
        'pipe:1',
      ];
      const p = spawn(ffmpeg, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      const abort = () => p.kill(),
        timer = setTimeout(abort, 120000);
      timer.unref?.();
      signal?.addEventListener('abort', abort, { once: true });
      p.stderr.on('data', (b) => {
        progress = (progress + b.toString()).slice(-12000);
      });
      let bytes = 0;
      const written = pipeline(
        p.stdout,
        new Transform({
          transform(chunk, _, cb) {
            bytes += chunk.length;
            cb(bytes > 96 * 1024 * 1024 ? Error('音訊超過大小限制') : null, chunk);
          },
        }),
        createWriteStream(output),
      );
      written.catch(() => p.kill());
      const clean = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      };
      p.once('error', () => {
        clean();
        reject(Error('無法啟動 FFmpeg'));
      });
      p.once('exit', (code) => {
        clean();
        written.then(
          () =>
            code === 0 && !signal?.aborted
              ? resolve()
              : reject(Error(signal?.aborted ? '音訊已取消' : '音訊解碼失敗或逾時')),
          () => reject(Error('音訊檔案寫入失敗')),
        );
      });
    });
    const durationMs = Math.ceil(
      Number([...progress.matchAll(/out_time_us=(\d+)/g)].at(-1)?.[1] || 0) / 1000,
    );
    if (!durationMs || (await stat(output)).size < 64) throw Error('沒有可播放的音訊');
    return { path: output, durationMs, remove: () => rm(dir, { recursive: true, force: true }) };
  } catch (e) {
    await rm(dir, { recursive: true, force: true });
    throw e;
  }
}

// Only the installed music plugin's routes on this exact local listener are reachable.
export async function musicRequest(req, path, { signal, binary = false } = {}) {
  if (!/^\/music\/(?:library|stream|online\/(?:search|stream))(?:\?|$)/.test(path))
    throw Error('不支援的音樂接口');
  const port = req?.socket?.localPort;
  if (!Number.isInteger(port)) throw Error('無法取得本機音樂服務');
  const headers = {};
  for (const k of ['cookie', 'authorization']) if (req.headers?.[k]) headers[k] = req.headers[k];
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    headers,
    redirect: 'error',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(90000)]) : AbortSignal.timeout(90000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw Error(`音樂插件回應 ${response.status}，請確認音樂庫／供應商設定`);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > (binary ? 64 * 1024 * 1024 : 4 * 1024 * 1024)) throw Error('音樂資料超過大小限制');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  return binary ? bytes : JSON.parse(bytes.toString('utf8'));
}
