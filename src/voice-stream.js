import { spawn } from 'node:child_process';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { FFMPEG } from './voice-audio.js';
// Normalized TTS input is PCM16LE/24k/mono. Discord's Raw is 48k/stereo.
export function prepareVoiceStream(source, { signal, volume = 0.65 } = {}) {
  signal?.throwIfAborted();
  const controller = new AbortController(),
    combined = AbortSignal.any([controller.signal, ...(signal ? [signal] : [])]);
  const child = spawn(
    FFMPEG,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-probesize',
      '32',
      '-analyzeduration',
      '0',
      '-f',
      's16le',
      '-ar',
      '24000',
      '-ac',
      '1',
      '-i',
      'pipe:0',
      '-vn',
      ...(volume === 1 ? [] : ['-af', 'volume=' + Math.min(1, Math.max(0, volume))]),
      '-ar',
      '48000',
      '-ac',
      '2',
      '-f',
      's16le',
      'pipe:1',
    ],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  let error;
  const abort = () => {
    child.kill();
    child.stdout.destroy(Error('音訊串流已取消'));
  };
  combined.addEventListener('abort', abort, { once: true });
  child.stderr.resume();
  child.stdout.on('error', () => {});
  child.stdin.on('error', () => {});
  const closed = new Promise((resolve, reject) => {
    child.once('error', () => reject(Error('串流轉換器無法啟動')));
    child.once('close', (code) =>
      code === 0 && !combined.aborted ? resolve() : reject(error || Error('串流轉換未完成')),
    );
  });
  const input = pipeline(Readable.from(source), child.stdin, { signal: combined }).catch((e) => {
    error = e;
    child.kill();
    child.stdout.destroy(e);
    throw e;
  });
  const done = Promise.all([closed, input])
    .then(() => undefined)
    .finally(() => combined.removeEventListener('abort', abort));
  done.catch(() => {});
  if (combined.aborted) abort();
  return {
    stream: child.stdout,
    done,
    async remove() {
      controller.abort();
      child.stdout.destroy();
      await done.catch(() => {});
    },
  };
}
// 即時音樂來源：對方已經給 48000 Hz／雙聲道／16 位元的 PCM。這裡只做三件事：
// 套用音量、保證每一塊都是完整的取樣框（4 的倍數）、超過時間上限就正常收尾。
export function livePcm(source, { volume = 0.65, maxBytes = Infinity } = {}) {
  const gain = Math.min(1, Math.max(0, volume));
  let rest = Buffer.alloc(0),
    total = 0;
  const out = new Transform({
    transform(chunk, _encoding, done) {
      let data = rest.length ? Buffer.concat([rest, chunk]) : Buffer.from(chunk);
      const usable = data.length - (data.length % 4);
      rest = data.subarray(usable);
      data = data.subarray(0, Math.max(0, Math.min(usable, maxBytes - total)));
      if (data.length) {
        if (gain !== 1)
          for (let i = 0; i < data.length; i += 2) data.writeInt16LE(Math.round(data.readInt16LE(i) * gain), i);
        total += data.length;
        this.push(data);
      }
      if (total >= maxBytes) {
        this.push(null);
        source.destroy?.();
      }
      done();
    },
  });
  source.on('error', (e) => out.destroy(e));
  source.pipe(out);
  return out;
}
// Music has already been normalized to a plugin-owned Ogg Opus file.
export function musicPcm(path, signal) {
  const controller = new AbortController(),
    combined = AbortSignal.any([controller.signal, ...(signal ? [signal] : [])]),
    child = spawn(
      FFMPEG,
      [
        '-nostdin',
        '-hide_banner',
        '-loglevel',
        'error',
        '-protocol_whitelist',
        'file,pipe',
        '-i',
        path,
        '-vn',
        '-ar',
        '48000',
        '-ac',
        '2',
        '-f',
        's16le',
        'pipe:1',
      ],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] },
    );
  const abort = () => {
    child.kill();
    child.stdout.destroy(Error('音樂串流已停止'));
  };
  combined.addEventListener('abort', abort, { once: true });
  child.stdout.on('error', () => {});
  const done = new Promise((resolve, reject) => {
    child.once('error', () => reject(Error('音樂串流轉換器無法啟動')));
    child.once('close', (code) =>
      code === 0 && !combined.aborted ? resolve() : reject(Error('音樂串流未完成')),
    );
  }).finally(() => combined.removeEventListener('abort', abort));
  done.catch(() => {});
  if (combined.aborted) abort();
  return {
    stream: child.stdout,
    done,
    async remove() {
      controller.abort();
      child.stdout.destroy();
      await done.catch(() => {});
    },
  };
}
