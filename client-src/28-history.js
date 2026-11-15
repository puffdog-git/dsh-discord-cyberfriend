function HistoryPanel({ channels, historyStats, onOpen, onClear, messages, activeChannel, onClearChannel }) {
  // 全部清除無法復原：第一次按下只切換成確認狀態，五秒內再按一次才真的清除。
  const [confirmAll, setConfirmAll] = useState(false);
  useEffect(() => {
    if (!confirmAll) return undefined;
    const timer = setTimeout(() => setConfirmAll(false), 5000);
    return () => clearTimeout(timer);
  }, [confirmAll]);
  const actions = activeChannel
    ? [
        h(
          'button',
          {
            key: 'back',
            type: 'button',
            className: 'dpl-btn dpl-btn-sm dpl-btn-ghost',
            onClick: () => onOpen(null),
          },
          '返回清單',
        ),
        h(
          'button',
          {
            key: 'clear',
            type: 'button',
            className: 'dpl-btn dpl-btn-sm dpl-btn-danger',
            onClick: () => onClearChannel(activeChannel),
          },
          Icon.trash({ size: 13 }),
          '清除此頻道',
        ),
      ]
    : [
        h(
          'button',
          {
            key: 'clear',
            type: 'button',
            className: 'dpl-btn dpl-btn-sm dpl-btn-danger',
            'aria-live': 'polite',
            onClick: () => {
              if (!confirmAll) return setConfirmAll(true);
              setConfirmAll(false);
              onClear();
            },
          },
          Icon.trash({ size: 13 }),
          confirmAll ? '再按一次確認清除全部' : '全部清除',
        ),
      ];

  const kpis = h(
    'div',
    { className: 'dpl-grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))' } },
    h(
      'div',
      { className: 'dpl-kpi' },
      h('div', { className: 'dpl-kpi-label' }, '頻道數'),
      h('div', { className: 'dpl-kpi-value' }, fmtNum(historyStats?.channels ?? channels.length)),
    ),
    h(
      'div',
      { className: 'dpl-kpi' },
      h('div', { className: 'dpl-kpi-label' }, '訊息數'),
      h('div', { className: 'dpl-kpi-value' }, fmtNum(historyStats?.messages ?? 0)),
    ),
    h(
      'div',
      { className: 'dpl-kpi' },
      h('div', { className: 'dpl-kpi-label' }, '保留天數'),
      h('div', { className: 'dpl-kpi-value' }, fmtNum(historyStats?.retentionDays ?? 14)),
    ),
  );

  const messageRow = (entry) =>
    h(
      'div',
      { key: entry.id, className: 'dpl-hist-msg' },
      h('span', { className: 'dpl-mono' }, fmtTime(entry.ts)),
      h('span', { className: 'dpl-hist-author' }, entry.author?.name || '-'),
      h('span', { className: 'dpl-hist-text' }, entry.content || '[附件]'),
    );

  const channelRow = (channel) => {
    const id = String(channel.channelId || channel.id || '');
    const label = channel.channelName || id || '缺少頻道 ID';
    return h(
      'div',
      { key: id || label, className: 'dpl-list-row' },
      h(
        'div',
        {
          className: 'dpl-grow',
          'data-ui-verbatim': true,
          title: [channel.guildName, label, id].filter(Boolean).join(' · '),
        },
        h('span', { 'data-ui-verbatim': true }, label),
        id
          ? h(
              'small',
              { className: 'dpl-mono', 'data-ui-verbatim': true, style: { display: 'block', opacity: 0.7 } },
              id,
            )
          : null,
      ),
      h('span', { className: 'dpl-badge' }, `${channel.count} 則`),
      h(
        'button',
        {
          type: 'button',
          className: 'dpl-btn dpl-btn-sm dpl-btn-ghost',
          disabled: !id,
          title: id ? '查看此頻道的聊天快取' : '缺少頻道 ID，請重新整理',
          onClick: () => onOpen(id),
        },
        '查看',
      ),
    );
  };

  const body = activeChannel
    ? h(
        'div',
        { className: 'dpl-hist-list' },
        (messages || []).length
          ? (messages || []).map(messageRow)
          : h('div', { className: 'dpl-empty' }, '這個頻道還沒有記錄。'),
      )
    : h(
        'div',
        { className: 'dpl-hist-list' },
        (channels || []).length
          ? (channels || []).map(channelRow)
          : h('div', { className: 'dpl-empty' }, '還沒有聊天快取。'),
      );

  return h(
    Card,
    {
      title: '聊天快取',
      icon: 'history',
      desc: '頻道最近訊息會被濃縮成模型可讀的上下文，用來理解「他們在聊什麼」。',
      actions,
    },
    kpis,
    body,
  );
}

// ---------------------------------------------------------------- gif panel ---
