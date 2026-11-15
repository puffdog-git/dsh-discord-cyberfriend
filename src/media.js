import { isVideo, extractVideoFrames } from './video-frames.js';
/** Incoming GIF decoding, shared by Bot and user transports. No Discord credentials. */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pythonExecutable } from './transport/pyself.js';

const WORKER = fileURLToPath(new URL('../bridge/gif_frames.py', import.meta.url));
const MAX_BYTES = 12 * 1024 * 1024;
const HOSTS = new Set([
  'cdn.discordapp.com',
  'media.discordapp.net',
  'media.tenor.com',
  'tenor.com',
  'www.tenor.com',
  'giphy.com',
  'www.giphy.com',
  'media.giphy.com',
  'i.giphy.com',
  'klipy.com',
  'www.klipy.com',
  'static.klipy.com',
  'static1.klipy.com',
  'static2.klipy.com',
]);
let active = 0;
const refreshedUrls = new Map();

export function discordAttachmentUrl(value) {
  const safe = mediaUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  return ['cdn.discordapp.com', 'media.discordapp.net'].includes(url.hostname) &&
    /^\/attachments\/\d+\/\d+\/[^/]+$/.test(url.pathname)
    ? url
    : null;
}

export function mediaUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === '443') &&
      (HOSTS.has(u.hostname) || /^media[0-4]\.(?:giphy|tenor)\.com$/.test(u.hostname))
      ? u.href
      : null;
  } catch {
    return null;
  }
}

export function mediaSources(message, config = {}) {
  const sources = [];
  const add = (urls, label, animated) => {
    if (animated ? config.gifVisionEnabled === false : config.imageVisionEnabled === false) return;
    urls = [...new Set(urls.map(mediaUrl).filter(Boolean))];
    if (!urls.length) return;
    const existing = sources.find((s) => s.urls.some((u) => urls.includes(u)));
    if (existing) existing.urls = [...new Set([...existing.urls, ...urls])];
    else sources.push({ urls, label });
  };
  for (const a of message.attachments || []) {
    if (/^video\//i.test(a.contentType || '') && config.videoVisionEnabled === true)
      add([a.url], `影片 ${a.name || '附件'}`, true);
    else if (/^image\//i.test(a.contentType || '') || /\.(gif|webp|png|jpe?g)(?:\?|$)/i.test(a.url || ''))
      add([a.url], `附件 ${a.name || '圖片'}`, /gif|webp/i.test(a.contentType || a.url || ''));
  }
  for (const u of String(message.content || '').match(/https:\/\/[^\s<>]+/g) || []) {
    if (config.videoVisionEnabled === true && /\.(mp4|webm)(?:\?|$)/i.test(u)) add([u], '分享影片', true);
    else if (/\.(gif|webp|png|jpe?g)(?:\?|$)|(?:tenor|giphy|klipy)\.com\//i.test(u))
      add([u], '分享圖片', /gif|webp|tenor|giphy|klipy/i.test(u));
  }
  for (const e of message.embedDetails || []) {
    const animated = /gif|tenor|giphy|klipy/i.test([e.type, e.url, e.provider, e.imageUrl].join(' '));
    if (animated || e.type === 'image') add([e.url, e.imageUrl, e.thumbnailUrl], '連結圖片', animated);
  }
  if (config.stickerUnderstandEnabled !== false)
    for (const sticker of message.stickers || []) {
      if (!/^\d{15,22}$/.test(String(sticker.id || ''))) continue;
      const format = Number(sticker.formatType ?? sticker.format_type) || 1;
      const animated = format === 2 || format === 3 || format === 4,
        url = 'https://cdn.discordapp.com/stickers/' + sticker.id +
          (format === 3 ? '.json' : format === 4 ? '.gif' : '.png');
      add([url], '伺服器貼圖 ' + (sticker.name || sticker.id), animated);
    }
  if (config.emojiVisionEnabled !== false) {
    for (const match of String(message.content || '').matchAll(/<(a?):([a-zA-Z0-9_]+):(\d{15,22})>/g)) {
      const url = `https://cdn.discordapp.com/emojis/${match[3]}.${match[1] ? 'gif' : 'png'}?size=256&quality=lossless`;
      if (!sources.some((s) => s.urls.includes(url)))
        sources.push({ urls: [url], label: `自訂表情 :${match[2]}:` });
    }
  }
  return sources.slice(0, 3);
}

export function mediaCandidates(message) {
  return [...new Set(mediaSources(message).flatMap((source) => source.urls))];
}

async function download(url, signal, fetcher, hops = 0) {
  const safe = mediaUrl(url);
  if (!safe || hops > 3) throw Error('URL_NOT_ALLOWED');
  const response = await fetcher(safe, { signal, redirect: 'manual' });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    await response.body?.cancel();
    return download(new URL(response.headers.get('location'), safe).href, signal, fetcher, hops + 1);
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw Error(`MEDIA_HTTP_${response.status}`);
  }
  const type = response.headers.get('content-type') || '';
  const limit = type.includes('text/html') ? 2 * 1024 * 1024 : MAX_BYTES;
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel();
    throw Error('MEDIA_TOO_LARGE');
  }
  const reader = response.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw Error('MEDIA_TOO_LARGE');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = Buffer.concat(chunks);
  if (type.includes('text/html')) {
    const candidates = [];
    for (const tag of bytes.toString('utf8').match(/<meta\b[^>]*>/gi) || []) {
      const attrs = Object.fromEntries(
        [...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map((m) => [m[1].toLowerCase(), m[2]]),
      );
      if (/^(og:image(?::url)?|twitter:image)$/i.test(attrs.property || attrs.name || '') && attrs.content)
        candidates.push(attrs.content.replace(/&amp;/g, '&'));
    }
    const next =
      candidates.find((x) => mediaUrl(x) && /\.(gif|webp)(?:\?|$)/i.test(x)) || candidates.find(mediaUrl);
    if (!next) throw Error('NO_GIF_IMAGE');
    return download(next, signal, fetcher, hops + 1);
  }
  if (type.startsWith('video/') && !isVideo(bytes)) throw Error('VIDEO_INVALID_INPUT');
  return bytes;
}

export function extractFrames(bytes, config = {}, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(Error('CANCELLED'));
    let child;
    try {
      child = spawn(pythonExecutable(config), [WORKER, String(config.gifFrameCount || 4)], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'ignore'],
      });
    } catch {
      return reject(Error('EXTRACTOR_UNAVAILABLE'));
    }
    let output = '',
      settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (error) child.kill();
      error ? reject(error) : resolve(result);
    };
    const abort = () => finish(Error('CANCELLED'));
    const timer = setTimeout(() => finish(Error('EXTRACTION_TIMEOUT')), 6000);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    child.on('error', () => finish(Error('EXTRACTOR_UNAVAILABLE')));
    child.stdin.on('error', () => finish(Error('EXTRACTOR_INPUT_FAILED')));
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.length > 3 * 1024 * 1024) finish(Error('FRAME_OUTPUT_LIMIT'));
    });
    child.on('close', () => {
      try {
        const result = JSON.parse(output);
        const known = new Set(['INPUT_SIZE', 'PIXEL_LIMIT', 'ANIMATION_LIMIT', 'UNSUPPORTED_FORMAT',
          'LOTTIE_INVALID', 'LOTTIE_COMPLEXITY', 'LOTTIE_EXTERNAL_ASSET', 'LOTTIE_EXPRESSION',
          'LOTTIE_RENDERER_UNAVAILABLE', 'LOTTIE_RENDER_FAILED']);
        finish(result.ok ? null : Error(known.has(result.error) ? result.error : 'DECODE_FAILED'), result);
      } catch {
        finish(Error('EXTRACTOR_FAILED'));
      }
    });
    child.stdin.end(bytes);
  });
}

