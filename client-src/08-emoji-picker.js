// 表情選擇器：看圖點選，不必手動輸入表情或複製自訂表情代碼。
//
// 設定裡存的仍是文字：一般表情存字元本身，伺服器自訂表情存 Discord 的代碼 <:名稱:ID>（動態為 <a:名稱:ID>）。

// 「常用」分類：挑出最常拿來按反應的表情。完整清單（約 1,700 個，依類別分組）在 08a-emoji-data.js，
// 由 scripts/gen-emoji-data.mjs 產生。
const COMMON_EMOJI_GROUPS = [
  ['常用反應', '👍 👎 ❤️ 🔥 😂 🤣 😭 😮 😡 🙏 👏 🎉 💯 ✅ ❌ 👀 🤔 🫡 🤝 💀'],
  ['開心與喜歡', '😀 😄 😁 😆 😊 🥰 😍 😘 🤩 🥳 😎 🤗 😋 😜 🤪 😇 🙂 😉 😌 🥹'],
  ['難過與驚訝', '😢 😥 😞 😔 😩 😫 🥺 😱 😨 😳 🤯 😵 😬 🙄 😤 😠 🤬 😐 😑 😶'],
  ['手勢', '👌 ✌️ 🤞 🤟 🤘 👋 🙌 🫶 💪 🤙 👉 👈 👆 👇 ✋ 🤚 🫰 🤏 ✍️ 🫵'],
  ['符號', '💖 💕 💔 ⭐ 🌟 ✨ ⚡ 💤 💢 💬 ❓ ❗ ⁉️ ➕ ➖ 🔁 ⏹️ 🔍 🆗 🆒'],
  ['動物與食物', '🐱 🐶 🐟 🐧 🐸 🐼 🐰 🦊 🐻 🐷 🍰 🍣 🍜 🍺 ☕ 🍵 🍕 🍔 🍙 🧋'],
  ['活動與物品', '🎮 🎵 🎶 🎤 🎧 📷 💻 📱 📚 ✏️ 🎁 🏆 🥇 ⚽ 🎯 🚀 🌈 ☀️ 🌙 ☔'],
].map(([name, list]) => [name, list.split(' ')]);

const CUSTOM_EMOJI = /^<(a?):(\w+):(\d+)>$/;
// 把設定裡的表情文字畫出來：自訂表情顯示圖片，其餘直接顯示字元。
function emojiView(code, size = 20) {
  const custom = CUSTOM_EMOJI.exec(String(code));
  if (!custom) return String(code);
  return h('img', {
    src: 'https://cdn.discordapp.com/emojis/' + custom[3] + '.' + (custom[1] ? 'gif' : 'webp') + '?size=48',
    alt: ':' + custom[2] + ':',
    title: ':' + custom[2] + ':',
    width: size,
    height: size,
    loading: 'lazy',
    style: { verticalAlign: 'middle' },
  });
}

// 哪些欄位是「表情清單」：自動加表情的表情池、觸發指令的表情（含各對象的同名欄位）。
function isEmojiListField(fieldKey) {
  return /Emojis$/.test(String(fieldKey).replace(/^(adminDm|adminGroup|othersDm|othersGroup)_/, ''));
}

