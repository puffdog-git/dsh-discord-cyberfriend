function SingingGuide({ onNavigate }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [diagnostic, setDiagnostic] = useState(null),
    [checking, setChecking] = useState(false);
  const load = async () => {
    try {
      setData((await api('/singing')).singing);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const names = {
    video_info: '讀取歌曲來源',
    video_download: '下載公開音源',
    cover_doctor: '檢查翻唱引擎',
    cover_separate: '分離人聲／伴奏',
    cover_shift: '調整音高',
    cover_convert: '轉換演唱音色',
    cover_mix: '混音',
    cover_verify: '驗證成品',
  };
  const example =
    '請幫我翻唱〈歌名〉：先在 YouTube 找到這首歌讓我確認，再用已配置的音色做 25 秒試唱，回傳到目前 Discord 頻道；等我確認後再做整曲。';
  return h(
    Card,
    { title: '唱歌與翻唱導覽', desc: '找歌和下載音源已經內建；把歌聲換成指定音色的「翻唱引擎」需要另外安裝。' },
    h('p', null, 'TTS 負責說話；唱歌需要原唱／人聲與翻唱引擎，不能只把歌詞送進一般 TTS。'),
    h(
      'ol',
      null,
      h('li', null, '安裝並載入翻唱插件 dsh-cover-pipeline，在它的設定裡準備好推理引擎與音色。找歌與下載音源不用另外安裝。'),
      h(
        'li',
        null,
        '在上方打開「管理者可以在私訊請 AI 唱歌」並儲存。想在群聊用，另外打開「管理者可以在群聊請 AI 唱歌」；想開放給特定群友，把他們加進「哪些群友可以請 AI 唱歌」。沒被加進去的人不會因此能用。',
      ),
      h('li', null, '告訴 AI 歌名，或直接貼上歌曲網址。只給歌名時，AI 會先在 YouTube 找出幾首候選讓你確認是哪一首，再試唱 25 秒。'),
      h('li', null, '聽過試唱並明確確認同一音源、音色及移調後，才能製作整曲。'),
      h('li', null, '回傳目前文字頻道，或播放到已加入且綁定該文字頻道的語音房；不會自行加入任意房間。'),
    ),
    h(
      'details',
      null,
      h('summary', null, '使用自己訓練的聲音'),
      h(
        'p',
        null,
        '若想要用自己訓練的聲音，請參考 ',
        h(
          'a',
          {
            href: 'https://github.com/InariNGT-Ofiicial/dsh-train-pipeline',
            target: '_blank',
            rel: 'noopener noreferrer',
          },
          'dsh-train-pipeline 音色訓練插件',
        ),
        '。',
      ),
      h(
        'p',
        null,
        '訓練與短句試聽完成後，使用 train_register 註冊模型及配套設定，再讓 cover-pipeline 重新載入音色。訓練、翻唱與 Discord 交付各自獨立；註冊成功不等於音質已通過驗收。',
      ),
    ),
    h(
      'div',
      { className: 'dpl-actions' },
      h('button', { className: 'dpl-btn', onClick: load }, '更新唱歌能力'),
      h(
        'button',
        {
          className: 'dpl-btn',
          disabled: checking,
          onClick: async () => {
            setChecking(true);
            setError('');
            try {
              setDiagnostic((await api('/singing/doctor', { method: 'POST', body: {} })).diagnostic);
            } catch (e) {
              setError(e.message);
            } finally {
              setChecking(false);
            }
          },
        },
        checking ? '檢查中…' : '檢查翻唱環境',
      ),
      h('button', { className: 'dpl-btn', onClick: () => onNavigate('voice') }, '前往語音房設定'),
      h('button', { className: 'dpl-btn', onClick: () => onNavigate('sessions') }, '前往 DSH 會話設定'),
    ),
    h(
      'p',
      { className: 'dpl-note' },
      '目前狀態：' +
        (data?.enabled ? '唱歌功能已開啟' : '唱歌功能還沒開啟') +
        '。下面顯示「工具已載入」只代表翻唱插件有裝好，不代表引擎、模型和音色都準備好了；這一頁不會下載歌曲或啟動模型。',
    ),
    diagnostic
      ? h(
          'div',
          { role: 'status' },
          h(
            'p',
            null,
            diagnostic.ready ? '環境檢查通過，仍需先試唱確認音質。' : '環境尚未就緒，請依下方缺項修復。',
          ),
          diagnostic.checks.map((check, i) =>
            h(
              'p',
              { key: i },
              check.name +
                ' · ' +
                (check.ok ? '通過' : '未通過') +
                ' · ' +
                check.detail +
                (check.fix ? ' · ' + check.fix : ''),
            ),
          ),
        )
      : null,
    (data?.tools || []).map((row) =>
      h(
        'div',
        { className: 'dpl-list-row', key: row.name },
        h('span', null, names[row.name] || row.name),
        h('span', { className: 'dpl-badge' }, row.builtin ? '已內建' : row.registered ? '工具已載入' : '尚未載入'),
      ),
    ),
    h(
      'details',
      null,
      h('summary', null, '用自然語言安排試唱'),
      h('p', null, example),
      h(
        'button',
        {
          className: 'dpl-btn',
          onClick: async () => {
            try {
              await navigator.clipboard.writeText(example);
              setNotice('已複製試唱範例');
            } catch {
              setNotice('無法存取剪貼簿，請手動複製上方文字');
            }
          },
        },
        '複製試唱範例',
      ),
    ),
    h(
      'details',
      null,
      h('summary', null, '目前歌曲工作與停止方式'),
      (data?.jobs || []).length
        ? data.jobs.map((job) =>
            h(
              'div',
              { key: job.id, className: 'dpl-asset' },
              h('p', null, job.id + ' · ' + phaseLabel(job.state) + ' · ' + (names[job.stage] || job.stage)),
              h(
                'button',
                {
                  className: 'dpl-btn',
                  disabled: !['queued', 'running', 'cancelling'].includes(job.state),
                  onClick: async () => {
                    try {
                      await api('/singing/cancel', { method: 'POST', body: { id: job.id } });
                      setNotice('已要求停止歌曲工作；等待外部程序結束前不會交付');
                      await load();
                    } catch (e) {
                      setError(e.message);
                    }
                  },
                },
                '停止此歌曲工作',
              ),
            ),
          )
        : h(
            'p',
            null,
            '目前沒有歌曲工作。可在同一會話要求 song_cover_status／song_cover_cancel 查詢或取消；送達結果不明時不會自動重送。',
          ),
    ),
    notice ? h('p', { role: 'status' }, notice) : null,
    error ? h('p', { role: 'alert' }, error) : null,
  );
}
