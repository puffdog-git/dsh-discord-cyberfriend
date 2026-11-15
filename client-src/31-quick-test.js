function QuickTest({ onSend, busy }) {
  const [channelId, setChannelId] = useState('');
  const [text, setText] = useState('這是從 DSH 送出的測試訊息');
  return h(
    Card,
    {
      title: '快速測試',
      icon: 'send',
      desc: '用目前選用的介面送一則訊息到指定頻道，驗證權限與 Token（不經過模型）。',
    },
    h(
      'div',
      { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
      h('input', {
        className: 'dpl-input',
        style: { flex: '0 1 190px' },
        placeholder: '頻道 ID',
        value: channelId,
        onChange: (event) => setChannelId(event.target.value),
      }),
      h('input', {
        className: 'dpl-input',
        style: { flex: '1 1 210px' },
        placeholder: '訊息內容',
        value: text,
        onChange: (event) => setText(event.target.value),
      }),
      h(
        'button',
        {
          type: 'button',
          className: 'dpl-btn dpl-btn-primary dpl-btn-sm',
          disabled: busy || !channelId.trim() || !text.trim(),
          onClick: () => onSend(channelId.trim(), text.trim()),
        },
        Icon.send({ size: 13 }),
        busy ? '傳送中...' : '送出',
      ),
    ),
  );
}

// ---------------------------------------------------------------- main panel ---
