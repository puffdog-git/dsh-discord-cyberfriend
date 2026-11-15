// 從已連線帳號的伺服器與頻道清單挑選 ID，取代手動複製貼上。
//
// uiRuntime 由主面板每次繪製時更新：目前已連線的帳號、已知的 ID→名稱對照、
// 宿主可用的模型服務。它只是顯示用的快取，不會被儲存。
const uiRuntime = { kinds: [], names: new Map(), providers: [] };

// 設定裡存的是 ID；畫面上盡量顯示名稱。查不到名稱時顯示 ID 本身。
const nameOfId = (id) => uiRuntime.names.get(String(id)) || String(id);
const looksLikeId = (value) => typeof value === 'string' && /^\d{17,20}$/.test(value);
// 畫面要顯示某些 ID 時呼叫：還不認得的 ID 向後端查一次名稱（只查本機快取），查到後重繪。
const askedIdNames = new Set();
function useIdNames(ids) {
  const [, bump] = useState(0);
  const key = [...new Set((ids || []).map(String).filter(looksLikeId))].sort().join(',');
  useEffect(() => {
    const unknown = key.split(',').filter((id) => id && !uiRuntime.names.has(id) && !askedIdNames.has(id));
    if (!unknown.length) return undefined;
    for (const id of unknown) askedIdNames.add(id);
    let alive = true;
    api('/names', { method: 'POST', body: { ids: unknown.slice(0, 500) } })
      .then((payload) => {
        let added = 0;
        for (const [id, name] of Object.entries(payload.names || {}))
          if (name) {
            uiRuntime.names.set(id, name);
            added += 1;
          }
        if (added && alive) bump((n) => n + 1);
      })
      .catch(() => {
        // 查不到名稱時維持顯示 ID，不影響其他功能。
      });
    return () => {
      alive = false;
    };
  }, [key]);
}
// 從設定值裡找出所有像 Discord ID 的字串（清單欄位與單一欄位）。
function collectIds(...sources) {
  const found = new Set();
  for (const source of sources)
    for (const value of Object.values(source || {})) {
      if (looksLikeId(value)) found.add(value);
      else if (Array.isArray(value)) for (const item of value) if (looksLikeId(item)) found.add(item);
    }
  return [...found];
}

const isVoiceChannel = (channel) => ['2', '13', 'voice', 'stage'].includes(String(channel.type));
const isCategory = (channel) => ['4', 'category'].includes(String(channel.type));
const channelPrefix = (channel) =>
  isVoiceChannel(channel)
    ? '🔊 '
    : ['15', '16', 'forum', 'media'].includes(String(channel.type))
      ? '💬 '
      : '# ';

// 哪些設定欄位可以用清單挑選：頻道 ID、伺服器 ID，以及使用者 ID（來源是「最近說過話的人」）。
function pickerKindFor(fieldKey) {
  const base = String(fieldKey).replace(/^(adminDm|adminGroup|othersDm|othersGroup)_/, '');
  if (/UserIds$/.test(base)) return 'user';
  if (/GuildIds$/.test(base)) return 'guild';
  if (/ChannelIds$/.test(base) || base === 'channelForwardDestinationIds')
    return /^voiceAllowed/.test(base) ? 'voice' : 'channel';
  return '';
}

