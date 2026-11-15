// 設定的變更預覽、復原與匯出／匯入。
//
// 預覽與復原只顯示「欄位名稱：原值 → 新值」；Token 與金鑰只顯示「將更新」，不顯示內容。

// 把設定值寫成人看得懂的文字。
function describeValue(field, value) {
  if (field?.secret) return value ? '將更新' : '不變';
  if (typeof value === 'boolean') return value ? '開啟' : '關閉';
  if (Array.isArray(value)) {
    if (!value.length) return '（空）';
    const shown = value.slice(0, 4).map((item) => nameOfId(item));
    return shown.join('、') + (value.length > 4 ? ' 等 ' + value.length + ' 項' : '');
  }
  if (value === '' || value === null || value === undefined) return '（空白）';
  const option = (field?.options || []).find((item) => String(item.value) === String(value));
  if (option) return option.label ?? String(option.value);
  const text = looksLikeId(String(value)) ? nameOfId(value) : String(value);
  return text.length > 60 ? text.slice(0, 60) + '…' : text;
}

// 「這次會改哪些」清單。rows：[{ key, from, to }]。
function ChangeList({ fields, rows }) {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  return h(
    'ul',
    { className: 'dpl-change-list', 'data-change-list': rows.length },
    rows.map((row) => {
      const field = byKey.get(row.key);
      return h(
        'li',
        { key: row.key },
        h('span', null, field?.label || row.key),
        h(
          'strong',
          null,
          field?.secret ? describeValue(field, row.to) : describeValue(field, row.from) + ' → ' + describeValue(field, row.to),
        ),
      );
    }),
  );
}

