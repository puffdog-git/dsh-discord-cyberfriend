import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FFMPEG } from './voice-audio.js';
export const isVideo = (bytes) =>
  bytes?.length >= 12 && (bytes.toString('ascii', 4, 8) === 'ftyp' || bytes.readUInt32BE(0) === 0x1a45dfa3);
function command(args, signal, allowProbe = false) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const child = spawn(FFMPEG, ['-nostdin', '-hide_banner', '-protocol_whitelist', 'file,pipe', ...args], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let size = 0,
      stderr = '',
      settled = false;
    const chunks = [];
    const finish = (e, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        if (e) {
          child.kill();
          reject(e);
        } else resolve(value);
      },
      abort = () => finish(Error('VIDEO_CANCELLED')),
      timer = setTimeout(() => finish(Error('VIDEO_TIMEOUT')), 6000);
    signal.addEventListener('abort', abort, { once: true });
    child.on('error', () => finish(Error('VIDEO_DECODER_UNAVAILABLE')));
    child.stdout.on('data', (b) => {
      size += b.length;
      if (size > 1024 * 1024) finish(Error('VIDEO_FRAME_TOO_LARGE'));
      else chunks.push(b);
    });
    child.stderr.on('data', (b) => (stderr = (stderr + b).slice(-16000)));
    child.on('close', (code) =>
      finish(code === 0 || allowProbe ? null : Error('VIDEO_DECODE_FAILED'), {
        bytes: Buffer.concat(chunks),
        stderr,
      }),
    );
    if (signal.aborted) abort();
  });
}
export async function extractVideoFrames(bytes, config = {}, signal) {
  if (!isVideo(bytes) || bytes.length > 12 * 1024 * 1024) throw Error('VIDEO_INVALID_INPUT');
  const deadline = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(12000)]),
    dir = await mkdtemp(join(tmpdir(), 'dsh-video-')),
    file = join(dir, 'video.input');
  try {
    await writeFile(file, bytes);
    const probe = await command(['-i', file], deadline, true),
      duration = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(probe.stderr),
      video = probe.stderr.split('\n').find((s) => /Stream.*Video:/.test(s)),
      dimensions = video && /\b(\d{2,5})x(\d{2,5})\b/.exec(video);
    if (!duration || !dimensions) throw Error('VIDEO_METADATA_INVALID');
    const seconds = Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]);
    if (!seconds || seconds > 120 || Number(dimensions[1]) * Number(dimensions[2]) > 16000000)
      throw Error('VIDEO_RESOURCE_LIMIT');
    const count = Math.min(6, Math.max(2, Number(config.gifFrameCount) || 4)),
      frames = [];
    for (let i = 0; i < count; i++) {
      const at = Math.max(0, ((seconds - 0.05) * i) / (count - 1)),
        out = await command(
          [
            '-ss',
            String(at),
            '-i',
            file,
            '-an',
            '-frames:v',
            '1',
            '-vf',
            "scale=w='min(512,iw)':h='min(512,ih)':force_original_aspect_ratio=decrease",
            '-c:v',
            'mjpeg',
            '-q:v',
            '4',
            '-f',
            'image2pipe',
            'pipe:1',
          ],
          deadline,
        );
      if (!out.bytes.length) throw Error('VIDEO_EMPTY_FRAME');
      frames.push({
        data: out.bytes.toString('base64'),
        mediaType: 'image/jpeg',
        timeMs: Math.round(at * 1000),
        index: i,
      });
    }
    return {
      ok: true,
      frames,
      totalFrames: frames.length,
      durationMs: Math.round(seconds * 1000),
      sampled: true,
      format: bytes.toString('ascii', 4, 8) === 'ftyp' ? 'MP4' : 'WebM',
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
