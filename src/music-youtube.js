// YouTube 音樂來源。
// 內建：src/ytdlp/ 的執行器（需要使用者自己準備 yt-dlp 執行檔）。
// 外部：別的插件若提供 youtubeMusic 服務，優先使用它；每次呼叫時才解析，
// 所以插件載入順序、卸載與重新載入都不會留下過期的下載器。
export function youtubeMusicProvider(ctx, builtin) {
  function external() {
    let value;
    try {
      value = ctx.get?.('youtubeMusic');
    } catch {}
    return typeof value?.search === 'function' && typeof value?.load === 'function' ? value : undefined;
  }
  function service() {
    const current = external() || builtin?.service;
    if (current) return current;
    throw Error('找不到可用的 YouTube 音樂來源；請啟用提供 YouTube 音樂來源的插件');
  }
  return {
    id: 'youtube',
    name: 'YouTube（yt-dlp）',
    // 內建來源要等偵測到 yt-dlp 執行檔才算可用。
    available: () => !!external() || !!builtin?.ready(),
    search: (query, context) => service().search(query, context),
    load: async (id, context) => {
      const current = service();
      const audio = await current.load(id, context);
      if (current !== service()) throw Error('YouTube 下載器在載入期間已變更');
      return audio;
    },
  };
}
