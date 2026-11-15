/** GIF lookup through Discord's KLIPY integration, shared by Bot and user accounts. */
import { truncate, uniqueBy } from './util.js';

export function normalizeDiscordGifs(payload, limit = 8) {
  return uniqueBy(
    (Array.isArray(payload) ? payload : [])
      .map((item) => ({
        id: String(item.id || ''),
        url: String(item.url || item.src || ''),
        mediaUrl: String(item.src || item.gif_src || ''),
        title: truncate(item.title || '', 120),
        preview: String(item.preview || item.src || ''),
        width: item.width,
        height: item.height,
        provider: 'klipy',
      }))
      .filter((item) => /^https:\/\//.test(item.url)),
    (item) => item.url,
  ).slice(0, limit);
}

export function gifAvailable(config, transport, userId) {
  return (
    gifAllowed(config, userId).ok &&
    (config.gifProvider === 'custom'
      ? Boolean(String(config.gifCustomEndpoint || '').trim())
      : typeof transport?.searchGifs === 'function')
  );
}

export async function searchGifs(config, query, options = {}) {
  const text = String(query || '')
    .trim()
    .slice(0, 120);
  if (!text) return { ok: false, error: '缺少搜尋關鍵字' };
  if (config.gifEnabled === false) return { ok: false, error: 'GIF 功能已關閉' };
  const limit = Math.max(1, Math.min(20, Number(config.gifMaxResults) || 8));
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(12000)]);
  try {
    if (config.gifProvider === 'custom') {
      const endpoint = String(config.gifCustomEndpoint || '').trim();
      if (!endpoint) return { ok: false, error: '尚未設定自訂 GIF 端點' };
      const url = endpoint.includes('{query}')
        ? endpoint.replace('{query}', encodeURIComponent(text))
        : `${endpoint}${endpoint.includes('?') ? '&' : '?'}q=${encodeURIComponent(text)}`;
      const response = await fetch(url, { signal });
      if (!response.ok) return { ok: false, error: `自訂 GIF 端點回應 ${response.status}` };
      const payload = await response.json();
      const list = Array.isArray(payload) ? payload : payload.results || payload.data || [];
      const results = list
        .map((item) => ({
          url: item.url || item.gif || item.src || '',
          title: truncate(item.title || item.name || text, 120),
        }))
        .filter((item) => /^https:\/\//.test(item.url))
        .slice(0, limit);
      return results.length ? { ok: true, results } : { ok: false, error: '自訂端點沒有可用的 GIF' };
    }
    if (!options.transport?.searchGifs) return { ok: false, error: 'KLIPY 搜尋需要已連線的 Discord 介面' };
    signal.throwIfAborted();
    const result = await options.transport.searchGifs(text, {
      limit,
      locale: config.language === 'en' ? 'en-US' : 'zh-TW',
      signal,
    });
    signal.throwIfAborted();
    if (!result.ok) return result;
    const results = normalizeDiscordGifs(result.items, limit);
    return results.length ? { ok: true, results } : { ok: false, error: 'KLIPY 沒有符合的 GIF，請改用文字' };
  } catch {
    return { ok: false, error: signal.aborted ? 'GIF 搜尋已取消或逾時' : 'GIF 搜尋失敗，請稍後再試' };
  }
}

export async function trendingGifs(config, options = {}) {
  return searchGifs(config, 'trending', options);
}

export function gifAllowed(config, userId) {
  if (config.gifEnabled === false) return { ok: false, error: 'GIF 功能已關閉' };
  if (config.gifAccessMode !== 'whitelist') return { ok: true };
  if (config.gifAccessWhitelist?.includes(String(userId))) return { ok: true };
  return { ok: false, error: '你不在 GIF 白名單中' };
}
