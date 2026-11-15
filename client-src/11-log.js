const LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3 };

function LogList({ logs, level }) {
  const filtered = (logs || []).filter(
    (entry) => (LEVEL_ORDER[entry.level] ?? 1) >= (LEVEL_ORDER[level] ?? 1),
  );
  if (!filtered.length) return h('div', { className: 'dpl-empty' }, '目前沒有符合條件的 log。');
  return h(
    'div',
    { className: 'dpl-log' },
    filtered.map((entry) =>
      h(
        'div',
        { key: entry.id, className: 'dpl-log-row' },
        h('span', { className: 'dpl-log-time' }, fmtTime(entry.t)),
        h('span', { className: 'dpl-log-level', 'data-level': entry.level }, entry.level),
        h('span', { className: 'dpl-log-event' }, entry.event),
        h('span', { className: 'dpl-log-summary', title: entry.summary }, entry.summary),
      ),
    ),
  );
}

function LogPanel({ logs, level, setLevel, onRefresh, onClear }) {
  return h(
    Card,
    {
      title: '即時 log（除錯）',
      icon: 'log',
      desc: '登入、回覆、按表情、發送失敗都會留下紀錄；Token 與敏感字串會自動遮蔽。',
      actions: [
        h(Segmented, {
          key: 'level',
          options: [
            { value: 'debug', label: '全部' },
            { value: 'info', label: '一般' },
            { value: 'warn', label: '警告' },
            { value: 'error', label: '錯誤' },
          ],
          value: level,
          onChange: setLevel,
        }),
        h(
          'button',
          { key: 'r', type: 'button', className: 'dpl-btn dpl-btn-sm dpl-btn-ghost', onClick: onRefresh },
          Icon.refresh({ size: 13 }),
          '重新整理',
        ),
        h(
          'button',
          { key: 'c', type: 'button', className: 'dpl-btn dpl-btn-sm dpl-btn-danger', onClick: onClear },
          Icon.trash({ size: 13 }),
          '清空',
        ),
      ],
    },
    h(LogList, { logs, level }),
  );
}
