// 鄉民語氣（語氣樣本）的狀態卡：有沒有樣本可用、今天用了幾次、沒用的原因。
function SlangTonePanel({ onNavigate, config }) {
  const [data, D] = useState(null),
    [error, E] = useState(''),
    [busy, W] = useState(false),
    [preview, P] = useState({ audience: 'othersGroup', text: '', busy: false, error: '', result: null });
  const load = async () => {
    W(true);
    E('');
    try {
      D(await api('/slang'));
    } catch (e) {
      E(e.message);
    } finally {
      W(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const providers = data?.providers || [];
  const ready = providers.length > 0 && (data?.samples || 0) > 0;
  const audiences = [
    ['adminDm', '管理者・私訊'],
    ['adminGroup', '管理者・群聊'],
    ['othersDm', '其他使用者・私訊'],
    ['othersGroup', '其他使用者・群聊'],
  ];
  const on = audiences.filter(([id]) => config?.[id + '_slangToneEnabled']);
  const reasons = data?.reasons || {};
  const rows = Object.entries(data?.byReason || {}).sort((a, b) => b[1] - a[1]);
  return h(
    Card,
    {
      title: '鄉民語氣',
      icon: 'chat',
      desc: '回覆時有機會參考 PTT 板友的真實留言，帶一點鄉民的口氣。樣本由「刷 PTT」插件提供；只用在文字回覆，不改變人設。',
    },
    h(
      'p',
      { 'data-slang-provider': ready ? 'ready' : providers.length ? 'empty' : 'missing' },
      !data
        ? '讀取中…'
        : !providers.length
          ? '還沒有可用的樣本來源。請先安裝並啟用「刷 PTT」插件（dsh-ptt-dive）。'
          : !ready
            ? '「刷 PTT」已載入，但風格庫還是空的。到「刷 PTT」刷幾輪、讀到推文數夠多的文章後才會有樣本。'
            : '樣本來源已就緒：' +
              providers
                .map(
                  (p) =>
                    p.name +
                    ' ' +
                    p.samples +
                    ' 句' +
                    (p.sources?.length ? '（' + p.sources.map((s) => s.board + ' ' + s.count).join('、') + '）' : ''),
                )
                .join('；') +
              '。',
    ),
    h(
      'p',
      { 'data-slang-audiences': String(on.length) },
      on.length
        ? '已開啟的對象：' + on.map(([, label]) => label).join('、') + '。'
        : '目前沒有任何對象開啟。到下面的對象頁，在「人格與文字風格」裡打開「偶爾帶鄉民語氣」。',
    ),
    h(
      'div',
      { className: 'dpl-actions' },
      audiences.map(([id, label]) =>
        h('button', { key: id, className: 'dpl-btn', onClick: () => onNavigate(id) }, label + '的開關'),
      ),
    ),
    data
      ? h(
          'p',
          { 'data-slang-today': String(data.usedToday || 0) },
          '今天帶了 ' + (data.usedToday || 0) + ' 次鄉民語氣。' + (rows.length ? '' : '還沒有判斷紀錄（重啟後會重新計算）。'),
        )
      : null,
    rows.length
      ? h(
          'ul',
          { className: 'dpl-note', style: { margin: 0, paddingLeft: '1.2em' } },
          rows.map(([code, count]) => h('li', { key: code }, (reasons[code] || code) + '：' + count + ' 次')),
        )
      : null,
    data?.last
      ? h(
          'p',
          { className: 'dpl-note' },
          '最近一次判斷：' + (reasons[data.last.reason] || data.last.reason) + '（' + new Date(data.last.at).toLocaleString('zh-TW', { hour12: false }) + '）',
        )
      : null,
    h('button', { className: 'dpl-btn', disabled: busy, onClick: load }, busy ? '更新中…' : '更新狀態'),
    h(
      'div',
      { 'data-slang-preview': '', style: { display: 'grid', gap: '8px', marginTop: '8px' } },
      h('strong', null, '試試看'),
      h(
        'p',
        { className: 'dpl-note', style: { margin: 0 } },
        '輸入一句話，看 AI 在「沒附樣本」和「有附樣本」時各會怎麼回。只呼叫模型兩次，不會送到 Discord，也不會留在聊天記錄裡。',
      ),
      h(
        'div',
        { className: 'dpl-actions' },
        h(
          'select',
          { 'aria-label': '預覽的對象', value: preview.audience, onChange: (e) => P((p) => ({ ...p, audience: e.target.value })) },
          audiences.map(([id, label]) => h('option', { key: id, value: id }, label)),
        ),
        h('input', {
          type: 'text',
          'aria-label': '預覽的訊息',
          style: { flex: '1 1 220px', minWidth: 0 },
          value: preview.text,
          placeholder: '例如：今天股市怎麼跌成這樣',
          onChange: (e) => P((p) => ({ ...p, text: e.target.value })),
        }),
        h(
          'button',
          {
            className: 'dpl-btn',
            disabled: preview.busy || !preview.text.trim(),
            onClick: async () => {
              P((p) => ({ ...p, busy: true, error: '', result: null }));
              try {
                const result = await api('/slang/preview', { method: 'POST', body: { text: preview.text, audience: preview.audience } });
                P((p) => ({ ...p, busy: false, result }));
              } catch (e) {
                P((p) => ({ ...p, busy: false, error: e.message }));
              }
            },
          },
          preview.busy ? '產生中…' : '比較兩種回覆',
        ),
      ),
      preview.error ? h('p', { role: 'alert', style: { margin: 0 } }, preview.error) : null,
      preview.result
        ? h(
            'div',
            { 'data-slang-preview-result': '', style: { display: 'grid', gap: '8px' } },
            preview.result.note ? h('p', { className: 'dpl-note', style: { margin: 0 } }, preview.result.note) : null,
            h('p', { className: 'dpl-note', style: { margin: 0 } }, '這次給 AI 參考的樣本：' + preview.result.samples.join('／')),
            [
              ['without', '沒附樣本'],
              ['with', '有附樣本'],
            ].map(([key, label]) =>
              h(
                'div',
                { key, 'data-slang-reply': key },
                h('strong', null, label),
                h(
                  'p',
                  { style: { margin: '2px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } },
                  preview.result[key].ok ? preview.result[key].text || '（AI 選擇不回覆）' : '沒有產生：' + preview.result[key].error,
                ),
              ),
            ),
          )
        : null,
    ),
    h(
      'p',
      { className: 'dpl-note' },
      '每一則回覆是否附樣本由本機規則決定，不呼叫模型；不附的時候不多花用量，附的那一則大約多 100～150 個 token。',
    ),
    error ? h('p', { role: 'alert' }, error) : null,
  );
}
