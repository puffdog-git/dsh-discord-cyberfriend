function Pill({ tone, children, dot }) {
  return h(
    'span',
    { className: 'dpl-pill', 'data-tone': tone || 'muted' },
    dot ? h('span', { className: 'dpl-dot' }) : null,
    children,
  );
}

function Card({ title, desc, icon, actions, children }) {
  const head = title
    ? h(
        'header',
        { className: 'dpl-card-head' },
        h(
          'div',
          null,
          h('div', { className: 'dpl-card-title' }, icon ? iconFor(icon)({ size: 15 }) : null, title),
          desc ? h('p', { className: 'dpl-card-desc' }, desc) : null,
        ),
        actions ? h('div', { className: 'dpl-actions' }, actions) : null,
      )
    : null;
  return h('section', { className: 'dpl-card' }, head, h('div', { className: 'dpl-card-body' }, children));
}

function Switch({ checked, onChange, disabled, label }) {
  return h('button', {
    'aria-label': label || undefined,
    type: 'button',
    className: 'dpl-switch',
    'data-on': checked ? 'true' : 'false',
    'aria-checked': checked ? 'true' : 'false',
    role: 'switch',
    disabled: Boolean(disabled),
    onClick: () => !disabled && onChange(!checked),
  });
}

function Segmented({ options, value, onChange, disabled }) {
  return h(
    'div',
    { className: 'dpl-seg' },
    (options || []).map((option) =>
      h(
        'button',
        {
          key: String(option.value),
          type: 'button',
          'data-on': String(option.value) === String(value) ? 'true' : 'false',
          disabled: Boolean(disabled),
          onClick: () => onChange(option.value),
        },
        option.label ?? String(option.value),
      ),
    ),
  );
}

function TagsInput({ value, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const list = Array.isArray(value) ? value : [];
  const add = (raw) => {
    const items = String(raw || '')
      .split(/[,\n;]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!items.length) return;
    const next = [...list];
    for (const item of items) if (!next.includes(item)) next.push(item);
    onChange(next);
    setDraft('');
  };
  // 知道名稱的 ID 直接顯示名稱（滑鼠移上去可看到完整 ID）；同名的才在後面補 ID 末四碼區分。
  const labels = list.map((item) => (uiRuntime.names.has(String(item)) ? uiRuntime.names.get(String(item)) : null));
  const labelOf = (item, index) =>
    labels[index] === null
      ? item
      : labels.filter((label) => label === labels[index]).length > 1
        ? labels[index] + ' · ' + String(item).slice(-4)
        : labels[index];
  return h(
    'div',
    { className: 'dpl-tags' },
    list.map((item, index) =>
      h(
        'span',
        { key: item, className: 'dpl-tag', title: labels[index] === null ? item : 'ID：' + item, 'data-named': labels[index] === null ? 'false' : 'true' },
        CUSTOM_EMOJI.test(String(item)) ? emojiView(item, 18) : labelOf(item, index),
        h(
          'button',
          { type: 'button', title: '移除', onClick: () => onChange(list.filter((entry) => entry !== item)) },
          'x',
        ),
      ),
    ),
    h('input', {
      value: draft,
      placeholder: list.length ? '' : placeholder || '輸入後按 Enter',
      onChange: (event) => setDraft(event.target.value),
      onKeyDown: (event) => {
        if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
          event.preventDefault();
          add(draft);
        } else if (event.key === 'Backspace' && !draft && list.length) {
          onChange(list.slice(0, -1));
        }
      },
      onBlur: () => add(draft),
    }),
  );
}

function RangeInput({ value, min, max, step, onChange, suffix }) {
  const current = Number(value) || 0;
  return h(
    'div',
    { className: 'dpl-range' },
    h('input', {
      type: 'range',
      min: min ?? 0,
      max: max ?? 100,
      step: step ?? 1,
      value: current,
      onChange: (event) => onChange(Number(event.target.value)),
    }),
    h('span', { className: 'dpl-range-value' }, `${current}${suffix || ''}`),
  );
}

function TextArea({ value, onChange, rows, placeholder }) {
  const text = String(value ?? '');
  return h(
    'div',
    { style: { width: '100%' } },
    h('textarea', {
      className: 'dpl-textarea',
      rows: rows || 4,
      value: text,
      placeholder: placeholder || '',
      onChange: (event) => onChange(event.target.value),
    }),
    h('div', { className: 'dpl-foot' }, h('span', null, `${text.length} 字`)),
  );
}

