function AssetLibrary({ onError }) {
  const [query, setQuery] = useState(''),
    [type, setType] = useState(''),
    [page, setPage] = useState(0),
    [reviewFilter, setReviewFilter] = useState('');
  const [listing, setListing] = useState({ assets: [], total: 0 }),
    [selected, setSelected] = useState(null),
    [edit, setEdit] = useState(null),
    [scope, setScope] = useState(''),
    [pending, setPending] = useState(false),
    [notice, setNotice] = useState('');
  const request = useRef(0);
  // 讀取失敗要和「真的沒有素材」分開顯示。
  const [loadError, setLoadError] = useState('');
  const load = async () => {
    const sequence = ++request.current;
    try {
      const result = await api(
        '/culture/assets?' +
          new URLSearchParams({
            query,
            type,
            reviewState: reviewFilter,
            offset: String(page * 24),
            limit: '24',
          }),
      );
      if (sequence === request.current) {
        setListing(result);
        setLoadError('');
      }
    } catch (e) {
      if (sequence === request.current) {
        setLoadError(e.message);
        onError(e.message);
      }
    }
  };
  useEffect(() => {
    const timer = setTimeout(load, 200);
    return () => {
      clearTimeout(timer);
      request.current++;
    };
  }, [query, type, page, reviewFilter]);
  const open = (a) => {
    setSelected(a);
    setEdit({
      manualName: a.manualName || '',
      manualDescription: a.manualDescription || '',
      manualMeanings: JSON.parse(JSON.stringify(a.manualMeanings || {})),
      favorite: !!a.favorite,
      disabledForReuse: !!a.disabledForReuse,
      reviewState: a.reviewState || 'unreviewed',
    });
    setScope(a.scopes[0] || '');
    setNotice('');
  };
  const changed =
    !!selected &&
    JSON.stringify(edit) !==
      JSON.stringify({
        manualName: selected.manualName || '',
        manualDescription: selected.manualDescription || '',
        manualMeanings: selected.manualMeanings || {},
        favorite: !!selected.favorite,
        disabledForReuse: !!selected.disabledForReuse,
        reviewState: selected.reviewState || 'unreviewed',
      });
  const update = (key, value) => setEdit((old) => ({ ...old, [key]: value }));
  const meaning = edit?.manualMeanings?.[scope] || { meaning: '', avoid: '' };
  const changeMeaning = (key, value) =>
    setEdit((old) => ({
      ...old,
      manualMeanings: {
        ...old.manualMeanings,
        [scope]: { ...(old.manualMeanings[scope] || { meaning: '', avoid: '' }), [key]: value },
      },
    }));
  const saveAsset = async () => {
    setPending(true);
    try {
      const asset = (
        await api('/culture/assets/update', {
          method: 'POST',
          body: { id: selected.id, expectedVersion: selected.editVersion, ...edit },
        })
      ).asset;
      open(asset);
      setNotice('已儲存；後續辨識及回覆會使用修正。既有日記與外部記憶不會被改寫。');
      await load();
    } catch (e) {
      onError(e.message);
    } finally {
      setPending(false);
    }
  };
  return h(
    Card,
    {
      title: '表情與 GIF 素材庫',
      icon: 'reaction',
      desc: '修正畫面辨識與群內用法。素材含義只提供給 AI 當參考，不會授予指令權限。',
    },
    h(
      'div',
      { className: 'dpl-actions' },
      h('input', {
        className: 'dpl-input',
        type: 'search',
        value: query,
        placeholder: '搜尋名稱、描述、群組 ID…',
        'aria-label': '搜尋素材',
        onChange: (e) => {
          setQuery(e.target.value);
          setPage(0);
        },
      }),
      h(
        'select',
        {
          className: 'dpl-select',
          value: type,
          'aria-label': '素材類型',
          onChange: (e) => {
            setType(e.target.value);
            setPage(0);
          },
        },
        ['', 'emoji', 'gif', 'sticker', 'image'].map((t, i) =>
          h('option', { key: t, value: t }, ['全部素材', '自訂表情', 'GIF', '貼圖', '圖片'][i]),
        ),
      ),
      h(
        'select',
        {
          className: 'dpl-select',
          value: reviewFilter,
          'aria-label': '素材審閱篩選',
          onChange: (e) => {
            setReviewFilter(e.target.value);
            setPage(0);
          },
        },
        [
          ['', '全部審閱狀態'],
          ['unreviewed', '待審閱'],
          ['confirmed', '已確認'],
          ['ignored', '已略過'],
        ].map(([value, label]) => h('option', { key: value, value }, label)),
      ),
      h('span', null, listing.total + ' 個素材'),
    ),
    selected
      ? h(
          'div',
          { className: 'dpl-asset selected' },
          h('h3', null, '編輯 ' + (selected.name || selected.id)),
          h(
            'p',
            { className: 'dpl-row-help' },
            '名稱與畫面修正適用相同素材；使用情境只套用至下方選擇的群組／私聊。留空即可取消手動修正。',
          ),
          h(
            'label',
            null,
            '審閱狀態',
            h(
              'select',
              {
                className: 'dpl-select',
                'aria-label': '素材審閱狀態',
                value: edit.reviewState,
                onChange: (e) => update('reviewState', e.target.value),
              },
              [
                ['unreviewed', '待審閱'],
                ['confirmed', '已確認'],
                ['ignored', '已略過'],
              ].map(([v, t]) => h('option', { key: v, value: v }, t)),
            ),
          ),
          h(
            'label',
            null,
            h('input', {
              type: 'checkbox',
              checked: edit.favorite,
              onChange: (e) => update('favorite', e.target.checked),
            }),
            ' 偏好選用此素材',
          ),
          h(
            'label',
            null,
            h('input', {
              type: 'checkbox',
              checked: edit.disabledForReuse,
              onChange: (e) => update('disabledForReuse', e.target.checked),
            }),
            ' 禁止 AI 重用（仍可理解收到的素材）',
          ),
          h(
            'details',
            null,
            h('summary', null, '查看本範圍使用證據'),
            h('p', null, '累計 ' + (selected.evidence?.[scope]?.count || 0) + ' 次'),
            ...(selected.evidence?.[scope]?.examples || []).map((e) =>
              h('p', { key: e.messageId }, e.userId + '：' + (e.text || '[素材]')),
            ),
          ),
          h(
            'label',
            null,
            '顯示名稱',
            h('input', {
              className: 'dpl-input',
              value: edit.manualName,
              maxLength: 100,
              placeholder: selected.originalName,
              onChange: (e) => update('manualName', e.target.value),
            }),
          ),
          h(
            'details',
            null,
            h('summary', null, '查看原始 AI 辨識'),
            h('p', null, selected.modelDescription || '尚未辨識'),
          ),
          h(
            'label',
            null,
            '畫面描述修正',
            h('textarea', {
              className: 'dpl-textarea',
              value: edit.manualDescription,
              rows: 3,
              maxLength: 2500,
              placeholder: '例如：角色一邊哭一邊比讚；字幕是「沒事」',
              onChange: (e) => update('manualDescription', e.target.value),
            }),
          ),
          h(
            'label',
            null,
            '用法適用範圍',
            h(
              'select',
              { className: 'dpl-select', value: scope, onChange: (e) => setScope(e.target.value) },
              selected.scopes.map((x) =>
                h(
                  'option',
                  { key: x, value: x },
                  x.startsWith('guild:') ? '伺服器 ' + x.slice(6) : '私聊 ' + x.slice(3),
                ),
              ),
            ),
          ),
          scope
            ? h(
                'div',
                null,
                h(
                  'label',
                  null,
                  '含義與適合情境',
                  h('textarea', {
                    className: 'dpl-textarea',
                    rows: 3,
                    maxLength: 2000,
                    value: meaning.meaning,
                    onChange: (e) => changeMeaning('meaning', e.target.value),
                    placeholder: '例如：本群用來自嘲「又搞砸了」，不是在生氣。',
                  }),
                ),
                h(
                  'label',
                  null,
                  '避免使用的情境',
                  h('textarea', {
                    className: 'dpl-textarea',
                    rows: 2,
                    maxLength: 2000,
                    value: meaning.avoid,
                    onChange: (e) => changeMeaning('avoid', e.target.value),
                  }),
                ),
              )
            : null,
          h(
            'div',
            { className: 'dpl-actions' },
            h(
              'button',
              { className: 'dpl-btn dpl-btn-primary', disabled: pending || !changed, onClick: saveAsset },
              pending ? '儲存中…' : '儲存素材修正',
            ),
            h(
              'button',
              {
                className: 'dpl-btn',
                disabled: pending,
                onClick: () => {
                  setSelected(null);
                  setEdit(null);
                },
              },
              changed ? '放棄並關閉' : '關閉編輯',
            ),
            h(
              'button',
              {
                className: 'dpl-btn',
                disabled: pending || changed,
                onClick: async () => {
                  setPending(true);
                  try {
                    const cleared = await api('/culture/invalidate', {
                      method: 'POST',
                      body: { id: selected.id },
                    });
                    open(cleared.asset);
                    setNotice(
                      '已清除原始 AI 辨識，下次遇到素材時重新辨識。手動修正仍優先；要重新辨識請先將畫面修正留空並儲存。',
                    );
                    await load();
                  } catch (e) {
                    onError(e.message);
                  } finally {
                    setPending(false);
                  }
                },
              },
              '清除 AI 辨識',
            ),
          ),
          h('p', { role: 'status' }, notice || (changed ? '素材修正尚未儲存（與上方設定分開儲存）。' : '')),
        )
      : null,
    loadError
      ? h(
          StateView,
          {
            kind: 'error',
            title: '讀不到素材清單',
            action: h('button', { type: 'button', className: 'dpl-btn dpl-btn-sm', onClick: load }, '重試'),
          },
          loadError,
        )
      : !listing.assets.length
        ? h(
            StateView,
            { kind: 'empty', title: query || type || reviewFilter ? '找不到符合的素材' : '還沒有素材' },
            query || type || reviewFilter
              ? '找不到符合的素材。'
              : '收到圖片、GIF 或表情後，已辨識素材會出現在這裡。',
          )
        : h(
            'div',
            { className: 'dpl-library-grid' },
            listing.assets.map((a) =>
              h(
                'article',
                { key: a.id, className: 'dpl-asset' },
                h('strong', null, a.name || a.id),
                h('span', { className: 'dpl-badge' }, a.type),
                h('p', null, (a.description || '尚未辨識').slice(0, 220)),
                h(
                  'small',
                  null,
                  a.scopes.length + ' 個使用範圍' + (a.manualDescription ? ' · 已手動修正' : ''),
                ),
                h(
                  'div',
                  null,
                  h(
                    'button',
                    { className: 'dpl-btn dpl-btn-sm', disabled: pending || changed, onClick: () => open(a) },
                    '編輯描述與用法',
                  ),
                ),
              ),
            ),
          ),
    h(
      'div',
      { className: 'dpl-actions' },
      h(
        'button',
        { className: 'dpl-btn', disabled: page === 0, onClick: () => setPage((x) => x - 1) },
        '上一頁',
      ),
      h('span', null, '第 ' + (page + 1) + ' 頁'),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: (page + 1) * 24 >= listing.total,
          onClick: () => setPage((x) => x + 1),
        },
        '下一頁',
      ),
    ),
  );
}
