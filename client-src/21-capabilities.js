function CapabilitiesPanel({ onNavigate }) {
  const [data, D] = useState(null),
    [error, E] = useState(''),
    [busy, W] = useState(false),
    [category, C] = useState('all'),
    [query, Q] = useState(''),
    [attention, A] = useState(false);
  const load = async (force = false) => {
    W(true);
    E('');
    try {
      D(await api('/capabilities' + (force ? '?refresh=1' : '')));
    } catch (e) {
      E(e.message);
    } finally {
      W(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const categories = [
    ['all', '全部'],
    ['tts', '語音合成'],
    ['stt', '語音辨識'],
    ['memory', '記憶'],
    ['knowledge', '查詢'],
    ['music', '音樂'],
    ['singing', '唱歌'],
    ['delivery', '通訊交付'],
    ['mood', '心情'],
    ['schedule', '排程'],
  ];
  const readiness = {
    ready: '服務回報就緒',
    blocked: '尚未就緒',
    unknown: '尚未確認設定',
    preparing: '準備中',
    delegated: '外部插件自行處理',
    unsupported: '目前接口不支援',
  };
  const proof = (value) =>
    ({
      passed: '最近一次呼叫成功',
      failed: '最近一次呼叫失敗',
      unconfirmed: '有回傳，結果未確認',
      stale: '舊證據，需重新核對',
      'not-run': '尚無本次啟動的呼叫紀錄',
    })[value] || '尚未確認';
  const operations = {
    'synthesize-audio': '取得完整合成音訊',
    'stream-audio': '完整消費音訊串流',
    transcribe: '取得辨識文字',
    'transcribe-recording': '取得錄音辨識文字',
    'memory-write': '外部記憶寫入回執',
    'knowledge-tool': '查詢工具回傳資料',
    'load-audio': '取得音樂音訊',
    'search-music': '音樂搜尋回傳結果（尚非播放）',
    'read-library': '曲庫回傳結果（尚非取得音訊）',
    'environment-check': '檢查翻唱環境（尚非合成）',
    'voice-transmission': '單次 Discord 本機語音傳輸',
    'create-schedule': '建立排程，尚非到期喚醒',
  };
  const rows = (data?.rows || []).filter((row) => {
    const text = [
        row.name,
        row.id,
        row.selection,
        row.detail,
        row.issue?.summary,
        row.issue?.code,
        row.issue?.permission,
        ...(row.features || []).map((f) => f.label),
      ].join(' '),
      q = query.trim().toLocaleLowerCase();
    return (
      (category === 'all' || row.category === category) &&
      (!attention || row.issue || ['blocked', 'unsupported', 'preparing'].includes(row.readiness)) &&
      (!q || [text, uiLocale.convert(text)].some((t) => t.toLocaleLowerCase().includes(q)))
    );
  });
  return h(
    Card,
    {
      title: '外部能力狀態與失敗診斷',
      desc: '安裝、載入、設定就緒、模擬及實際呼叫是不同證據；此頁不試用服務、不建立工作。',
    },
    h(
      'div',
      { className: 'dpl-actions' },
      h(
        'button',
        { className: 'dpl-btn', disabled: busy, onClick: () => load(true) },
        busy ? '讀取狀態中…' : '更新能力狀態（不試用服務）',
      ),
      h(
        'span',
        { className: 'dpl-note' },
        data?.checkedAt ? '狀態時間：' + new Date(data.checkedAt).toLocaleString() : '尚未讀取',
      ),
    ),
    h('input', {
      className: 'dpl-input',
      'aria-label': '搜尋外部能力',
      placeholder: '搜尋插件、能力或接口名稱',
      value: query,
      onChange: (e) => Q(e.target.value),
    }),
    h(
      'div',
      { className: 'dpl-actions', role: 'group', 'aria-label': '外部能力分類' },
      categories.map(([id, label]) =>
        h(
          'button',
          { key: id, className: 'dpl-btn', 'aria-pressed': category === id, onClick: () => C(id) },
          label,
        ),
      ),
    ),
    h(
      'label',
      null,
      h('input', { type: 'checkbox', checked: attention, onChange: (e) => A(e.target.checked) }),
      ' 只看需要處理的項目',
    ),
    data && !data.inventoryKnown
      ? h(
          'p',
          { role: 'status', className: 'dpl-note' },
          '宿主安裝清單暫時無法讀取；顯示未知，不會把工具存在當成已安裝證明。',
        )
      : null,
    data?.receivePolicy
      ? h(
          'details',
          null,
          h('summary', null, '目前語音收聽對象與費用'),
          h(
            'p',
            null,
            data.receivePolicy.enabled
              ? '收聽開關已啟用；還需同意與加入房間。'
              : '收聽關閉，待在房內不會因此自動辨識。',
          ),
          h(
            'p',
            null,
            data.receivePolicy.onlyAdmin
              ? '目前允許名單只有管理者。'
              : '目前明確允許 ' + data.receivePolicy.allowedCount + ' 位使用者；空名單不收聽。',
          ),
          h(
            'p',
            null,
            'AI 自動回覆：' +
              (data.receivePolicy.autoReply
                ? '已啟用，每次有效發言可能呼叫模型'
                : '關閉，不因單純辨識呼叫回覆模型') +
              '；每日 STT 提交上限：' +
              (data.receivePolicy.dailySeconds ? data.receivePolicy.dailySeconds + ' 秒' : '不限'),
          ),
          h('p', null, data.receivePolicy.note),
        )
      : null,
    h(
      'p',
      { className: 'dpl-note' },
      '介面契約模擬通過只涵蓋本插件介面卡，不等於外部引擎、帳號或全部功能實測。最近呼叫成功也不代表所有會話／工作區可用、Discord 成員實際聽到，或記憶已完成全部提煉。',
    ),
    rows.map((row) =>
      h(
        'article',
        { key: row.id, className: 'dpl-asset', style: { minWidth: 0, overflowWrap: 'anywhere' } },
        h('strong', null, row.name),
        h('p', null, row.selection || row.id),
        h(
          'div',
          {
            style: {
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))',
              gap: 8,
            },
          },
          h(
            'p',
            null,
            '安裝：' +
              { yes: '已安裝／隨宿主提供', no: '尚未安裝', unknown: '宿主清單未列出' }[
                row.presence?.installed || 'unknown'
              ],
          ),
          h(
            'p',
            null,
            '載入：' +
              { yes: '已載入', no: '未載入', loading: '載入中', unknown: '未確認' }[
                row.presence?.loaded || 'unknown'
              ],
          ),
          h('p', null, '設定：' + (readiness[row.readiness] || '未確認')),
          h(
            'p',
            null,
            '介面契約模擬：' +
              (row.verification?.contract?.state === 'passed'
                ? '通過'
                : row.verification?.contract?.state === 'stale'
                  ? '來源已變更，待重測'
                  : '尚未核對'),
          ),
          h('p', null, '實際呼叫：' + proof(row.verification?.runtime?.state)),
        ),
        h(
          'p',
          null,
          '接口：' +
            (row.registered ? '已註冊／可見' : '尚未確認註冊') +
            (row.enabled === null
              ? ''
              : row.enabled
                ? '；Discord 相關功能已啟用'
                : '；Discord 相關功能未啟用'),
        ),
        h('p', null, row.detail),
        row.allowedFor
          ? h(
              'p',
              null,
              '目前允許 AI 使用的對象：' +
                (row.allowedFor.length
                  ? row.allowedFor
                      .map(
                        (id) =>
                          ({
                            adminDm: '管理者私訊',
                            adminGroup: '管理者群聊',
                            othersDm: '其他使用者私訊',
                            othersGroup: '其他使用者群聊',
                          })[id],
                      )
                      .join('、')
                  : '尚未授權，或目前不是 DSH 正式會話模式'),
            )
          : null,
        h(
          'div',
          { className: 'dpl-actions' },
          (row.features || []).map((f) =>
            h(
              'span',
              {
                key: f.id,
                className: 'dpl-badge',
                style: { whiteSpace: 'normal', maxWidth: '100%', overflowWrap: 'anywhere' },
              },
              f.label + '：' + (f.supported === true ? '是' : f.supported === false ? '否' : '待確認'),
            ),
          ),
        ),
        row.verification?.runtime?.at
          ? h(
              'p',
              { className: 'dpl-note' },
              (operations[row.verification.runtime.operation] || row.verification.runtime.operation) +
                ' · ' +
                new Date(row.verification.runtime.at).toLocaleString(),
            )
          : null,
        row.verification?.simulation?.state !== 'not-run'
          ? h(
              'p',
              { className: 'dpl-note' },
              '隔離模擬紀錄：' + proof(row.verification?.simulation?.state) + '；不計入實際呼叫。',
            )
          : null,
        row.verification?.runtime?.state === 'stale' && row.verification.runtime.issue
          ? h(
              'p',
              { className: 'dpl-note' },
              '舊範圍的呼叫失敗原因：' +
                row.verification.runtime.issue.summary +
                '；請勿據此推定目前設定仍失敗。',
            )
          : null,
        row.issue
          ? h(
              'div',
              { className: 'dpl-note', role: 'status' },
              h('strong', null, row.issue.summary),
              h('p', null, row.issue.fix),
              row.issue.permission ? h('p', null, '需檢查權限：' + row.issue.permission) : null,
              row.issue.httpStatus ? h('p', null, '服務狀態：HTTP ' + row.issue.httpStatus) : null,
            )
          : null,
        h('button', { className: 'dpl-btn', onClick: () => onNavigate(row.section) }, '前往相關設定'),
      ),
    ),
    data && !rows.length ? h('p', { role: 'status' }, '沒有符合條件的能力，請調整分類或搜尋。') : null,
    data?.note ? h('p', { className: 'dpl-note' }, data.note) : null,
    error ? h('p', { role: 'alert' }, error) : null,
  );
}
