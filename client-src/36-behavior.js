function BehaviorPanel({ dirtyKeys, onConfigSaved }) {
  const [info, setInfo] = useState({ presets: [], rules: [] }),
    [presetId, setPresetId] = useState('builtin-companion'),
    [profile, setProfile] = useState('adminDm'),
    [name, setName] = useState(''),
    [includePersona, setIncludePersona] = useState(false),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const blank = () => ({
    kind: 'user',
    targetId: '',
    transport: 'both',
    scope: 'dm',
    label: '',
    nickname: '',
    tone: '',
    length: '',
    gifEnabled: 'inherit',
    stickerAutoSendEnabled: 'inherit',
    coChatEnabled: 'inherit',
    replyDeliveryMode: '',
  });
  const [rule, setRule] = useState(blank);
  const load = async () => setInfo(await api('/user-behavior'));
  useEffect(() => {
    load().catch((e) => setNotice(e.message));
  }, []);
  const act = async (body, message) => {
    setBusy(true);
    try {
      setInfo(await api('/user-behavior', { method: 'POST', body }));
      if (body.action === 'apply') await onConfigSaved();
      setNotice(message);
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  };
  const change = (key, value) => setRule((r) => ({ ...r, [key]: value }));
  const select = (label, value, onChange, options, disabled = false) =>
    h(
      'label',
      null,
      label,
      h(
        'select',
        {
          className: 'dpl-select',
          value,
          disabled,
          'aria-label': label,
          onChange: (e) => onChange(e.target.value),
        },
        options.map(([v, t]) => h('option', { key: v, value: v }, t)),
      ),
    );
  const profiles = [
    ['adminDm', '管理者・私訊'],
    ['adminGroup', '管理者・群聊'],
    ['othersDm', '其他使用者・私訊'],
    ['othersGroup', '其他使用者・群聊'],
  ];
  const preset = (info.presets || []).find((p) => p.id === presetId);
  return h(
    Card,
    {
      title: '人格與行為組合／個別對話偏好',
      icon: 'settings',
      desc: '預設組合可套用至四種對象。對話偏好可用於個人帳號與 Bot；外部人格與記憶仍依 DSH 工作區／會話運作。',
    },
    notice ? h('p', { className: 'dpl-note', role: 'status' }, notice) : null,
    h(
      'div',
      { className: 'dpl-asset' },
      h('h3', null, '人格與行為預設組合'),
      select(
        '預設組合',
        presetId,
        setPresetId,
        (info.presets || []).map((p) => [p.id, p.name]),
      ),
      select('套用對象', profile, setProfile, [...profiles, ['all', '全部四種對象']]),
      preset
        ? h(
            'details',
            null,
            h('summary', null, '預覽將套用的 ' + Object.keys(preset.values).length + ' 項設定'),
            h(
              'pre',
              { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } },
              JSON.stringify(preset.values, null, 2),
            ),
          )
        : null,
      h(
        'p',
        { className: 'dpl-row-help' },
        '「交由外部人格管理」關閉插件本身的身分與風格注入。內建陪聊／安靜／工作組合不替換外部人格。',
      ),
      dirtyKeys.length
        ? h('p', { className: 'dpl-row-help' }, '請先儲存或放棄頁面上的設定草稿，再套用／擷取預設。')
        : null,
      h(
        'button',
        {
          className: 'dpl-btn dpl-btn-primary',
          disabled: busy || !!dirtyKeys.length || !preset,
          onClick: () => act({ action: 'apply', id: presetId, profile }, '預設已套用至指定對象。'),
        },
        '套用預設',
      ),
      preset && !preset.builtin
        ? h(
            'button',
            {
              className: 'dpl-btn',
              disabled: busy,
              onClick: () => act({ action: 'removePreset', id: preset.id }, '自訂預設已刪除。'),
            },
            '刪除自訂預設',
          )
        : null,
      h(
        'label',
        null,
        '自訂組合名稱',
        h('input', {
          className: 'dpl-input',
          value: name,
          maxLength: 80,
          'aria-label': '自訂組合名稱',
          onChange: (e) => setName(e.target.value),
        }),
      ),
      h(
        'label',
        null,
        h('input', {
          type: 'checkbox',
          checked: includePersona,
          onChange: (e) => setIncludePersona(e.target.checked),
        }),
        ' 同時擷取插件人格欄位',
      ),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: busy || !!dirtyKeys.length || !name.trim() || profile === 'all',
          onClick: () =>
            act({ action: 'capture', name, profile, includePersona }, '已擷取此對象的已儲存設定。'),
        },
        '將目前對象設定存為組合',
      ),
    ),
    h(
      'div',
      { className: 'dpl-asset' },
      h('h3', null, rule.id ? '編輯對話偏好' : '新增對話偏好'),
      h(
        'p',
        { className: 'dpl-row-help' },
        '指定頻道的偏好優先於指定使用者；具體帳號／場景優先於共用規則。繼承代表沿用四種對象設定。人格與記憶的工作區綁定請使用下方 DSH 會話列表。',
      ),
      select(
        '偏好對象',
        rule.kind,
        (v) => {
          change('kind', v);
          change('scope', v === 'channel' ? 'both' : 'dm');
        },
        [
          ['user', '指定使用者'],
          ['channel', '指定頻道／私訊對話'],
        ],
      ),
      h(
        'label',
        null,
        '對象 ID',
        h('input', {
          className: 'dpl-input',
          value: rule.targetId,
          'aria-label': '偏好對象 ID',
          onChange: (e) => change('targetId', e.target.value.trim()),
        }),
      ),
      h(
        'label',
        null,
        '備註名稱',
        h('input', {
          className: 'dpl-input',
          value: rule.label,
          maxLength: 100,
          onChange: (e) => change('label', e.target.value),
        }),
      ),
      select('適用介面', rule.transport, (v) => change('transport', v), [
        ['both', '個人帳號與 Bot'],
        ['user', '只有個人帳號'],
        ['bot', '只有 Bot'],
      ]),
      select('適用場景', rule.scope, (v) => change('scope', v), [
        ['dm', '只限一對一私訊'],
        ['group', '只限群聊'],
        ['both', '私訊與群聊'],
      ]),
      rule.scope !== 'dm'
        ? h('p', { className: 'dpl-row-help' }, '此偏好會用於群聊，請使用適合公開的稱呼與描述。')
        : null,
      h(
        'label',
        null,
        '偏好稱呼',
        h('input', {
          className: 'dpl-input',
          value: rule.nickname,
          maxLength: 80,
          'aria-label': '偏好稱呼',
          onChange: (e) => change('nickname', e.target.value),
        }),
      ),
      select('回覆長度', rule.length, (v) => change('length', v), [
        ['', '繼承'],
        ['brief', '簡短，約一至三句'],
        ['normal', '自然長度'],
        ['detailed', '需要時補充細節'],
      ]),
      h(
        'label',
        null,
        '語氣、話題偏好與界線',
        h('textarea', {
          className: 'dpl-textarea',
          rows: 3,
          maxLength: 800,
          value: rule.tone,
          'aria-label': '對話風格偏好',
          placeholder: '例如：少用敬語；不要主動談論工作；可直接稱呼阿明。',
          onChange: (e) => change('tone', e.target.value),
        }),
      ),
      ...[
        ['gifEnabled', 'GIF 回覆'],
        ['stickerAutoSendEnabled', '貼圖回覆'],
        ['coChatEnabled', '群聊主動插話'],
      ].map(([key, label]) =>
        select(label, rule[key], (v) => change(key, v), [
          ['inherit', '繼承'],
          ['on', '允許'],
          ['off', '停用'],
        ]),
      ),
      select('個人帳號送出方式', rule.replyDeliveryMode, (v) => change('replyDeliveryMode', v), [
        ['', '繼承'],
        ['auto', '自動送出'],
        ['review', '先審稿'],
      ]),
      h(
        'button',
        {
          className: 'dpl-btn dpl-btn-primary',
          disabled: busy || !/^\d{15,22}$/.test(rule.targetId),
          onClick: () => {
            const body = { ...rule, action: 'putRule' };
            for (const key of ['gifEnabled', 'stickerAutoSendEnabled', 'coChatEnabled']) {
              if (rule[key] === 'inherit') delete body[key];
              else body[key] = rule[key] === 'on';
            }
            act(body, '對話偏好已儲存，後續訊息生效。');
          },
        },
        '儲存對話偏好',
      ),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: busy || JSON.stringify(rule) === JSON.stringify(blank()),
          onClick: () => setRule(blank()),
        },
        '清空表單',
      ),
    ),
    ...(info.rules || []).map((row) =>
      h(
        'div',
        { className: 'dpl-note', key: row.id },
        h('strong', null, row.label || row.targetId),
        h('p', null, row.kind + ' · ' + row.targetId + ' · ' + row.transport + ' · ' + row.scope),
        h(
          'button',
          {
            className: 'dpl-btn',
            disabled: busy,
            onClick: () => {
              const next = { ...blank(), ...row, ...row.values };
              for (const k of ['gifEnabled', 'stickerAutoSendEnabled', 'coChatEnabled'])
                next[k] = typeof row.values[k] === 'boolean' ? (row.values[k] ? 'on' : 'off') : 'inherit';
              setRule(next);
            },
          },
          '編輯偏好',
        ),
        h(
          'button',
          {
            className: 'dpl-btn',
            disabled: busy,
            onClick: () => act({ action: 'removeRule', id: row.id }, '偏好已刪除，恢復繼承設定。'),
          },
          '刪除偏好',
        ),
      ),
    ),
  );
}
