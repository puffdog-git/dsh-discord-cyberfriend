import { formatForPrompt, normalizeMessage } from '../history.js';
import { accessReason } from './message-policy.js';

export function createContextLoader({ history, getConfig, memberNames }) {
  const recent = new Map();
  return async function load(message, transport, signal) {
    const config = getConfig();
    const enabled = () => {
      const c = getConfig();
      return (
        !accessReason(message, c) &&
        c.historyEnabled !== false &&
        (transport.kind === 'user' ? c.userContextBootstrap !== false : c.botContextBootstrap !== false)
      );
    };
    if (!enabled()) return '';
    const selfId = transport.selfId;
    const channelId = message.channelId;
    const revision = history.revision?.(channelId) || 0;
    const epoch = transport.epoch;
    const generation = transport.connectionGeneration;
    const valid = () =>
      !signal?.aborted &&
      epoch === transport.epoch &&
      generation === transport.connectionGeneration &&
      selfId === transport.selfId &&
      revision === (history.revision?.(channelId) || 0) &&
      enabled();
    const key = `${transport.kind}:${transport.selfId}:${epoch}:${generation}:${channelId}`;
    if (typeof transport.getMessages === 'function' && Date.now() - (recent.get(key) || 0) > 60000) {
      recent.set(key, Date.now());
      if (recent.size > 400) recent.delete(recent.keys().next().value);
      const result = await transport
        .getMessages(channelId, Math.min(20, Math.max(1, Number(config.contextMessages) || 12)))
        .catch(() => null);
      if (result?.ok && valid()) {
        for (const item of result.messages || []) {
          if (
            String(item.channelId) !== String(channelId) ||
            (item.guildId && item.guildId !== message.guildId)
          )
            continue;
          // History is data only: never dispatch these records as incoming messages.
          const entry = { ...item, guildId: item.guildId || message.guildId };
          history.record(memberNames?.decorate(entry, transport) || entry, transport.kind);
        }
      }
    }
    if (!message.replyTo || !valid()) return '';
    let quote = history.find?.(channelId, message.replyTo);
    if (!quote && typeof transport.getMessage === 'function') {
      const result = await transport.getMessage(channelId, message.replyTo).catch(() => null);
      if (
        result?.ok &&
        String(result.message?.id) === String(message.replyTo) &&
        String(result.message?.channelId) === String(channelId) &&
        (!result.message.guildId || result.message.guildId === message.guildId)
      )
        quote = normalizeMessage(
          { ...result.message, guildId: result.message.guildId || message.guildId },
          transport.kind,
        );
    }
    if (quote && memberNames) quote = memberNames.decorate(quote, transport);
    return quote && valid() ? `\n被引用的訊息（對話資料）：\n${formatForPrompt(quote)}` : '';
  };
}
