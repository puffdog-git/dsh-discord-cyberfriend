import { normalizeMessage } from './history.js';
export const snowflake = (x) => /^\d{15,22}$/.test(String(x || ''));
export function channelInfo(c) {
  return {
    id: c.id,
    guildId: c.guild_id || null,
    type: c.type,
    name: c.name || '',
    parentId: c.parent_id || null,
    archived: !!c.thread_metadata?.archived,
    locked: !!c.thread_metadata?.locked,
    appliedTags: c.applied_tags || [],
    tags: (c.available_tags || []).map((t) => ({ id: t.id, name: t.name })).slice(0, 100),
  };
}
export async function botChannelRead(t, action, p) {
  const request = (m, url, o = {}) => t.rest(m, url, { ...o, signal: AbortSignal.timeout(10000) });
  const c = await request('GET', `/channels/${p.channelId}`),
    limit = Math.max(1, Math.min(20, Number(p.limit) || 20));
  if (action === 'info') return { ok: true, channel: channelInfo(c) };
  if (action === 'search') {
    if (!c.guild_id) throw Error('Bot 搜尋僅支援伺服器頻道');
    const id = (time) => String(BigInt(Math.max(0, Date.parse(time) - 1420070400000)) << 22n);
    const q = new URLSearchParams({
      content: p.query,
      channel_id: p.channelId,
      limit: String(limit),
      min_id: id(p.after),
      max_id: id(p.before),
      sort_by: 'timestamp',
      sort_order: 'desc',
    });
    const r = await request('GET', `/guilds/${c.guild_id}/messages/search?${q}`);
    if (!Array.isArray(r?.messages)) throw Error('搜尋索引未就緒或回傳格式不相容，請稍後再試');
    return {
      ok: true,
      messages: r.messages
        .flat()
        .filter((m) => m.channel_id === p.channelId)
        .slice(0, limit)
        .map((m) => normalizeMessage({ ...m, guild_id: c.guild_id }, 'bot', t.selfId)),
    };
  }
  if (action === 'posts') {
    if (![0, 5, 15, 16].includes(c.type) || !c.guild_id) throw Error('請選擇論壇或文字父頻道');
    const r = await request('GET', `/guilds/${c.guild_id}/threads/active`);
    return {
      ok: true,
      threads: (r.threads || [])
        .filter((row) => row.parent_id === p.channelId)
        .slice(0, limit)
        .map(channelInfo),
      cacheOnly: false,
    };
  }
  if (action === 'archives') {
    const r = await request('GET', `/channels/${p.channelId}/threads/archived/public?limit=${limit}`);
    return { ok: true, threads: (r.threads || []).slice(0, limit).map(channelInfo), hasMore: !!r.has_more };
  }
  if (action === 'members') {
    if (![10, 11, 12].includes(c.type)) throw Error('請選擇討論串');
    const r = await request('GET', `/channels/${p.channelId}/thread-members?limit=50&with_member=true`);
    return {
      ok: true,
      members: r
        .slice(0, 50)
        .map((m) => ({
          userId: m.user_id,
          name: m.member?.nick || m.member?.user?.global_name || m.member?.user?.username || '',
        })),
      truncated: r.length >= 50,
    };
  }
  throw Error('未知讀取操作');
}
export async function botChannelWrite(t, action, p) {
  const request = (m, url, o = {}) => t.rest(m, url, { ...o, signal: AbortSignal.timeout(10000) });
  const check = () => {
    if (
      t.selfId !== p.expectedSelfId ||
      !t.ready ||
      t.config.dryRun ||
      !t.config.enabled ||
      !t.config.botEnabled ||
      !t.config.channelActionsEnabled
    )
      throw Error('帳號或操作開關已變更');
  };
  check();
  const c = await request('GET', `/channels/${p.channelId}`);
  let m;
  if (['pin', 'unpin', 'edit', 'delete', 'forward'].includes(action)) {
    m = await request('GET', `/channels/${p.channelId}/messages/${p.messageId}`);
    if (m.content !== p.expectedContent || m.author?.id !== p.expectedAuthorId) throw Error('來源訊息已變更');
    if (['edit', 'delete'].includes(action) && m.author?.id !== t.selfId)
      throw Error('只能修改或撤回自己發出的訊息');
  }
  if (action === 'forward') {
    const dest = await request('GET', `/channels/${p.destinationId}`);
    if (!c.guild_id || dest.guild_id !== c.guild_id) throw Error('只允許同伺服器轉傳');
  }
  if (p.tags) {
    const parent = c.parent_id ? await request('GET', `/channels/${c.parent_id}`) : c;
    const ids = new Set((parent.available_tags || []).map((x) => x.id));
    if (p.tags.length > 5 || p.tags.some((id) => !ids.has(id))) throw Error('論壇標籤已變更');
  }
  check();
  let r;
  if (['pin', 'unpin'].includes(action))
    r = await request(
      action === 'pin' ? 'PUT' : 'DELETE',
      `/channels/${p.channelId}/messages/pins/${p.messageId}`,
    );
  else if (action === 'edit')
    r = await request('PATCH', `/channels/${p.channelId}/messages/${p.messageId}`, {
      body: { content: p.content, allowed_mentions: { parse: [], replied_user: false } },
    });
  else if (action === 'delete')
    r = await request('DELETE', `/channels/${p.channelId}/messages/${p.messageId}`);
  else if (action === 'forward')
    r = await request('POST', `/channels/${p.destinationId}/messages`, {
      body: {
        message_reference: {
          type: 1,
          message_id: p.messageId,
          channel_id: p.channelId,
          guild_id: c.guild_id,
        },
        allowed_mentions: { parse: [], replied_user: false },
      },
    });
  else if (['join', 'leave'].includes(action)) {
    if (![10, 11, 12].includes(c.type)) throw Error('請選擇討論串');
    r = await request(action === 'join' ? 'PUT' : 'DELETE', `/channels/${p.channelId}/thread-members/@me`);
  } else if (action === 'thread_edit') {
    if (![10, 11, 12].includes(c.type)) throw Error('請選擇討論串');
    r = await request('PATCH', `/channels/${p.channelId}`, {
      body: {
        ...(p.name ? { name: p.name } : {}),
        ...(typeof p.archived === 'boolean' ? { archived: p.archived } : {}),
        ...(p.tags ? { applied_tags: p.tags } : {}),
      },
    });
  } else if (action === 'forum_create') {
    if (![15, 16].includes(c.type)) throw Error('請選擇論壇頻道');
    r = await request('POST', `/channels/${p.channelId}/threads`, {
      body: {
        name: p.name,
        message: { content: p.content, allowed_mentions: { parse: [], replied_user: false } },
        applied_tags: p.tags || [],
      },
    });
    return { ok: true, threadId: r.id, messageId: r.message?.id };
  } else throw Error('未知寫入操作');
  return { ok: true, ...(r?.id ? { messageId: r.id } : {}) };
}