function EmojiPicker({ value, onChange }) {
  const list = Array.isArray(value) ? value : [];
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('common');
  // 一般表情一次只顯示一個分類，避免一口氣畫出上千個按鈕。
  const [group, setGroup] = useState('常用');
  const emojiGroups = [['常用', COMMON_EMOJI_GROUPS.flatMap(([, items]) => items)], ...ALL_EMOJI_GROUPS];
  const [transport, setTransport] = useState('');
  const [guilds, setGuilds] = useState([]);
  const [guildId, setGuildId] = useState('');
  const [emojis, setEmojis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const kinds = uiRuntime.kinds;
  const active = kinds.includes(transport) ? transport : kinds[0] || '';
  const toggle = (code) => onChange(list.includes(code) ? list.filter((item) => item !== code) : [...list, code]);

  const loadGuilds = async (which) => {
    setLoading(true);
    setError('');
    try {
      const rows = (await api('/guilds?transport=' + encodeURIComponent(which))).guilds || [];
      for (const guild of rows) uiRuntime.names.set(String(guild.id), guild.name);
      setGuilds(rows);
    } catch (err) {
      setGuilds([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const loadEmojis = async (which, guild) => {
    setEmojis(null);
    if (!guild) return;
    setLoading(true);
    setError('');
    try {
      setEmojis((await api('/emojis?' + new URLSearchParams({ transport: which, guildId: guild }))).emojis || []);
    } catch (err) {
      setEmojis([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const cell = (code, label, disabled) =>
    h(
      'button',
      {
        key: code,
        type: 'button',
        className: 'dpl-emoji-cell',
        'data-on': list.includes(code),
        'aria-pressed': list.includes(code),
        'aria-label': label,
        title: label,
        disabled,
        onClick: () => toggle(code),
      },
      emojiView(code, 24),
    );

  if (!open)
    return h(
      'button',
      { type: 'button', className: 'dpl-btn dpl-btn-sm', 'data-picker': 'emoji', onClick: () => setOpen(true) },
      '看圖選擇表情',
    );
  return h(
    'div',
    { className: 'dpl-picker', 'data-picker-open': 'emoji' },
    h(
      'div',
      { className: 'dpl-actions' },
      h(
        'div',
        { className: 'dpl-seg', role: 'group', 'aria-label': '表情來源' },
        h(
          'button',
          { type: 'button', 'data-on': tab === 'common', 'aria-pressed': tab === 'common', onClick: () => setTab('common') },
          '一般表情',
        ),
        h(
          'button',
          {
            type: 'button',
            'data-on': tab === 'guild',
            'aria-pressed': tab === 'guild',
            'data-emoji-tab': 'guild',
            onClick: () => {
              setTab('guild');
              if (active && !guilds.length) loadGuilds(active);
            },
          },
          '伺服器自訂表情',
        ),
      ),
      h(
        'button',
        { type: 'button', className: 'dpl-btn dpl-btn-sm dpl-btn-ghost', onClick: () => setOpen(false) },
        '收合',
      ),
    ),
    tab === 'common'
      ? [
          h(
            'div',
            { className: 'dpl-actions', key: 'groups', role: 'group', 'aria-label': '表情分類' },
            emojiGroups.map(([name, items]) =>
              h(
                'button',
                {
                  key: name,
                  type: 'button',
                  className: 'dpl-btn dpl-btn-sm',
                  'data-emoji-group': name,
                  'data-on': group === name,
                  'aria-pressed': group === name,
                  onClick: () => setGroup(name),
                },
                name + ' ' + items.length,
              ),
            ),
          ),
          h(
            'div',
            { className: 'dpl-emoji-grid', key: 'grid', 'data-emoji-grid': group },
            (emojiGroups.find(([name]) => name === group) || emojiGroups[0])[1].map((item) => cell(item, item)),
          ),
          h(
            'div',
            { className: 'dpl-row-help', key: 'more' },
            '這裡列出 Discord 內建的一般表情。膚色變化與多人組合沒有列出，需要的話可以直接貼到上面的輸入框。',
          ),
        ]
      : !kinds.length
        ? h('div', { className: 'dpl-row-help' }, '帳號連線後，才能讀取伺服器的自訂表情。')
        : [
            h(
              'div',
              { className: 'dpl-actions', key: 'pick' },
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
                            setEmojis(null);
                            loadGuilds(which);
                          },
                        },
                        which === 'bot' ? '機器人' : '使用者帳號',
                      ),
                    ),
                  )
                : null,
              h(
                'select',
                {
                  className: 'dpl-select',
                  'aria-label': '表情所在的伺服器',
                  value: guildId,
                  onChange: (event) => {
                    setGuildId(event.target.value);
                    loadEmojis(active, event.target.value);
                  },
                },
                [
                  h('option', { key: '', value: '' }, guilds.length ? '選擇伺服器' : '沒有可用的伺服器'),
                  ...guilds.map((guild) => h('option', { key: guild.id, value: guild.id }, guild.name)),
                ],
              ),
            ),
            loading ? h('div', { className: 'dpl-row-help', role: 'status', key: 'loading' }, '讀取中…') : null,
            error
              ? h('div', { className: 'dpl-note', 'data-tone': 'err', role: 'alert', key: 'error' }, '讀取表情失敗：' + error)
              : null,
            emojis === null
              ? guildId
                ? null
                : h('div', { className: 'dpl-row-help', key: 'hint' }, '先選擇伺服器，再點選要加入的表情；再點一次可移除。')
              : emojis.length
                ? h(
                    'div',
                    { className: 'dpl-emoji-grid', key: 'grid' },
                    emojis.map((emoji) =>
                      cell(emoji.code, ':' + emoji.name + ':' + (emoji.available ? '' : '（目前無法使用）'), !emoji.available),
                    ),
                  )
                : h('div', { className: 'dpl-row-help', key: 'empty' }, '這個伺服器沒有自訂表情。'),
            h(
              'div',
              { className: 'dpl-note', 'data-tone': 'warn', role: 'note', key: 'nitro', 'data-emoji-nitro-note': '1' },
              h('div', { className: 'dpl-note-title' }, '自訂表情只能在原本的伺服器使用'),
              h(
                'div',
                { className: 'dpl-note-body' },
                '使用者帳號沒有訂閱 Nitro 時，不能把某個伺服器的自訂表情用到別的伺服器；機器人則只能使用它自己加入的伺服器的表情。在其他伺服器輪到這類表情時會加不上去，建議表情池裡至少保留幾個一般表情。',
              ),
            ),
          ],
    h(
      'div',
      { className: 'dpl-row-help' },
      list.length ? '已選 ' + list.length + ' 個。點一下加入，再點一次移除。' : '目前沒有選任何表情。點一下加入，再點一次移除。',
    ),
  );
}
