// -------------------------------------------------------------- registration ---
function CompactPluginCard() {
  useUiLanguage();
  return h(
    'div',
    { className: 'dpl-plugin-summary', style: { padding: '8px 0', fontSize: 13, lineHeight: 1.6 } },
    h('strong', null, 'Discord 賽博群友'),
    h('p', { style: { margin: '4px 0', opacity: 0.7 } }, '讓 DSH 化身群友，在 Discord 聊天、互動與語音。'),
  );
}

// 插件頁「設定」掛載點：只給前往完整設定頁的指引，不重複簡介。
function CompactConfigHint() {
  useUiLanguage();
  return h(
    'div',
    {
      className: 'dpl-plugin-summary',
      style: { padding: '8px 0', fontSize: 13, lineHeight: 1.6, opacity: 0.8 },
    },
    '所有設定都在「設定 → Discord 賽博群友」：左下角帳號選單 → 設定，再從左側清單開啟。',
  );
}

function apply(ctx) {
  ensureStyles();
  const slots = (typeof ctx.get === 'function' ? ctx.get('slots') : undefined) || ctx.slots;
  if (!slots) return;

  const register = (slotName, options, Component = CompactPluginCard) => {
    try {
      if (typeof slots.inject === 'function') {
        slots.inject(slotName, () => slots.register({ name: slotName, ...options }, Component));
      } else if (typeof slots.register === 'function') {
        slots.register({ name: slotName, ...options }, Component);
      }
    } catch (error) {
      console.error('[dsh-discord-cyberfriend] 註冊 slot 失敗', slotName, error);
    }
  };

  const label = () => 'Discord 賽博群友';
  register('settings.section', { id: 'discord-cyberfriend', order: 34, label }, DiscordHubPanel);
  register('settings.plugins.tab', { id: 'discord-cyberfriend', order: 34, label });
  register('plugins.item', { id: 'discord-cyberfriend', order: 34, label });
  register(
    'plugins.row.config',
    {
      id: 'discord-cyberfriend',
      key: 'dsh-discord-cyberfriend#discord-cyberfriend',
      order: 34,
      label: () => 'Discord 賽博群友設定',
    },
    CompactConfigHint,
  );
  register(
    'plugins.bundle.config',
    {
      id: 'discord-cyberfriend',
      key: 'dsh-discord-cyberfriend',
      order: 34,
      label: () => 'Discord 賽博群友設定',
    },
    CompactConfigHint,
  );
}
