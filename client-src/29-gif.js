function GifPanel({ config }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const search = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setError('');
    try {
      const payload = await api(`/gif?q=${encodeURIComponent(query)}&limit=${config?.gifMaxResults || 8}`);
      setResults(payload.results || []);
      if (!(payload.results || []).length) setError('找不到結果');
    } catch (err) {
      setError(err.message);
      setResults([]);
    } finally {
      setBusy(false);
    }
  };
  return h(
    Card,
    {
      title: 'GIF 試搜',
      icon: 'gif',
      desc: '使用已儲存的 GIF 設定搜尋；KLIPY 模式透過已連線的 Discord 介面，模型回覆共用此來源。',
    },
    h(
      'div',
      { style: { display: 'flex', gap: 8, alignItems: 'center' } },
      h('input', {
        className: 'dpl-input',
        placeholder: 'Search KLIPY · happy dance',
        value: query,
        onChange: (event) => setQuery(event.target.value),
        onKeyDown: (event) => event.key === 'Enter' && search(),
      }),
      h(
        'button',
        {
          type: 'button',
          className: 'dpl-btn dpl-btn-primary dpl-btn-sm',
          disabled: busy || !query.trim(),
          title: query.trim() ? '搜尋 GIF' : '請先輸入搜尋關鍵字',
          onClick: search,
        },
        Icon.bolt({ size: 13 }),
        busy ? '搜尋中...' : '搜尋',
      ),
    ),
    error ? h('div', { className: 'dpl-note' }, Icon.warn({ size: 14 }), error) : null,
    (results || []).length
      ? h(
          'div',
          { className: 'dpl-gif-grid' },
          results.map((item) =>
            h(
              'a',
              {
                key: item.url,
                href: item.url,
                target: '_blank',
                rel: 'noreferrer',
                title: item.title || '',
              },
              h('img', { src: item.preview || item.url, alt: item.title || 'GIF', loading: 'lazy' }),
            ),
          ),
        )
      : null,
  );
}

// -------------------------------------------------------------- model panel ---
