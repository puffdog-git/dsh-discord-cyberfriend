function InteractionConsole({ onNavigate }) {
  const [data, D] = useState(null),
    [state, S] = useState(null),
    [sessions, B] = useState([]),
    [error, E] = useState(''),
    [notice, N] = useState(''),
    [busy, W] = useState(false);
  const [kind, K] = useState('bot'),
    [channel, C] = useState(''),
    [user, U] = useState(''),
    [message, M] = useState(''),
    [mode, O] = useState('normal'),
    [minutes, T] = useState('30'),
    [binding, Q] = useState('');
  const load = async () => {
    const [a, b, c] = await Promise.all([api('/interaction'), api('/companion'), api('/sessions')]);
    D(a);
    S(b);
    B(c.sessions || []);
  };
  useEffect(() => {
    load().catch((e) => E(e.message));
  }, []);
  const run = async (fn, text) => {
    W(true);
    E('');
    N('');
    try {
      await fn();
      N(text);
      await load();
    } catch (e) {
      E(e.message);
    } finally {
      W(false);
    }
  };
  const input = (label, value, set) =>
    h(
      'label',
      null,
      label,
      h('input', {
        className: 'dpl-input',
        'aria-label': label,
        value,
        onChange: (e) => set(e.target.value),
      }),
    );
  return h(
    Card,
    { title: '陪伴模式、心情與訊息診斷', desc: '這些控制只管理訊息與交付，不建立另一套人格或心情引擎。' },
    h(
      'button',
      { className: 'dpl-btn', disabled: busy, onClick: () => run(load, '已更新狀態') },
      '更新互動狀態',
    ),
    h(
      'details',
      null,
      h('summary', null, '設定對話模式／安排延後回覆'),
      h(
        'label',
        null,
        '操作帳號',
        h(
          'select',
          {
            className: 'dpl-select',
            'aria-label': '操作帳號',
            value: kind,
            onChange: (e) => K(e.target.value),
          },
          h('option', { value: 'bot' }, '機器人'),
          h('option', { value: 'user' }, '使用者帳號'),
        ),
      ),
      input('對話文字頻道 ID', channel, C),
      input('對話使用者 ID', user, U),
      h(
        'label',
        null,
        '對話模式',
        h(
          'select',
          {
            className: 'dpl-select',
            'aria-label': '對話模式',
            value: mode,
            onChange: (e) => O(e.target.value),
          },
          [
            ['normal', '正常回覆'],
            ['listen', '只聽，不自動回覆'],
            ['text', '文字優先，不播放語音'],
            ['quiet', '安靜陪伴，只回文字'],
          ].map(([v, l]) => h('option', { key: v, value: v }, l)),
        ),
      ),
      input('時間（分鐘）', minutes, T),
      h(
        'p',
        { className: 'dpl-row-help' },
        '模式期限 0 代表直到手動恢復；排程需 1–10080 分鐘。排程由 DSH 宿主負責，插件不另建長期計時器；到期喚醒與回覆可能分別使用模型額度。',
      ),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: busy || !channel || !user,
          onClick: () =>
            run(
              () =>
                api('/companion/mode', {
                  method: 'POST',
                  body: { kind, channelId: channel, userId: user, mode, minutes: Number(minutes) },
                }),
              '對話模式已套用',
            ),
        },
        '套用對話模式',
      ),
      input('要延後回覆的原訊息 ID', message, M),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: busy || !channel || !message || !state?.schedulerAvailable,
          onClick: () =>
            run(
              () =>
                api('/companion/schedule', {
                  method: 'POST',
                  body: {
                    kind,
                    channelId: channel,
                    messageId: message,
                    type: 'defer',
                    afterMinutes: Number(minutes),
                  },
                }),
              '已交給 DSH 排程；到時會重新核對原訊息',
            ),
        },
        '安排延後回覆',
      ),
      h(
        'p',
        null,
        '主動關心必須先儲存上方開關，對方在該頻道輸入 !陪伴 同意；輸入 !陪伴 停止即可撤回。管理者本人也可使用下方按鈕確認。未回覆不追問。',
      ),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: busy || !channel || !user,
          onClick: () =>
            run(
              () =>
                api('/companion/consent', {
                  method: 'POST',
                  body: { kind, channelId: channel, userId: user },
                }),
              '已記錄管理者本人同意',
            ),
        },
        '管理者本人同意一次關心',
      ),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: busy || !channel || !message || !state?.schedulerAvailable,
          onClick: () =>
            run(
              () =>
                api('/companion/schedule', {
                  method: 'POST',
                  body: {
                    kind,
                    channelId: channel,
                    messageId: message,
                    type: 'checkin',
                    afterMinutes: Number(minutes),
                  },
                }),
              '已安排一次關心；不會自動追問',
            ),
        },
        '安排一次主動關心',
      ),
      !state?.schedulerAvailable
        ? h('p', { role: 'status' }, 'DSH 排程服務尚未就緒，不能建立定時工作。')
        : null,
    ),
    h(
      'details',
      null,
      h('summary', null, '未完成工作與取消'),
      (state?.jobs || []).length
        ? state.jobs.map((job) =>
            h(
              'div',
              { className: 'dpl-asset', key: job.id },
              h(
                'p',
                null,
                (job.type === 'defer' ? '延後回覆' : '一次關心') +
                  ' · ' +
                  nameOfId(job.channelId) +
                  ' · ' +
                  phaseLabel(job.state),
              ),
              job.error ? h('p', null, job.error) : null,
              h(
                'button',
                {
                  className: 'dpl-btn',
                  disabled: busy || ['cancelled', 'delivered', 'skipped', 'failed'].includes(job.state),
                  onClick: () =>
                    run(
                      () => api('/companion/cancel', { method: 'POST', body: { id: job.id } }),
                      '已停止此工作交付',
                    ),
                },
                '取消此工作',
              ),
              h(
                'button',
                {
                  className: 'dpl-btn',
                  disabled:
                    busy || !['delivered', 'skipped', 'failed', 'cancelled', 'draft'].includes(job.state),
                  onClick: () =>
                    run(
                      () => api('/companion/forget', { method: 'POST', body: { id: job.id } }),
                      '已清理此結束工作；每日額度與未回覆限制仍保留',
                    ),
                },
                '清理已結束工作',
              ),
            ),
          )
        : h('p', null, '目前沒有延後／關心工作。'),
    ),
    h(
      'details',
      null,
      h('summary', null, 'dsh-feiyu-mood 心情綁定'),
      h(
        'p',
        null,
        '原生 Agent 沿用已載入心情插件的注入規則；自訂模型只讀已有快照，不自行判斷心情。不借用其他對話的最近心情，也不複製私人事件理由。',
      ),
      h(
        'select',
        {
          className: 'dpl-select',
          'aria-label': '檢查心情的 DSH 會話',
          value: binding,
          onChange: (e) => Q(e.target.value),
        },
        h('option', { value: '' }, '選擇已綁定的 Discord 會話'),
        sessions.map((row) => h('option', { key: row.key, value: row.key }, row.title || row.sessionId)),
      ),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: busy || !binding,
          onClick: () =>
            run(() => api('/mood/check', { method: 'POST', body: { key: binding } }), '已唯讀核對心情綁定'),
        },
        '檢查此會話的心情',
      ),
      h(
        'p',
        { role: 'status' },
        data?.mood?.available
          ? '綁定快照可讀：' + data.mood.label + ' · ' + data.mood.mood + '/100'
          : data?.mood?.reason || '尚未檢查心情綁定',
      ),
    ),
    h(
      'details',
      null,
      h('summary', null, '可用的外部唯讀知識工具'),
      h(
        'p',
        null,
        '在各對象設定啟用通用唯讀知識查詢；私人知識只限管理者私訊，群聊只使用宣告公開資料的來源。',
      ),
      (data?.knowledge || []).length
        ? data.knowledge.map((row) =>
            h(
              'p',
              { key: row.name },
              row.name +
                ' · ' +
                (row.eligible ? (row.publicData ? '可查公開資料' : '管理者私訊限定') : row.reason),
            ),
          )
        : h('p', null, '尚未發現符合契約的知識工具；請先載入來源插件。'),
      h('button', { className: 'dpl-btn', onClick: () => onNavigate('adminDm') }, '前往管理者私訊授權'),
    ),
    h(
      'details',
      null,
      h('summary', null, '最近訊息的處理原因'),
      h('p', null, '只列訊息 ID、階段與原因，不複製私人正文。'),
      (data?.interaction?.trace || [])
        .slice(0, 50)
        .map((row) =>
          h(
            'p',
            { key: row.id },
            row.messageId +
              ' · ' +
              row.transport +
              ' · ' +
              phaseLabel(row.phase) +
              ' · ' +
              (row.reason || '—'),
          ),
        ),
    ),
    notice ? h('p', { role: 'status' }, notice) : null,
    error ? h('p', { role: 'alert' }, error) : null,
  );
}