function ConfigTools({ fields, onApplied, onError }) {
  const [entries, setEntries] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(null); // 匯入預覽：{ payload, changes, ignored }
  const fileRef = useRef(null);
  const load = async () => {
    try {
      setEntries((await api('/config/history')).entries || []);
    } catch (err) {
      setEntries([]);
      setError(err.message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  useIdNames(
    (entries || []).flatMap((entry) =>
      entry.changes.flatMap((change) => [change.from, change.to].flat().filter((value) => typeof value === 'string')),
    ),
  );
  const run = async (key, work) => {
    if (busy) return;
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (err) {
      setError(err.message);
      onError?.(err.message);
    } finally {
      setBusy('');
    }
  };
  const undo = (entry) =>
    run('undo:' + entry.id, async () => {
      const result = await api('/config/undo', { method: 'POST', body: { id: entry.id } });
      setNotice('已復原 ' + (result.changed || []).length + ' 項設定。');
      await load();
      await onApplied?.();
    });
  const download = (share) =>
    run('export', async () => {
      const payload = (await api('/config/export' + (share ? '?share=1' : ''))).export;
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'discord-cyberfriend-settings' + (share ? '-share' : '') + '.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setNotice(share ? '已匯出分享用設定（不含 Token、金鑰、個人 ID 與名單）。' : '已匯出設定（不含 Token 與金鑰）。');
    });
  const readImport = (file) =>
    run('import-preview', async () => {
      if (!file) return;
      if (file.size > 1024 * 1024) throw new Error('檔案太大，設定匯出檔應小於 1 MB');
      let payload;
      try {
        payload = JSON.parse(await file.text());
      } catch {
        throw new Error('檔案不是有效的 JSON');
      }
      const preview = await api('/config/import', { method: 'POST', body: { payload } });
      setPending({ payload, changes: preview.changes || [], ignored: preview.ignored || [] });
    });
  const applyImport = () =>
    run('import-apply', async () => {
      const result = await api('/config/import', { method: 'POST', body: { payload: pending.payload, confirmed: true } });
      setPending(null);
      if (fileRef.current) fileRef.current.value = '';
      setNotice('已匯入 ' + (result.applied || 0) + ' 項設定。');
      await load();
      await onApplied?.();
    });
  const sourceLabel = { ui: '設定介面', undo: '復原', import: '匯入', tool: 'AI 工具' };
  return h(
    Card,
    {
      title: '設定備份與復原',
      icon: 'history',
      desc: '改錯了可以回到上一次儲存前的值；換電腦或分享給朋友時可匯出設定。Token 與金鑰不會被匯出，也不會記在復原紀錄裡。',
    },
    h(
      'div',
      { className: 'dpl-actions', 'data-config-tools': '1' },
      h(
        'button',
        { type: 'button', className: 'dpl-btn dpl-btn-sm', disabled: !!busy, 'data-action': 'config-export', onClick: () => download(false) },
        '匯出設定',
      ),
      h(
        'button',
        { type: 'button', className: 'dpl-btn dpl-btn-sm', disabled: !!busy, 'data-action': 'config-export-share', onClick: () => download(true) },
        '匯出分享用（不含個人 ID 與名單）',
      ),
      h(
        'button',
        { type: 'button', className: 'dpl-btn dpl-btn-sm', disabled: !!busy, onClick: () => fileRef.current?.click() },
        '匯入設定…',
      ),
      h('input', {
        ref: fileRef,
        type: 'file',
        accept: '.json,application/json',
        'aria-label': '設定匯入檔',
        style: { display: 'none' },
        onChange: (event) => readImport(event.target.files?.[0]),
      }),
    ),
    pending
      ? h(
          'div',
          { className: 'dpl-note', 'data-tone': 'info', role: 'note', 'data-import-preview': pending.changes.length },
          h(
            'div',
            { className: 'dpl-note-title' },
            pending.changes.length ? '匯入會變更 ' + pending.changes.length + ' 項設定' : '匯入檔與目前設定相同，沒有需要變更的項目',
          ),
          pending.changes.length ? h(ChangeList, { fields, rows: pending.changes }) : null,
          pending.ignored.length
            ? h('div', { className: 'dpl-note-body' }, '已略過 ' + pending.ignored.length + ' 個不認得或屬於機密的欄位。')
            : null,
          h(
            'div',
            { className: 'dpl-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'dpl-btn dpl-btn-primary dpl-btn-sm',
                disabled: !!busy || !pending.changes.length,
                'data-action': 'config-import-apply',
                onClick: applyImport,
              },
              busy === 'import-apply' ? '套用中…' : '確認匯入',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dpl-btn dpl-btn-sm',
                disabled: !!busy,
                onClick: () => {
                  setPending(null);
                  if (fileRef.current) fileRef.current.value = '';
                },
              },
              '取消',
            ),
          ),
        )
      : null,
    h('div', { className: 'dpl-row-label', style: { marginTop: 12 } }, '最近的儲存紀錄'),
    entries === null
      ? h(StateView, { kind: 'loading' })
      : entries.length
        ? entries.map((entry) =>
            h(
              'div',
              { className: 'dpl-note', key: entry.id, 'data-config-entry': entry.id },
              h(
                'div',
                { className: 'dpl-note-title' },
                new Date(entry.at).toLocaleString('zh-TW', { hour12: false }) +
                  ' · ' +
                  (sourceLabel[entry.source] || entry.source) +
                  ' · ' +
                  (entry.changes.length + entry.secretKeys.length) +
                  ' 項',
              ),
              entry.changes.length ? h(ChangeList, { fields, rows: entry.changes }) : null,
              entry.secretKeys.length
                ? h('div', { className: 'dpl-note-body' }, '另有 ' + entry.secretKeys.length + ' 個機密欄位被更新（內容不保存，無法復原）。')
                : null,
              entry.changes.length
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'dpl-btn dpl-btn-sm',
                      style: { alignSelf: 'flex-start' },
                      disabled: !!busy,
                      'data-action': 'config-undo',
                      onClick: () => undo(entry),
                    },
                    busy === 'undo:' + entry.id ? '復原中…' : '回到這次儲存之前',
                  )
                : null,
            ),
          )
        : h(StateView, { kind: 'empty', title: '還沒有儲存紀錄' }, '之後每次儲存設定，這裡會列出改了什麼，最多保留十筆。'),
    notice ? h('div', { className: 'dpl-note', role: 'status' }, notice) : null,
    error ? h('div', { className: 'dpl-note', 'data-tone': 'err', role: 'alert' }, error) : null,
  );
}
