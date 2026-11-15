function ChannelActionsPanel({ config, onNavigate }) {
  const [kind, setKind] = useState('bot'),
    [channelId, setChannel] = useState(''),
    [action, setAction] = useState('search'),
    [data, setData] = useState(null),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [form, setForm] = useState({
    query: '',
    after: '',
    before: '',
    messageId: '',
    postId: '',
    destinationId: '',
    content: '',
    name: '',
    tags: '',
    tagsClear: false,
    archived: 'unchanged',
  });
  const reads = ['search', 'pins', 'info', 'archives', 'posts', 'post_read', 'members'],
    writes = ['pin', 'unpin', 'edit', 'delete', 'forward', 'join', 'leave', 'thread_edit', 'forum_create'];
  const labels = {
    search: '搜尋歷史',
    pins: '讀取置頂',
    info: '頻道與論壇標籤',
    archives: '公開封存討論串',
    posts: '論壇／媒體貼文索引',
    post_read: '讀取指定貼文',
    members: '討論串成員',
    pin: '置頂訊息',
    unpin: '取消置頂',
    edit: '修改自己的文字訊息',
    delete: '撤回自己的訊息',
    forward: '原生轉傳',
    join: '加入討論串',
    leave: '離開討論串',
    thread_edit: '修改討論串',
    forum_create: '建立論壇貼文',
  };
  const refresh = () =>
    api('/channel-actions')
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    refresh();
  }, []);
  const input = (key, label, type = 'text') =>
    h(
      'label',
      {
        className: 'dpl-row',
        key,
        style: {
          display: 'grid',
          gridTemplateColumns: 'minmax(110px,1fr) minmax(0,2fr)',
          gap: 12,
          alignItems: 'center',
        },
      },
      h('span', { className: 'dpl-row-label' }, label),
      h(type === 'textarea' ? 'textarea' : 'input', {
        className: 'dpl-input',
        type: type === 'textarea' ? undefined : type,
        value: form[key],
        onChange: (e) => setForm({ ...form, [key]: e.target.value }),
        style: { minWidth: 0, width: '100%', boxSizing: 'border-box' },
      }),
    );
  const run = async (path, body) => {
    setBusy(true);
    setError('');
    try {
      const r = await api('/channel-actions/' + path, { method: 'POST', body });
      setResult(path === 'query' ? { ...r, queried: body.action } : r);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const submit = () => {
    const b = { kind, channelId, action, limit: 20 };
    for (const key of ['query', 'messageId', 'destinationId', 'content', 'name'])
      if (form[key]) b[key] = form[key];
    if (['post_read', 'join', 'leave', 'thread_edit'].includes(action) && form.postId) b.postId = form.postId;
    for (const key of ['after', 'before'])
      if (form[key]) {
        const date = new Date(form[key]);
        if (!Number.isFinite(date.getTime())) {
          setError('日期格式無效');
          return;
        }
        b[key] = date.toISOString();
      }
    if (['thread_edit', 'forum_create'].includes(action) && form.tagsClear) b.tags = [];
    else if (['thread_edit', 'forum_create'].includes(action) && form.tags.trim())
      b.tags = form.tags.split(/[,，\s]+/).filter(Boolean);
    if (action === 'thread_edit' && form.archived !== 'unchanged') b.archived = form.archived === 'true';
    return run(reads.includes(action) ? 'query' : 'preview', b);
  };
  const argsView = (p) =>
    h(
      'div',
      null,
      h('p', null, '來源訊息：' + (p.args?.messageId || '無')),
      p.args?.postId ? h('p', null, '目標貼文／討論串：' + p.args.postId) : null,
      p.args?.destinationId ? h('p', null, '目的頻道：' + p.args.destinationId) : null,
      p.args?.name ? h('p', null, '名稱：' + p.args.name) : null,
      typeof p.args?.archived === 'boolean' ? h('p', null, '封存：' + (p.args.archived ? '是' : '否')) : null,
      p.args?.tags ? h('p', null, '標籤 ID：' + (p.args.tags.join('、') || '清除全部')) : null,
      p.args?.content
        ? h(
            'p',
            { 'data-ui-verbatim': true, style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } },
            p.args.content,
          )
        : null,
      p.sourcePreview
        ? h(
            'div',
            null,
            h('p', null, '原作者 ID：' + p.sourcePreview.authorId),
            h(
              'p',
              { 'data-ui-verbatim': true, style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } },
              p.sourcePreview.text || '無文字',
            ),
            p.sourcePreview.attachments?.length
              ? h('p', null, '附件：' + p.sourcePreview.attachments.join('、'))
              : null,
          )
        : null,
    );
  const isRead = reads.includes(action);
  const lookupOff = config && config.channelLookupEnabled === false;
  const writesOff = config && config.channelActionsEnabled === false;
  const choice = (list) =>
    h(
      'div',
      { className: 'dpl-actions' },
      list.map((a) =>
        h(
          'button',
          {
            className: 'dpl-btn dpl-btn-sm',
            type: 'button',
            key: a,
            'data-on': action === a,
            'aria-pressed': action === a,
            onClick: () => {
              setAction(a);
              setResult(null);
              setError('');
            },
          },
          labels[a],
        ),
      ),
    );
  const stateLabel = {
    succeeded: ['已完成', 'ok'],
    rejected: ['服務拒絕（未確認成功）', 'err'],
    running: ['執行中', 'warn'],
    uncertain: ['結果不明，請核對', 'warn'],
    acknowledged: ['已人工核對（不等於成功）', 'muted'],
  };
  const rows = result?.messages || [];
  const threads = result?.threads || [];
  // 查詢完成但沒有任何可列出的內容時，明確顯示「沒有結果」，與查詢失敗、功能未開啟區分。
  const emptyResult =
    result &&
    result.queried &&
    ['search', 'pins', 'archives', 'posts', 'post_read'].includes(result.queried) &&
    !rows.length &&
    !threads.length;

  return h(
    Card,
    {
      title: '訊息、論壇與討論串工作台',
      icon: 'chat',
      desc: '查詢只讀取指定頻道；會改動 Discord 的操作一律先產生預覽，由你確認後才執行。結果不明時請先到 Discord 核對，不會自動重試。',
    },
    h(
      'div',
      { className: 'dpl-row', 'data-type': 'select' },
      h(
        'div',
        { className: 'dpl-row-main' },
        h('div', { className: 'dpl-row-label' }, '使用哪個帳號'),
        h('div', { className: 'dpl-row-help' }, '查詢與操作會以這個帳號的權限進行。'),
      ),
      h(
        'div',
        { className: 'dpl-row-control' },
        h(
          'div',
          { className: 'dpl-seg', role: 'group', 'aria-label': '使用哪個帳號' },
          ['bot', 'user'].map((k) =>
            h(
              'button',
              {
                type: 'button',
                'data-on': kind === k,
                'aria-pressed': kind === k,
                onClick: () => setKind(k),
                key: k,
              },
              k === 'bot' ? '機器人' : '使用者帳號',
            ),
          ),
        ),
      ),
    ),
    h(
      'div',
      { className: 'dpl-row', 'data-type': 'string' },
      h(
        'div',
        { className: 'dpl-row-main' },
        h('div', { className: 'dpl-row-label' }, '來源頻道 ID'),
        h('div', { className: 'dpl-row-help' }, '要查詢或操作的文字頻道、討論串或論壇。'),
      ),
      h(
        'div',
        { className: 'dpl-row-control', style: { flex: '1 1 260px', maxWidth: 420 } },
        h('input', {
          className: 'dpl-input',
          'data-mono': 'true',
          'aria-label': '來源頻道 ID',
          value: channelId,
          onChange: (e) => setChannel(e.target.value.trim()),
          placeholder: '目前操作的文字頻道、討論串或論壇 ID',
        }),
      ),
    ),

    h('div', { className: 'dpl-subhead' }, '查詢（不會改動 Discord）'),
    choice(reads),
    h('div', { className: 'dpl-subhead' }, '操作（先預覽，確認後才執行）'),
    choice(writes),

    isRead && lookupOff
      ? h(
          StateView,
          {
            kind: 'off',
            title: '查詢功能尚未開啟',
            action: onNavigate
              ? h(
                  'button',
                  { type: 'button', className: 'dpl-btn dpl-btn-sm', onClick: () => onNavigate('history') },
                  '前往聊天快取設定',
                )
              : null,
          },
          '需要先開啟「系統 → 聊天快取 → 允許 AI 查詢目前頻道置頂」並儲存。',
        )
      : null,
    !isRead && writesOff
      ? h(
          StateView,
          { kind: 'off', title: '訊息操作尚未開啟' },
          '請先開啟上方的「允許管理者確認訊息與討論串操作」並儲存；另外試跑模式與僅觀察模式下禁止寫入。',
        )
      : null,

    ['post_read', 'join', 'leave', 'thread_edit'].includes(action)
      ? input('postId', '父頻道內的貼文／討論串 ID（可選）')
      : null,
    action === 'search'
      ? [
          input('query', '搜尋文字'),
          input('after', '起始時間', 'datetime-local'),
          input('before', '結束時間', 'datetime-local'),
          h(
            'p',
            { key: 'search-hint', className: 'dpl-row-help' },
            '預設查詢近 30 天，最多 366 天、20 則。機器人搜尋歷史需要伺服器頻道與 Message Content Intent。',
          ),
        ]
      : null,
    ['pin', 'unpin', 'edit', 'delete', 'forward'].includes(action) ? input('messageId', '來源訊息 ID') : null,
    action === 'forward' ? input('destinationId', '目的頻道 ID') : null,
    ['edit', 'forum_create'].includes(action) ? input('content', '文字內容', 'textarea') : null,
    ['thread_edit', 'forum_create'].includes(action)
      ? [
          input('name', '討論串／貼文名稱'),
          input('tags', '論壇標籤 ID（逗號分隔）'),
          h(
            'button',
            {
              key: 'tags-clear',
              className: 'dpl-btn dpl-btn-sm',
              type: 'button',
              'data-on': form.tagsClear,
              'aria-pressed': form.tagsClear,
              onClick: () => setForm({ ...form, tagsClear: !form.tagsClear }),
            },
            form.tagsClear ? '已選取：清除全部標籤' : '清除全部論壇標籤',
          ),
          action === 'thread_edit'
            ? h(
                'div',
                { key: 'archived', className: 'dpl-seg', role: 'group', 'aria-label': '封存狀態' },
                [
                  ['unchanged', '封存狀態不變'],
                  ['true', '封存'],
                  ['false', '解除封存'],
                ].map(([v, l]) =>
                  h(
                    'button',
                    {
                      key: v,
                      type: 'button',
                      'data-on': form.archived === v,
                      'aria-pressed': form.archived === v,
                      onClick: () => setForm({ ...form, archived: v }),
                    },
                    l,
                  ),
                ),
              )
            : null,
        ]
      : null,
    h(
      'div',
      { className: 'dpl-actions', style: { marginTop: 10 } },
      h(
        'button',
        {
          type: 'button',
          className: 'dpl-btn dpl-btn-primary',
          disabled: busy || !channelId,
          onClick: submit,
        },
        busy ? '處理中…' : isRead ? '執行唯讀查詢' : '建立操作預覽',
      ),
      h(
        'button',
        { type: 'button', className: 'dpl-btn', disabled: busy, onClick: refresh },
        '重新整理操作紀錄',
      ),
      !channelId ? h('span', { className: 'dpl-sub' }, '請先填入來源頻道 ID。') : null,
    ),

    error ? h(StateView, { kind: 'error', title: isRead ? '查詢失敗' : '操作未完成' }, error) : null,
    data?.storageError
      ? h('p', { className: 'dpl-note', 'data-tone': 'err', role: 'alert' }, data.storageError)
      : null,
    result?.cacheOnly === true
      ? h(
          'p',
          { className: 'dpl-note', role: 'note' },
          '這是 SDK 快取中的貼文索引，可能尚未包含所有貼文；不代表完整即時清單。',
        )
      : null,
    emptyResult
      ? h(
          StateView,
          { kind: 'empty', title: '沒有結果' },
          result.cacheOnly
            ? '快取中目前沒有符合的貼文；稍後重試或改用機器人查詢。'
            : '查詢成功，但這個範圍內沒有符合的內容。',
        )
      : null,
    threads.length
      ? h(
          'div',
          { className: 'dpl-library-grid' },
          ...threads.map((post) =>
            h(
              'article',
              { className: 'dpl-asset', key: post.id },
              h('strong', { 'data-ui-verbatim': true }, post.name || post.id),
              h(
                'p',
                { className: 'dpl-mono' },
                'ID：' + post.id + ' · ' + (post.archived ? '已封存' : '使用中'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dpl-btn dpl-btn-sm',
                  disabled: busy,
                  onClick: () => {
                    setAction('post_read');
                    setForm({ ...form, postId: post.id });
                    run('query', { kind, channelId, action: 'post_read', postId: post.id, limit: 20 });
                  },
                },
                '讀取此貼文',
              ),
            ),
          ),
        )
      : null,
    rows.length
      ? h(
          'div',
          { className: 'dpl-hist-list', style: { maxHeight: 320 } },
          rows.map((m, index) =>
            h(
              'div',
              { className: 'dpl-list-row', key: m.id || index },
              h(
                'span',
                { className: 'dpl-hist-author', 'data-ui-verbatim': true },
                m.author?.name || m.author?.id || '未知',
              ),
              h(
                'span',
                {
                  'data-ui-verbatim': true,
                  style: { flex: '1 1 200px', minWidth: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
                },
                m.content || '（無文字）',
              ),
              m.id ? h('span', { className: 'dpl-mono' }, m.id) : null,
            ),
          ),
        )
      : null,
    result
      ? h(
          'details',
          { className: 'dpl-more' },
          h('summary', null, '原始回應'),
          h(
            'pre',
            {
              'data-ui-verbatim': true,
              style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 380, overflow: 'auto' },
            },
            JSON.stringify(result, null, 2),
          ),
        )
      : null,

    h('div', { className: 'dpl-subhead' }, '待確認操作（5 分鐘內有效）'),
    data === null && !error
      ? h(StateView, { kind: 'loading', title: '讀取操作紀錄…' })
      : (data?.plans || []).length
        ? null
        : h(
            StateView,
            { kind: 'empty', title: '沒有待確認的操作' },
            '選擇上方的操作並按「建立操作預覽」後，會出現在這裡等你確認。',
          ),
    ...(data?.plans || []).map((p) =>
      h(
        'article',
        { className: 'dpl-asset', key: p.id },
        h('strong', null, labels[p.action] || p.action),
        h(
          'p',
          { className: 'dpl-mono' },
          (p.kind === 'bot' ? '機器人' : '使用者帳號') + ' · 頻道 ' + p.channelId,
        ),
        argsView(p),
        p.warning ? h('p', { className: 'dpl-note' }, p.warning) : null,
        h(
          'button',
          {
            type: 'button',
            className: 'dpl-btn dpl-btn-primary',
            disabled: busy,
            onClick: () => run('confirm', { id: p.id, confirmed: true }),
          },
          '確認執行此操作',
        ),
      ),
    ),

    h('div', { className: 'dpl-subhead' }, '執行回報'),
    data !== null && !(data?.receipts || []).length
      ? h(
          StateView,
          { kind: 'empty', title: '尚無執行回報' },
          '確認執行過的操作會留下回報，顯示成功、被拒或結果不明。',
        )
      : null,
    ...(data?.receipts || [])
      .slice()
      .reverse()
      .map((r) => {
        const [text, tone] = stateLabel[r.state] || [r.state, 'muted'];
        return h(
          'article',
          { className: 'dpl-asset', key: r.id },
          h(
            'div',
            { className: 'dpl-actions' },
            h('strong', null, labels[r.action] || r.action),
            h(Pill, { tone }, text),
          ),
          h(
            'p',
            { className: 'dpl-mono' },
            (r.kind === 'bot' ? '機器人' : '使用者帳號') +
              ' · ' +
              nameOfId(r.channelId) +
              ' · ' +
              new Date(r.at).toLocaleString(),
          ),
          r.state === 'uncertain'
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'dpl-btn',
                  disabled: busy,
                  onClick: () => run('acknowledge', { id: r.id, confirmed: true }),
                },
                '已核對 Discord，解除此操作鎖定',
              )
            : null,
        );
      }),
  );
}
