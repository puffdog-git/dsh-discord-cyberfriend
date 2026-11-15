function MemoryMaintenancePanel() {
  const [channel, C] = useState(''),
    [message, M] = useState(''),
    [action, A] = useState('forget'),
    [replacement, R] = useState(''),
    [plan, P] = useState(null),
    [result, S] = useState(null),
    [error, E] = useState(''),
    [busy, W] = useState(false);
  const change = (set, value) => {
    set(value);
    P(null);
  };
  const run = async (fn) => {
    W(true);
    E('');
    try {
      await fn();
    } catch (e) {
      E(e.message);
    } finally {
      W(false);
    }
  };
  return h(
    Card,
    {
      title: '更正／忘記來源與處理回執',
      desc: '先預覽各層範圍，再確認；不會假稱刪除 Discord 原訊息或所有外部記憶。',
    },
    h(
      'label',
      null,
      '來源頻道 ID',
      h('input', {
        className: 'dpl-input',
        'aria-label': '維護來源頻道 ID',
        value: channel,
        onChange: (e) => change(C, e.target.value),
      }),
    ),
    h(
      'label',
      null,
      '來源訊息 ID',
      h('input', {
        className: 'dpl-input',
        'aria-label': '維護來源訊息 ID',
        value: message,
        onChange: (e) => change(M, e.target.value),
      }),
    ),
    h(
      'select',
      {
        className: 'dpl-select',
        'aria-label': '記憶維護操作',
        value: action,
        onChange: (e) => change(A, e.target.value),
      },
      h('option', { value: 'forget' }, '忘記本插件來源'),
      h('option', { value: 'correct' }, '更正本插件來源'),
    ),
    action === 'correct'
      ? h('textarea', {
          className: 'dpl-textarea',
          'aria-label': '更正後的來源文字',
          value: replacement,
          onChange: (e) => change(R, e.target.value),
        })
      : null,
    h(
      'button',
      {
        className: 'dpl-btn',
        disabled: busy || !channel || !message || (action === 'correct' && !replacement.trim()),
        onClick: () =>
          run(async () => {
            P(
              await api('/memory-maintenance/preview', {
                method: 'POST',
                body: { channelId: channel, messageId: message, action, replacement },
              }),
            );
            S(null);
          }),
      },
      '預覽處理範圍',
    ),
    plan
      ? h(
          'div',
          { className: 'dpl-note' },
          plan.layers.map((row, i) =>
            h(
              'p',
              { key: i },
              row.layer +
                '：' +
                (row.supported ? '可處理 ' + row.affected + ' 項' : '不會自動處理') +
                (row.note ? ' · ' + row.note : ''),
            ),
          ),
          h(
            'button',
            {
              className: 'dpl-btn dpl-btn-danger',
              disabled: busy,
              onClick: () =>
                run(async () => {
                  S(
                    await api('/memory-maintenance/apply', {
                      method: 'POST',
                      body: { id: plan.id, confirmed: true },
                    }),
                  );
                  P(null);
                }),
            },
            '確認依此範圍處理',
          ),
        )
      : null,
    result
      ? h(
          'div',
          { role: 'status' },
          h(
            'p',
            null,
            '本次結果：' +
              phaseLabel(result.receipt.status) +
              '；請核對每層回執。外部記憶需在下方另外預覽並確認。',
          ),
          result.receipt.layers.map((row, i) =>
            h(
              'p',
              { key: i },
              row.layer + ' · ' + phaseLabel(row.status) + (row.detail ? ' · ' + row.detail : ''),
            ),
          ),
        )
      : null,
    error ? h('p', { role: 'alert' }, error) : null,
  );
}

// ------------------------------------------------------------ history panel ---
