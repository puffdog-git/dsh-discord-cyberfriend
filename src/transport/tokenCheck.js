/** REST credential diagnostics. Only an explicit 401 establishes rejection. */
export async function checkDiscordToken(
  token,
  { kind = 'user', fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {},
) {
  const value = String(token || '').trim();
  const result = (outcome, status, error, extra = {}) => ({
    valid: outcome === 'valid' ? true : outcome === 'rejected' ? false : null,
    outcome,
    status,
    error,
    ...extra,
  });
  if (!value) return result('missing', 0, '尚未填寫 Token');
  try {
    const response = await fetchImpl('https://discord.com/api/v10/users/@me', {
      headers: {
        authorization: kind === 'bot' ? `Bot ${value}` : value,
        'user-agent': 'DiscordHub (dsh, 1.0.0)',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const payload = await response.json().catch(() => ({}));
    const status = response.status;
    if (status === 200 && payload?.id) {
      return result('valid', status, null, {
        user: {
          id: payload.id,
          username: payload.username,
          globalName: payload.global_name || payload.username,
          tag:
            payload.discriminator && payload.discriminator !== '0'
              ? `${payload.username}#${payload.discriminator}`
              : payload.username,
          bot: Boolean(payload.bot),
        },
      });
    }
    if (status === 401) return result('rejected', status, 'Discord 拒絕此憑證（HTTP 401）；原因尚未確定');
    if (status === 429)
      return result('rate_limited', status, '驗證請求受到限流，無法判定 Token 是否有效', {
        retryAfter: payload?.retry_after ?? response.headers?.get('retry-after') ?? null,
      });
    return result('unknown', status, `驗證未完成（HTTP ${status}），無法判定 Token 是否有效`);
  } catch (error) {
    return result(
      'unknown',
      0,
      error?.name === 'TimeoutError' || error?.name === 'AbortError'
        ? '驗證逾時，無法判定 Token 是否有效'
        : '無法連線到 Discord，無法判定 Token 是否有效',
    );
  }
}

export function tokenCheckSummary(check) {
  if (check.valid === true) return 'Token 驗證通過';
  if (check.valid === false) return 'Discord 拒絕此憑證（HTTP 401；原因未定）';
  return check.error || '無法判定 Token 是否有效';
}
