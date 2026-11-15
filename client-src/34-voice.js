function VoiceOverviewPanel() {
  const [data, D] = useState(null),
    [error, E] = useState(''),
    [busy, B] = useState(false);
  const load = async (memory) => {
    B(true);
    E('');
    try {
      D(await api('/voice/overview' + (memory ? '?memory=1' : '')));
    } catch (e) {
      E(e.message);
    } finally {
      B(false);
    }
  };
  useEffect(() => {
    load(false);
  }, []);
  const fmt = (n) => (typeof n === 'number' ? n.toLocaleString() : '未估算'),
    memoryLabel = {
      ready: '記憶庫已選擇',
      unbound: '沒有記憶綁定',
      'missing-library': '尚未選記憶庫',
      disabled: '此會話未使用工作區記憶庫',
      unavailable: '未連接或無權讀取',
    };
  return h(
    'details',
    { className: 'dpl-note' },
    h('summary', null, '人格音色、記憶庫與成本概覽'),
    h(
      'div',
      { className: 'dpl-actions' },
      h('button', { className: 'dpl-btn', disabled: busy, onClick: () => load(false) }, '更新音色與統計'),
      h('button', { className: 'dpl-btn', disabled: busy, onClick: () => load(true) }, '唯讀檢查記憶庫綁定'),
    ),
    h(
      'p',
      { className: 'dpl-row-help' },
      '對照 DSH 會話實際使用的聲音；不會因此合成語音、建立記憶庫或傳送訊息。',
    ),
    ...(data?.bindings || []).map((b) =>
      h(
        'div',
        { className: 'dpl-asset', key: b.sessionId },
        h('strong', null, b.title || b.sessionId),
        h(
          'p',
          null,
          b.voice?.error ||
            [
              b.voice?.manualOverride ? 'Discord 明確指定' : b.voice?.profileName || '繼承全域音色',
              b.voice?.provider,
              b.voice?.voice,
              b.voice?.spokenLanguage === 'ja' ? '日文' : '原文',
            ]
              .filter(Boolean)
              .join(' · '),
        ),
        h(
          'p',
          null,
          '今日：' +
            fmt(b.usage?.llm?.totalTokens) +
            ' Token · ' +
            fmt(b.usage?.speech?.characters) +
            ' TTS字元 · ' +
            fmt(b.usage?.speech?.sttSeconds) +
            ' STT秒',
        ),
        h('small', null, '會話 ' + b.sessionId + (b.workspaceId ? ' · 工作區 ' + b.workspaceId : '')),
        h(
          'p',
          null,
          b.memory
            ? (memoryLabel[b.memory.status] || b.memory.status) +
                (b.memory.libraryName ? '：' + b.memory.libraryName : '')
            : '記憶庫尚未檢查',
        ),
      ),
    ),
    data?.usage
      ? h(
          'div',
          null,
          h(
            'p',
            null,
            '今日 LLM：' +
              fmt(data.usage.llm?.today?.totalTokens) +
              ' Token；TTS：' +
              fmt(data.usage.speech?.characters) +
              ' 字元；播放 ' +
              fmt(Math.round((data.usage.speech?.playedMs || 0) / 1000)) +
              ' 秒',
          ),
          h(
            'p',
            null,
            '最近日文補翻：' + fmt(data.usage.translation?.recentTokens) + ' Token（最近最多60筆）',
          ),
          h(
            'p',
            null,
            '今日估算 ' +
              (data.usage.estimatedCost?.currency || 'USD') +
              ' · LLM ' +
              fmt(data.usage.estimatedCost?.todayLlm) +
              ' · TTS ' +
              fmt(data.usage.estimatedCost?.todayTts) +
              ' · STT ' +
              fmt(data.usage.estimatedCost?.todayStt),
          ),
          h('small', null, data.usage.estimatedCost?.note),
        )
      : null,
    error ? h('p', { role: 'alert' }, error) : null,
  );
}

