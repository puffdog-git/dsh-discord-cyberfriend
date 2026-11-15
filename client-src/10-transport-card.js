function TransportCard({
  kind,
  info,
  status,
  config,
  draft,
  setValue,
  fields,
  onLogin,
  onLogout,
  onNavigate,
  busy,
}) {
  const isUser = kind === 'user';
  const [probe, setProbe] = useState(null);
  const [probing, setProbing] = useState(false);
  const tone = status?.ok ? 'ok' : status?.state === 'error' ? 'err' : 'muted';
  const stateLabel = status?.ok
    ? '已連線'
    : status?.state === 'connecting'
      ? '連線中'
      : status?.state === 'reconnecting'
        ? '重連中'
        : status?.state === 'error'
          ? '錯誤'
          : '未登入';
  const enabledKey = isUser ? 'userEnabled' : 'botEnabled';
  const autoKey = isUser ? 'userAutoStart' : 'botAutoStart';
  const tokenKey = isUser ? 'userToken' : 'botToken';
  const tokenSet = Boolean(config?.[`${tokenKey}__set`]);
  // Token 直接住在 draft 裡，才不會出現「打了字、按了儲存，卻只有卡片自己的
  // 區域 state 記得」這種存不進去的情況（dirty 差異是拿 draft 跟 config 比）。
  const token = String(draft?.[tokenKey] || '');
  const setToken = (value) => setValue?.(tokenKey, value);
  async function handleProbe() {
    setProbing(true);
    try {
      const result = await api('/probe-token', {
        method: 'POST',
        allowFailure: true,
        body: { transport: kind, ...(token ? { token } : {}) },
      });
      setProbe(result);
    } catch (error) {
      setProbe({ ok: false, valid: null, outcome: 'unknown', error: error.message });
    } finally {
      setProbing(false);
    }
  }

  return h(
    Card,
    {
      title: info?.label || kind,
      icon: isUser ? 'user' : 'bot',
      desc: info?.note,
      actions: [
        h(Pill, { key: 'state', tone, dot: true }, stateLabel),
        h(
          'label',
          { key: 'enabled', className: 'dpl-switch-label' },
          '啟用此帳號',
          h(Switch, {
            label: '啟用此帳號',
            checked: Boolean(draft[enabledKey]),
            onChange: (next) => setValue(enabledKey, next),
          }),
        ),
      ],
    },
    isUser
      ? h(
          'div',
          { className: 'dpl-note dpl-risk', role: 'note' },
          h('strong', null, '個人帳號自動化風險'),
          h(
            'p',
            null,
            'Discord 禁止使用 self-bot 自動化一般使用者帳號。即使套件包含防偵測相關處理，仍可能被偵測、停權或永久封號。請使用小號，不保證不被封號。',
          ),
        )
      : null,
    isUser ? h(PythonSetupRow, { key: 'python' }) : null,
    h(
      'div',
      { className: 'dpl-row', 'data-type': 'password' },
      h(
        'div',
        { className: 'dpl-row-main' },
        h(
          'div',
          { className: 'dpl-row-label' },
          info?.tokenLabel || 'Token',
          tokenSet
            ? h('span', { className: 'dpl-badge' }, '已儲存')
            : h('span', { className: 'dpl-badge dpl-badge-dirty' }, '未設定'),
          token ? h('span', { className: 'dpl-badge dpl-badge-dirty' }, '尚未儲存') : null,
          config?.[`${tokenKey}__fp`]
            ? h(
                'span',
                {
                  className: 'dpl-badge',
                  title: '設定檔裡那把 Token 的指紋（用來確認存的是不是你剛貼的那一把）',
                },
                `指紋 ${config[`${tokenKey}__fp`]}`,
              )
            : null,
        ),
        h(
          'div',
          { className: 'dpl-row-help' },
          isUser
            ? '只存在本機設定檔。取得方式：瀏覽器 DevTools 的 Network 面板，複製任一請求的 authorization 標頭。'
            : 'Developer Portal 的 Bot 頁面 Reset Token。記得開啟 MESSAGE CONTENT INTENT，否則讀不到訊息內容。',
        ),
      ),
      h(
        'div',
        { className: 'dpl-row-control', style: { flex: '1 1 320px', maxWidth: 420 } },
        h(PasswordInput, {
          value: token,
          onChange: setToken,
          placeholder: tokenSet ? '******** 已儲存（留空代表沿用）' : '貼上 Token',
        }),
      ),
    ),

    h(
      'div',
      { className: 'dpl-row', 'data-type': 'boolean' },
      h(
        'div',
        { className: 'dpl-row-main' },
        h('div', { className: 'dpl-row-label' }, '啟動時自動連線'),
        h('div', { className: 'dpl-row-help' }, 'DSH 啟動後自動用已儲存的 Token 連線。'),
      ),
      h(
        'div',
        { className: 'dpl-row-control' },
        h(Switch, {
          checked: Boolean(draft[autoKey]),
          onChange: (next) => setValue(autoKey, next),
        }),
      ),
    ),

    isUser
      ? h(
          'div',
          { className: 'dpl-note', 'data-tone': draft.dryRun ? 'warn' : 'info' },
          draft.dryRun
            ? '試跑模式已開啟：AI 只產生回覆，不發送文字或表情。要實際回覆，可在「總覽」的快速設定改為正式回覆，或到「系統 → 進階」關閉試跑模式。'
            : '試跑模式已關閉。關閉「僅觀察連線」並開啟「AI 自動回覆」後，新訊息可依回覆規則實際送出。',
          onNavigate
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'dpl-link',
                  style: { alignSelf: 'flex-start' },
                  onClick: () => onNavigate('overview'),
                },
                '前往快速設定',
              )
            : null,
        )
      : h(
          'div',
          { className: 'dpl-row', 'data-type': 'string' },
          h(
            'div',
            { className: 'dpl-row-main' },
            h('div', { className: 'dpl-row-label' }, '機器人活動狀態'),
            h(
              'div',
              { className: 'dpl-row-help' },
              '顯示在成員列表下方，例如「正在遊玩 陪你聊天」。文字留空則不顯示。',
            ),
          ),
          h(
            'div',
            { className: 'dpl-row-control', style: { flex: '1 1 260px', maxWidth: 420 } },
            (() => {
              const typeField = (fields || []).find((field) => field.key === 'botActivityType');
              return typeField
                ? h(
                    'select',
                    {
                      className: 'dpl-select',
                      style: { width: 'auto', flex: '0 0 auto' },
                      'aria-label': typeField.label || '活動類型',
                      value: String(draft.botActivityType ?? ''),
                      onChange: (event) => setValue('botActivityType', event.target.value),
                    },
                    (typeField.options || []).map((option) =>
                      h(
                        'option',
                        { key: String(option.value), value: option.value },
                        option.label ?? String(option.value),
                      ),
                    ),
                  )
                : null;
            })(),
            h('input', {
              className: 'dpl-input',
              value: draft.botActivityText || '',
              placeholder: '例如：陪你聊天',
              onChange: (event) => setValue('botActivityText', event.target.value),
            }),
          ),
        ),

    h(
      'div',
      { className: 'dpl-row', 'data-type': 'string' },
      h(
        'div',
        { className: 'dpl-row-main' },
        h('div', { className: 'dpl-row-label' }, '連線資訊'),
        h(
          'div',
          { className: 'dpl-row-help' },
          status?.ok
            ? `${status.user?.tag || status.user?.username || '-'} · ${status.guildCount ?? 0} 個伺服器 · 延遲 ${status.ping == null ? '未提供' : status.ping + 'ms'} · 已連線 ${fmtAgo(status.uptimeMs)}`
            : (status?.message || '尚未登入') +
                (isUser ? ` · 已觀察 ${status?.receivedCount || 0} 則訊息` : ''),
        ),
      ),
    ),

    h(
      'div',
      { className: 'dpl-row', 'data-type': 'actions' },
      h(
        'div',
        { className: 'dpl-row-main' },
        h(
          'div',
          { className: 'dpl-row-help' },
          busy
            ? '正在處理…'
            : !(token || tokenSet)
              ? '需要先填入 Token。'
              : !draft[enabledKey]
                ? '請先開啟右上角的「啟用此帳號」。'
                : '準備好就可以連線。',
        ),
        probe
          ? h(
              'div',
              {
                className: 'dpl-row-help',
                style: { color: probe.valid ? 'var(--dpl-ok)' : 'var(--dpl-err)', marginTop: 4 },
              },
              probe.valid
                ? `Token 有效：${probe.user?.tag || probe.user?.username}（ID ${probe.user?.id}${probe.fingerprint ? ` · fp ${probe.fingerprint}` : ''}）`
                : `${probe.valid === false ? '憑證被拒絕' : '驗證結果不確定'}：${probe.error || '未知錯誤'}${probe.fingerprint ? ` · fp ${probe.fingerprint}` : ''}`,
              probe.valid
                ? ''
                : h(
                    'span',
                    { className: 'dpl-muted', style: { display: 'block', marginTop: 2 } },
                    probe.hint || '',
                  ),
            )
          : null,
      ),
      h(
        'div',
        { className: 'dpl-row-control' },
        h(
          'button',
          {
            type: 'button',
            className: 'dpl-btn dpl-btn-sm',
            disabled: probing || !(token || tokenSet),
            onClick: handleProbe,
          },
          Icon.check({ size: 13 }),
          probing ? '驗證中...' : '驗證 Token',
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dpl-btn dpl-btn-primary dpl-btn-sm',
            disabled: busy || !(token || tokenSet) || !draft[enabledKey],
            onClick: () => onLogin(kind, token),
          },
          Icon.play({ size: 13 }),
          busy ? '連線中...' : status?.ok ? '儲存並重新連線' : '儲存並登入',
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'dpl-btn dpl-btn-danger dpl-btn-sm',
            disabled: busy || !(status?.ok || status?.workerRunning),
            onClick: () => onLogout(kind),
          },
          Icon.power({ size: 13 }),
          '登出',
        ),
      ),
    ),

    // 連線錯誤本身不能證明憑證被撤銷；原因須依 Gateway 與 REST 證據分開判斷。
    isUser && status?.state === 'error'
      ? h(
          'div',
          { className: 'dpl-note', 'data-tone': 'err' },
          h('div', { className: 'dpl-note-title' }, '使用者帳號連線發生錯誤'),
          h(
            'div',
            { className: 'dpl-note-body' },
            status?.message || '請查看執行記錄以確認實際錯誤。',
            h(
              'div',
              { className: 'dpl-muted' },
              '可用「驗證 Token」獨立確認目前憑證狀態；連線錯誤本身不代表 Token 失效。',
            ),
          ),
        )
      : null,
  );
}

// ---------------------------------------------------------------- log panel ---
