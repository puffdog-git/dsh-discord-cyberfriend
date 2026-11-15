export function addressedTo(message, selfId, recentReplies = []) {
  return Boolean(
    message.isMention ||
    (selfId &&
      (message.mentions?.some((user) => user.id === selfId) ||
        message.content?.includes(`<@${selfId}>`) ||
        message.content?.includes(`<@!${selfId}>`) ||
        message.replyToAuthorId === selfId)) ||
    (message.replyTo &&
      (typeof recentReplies.has === 'function'
        ? recentReplies.has(String(message.replyTo))
        : recentReplies.includes(String(message.replyTo)))),
  );
}

export function classifyMessage(message, selfId, recentReplies = []) {
  if (message.isDm && !message.isGroupDm) return 'dm';
  if (addressedTo(message, selfId, recentReplies)) return 'mention';
  return 'cochat';
}

export function hasReplyContent(message) {
  return Boolean(
    message?.content?.trim() ||
    message?.attachments?.length ||
    message?.stickers?.length ||
    message?.embedDetails?.length ||
    Number(message?.embeds) > 0,
  );
}

export function accessReason(message, config) {
  if (config.blacklistChannelIds?.includes(String(message.channelId))) return '頻道在黑名單';
  if (config.blacklistUserIds?.includes(String(message.author?.id))) return '使用者在黑名單';
  if (config.whitelistUserIds?.length && !config.whitelistUserIds.includes(String(message.author?.id)))
    return '使用者不在白名單';
  if (
    message.guildId &&
    config.monitoredGuildIds?.length &&
    !config.monitoredGuildIds.includes(String(message.guildId))
  )
    return '伺服器不在監控清單';
  return '';
}
