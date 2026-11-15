function MemeImagesPanel({ onNavigate }) {
  const [data, D] = useState(null),
    [error, E] = useState(''),
    [busy, W] = useState(false);
  const load = async () => {
    W(true);
    E('');
    try {
      D(await api('/meme-images'));
    } catch (e) {
      E(e.message);
    } finally {
      W(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  return h(
    Card,
    {
      title: 'dsh-meme 表情圖片',
      desc: '由外部圖庫選圖，Discord上傳圖片附件；對方不需要安裝dsh-meme，不會只收到[表情:…]代碼。',
    },
    h(
      'p',
      null,
      data?.available
        ? '圖庫服務已連接；是否發圖仍依各對象開關、機率與冷卻。'
        : '尚未取得dshMeme v1服務，請先載入dsh-meme。',
    ),
    h('button', { className: 'dpl-btn', disabled: busy, onClick: load }, '更新表情圖庫清單'),
    h(
      'p',
      { className: 'dpl-note' },
      '圖庫與分類可在dsh-meme管理；此處填ID可進一步限制。每次最多一張、8MiB；不改Discord原生貼圖與GIF開關。',
    ),
    (data?.packs || []).map((p) =>
      h(
        'p',
        { key: p.id, style: { overflowWrap: 'anywhere' } },
        p.name + ' · ID：' + p.id + ' · ' + p.count + ' 張',
      ),
    ),
    h(
      'div',
      { className: 'dpl-actions' },
      [
        ['adminDm', '管理者私訊發圖開關'],
        ['adminGroup', '管理者群聊發圖開關'],
        ['othersDm', '其他人私訊發圖開關'],
        ['othersGroup', '其他人群聊發圖開關'],
      ].map(([id, text]) =>
        h('button', { key: id, className: 'dpl-btn', onClick: () => onNavigate(id) }, text),
      ),
    ),
    error ? h('p', { role: 'alert' }, error) : null,
  );
}
