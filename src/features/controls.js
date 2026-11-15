import { trustedAdmin } from '../security.js';
// User-account reaction commands share the normal responder and quota gate.
export function createControls({ getConfig, responder, history, gate, log }) {
  const pending = new Set();
  const seen = new Map();
  async function handle(event, transport) {
    const config = getConfig();
    const deny = (reason) => ({ ok: false, reason });
    if (
      !config.enabled ||
      !config.userEnabled ||
      !config.reactionCommandEnabled ||
      !config.userAutoReply ||
      config.userReceiveOnly !== false ||
      !transport.ready ||
      event.removed
    )
      return deny('表情操作未啟用');
    const actor = String(event.userId || '');
    const allowedNow = () => {
      const c = getConfig();
      return (
        c.enabled &&
        c.userEnabled &&
        c.reactionCommandEnabled &&
        c.userAutoReply &&
        c.userReceiveOnly === false &&
        transport.ready &&
        transport.watches(event.channelId, event.dm) &&
        !c.blacklistUserIds?.includes(actor) &&
        (!c.whitelistUserIds?.length || c.whitelistUserIds.includes(actor)) &&
        (!event.guildId || !c.monitoredGuildIds?.length || c.monitoredGuildIds.includes(event.guildId))
      );
    };
    if (
      !actor ||
      actor === transport.selfId ||
      config.blacklistUserIds?.includes(actor) ||
      (config.whitelistUserIds?.length && !config.whitelistUserIds.includes(actor))
    )
      return deny('使用者未獲允許');
    if (!transport.watches(event.channelId, event.dm)) return deny('頻道未獲允許');
    if (
      event.guildId &&
      config.monitoredGuildIds?.length &&
      !config.monitoredGuildIds.includes(event.guildId)
    )
      return deny('伺服器未獲允許');
    const emoji = String(event.emoji).replace(/\uFE0F/g, '');
    const action =
      { '🔁': 'regenerate', '⏹': 'stop', '🔍': 'explain' }[emoji] ||
      (config.reactionCommandTriggerEmojis?.some((item) => item.replace(/\uFE0F/g, '') === emoji)
        ? 'reply'
        : null);
    if (!action) return deny('非指令表情');
    if (config.adminUserId && action !== 'reply' && !trustedAdmin(config, actor))
      return deny('只有管理者可停止、重答或查看解釋');
    const key = `${transport.epoch}:${event.channelId}:${event.messageId}:${actor}:${emoji}`;
    if (Date.now() - (seen.get(key) || 0) < 20000 || pending.has(key)) return deny('重複操作');
    seen.set(key, Date.now());
    if (seen.size > 1000) seen.delete(seen.keys().next().value);
    pending.add(key);
    const epoch = transport.epoch,
      generation = transport.connectionGeneration;
    const revision = history.revision(event.channelId);
    try {
      const fetched = await transport.getMessage(event.channelId, event.messageId);
      if (!fetched.ok || String(fetched.message?.channelId) !== event.channelId)
        return deny('找不到目標訊息');
      if (
        transport.epoch !== epoch ||
        transport.connectionGeneration !== generation ||
        history.revision(event.channelId) !== revision
      )
        return deny('訊息或連線已變更');
      const current = getConfig();
      if (!allowedNow()) return deny('設定已變更');
      const target = fetched.message;
      const source = responder.source(event.channelId, event.messageId, transport);
      const owner = source?.controlOwnerId || source?.author?.id || target.author?.id;
      if (
        owner !== actor &&
        !(current.adminUserId === actor || current.reactionControlUserIds?.includes(actor))
      )
        return deny('只能操作自己的問題及對應回覆');
      if (action === 'stop') {
        const count = responder.cancel(event.channelId, source?.id || target.id);
        log.info('reaction.stop', '已取消尚未送出的回覆', { count });
        return { ok: true, cancelled: count };
      }
      let message = action === 'regenerate' && source ? source : target;
      if (action === 'regenerate' && source) {
        const original = await transport.getMessage(event.channelId, source.id);
        if (!original.ok || original.message?.channelId !== event.channelId) return deny('原問題已不可讀取');
        message = original.message;
      }
      if (
        !allowedNow() ||
        (owner !== actor &&
          !(getConfig().adminUserId === actor || getConfig().reactionControlUserIds?.includes(actor)))
      )
        return deny('設定已變更');
      const kind = message.isDm ? 'dm' : 'mention';
      // Attribute quota and permission checks to the person requesting the action.
      const decision = gate.check(
        { ...message, author: { id: actor, name: event.userName || actor } },
        kind,
        { selfId: transport.selfId, transportEnabled: current.userEnabled, transport: 'user' },
      );
      if (!decision.ok) return decision;
      if (
        history.revision(event.channelId) !== revision ||
        transport.epoch !== epoch ||
        transport.connectionGeneration !== generation
      )
        return deny('訊息或連線已變更');
      if (action === 'regenerate') responder.cancel(message.channelId, message.id);
      log.info('reaction.control', '表情操作已接受', { action, messageId: message.id });
      return await responder.respond(message, kind, transport, {
        requesterId: actor,
        instruction:
          action === 'regenerate'
            ? '使用者要求重新回答這個問題，請重新思考後給出答案。'
            : action === 'explain'
              ? '使用者要求詳細解釋上面的訊息。'
              : '使用者透過表情要求你回覆上面的訊息。',
      });
    } finally {
      pending.delete(key);
    }
  }
  return { handle };
}