export async function prepareGif(message, config, signal, dependencies = {}) {
  const sources = mediaSources(message, config);
  if (!sources.length) return { images: [] };
  if (active >= 2) return { images: [], error: 'MEDIA_BUSY' };
  active++;
  const deadline = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(18000)]);
  try {
    const images = [],
      decoded = [],
      observations = [];
    let error;
    for (const source of sources) {
      if (deadline.aborted || images.length >= 6) break;
      const known = await dependencies.lookup?.(source);
      if (known) {
        observations.push(known);
        continue;
      }
      let sourceError = 'NO_MEDIA_IMAGE';
      for (const url of source.urls) {
        if (deadline.aborted) break;
        try {
          const attachment = discordAttachmentUrl(url),
            cacheKey = attachment ? attachment.origin + attachment.pathname : null;
          const cached = cacheKey ? refreshedUrls.get(cacheKey) : null;
          let bytes;
          try {
            bytes = await download(
              cached?.until > Date.now() ? cached.url : url,
              deadline,
              dependencies.fetcher || fetch,
            );
          } catch (error) {
            if (
              !attachment ||
              !['MEDIA_HTTP_404', 'MEDIA_HTTP_403'].includes(error.message) ||
              !dependencies.refreshUrls
            )
              throw error;
            const refreshed = await dependencies.refreshUrls([url], { signal: deadline });
            const item = refreshed.ok ? refreshed.items?.find((x) => x.original === url) : null;
            const target = item ? discordAttachmentUrl(item.refreshed) : null;
            if (!target || target.origin !== attachment.origin || target.pathname !== attachment.pathname)
              throw error;
            bytes = await download(target.href, deadline, dependencies.fetcher || fetch);
            const expires = parseInt(target.searchParams.get('ex') || '0', 16) * 1000;
            refreshedUrls.set(cacheKey, {
              url: target.href,
              until: Math.min(Date.now() + 300000, expires > 0 ? expires - 30000 : Date.now() + 60000),
            });
            if (refreshedUrls.size > 100) refreshedUrls.delete(refreshedUrls.keys().next().value);
          }
          const identity = await dependencies.identify?.(source, bytes);
          if (identity?.observation) {
            observations.push(identity.observation);
            sourceError = null;
            break;
          }
          if (isVideo(bytes) && config.videoVisionEnabled !== true) throw Error('VIDEO_DISABLED');
          const result = await (
            dependencies.extract || (isVideo(bytes) ? extractVideoFrames : extractFrames)
          )(bytes, config, deadline);
          const frames = result.frames.slice(0, 6 - images.length);
          images.push(
            ...frames.map((f) => ({
              ...f,
              source: source.label,
              ...(identity?.assetId ? { assetId: identity.assetId } : {}),
            })),
          );
          decoded.push({
            assetId: identity?.assetId,
            label: source.label,
            totalFrames: result.totalFrames,
            frameCount: frames.length,
            sampled: result.sampled === true,
            format: result.format,
            durationMs: result.durationMs,
          });
          sourceError = null;
          break;
        } catch (e) {
          sourceError = /^[A-Z_0-9]+$/.test(e.message) ? e.message : 'MEDIA_FETCH_FAILED';
        }
      }
      if (sourceError) error = sourceError;
    }
    return {
      images,
      observations,
      sources: decoded,
      totalFrames: decoded.reduce((n, s) => n + s.totalFrames, 0),
      durationMs: decoded.reduce((n, s) => n + s.durationMs, 0),
      error: deadline.aborted ? 'MEDIA_TIMEOUT_OR_CANCELLED' : error,
    };
  } finally {
    active--;
  }
}