function PasswordInput({ value, onChange, placeholder }) {
  const [visible, setVisible] = useState(false);
  return h(
    'div',
    { className: 'dpl-input-wrap' },
    h('input', {
      className: 'dpl-input',
      type: visible ? 'text' : 'password',
      value: value ?? '',
      placeholder: placeholder || '',
      'data-mono': 'true',
      autoComplete: 'off',
      spellCheck: false,
      onChange: (event) => onChange(event.target.value),
    }),
    h(
      'button',
      {
        type: 'button',
        className: 'dpl-eye',
        title: visible ? '隱藏' : '顯示',
        onClick: () => setVisible(!visible),
      },
      visible ? Icon.eyeOff({ size: 14 }) : Icon.eye({ size: 14 }),
    ),
  );
}

// 數字欄：清空時不送出空字串（後端會靜默還原成預設值），改為標示並在離開欄位時復原。
function NumberInput({ value, min, max, step, onChange }) {
  const [text, setText] = useState(null);
  const shown = text !== null ? text : Number.isFinite(Number(value)) ? String(Number(value)) : '';
  const invalid = text !== null && (text.trim() === '' || !Number.isFinite(Number(text)));
  return h('input', {
    className: 'dpl-input',
    type: 'number',
    style: { width: 108 },
    value: shown,
    min,
    max,
    step: step || 1,
    'data-invalid': invalid ? 'true' : 'false',
    title: invalid ? '請輸入數字；留空不會變更設定' : undefined,
    onChange: (event) => {
      const raw = event.target.value;
      setText(raw);
      if (raw.trim() !== '' && Number.isFinite(Number(raw))) onChange(Number(raw));
    },
    onBlur: () => setText(null),
  });
}

// 統一的狀態區塊：載入中／沒有資料／查詢失敗／功能或權限未開啟。
// kind: 'loading' | 'empty' | 'error' | 'off'
// 讀取一份後端資料：回傳 { kind: 'loading' | 'ready' | 'error', data, error, reload }。
// 重新讀取時保留上一次的資料，畫面不會閃回空白；元件卸載後不再更新狀態。
function useLoad(loader, deps = []) {
  const [state, setState] = useState({ kind: 'loading', data: null, error: '' });
  const alive = useRef(true);
  const reload = async () => {
    setState((previous) => ({ ...previous, kind: 'loading', error: '' }));
    try {
      const data = await loader();
      if (alive.current) setState({ kind: 'ready', data, error: '' });
    } catch (error) {
      if (alive.current) setState((previous) => ({ kind: 'error', data: previous.data, error: error.message }));
    }
  };
  useEffect(() => {
    alive.current = true;
    reload();
    return () => {
      alive.current = false;
    };
  }, deps);
  return { ...state, reload };
}

function StateView({ kind, title, children, action }) {
  return h(
    'div',
    { className: 'dpl-state', 'data-kind': kind, role: kind === 'error' ? 'alert' : 'status' },
    kind === 'loading' ? h('span', { className: 'dpl-spinner', 'aria-hidden': 'true' }) : null,
    h('div', { className: 'dpl-state-title' }, title || (kind === 'loading' ? '載入中…' : '')),
    children ? h('div', { className: 'dpl-state-body' }, children) : null,
    action || null,
  );
}

