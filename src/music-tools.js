export function musicTools({ providers, voice, bridge, getManager, getConfig = () => ({}) }) {
  function scope(exec) {
    const id = exec.agent?.session?.id || exec.agent?.id,
      binding = Object.values(bridge.bindings).find((row) => row.sessionId === id);
    if (!binding) throw Error('需要已綁定的 Discord 正式會話');
    const transport = getManager().byKind[binding.transport];
    if (!transport?.ready || transport.selfId !== binding.accountId) throw Error('Discord 帳號已變更');
    return { binding, transport };
  }
  /**
   * 這次點歌要用的語音房。
   * 原本的規則：帳號已經在語音房，而且那個語音房綁定的就是這個文字頻道。
   * 開了「點歌時自動加入」之後多三種情況（都以「點歌的人現在在哪個語音頻道」為準，模型不能指定頻道）：
   *   1. 還沒加入任何語音房 → 加入點歌者所在的語音頻道。
   *   2. 已經在點歌者所在的那個語音房，只是從別的文字頻道點歌 → 直接用。
   *   3. 在別的語音房而且閒著 → 移到點歌者所在的語音頻道；正在播放或說話就拒絕，不中途換房。
   */
  async function musicRoom(binding) {
    const kind = binding.transport;
    let current = null;
    try {
      current = voice.session(kind);
    } catch {
      /* 還沒加入語音房 */
    }
    if (current && current.textChannelId === binding.channelId) return current;
    if (!getConfig().voiceMusicAutoJoin) {
      if (!current) voice.session(kind); // 丟出原本的「尚未加入語音頻道」
      throw Error('語音房未綁定此文字頻道');
    }
    const state = bridge.live?.get(binding.sessionId),
      message = state?.message;
    if (
      !state?.inFlight ||
      !message ||
      message.simulated ||
      message.channelId !== binding.channelId ||
      !message.author?.id ||
      message.author.id !== state.options?.actorId
    )
      throw Error('自動加入語音房需要目前 Discord 對話裡真正提出點歌的人');
    if (!message.guildId) throw Error('私訊裡無法判斷要加入哪個語音房；請在伺服器的頻道裡點歌');
    const target = await voice.memberVoiceChannel(kind, message.guildId, message.author.id);
    if (!target) throw Error('點歌的人目前不在這個伺服器的語音頻道裡；請先進語音房再點歌');
    if (current) {
      if (current.guildId === message.guildId && current.channelId === target) return current;
      if (current.current || current.music || current.queue?.length)
        throw Error('目前正在另一個語音房播放或說話；等結束或停止後再點歌');
      await voice.leave(kind, '點歌者在另一個語音房，移過去');
    }
    try {
      await voice.join({ kind, channelId: target, guildId: message.guildId, textChannelId: message.channelId });
    } catch (e) {
      // 討論串之類不能當綁定文字頻道的地方：改成不綁定文字頻道再加入一次。
      if (!/綁定文字頻道/.test(String(e?.message || ''))) throw e;
      await voice.join({ kind, channelId: target, guildId: message.guildId });
    }
    return voice.session(kind);
  }
  /**
   * 停止播放／離開語音房時要操作的語音房。
   * 只認「這個帳號現在所在的語音房」，而且提出要求的必須是目前 Discord 對話裡真正發話的人，
   * 並且和語音房在同一個伺服器（或語音房綁定的就是這個文字頻道）。模型不能指定頻道。
   * 還沒加入語音房時回傳 null。
   */
  function controlRoom(binding) {
    let current = null;
    try {
      current = voice.session(binding.transport);
    } catch {
      return null;
    }
    if (!current) return null;
    if (current.textChannelId === binding.channelId) return current;
    const state = bridge.live?.get(binding.sessionId),
      message = state?.message;
    if (
      !state?.inFlight ||
      !message ||
      message.simulated ||
      message.channelId !== binding.channelId ||
      !message.author?.id ||
      message.author.id !== state.options?.actorId
    )
      throw Error('需要目前 Discord 對話裡真正提出要求的人');
    if (!message.guildId || message.guildId !== current.guildId) throw Error('語音房在另一個伺服器，不能從這裡控制');
    return current;
  }
  return [
    {
      name: 'discord_cyberfriend_music_stop',
      description:
        '停止 Discord 語音房裡正在播放的音樂並清空排隊中的曲目，但留在語音房。使用者說「停」「不要播了」「先暫停音樂」時用。只作用在這個帳號目前所在的語音房，不能指定頻道。',
      parameters: { type: 'object', properties: {} },
      execute: async (a, e) => {
        const { binding } = scope(e);
        const room = controlRoom(binding);
        if (!room) return { ok: true, stopped: false, note: '目前沒有在任何語音房' };
        const playing = !!(room.current || room.music || room.queue?.length);
        await voice.stop(binding.transport);
        return { ok: true, stopped: playing, ...(playing ? {} : { note: '語音房裡本來就沒有在播放' }) };
      },
    },
    {
      name: 'discord_cyberfriend_voice_leave',
      description:
        '離開 Discord 語音房（會先停止正在播放的音樂）。使用者說「退出」「離開語音」「可以走了」「出去」時用。只作用在這個帳號目前所在的語音房，不能指定頻道。回傳 left:false 表示本來就不在語音房。',
      parameters: { type: 'object', properties: {} },
      execute: async (a, e) => {
        const { binding } = scope(e);
        const room = controlRoom(binding);
        if (!room) return { ok: true, left: false, note: '目前沒有在任何語音房' };
        const result = await voice.leave(binding.transport, '對話中要求離開');
        if (!result?.ok) throw Error(result?.error || '離開語音房尚未確認，請再試一次');
        return { ok: true, left: true };
      },
    },
    {
      name: 'discord_cyberfriend_music_sources',
      description:
        '探索目前可向 Discord 交付音訊的音樂插件與來源。不把只在電腦播放的 music_control 當成音訊接口；未宣告能力的插件不會假稱可用。',
      parameters: { type: 'object', properties: {} },
      execute: () => ({ ok: true, providers: providers.catalog() }),
    },
    {
      name: 'discord_cyberfriend_music_search',
      description:
        '在已註冊且提供搜尋能力的音樂來源查曲目，回傳曲目 ID；不播放。使用者有指定平台（例如 KKBOX、Spotify、Apple Music、bilibili、YouTube）時，用名稱對應的那個來源，不要自行換成別的來源。曲目 ID 會帶著當下的播放方式，每次點歌都重新搜尋，不要沿用之前對話裡的 ID。',
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
        '把已探索的 plugin:／tool: 音樂來源排入 Discord 語音房。不可傳任意網址或檔案，不在電腦播放，也不能指定要加入哪個語音頻道。還沒加入語音房時：管理者有開「點歌時自動加入」就會加入點歌者目前所在的語音頻道；沒開或點歌者不在語音頻道時會回報原因，照實轉告即可。queued 不代表完成。來源清單裡標 live 的是即時來源，會邊收邊播到被停止為止。',
      parameters: {
        type: 'object',
        properties: { provider: { type: 'string' }, trackId: { type: 'string' }, label: { type: 'string' } },
        required: ['provider', 'trackId'],
      },
      execute: async (a, e) => {
        const { binding } = scope(e);
        if (!/^(plugin|tool):/.test(a.provider))
          throw Error('請先探索可回傳音訊的來源；舊面板接口請用語音 UI，music_control 不回傳音訊');
        const room = await musicRoom(binding);
        voice.check(room);
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
