export function createMessageSync({ history, responder, log }) {
  return async function sync(event, transport) {
    if (event.event === 'message_preview') {
      const existing = history.find(event.channelId, event.messageId);
      if (existing)
        history.record(
          { ...existing, embedDetails: event.embedDetails || [], embeds: event.embedDetails?.length || 0 },
          transport.kind,
        );
      return;
    }
    // Cancel any answer using this channel's previous context, not just direct replies.
    responder.cancel(event.channelId, undefined, undefined, transport);
    log.info?.(
      'reply.cancelled',
      event.event === 'message_delete' ? '訊息已刪除，取消舊回覆' : '訊息內容已修改，取消舊回覆',
      { channelId: event.channelId, messageId: event.messageId },
    );
    history.invalidate(event.channelId, event.messageId, event.event === 'message_delete');
    if (event.event === 'message_delete') return;
    const revision = history.revision(event.channelId, event.messageId),
      epoch = transport.epoch;
    const generation = transport.connectionGeneration;
    const result = await transport.getMessage(event.channelId, event.messageId);
    if (
      revision !== history.revision(event.channelId, event.messageId) ||
      epoch !== transport.epoch ||
      generation !== transport.connectionGeneration
    )
      return;
    if (result.ok && String(result.message?.channelId) === event.channelId) {
      history.record({ ...result.message, edited: true }, transport.kind);
    } else {
      log.debug('history.edit', '編輯後內容暫時無法讀取；已移除舊內容');
    }
  };
}