// ---------------------------------------------------------------- field rows ---
function FieldRow({ field, value, onChange, dirty, config, inactive }) {
  const change = onChange;
  onChange = (v) => {
    if (!inactive) change(v);
  };
  const transportBadge =
    field.transport === field.section
      ? null
      : field.transport === 'user'
        ? h('span', { className: 'dpl-badge dpl-badge-user' }, '使用者')
        : field.transport === 'bot'
          ? h('span', { className: 'dpl-badge dpl-badge-bot' }, '機器人')
          : null;
  const label = h(
    'div',
    { className: 'dpl-row-label' },
    field.label || field.key,
    transportBadge,
    dirty ? h('span', { className: 'dpl-badge dpl-badge-dirty' }, '未儲存') : null,
  );
  const main = h(
    'div',
    { className: 'dpl-row-main' },
    label,
    field.help ? h('div', { className: 'dpl-row-help' }, field.help) : null,
    inactive ? h('div', { className: 'dpl-row-help', role: 'note' }, '暫不生效：' + inactive) : null,
  );

  if (field.type === 'boolean') {
    return h(
      'div',
      { className: 'dpl-row', 'data-type': 'boolean' },
      main,
      h(
        'fieldset',
        { className: 'dpl-row-control dpl-fieldset', disabled: !!inactive },
        h(Switch, { checked: Boolean(value), onChange }),
      ),
    );
  }

  let control;
  if (field.type === 'password') {
    const isSet = Boolean(config?.[`${field.key}__set`]);
    control = h(PasswordInput, {
      value: value ?? '',
      onChange,
      placeholder: isSet ? '******** 已儲存（留空代表不變更）' : '尚未設定',
    });
  } else if (field.type === 'select') {
    const options = field.options || [];
    control =
      options.length <= 3
        ? h(Segmented, { options, value, onChange })
        : h(
            'div',
            { style: { minWidth: 190 } },
            h(
              'select',
              {
                className: 'dpl-select',
                value: String(value ?? ''),
                onChange: (event) => onChange(event.target.value),
              },
              options.map((option) =>
                h(
                  'option',
                  { key: String(option.value), value: option.value },
                  option.label ?? String(option.value),
                ),
              ),
            ),
          );
  } else if (field.type === 'tags') {
    const pickerKind = pickerKindFor(field.key);
    control = isEmojiListField(field.key)
      ? h(
          'div',
          { className: 'dpl-picker-wrap' },
          h(TagsInput, { value, onChange, placeholder: '輸入表情後按 Enter，或從下方看圖選擇' }),
          h(EmojiPicker, { value, onChange }),
        )
      : pickerKind
      ? h(
          'div',
          { className: 'dpl-picker-wrap' },
          h(TagsInput, { value, onChange, placeholder: '輸入 ID 後按 Enter，或從下方清單選擇' }),
          h(IdPicker, { kind: pickerKind, value, onChange }),
        )
      : h(TagsInput, { value, onChange, placeholder: field.placeholder });
  } else if (field.type === 'textarea') {
    control = h(TextArea, { value, onChange, rows: field.rows || 4, placeholder: field.placeholder });
  } else if (field.type === 'range') {
    control = h(RangeInput, {
      value,
      min: field.min,
      max: field.max,
      step: field.step,
      onChange,
      suffix: field.unit || '',
    });
  } else if (field.type === 'number') {
    control = h(NumberInput, { value, min: field.min, max: field.max, step: field.step, onChange });
  } else {
    // 有建議值的欄位：可以從清單挑，也可以自行輸入。模型服務另外併入宿主實際可用的清單。
    const suggestions = [
      ...(field.key === 'subscriptionProvider' ? uiRuntime.providers.map((item) => item.id) : []),
      ...(field.suggestions || []),
    ].filter((item, index, all) => item && all.indexOf(item) === index);
    const listId = suggestions.length ? 'dpl-suggest-' + field.key : undefined;
    control = h(
      'div',
      { style: { minWidth: 200, display: 'flex' } },
      h('input', {
        className: 'dpl-input',
        type: 'text',
        value: value ?? '',
        list: listId,
        placeholder: field.placeholder || (suggestions.length ? '可從清單選擇或自行輸入' : ''),
        'data-mono': field.mono ? 'true' : 'false',
        spellCheck: false,
        onChange: (event) => onChange(event.target.value),
      }),
      listId
        ? h(
            'datalist',
            { id: listId },
            suggestions.map((item) => h('option', { key: item, value: item })),
          )
        : null,
    );
  }

  return h(
    'div',
    { className: 'dpl-row', 'data-type': field.type },
    main,
    h('fieldset', { className: 'dpl-row-control dpl-fieldset', disabled: !!inactive }, control),
  );
}

