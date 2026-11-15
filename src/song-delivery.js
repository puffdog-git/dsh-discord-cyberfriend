import { open, realpath, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { FFMPEG } from './voice-audio.js';
export async function songWavInfo(file) {
  const handle = await open(file, 'r');
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size < 44 || info.size > 256 * 1024 * 1024)
      throw Error('歌曲 WAV 上限 256 MiB');
    const head = Buffer.alloc(12);
    await handle.read(head, 0, 12, 0);
    if (head.toString('ascii', 0, 4) !== 'RIFF' || head.toString('ascii', 8, 12) !== 'WAVE')
      throw Error('歌曲成品必須是 WAV');
    let at = 12,
      rate = 0,
      size = 0;
    while (at + 8 <= info.size) {
      const c = Buffer.alloc(8);
      await handle.read(c, 0, 8, at);
      const n = c.readUInt32LE(4),
        tag = c.toString('ascii', 0, 4);
      if (n > info.size - at - 8) throw Error('歌曲 WAV 不完整');
      if (tag === 'fmt ') {
        if (n < 16) throw Error('歌曲 WAV 格式不完整');
        const f = Buffer.alloc(16);
        await handle.read(f, 0, 16, at + 8);
        if (![1, 3, 0xfffe].includes(f.readUInt16LE(0))) throw Error('歌曲 WAV 必須是 PCM 或浮點音訊');
        rate = f.readUInt32LE(8);
      }
      if (tag === 'data') size += n;
      at += 8 + n + (n % 2);
    }
    const seconds = size / rate;
    if (!Number.isFinite(seconds) || seconds <= 0) throw Error('歌曲 WAV 沒有有效音軌');
    return { size: info.size, seconds };
  } finally {
    await handle.close();
  }
}
async function attachmentMp3(source, target, signal) {
  signal?.throwIfAborted();
  await new Promise((resolve, reject) => {
    const p = spawn(
        FFMPEG,
        [
          '-nostdin',
          '-hide_banner',
          '-loglevel',
          'error',
          '-protocol_whitelist',
          'file,pipe',
          '-i',
          source,
          '-vn',
          '-c:a',
          'libmp3lame',
          '-b:a',
          '192k',
          '-y',
          target,
        ],
        { windowsHide: true, stdio: 'ignore' },
      ),
      abort = () => p.kill(),
      timer = setTimeout(abort, 120000);
    signal?.addEventListener('abort', abort, { once: true });
    const clean = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    };
    p.on('error', (e) => {
      clean();
      reject(e);
    });
    p.on('close', (code) => {
      clean();
      if (signal?.aborted) return reject(signal.reason);
      code ? reject(Error('歌曲附件轉碼失敗')) : resolve();
    });
    if (signal?.aborted) abort();
  });
}
export function createSongDelivery({ getConfig, getManager, sessionBridge, voice, encode = attachmentMp3 }) {
  const captures = new WeakMap();
  function check(cap) {
    const saved = captures.get(cap);
    if (!saved) throw Error('歌曲交付範圍無效');
    const c = getConfig(),
      b = Object.values(sessionBridge.bindings).find((x) => x.sessionId === saved.sessionId),
      t = getManager().byKind[saved.kind];
    if (
      !c.enabled ||
      c[saved.kind + 'Enabled'] === false ||
      c.dryRun ||
      !b ||
      b.accountId !== saved.accountId ||
      b.channelId !== saved.channelId ||
      b.cwd !== saved.cwd ||
      !t?.ready ||
      t.selfId !== saved.accountId ||
      t.isPaused?.(saved.channelId) ||
      (saved.kind === 'user' && c.userReceiveOnly !== false)
    )
      throw Error('Discord 帳號、會話或可發送範圍已變更');
    return { saved, t, c };
  }
  function capture(agent, mode) {
    if (!['attachment', 'voice-room'].includes(mode)) throw Error('歌曲交付形式無效');
    const id = agent?.session?.id || agent?.session?.header?.id,
      b = Object.values(sessionBridge.bindings).find((x) => x.sessionId === id);
    if (!b) throw Error('請在已綁定的 Discord 正式會話操作歌曲');
    const cap = Object.freeze({ sessionId: id, workspace: b.cwd });
    captures.set(cap, {
      sessionId: id,
      cwd: b.cwd,
      channelId: b.channelId,
      accountId: b.accountId,
      kind: b.transport,
      mode,
    });
    check(cap);
    if (mode === 'voice-room') {
      const s = voice.session(b.transport);
      voice.check(s);
      if (s.textChannelId !== b.channelId) throw Error('語音房必須已加入並綁定目前文字頻道');
    }
    return cap;
  }
  async function inspect(cap, file) {
    const { saved } = check(cap);
    const base = await realpath(path.join(saved.cwd, '.dsh-song-jobs')),
      resolved = await realpath(file),
      rel = path.relative(base, resolved);
    if (path.dirname(base) !== (await realpath(saved.cwd))) throw Error('歌曲工作目錄不能連結到工作區外');
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel))
      throw Error('只接受目前會話歌曲工作目錄內的成品');
    return { ...(await songWavInfo(resolved)), path: resolved };
  }
  async function deliver(cap, file, { signal, label = '翻唱成品' } = {}) {
    const { saved, c } = check(cap);
    signal?.throwIfAborted();
    const info = await inspect(cap, file),
      resolved = info.path;
    if (info.seconds > Math.min(600, (c.voiceMaxMusicMinutes || 30) * 60))
      throw Error('歌曲超過播放時長上限，不會截斷');
    const mp3 = path.join(path.dirname(resolved), 'discord-' + randomUUID() + '.mp3');
    try {
      await encode(resolved, mp3, signal);
      signal?.throwIfAborted();
      if ((await stat(mp3)).size > 24 * 1024 * 1024) throw Error('歌曲附件超過 24 MiB');
      const { t } = check(cap);
      if (saved.mode === 'voice-room') {
        const r = voice.playArtifact({
          kind: saved.kind,
          path: mp3,
          sourceChannelId: saved.channelId,
          label,
          signal,
        });
        const result = await r.done;
        if (!result?.ok) throw Error('歌曲播放失敗或中斷');
        return { ok: true, mode: 'voice-room', seconds: info.seconds };
      }
      const result = await t.sendMessage(saved.channelId, {
        files: [mp3],
        content: String(label).slice(0, 100),
        mention: false,
      });
      if (!result?.ok) throw Object.assign(Error('Discord 歌曲附件未確認送達'), { code: 'DELIVERY_UNKNOWN' });
      return { ok: true, mode: 'attachment', seconds: info.seconds };
    } finally {
      await unlink(mp3).catch(() => {});
    }
  }
  return { capture, check, inspect, deliver };
}
