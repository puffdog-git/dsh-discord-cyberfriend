// 使用者帳號卡片裡的「Python 執行環境」：顯示有沒有裝好，沒有就一鍵安裝。
// 安裝在背景進行（可能要幾分鐘），這裡每兩秒讀一次進度。
function PythonSetupRow() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const alive = useRef(true);
  const load = React.useCallback(async () => {
    try {
      const result = await api('/user/python');
      if (alive.current) {
        setInfo(result.python || null);
        setError('');
      }
    } catch (failure) {
      if (alive.current) setError(failure.message || '讀取失敗');
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    load();
    return () => {
      alive.current = false;
    };
  }, [load]);
  const running = info?.state === 'running';
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [running, load]);

  async function install() {
    setStarting(true);
    setError('');
    try {
      const result = await api('/user/python/install', { method: 'POST', body: {} });
      if (alive.current) setInfo(result.python || null);
    } catch (failure) {
      if (alive.current) setError(failure.message || '無法開始安裝');
    } finally {
      if (alive.current) setStarting(false);
    }
  }

  const ready = Boolean(info?.ready);
  const tone = running ? 'warn' : ready ? 'ok' : 'err';
  const badge = !info ? '讀取中' : running ? '安裝中' : info.customPath ? '使用自訂路徑' : ready ? '已安裝' : '尚未安裝';
  let help;
  if (!info) help = '正在檢查…';
  else if (running)
    help = `正在${info.stepLabel || '安裝'}…第一次安裝要下載套件，通常需要幾分鐘，可以先去做別的事，這個頁面不用一直開著。`;
  else if (info.customPath)
    help = '你在下面的「Python 執行檔路徑」填了自己的 Python，插件會用那一份，不會自動安裝。';
  else if (info.state === 'failed') help = '上次安裝沒有成功：' + (info.error || '未知錯誤');
  else if (ready)
    help =
      info.state === 'done'
        ? '安裝完成。填好 Token 後按下面的「儲存並登入」就可以連線。'
        : '使用者帳號需要的 Python 環境已經裝好。連線出現套件相關的錯誤時，可以按右邊重新安裝一次。';
  else if (info.base && !info.base.found)
    help = '使用者帳號需要 Python 3.11 以上，但找不到可用的 Python。請先安裝 Python 再按右邊的按鈕，或在下面的欄位填入 Python 的完整路徑。';
  else
    help =
      '使用者帳號需要另外一套 Python 套件，按右邊的按鈕就會自動裝好' +
      (info.base?.source === 'dsh' ? '（使用 DSH 內附的 Python，不會動到你電腦上其他的 Python）' : '') +
      '。只用機器人帳號的話不需要安裝。';

  return h(
    'div',
    { className: 'dpl-row', 'data-type': 'actions', 'data-python-setup': !info ? 'loading' : running ? 'running' : ready ? 'ready' : 'missing' },
    h(
      'div',
      { className: 'dpl-row-main' },
      h('div', { className: 'dpl-row-label' }, 'Python 執行環境', h(Pill, { tone, dot: true }, badge)),
      h('div', { className: 'dpl-row-help', role: info?.state === 'failed' ? 'alert' : 'status' }, help),
      error ? h('div', { className: 'dpl-row-help', role: 'alert', style: { color: 'var(--dpl-err)' } }, error) : null,
    ),
    h(
      'div',
      { className: 'dpl-row-control' },
      h(
        'button',
        {
          type: 'button',
          className: 'dpl-btn dpl-btn-sm' + (ready ? '' : ' dpl-btn-primary'),
          'data-action': 'python-install',
          disabled: !info || running || starting || info.customPath,
          onClick: install,
        },
        Icon.bolt({ size: 13 }),
        running || starting ? '安裝中…' : ready ? '重新安裝' : info?.state === 'failed' ? '再試一次' : '一鍵安裝',
      ),
    ),
  );
}