// 各分區的欄位分組：[標題, 比對設定鍵的規則, 預設是否收合]。依序比對，第一個符合者勝出。
const AUDIENCE_FIELD_GROUPS = [
  [
    '回覆與接話',
    /^(replyDeliveryMode|dmReplyEnabled|mentionReplyEnabled|followup.*|coChat.*|interestKeywords|monitoredChannelIds)$/,
  ],
  ['人格與文字風格', /^(.*Persona.*|plugin.*|antiAiFlavor.*|stripMarkdown|replyChineseScript|slangTone.*)$/, true],
  [
    '圖片、GIF 與反應',
    /^(gif.*|imageVision.*|emojiVision.*|autoReaction.*|sticker.*|memeImagesEnabled)$/,
    true,
  ],
  ['可用工具', /^(musicControlEnabled|knowledgeLookupEnabled|webLookupEnabled|memeLookupEnabled)$/, true],
  ['節奏與上下文', /.*/, true],
];
const FIELD_GROUPS = {
  user: [
    [
      '接收與回覆',
      /^(userReceiveOnly|userAutoReply|userWatchDms|userChannelIds|userInboxEnabled|userAutoTakeover.*|userSimulateTyping)$/,
    ],
    ['討論串', /^(userAutoCreateThreads|userThread.*)$/, true],
    ['連線', /.*/, true],
  ],
  bot: [
    ['互動功能', /^(botNativeInteractions|botSlashCommands|botEmbedReplies)$/],
    ['討論串', /^(botAutoCreateThreads|botThread.*)$/, true],
    ['連線與權限', /.*/],
  ],
  reply: [
    [
      '誰可以觸發回覆',
      /^(replyIgnoreSelf|replyToBots|whitelistUserIds|blacklistUserIds|monitoredGuildIds|blacklistChannelIds|replyCooldownExemptUserIds|replyOwnership)$/,
    ],
    ['回覆上限', /^(max.*|roundResetMinutes)$/],
    ['訊息合併', /^messageCoalesce.*/],
  ],
  reaction: [
    ['表情反應', /^(reactionControlUserIds|autoReaction.*|reactionCommand.*|reactionIntelEnabled)$/],
    ['表情圖片與貼圖', /.*/],
  ],
  llm: [
    ['模型來源', /^(llmMode|subscription.*|customLlm.*)$/],
    ['回覆生成', /^(maxReplyTokens|temperature)$/],
    ['圖片理解', /.*/],
  ],
  memoryOutput: [
    ['人格日記', /^memoryDiary.*/],
    ['記憶輸出', /.*/],
  ],
  culture: [
    ['辨識快取', /^mediaPerception.*/],
    ['學習與重用', /^(cultureLearningEnabled|cultureReuseEnabled)$/],
    ['群聊接龍', /.*/],
  ],
  companion: [
    ['主動關心', /^proactive.*/],
    ['話題與延後回覆', /^(conversationControlEnabled|pendingTopics.*)$/],
    ['安靜時段', /.*/],
  ],
  history: [
    ['查詢與成員名稱', /^(channelLookupEnabled|memberNameUpdatesEnabled)$/],
    ['聊天快取', /.*/],
  ],
  gif: [
    ['搜尋來源', /^(gifProvider|gifCustomEndpoint|gifMaxResults|language|gifSendAsReply)$/],
    ['誰可以用', /^gifAccess.*/],
    ['GIF 與影片理解', /.*/],
  ],
  advanced: [
    ['執行', /^(maxConcurrentReplies|dryRun|statusRefreshSeconds)$/],
    ['Token 預算', /.*/],
  ],
  voice: [
    [
      '基本與權限',
      /^(voiceEnabled|voiceAllowedChannelIds|voiceIdleMinutes|voiceMaxSessionMinutes|voiceAutoSpeak|voiceVolume)$/,
    ],
    [
      '朗讀與音色',
      /^(voiceTts(Voice|Adapter|Service|BaseUrl|Options)|voiceMaxSpeechSeconds|voiceMaxTextChars|voiceDailyCharacterLimit|voiceStreaming|voiceIncrementalReplies|voiceSpokenLanguage|voiceJapanese.*|voiceEmotion.*|voiceFixedEmotion|voiceSpeechInstruction|voiceReplayEnabled|voiceSubtitles)$/,
      true,
    ],
    [
      '收聽與語音輸入',
      /^(voiceReceive.*|voiceReplyTextEnabled|voiceInterrupt.*|voiceInput.*|voiceStt(DailySeconds|Provider|Language)|voiceTranscript.*)$/,
      true,
    ],
    ['語音訊息', /^voiceMessage.*/, true],
    ['音樂', /^(voiceMusic.*|voiceMaxMusicMinutes)$/, true],
    ['用量與成本估算', /.*/, true],
  ],
};

function FieldList({ fields, config, draft, setValue, dirtyKeys, flat }) {
  const row = (field) =>
    h(FieldRow, {
      key: field.key,
      field,
      config,
      inactive: (field.enabledWhen || [])
        .filter((c) => !c.values.includes(draft[c.key]))
        .map((c) => c.reason)
        .join('；'),
      dirty: dirtyKeys.includes(field.key),
      value: draft[field.key],
      onChange: (value) => setValue(field.key, value),
    });
  // 搜尋結果等混合來源一律平鋪，不套用分區分組。
  const sectionId =
    fields.length && fields.every((f) => f.section === fields[0].section) ? fields[0].section : '';
  const audience = /^(adminDm|adminGroup|othersDm|othersGroup)$/.test(sectionId);
  const groups = flat ? null : audience ? AUDIENCE_FIELD_GROUPS : FIELD_GROUPS[sectionId];
  if (!groups) return fields.map(row);
  const baseKey = (f) => (audience ? f.key.slice(sectionId.length + 1) : f.key);
  const remaining = new Set(fields);
  return groups.map(([title, pattern, collapsed]) => {
    const rows = fields.filter((f) => remaining.has(f) && pattern.test(baseKey(f)));
    rows.forEach((f) => remaining.delete(f));
    if (!rows.length) return null;
    const changed = rows.some((f) => dirtyKeys.includes(f.key));
    return h(
      'details',
      {
        key: sectionId + ':' + title,
        className: 'dpl-field-group',
        open: !collapsed || changed || undefined,
      },
      h(
        'summary',
        { className: 'dpl-subhead' },
        title,
        h('span', { className: 'dpl-badge' }, rows.length + ' 項'),
      ),
      rows.map(row),
    );
  });
}

// ------------------------------------------------------------ transport card ---
