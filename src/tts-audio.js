import { spawn } from 'node:child_process';
import { FFMPEG } from './voice-audio.js';

function wav(pcm) {
  const header = Buffer.alloc(44);
  header.write('RIFF');
  header.writeUInt32LE(pcm.length + 36, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24000, 24);
  header.writeUInt32LE(48000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function decode(part, { signal, maxDurationMs = 180000 } = {}) {
  if (signal?.aborted) throw signal.reason || Error('TTS 已取消');
  return new Promise((resolve, reject) => {
    const rate = typeof part.rate === 'number' ? Math.min(2, Math.max(0.5, part.rate)) : 1;
    const volume = typeof part.volume === 'number' ? Math.min(1, Math.max(0, part.volume)) : 1;
    // atempo=1 still buffers and can shorten very short clips. Avoid running
    // identity filters when joining segments at their original speed/volume.
    const filters = [
      ...(rate === 1 ? [] : [`atempo=${rate}`]),
      ...(volume === 1 ? [] : [`volume=${volume}`]),
    ];
    const child = spawn(
      FFMPEG,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-protocol_whitelist',
        'file,pipe',
        '-i',
        'pipe:0',
        '-vn',
        '-t',
        String(maxDurationMs / 1000 + 0.1),
        ...(filters.length ? ['-af', filters.join(',')] : []),
        '-ar',
        '24000',
        '-ac',
        '1',
        '-f',
        's16le',
        'pipe:1',
      ],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const chunks = [];
    let size = 0,
      failure;
    const abort = () => {
      failure = signal?.reason || Error('TTS 已取消');
      child.kill();
    };
    const timer = setTimeout(() => {
      failure = Error('TTS 音訊轉換逾時');
      child.kill();
    }, 30000);
    const clean = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout.on('data', (b) => {
      size += b.length;
      if (size > 32 * 1024 * 1024) {
        failure = Error('TTS 音訊超過大小限制');
        child.kill();
      } else chunks.push(b);
    });
    child.stderr.resume();
    child.stdin.on('error', () => {});
    child.once('error', () => {
      clean();
      reject(Error('無法啟動 TTS 音訊轉換'));
    });
    child.once('close', (code) => {
      clean();
      if (failure) reject(failure);
      else if (code !== 0 || !size) reject(Error('TTS 沒有回傳可解碼的音訊'));
      else resolve(Buffer.concat(chunks));
    });
    child.stdin.end(part.data);
  });
}

export async function mergeTtsAudio(parts, options = {}) {
  const pcm = [];
  let bytes = 0;
  const maxDurationMs = options.maxDurationMs || 180000;
  for (const part of parts) {
    const chunk = await decode(part, { ...options, maxDurationMs });
    bytes += chunk.length;
    if (bytes / 48 > maxDurationMs) throw Error('TTS 語音超過本次時長上限');
    pcm.push(chunk);
  }
  return { data: wav(Buffer.concat(pcm)), contentType: 'audio/wav', format: 'wav', durationMs: bytes / 48 };
}
