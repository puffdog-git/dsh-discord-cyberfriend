// Authenticate every management route through the Host's signed session/Peer.
// There is deliberately no loopback, arbitrary Bearer or cookie-name fallback.
export async function managementRejection(req, ctx) {
  const h = req.headers || {},
    site = h['sec-fetch-site'];
  if (site && !['same-origin', 'none'].includes(site)) return 403;
  if (h.origin) {
    try {
      const u = new URL(h.origin);
      if (
        !['http:', 'https:'].includes(u.protocol) ||
        u.host.toLowerCase() !== String(h.host || '').toLowerCase()
      )
        return 403;
    } catch {
      return 403;
    }
  }
  let connection;
  try {
    connection = ctx?.get?.('connection') || ctx?.connection;
  } catch {}
  if (typeof connection?.requestRejection !== 'function') return 503;
  try {
    const denied = await connection.requestRejection(req);
    if (denied !== undefined && denied !== null && denied !== false) return denied === 403 ? 403 : 401;
  } catch {
    return 401;
  }
  if (
    !['GET', 'HEAD'].includes(req.method) &&
    !/^application\/json(?:\s*;|$)/i.test(String(h['content-type'] || ''))
  )
    return 415;
}
