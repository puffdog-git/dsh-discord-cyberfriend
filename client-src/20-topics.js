function phaseLabel(value) {
  return (
    {
      waiting: '等候中',
      queued: '已排程',
      creating: '建立中',
      generating: '產生回覆',
      running: '執行中',
      resuming: '重新核對中',
      sending: '交付中',
      delivered: '已交付',
      draft: '待審閱',
      cancelled: '已取消',
      cancelling: '取消中',
      uncertain: '結果不明',
      failed: '失敗',
      skipped: '已略過',
      blocked: '未通過條件',
      'handled-elsewhere': '由另一介面接手',
      partial: '部分完成',
      removed: '已移除',
      corrected: '已更正',
      invalidated: '衍生檔已失效',
      unsupported: '需另外處理',
      archived: '已歸檔（資料保留）',
      suppressed: '已停止召回（資料保留）',
      deleted: '原插件回報已刪除此筆',
      acknowledged: '已人工核對（非驗證成功）',
      prepared: '準備執行',
      pending_review: '等待原插件審核',
      rejected: '原插件已拒絕',
    }[value] || value
  );
}
function ConversationTopics() {
  const [data, D] = useState(null),
    [error, E] = useState(''),
    [notice, N] = useState(''),
    [busy, W] = useState(false),
    [all, A] = useState(false),
    [query, Q] = useState(''),
    [when, T] = useState('30分鐘後'),
    [plan, P] = useState(null),
    [closing, C] = useState(null);
  const load = async () => D(await api('/conversation/topics' + (all ? '?includeAnswered=1' : '')));
  useEffect(() => {
    load().catch((e) => E(e.message));
  }, [all]);
  const run = async (fn, text) => {
    W(true);
    E('');
    N('');
    try {
      const result = await fn();
      if (text) N(text);
      else if (result.message) N(result.message);
      await load();
      return result;
    } catch (e) {
      E(e.message);
    } finally {
      W(false);
    }
  };
  const labels = {
    pending: '等待回覆',
    generating: '正在生成',
    sending: '交付中',
    draft: '草稿待審閱',
    planning: '安排中',
    deferred: '已延後',
    answered: '已回答',
    closed: '已結束',
    failed: '未完成',
    blocked: '尚未回覆',
    cancelled: '已取消生成',
    uncertain: '結果待核對',
  };
  useIdNames((data?.topics || []).flatMap((row) => [row.channelId, row.userId]));
  const rows = (data?.topics || []).filter((row) => {
    const text = [row.preview, row.authorName, row.userId, row.channelId, row.code].join(' '),
      q = query.toLocaleLowerCase();
    return !q || [text, uiLocale.convert(text)].some((x) => x.toLocaleLowerCase().includes(q));
  });
  return h(
    Card,
    {
      title: '未答話題與延後回覆',
      desc: '保留來源與狀態，不建立另一套長期記憶。預覽沿用聊天快取；重新回答可能使用模型／語音額度。',
    },
    h(
      'div',
      { className: 'dpl-actions' },
      h(
        'button',
        { className: 'dpl-btn', disabled: busy, onClick: () => run(load, '已更新話題狀態') },
        '更新未答話題',
      ),
      h(
        'label',
        null,
        h('input', {
          type: 'checkbox',
          checked: all,
          onChange: (e) => {
            A(e.target.checked);
            P(null);
            C(null);
          },
        }),
        ' 顯示已回答與已結束話題',
      ),
    ),
    h('input', {
      className: 'dpl-input',
      'aria-label': '搜尋未答話題',
      placeholder: '搜尋預覽、使用者、頻道或話題代碼',
      value: query,
      onChange: (e) => Q(e.target.value),
    }),
    h(
      'label',
      null,
      '延後到什麼時間',
      h('input', {
        className: 'dpl-input',
        'aria-label': '延後時間',
        value: when,
        onChange: (e) => {
          T(e.target.value);
          P(null);
        },
      }),
    ),
    h(
      'p',
      { className: 'dpl-note' },
      '可輸入「半小時後」「明天下午三點半」。時間採 Asia/Taipei，最多七天；「晚點」會先追問。建立工作前須核對預覽並確認，不自動猜時間。',
    ),
    h(
      'details',
      null,
      h('summary', null, '在 Discord 中操作'),
      h(
        'p',
        null,
        '私訊或明確 @ AI 後說「半小時後再回覆我」，引用原問題可避免多話題混淆；再輸入回執提供的「確認安排 XXXXXXXX」。也可說「取消剛才的安排」「查看未答話題」「繼續話題 XXXXXXXX」。只操作自己的原帳號／頻道，不能指定其他人或任意收件人。',
      ),
    ),
    rows.map((row) =>
      h(
        'article',
        { key: row.id, className: 'dpl-asset', style: { minWidth: 0, overflowWrap: 'anywhere' } },
        h('strong', null, '#' + row.code + ' · ' + (labels[row.state] || row.state)),
        h(
          'p',
          null,
          (row.authorName || nameOfId(row.userId)) +
            ' · ' +
            nameOfId(row.channelId) +
            ' · ' +
            (row.kind === 'bot' ? 'Bot' : '使用者帳號'),
        ),
        h('p', null, row.preview || '聊天快取無預覽，來源訊息：' + row.sourceIds.join('、')),
        h('p', { className: 'dpl-note' }, row.reason),
        h(
          'div',
          { className: 'dpl-actions' },
          h(
            'button',
            {
              className: 'dpl-btn',
              disabled:
                busy ||
                !row.sourceAvailable ||
                ['answered', 'closed', 'uncertain', 'sending', 'planning'].includes(row.state),
              onClick: () =>
                run(async () => {
                  C(null);
                  const result = await api('/conversation/plan', {
                    method: 'POST',
                    body: { topicId: row.id, expectedRevision: row.revision, action: 'defer', when },
                  });
                  P(result.plan || null);
                  return result;
                }),
            },
            '預覽延後回覆',
          ),
          h(
            'button',
            {
              className: 'dpl-btn',
              disabled:
                busy ||
                !row.sourceAvailable ||
                ['answered', 'closed', 'uncertain', 'sending', 'planning'].includes(row.state),
              onClick: () =>
                run(async () => {
                  C(null);
                  const result = await api('/conversation/plan', {
                    method: 'POST',
                    body: { topicId: row.id, expectedRevision: row.revision, action: 'resume' },
                  });
                  P(result.plan || null);
                  return result;
                }),
            },
            '預覽重新回答',
          ),
          h(
            'button',
            {
              className: 'dpl-btn',
              disabled: busy || row.state === 'closed',
              onClick: () => {
                P(null);
                C({ id: row.id, revision: row.revision, code: row.code });
              },
            },
            '結束此話題',
          ),
        ),
      ),
    ),
    closing
      ? h(
          'div',
          { className: 'dpl-note' },
          h(
            'p',
            null,
            '結束 #' +
              closing.code +
              ' 會取消此來源的待回覆／延後工作，不刪除 Discord 訊息、記憶或已送出的內容。交付中可能已送達。',
          ),
          h(
            'button',
            {
              className: 'dpl-btn dpl-btn-danger',
              disabled: busy,
              onClick: () =>
                run(async () => {
                  const result = await api('/conversation/close', {
                    method: 'POST',
                    body: { topicId: closing.id, expectedRevision: closing.revision, confirmed: true },
                  });
                  C(null);
                  return result;
                }),
            },
            '確認結束此話題',
          ),
          h('button', { className: 'dpl-btn', disabled: busy, onClick: () => C(null) }, '返回，不結束'),
        )
      : null,
    plan
      ? h(
          'div',
          { className: 'dpl-note' },
          h(
            'p',
            null,
            plan.action === 'defer'
              ? '預定時間：' +
                  new Intl.DateTimeFormat('zh-Hant', {
                    timeZone: 'Asia/Taipei',
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(plan.dueAt) +
                  '（Asia/Taipei）'
              : '將重新讀取原問題並重新回答，不保證繞過冷卻／預算。',
          ),
          h('p', null, '確認碼：' + plan.code + '；五分鐘內有效，來源或會話改變即失效。'),
          h(
            'button',
            {
              className: 'dpl-btn',
              disabled: busy,
              onClick: () =>
                run(async () => {
                  const current = plan;
                  P(null);
                  return api('/conversation/confirm', {
                    method: 'POST',
                    body: { planId: current.id, code: current.code },
                  });
                }),
            },
            '確認執行此安排',
          ),
          h('button', { className: 'dpl-btn', disabled: busy, onClick: () => P(null) }, '返回，不執行'),
        )
      : null,
    data && !rows.length ? h('p', { role: 'status' }, '目前沒有符合條件的話題。') : null,
    notice ? h('p', { role: 'status' }, notice) : null,
    error ? h('p', { role: 'alert' }, error) : null,
    data?.lastError ? h('p', { role: 'alert' }, data.lastError) : null,
  );
}
