function UserPresenceCard({ fields, config, draft, setValue, dirtyKeys, status, onRefresh }) {
  const [applying, setApplying] = useState(false),
    [result, setResult] = useState(null),
    [observed, setObserved] = useState(null);
  useEffect(() => setResult(null), [status?.presence?.updatedAt]);
  const last = result || status?.presence;
  const labels = { offline: '離線／隱藏', online: '上線', idle: '閒置', dnd: '請勿打擾', invisible: '隱藏' };
  const verbs = { playing: '正在遊玩', listening: '正在聆聽', watching: '正在觀看', competing: '正在競賽' };
  const apply = async () => {
    setApplying(true);
    try {
      const payload = await api('/presence', {
        method: 'POST',
        body: { transport: 'user' },
        allowFailure: true,
      });
      setResult(payload.results?.user || { ok: false, error: payload.error });
      await onRefresh();
    } catch (e) {
      setResult({ ok: false, error: e.message });
    } finally {
      setApplying(false);
    }
  };
  return h(
    Card,
    {
      title: '帳號狀態與活動',
      icon: 'user',
      desc: '儲存會即時套用；登入與重新連線時恢復。關閉管理會保留當前 Discord 外觀。',
    },
    h(
      'div',
      { className: 'dpl-note' },
      h('strong', null, '設定預覽：'),
      labels[draft.userStatus] || '上線',
      draft.userActivityType !== 'none' && verbs[draft.userActivityType]
        ? ' · ' + verbs[draft.userActivityType] + ' ' + (draft.userActivityText || '（請輸入文字）')
        : '',
      draft.userCustomStatusText || draft.userCustomStatusEmoji
        ? ' · ' + [draft.userCustomStatusEmoji, draft.userCustomStatusText].filter(Boolean).join(' ')
        : '',
    ),
    h(FieldList, { fields, config, draft, setValue, dirtyKeys }),
    config.userReceiveOnly
      ? h('p', { className: 'dpl-row-help' }, '僅觀察模式禁止修改 Discord 外觀，請先關閉並儲存。')
      : null,
    h(
      'div',
      { className: 'dpl-actions' },
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled:
            applying ||
            !status?.ok ||
            !config.userPresenceEnabled ||
            config.userReceiveOnly ||
            fields.some((f) => dirtyKeys.includes(f.key)),
          onClick: apply,
        },
        applying ? '套用中…' : '重新套用已儲存外觀',
      ),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: applying || !status?.ok,
          onClick: async () => {
            setApplying(true);
            try {
              const payload = await api('/presence?refresh=1');
              setObserved(payload.current);
            } catch (e) {
              setObserved({ ok: false, error: e.message });
            } finally {
              setApplying(false);
            }
          },
        },
        '讀取 Discord 狀態',
      ),
      h(
        'span',
        { className: 'dpl-row-help', role: 'status' },
        !config.userPresenceEnabled
          ? '未由插件管理'
          : last
            ? last.ok
              ? 'Discord 已接受更新請求' +
                (last.updatedAt ? ' · ' + new Date(last.updatedAt).toLocaleTimeString() : '')
              : '套用失敗：' + last.error
            : status?.ok
              ? '儲存後套用'
              : '尚未連線，登入後套用',
      ),
    ),
    observed
      ? h(
          'p',
          { className: 'dpl-row-help', role: 'status' },
          observed.ok
            ? 'Gateway 回報：此連線 ' +
                (labels[observed.clientStatus] || observed.clientStatus) +
                '；帳號整體 ' +
                (labels[observed.accountStatus] || observed.accountStatus) +
                '；活動 ' +
                ((observed.activities || []).map((a) => a.state || a.name).join('、') || '無') +
                '。其他裝置也會影響整體狀態。'
            : '讀取失敗：' + observed.error,
        )
      : null,
  );
}
