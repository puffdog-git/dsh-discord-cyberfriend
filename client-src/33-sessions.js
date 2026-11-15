function SessionRow({ session: s, onUpdated, onError }) {
  const [cwd, setCwd] = useState(s.cwd),
    [target, setTarget] = useState(''),
    [working, setWorking] = useState(false);
  const change = async (path, body) => {
    setWorking(true);
    try {
      await api(path, { method: 'POST', body: { key: s.key, ...body } });
      await onUpdated();
    } catch (error) {
      onError(error.message);
    } finally {
      setWorking(false);
    }
  };
  return h(
    'div',
    { className: 'dpl-note' },
    h('strong', null, s.title),
    h('div', null, s.sessionId),
    h('div', null, s.cwd),
    h('input', {
      className: 'dpl-input',
      value: cwd,
      placeholder: '工作區完整路徑',
      onChange: (e) => setCwd(e.target.value),
    }),
    h(
      'button',
      {
        className: 'dpl-btn dpl-btn-sm',
        disabled: s.running || working || cwd === s.cwd,
        onClick: () => change('/sessions/bind', { cwd }),
      },
      '保留歷史並移到此工作區',
    ),
    s.accountWorkspaceEnabled && h('button', { className: 'dpl-btn dpl-btn-sm', disabled: s.running || working, onClick: () => change('/sessions/bind', { useAccountWorkspace: true }) }, '保留歷史並使用帳號共用工作區'),
    h('small', null, '新目錄會自動建立。完成歷史核對後才切換綁定，舊會話保留；執行中不可移動。外部記憶庫不會自動搬移或合併。'),
    h('input', {
      className: 'dpl-input',
      value: target,
      placeholder: '重新綁定既有 DSH session ID',
      onChange: (e) => setTarget(e.target.value),
    }),
    h(
      'button',
      {
        className: 'dpl-btn dpl-btn-sm',
        disabled: s.running || working || !target,
        onClick: () => change('/sessions/bind', { sessionId: target }),
      },
      '綁定既有會話',
    ),
    h(
      'button',
      {
        className: 'dpl-btn dpl-btn-sm',
        disabled: s.running || working,
        onClick: () => change('/sessions/reset', {}),
      },
      '開始新會話',
    ),
  );
}
