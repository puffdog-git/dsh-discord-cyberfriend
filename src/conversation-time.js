import { createHash } from 'node:crypto';

export function sourceFingerprint(message) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        id: message.id,
        channelId: message.channelId,
        guildId: message.guildId || null,
        author: message.author?.id,
        content: message.content || '',
        attachments: (message.attachments || []).map((a) => [
          a.name || a.filename,
          a.size,
          a.contentType || a.content_type,
          String(a.url || '').split('?')[0],
        ]),
      }),
    )
    .digest('hex');
}
export async function readConversationSource(transport, { channelId, sourceIds, userId, guildId }) {
  if (
    !Array.isArray(sourceIds) ||
    !sourceIds.length ||
    sourceIds.length > 8 ||
    sourceIds.some((id) => !/^\d{15,22}$/.test(id))
  )
    throw Error('來源必須是可重新讀取的 Discord 文字訊息，最多八則');
  const results = await Promise.all(sourceIds.map((id) => transport.getMessage(channelId, id)));
  const messages = results.map((r, i) => {
    if (
      !r?.ok ||
      r.message?.id !== sourceIds[i] ||
      r.message?.channelId !== channelId ||
      String(r.message?.author?.id) !== String(userId) ||
      (r.message?.guildId || null) !== (guildId || null)
    )
      throw Error('原訊息不存在、作者或頻道已改變');
    return r.message;
  });
  const last = messages.at(-1);
  return {
    ...last,
    turnMessageIds: [...sourceIds],
    content: messages.map((m) => m.content || '').join('\n'),
    attachments: messages.flatMap((m) => m.attachments || []),
    stickers: messages.flatMap((m) => m.stickers || []),
    embedDetails: messages.flatMap((m) => m.embedDetails || []),
  };
}
function number(value) {
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (value === '半') return 0.5;
  const digits = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    兩: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  let result = 0,
    digit = 0;
  if (!/^[零〇一二兩两三四五六七八九十百]+$/.test(value)) return NaN;
  for (const c of value) {
    if (c === '十' || c === '百') {
      result += (digit || 1) * (c === '十' ? 10 : 100);
      digit = 0;
    } else digit = digits[c];
  }
  return result + digit;
}
export function resolveConversationTime(input, now = Date.now()) {
  const value = String(input || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/分鐘/g, '分钟')
    .replace(/小時/g, '小时')
    .replace(/點/g, '点')
    .replace(/後/g, '后')
    .replace(/時/g, '时')
    .replace(/^今晚/, '今天晚上');
  if (!value || /^(晚点|晚點|稍后|稍後|一下|等一下|等我一下|明天|明日)$/.test(value))
    return { ok: false, needsTime: true, error: '請給明確時間，例如「半小時後」或「明天下午三點」。' };
  const duration =
    /^(?:等我|等|过|過|延后|延後|改成)?([\d.零〇一二兩两三四五六七八九十百半]+)(分钟|分|小时|时|天)(?:后|之後|之后)?$/.exec(
      value,
    );
  if (duration) {
    const minutes = number(duration[1]) * { 分钟: 1, 分: 1, 小时: 60, 时: 60, 天: 1440 }[duration[2]];
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 10080)
      return { ok: false, error: '延後時間需為 1 分鐘至 7 天，且以整分鐘計算。' };
    return { ok: true, dueAt: now + minutes * 60000 };
  }
  const clock =
    /^(今天|今日|明天|明日|后天)?(上午|早上|下午|晚上|中午|凌晨)?([\d零〇一二兩两三四五六七八九十]+)(?:点|时|:)(半|整|[\d零〇一二兩两三四五六七八九十]+)?分?$/.exec(
      value,
    );
  if (!clock) return { ok: false, error: '時間尚無法明確解析；請用「30分鐘後」或「明天下午三點半」。' };
  let hour = number(clock[3]),
    minute = clock[4] === '半' ? 30 : clock[4] === '整' || !clock[4] ? 0 : number(clock[4]);
  if (
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59
  )
    return { ok: false, error: '請確認時與分的範圍。' };
  if (clock[2]) {
    if (hour > 12) return { ok: false, error: '上午／下午請搭配 0–12 點，或改用 24 小時格式。' };
    if (['下午', '晚上'].includes(clock[2]) && hour < 12) hour += 12;
    if (['上午', '早上', '凌晨'].includes(clock[2]) && hour === 12) hour = 0;
    if (clock[2] === '中午' && hour < 11)
      return { ok: false, error: '「中午」時間不明確，請改用 24 小時格式。' };
  } else if (!value.includes(':') && hour <= 12)
    return { ok: false, needsTime: true, error: '請寫明上午／下午，例如「明天下午三點」，避免猜錯。' };
  const local = new Date(now + 8 * 3600000),
    days = ['明天', '明日'].includes(clock[1]) ? 1 : clock[1] === '后天' ? 2 : 0;
  const dueAt =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + days, hour, minute) -
    8 * 3600000;
  if (dueAt - now < 60000 || dueAt - now > 7 * 86400000)
    return { ok: false, error: '時間已過、距現在不足一分鐘或超過七天；請重新指定日期與時間。' };
  return { ok: true, dueAt };
}
export function parseConversationAction(text, { selfId, hasPlan = false } = {}) {
  let value = String(text || '').trim();
  if (
    value.length > 300 ||
    /[\n`"「」『』<>]/.test(
      value.replace(new RegExp('^<@!?' + String(selfId || '').replace(/\D/g, '') + '>\\s*'), ''),
    )
  )
    return null;
  value = value
    .replace(new RegExp('^<@!?' + String(selfId || '').replace(/\D/g, '') + '>\\s*'), '')
    .replace(/[。！!？?，,]+$/g, '')
    .trim();
  let m = /^(?:確認|确认)(?:安排|延後|延后|回覆|回复)?\s+([a-f0-9]{8})$/i.exec(value);
  if (m) return { action: 'confirm', code: m[1].toLowerCase() };
  if (
    /^(?:請|请)?(?:列出|查看|看看)?(?:未答話題|未答话题|待回覆話題|待回复话题|還沒回答的問題|还没回答的问题)$/.test(
      value,
    )
  )
    return { action: 'list' };
  m = /^(?:請|请)?(?:取消|結束|结束|繼續|继续|重新回答)(?:話題|话题)?\s*#?([a-f0-9]{8})$/i.exec(value);
  if (m) return { action: /繼續|继续|重新/.test(value) ? 'resume' : 'close', topicCode: m[1].toLowerCase() };
  if (
    /^(?:請|请)?(?:取消(?:剛才|刚才|這次|这次|這個|这个)?(?:的)?(?:安排|延後回覆|延后回复)|不用回了|這題不用回了|这题不用回了|結束這個話題|结束这个话题)$/.test(
      value,
    )
  )
    return { action: 'close' };
  if (
    /^(?:請|请)?(?:現在可以回答了|现在可以回答了|繼續剛才那題|继续刚才那题|繼續剛才的問題|继续刚才的问题)$/.test(
      value,
    )
  )
    return { action: 'resume' };
  m =
    /^(?:請|请|麻煩你|麻烦你)?(?:你|妳)?(.{1,70}?)(?:再)?(?:回覆|回复|回答|回我|答覆|答复|回)(?:我|這題|这题|剛才的問題|刚才的问题)?(?:就好|吧)?$/.exec(
      value,
    );
  if (
    m &&
    /^(?:等我|等|過|过|延後|延后|改成)?[\d.零〇一二兩两三四五六七八九十百半今天明日午上晚早凌晨:點点分分鐘钟小時时天後后整稍一會会]+$/.test(
      m[1],
    )
  )
    return { action: 'defer', when: m[1] };
  if (/^(?:等我一下|晚點再回|晚点再回|稍後回答|稍后回答)$/.test(value)) return { action: 'defer', when: '' };
  if (
    hasPlan &&
    /^(?:改成)?[\d零〇一二兩两三四五六七八九十百半今天明日后後午上晚早凌晨:點点分分鐘钟小時时天後后整]+$/.test(
      value,
    )
  )
    return { action: 'defer', when: value.replace(/^改成/, '') };
  return null;
}
