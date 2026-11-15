function UserConversationDesk({ status, adminUserId }) {
  const [view, setView] = useState('inbox'),
    [channel, setChannel] = useState(''),
    [channels, setChannels] = useState([]),
    [duration, setDuration] = useState('1800');
  const [inbox, setInbox] = useState({ items: [] }),
    [reviewData, setReviewData] = useState({ drafts: [] }),
    [reviewEdit, setReviewEdit] = useState(null),
    [reviewText, setReviewText] = useState(''),
    [keepReviewMedia, setKeepReviewMedia] = useState(true),
    [takeover, setTakeover] = useState({ entries: [] }),
    [query, setQuery] = useState(''),
    [stickers, setStickers] = useState([]),
    [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(''),
    [notice, setNotice] = useState(''),
    [replyItem, setReplyItem] = useState(null),
    [replyText, setReplyText] = useState(''),
    [editing, setEditing] = useState(null),
    [editText, setEditText] = useState(''),
    [deleteEntry, setDeleteEntry] = useState(null);
  // 草稿批次處理：勾選的草稿 ID，以及「核准所選」的二次確認狀態。
  const [picked, setPicked] = useState([]),
    [confirmBatch, setConfirmBatch] = useState(false);
  const refresh = async () => {
    const rows = await Promise.all([api('/user-inbox'), api('/user-takeover'), api('/user-review')]);
    setInbox(rows[0]);
    setTakeover(rows[1]);
    setReviewData(rows[2]);
    return rows;
  };
  useEffect(() => {
    refresh().catch((e) => setNotice(e.message));
    const timer = setInterval(() => pageHidden() || refresh().catch(() => {}), 10000);
    return () => clearInterval(timer);
  }, []);
  const run = async (key, work) => {
    if (busy) return;
    setBusy(key);
    setNotice('');
    try {
      await work();
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy('');
    }
  };
  const loadMessages = async () => {
    const r = await api('/messages?transport=user&limit=30&channelId=' + encodeURIComponent(channel));
    setMessages(
      (r.messages || [])
        .filter((m) => String(m.author?.id) === String(status?.user?.id))
        .map((m) => ({ ...m, channelId: channel })),
    );
  };
  const changeChannel = (value) => {
    setChannel(value);
    setMessages([]);
    setStickers([]);
    setDeleteEntry(null);
  };
  useIdNames([
    ...(inbox.items || []).flatMap((item) => [item.channelId, item.authorId]),
    ...(reviewData.drafts || []).flatMap((row) => [row.source?.channelId, row.source?.author?.id]),
    ...(takeover.entries || []).map((row) => row.channelId),
  ]);
  const canWrite = !!status?.ok && status?.receiveOnly !== true;
  const drafts = reviewData.drafts || [];
  const approvable = (row) => ['pending', 'failed'].includes(row.state);
  const discardable = (row) => !['sending', 'uncertain'].includes(row.state);
  const pickedRows = drafts.filter((row) => picked.includes(row.id));
  const togglePick = (id) => {
    setConfirmBatch(false);
    setPicked((previous) => (previous.includes(id) ? previous.filter((x) => x !== id) : [...previous, id]));
  };
  // 逐則走原本的核准／捨棄接口：每一則都由後端重新核對來源、帳號與版本，任何一則失敗不影響其他則。
  const batch = (action) =>
    run('batch-' + action, async () => {
      const rows = pickedRows.filter(action === 'approve' ? approvable : discardable);
      let done = 0;
      const failed = [];
      for (const row of rows) {
        try {
          const r = await api('/user-review/' + action, {
            method: 'POST',
            allowFailure: true,
            body:
              action === 'approve'
                ? { id: row.id, version: row.version, content: row.content || '', keepMedia: true }
                : { id: row.id, version: row.version },
          });
          if (r?.ok === false) failed.push(r.error || '未完成');
          else done += 1;
        } catch (e) {
          failed.push(e.message);
        }
      }
      setPicked([]);
      setConfirmBatch(false);
      if (reviewEdit && rows.some((row) => row.id === reviewEdit.id)) setReviewEdit(null);
      await refresh();
      setNotice(
        (action === 'approve' ? '已核准送出 ' : '已捨棄 ') +
          done +
          ' 則' +
          (failed.length ? '；' + failed.length + ' 則未完成：' + [...new Set(failed)].slice(0, 3).join('、') : '。'),
      );
    });
  const channelLabel = channels.find((c) => c.id === channel)?.name || channel;
  const incoming = [...(inbox.items || [])].sort(
    (a, b) =>
      Number(b.authorId === adminUserId) - Number(a.authorId === adminUserId) || b.receivedAt - a.receivedAt,
  );
  return h(
    Card,
    {
      title: '個人帳號對話工作台',
      icon: 'chat',
      desc: '新私訊與直接 @ 進入待回覆清單。AI 成功回覆後移出；手動回覆會先接管 30 分鐘。在桌面回覆後可標為已處理。',
    },
    h(Segmented, {
      value: view,
      onChange: setView,
      options: [
        { value: 'inbox', label: '待回覆 ' + (inbox.total || 0) },
        { value: 'review', label: '草稿 ' + (reviewData.drafts?.length || 0) },
        { value: 'takeover', label: '人工接管' },
        { value: 'tools', label: '貼圖與訊息' },
      ],
    }),
    !canWrite
      ? h(
          'div',
          { className: 'dpl-note', 'data-tone': 'warn', role: 'note' },
          status?.ok
            ? '帳號目前是「僅觀察連線」，回覆、送出與撤回按鈕已停用。可在下方「接收與回覆」關閉僅觀察並儲存。'
            : '使用者帳號尚未連線，回覆、送出與撤回按鈕已停用。請先在上方的帳號卡連線。',
        )
      : null,
    notice ? h('div', { className: 'dpl-note', role: 'status' }, notice) : null,
    view === 'inbox'
      ? h(
          'div',
          null,
          h(
            'button',
            { className: 'dpl-btn dpl-btn-sm', disabled: !!busy, onClick: () => run('refresh', refresh) },
            '重新整理收件匣',
          ),
          inbox.truncated
            ? h(
                'p',
                { className: 'dpl-row-help' },
                '收件匣已達 1000 筆保存上限，部分較舊項目已移出。完整來源請查看聊天快取或記憶輸出。',
              )
            : null,
          !incoming.length
            ? h('div', { className: 'dpl-empty' }, '目前沒有待回覆訊息。')
            : incoming.map((item) =>
                h(
                  'article',
                  { className: 'dpl-asset', key: item.id },
                  h('strong', null, item.author),
                  item.authorId === adminUserId ? h('span', { className: 'dpl-badge' }, '管理者') : null,
                  h(
                    'small',
                    { style: { display: 'block' } },
                    (item.guildId ? '伺服器 @' : '私訊') +
                      ' · ' +
                      new Date(item.receivedAt).toLocaleString() +
                      ' · ' +
                      nameOfId(item.channelId),
                  ),
                  h('p', null, item.content),
                  item.reason ? h('p', { className: 'dpl-row-help' }, '目前狀態：' + item.reason) : null,
                  h(
                    'div',
                    { className: 'dpl-actions' },
                    h(
                      'button',
                      {
                        className: 'dpl-btn dpl-btn-sm',
                        disabled: !!busy || !canWrite || !!replyItem,
                        onClick: () =>
                          run('manual-reply', async () => {
                            await api('/user-takeover', {
                              method: 'POST',
                              body: {
                                action: 'pause',
                                channelId: item.channelId,
                                label: item.author,
                                seconds: 1800,
                              },
                            });
                            setReplyItem(item);
                            setReplyText('');
                            await refresh();
                          }),
                      },
                      '手動回覆',
                    ),
                    h(
                      'button',
                      {
                        className: 'dpl-btn dpl-btn-sm',
                        disabled: !!busy || !item.canRetry,
                        onClick: () =>
                          run('retry', async () => {
                            await api('/user-inbox/retry', { method: 'POST', body: { messageId: item.id } });
                            await refresh();
                            setNotice('已重新判斷；請查看最新原因或待審草稿。');
                          }),
                      },
                      '重新產生／重試',
                    ),
                    h(
                      'button',
                      {
                        className: 'dpl-btn dpl-btn-sm',
                        disabled: !!busy,
                        onClick: () =>
                          run('resolve', async () => {
                            await api('/user-inbox/resolve', {
                              method: 'POST',
                              body: { messageId: item.id },
                            });
                            if (replyItem?.id === item.id) setReplyItem(null);
                            await refresh();
                          }),
                      },
                      '標為已處理',
                    ),
                    h(
                      'button',
                      {
                        className: 'dpl-btn dpl-btn-sm',
                        disabled: !!busy,
                        onClick: () => {
                          changeChannel(item.channelId);
                          setView('takeover');
                        },
                      },
                      '接管此對話',
                    ),
                  ),
                ),
              ),
          replyItem
            ? h(
                'div',
                { className: 'dpl-asset selected' },
                h('strong', { title: 'ID：' + replyItem.channelId }, '回覆 ' + replyItem.author + ' · ' + nameOfId(replyItem.channelId)),
                h('textarea', {
                  className: 'dpl-textarea',
                  rows: 3,
                  maxLength: 2000,
                  value: replyText,
                  onChange: (e) => setReplyText(e.target.value),
                  'aria-label': '手動回覆內容',
                }),
                h(
                  'button',
                  {
                    className: 'dpl-btn dpl-btn-primary',
                    disabled: !!busy || !canWrite || !replyText.trim(),
                    onClick: () =>
                      run('reply', async () => {
                        await api('/send', {
                          method: 'POST',
                          body: {
                            transport: 'user',
                            channelId: replyItem.channelId,
                            replyToMessageId: replyItem.id,
                            content: replyText,
                          },
                        });
                        setReplyItem(null);
                        setReplyText('');
                        await refresh();
                        setNotice('手動回覆已送出。');
                      }),
                  },
                  '以個人帳號送出',
                ),
                h(
                  'button',
                  { className: 'dpl-btn', disabled: !!busy, onClick: () => setReplyItem(null) },
                  '取消回覆',
                ),
              )
            : null,
        )
      : null,
    view === 'review'
      ? h(
          'div',
          null,
          h(
            'p',
            { className: 'dpl-row-help' },
            '草稿尚未送往 Discord。送出前會重新核對來源內容、帳號及發送設定。結果不確定的項目禁止重送。',
          ),
          drafts.length > 1
            ? h(
                'div',
                { className: 'dpl-actions', 'data-draft-batch': '1' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dpl-btn dpl-btn-sm',
                    disabled: !!busy,
                    onClick: () => {
                      setConfirmBatch(false);
                      setPicked(picked.length === drafts.length ? [] : drafts.map((row) => row.id));
                    },
                  },
                  picked.length === drafts.length ? '取消全選' : '全選',
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dpl-btn dpl-btn-sm dpl-btn-primary',
                    disabled: !!busy || !canWrite || !pickedRows.some(approvable),
                    onClick: () => (confirmBatch ? batch('approve') : setConfirmBatch(true)),
                  },
                  confirmBatch
                    ? '再按一次，照原稿送出 ' + pickedRows.filter(approvable).length + ' 則'
                    : '核准所選（' + pickedRows.filter(approvable).length + '）',
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dpl-btn dpl-btn-sm dpl-btn-danger',
                    disabled: !!busy || !pickedRows.some(discardable),
                    onClick: () => batch('discard'),
                  },
                  '捨棄所選（' + pickedRows.filter(discardable).length + '）',
                ),
                confirmBatch
                  ? h('span', { className: 'dpl-row-help', role: 'status' }, '所選草稿會不經修改直接送到 Discord。')
                  : null,
              )
            : null,
          ...(reviewData.drafts || []).map((row) =>
            h(
              'article',
              { className: 'dpl-asset', key: row.id },
              drafts.length > 1
                ? h(
                    'label',
                    { style: { display: 'inline-flex', gap: 6, alignItems: 'center', marginRight: 8 } },
                    h('input', {
                      type: 'checkbox',
                      'aria-label': '選取這則草稿',
                      checked: picked.includes(row.id),
                      disabled: !!busy,
                      onChange: () => togglePick(row.id),
                    }),
                  )
                : null,
              h(
                'strong',
                null,
                (row.source.author?.name || nameOfId(row.source.author?.id)) + ' · ' + nameOfId(row.source.channelId),
              ),
              h(
                'small',
                { style: { display: 'block' } },
                '狀態：' + row.state + ' · 媒體 ' + row.mediaCount + ' 個',
              ),
              h('p', null, row.source.content || '[媒體訊息]'),
              h('p', null, row.content || '[僅媒體草稿]'),
              row.mediaCount
                ? h('p', { className: 'dpl-row-help' }, '媒體內容：' + JSON.stringify(row.media || {}))
                : null,
              row.error ? h('p', { className: 'dpl-row-help' }, row.error) : null,
              h(
                'div',
                { className: 'dpl-actions' },
                h(
                  'button',
                  {
                    className: 'dpl-btn',
                    disabled: !!busy || !['pending', 'failed'].includes(row.state),
                    onClick: () => {
                      setReviewEdit(row);
                      setReviewText(row.content || '');
                      setKeepReviewMedia(true);
                    },
                  },
                  '編輯與核准',
                ),
                h(
                  'button',
                  {
                    className: 'dpl-btn dpl-btn-danger',
                    disabled: !!busy || ['sending', 'uncertain'].includes(row.state),
                    onClick: () =>
                      run('discard-draft', async () => {
                        await api('/user-review/discard', {
                          method: 'POST',
                          body: { id: row.id, version: row.version },
                        });
                        if (reviewEdit?.id === row.id) setReviewEdit(null);
                        await refresh();
                      }),
                  },
                  '捨棄草稿',
                ),
                row.state === 'uncertain'
                  ? h(
                      'button',
                      {
                        className: 'dpl-btn',
                        disabled: !!busy,
                        onClick: () =>
                          run('archive-uncertain', async () => {
                            await api('/user-review/discard', {
                              method: 'POST',
                              body: { id: row.id, version: row.version, acknowledgeUncertain: true },
                            });
                            if (reviewEdit?.id === row.id) setReviewEdit(null);
                            await refresh();
                            setNotice('已封存不確定紀錄；不會重送，也不再提供此來源的重試。');
                          }),
                      },
                      '我已核對，封存並禁止重送',
                    )
                  : null,
              ),
            ),
          ),
          !(reviewData.drafts || []).length
            ? h('div', { className: 'dpl-empty' }, '沒有待審草稿。可在四種對象設定中選擇「先審稿」。')
            : null,
          reviewEdit
            ? h(
                'div',
                { className: 'dpl-asset selected' },
                h('strong', { title: 'ID：' + reviewEdit.source.channelId }, '核准送往 ' + nameOfId(reviewEdit.source.channelId)),
                h('textarea', {
                  className: 'dpl-textarea',
                  rows: 5,
                  maxLength: 2000,
                  value: reviewText,
                  'aria-label': '核准草稿內容',
                  onChange: (e) => setReviewText(e.target.value),
                }),
                h(
                  'label',
                  null,
                  h('input', {
                    type: 'checkbox',
                    checked: keepReviewMedia,
                    onChange: (e) => setKeepReviewMedia(e.target.checked),
                  }),
                  ' 保留原草稿貼圖／附件（' + reviewEdit.mediaCount + ' 個）',
                ),
                h(
                  'button',
                  {
                    className: 'dpl-btn dpl-btn-primary',
                    disabled: !!busy || !canWrite || !['pending', 'failed'].includes(reviewEdit.state),
                    onClick: () =>
                      run('approve-draft', async () => {
                        const r = await api('/user-review/approve', {
                          method: 'POST',
                          allowFailure: true,
                          body: {
                            id: reviewEdit.id,
                            version: reviewEdit.version,
                            content: reviewText,
                            keepMedia: keepReviewMedia,
                          },
                        });
                        const fresh = await refresh();
                        if (!r.ok) {
                          setReviewEdit(
                            (fresh[2].drafts || []).find((row) => row.id === reviewEdit.id) || null,
                          );
                          setNotice(r.error);
                          return;
                        }
                        setReviewEdit(null);
                        setNotice('核准回覆已送出。');
                      }),
                  },
                  '核准並送出',
                ),
                h(
                  'button',
                  { className: 'dpl-btn', disabled: !!busy, onClick: () => setReviewEdit(null) },
                  '保留草稿，關閉編輯',
                ),
              )
            : null,
        )
      : null,
    view === 'takeover' || view === 'tools'
      ? h(
          'div',
          null,
          h(
            'div',
            { className: 'dpl-actions', style: { margin: '12px 0' } },
            h(
              'button',
              {
                className: 'dpl-btn',
                disabled: !!busy || !status?.ok || !!editing,
                onClick: () =>
                  run('channels', async () => {
                    const r = await api('/channels?transport=user');
                    setChannels(
                      (r.channels || []).filter(
                        (c) => !['voice', 'category', 'stage_voice'].includes(c.type),
                      ),
                    );
                    setNotice('已載入對話，亦可直接貼上頻道 ID。');
                  }),
              },
              '載入對話列表',
            ),
            channels.length
              ? h(
                  'select',
                  {
                    className: 'dpl-select',
                    value: channel,
                    disabled: !!editing || !!busy,
                    'aria-label': '選擇對話',
                    onChange: (e) => changeChannel(e.target.value),
                  },
                  h('option', { value: '' }, '選擇私訊或伺服器頻道'),
                  !channels.some((c) => c.id === channel) && channel
                    ? h('option', { value: channel }, channel)
                    : null,
                  channels.map((c) =>
                    h('option', { key: c.id, value: c.id }, (c.guildId ? '# ' : '私訊 · ') + c.name),
                  ),
                )
              : null,
            h('input', {
              className: 'dpl-input',
              value: channel,
              disabled: !!editing || !!busy,
              'aria-label': '對話頻道 ID',
              placeholder: '或貼上對話頻道 ID',
              onChange: (e) => changeChannel(e.target.value.trim()),
            }),
          ),
          view === 'takeover'
            ? h(
                'div',
                null,
                h(
                  'p',
                  { className: 'dpl-row-help' },
                  '接管會立即取消此對話中尚未送出的 AI 回覆，暫停文字、typing 與自動表情。聊天及管理者記憶仍照常記錄；Bot 身分的回覆不受影響。恢復後只處理新訊息。',
                ),
                h(
                  'div',
                  { className: 'dpl-actions' },
                  h(
                    'select',
                    {
                      className: 'dpl-select',
                      value: duration,
                      'aria-label': '接管時間',
                      onChange: (e) => setDuration(e.target.value),
                    },
                    [
                      { value: '900', label: '15 分鐘' },
                      { value: '1800', label: '30 分鐘' },
                      { value: '3600', label: '1 小時' },
                      { value: '0', label: '直到手動恢復' },
                    ].map((o) => h('option', { key: o.value, value: o.value }, o.label)),
                  ),
                  h(
                    'button',
                    {
                      className: 'dpl-btn dpl-btn-primary',
                      disabled: !!busy || !/^\d{15,22}$/.test(channel),
                      onClick: () =>
                        run('pause', async () => {
                          await api('/user-takeover', {
                            method: 'POST',
                            body: {
                              action: 'pause',
                              channelId: channel,
                              label: channelLabel,
                              seconds: Number(duration),
                            },
                          });
                          await refresh();
                          setNotice('此對話已由人工接管。');
                        }),
                    },
                    '接管此對話',
                  ),
                ),
                !(takeover.entries || []).length
                  ? h('p', null, '目前沒有接管中的對話。')
                  : (takeover.entries || []).map((row) =>
                      h(
                        'div',
                        { key: row.channelId, className: 'dpl-note' },
                        h('strong', { title: 'ID：' + row.channelId }, row.label || nameOfId(row.channelId)),
                        h(
                          'p',
                          null,
                          row.until ? '自動恢復：' + new Date(row.until).toLocaleString() : '直到手動恢復',
                        ),
                        h(
                          'button',
                          {
                            className: 'dpl-btn dpl-btn-primary',
                            disabled: !!busy,
                            onClick: () =>
                              run('resume', async () => {
                                await api('/user-takeover', {
                                  method: 'POST',
                                  body: { action: 'resume', channelId: row.channelId },
                                });
                                await refresh();
                              }),
                          },
                          '恢復 AI',
                        ),
                      ),
                    ),
              )
            : h(
                'div',
                null,
                h(
                  'p',
                  { className: 'dpl-row-help' },
                  '操作對象：' +
                    (channelLabel || '尚未選擇對話') +
                    '。貼圖發送、訊息編輯與撤回都會以個人帳號執行。',
                ),
                h(
                  'div',
                  { className: 'dpl-actions' },
                  h('input', {
                    className: 'dpl-input',
                    value: query,
                    'aria-label': '貼圖搜尋關鍵字',
                    placeholder: '貼圖名稱、描述或關鍵字',
                    onChange: (e) => setQuery(e.target.value),
                  }),
                  h(
                    'button',
                    {
                      className: 'dpl-btn',
                      disabled: !!busy || !status?.ok || !channel,
                      onClick: () =>
                        run('stickers', async () => {
                          const r = await api(
                            '/stickers?transport=user&channelId=' +
                              encodeURIComponent(channel) +
                              '&q=' +
                              encodeURIComponent(query),
                          );
                          setStickers(r.stickers || []);
                          setNotice(
                            r.warning || r.note || (r.stickers?.length ? '已找到貼圖。' : '沒有符合的貼圖。'),
                          );
                        }),
                    },
                    '搜尋貼圖',
                  ),
                ),
                h(
                  'div',
                  { className: 'dpl-library-grid' },
                  stickers.map((s) =>
                    h(
                      'article',
                      { className: 'dpl-asset', key: s.id },
                      h('strong', null, s.name),
                      !String(s.format).includes('lottie') && s.url
                        ? h('img', {
                            src: s.url,
                            alt: s.name,
                            loading: 'lazy',
                            style: { display: 'block', width: 96, height: 96, objectFit: 'contain' },
                          })
                        : null,
                      h('p', null, s.description || ''),
                      h(
                        'small',
                        null,
                        s.kind === 'standard' ? '官方貼圖 · 發送資格由 Discord 判定' : '目前伺服器貼圖',
                      ),
                      h(
                        'div',
                        null,
                        h(
                          'button',
                          {
                            className: 'dpl-btn',
                            disabled: !!busy || !canWrite,
                            onClick: () =>
                              run('send-sticker', async () => {
                                await api('/send', {
                                  method: 'POST',
                                  body: {
                                    transport: 'user',
                                    channelId: channel,
                                    type: 'sticker',
                                    stickerId: s.id,
                                  },
                                });
                                setNotice('貼圖已送出。');
                              }),
                          },
                          '傳送此貼圖',
                        ),
                      ),
                    ),
                  ),
                ),
                h('hr', { style: { border: 0, borderTop: '1px solid var(--dpl-line)', margin: '18px 0' } }),
                h(
                  'button',
                  {
                    className: 'dpl-btn',
                    disabled: !!busy || !status?.ok || !channel || !!editing,
                    onClick: () => run('messages', loadMessages),
                  },
                  '載入自己的最近訊息',
                ),
                h(
                  'p',
                  { className: 'dpl-row-help' },
                  '只列此對話最近 30 則中的自己訊息。編輯只修改文字，保留原附件；撤回無法復原。',
                ),
                messages.map((m) =>
                  h(
                    'article',
                    { key: m.id, className: 'dpl-asset' },
                    h('small', null, m.id),
                    h('p', null, m.content || '[附件或貼圖]'),
                    h(
                      'div',
                      { className: 'dpl-actions' },
                      h(
                        'button',
                        {
                          className: 'dpl-btn',
                          disabled: !!busy || !canWrite || !!editing,
                          onClick: () => {
                            setEditing(m);
                            setEditText(m.content || '');
                            setDeleteEntry(null);
                          },
                        },
                        '編輯文字',
                      ),
                      h(
                        'button',
                        {
                          className: 'dpl-btn dpl-btn-danger',
                          disabled: !!busy || !canWrite || !!editing,
                          onClick: () => setDeleteEntry(m),
                        },
                        '撤回訊息',
                      ),
                    ),
                  ),
                ),
                editing
                  ? h(
                      'div',
                      { className: 'dpl-asset selected' },
                      h('strong', null, '編輯訊息 ' + editing.id),
                      h('textarea', {
                        className: 'dpl-textarea',
                        rows: 3,
                        maxLength: 2000,
                        value: editText,
                        'aria-label': '修正訊息內容',
                        onChange: (e) => setEditText(e.target.value),
                      }),
                      h(
                        'button',
                        {
                          className: 'dpl-btn dpl-btn-primary',
                          disabled: !!busy || !canWrite || !editText.trim() || editText === editing.content,
                          onClick: () =>
                            run('edit', async () => {
                              await api('/user-message/edit', {
                                method: 'POST',
                                body: {
                                  channelId: editing.channelId,
                                  messageId: editing.id,
                                  content: editText,
                                },
                              });
                              setEditing(null);
                              await loadMessages();
                              setNotice('訊息文字已更新。');
                            }),
                        },
                        '儲存訊息修正',
                      ),
                      h(
                        'button',
                        { className: 'dpl-btn', disabled: !!busy, onClick: () => setEditing(null) },
                        '取消編輯',
                      ),
                    )
                  : null,
                deleteEntry
                  ? h(
                      'div',
                      { className: 'dpl-note' },
                      h('strong', null, '確定撤回這則訊息？'),
                      h('p', null, deleteEntry.content || '[附件或貼圖]'),
                      h(
                        'button',
                        {
                          className: 'dpl-btn dpl-btn-danger',
                          disabled: !!busy || !canWrite,
                          onClick: () =>
                            run('delete', async () => {
                              await api('/user-message/delete', {
                                method: 'POST',
                                body: {
                                  channelId: deleteEntry.channelId,
                                  messageId: deleteEntry.id,
                                  confirmed: true,
                                },
                              });
                              setDeleteEntry(null);
                              await loadMessages();
                              setNotice('訊息已撤回。');
                            }),
                        },
                        '確認撤回',
                      ),
                      h(
                        'button',
                        { className: 'dpl-btn', disabled: !!busy, onClick: () => setDeleteEntry(null) },
                        '保留訊息',
                      ),
                    )
                  : null,
              ),
        )
      : null,
  );
}
