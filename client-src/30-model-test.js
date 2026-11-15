function ModelTest({ providers, draft, onTest, busy, lastTest }) {
  const route =
    draft.llmMode === 'custom'
      ? `${draft.customLlmApiBase} · ${draft.customLlmModel}`
      : draft.llmMode === 'subscriptions'
        ? `${draft.subscriptionProvider} · ${draft.subscriptionModel}`
        : 'DSH 預設模型';
  return h(
    Card,
    {
      title: '模型連線測試',
      icon: 'model',
      desc: '送出一句測試訊息，確認金鑰、配額與 provider 都正常。',
      actions: [
        h(
          'button',
          {
            key: 'test',
            type: 'button',
            className: 'dpl-btn dpl-btn-primary dpl-btn-sm',
            disabled: busy,
            onClick: onTest,
          },
          Icon.bolt({ size: 13 }),
          busy ? '測試中...' : '測試',
        ),
      ],
    },
    h(
      'div',
      { className: 'dpl-list-row' },
      h('span', { className: 'dpl-badge' }, '目前路線'),
      h('span', { className: 'dpl-grow dpl-mono' }, route),
    ),
    h(
      'div',
      { className: 'dpl-list-row' },
      h('span', { className: 'dpl-badge' }, '可用 Provider'),
      h(
        'span',
        { className: 'dpl-grow dpl-mono' },
        (providers || []).length
          ? providers.map((item) => item.displayName || item.id).join(' · ')
          : '（讀取不到 provider 清單）',
      ),
    ),
    lastTest
      ? h(
          'div',
          { className: lastTest.ok ? 'dpl-list-row' : 'dpl-note' },
          h('span', { className: 'dpl-badge' }, lastTest.ok ? '成功' : '失敗'),
          h(
            'span',
            { className: 'dpl-grow' },
            lastTest.ok ? `${lastTest.text}（${lastTest.ms}ms）` : lastTest.error,
          ),
        )
      : null,
  );
}

// ------------------------------------------------------------- quick actions ---
