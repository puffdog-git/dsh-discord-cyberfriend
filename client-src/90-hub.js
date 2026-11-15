function DiscordHubPanel() {
  useUiLanguage();
  ensureStyles();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const [schema, setSchema] = useState(null);
  const [config, setConfig] = useState({});
  const [draft, setDraft] = useState({});
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState({});
  const [section, setSection] = useState('overview');
  const [logs, setLogs] = useState([]);
  const [logLevel, setLogLevel] = useState('info');
  const [channels, setChannels] = useState([]);
  const [historyStats, setHistoryStats] = useState(null);
  const [historyMessages, setHistoryMessages] = useState([]);
  const historyRequest = useRef(0);
  const [activeChannel, setActiveChannel] = useState(null);
  const [providers, setProviders] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [memoryOutput, setMemoryOutput] = useState(null);
  const [culture, setCulture] = useState(null);
  const [lastTest, setLastTest] = useState(null);
  const [testBusy, setTestBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const pollRef = useRef(null);
  const baselineRef = useRef({});
  const statusRequestRef = useRef(0);
  const [settingsQuery, setSettingsQuery] = useState('');
  // 儲存列的「查看變更」：列出每一項從什麼改成什麼。
  const [showChanges, setShowChanges] = useState(false);

  const showToast = (message, tone = 'ok') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3200);
  };

  const loadAll = async (silent) => {
    if (!silent) setLoading(true);
    const requestId = ++statusRequestRef.current;
    try {
      const payload = await api('/status');
      if (requestId !== statusRequestRef.current) return;
      // 內容沒變就沿用原物件：背景輪詢拿到相同資料時不觸發整個面板重繪。
      const keep = (next) => (previous) => (same(previous, next) ? previous : next);
      setStatus(keep({ ...payload.status, dailyStats: payload.dailyStats || payload.status?.dailyStats }));
      setConfig(keep(payload.config));
      const previousBaseline = baselineRef.current;
      setDraft((previous) => {
        const next = { ...payload.config };
        for (const key of Object.keys(previous))
          if (!same(previous[key], previousBaseline[key])) next[key] = previous[key];
        return same(previous, next) ? previous : next;
      });
      baselineRef.current = payload.config;
      setLogs(keep(payload.logs || []));
      setChannels(keep(payload.channels || []));
      setHistoryStats(keep(payload.history || null));
      setProviders(keep(payload.providers || []));
      setSessions(keep(payload.sessions || []));
      setMemoryOutput(keep(payload.memoryOutput || null));
      setCulture(keep(payload.culture || null));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const payload = await api('/schema');
        setSchema(payload.schema);
      } catch (err) {
        setError(err.message);
      }
      await loadAll(false);
    })();
  }, []);

  useEffect(() => {
    const seconds = clamp(Number(config.statusRefreshSeconds) || 30, 5, 600);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => pageHidden() || loadAll(true), seconds * 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [config.statusRefreshSeconds]);

  // 把設定裡的 ID 對應成名稱：出現還不認得的 ID 時向後端查一次（只查本機快取）。
  useIdNames(collectIds(config, draft));

  const dirtyKeys = useMemo(
    () => Object.keys(draft).filter((key) => !same(draft[key], config[key])),
    [draft, config],
  );

  const setValue = (key, value) => setDraft((previous) => ({ ...previous, [key]: value }));

  // extra：呼叫端要一併寫入的設定（例如快速設定的自動連線），與草稿變更一起送出。
  const saveWith = async (extra = {}) => {
    const patch = {};
    for (const key of dirtyKeys) patch[key] = draft[key];
    for (const [key, value] of Object.entries(extra)) if (!same(value, config[key])) patch[key] = value;
    const savedCount = Object.keys(patch).length;
    if (!savedCount) return true;
    setBusy((previous) => ({ ...previous, save: true }));
    try {
      const payload = await api('/config', { method: 'POST', body: patch });
      setConfig(payload.config);
      baselineRef.current = payload.config;
      setDraft({ ...payload.config });
      const appearance = payload.liveResults?.userPresence;
      showToast(
        `已儲存 ${savedCount} 項設定${(payload.restarted || []).length ? `（已重新連線 ${payload.restarted.join(' / ')}）` : ''}` +
          (appearance && !appearance.ok
            ? '；' + (appearance.pending ? appearance.error : '外觀套用失敗：' + appearance.error)
            : ''),
        appearance && !appearance.ok && !appearance.pending ? 'err' : 'ok',
      );
      await loadAll(true);
      return true;
    } catch (err) {
      showToast(err.message, 'err');
      return false;
    } finally {
      setBusy((previous) => ({ ...previous, save: false }));
    }
  };

  const save = () => saveWith();

  const login = async (kind, token, extra) => {
    if (!(await saveWith(extra))) return;
    setBusy((previous) => ({ ...previous, [kind]: true }));
    try {
      const payload = await api('/login', {
        method: 'POST',
        body: { transport: kind, ...(token ? { token } : {}) },
      });
      setStatus(payload.status);
      showToast(
        payload.pending
          ? 'Python 正在連線，請觀察連線狀態'
          : `${kind === 'user' ? '使用者帳號' : '機器人'} 已連線`,
      );
      await loadAll(true);
    } catch (err) {
      showToast(err.message, 'err');
    } finally {
      setBusy((previous) => ({ ...previous, [kind]: false }));
    }
  };

  const logout = async (kind) => {
    setBusy((previous) => ({ ...previous, [kind]: true }));
    try {
      const payload = await api('/logout', { method: 'POST', body: { transport: kind } });
      setStatus(payload.status);
      showToast('已斷開連線');
    } catch (err) {
      showToast(err.message, 'err');
    } finally {
      setBusy((previous) => ({ ...previous, [kind]: false }));
    }
  };

  const refreshLogs = async () => {
    try {
      const payload = await api('/logs?limit=120');
      setLogs(payload.logs || []);
    } catch (err) {
      showToast(err.message, 'err');
    }
  };

  const clearLogs = async () => {
    try {
      await api('/logs/clear', { method: 'POST', body: {} });
      setLogs([]);
      showToast('執行記錄已清空');
    } catch (err) {
      showToast(err.message, 'err');
    }
  };

  const openChannel = async (channelId) => {
    const request = ++historyRequest.current;
    setHistoryMessages([]);
    setActiveChannel(channelId);
    if (!channelId) return;
    try {
      const payload = await api(`/history?channelId=${encodeURIComponent(channelId)}&limit=60`);
      if (request === historyRequest.current) setHistoryMessages(payload.messages || []);
    } catch (err) {
      showToast(err.message, 'err');
    }
  };

  const clearHistory = async (channelId) => {
    try {
      historyRequest.current++;
      const payload = await api('/history/clear', { method: 'POST', body: channelId ? { channelId } : { confirmed: true } });
      setHistoryStats(payload.stats || null);
      setHistoryMessages([]);
      setActiveChannel(null);
      await loadAll(true);
      showToast(channelId ? '已清除該頻道快取' : '已清除全部快取');
    } catch (err) {
      showToast(err.message, 'err');
    }
  };

  const testModel = async () => {
    setTestBusy(true);
    setLastTest(null);
    try {
      const payload = await api('/test-llm', { method: 'POST', body: {} });
      setLastTest(payload.result);
      showToast(
        payload.result.ok ? `模型正常（${payload.result.ms}ms）` : '模型測試失敗',
        payload.result.ok ? 'ok' : 'err',
      );
    } catch (err) {
      setLastTest({ ok: false, error: err.message });
      showToast(err.message, 'err');
    } finally {
      setTestBusy(false);
    }
  };

  const sendTest = async (channelId, content) => {
    setSending(true);
    try {
      await api('/send', { method: 'POST', body: { channelId, content, type: 'text' } });
      showToast('測試訊息已送出');
    } catch (err) {
      showToast(err.message, 'err');
    } finally {
      setSending(false);
    }
  };

  // 提供給欄位元件的顯示用資訊：已連線的帳號（供清單挑選）與宿主可用的模型服務。
  uiRuntime.kinds = ['user', 'bot'].filter((kind) => status?.[kind]?.ok);
  uiRuntime.providers = providers || [];
  for (const channel of channels || [])
    if (channel?.id && channel?.name) uiRuntime.names.set(String(channel.id), channel.name);

  const sections = schema?.sections || [];
  const groups = schema?.groups || [];
  const fields = schema?.fields || [];
  const transportInfo = schema?.transportInfo || {};
  const fieldsOf = (sectionId) => fields.filter((field) => field.section === sectionId);
  const AUDIENCE_SECTIONS = ['adminDm', 'adminGroup', 'othersDm', 'othersGroup'];
  const isAudience = AUDIENCE_SECTIONS.includes(section);
  const currentSection = sections.find((item) => item.id === section);
  const activeGroup = currentSection?.group || groups[0]?.id;
  const go = (id) => {
    setSettingsQuery('');
    setSection(id);
  };
  const appearanceKeys = new Set([
    'userPresenceEnabled',
    'userStatus',
    'userActivityType',
    'userActivityText',
    'userCustomStatusText',
    'userCustomStatusEmoji',
  ]);
  // 這些欄位已在帳號連線卡內呈現，欄位清單不重複顯示。
  const duplicatedConnectionFields = new Set([
    'userEnabled',
    'userToken',
    'userAutoStart',
    'botEnabled',
    'botToken',
    'botAutoStart',
    'botActivityText',
    'botActivityType',
  ]);
  const stats = status?.dailyStats || {};
  const caps = {
    mention: Number(draft.maxDailyMentionReplies) || 60,
    dm: Number(draft.maxDailyDmReplies) || 60,
    cochat: Number(draft.maxDailyCoChats) || 80,
  };
  const kpis = [
    { key: 'mention', label: '其他人的 @ 回覆', value: stats.mentionReplies || 0, cap: caps.mention },
    { key: 'dm', label: '其他人的私訊回覆', value: stats.dmReplies || 0, cap: caps.dm },
    { key: 'admin', label: '管理者回覆（不限）', value: stats.adminReplies || 0, cap: 0 },
    { key: 'cochat', label: '閒聊插話', value: stats.coChats || 0, cap: caps.cochat },
    { key: 'reaction', label: '表情反應', value: stats.reactions || 0, cap: 0 },
  ];

  const fieldCard = (sectionId, title, icon, desc) => {
    const list = fieldsOf(sectionId).filter(
      (f) => !duplicatedConnectionFields.has(f.key) && !appearanceKeys.has(f.key),
    );
    return h(
      Card,
      { key: sectionId + '-fields', title, icon, desc },
      h(FieldList, { fields: list, config, draft, setValue, dirtyKeys }),
    );
  };

  // 私訊對象頁以「回覆這類對象的私訊」為總開關：關閉時只留開關，不顯示其餘細部設定。
  const audienceCards = () => {
    const masterKey = section.endsWith('Dm') ? section + '_dmReplyEnabled' : '';
    const master = masterKey ? fields.find((field) => field.key === masterKey) : null;
    const title = currentSection?.label || section;
    if (!master) return [fieldCard(section, title, currentSection?.icon || 'chat')];
    const rest = fieldsOf(section).filter((field) => field.key !== masterKey);
    const on = draft[masterKey] !== false;
    return [
      h(
        Card,
        { key: section + '-master', title, icon: currentSection?.icon || 'chat' },
        h(FieldList, { fields: [master], config, draft, setValue, dirtyKeys, flat: true }),
        on
          ? null
          : h(
              StateView,
              {
                kind: 'off',
                title: section.startsWith('others') ? '目前不回覆其他使用者的私訊' : '目前不回覆管理者的私訊',
              },
              '細部設定已收起。開啟上方開關後，可以調整人格、圖片與回覆節奏。',
            ),
      ),
      on
        ? h(
            Card,
            { key: section + '-fields', title: '細部設定', icon: 'settings' },
            h(FieldList, { fields: rest, config, draft, setValue, dirtyKeys }),
          )
        : null,
    ];
  };

  const renderSection = () => {
    if (section === 'overview')
      return [
        ...OverviewPanel({
          status,
          kpis,
          config,
          draft,
          setValue,
          fields,
          dirtyKeys,
          onLogin: login,
          busy: Boolean(busy.user || busy.bot || busy.save),
          onNavigate: go,
          onTestModel: testModel,
          modelBusy: testBusy,
          modelTest: lastTest,
          afterSetup: h(PresetCard, {
            key: 'presets',
            fields,
            draft,
            adminSet: Boolean(draft.adminUserId),
            onApply: (values, name) => {
              setDraft((previous) => ({ ...previous, ...values }));
              showToast('已套用「' + name + '」到草稿，按下方「儲存變更」才會生效', 'ok');
            },
          }),
        }),
        h(VoicePartnerGuide, {
          key: 'voice-partner',
          fields,
          draft,
          onNavigate: go,
          onApply: (values, name) => {
            setDraft((previous) => ({ ...previous, ...values }));
            showToast('已套用「' + name + '」到草稿，按下方「儲存變更」才會生效', 'ok');
          },
        }),
        h(QuickTest, { key: 'quick', onSend: sendTest, busy: sending }),
      ];
    if (isAudience)
      return [
        h(AudienceSwitcher, {
          key: 'audience-switch',
          section,
          onChange: setSection,
          adminSet: Boolean(config.adminUserId),
          onNavigate: go,
          fields,
          draft,
          onCopy: (values, from, to) => {
            setDraft((previous) => ({ ...previous, ...values }));
            showToast('已把「' + from + '」的設定填進「' + to + '」的草稿，按「儲存變更」才會生效', 'ok');
          },
        }),
        ...audienceCards(),
      ];
    if (section === 'voice')
      return [h(VoicePanel, { key: 'voice', dirtyKeys }), fieldCard('voice', '語音設定', 'voice')];
    if (section === 'advanced')
      return [
        h(ConfigTools, {
          key: 'config-tools',
          fields,
          onApplied: () => loadAll(true),
          onError: (message) => showToast(message, 'err'),
        }),
        h(TokenBudgetPanel, { key: 'budget' }),
        fieldCard('advanced', '進階設定', 'advanced'),
      ];
    if (section === 'culture') return [fieldCard('culture', '辨識、學習與使用規則', 'reaction')];
    if (section === 'memoryOutput')
      return [
        fieldCard('memoryOutput', '記憶輸出設定', 'history'),
        h(MemoryMaintenancePanel, { key: 'maintenance' }),
        h(ExternalMemoryPanel, { key: 'external-memory' }),
        h(MemoryOutputPanel, {
          key: 'memory-output',
          info: memoryOutput,
          onRefresh: () => loadAll(true),
          onError: (e) => showToast(e, 'err'),
        }),
      ];
    if (section === 'sessions')
      return [
        h(BehaviorPanel, { key: 'behavior', dirtyKeys, onConfigSaved: () => loadAll(true) }),
        fieldCard('sessions', 'DSH 會話與外部人格', 'history'),
        h(
          Card,
          {
            key: 'session-list',
            title: 'Discord 對應會話',
            icon: 'history',
            desc: '每個接收帳號／頻道各自對應持久 DSH 會話；可在 DSH 側邊欄依標題找到。工作區與會話人格請使用外部插件設定。',
          },
          sessions.length
            ? sessions.map((item) =>
                h(SessionRow, {
                  key: item.key + ':' + item.sessionId,
                  session: item,
                  onUpdated: () => loadAll(true),
                  onError: (e) => showToast(e, 'err'),
                }),
              )
            : h(
                StateView,
                { kind: 'empty', title: '尚無對應會話' },
                '正式回覆模式下，收到需要回覆的訊息後會自動建立。',
              ),
        ),
      ];
    if (section === 'user' || section === 'bot') {
      return [
        h(TransportCard, {
          key: 'transport',
          kind: section,
          info: transportInfo[section],
          status: status?.[section],
          config,
          draft,
          setValue,
          fields,
          onLogin: login,
          onLogout: logout,
          onNavigate: go,
          busy: Boolean(busy[section]),
        }),
        section === 'bot' && draft.botNativeInteractions && !draft.botSlashCommands
          ? h(
              'div',
              { key: 'native-hint', className: 'dpl-note', 'data-tone': 'warn', role: 'note' },
              h('div', { className: 'dpl-note-title' }, '原生互動還需要註冊斜線指令'),
              h(
                'div',
                { className: 'dpl-note-body' },
                '「原生互動與訊息右鍵選單」已開啟，但「註冊斜線指令」是關閉的，Discord 上不會出現指令入口。請在下方「互動功能」一併開啟並儲存，再重新登入機器人；全域指令同步可能需要一段時間。',
              ),
            )
          : null,
        section === 'user'
          ? h(UserConversationDesk, {
              key: 'user-desk',
              status: status?.user,
              adminUserId: config.adminUserId,
            })
          : null,
        section === 'user'
          ? h(UserPresenceCard, {
              key: 'user-presence',
              fields: fieldsOf('user').filter((f) => appearanceKeys.has(f.key)),
              config,
              draft,
              setValue,
              dirtyKeys,
              status: status?.user,
              onRefresh: () => loadAll(true),
            })
          : null,
        fieldCard(section, section === 'user' ? '使用者帳號設定' : '機器人設定', section),
      ];
    }
    if (section === 'log') {
      return [
        fieldCard('log', '記錄設定', 'log'),
        h(LogPanel, {
          key: 'logs',
          logs,
          level: logLevel,
          setLevel: setLogLevel,
          onRefresh: refreshLogs,
          onClear: clearLogs,
        }),
      ];
    }
    if (section === 'channelActions')
      return [
        fieldCard('channelActions', '訊息操作設定', 'chat'),
        h(ChannelActionsPanel, { key: 'channel-actions', config, onNavigate: go }),
      ];
    if (section === 'history') {
      return [
        fieldCard('history', '聊天快取設定', 'history'),
        h(HistoryPanel, {
          key: 'hist',
          channels,
          historyStats,
          messages: historyMessages,
          activeChannel,
          onOpen: openChannel,
          onClear: () => clearHistory(null),
          onClearChannel: (channelId) => clearHistory(channelId),
        }),
      ];
    }
    if (section === 'gif') {
      return [fieldCard('gif', 'GIF 設定', 'gif'), h(GifPanel, { key: 'gif', config })];
    }
    if (section === 'llm') {
      return [
        fieldCard('llm', '模型設定', 'model'),
        h(ModelTest, { key: 'test', providers, draft: config, onTest: testModel, busy: testBusy, lastTest }),
      ];
    }
    if (section === 'topics') return [h(ConversationTopics, { key: 'conversation-topics' })];
    if (section === 'reaction')
      return [
        fieldCard('reaction', '反應與表情圖片', 'reaction'),
        h(MemeImagesPanel, { key: 'meme-images', onNavigate: go }),
      ];
    if (section === 'capabilities') return [h(CapabilitiesPanel, { key: 'capabilities', onNavigate: go })];
    if (section === 'singing')
      return [
        fieldCard('singing', '唱歌工作設定', 'voice'),
        h(SingingGuide, { key: 'singing-guide', onNavigate: go }),
      ];
    if (section === 'companion')
      return [
        fieldCard('companion', '陪伴與安靜時段', 'chat'),
        h(InteractionConsole, { key: 'interaction-console', onNavigate: go }),
      ];
    if (section === 'people') {
      const pick = (keys) => keys.map((key) => fields.find((field) => field.key === key)).filter(Boolean);
      const count = (key) => (Array.isArray(draft[key]) ? draft[key].length : 0);
      // 其他功能各自的名單：留在原本的分區，這裡列出目前人數／頻道數並提供前往。
      const elsewhere = [
        ['othersGroup', 'othersGroup_monitoredChannelIds', '參與閒聊的頻道（其他使用者・群聊）', 'othersGroup'],
        ['adminGroup', 'adminGroup_monitoredChannelIds', '參與閒聊的頻道（管理者・群聊）', 'adminGroup'],
        ['reaction', 'reactionControlUserIds', '可以用表情操作別人訊息的使用者', 'reaction'],
        ['voice', 'voiceReceiveUserIds', '語音房收聽哪些成員', 'voice'],
        ['voice', 'voiceMessageUserIds', '哪些成員可以用語音訊息', 'voice'],
        ['voice', 'voiceAllowedChannelIds', '允許加入的語音頻道', 'voice'],
        ['singing', 'singingAllowedUserIds', '哪些群友可以請 AI 唱歌', 'singing'],
        ['culture', 'cultureChorusChannelIds', '可以接龍的頻道', 'culture'],
        ['memoryOutput', 'memoryGroupChannelIds', '收集哪些群聊頻道做日記', 'memoryOutput'],
      ].filter(([, key]) => fields.some((field) => field.key === key));
      return [
        h(
          Card,
          {
            key: 'people-who',
            title: '誰可以跟 AI 互動',
            icon: 'user',
            desc: '設定裡存的是 Discord ID，畫面上會顯示名稱。可以直接從「最近說過話的人」挑選，不必手動複製 ID。判斷順序：黑名單 → 管理者 → 白名單。',
          },
          h(FieldList, {
            fields: pick(['adminUserId', 'whitelistUserIds', 'blacklistUserIds', 'replyCooldownExemptUserIds']),
            config,
            draft,
            setValue,
            dirtyKeys,
            flat: true,
          }),
          h(
            'div',
            { className: 'dpl-row-help', style: { marginTop: 8 } },
            '管理者也可以從清單選：',
            h(UserIdPicker, {
              single: true,
              value: draft.adminUserId || '',
              onChange: (id) => setValue('adminUserId', id),
            }),
          ),
        ),
        h(
          Card,
          {
            key: 'people-where',
            title: '在哪裡回覆',
            icon: 'chat',
            desc: '限制 AI 只在特定伺服器回覆，或排除某些頻道。主動插話的頻道另外在「對象設定」指定。',
          },
          h(FieldList, {
            fields: pick(['monitoredGuildIds', 'blacklistChannelIds']),
            config,
            draft,
            setValue,
            dirtyKeys,
            flat: true,
          }),
        ),
        h(
          Card,
          {
            key: 'people-elsewhere',
            title: '其他功能自己的名單',
            icon: 'settings',
            desc: '這些名單只影響單一功能，設定留在各自的頁面。',
          },
          elsewhere.map(([, key, label, target]) =>
            h(
              'div',
              { className: 'dpl-list-row', key, 'data-people-link': key },
              h('span', { className: 'dpl-grow' }, label),
              h(Pill, { tone: count(key) ? 'ok' : 'muted' }, count(key) ? count(key) + ' 項' : '未設定'),
              h('button', { type: 'button', className: 'dpl-btn dpl-btn-sm', onClick: () => go(target) }, '前往'),
            ),
          ),
        ),
      ];
    }
    if (section === 'general')
      return [
        fieldCard(
          'general',
          '基本設定',
          'settings',
          '總開關、管理者，以及同時連線使用者帳號與機器人時由哪個帳號負責回覆。',
        ),
      ];
    return [fieldCard(section, currentSection?.label || section, currentSection?.icon || 'settings')];
  };

  if (loading)
    return h('div', { className: 'dpl' }, h(StateView, { kind: 'loading', title: '載入 Discord 賽博群友…' }));

  if (error && !status) {
    return h(
      'div',
      { className: 'dpl' },
      h(
        StateView,
        {
          kind: 'error',
          title: '無法載入 Discord 賽博群友的設定',
          action: h(
            'button',
            { type: 'button', className: 'dpl-btn dpl-btn-primary', onClick: () => loadAll(false) },
            '重試',
          ),
        },
        error,
      ),
    );
  }

  const query = settingsQuery.trim();
  const matchesSettings = (field) => {
    const texts = [field.label, field.help, sections.find((x) => x.id === field.section)?.label || ''];
    const q = query.toLocaleLowerCase();
    return [texts.join(' '), texts.map((text) => uiLocale.convert(text || '')).join(' ')].some((text) =>
      text.toLocaleLowerCase().includes(q),
    );
  };
  const found = query ? fields.filter(matchesSettings) : [];
  const statusPill = (kind, label) => {
    const s = status?.[kind];
    return h(
      'button',
      {
        type: 'button',
        className: 'dpl-pill',
        'data-tone': s?.ok ? 'ok' : s?.state === 'error' ? 'err' : 'muted',
        title: '前往' + label + '設定',
        onClick: () => go(kind),
      },
      h('span', { className: 'dpl-dot' }),
      label + ' ' + (s?.ok ? s.user?.tag || '已連線' : s?.state === 'error' ? '錯誤' : '未連線'),
    );
  };
  // 四個對象分區在導覽上合併為一個「對象設定」。
  const groupSections = sections.filter((item) => item.group === activeGroup);
  const navItems = [];
  for (const item of groupSections) {
    if (AUDIENCE_SECTIONS.includes(item.id)) {
      if (!navItems.some((entry) => entry.id === 'audience'))
        navItems.push({
          id: 'audience',
          label: '對象設定',
          icon: 'chat',
          target: isAudience ? section : 'adminDm',
        });
    } else navItems.push({ ...item, target: item.id });
  }
  const masterKey = { user: 'userEnabled', bot: 'botEnabled', general: 'enabled', voice: 'voiceEnabled' };
  const dirtyLabels = dirtyKeys
    .slice(0, 4)
    .map((key) => fields.find((field) => field.key === key)?.label || key)
    .join('、');

  return h(
    'div',
    { className: 'dpl' },
    h(
      'header',
      { className: 'dpl-top' },
      h(
        'div',
        { className: 'dpl-top-title' },
        h('div', { className: 'dpl-logo' }, Icon.hub({ size: 20 })),
        h(
          'div',
          null,
          h('h1', null, 'Discord 賽博群友'),
          h(
            'p',
            { className: 'dpl-sub' },
            '讓 DSH 化身群友：透過使用者帳號或機器人在 Discord 聊天、互動與語音',
          ),
        ),
      ),
      h(
        'div',
        { className: 'dpl-actions' },
        statusPill('user', '使用者'),
        statusPill('bot', '機器人'),
        h(UiLanguagePicker),
        h(
          'button',
          { type: 'button', className: 'dpl-btn dpl-btn-sm dpl-btn-ghost', onClick: () => loadAll(false) },
          Icon.refresh({ size: 13 }),
          '重新整理',
        ),
      ),
    ),

    error
      ? h('div', { className: 'dpl-note', 'data-tone': 'err', role: 'alert' }, '更新狀態失敗：' + error)
      : null,
    draft.enabled === false
      ? h(
          'div',
          { className: 'dpl-note', 'data-tone': 'warn', role: 'note' },
          '總開關目前關閉，兩種帳號都不會收發訊息。可在「開始 → 基本設定」開啟。',
        )
      : null,

    h(
      'div',
      { className: 'dpl-navwrap' },
      h(
        'div',
        { className: 'dpl-navbar' },
        h(
          'div',
          { className: 'dpl-groups', role: 'tablist', 'aria-label': '設定群組' },
          groups.map((group) =>
            h(
              'button',
              {
                key: group.id,
                type: 'button',
                role: 'tab',
                className: 'dpl-group',
                'data-group': group.id,
                'data-active': !query && activeGroup === group.id ? 'true' : 'false',
                'aria-selected': !query && activeGroup === group.id,
                title: group.desc,
                onClick: () => {
                  if (activeGroup !== group.id || query)
                    go(sections.find((item) => item.group === group.id)?.id || section);
                },
              },
              iconFor(group.icon)({ size: 15 }),
              group.label,
            ),
          ),
        ),
        h('input', {
          className: 'dpl-input dpl-search',
          type: 'search',
          value: settingsQuery,
          placeholder: '搜尋設定，例如：人格、GIF、管理者',
          'aria-label': '搜尋設定',
          onChange: (e) => setSettingsQuery(e.target.value),
        }),
      ),
      query
        ? null
        : h(
            'nav',
            { className: 'dpl-section-modules', 'aria-label': '設定分區' },
            navItems.map((item) => {
              const active = item.id === 'audience' ? isAudience : section === item.id;
              const master = masterKey[item.id];
              return h(
                'button',
                {
                  key: item.id,
                  type: 'button',
                  className: 'dpl-nav-item',
                  'data-section': item.id,
                  'data-active': active ? 'true' : 'false',
                  'aria-pressed': active,
                  onClick: () => go(item.target),
                },
                iconFor(item.icon)({ size: 14 }),
                item.label,
                master
                  ? h('span', {
                      className: 'dpl-nav-dot',
                      'data-off': draft[master] ? 'false' : 'true',
                      title: draft[master] ? '已啟用' : '未啟用',
                    })
                  : null,
              );
            }),
          ),
    ),

    h(
      'div',
      { className: 'dpl-layout' },
      h(
        'main',
        { className: 'dpl-content' },
        // 素材庫保持掛載，切換分區時不會遺失尚未儲存的編輯內容。
        h(
          'div',
          { hidden: section !== 'culture' || !!query },
          h(AssetLibrary, { onError: (e) => showToast(e, 'err') }),
        ),
        query
          ? h(
              Card,
              {
                title: '搜尋結果',
                desc: found.length ? '共 ' + found.length + ' 項，涵蓋所有分區。' : undefined,
              },
              found.length
                ? h(FieldList, { fields: found, config, draft, setValue, dirtyKeys, flat: true })
                : h(
                    StateView,
                    { kind: 'empty', title: '找不到符合的設定' },
                    '請換個關鍵字，或清空搜尋回到分區。',
                  ),
            )
          : renderSection(),
      ),
    ),

    dirtyKeys.length
      ? h(
          'div',
          { className: 'dpl-savebar', role: 'region', 'aria-label': '未儲存的變更' },
          h(
            'div',
            { className: 'dpl-savebar-text' },
            h('strong', null, '有 ' + dirtyKeys.length + ' 項設定尚未儲存'),
            h('span', { className: 'dpl-savebar-keys' }, dirtyLabels + (dirtyKeys.length > 4 ? '…' : '')),
            showChanges
              ? h(ChangeList, {
                  fields,
                  rows: dirtyKeys.map((key) => ({ key, from: config[key], to: draft[key] })),
                })
              : null,
          ),
          h(
            'div',
            { className: 'dpl-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'dpl-btn',
                'data-action': 'toggle-changes',
                'aria-expanded': showChanges,
                onClick: () => setShowChanges((value) => !value),
              },
              showChanges ? '收合變更' : '查看變更',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dpl-btn',
                disabled: Boolean(busy.save),
                onClick: () => setDraft({ ...config }),
              },
              '放棄變更',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dpl-btn dpl-btn-primary',
                disabled: Boolean(busy.save),
                onClick: save,
              },
              Icon.save({ size: 13 }),
              busy.save ? '儲存中…' : '儲存變更 (' + dirtyKeys.length + ')',
            ),
          ),
        )
      : null,

    h(
      'div',
      { className: 'dpl-foot' },
      h('span', null, '今日 ' + (stats.date || '-') + ' · 錯誤 ' + (stats.errors || 0) + ' 次'),
      h('span', null, dirtyKeys.length ? '' : '所有設定皆已儲存'),
    ),

    toast
      ? h('div', { className: 'dpl-toast', 'data-tone': toast.tone, role: 'status' }, toast.message)
      : null,
  );
}
