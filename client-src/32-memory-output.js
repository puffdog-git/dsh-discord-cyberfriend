function MemoryOutputPanel({ info, onRefresh, onError }) {
  const localDate = () =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: info?.timeZone || 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  useIdNames((info?.artifacts || []).map((a) => a.channelId));
  const [date, setDate] = useState(localDate),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(null);
  const run = async () => {
    setBusy(true);
    try {
      await api('/memory-output/export', { method: 'POST', body: { date, force: true } });
      await onRefresh();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const read = async (a, format = 'markdown') => {
    try {
      const p = await api('/memory-output/read?id=' + encodeURIComponent(a.id) + '&format=' + format);
      setPreview(p);
    } catch (e) {
      onError(e.message);
    }
  };
  const stateName = (s) =>
    ({
      generated: '已生成',
      source_only: '僅來源',
      failed: '失敗',
      stored: '已入庫',
      partial: '部分完成',
      writing: '交付中',
      skipped: '略過',
      disabled: '未啟用',
      exported: '已輸出候選檔（未入庫）',
      delegated: '已交付正式會話（待插件整理）',
      submitted: '已提交（未確認入庫）',
      pending_review: '待審核',
      unverified: '尚無可核對回執',
    })[s] ||
    s ||
    '尚未執行';
  return h(
    Card,
    {
      title: 'AI 日記與記憶入庫',
      icon: 'history',
      desc: '工作區人格閱讀當日素材，撰寫第一人稱 AI 日記，再交給 memU 等外部插件入庫。來源與入庫結果可分開查看。',
    },
    h(
      'div',
      { className: 'dpl-note' },
      '預設：memU；目前交付方式：' +
        (info?.selectedWriter || 'memu') +
        '。直接寫入只呼叫選定的寫入器；其他記憶系統的正式會話、檔案交付與自訂寫入器接口持續保留。',
    ),
    info && info.writeEnabled !== false && info.writerAvailable === false
      ? h(
          'div',
          { className: 'dpl-note', 'data-tone': 'warn', role: 'status', 'data-memory-writer-missing': '1' },
          h('div', { className: 'dpl-note-title' }, '選定的記憶插件還沒有載入'),
          h(
            'div',
            { className: 'dpl-note-body' },
            '目前的交付方式是「' +
              (info.selectedWriter || 'memu') +
              '」，但對應的記憶插件沒有載入，所以日記只會存成檔案，不會寫入長期記憶。安裝並啟用該記憶插件後會自動開始寫入；也可以在下方把交付方式改成「通用檔案交付」或「DSH 正式會話」。',
          ),
        )
      : null,
    h(
      'div',
      { className: 'dpl-note' },
      '管理者對話保存在 DSH session。日記套用對應工作區人格；只有回傳可核對的記憶 ID 才標為入庫。Prime／Mnemon 等可沿用正式會話；通用候選檔可供其他插件匯入。入庫失敗時日記仍保留。',
    ),
    ...(info?.connectors || []).map((c) =>
      h(
        'div',
        { className: 'dpl-note', key: 'connector-' + c.id },
        h('strong', null, c.name + ' · ' + c.id + ' · ' + (c.available ? '可交付' : '工具未載入')),
        h('div', null, c.note),
      ),
    ),
    h(
      'details',
      null,
      h('summary', null, '已測試記憶系統的相容接法'),
      h(
        'p',
        { className: 'dpl-note' },
        '這是接法清單，不代表插件或後端已啟用。正式會話會由已啟用的插件依自身設定捕獲；通用檔案需經其匯入／文件工具處理。',
      ),
      ...(info?.compatibility || []).map((c) =>
        h(
          'div',
          { className: 'dpl-note', key: 'memory-system-' + c.id },
          h('strong', null, c.name),
          h('div', null, c.routes),
          h('div', null, c.note),
        ),
      ),
    ),
    h('div', { className: 'dpl-note' }, 'Markdown／JSON／JSONL 輸出索引：' + (info?.root || '載入中')),
    h(
      'div',
      { className: 'dpl-note' },
      '排程：每天 ' +
        (info?.schedule || '03:00') +
        '（' +
        (info?.timeZone || 'Asia/Taipei') +
        '）輸出前一天；離線後會補輸出已收集資料。',
    ),
    info?.lastError ? h('div', { className: 'dpl-note' }, '輸出錯誤：' + info.lastError) : null,
    h('input', {
      className: 'dpl-input',
      type: 'date',
      value: date,
      onChange: (e) => setDate(e.target.value),
    }),
    h(
      'button',
      { className: 'dpl-btn', disabled: busy, onClick: run },
      busy ? '輸出中…' : '立即輸出／重新產生日記',
    ),
    h('button', { className: 'dpl-btn dpl-btn-ghost', onClick: onRefresh }, '重新整理'),
    ...(info?.artifacts || []).map((a) =>
      h(
        'div',
        { className: 'dpl-note', key: a.id },
        h('strong', { title: 'ID：' + a.channelId }, a.date + ' · ' + nameOfId(a.channelId) + (a.partial ? '（當日部分資料）' : '')),
        h(
          'div',
          null,
          `${a.messageCount} 則訊息；管理者 ${a.adminMessageCount} 則；表情事件 ${a.reactionEventCount} 筆`,
        ),
        h('div', null, '日記：' + stateName(a.diary?.status) + '；記憶入庫：' + stateName(a.memory?.status)),
        a.memory?.error ? h('div', null, a.memory.error) : null,
        a.memory?.reason ? h('div', null, a.memory.reason) : null,
        a.memory
          ? h(
              'details',
              null,
              h('summary', null, '查看入庫結果'),
              h('pre', { style: { whiteSpace: 'pre-wrap' } }, JSON.stringify(a.memory, null, 2)),
            )
          : null,
        h('div', null, a.markdownPath),
        h('div', null, a.jsonPath),
        h('button', { className: 'dpl-btn dpl-btn-sm', onClick: () => read(a) }, '預覽日記'),
        h('button', { className: 'dpl-btn dpl-btn-sm', onClick: () => read(a, 'source') }, '查看來源紀錄'),
      ),
    ),
    !(info?.artifacts || []).length
      ? h('div', { className: 'dpl-empty' }, '尚無日記；收集訊息後可立即輸出，或等待每日排程。')
      : null,
    preview
      ? h(
          'div',
          null,
          h('div', { className: 'dpl-note' }, preview.path),
          h(
            'article',
            {
              style: {
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                maxHeight: 600,
                overflow: 'auto',
                lineHeight: 1.8,
              },
            },
            preview.content,
          ),
        )
      : null,
  );
}
