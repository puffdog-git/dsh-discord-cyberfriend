function TokenBudgetPanel() {
  const [data, setData] = useState(null),
    [error, setError] = useState('');
  const load = async () => {
    try {
      setData(await api('/token-budget'));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
    const t = setInterval(() => pageHidden() || load(), 30000);
    return () => clearInterval(t);
  }, []);
  return h(
    Card,
    {
      title: '本插件模型 Token 用量',
      icon: 'model',
      desc: '這裡的數字全部是 Discord 插件的模型用量，包含輸入與輸出的 Token。合計分成「服務有回報的用量」與「服務沒回報、由插件估算的用量」，不是呼叫次數，也不是整個帳號的總用量。',
    },
    h('button', { className: 'dpl-btn', onClick: load }, '更新 Token 統計'),
    error ? h('p', { role: 'status' }, error) : null,
    data
      ? h(
          'div',
          null,
          h(
            'div',
            { className: 'dpl-library-grid' },
            [
              ['今日', data.today, data.dailyLimit],
              ['本月', data.thisMonth, data.monthlyLimit],
            ].map(([label, row, limit]) =>
              h(
                'div',
                { key: label, className: 'dpl-asset' },
                h('strong', null, label + '合計（含估算）：' + fmtNum(row?.totalTokens || 0) + ' Token'),
                h('p', null, '預算上限：' + (limit ? fmtNum(limit) + ' Token' : '不限')),
                h('p', null, '服務已回報的用量：' + fmtNum(row?.reportedTokens || 0) + ' Token'),
                h('p', null, '未回報，由插件估算：' + fmtNum(row?.estimatedTokens || 0) + ' Token'),
                h('small', null, (row?.calls || 0) + ' 筆請求紀錄（與 Token 數分開計算）'),
              ),
            ),
          ),
          data.enabled && (data.calls || []).some((r) => r.overBudget)
            ? h(
                'p',
                { className: 'dpl-note', role: 'status' },
                '近期有請求的預估用量超過預算；請查看額度與請求紀錄。',
              )
            : null,
          h(
            'p',
            null,
            '進行中預留：' +
              fmtNum(data.reserved || 0) +
              ' Token；' +
              (data.enabled
                ? data.mode === 'block'
                  ? '預算不足會阻擋新請求'
                  : '超額提醒，繼續執行'
                : '預算阻擋未啟用') +
              '；時區 ' +
              (data.timeZone || 'Asia/Taipei'),
          ),
          data.startedAt
            ? h(
                'small',
                null,
                '監控起始：' + new Date(data.startedAt).toLocaleString() + '（不回補安裝前用量）',
              )
            : null,
          h('p', { className: 'dpl-row-help' }, data.note || '精確用量與估算分開列示，並非供應商帳單。'),
          h(
            'p',
            { className: 'dpl-row-help' },
            '合計＝上面兩項相加。「估算」也是本插件的用量：服務沒有提供 Token 數字時，由插件暫估；失敗或中斷的請求也可能列入。服務回報與估算都不是費用，請以服務商帳單為準。「不限」只表示未設本插件的用量預算。',
          ),
          h(
            'p',
            { className: 'dpl-row-help' },
            '原生 Agent 的工具迴圈及外部插件內部推論可能超出預留估算；本地預算不等同供應商硬性費用上限。',
          ),
          h(
            'details',
            null,
            h('summary', null, '最近請求（不保存提示詞或對話文字）'),
            ...(data.calls || [])
              .slice(0, 30)
              .map((row) =>
                h(
                  'div',
                  { key: row.id, className: 'dpl-note' },
                  new Date(row.at).toLocaleString() +
                    ' · ' +
                    row.category +
                    ' · ' +
                    fmtNum(row.totalTokens) +
                    ' Token · ' +
                    (row.source === 'reported'
                      ? '模型回報'
                      : row.source === 'not-started'
                        ? '未呼叫模型'
                        : '估算') +
                    ' · ' +
                    row.status,
                ),
              ),
          ),
        )
      : h('p', null, '讀取統計中…'),
  );
}