function VoicePanel({ dirtyKeys }) {
  const [data, setData] = useState(null),
    [kind, setKind] = useState('bot'),
    [guildId, setGuild] = useState(''),
    [channelId, setChannel] = useState(''),
    [textChannelId, setTextChannel] = useState(''),
    [text, setText] = useState(''),
    [speechInstruction, setSpeechInstruction] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [guilds, setGuilds] = useState([]),
    [rooms, setRooms] = useState([]),
    [roomRefresh, setRoomRefresh] = useState(0),
    [roomsLoading, setRoomsLoading] = useState(false),
    [tracks, setTracks] = useState([]),
    [q, setQ] = useState(''),
    [provider, setProvider] = useState('netease'),
    [trackId, setTrackId] = useState('');
  const [ytdlp, setYtdlp] = useState(null);
  const [musicSources, setMusicSources] = useState([]),
    [replays, setReplays] = useState([]);
  const refreshSources = async (announce = true) => {
    try {
      const [m, r] = await Promise.all([api('/voice/music-providers'), api('/voice/replays')]);
      setMusicSources(m.providers || []);
      setYtdlp(m.ytdlp || null);
      setReplays(r.items || []);
      if (announce === true) setNotice('已更新音樂來源與可重播成品');
    } catch (e) {
      setNotice(e.message);
    }
  };
  useEffect(() => {
    refreshSources(false);
  }, []);
  // 第一次讀取失敗時要顯示錯誤與重試，而不是一直停在「讀取中」。
  const [loadError, setLoadError] = useState('');
  const load = async () => {
    setData(await api('/voice'));
    setLoadError('');
  };
  const firstLoad = () => load().catch((e) => setLoadError(e.message));
  useEffect(() => {
    firstLoad();
    const t = setInterval(() => pageHidden() || load().catch(() => {}), 5000);
    return () => clearInterval(t);
  }, []);
  const run = async (path, body, label) => {
    setBusy(true);
    try {
      await api(path, { method: 'POST', body });
      setNotice(label);
      await load();
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  };
  const select = (label, value, onChange, items) =>
    h(
      'label',
      null,
      label,
      h(
        'select',
        { className: 'dpl-select', 'aria-label': label, value, onChange: (e) => onChange(e.target.value) },
        items.map(([v, t]) => h('option', { key: v, value: v }, t)),
      ),
    );
  const input = (label, value, setter, placeholder) =>
    h(
      'label',
      null,
      label,
      h('input', {
        className: 'dpl-input',
        'aria-label': label,
        value,
        placeholder,
        onChange: (e) => setter(e.target.value),
      }),
    );
  const current = data?.sessions?.find((s) => s.kind === kind),
    locked = busy || dirtyKeys.length > 0;
  const refreshRooms = () => setRoomRefresh(n => n + 1);
  useEffect(() => {
    let active = true;
    api('/guilds?transport=' + kind).then(payload => {
      if (!active) return;
      const rows = payload.guilds || [];
      rows.forEach(g => uiRuntime.names.set(String(g.id), g.name));
      setGuilds(rows);
      setGuild(id => rows.some(g => g.id === id) ? id : rows[0]?.id || '');
    }).catch(e => { if (active) { setGuilds([]); setNotice(e.message); } });
    return () => { active = false; };
  }, [kind, roomRefresh]);
  useEffect(() => {
    let active = true;
    setRooms([]);
    setChannel('');
    setTextChannel('');
    setRoomsLoading(!!guildId);
    if (guildId) api('/channels?' + new URLSearchParams({ transport: kind, guildId, includeVoice: '1' }))
      .then(payload => {
        if (!active) return;
        const rows = payload.channels || [];
        rows.forEach(r => uiRuntime.names.set(String(r.id), r.name));
        setRooms(rows);
      }).catch(e => { if (active) setNotice(e.message); })
      .finally(() => { if (active) setRoomsLoading(false); });
    return () => { active = false; };
  }, [kind, guildId, roomRefresh]);
  return h(
    Card,
    {
      title: 'Discord 語音控制台',
      icon: 'voice',
      desc: '使用外部 TTS 的目前設定；音樂取自音樂插件。收聽需另外啟用、取得同意及指定白名單；預設不收聽，不保存錄音。',
    },
    h(VoiceOverviewPanel),
    data === null
      ? loadError
        ? h(
            StateView,
            {
              kind: 'error',
              title: '讀不到語音狀態',
              action: h(
                'button',
                { type: 'button', className: 'dpl-btn dpl-btn-sm', onClick: firstLoad },
                '重試',
              ),
            },
            loadError,
          )
        : h(StateView, { kind: 'loading', title: '讀取語音狀態…' })
      : !data.enabled
        ? h(
            StateView,
            { kind: 'off', title: 'Discord 語音輸出尚未啟用' },
            '請在下方「語音設定 → 基本與權限」開啟「啟用 Discord 語音輸出」並儲存。允許房間留空代表不限，仍需此帳號有加入權限。',
          )
        : null,
    notice ? h('p', { className: 'dpl-note', role: 'status' }, notice) : null,
    dirtyKeys.length
      ? h('p', { className: 'dpl-note' }, '請先儲存設定，再加入或排入播放。停止與離開隨時可用。')
      : null,
    h('div', { className: 'dpl-subhead' }, '① 確認語音合成可用'),
    h(
      'div',
      { className: 'dpl-actions' },
      h('span', { className: 'dpl-row-label' }, '語音合成（TTS）'),
      h(
        Pill,
        { tone: data?.tts ? (data.tts.ready ? 'ok' : 'warn') : 'muted', dot: true },
        'TTS：' +
          (data?.tts
            ? (data.tts.ready ? '可用 · ' : '尚未就緒 · ') + (data.tts.name || data.tts.provider)
            : '未連接外部語音服務'),
      ),
    ),
    data?.tts?.serviceId
      ? h(
          'p',
          { className: 'dpl-row-help' },
          '目前使用：' + (data.tts.serviceId === 'dshTts' ? 'DSH 聲音工坊' : '宿主語音服務（小米 TTS 等）'),
        )
      : null,
    data?.tts && !data.tts.ready
      ? h(
          'p',
          { className: 'dpl-note' },
          ({
            'api-key-not-configured': 'TTS 插件尚未設定 API Key。',
            'api-key-rejected': 'TTS 插件的 API Key 未通過格式檢查。',
            'voice-required': 'TTS 插件尚未選擇聲音。',
          }[data.tts.unavailableReason] || '目前 TTS 設定尚未就緒。') +
            ' 請至外部語音插件設定；此處不複製或保存金鑰。',
        )
      : null,
    h(
      'button',
      {
        className: 'dpl-btn',
        disabled: busy,
        onClick: async () => {
          setBusy(true);
          try {
            const r = await api('/voice/check');
            setNotice(
              'Bot 語音：' +
                (r.bot?.available ? '可用' : '依賴未就緒') +
                '；個人帳號：' +
                (r.user?.available ? '可用' : r.user?.error || '依賴未就緒') +
                '；檢查未加入房間或合成音訊。',
            );
          } catch (e) {
            setNotice(e.message);
          } finally {
            setBusy(false);
          }
        },
      },
      '檢查語音環境',
    ),
    h('div', { className: 'dpl-subhead' }, '② 加入語音房'),
    h(
      'div',
      { className: 'dpl-form-grid' },
      select(
        '語音帳號',
        kind,
        (v) => {
          setKind(v);
          setGuilds([]);
          setRooms([]);
          setGuild('');
          setChannel('');
          setTextChannel('');
        },
        [
          ['bot', '機器人'],
          ['user', '個人帳號'],
        ],
      ),
      h('button', { className: 'dpl-btn', disabled: busy || roomsLoading, onClick: refreshRooms }, '重新偵測伺服器／語音房'),
      guilds.length
        ? select(
            '伺服器',
            guildId,
            (v) => {
              setGuild(v);
              setRooms([]);
              setChannel('');
              setTextChannel('');
            },
            [['', '選擇伺服器'], ...guilds.map((g) => [g.id, g.name])],
          )
        : null,
      guildId
        ? select('語音房間', channelId, setChannel, [
            ['', roomsLoading ? '正在偵測語音房…' : rooms.some(r => ['2', 'voice'].includes(String(r.type))) ? '選擇一般語音房' : '此伺服器沒有可見的一般語音房'],
            ...rooms.filter((r) => ['2', 'voice'].includes(String(r.type))).map((r) => [r.id, r.name]),
          ])
        : null,
      rooms.length
        ? select('朗讀來源頻道', textChannelId, setTextChannel, [
            ['', '不綁定，只手動播放'],
            ...rooms
              .filter((r) => ['0', '2', '5', '15', 'text', 'news', 'forum', 'voice'].includes(String(r.type)))
              .map((r) => [r.id, r.name]),
          ])
        : null,
      h('details', null, h('summary', null, '手動輸入 ID（清單查不到時）'),
        input('伺服器 ID', guildId, setGuild, '從 Discord 複製 ID'),
        input('語音頻道 ID', channelId, setChannel, '允許清單留空不限；仍須有加入權限'),
        input('綁定文字頻道 ID（選填）', textChannelId, setTextChannel, '只朗讀此頻道的已送出 AI 回覆')),
    ),
    h(
      'div',
      { className: 'dpl-actions' },
      h(
        'button',
        {
          className: 'dpl-btn dpl-btn-primary',
          disabled: locked || roomsLoading || !data?.enabled || !!current || !channelId || !guildId,
          onClick: () => run('/voice/join', { kind, guildId, channelId, textChannelId }, '已加入語音房間'),
        },
        '加入語音',
      ),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: !current,
          onClick: () => run('/voice/stop', { kind }, '已要求停止並清空佇列'),
        },
        '停止／清空佇列',
      ),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: !current && !data?.joining?.includes(kind),
          onClick: () => run('/voice/leave', { kind }, '已離開或取消連線'),
        },
        '離開語音',
      ),
    ),
    ...(data?.sessions || []).map((s) =>
      h(
        'div',
        { key: s.kind, className: 'dpl-asset' },
        h('strong', null, (s.kind === 'bot' ? 'Bot' : '個人帳號') + ' · ' + nameOfId(s.channelId)),
        h(
          'p',
          null,
          (s.connection?.recovering ? '正在重新連線' : s.connected ? '已連線' : '已斷線') +
            ' · ' +
            ({
              idle: '閒置',
              queued: '排隊',
              preparing: '準備音訊',
              buffering: '等待首段串流',
              music: '背景音樂播放中',
              playing: '正在播放',
              'leaving-error': '離開尚未確認，清理中',
            }[s.phase] || s.phase),
        ),
        h(
          'p',
          null,
          s.receiving
            ? s.receivePausedForMusic
              ? '收聽：音樂／翻唱播放中，暫停語音指令'
              : s.receiveActive
                ? '收聽：由此帳號處理'
                : '收聽：由同房另一介面接手'
            : '收聽：未啟用',
        ),
        s.idleExitAt ? h('p', null, '預計自動退出：' + new Date(s.idleExitAt).toLocaleTimeString()) : null,
        s.current ? h('p', null, '目前：' + s.current.label) : null,
        s.music ? h('p', null, '背景音樂：' + s.music.label) : null,
        h(
          'p',
          null,
          '等待 ' +
            s.queue.length +
            ' 筆' +
            (s.queue.length ? '：' + s.queue.map((j) => j.label).join('、') : ''),
        ),
        s.lastResult
          ? h(
              'small',
              { role: 'status' },
              s.lastResult.ok
                ? '上一筆傳輸完成' +
                    (s.lastResult.streaming
                      ? ' · ' +
                        (s.lastResult.streamMode === 'incremental'
                          ? '模型增量語音'
                          : s.lastResult.streamMode === 'native'
                            ? '原生串流'
                            : '分段串流') +
                        ' · 首音 ' +
                        (s.lastResult.firstAudioMs ?? '—') +
                        ' ms' +
                        (s.lastResult.inputReadyToFirstAudioMs !== undefined
                          ? ' · 收句後至首音 ' + s.lastResult.inputReadyToFirstAudioMs + ' ms'
                          : '') +
                        (s.lastResult.modelToFirstSentenceMs !== undefined
                          ? ' · 模型首句 ' + s.lastResult.modelToFirstSentenceMs + ' ms'
                          : '')
                      : '')
                : s.lastResult.error,
            )
          : null,
      ),
    ),
    ...(data?.captions || [])
      .slice(-4)
      .map((r) =>
        h(
          'div',
          { className: 'dpl-note', key: r.id },
          h(
            'strong',
            null,
            '本機字幕 · ' +
              ({ buffering: '準備中', playing: '正在說', complete: '已說完', failed: '已中止' }[r.phase] ||
                r.phase),
          ),
          h('p', null, r.sourceText),
          r.spokenText !== r.sourceText
            ? h('p', { lang: r.spokenLanguage === 'ja' ? 'ja' : undefined }, r.spokenText)
            : null,
        ),
      ),
    data?.incremental
      ? h('p', { className: 'dpl-note', role: 'status' }, '模型增量語音 · ' + data.incremental.reason)
      : null,
    data?.input
      ? h(
          'details',
          null,
          h('summary', null, '語音輸入與本機逐字稿'),
          h(
            'p',
            null,
            data.input.enabled
              ? '收聽已啟用；只限新加入的使用者帳號／Bot 房間及已允許參與者。'
              : '收聽關閉。',
          ),
          h(
            'p',
            null,
            'STT：' + (data.input.available ? '宿主服務已連接' : '請在 DSH 啟用語音輸入並準備模型'),
          ),
          h(
            'p',
            null,
            (data.input.providers || [])
              .map((p) => p.name + ' · ' + (p.location === 'cloud' ? '雲端' : '本機') + ' · ' + p.phase)
              .join('；'),
          ),
          ...(data.input.decisions || [])
            .slice(-4)
            .map((r, i) => h('p', { key: 'decision-' + i, className: 'dpl-note' }, '插話判斷 · ' + r.reason)),
          ...(data.input.recent || []).map((r) =>
            h(
              'p',
              { key: r.id },
              (r.authorName ? r.authorName + '（' + r.userId + '）' : r.userId) + '：' + r.text,
            ),
          ),
          h(
            'button',
            {
              className: 'dpl-btn',
              onClick: () =>
                run('/voice/input/stop', {}, '已取消進行中的語音辨識；關閉收聽請取消設定並離開房間'),
            },
            '取消進行中的辨識',
          ),
        )
      : null,
    h('div', { className: 'dpl-subhead' }, '③ 讓 AI 在語音房說話'),
    h('textarea', {
      className: 'dpl-textarea',
      rows: 3,
      'aria-label': '語音文字',
      value: text,
      placeholder: '要讓 AI 說出的文字（會產生 TTS 用量）',
      onChange: (e) => setText(e.target.value),
    }),
    input(
      '本次語氣／心情（選填）',
      speechInstruction,
      setSpeechInstruction,
      '例如：驚喜、帶笑意、節奏輕快；不支援的 TTS 會沿用原聲音',
    ),
    data && !current
      ? h('p', { className: 'dpl-row-help' }, '尚未加入語音房；完成步驟 ② 後才能排入語音或音樂。')
      : null,
    data?.tts?.speechInstruction === false
      ? h(
          'p',
          { className: 'dpl-row-help' },
          '目前選用的 TTS 接口不支援自然語言語氣提示；可改用支援的模型，或沿用原本聲音。',
        )
      : null,
    h(
      'button',
      {
        className: 'dpl-btn dpl-btn-primary',
        disabled: locked || !current || !text.trim() || !data?.tts?.ready,
        onClick: () =>
          run(
            '/voice/speak',
            { kind, text, speechInstruction: speechInstruction || undefined },
            '已排入語音；請查看播放結果',
          ),
      },
      '排入語音',
    ),
    h('div', { className: 'dpl-subhead' }, '④ 音樂與重播'),
    h(
      'details',
      null,
      h('summary', null, '探索音樂來源／重播已完成語音'),
      h(
        'p',
        null,
        'Discord 依音訊能力選擇來源，不把只在電腦播放的指令當成回傳音訊。新插件可註冊 Provider，或宣告唯讀音樂音訊契約；系統錄音不會自動開啟。',
      ),
      h(
        'button',
        { className: 'dpl-btn', disabled: busy, onClick: () => refreshSources(true) },
        '探索音樂來源與重播成品',
      ),
      musicSources.map((p) =>
        h(
          'p',
          { key: p.id },
          p.name +
            ' · ' +
            ({
              legacy: '既有面板接口',
              registered: '已註冊音訊來源',
              discovered: '自動探索到的音訊工具',
              unverified: '尚無音訊交付契約',
            }[p.type] || p.type) +
            (p.note ? ' · ' + p.note : ''),
        ),
      ),
      h(
        'p',
        null,
        '重播須先啟用短暫保留，且原語音已成功完成。只保留三分鐘，重播不重新合成；過期不會自動付費重做。',
      ),
      replays
        .filter((r) => r.delivery === 'room' && r.kind === kind && r.channelId === current?.textChannelId)
        .map((r) =>
          h(
            'div',
            { className: 'dpl-actions', key: r.id },
            h('span', null, '原語音 ' + r.id),
            h(
              'button',
              {
                className: 'dpl-btn',
                disabled: locked || !current,
                onClick: () => run('/voice/replay', { kind, id: r.id }, '原音訊已排入重播；沒有重新呼叫 TTS'),
              },
              '重播此原音訊',
            ),
          ),
        ),
    ),
    h(
      'details',
      null,
      h('summary', null, '音樂插件曲庫與線上曲目'),
      input('搜尋音樂庫', q, setQ, '曲名或歌手'),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: busy,
          onClick: async () => {
            try {
              setTracks((await api('/voice/music?' + new URLSearchParams({ q, provider }))).tracks || []);
            } catch (e) {
              setNotice(e.message);
            }
          },
        },
        '讀取音樂庫',
      ),
      ...tracks.map((t) =>
        h(
          'div',
          { key: t.path || t.provider + ':' + t.id, className: 'dpl-note' },
          h('span', null, t.title + (t.artist ? ' · ' + t.artist : '')),
          h(
            'button',
            {
              className: 'dpl-btn dpl-btn-sm',
              disabled: locked || !current,
              onClick: () =>
                run(
                  '/voice/music',
                  t.provider
                    ? { kind, provider: t.provider, trackId: t.id, label: t.title }
                    : { kind, path: t.path, label: t.title },
                  '音樂已排入佇列',
                ),
            },
            '排入播放',
          ),
        ),
      ),
      select('線上音樂來源', provider, setProvider, [
        ['netease', '網易雲'],
        ['qq', 'QQ 音樂'],
        ['kugou', '酷狗'],
        ...musicSources
          .filter((p) => /^(plugin|tool):/.test(p.id))
          .map((p) => [p.id, p.name + (p.available === false ? '（尚未就緒）' : '')]),
      ]),
      // YouTube 點歌靠 yt-dlp 這個小工具下載音訊；這裡顯示它的狀態，並可一鍵下載或更新。
      ytdlp
        ? h(
            'p',
            { className: 'dpl-note', 'data-youtube-hint': ytdlp.found ? 'ready' : 'missing' },
            ytdlp.found
              ? 'YouTube 點歌已就緒（yt-dlp ' + ytdlp.version + '）。YouTube 改版後若點不了歌，按右邊更新。'
              : ytdlp.autoInstall
                ? 'YouTube 點歌需要 yt-dlp 這個小工具。第一次點歌時會自動下載（十幾 MB，請稍等），也可以現在先下載。'
                : 'YouTube 點歌還不能用：找不到 yt-dlp。請確認「語音設定」裡的「yt-dlp 執行檔路徑」填對了，或清空它改用自動下載。',
            ytdlp.install && ytdlp.install.state === 'failed' ? '　上次下載失敗：' + ytdlp.install.error : '',
            ytdlp.install && ytdlp.install.supported
              ? h(
                  'button',
                  {
                    className: 'dpl-btn',
                    style: { display: 'inline-block', width: 'auto', marginLeft: '8px' },
                    disabled: busy,
                    'data-action': 'ytdlp-install',
                    onClick: async () => {
                      await run('/voice/ytdlp/install', {}, ytdlp.found ? 'yt-dlp 已更新到最新版' : 'yt-dlp 下載完成');
                      await refreshSources(false);
                    },
                  },
                  busy ? '處理中…' : ytdlp.found ? '更新 yt-dlp' : '下載 yt-dlp',
                )
              : null,
          )
        : null,
      input('線上曲目 ID', trackId, setTrackId, '沿用音樂插件的登入與來源設定'),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: locked || !current || !trackId,
          onClick: () => run('/voice/music', { kind, provider, trackId }, '線上曲目已排入'),
        },
        '排入線上曲目',
      ),
    ),
    h(
      'p',
      { className: 'dpl-row-help' },
      '預設發話時暫停音樂後接續；可選 Bot 雙音軌壓低與漸變。背景音樂仍在播放時不計閒置；還有最長連線時間保護，不會重啟後自行回房。',
    ),
    data?.usage
      ? h(
          'p',
          null,
          '今日 TTS 提交 ' +
            fmtNum(data.usage.characters || 0) +
            ' 字／' +
            (data.usage.characterLimit ? fmtNum(data.usage.characterLimit) : '不限') +
            '；已傳輸約 ' +
            Math.round((data.usage.playedMs || 0) / 1000) +
            ' 秒（與 LLM Token 分開）',
        )
      : null,
    h(
      'p',
      { className: 'dpl-row-help' },
      data?.audioProcessing
        ? '直接音訊輸出：未套用 Krisp／降噪、回音消除或自動增益。BGM 不經 Discord 桌面麥克風；Opus 壓縮、設定音量與音樂降音量仍會影響聽感。'
        : '',
    ),
    h('p', { className: 'dpl-row-help' }, data?.receiveNote || ''),
    h('p', { className: 'dpl-row-help' }, data?.note || ''),
  );
}
