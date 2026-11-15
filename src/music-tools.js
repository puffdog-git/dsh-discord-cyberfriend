export function musicTools({ providers, voice, bridge, getManager }) {
  function scope(exec) {
    const id = exec.agent?.session?.id || exec.agent?.id,
      binding = Object.values(bridge.bindings).find((row) => row.sessionId === id);
    if (!binding) throw Error('需要已綁定的 Discord 正式會話');
    const transport = getManager().byKind[binding.transport];
    if (!transport?.ready || transport.selfId !== binding.accountId) throw Error('Discord 帳號已變更');
    return { binding, transport };
  }
  return [
    {
      name: 'discord_cyberfriend_music_sources',
      description:
        '探索目前可向 Discord 交付音訊的音樂插件與來源。不把只在電腦播放的 music_control 當成音訊接口；未宣告能力的插件不會假稱可用。',
      parameters: { type: 'object', properties: {} },
      execute: () => ({ ok: true, providers: providers.catalog() }),
    },
    {
      name: 'discord_cyberfriend_music_search',
      description: '在已註冊且提供搜尋能力的音樂來源查曲目，回傳曲目 ID；不播放。',
      parameters: {
        type: 'object',
        properties: { provider: { type: 'string' }, query: { type: 'string' } },
        required: ['provider', 'query'],
      },
      execute: async (a, e) => {
        const { binding } = scope(e);
        return {
          ok: true,
          tracks: await providers.search(a.provider, a.query, {
            agent: e.agent,
            workspace: binding.cwd,
            signal: e.signal,
          }),
        };
      },
    },
    {
      name: 'discord_cyberfriend_music_play',
      description:
        '把已探索的 plugin:／tool: 音樂來源排入本會話已綁定的 Discord 語音房。不可傳任意網址或檔案；不自行加入房間，不在電腦播放。queued 不代表完成。',
      parameters: {
        type: 'object',
        properties: { provider: { type: 'string' }, trackId: { type: 'string' }, label: { type: 'string' } },
        required: ['provider', 'trackId'],
      },
      execute: async (a, e) => {
        const { binding } = scope(e),
          room = voice.session(binding.transport);
        voice.check(room);
        if (room.textChannelId !== binding.channelId) throw Error('語音房未綁定此文字頻道');
        if (!/^(plugin|tool):/.test(a.provider))
          throw Error('請先探索可回傳音訊的來源；舊面板接口請用語音 UI，music_control 不回傳音訊');
        return voice.music({
          kind: binding.transport,
          provider: a.provider,
          trackId: a.trackId,
          label: a.label,
        });
      },
    },
  ];
}
