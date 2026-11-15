const known = {
  multi_search: { source: 'dsh-free-search', public: true },
  search_meme_wiki: { source: 'dsh-memewiki', public: true },
};
export function knowledgeCatalog(ctx) {
  let definitions = [];
  try {
    const tools = ctx.get?.('tools') || ctx.tools;
    definitions = tools?.definitions?.() || [];
  } catch {}
  return definitions
    .filter((d) => typeof d.name === 'string')
    .map((d) => {
      const annotations = d.annotations || {},
        declared = annotations.readOnlyHint === true && annotations.destructiveHint !== true;
      const purpose =
        String(annotations.knowledgeSource || d.knowledgeSource || '') ||
        (/wiki|百科|知識庫|知识库|knowledge.?base|\brag\b/i.test(d.name + ' ' + (d.description || ''))
          ? 'knowledge'
          : '');
      const rejected =
        /execute|sql|shell|filesystem|read_file|write|delete|update|submit|feedback|prefetch|設定|寫入|删除|回饋/i.test(
          d.name,
        );
      const eligible = !!known[d.name] || (declared && !!purpose && !rejected);
      return {
        name: d.name,
        source:
          known[d.name]?.source ||
          String(annotations.knowledgeSource || d.knowledgeSource || '外部知識插件').slice(0, 100),
        eligible,
        publicData: known[d.name]?.public || annotations.dataScope === 'public',
        reason: eligible ? '已宣告唯讀知識查詢' : '需要唯讀與知識檢索宣告，且不可為通用 SQL／檔案／寫入工具',
      };
    })
    .filter((row) => row.eligible || /wiki|knowledge|百科|知識|知识/i.test(row.name));
}
export function knowledgeToolsFor(ctx, config, message, actorId) {
  const privateAllowed =
    String(actorId) === String(config.adminUserId) &&
    !!config.adminUserId &&
    message.isDm &&
    !message.isGroupDm;
  return knowledgeCatalog(ctx)
    .filter(
      (row) =>
        row.eligible &&
        (row.publicData || privateAllowed) &&
        (config.knowledgeLookupEnabled ||
          (row.name === 'multi_search' && config.webLookupEnabled) ||
          (row.name === 'search_meme_wiki' && config.memeLookupEnabled)),
    )
    .map((row) => row.name);
}