// 使用者 ID：從聊天快取裡最近說過話的人挑選。不需要帳號連線，但要有收過訊息。
function UserIdPicker({ value, onChange, single }) {
  const list = Array.isArray(value) ? value : value ? [String(value)] : [];
  const [open, setOpen] = useState(false);
  const [authors, setAuthors] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const load = async () => {
    setError('');
    setAuthors(null);
    try {
      const rows = (await api('/recent-authors')).authors || [];
      for (const row of rows) uiRuntime.names.set(String(row.id), row.name);
      setAuthors(rows);
    } catch (err) {
      setAuthors([]);
      setError(err.message);
    }
  };
  if (!open)
    return h(
      'button',
      {
        type: 'button',
        className: 'dpl-btn dpl-btn-sm',
        'data-picker': 'user',
        onClick: () => {
          setOpen(true);
          load();
        },
      },
      '從最近說過話的人選擇',
    );
  const needle = query.trim().toLowerCase();
  const shown = (authors || []).filter(
    (row) => !needle || row.name.toLowerCase().includes(needle) || row.id.includes(needle),
  );
  const toggle = (id) => {
    if (single) return onChange(list.includes(id) ? '' : id);
    onChange(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  };
  return h(
    'div',
    { className: 'dpl-picker', 'data-picker-open': 'user' },
    h(
      'div',
      { className: 'dpl-actions' },
      h('input', {
        className: 'dpl-input',
        type: 'search',
        'aria-label': '搜尋名稱或 ID',
        placeholder: '搜尋名稱或 ID',
        value: query,
        onChange: (event) => setQuery(event.target.value),
      }),
      h('button', { type: 'button', className: 'dpl-btn dpl-btn-sm', onClick: load }, '重新整理'),
      h(
        'button',
        { type: 'button', className: 'dpl-btn dpl-btn-sm dpl-btn-ghost', onClick: () => setOpen(false) },
        '收合',
      ),
    ),
    error
      ? h('div', { className: 'dpl-note', 'data-tone': 'err', role: 'alert' }, '讀取清單失敗：' + error)
      : null,
    authors === null
      ? h('div', { className: 'dpl-row-help', role: 'status' }, '讀取中…')
      : shown.length
        ? h(
            'div',
            { className: 'dpl-actions' },
            shown.map((row) =>
              h(
                'button',
                {
                  key: row.id,
                  type: 'button',
                  className: 'dpl-btn dpl-btn-sm',
                  'data-on': list.includes(row.id),
                  'aria-pressed': list.includes(row.id),
                  title: row.id,
                  onClick: () => toggle(row.id),
                },
                row.name,
              ),
            ),
          )
        : h(
            'div',
            { className: 'dpl-row-help' },
            authors.length
              ? '沒有符合搜尋的人。'
              : '聊天快取裡還沒有其他人的訊息。帳號連線並收到訊息後，這裡會列出最近說過話的人；也可以直接手動填 ID。',
          ),
    h(
      'div',
      { className: 'dpl-row-help' },
      '清單來自本機的聊天快取，只包含這個插件收過訊息的人。點一下加入，再點一次移除。',
    ),
  );
}

function IdPicker({ kind, value, onChange }) {
  if (kind === 'user') return h(UserIdPicker, { value, onChange });
  return h(GuildChannelPicker, { kind, value, onChange });
}

function GuildChannelPicker({ kind, value, onChange }) {
  const list = Array.isArray(value) ? value : [];
  const [open, setOpen] = useState(false);
  const [transport, setTransport] = useState('');
  const [guilds, setGuilds] = useState([]);
  const [guildId, setGuildId] = useState('');
  const [channels, setChannels] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const kinds = uiRuntime.kinds;
  const active = kinds.includes(transport) ? transport : kinds[0] || '';

  const loadGuilds = async (which) => {
    setLoading(true);
    setError('');
    try {
      const payload = await api('/guilds?transport=' + encodeURIComponent(which));
      const rows = payload.guilds || [];
      for (const guild of rows) uiRuntime.names.set(String(guild.id), guild.name);
      setGuilds(rows);
    } catch (err) {
      setGuilds([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const loadChannels = async (which, guild) => {
    setChannels(null);
    if (!guild) return;
    setLoading(true);
    setError('');
    try {
      const payload = await api('/channels?' + new URLSearchParams({ transport: which, guildId: guild, ...(kind === 'voice' ? { includeVoice: '1' } : {}) }));
      const rows = (payload.channels || []).filter((channel) => !isCategory(channel));
      for (const channel of rows) uiRuntime.names.set(String(channel.id), channel.name);
      setChannels(rows);
    } catch (err) {
      setChannels([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const toggle = (id) => {
    const key = String(id);
    onChange(list.includes(key) ? list.filter((item) => item !== key) : [...list, key]);
  };

  if (!kinds.length)
    return h(
      'span',
      { className: 'dpl-row-help' },
      '帳號連線後，可以直接從伺服器清單挑選，不必手動複製 ID。',
    );
  if (!open)
    return h(
      'button',
      {
        type: 'button',
        className: 'dpl-btn dpl-btn-sm',
        'data-picker': kind,
        onClick: () => {
          setOpen(true);
          loadGuilds(active);
        },
      },
      kind === 'guild' ? '從伺服器清單選擇' : '從頻道清單選擇',
    );

  const shown = (channels || []).filter((channel) => (kind === 'voice' ? isVoiceChannel(channel) : true));
  const chip = (id, label) =>
    h(
      'button',
      {
        key: id,
        type: 'button',
        className: 'dpl-btn dpl-btn-sm',
        'data-on': list.includes(String(id)),
        'aria-pressed': list.includes(String(id)),
        title: String(id),
        onClick: () => toggle(id),
      },
      label,
    );
  return h(
    'div',
    { className: 'dpl-picker', 'data-picker-open': kind },
    h(
      'div',
      { className: 'dpl-actions' },
      kinds.length > 1
        ? h(
            'div',
            { className: 'dpl-seg', role: 'group', 'aria-label': '使用哪個帳號的清單' },
            kinds.map((which) =>
              h(
                'button',
                {
                  key: which,
                  type: 'button',
                  'data-on': active === which,
                  'aria-pressed': active === which,
                  onClick: () => {
                    setTransport(which);
                    setGuildId('');
                    setChannels(null);
                    loadGuilds(which);
                  },
                },
                which === 'bot' ? '機器人' : '使用者帳號',
              ),
            ),
          )
        : null,
      kind === 'guild'
        ? null
        : h(
            'select',
            {
              className: 'dpl-select',
              'aria-label': '伺服器',
              value: guildId,
              onChange: (event) => {
                setGuildId(event.target.value);
                loadChannels(active, event.target.value);
              },
            },
            [
              h('option', { key: '', value: '' }, guilds.length ? '選擇伺服器' : '沒有可用的伺服器'),
              ...guilds.map((guild) => h('option', { key: guild.id, value: guild.id }, guild.name)),
            ],
          ),
      h(
        'button',
        { type: 'button', className: 'dpl-btn dpl-btn-sm dpl-btn-ghost', onClick: () => setOpen(false) },
        '收合',
      ),
    ),
    loading ? h('div', { className: 'dpl-row-help', role: 'status' }, '讀取中…') : null,
    error
      ? h('div', { className: 'dpl-note', 'data-tone': 'err', role: 'alert' }, '讀取清單失敗：' + error)
      : null,
    kind === 'guild'
      ? h(
          'div',
          { className: 'dpl-actions' },
          guilds.map((guild) => chip(guild.id, guild.name)),
        )
      : channels === null
        ? guildId
          ? null
          : h('div', { className: 'dpl-row-help' }, '先選擇伺服器，再點選要加入的頻道；再點一次可移除。')
        : shown.length
          ? h(
              'div',
              { className: 'dpl-actions' },
              shown.map((channel) => chip(channel.id, channelPrefix(channel) + channel.name)),
            )
          : h(
              'div',
              { className: 'dpl-row-help' },
              kind === 'voice' ? '這個伺服器沒有可見的語音頻道。' : '這個伺服器沒有可見的頻道。',
            ),
  );
}
