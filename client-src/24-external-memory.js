function ExternalMemoryPanel() {
  const [data, D] = useState(null),
    [target, T] = useState(''),
    [action, A] = useState('forget'),
    [body, B] = useState(''),
    [plan, P] = useState(null),
    [error, E] = useState(''),
    [busy, W] = useState(false),
    [notice, N] = useState(''),
    [check, C] = useState(null);
  const seq = useRef(0);
  const load = async () => {
    const id = ++seq.current;
    const value = await api('/memory-maintenance');
    if (id === seq.current) D(value);
  };
  useEffect(() => {
    load().catch((e) => E(e.message));
    return () => {
      seq.current++;
    };
  }, []);
  const run = async (fn) => {
    W(true);
    E('');
    N('');
    try {
      await fn();
      await load();
    } catch (e) {
      E(e.message);
    } finally {
      W(false);
    }
  };
  const row = data?.targets?.find((r) => r.key === target),
    cap = data?.contracts?.find((r) => r.id === row?.writer),
    supported = !!cap?.actions?.[action]?.supported;
  const change = (set, value) => {
    set(value);
    P(null);
    C(null);
  };
  return h(
    Card,
    {
      title: '外部記憶維護能力與回執',
      desc: '先確認原插件支援的效果，再選擇本插件曾收到寫入回執的記憶。只安裝或支援召回，不代表可以修改／刪除。',
    },
    h(
      'button',
      {
        className: 'dpl-btn',
        disabled: busy,
        onClick: () =>
          run(async () => {
            P(null);
            C(null);
            N('已更新記憶維護能力');
          }),
      },
      '更新記憶維護能力',
    ),
    h(
      'details',
      null,
      h('summary', null, '各記憶插件支援哪些操作'),
      (data?.contracts || []).map((c) =>
        h(
          'article',
          { key: c.id, className: 'dpl-asset' },
          h('strong', null, c.name),
          h(
            'p',
            null,
            ['correct', 'forget', 'delete']
              .map(
                (a) =>
                  ({ correct: '更正', forget: '忘記', delete: '永久刪除' })[a] +
                  '：' +
                  (c.actions[a].supported ? phaseLabel(c.actions[a].effect) : '未提供可用契約'),
              )
              .join(' · '),
          ),
          h('p', { className: 'dpl-note' }, c.note),
        ),
      ),
    ),
    h(
      'label',
      null,
      '選擇外部記憶回執',
      h(
        'select',
        {
          className: 'dpl-select',
          'aria-label': '選擇外部記憶回執',
          value: target,
          onChange: (e) => change(T, e.target.value),
        },
        h('option', { value: '' }, '請選擇要處理的一筆記憶'),
        (data?.targets || []).map((r) =>
          h('option', { key: r.key, value: r.key }, r.writer + ' · ' + r.memoryId + ' · ' + r.channelId),
        ),
      ),
    ),
    row
      ? h(
          'p',
          { className: 'dpl-note' },
          row.note +
            '；原會話：' +
            (row.sessionId || '缺少') +
            '；作用域：' +
            (row.scopeKey || '舊回執未提供'),
        )
      : null,
    h(
      'label',
      null,
      '外部記憶操作',
      h(
        'select',
        {
          className: 'dpl-select',
          'aria-label': '外部記憶操作',
          value: action,
          onChange: (e) => change(A, e.target.value),
        },
        h('option', { value: 'forget' }, '忘記（依契約歸檔／停止召回）'),
        h('option', { value: 'correct' }, '更正整筆記憶正文'),
        h('option', { value: 'delete' }, '永久刪除指定記憶'),
      ),
    ),
    action === 'correct'
      ? h('textarea', {
          className: 'dpl-textarea',
          'aria-label': '外部記憶更正正文',
          placeholder: '請填完整的新記憶正文；不會自動把單則來源文字覆蓋到整筆記憶',
          value: body,
          onChange: (e) => change(B, e.target.value),
        })
      : null,
    row && !supported
      ? h('p', { role: 'status' }, '此插件未提供所選操作；請到原插件處理，不會以歸檔代替永久刪除。')
      : null,
    row?.blocked ? h('p', { role: 'status' }, '此筆記憶有結果未確認的操作，請先到原插件核對。') : null,
    h(
      'button',
      {
        className: 'dpl-btn',
        disabled:
          busy ||
          !row ||
          !supported ||
          !row.scopeVerified ||
          row.blocked ||
          (action === 'correct' && !body.trim()),
        onClick: () =>
          run(async () => {
            P(
              await api('/memory-maintenance/external/preview', {
                method: 'POST',
                body: { targetKey: target, action, replacement: body },
              }),
            );
            C(null);
          }),
      },
      '預覽外部記憶操作',
    ),
    plan
      ? h(
          'div',
          { className: 'dpl-note' },
          h('p', null, plan.target.writer + ' · ' + plan.target.memoryId + ' · ' + plan.target.scopeKey),
          h('p', null, '預期效果：' + phaseLabel(plan.effect) + '；來源數：' + plan.target.evidenceCount),
          h('p', null, plan.warning),
          plan.replacement
            ? h('pre', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, plan.replacement)
            : null,
          h(
            'button',
            {
              className: 'dpl-btn dpl-btn-danger',
              disabled: busy,
              onClick: () =>
                run(async () => {
                  const p = plan;
                  P(null);
                  const r = await api('/memory-maintenance/external/apply', {
                    method: 'POST',
                    body: { id: p.id, confirmed: true },
                  });
                  N('本次外部結果：' + phaseLabel(r.receipt.status));
                }),
            },
            '確認執行外部記憶操作',
          ),
          h(
            'button',
            { className: 'dpl-btn', disabled: busy, onClick: () => P(null) },
            '返回，不修改外部記憶',
          ),
        )
      : null,
    !(data?.targets || []).length
      ? h('p', { role: 'status' }, '目前沒有可定位的外部寫入回執；正式會話自動捕獲的記憶需到原插件核對。')
      : null,
    h(
      'details',
      null,
      h('summary', null, '最近的維護回執'),
      (data?.receipts || []).map((r) =>
        h(
          'article',
          { key: r.id, className: 'dpl-asset' },
          h(
            'strong',
            null,
            (r.kind === 'external' ? '外部 ' + r.writer + ' · ' + r.memoryId : '本插件來源') +
              ' · ' +
              phaseLabel(r.status),
          ),
          h('p', null, r.detail || '本插件來源處理回執'),
          (r.layers || []).map((layer, i) =>
            h(
              'p',
              { key: i },
              layer.layer + ' · ' + phaseLabel(layer.status) + (layer.detail ? ' · ' + layer.detail : ''),
            ),
          ),
          r.proposalId ? h('p', null, '靈樞提案：' + r.proposalId) : null,
          r.status === 'pending_review'
            ? h(
                'button',
                {
                  className: 'dpl-btn',
                  disabled: busy,
                  onClick: () =>
                    run(async () => {
                      const out = await api('/memory-maintenance/external/reconcile', {
                        method: 'POST',
                        body: { id: r.id },
                      });
                      N('核對結果：' + phaseLabel(out.receipt.status));
                    }),
                },
                '核對待審結果（不自動核准）',
              )
            : null,
          r.diagnostic ? h('p', null, r.diagnostic.summary + '；' + r.diagnostic.fix) : null,
          r.kind === 'external' && ['prepared', 'running', 'uncertain'].includes(r.status)
            ? h(
                'button',
                { className: 'dpl-btn', disabled: busy, onClick: () => C(r.id) },
                '我已到原插件核對',
              )
            : null,
        ),
      ),
    ),
    check
      ? h(
          'div',
          { className: 'dpl-note' },
          h(
            'p',
            null,
            '請先到原插件核對這筆操作是否已生效。此標記只解除重試鎖定，不代表插件驗證成功；不會自動重送。',
          ),
          h(
            'button',
            {
              className: 'dpl-btn',
              disabled: busy,
              onClick: () =>
                run(async () => {
                  await api('/memory-maintenance/external/acknowledge', {
                    method: 'POST',
                    body: { id: check, confirmed: true },
                  });
                  C(null);
                  N('已記錄人工核對，不自動重送');
                }),
            },
            '確認已核對原插件',
          ),
          h('button', { className: 'dpl-btn', disabled: busy, onClick: () => C(null) }, '返回，保留鎖定'),
        )
      : null,
    notice ? h('p', { role: 'status' }, notice) : null,
    error ? h('p', { role: 'alert' }, error) : null,
  );
}
