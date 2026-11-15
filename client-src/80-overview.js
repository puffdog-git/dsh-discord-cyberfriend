// 總覽頁：連線狀態、快速設定、今日用量。
//
// 快速設定只是把分散在各頁的幾個關鍵設定集中在一起；所有變更都先寫進草稿，
// 列出「將變更的設定」，由使用者按下「儲存並連線」才送出，走的是與其他頁相同的
// 儲存與登入流程。後端預設值（試跑模式開啟、僅觀察、不自動回覆）不因此改變。

const SNOWFLAKE = /^\d{17,20}$/;

function CheckItem({ index, done, title, body, children }) {
  return h(
    'div',
    { className: 'dpl-check', 'data-done': done ? 'true' : 'false' },
    h(
      'div',
      { className: 'dpl-check-mark', 'aria-hidden': 'true' },
      done ? Icon.check({ size: 12 }) : String(index),
    ),
    h(
      'div',
      { className: 'dpl-check-main' },
      h(
        'div',
        { className: 'dpl-check-title' },
        title,
        done ? h('span', { className: 'dpl-sr' }, '（已完成）') : null,
      ),
      body ? h('div', { className: 'dpl-check-body' }, body) : null,
      children ? h('div', { className: 'dpl-check-control' }, children) : null,
    ),
  );
}

function Choice({ on, title, body, onClick, name }) {
  return h(
    'button',
    {
      type: 'button',
      className: 'dpl-choice',
      'data-on': on ? 'true' : 'false',
      'aria-pressed': on,
      'data-choice': name,
      onClick,
    },
    h('span', { className: 'dpl-choice-title' }, title),
    h('span', { className: 'dpl-choice-body' }, body),
  );
}

function QuickSetup({
  status,
  config,
  draft,
  setValue,
  fields,
  dirtyKeys,
  onLogin,
  busy,
  onNavigate,
  onTestModel,
  modelBusy,
  modelTest,
}) {
  const [probe, setProbe] = useState(null);
  const [probing, setProbing] = useState(false);
  const kind = draft.primaryTransport === 'bot' ? 'bot' : 'user';
  const isUser = kind === 'user';
  const tokenKey = isUser ? 'userToken' : 'botToken';
  const enabledKey = isUser ? 'userEnabled' : 'botEnabled';
  const token = String(draft[tokenKey] || '');
  const tokenSet = Boolean(config[`${tokenKey}__set`]);
  const connected = Boolean(status?.[kind]?.ok);
  const adminOk = SNOWFLAKE.test(String(draft.adminUserId || ''));
  const live =
    draft.dryRun === false && (!isUser || (draft.userReceiveOnly === false && draft.userAutoReply === true));

  const chooseKind = (next) => {
    setProbe(null);
    setValue('primaryTransport', next);
    setValue(next === 'user' ? 'userEnabled' : 'botEnabled', true);
  };
  const chooseMode = (goLive) => {
    setValue('dryRun', !goLive);
    if (isUser) {
      setValue('userReceiveOnly', !goLive);
      setValue('userAutoReply', goLive);
    }
  };
  const runProbe = async () => {
    setProbing(true);
    try {
      setProbe(
        await api('/probe-token', {
          method: 'POST',
          allowFailure: true,
          body: { transport: kind, ...(token ? { token } : {}) },
        }),
      );
    } catch (error) {
      setProbe({ valid: null, error: error.message });
    } finally {
      setProbing(false);
    }
  };

  // 只列出快速設定會動到的鍵；Token 只顯示「將更新」，不顯示內容。
  const wizardKeys = [
    'primaryTransport',
    enabledKey,
    tokenKey,
    'adminUserId',
    'dryRun',
    'userReceiveOnly',
    'userAutoReply',
  ];
  const autoKey = isUser ? 'userAutoStart' : 'botAutoStart';
  const dirtyChanges = dirtyKeys.filter((key) => wizardKeys.includes(key) || key === autoKey);
  // 第一次連線或有其他變更時，順便開啟「啟動時自動連線」，之後不必每次手動登入。
  const extra =
    (!connected || dirtyChanges.length) && config[autoKey] !== true && draft[autoKey] !== true
      ? { [autoKey]: true }
      : {};
  const changes = [...dirtyChanges, ...Object.keys(extra).filter((key) => !dirtyChanges.includes(key))];
  const show = (key, value) => {
    if (key === tokenKey) return value ? '將更新' : '不變';
    if (typeof value === 'boolean') return value ? '開啟' : '關閉';
    if (key === 'primaryTransport') return value === 'bot' ? '機器人' : '使用者帳號';
    return String(value || '（空白）');
  };
  const labelOf = (key) => fields.find((field) => field.key === key)?.label || key;
  const ready = (token || tokenSet) && Boolean(draft[enabledKey]);

  return h(
    Card,
    {
      title: connected && !changes.length ? '快速設定（已連線）' : '快速設定',
      icon: 'bolt',
      desc: '五個步驟完成第一次連線。前四步的選項都會先列出變更內容，按下「儲存並連線」才生效；第五步確認 AI 模型真的能回話。',
    },
    h(
      'div',
      { className: 'dpl-checklist' },
      h(
        CheckItem,
        { index: 1, done: Boolean(draft[enabledKey]), title: '選擇要連線的帳號' },
        h(
          'div',
          { className: 'dpl-choice-grid', style: { width: '100%' } },
          h(Choice, {
            name: 'kind-bot',
            on: !isUser,
            title: '機器人（建議）',
            body: '使用 Discord 官方的 Bot 帳號，符合平台規範。需要在 Developer Portal 建立應用程式。',
            onClick: () => chooseKind('bot'),
          }),
          h(Choice, {
            name: 'kind-user',
            on: isUser,
            title: '使用者帳號',
            body: '以一般帳號收發訊息。Discord 禁止自動化一般帳號，可能被停權，請使用小號。',
            onClick: () => chooseKind('user'),
          }),
        ),
      ),
      h(
        CheckItem,
        {
          index: 2,
          done: Boolean(token || tokenSet),
          title: isUser ? '貼上使用者 Token' : '貼上 Bot Token',
          body: isUser
            ? 'Token 只存在本機設定檔。取得方式：瀏覽器開發者工具的 Network 面板，複製任一請求的 authorization 標頭。'
            : '在 Developer Portal 的 Bot 頁面按 Reset Token 取得，並開啟 MESSAGE CONTENT INTENT，否則讀不到訊息內容。',
        },
        h(PasswordInput, {
          value: token,
          onChange: (value) => setValue(tokenKey, value),
          placeholder: tokenSet ? '已儲存（留空代表沿用）' : '貼上 Token',
        }),
        h(
          'button',
          {
            type: 'button',
            className: 'dpl-btn dpl-btn-sm',
            disabled: probing || !(token || tokenSet),
            onClick: runProbe,
          },
          probing ? '驗證中…' : '驗證 Token',
        ),
        probe
          ? h(
              'span',
              {
                className: 'dpl-pill',
                'data-tone': probe.valid ? 'ok' : probe.valid === false ? 'err' : 'warn',
                role: 'status',
              },
              probe.valid
                ? `有效：${probe.user?.tag || probe.user?.username || '已驗證'}`
                : `${probe.valid === false ? '憑證被拒絕' : '無法確認'}：${probe.error || '未知錯誤'}`,
            )
          : null,
      ),
      h(
        CheckItem,
        {
          index: 3,
          done: adminOk,
          title: '填入你自己的 Discord 使用者 ID',
          body: '這個帳號會被當成管理者，套用「管理者」的回覆設定並可使用停止、重答等操作；其他人套用「其他使用者」設定。在 Discord 開啟開發者模式後，右鍵自己的頭像選「複製使用者 ID」。',
        },
        h('input', {
          className: 'dpl-input',
          'data-mono': 'true',
          inputMode: 'numeric',
          'aria-label': '管理者使用者 ID',
          value: draft.adminUserId || '',
          placeholder: '例如 123456789012345678',
          'data-invalid': draft.adminUserId && !adminOk ? 'true' : 'false',
          onChange: (event) => setValue('adminUserId', event.target.value.trim()),
        }),
        draft.adminUserId && !adminOk
          ? h('span', { className: 'dpl-pill', 'data-tone': 'warn' }, '使用者 ID 應為 17～20 位數字')
          : null,
        adminOk && uiRuntime.names.has(String(draft.adminUserId))
          ? h('span', { className: 'dpl-pill', 'data-tone': 'ok', 'data-admin-name': '1' }, nameOfId(draft.adminUserId))
          : null,
        h(UserIdPicker, {
          single: true,
          value: draft.adminUserId || '',
          onChange: (id) => setValue('adminUserId', id),
        }),
        h(
          'button',
          { type: 'button', className: 'dpl-link', 'data-action': 'goto-people', onClick: () => onNavigate('people') },
          '設定白名單、黑名單與回覆範圍',
        ),
      ),
      h(
        CheckItem,
        { index: 4, done: true, title: '選擇回覆方式' },
        h(
          'div',
          { className: 'dpl-choice-grid', style: { width: '100%' } },
          h(Choice, {
            name: 'mode-observe',
            on: !live,
            title: '先觀察（試跑）',
            body: 'AI 會產生回覆並記錄在執行記錄，但不會對外送出任何訊息或表情。適合先確認設定。',
            onClick: () => chooseMode(false),
          }),
          h(Choice, {
            name: 'mode-live',
            on: live,
            title: '正式回覆',
            body: isUser
              ? '關閉試跑與僅觀察，開啟自動回覆。帳號會依回覆規則實際發言。'
              : '關閉試跑模式。機器人會依回覆規則實際發言。',
            onClick: () => chooseMode(true),
          }),
        ),
      ),
      h(
        CheckItem,
        {
          index: 5,
          done: Boolean(modelTest?.ok),
          title: '測試 AI 模型',
          body: '送一句測試訊息給目前設定的模型，確認登入、金鑰與額度都正常。沒有可用的模型時，AI 收到訊息也不會回話。這會實際呼叫一次模型，用量很小。',
        },
        h(
          'button',
          {
            type: 'button',
            className: 'dpl-btn dpl-btn-sm',
            'data-action': 'quick-test-model',
            disabled: Boolean(modelBusy) || !onTestModel,
            onClick: onTestModel,
          },
          modelBusy ? '測試中…' : modelTest ? '再測一次' : '測試模型',
        ),
        modelTest
          ? h(
              'span',
              { className: 'dpl-pill', 'data-tone': modelTest.ok ? 'ok' : 'err', role: 'status' },
              modelTest.ok ? '模型正常（' + modelTest.ms + ' 毫秒）' : '測試失敗：' + (modelTest.error || '未知錯誤'),
            )
          : null,
        modelTest && !modelTest.ok
          ? h(
              'button',
              { type: 'button', className: 'dpl-link', onClick: () => onNavigate('llm') },
              '前往模型設定',
            )
          : null,
      ),
    ),
    changes.length
      ? h(
          'div',
          { className: 'dpl-note', 'data-tone': 'info', role: 'note' },
          h('div', { className: 'dpl-note-title' }, `將變更 ${changes.length} 項設定`),
          h(
            'ul',
            { className: 'dpl-change-list' },
            changes.map((key) =>
              h(
                'li',
                { key },
                h('span', null, labelOf(key)),
                h('strong', null, show(key, key in extra ? extra[key] : draft[key])),
              ),
            ),
          ),
        )
      : null,
    h(
      'div',
      { className: 'dpl-actions', style: { marginTop: 10 } },
      h(
        'button',
        {
          type: 'button',
          className: 'dpl-btn dpl-btn-primary dpl-btn-lg',
          'data-action': 'quick-connect',
          disabled: busy || !ready,
          onClick: () => onLogin(kind, token, extra),
        },
        Icon.play({ size: 14 }),
        busy ? '連線中…' : connected ? '儲存並重新連線' : '儲存並連線',
      ),
      !ready ? h('span', { className: 'dpl-sub' }, '需要先完成步驟 1、2。') : null,
      h(
        'button',
        { type: 'button', className: 'dpl-link', onClick: () => onNavigate('llm') },
        '檢查模型設定',
      ),
    ),
  );
}

// 用量到上限的 80% 算「接近」，到 100% 算「已滿」。
const usageLevel = (kpi) =>
  !kpi.cap ? 'none' : kpi.value >= kpi.cap ? 'full' : kpi.value >= kpi.cap * 0.8 ? 'near' : 'ok';
function usageNotice(kpis) {
  const full = kpis.filter((kpi) => usageLevel(kpi) === 'full');
  const near = kpis.filter((kpi) => usageLevel(kpi) === 'near');
  if (!full.length && !near.length) return null;
  const names = (rows) => rows.map((kpi) => kpi.label).join('、');
  return h(
    'div',
    { className: 'dpl-note', 'data-tone': full.length ? 'err' : 'warn', role: 'status', 'data-usage-notice': full.length ? 'full' : 'near' },
    full.length
      ? h('span', null, names(full) + '今天已達上限，明天才會再回覆。這不是故障；想提高上限請到「回覆對象 → 回覆配額」。')
      : null,
    near.length ? h('span', null, names(near) + '已超過上限的八成，快用完了。') : null,
  );
}

// 「AI 怎麼不理我」：列出最近幾則被略過的訊息與原因。只顯示時間、帳號與原因，不顯示訊息內容。
function RecentSkips({ onNavigate }) {
  const loaded = useLoad(async () =>
    ((await api('/interaction'))?.interaction?.trace || []).filter((row) => row.phase === 'blocked').slice(0, 5),
  );
  const state = { kind: loaded.kind, rows: loaded.data || [], error: loaded.error };
  const load = loaded.reload;
  return h(
    Card,
    {
      title: '最近為什麼沒回',
      icon: 'chat',
      desc: '最近 5 則沒有回覆的訊息與原因。只列時間與原因，不顯示訊息內容。',
      actions: h(
        'button',
        { type: 'button', className: 'dpl-btn dpl-btn-sm', disabled: state.kind === 'loading', onClick: load },
        '重新整理',
      ),
    },
    h(
      'div',
      { 'data-recent-skips': state.kind },
      state.kind === 'error'
        ? h(StateView, { kind: 'error', title: '讀取失敗' }, state.error)
        : state.kind === 'loading' && !state.rows.length
          ? h(StateView, { kind: 'loading' })
          : state.rows.length
            ? state.rows.map((row) =>
                h(
                  'div',
                  { className: 'dpl-list-row', key: row.id },
                  h(Pill, { tone: 'muted' }, row.transport === 'user' ? '使用者帳號' : '機器人'),
                  h('span', { className: 'dpl-grow' }, row.reason || '沒有記錄原因'),
                  h('span', { className: 'dpl-kpi-cap' }, fmtTime(new Date(row.at).toISOString())),
                ),
              )
            : h(StateView, { kind: 'empty', title: '目前沒有被略過的訊息' }, '重新啟動後會清空；有訊息被略過時會出現在這裡。'),
    ),
    h(
      'button',
      {
        type: 'button',
        className: 'dpl-link',
        style: { alignSelf: 'flex-start', marginTop: 8 },
        onClick: () => onNavigate('companion'),
      },
      '查看完整的處理記錄',
    ),
  );
}

function OverviewPanel(props) {
  const { status, kpis, onNavigate } = props;
  const line = (kind, label) => {
    const s = status?.[kind];
    const tone = s?.ok ? 'ok' : s?.state === 'error' ? 'err' : 'muted';
    const text = s?.ok
      ? `${s.user?.tag || s.user?.username || '已連線'} · ${s.guildCount ?? 0} 個伺服器`
      : s?.state === 'error'
        ? s.message || '連線發生錯誤'
        : s?.state === 'connecting' || s?.state === 'reconnecting'
          ? '連線中…'
          : '尚未連線';
    return h(
      'div',
      { className: 'dpl-list-row', key: kind },
      h(Pill, { tone, dot: true }, label),
      h('span', { className: 'dpl-grow' }, text),
      h(
        'button',
        { type: 'button', className: 'dpl-btn dpl-btn-sm', onClick: () => onNavigate(kind) },
        '管理',
      ),
    );
  };
  return [
    h(QuickSetup, { key: 'quick-setup', ...props }),
    props.afterSetup || null,
    h(
      Card,
      { key: 'connections', title: '連線狀態', icon: 'power' },
      line('user', '使用者帳號'),
      line('bot', '機器人'),
    ),
    h(
      Card,
      {
        key: 'usage',
        title: '今日用量',
        icon: 'reply',
        desc: '達到上限後當日不再回覆；上限可在「回覆對象 → 回覆配額」調整。',
      },
      h(
        'div',
        { className: 'dpl-grid' },
        kpis.map((kpi) =>
          h(
            'div',
            { key: kpi.key, className: 'dpl-kpi' },
            h(
              'div',
              { className: 'dpl-kpi-head' },
              h('span', { className: 'dpl-kpi-label' }, kpi.label),
              h('span', { className: 'dpl-kpi-cap' }, kpi.cap ? `/ ${kpi.cap}` : '今日'),
            ),
            h('div', { className: 'dpl-kpi-value' }, fmtNum(kpi.value)),
            kpi.cap
              ? h(
                  'div',
                  { className: 'dpl-bar' },
                  h('div', {
                    className: 'dpl-bar-fill',
                    style: {
                      width: `${clamp((kpi.value / kpi.cap) * 100, 0, 100)}%`,
                      background:
                        usageLevel(kpi) === 'full'
                          ? 'var(--dpl-err)'
                          : usageLevel(kpi) === 'near'
                            ? 'var(--dpl-warn)'
                            : 'var(--dpl-accent)',
                    },
                  }),
                )
              : null,
          ),
        ),
      ),
      usageNotice(kpis),
    ),
    h(RecentSkips, { key: 'skips', onNavigate }),
  ];
}

// 管理者／其他使用者 × 私訊／群聊：四組設定共用一頁，以切換鈕選擇。
const AUDIENCE_LABELS = {
  adminDm: '管理者・私訊',
  adminGroup: '管理者・群聊',
  othersDm: '其他使用者・私訊',
  othersGroup: '其他使用者・群聊',
};
// 把目前這組的值填進另一組的草稿：只複製兩組都有的設定，回傳要寫入草稿的值。
function audienceCopyValues(fields, draft, from, to) {
  const known = new Set(fields.map((field) => field.key));
  const values = {};
  for (const field of fields) {
    if (!field.key.startsWith(from + '_')) continue;
    const target = to + field.key.slice(from.length);
    if (known.has(target) && !same(draft[field.key], draft[target])) values[target] = draft[field.key];
  }
  return values;
}

function AudienceSwitcher({ section, onChange, adminSet, onNavigate, fields = [], draft = {}, onCopy }) {
  const who = section.startsWith('admin') ? 'admin' : 'others';
  const scope = section.endsWith('Dm') ? 'Dm' : 'Group';
  // 私訊與群聊的選項不同，所以只在同一種場合之間複製（管理者 ↔ 其他使用者）。
  const copyTarget = (who === 'admin' ? 'others' : 'admin') + scope;
  const copyValues = audienceCopyValues(fields, draft, section, copyTarget);
  const copyCount = Object.keys(copyValues).length;
  const button = (target, label, on) =>
    h(
      'button',
      {
        key: target,
        type: 'button',
        'data-audience': target,
        'data-on': on ? 'true' : 'false',
        'aria-pressed': on,
        onClick: () => onChange(target),
      },
      label,
    );
  return h(
    Card,
    {
      title: '對象設定',
      icon: 'chat',
      desc: '同一套選項，依「對方是誰」與「在哪裡聊」分成四組。先選要調整的組合，下方就是該組合的設定。',
    },
    h(
      'div',
      { className: 'dpl-row', 'data-type': 'select' },
      h(
        'div',
        { className: 'dpl-row-main' },
        h('div', { className: 'dpl-row-label' }, '對方是誰'),
        h(
          'div',
          { className: 'dpl-row-help' },
          '管理者是「基本設定」裡綁定的那個帳號；其餘所有人都是其他使用者。',
        ),
      ),
      h(
        'div',
        { className: 'dpl-row-control' },
        h(
          'div',
          { className: 'dpl-seg', role: 'group', 'aria-label': '對方是誰' },
          button('admin' + scope, '管理者', who === 'admin'),
          button('others' + scope, '其他使用者', who === 'others'),
        ),
      ),
    ),
    h(
      'div',
      { className: 'dpl-row', 'data-type': 'select' },
      h('div', { className: 'dpl-row-main' }, h('div', { className: 'dpl-row-label' }, '在哪裡聊')),
      h(
        'div',
        { className: 'dpl-row-control' },
        h(
          'div',
          { className: 'dpl-seg', role: 'group', 'aria-label': '在哪裡聊' },
          button(who + 'Dm', '私訊', scope === 'Dm'),
          button(who + 'Group', '群聊', scope === 'Group'),
        ),
      ),
    ),
    onCopy
      ? h(
          'div',
          { className: 'dpl-row', 'data-type': 'action' },
          h(
            'div',
            { className: 'dpl-row-main' },
            h('div', { className: 'dpl-row-label' }, '複製到另一組'),
            h(
              'div',
              { className: 'dpl-row-help' },
              copyCount
                ? '把「' + AUDIENCE_LABELS[section] + '」目前的 ' + copyCount + ' 項不同設定填進「' + AUDIENCE_LABELS[copyTarget] + '」的草稿；按「儲存變更」才生效。'
                : '「' + AUDIENCE_LABELS[copyTarget] + '」目前與這一組完全相同。',
            ),
          ),
          h(
            'div',
            { className: 'dpl-row-control' },
            h(
              'button',
              {
                type: 'button',
                className: 'dpl-btn dpl-btn-sm',
                'data-audience-copy': copyTarget,
                disabled: !copyCount,
                onClick: () => onCopy(copyValues, AUDIENCE_LABELS[section], AUDIENCE_LABELS[copyTarget]),
              },
              '複製到「' + AUDIENCE_LABELS[copyTarget] + '」',
            ),
          ),
        )
      : null,
    !adminSet
      ? h(
          'div',
          { className: 'dpl-note', 'data-tone': 'warn', role: 'note' },
          '尚未綁定管理者 ID，目前所有人都套用「其他使用者」設定。',
          h(
            'button',
            {
              type: 'button',
              className: 'dpl-link',
              style: { alignSelf: 'flex-start' },
              onClick: () => onNavigate('overview'),
            },
            '前往快速設定',
          ),
        )
      : null,
  );
}

// 懶人設定：依使用情境一次調好「回覆誰、要不要主動插話」。
// 只是把一組設定值套到草稿上，仍要按「儲存變更」才生效；不會動到 Token、試跑模式等安全設定。
const SCENARIO_PRESETS = [
  {
    id: 'private',
    name: '只陪我聊',
    desc: '只回應管理者（你自己）：私訊會回，在群組被你 @ 也會回；其他人一律不回應。',
    needsAdmin: true,
    values: {
      adminDm_dmReplyEnabled: true,
      adminGroup_mentionReplyEnabled: true,
      adminGroup_followupEnabled: true,
      adminGroup_coChatEnabled: false,
      othersDm_dmReplyEnabled: false,
      othersGroup_mentionReplyEnabled: false,
      othersGroup_followupEnabled: false,
      othersGroup_coChatEnabled: false,
      othersGroup_autoReactionEnabled: false,
    },
  },
  {
    id: 'helper',
    name: '群組小幫手',
    desc: '群組裡任何人 @ 才回應，回完會接續聊一小段；不主動插話，也不回陌生人的私訊。',
    values: {
      adminDm_dmReplyEnabled: true,
      othersDm_dmReplyEnabled: false,
      adminGroup_mentionReplyEnabled: true,
      othersGroup_mentionReplyEnabled: true,
      adminGroup_followupEnabled: true,
      othersGroup_followupEnabled: true,
      adminGroup_coChatEnabled: false,
      othersGroup_coChatEnabled: false,
    },
  },
  {
    id: 'lively',
    name: '活躍群友',
    desc: '除了被 @ 會回，還會在你指定的頻道主動插話、按表情、傳 GIF。套用後請到「回覆對象 → 對象設定」選擇參與閒聊的頻道。',
    values: {
      adminDm_dmReplyEnabled: true,
      othersDm_dmReplyEnabled: false,
      adminGroup_mentionReplyEnabled: true,
      othersGroup_mentionReplyEnabled: true,
      adminGroup_followupEnabled: true,
      othersGroup_followupEnabled: true,
      adminGroup_coChatEnabled: true,
      othersGroup_coChatEnabled: true,
      adminGroup_coChatProbability: 25,
      othersGroup_coChatProbability: 25,
      adminGroup_autoReactionEnabled: true,
      othersGroup_autoReactionEnabled: true,
      adminGroup_gifEnabled: true,
      othersGroup_gifEnabled: true,
    },
  },
  {
    id: 'open',
    name: '公開聊天夥伴',
    desc: '所有人都可以私訊或在群組 @ 它聊天。適合想把 AI 朋友開放給大家的情境；請留意每日回覆上限。',
    values: {
      adminDm_dmReplyEnabled: true,
      othersDm_dmReplyEnabled: true,
      adminGroup_mentionReplyEnabled: true,
      othersGroup_mentionReplyEnabled: true,
      adminGroup_followupEnabled: true,
      othersGroup_followupEnabled: true,
    },
  },
];

// 語音夥伴：語音需要聲音工坊先就緒，所以做成帶檢查的引導，而不是單純套值。
// 只開「語音輸出」與「朗讀回覆」；收聽別人說話牽涉參與者同意，仍須到語音頁自行開啟。
const VOICE_PARTNER_VALUES = { voiceEnabled: true, voiceAutoSpeak: true };
function VoicePartnerGuide({ fields, draft, onApply, onNavigate }) {
  const [state, setState] = useState({ kind: 'idle' });
  const known = new Set(fields.map((field) => field.key));
  const values = Object.fromEntries(Object.entries(VOICE_PARTNER_VALUES).filter(([key]) => known.has(key)));
  const active = Object.keys(values).length > 0 && Object.entries(values).every(([key, value]) => same(draft[key], value));
  const check = async () => {
    setState({ kind: 'loading' });
    try {
      const payload = await api('/voice');
      setState({ kind: 'ready', tts: payload.tts || null });
    } catch (error) {
      setState({ kind: 'error', error: error.message });
    }
  };
  const ttsReady = state.kind === 'ready' && Boolean(state.tts?.ready);
  return h(
    Card,
    {
      title: '語音夥伴',
      icon: 'voice',
      desc: '讓 AI 在語音房把回覆唸出來。需要先在「DSH 聲音工坊」設定好聲音。',
    },
    h(
      'div',
      { className: 'dpl-checklist', 'data-voice-guide': state.kind },
      h(
        CheckItem,
        { index: 1, done: ttsReady, title: '確認聲音工坊可以合成語音' },
        h(
          'button',
          { type: 'button', className: 'dpl-btn dpl-btn-sm', disabled: state.kind === 'loading', onClick: check },
          state.kind === 'loading' ? '檢查中…' : state.kind === 'idle' ? '檢查' : '重新檢查',
        ),
        state.kind === 'ready'
          ? h(
              'span',
              { className: 'dpl-pill', 'data-tone': ttsReady ? 'ok' : 'warn', role: 'status' },
              ttsReady
                ? '可用：' + (state.tts.name || state.tts.provider || '語音服務')
                : '語音服務尚未就緒，請先到「DSH 聲音工坊」完成試聽',
            )
          : null,
        state.kind === 'error'
          ? h('span', { className: 'dpl-pill', 'data-tone': 'err', role: 'alert' }, '檢查失敗：' + state.error)
          : null,
      ),
      h(
        CheckItem,
        { index: 2, done: active, title: '開啟語音輸出與朗讀回覆', body: '套用後只是先填進草稿，按下方「儲存變更」才生效。' },
        h(
          'button',
          {
            type: 'button',
            className: 'dpl-btn dpl-btn-sm',
            'data-action': 'voice-partner-apply',
            disabled: !ttsReady || active,
            onClick: () => onApply(values, '語音夥伴'),
          },
          active ? '已套用' : '套用',
        ),
        !ttsReady && !active ? h('span', { className: 'dpl-sub' }, '先完成步驟 1。') : null,
      ),
      h(
        CheckItem,
        {
          index: 3,
          done: false,
          title: '選擇語音房並加入',
          body: '到「語音 → 語音與音樂」選擇帳號與伺服器，從自動偵測的房間名稱清單加入。允許房間留空代表不限，仍須有 Discord 權限。想讓 AI 聽懂大家說話，需要另外開啟收聽並確認已取得參與者同意。',
        },
        h(
          'button',
          { type: 'button', className: 'dpl-btn dpl-btn-sm', onClick: () => onNavigate('voice') },
          '前往語音設定',
        ),
      ),
    ),
  );
}

function PresetCard({ fields, draft, adminSet, onApply }) {
  const known = new Set(fields.map((field) => field.key));
  // 只套用這個版本確實存在的設定鍵。
  const valuesOf = (preset) =>
    Object.fromEntries(Object.entries(preset.values).filter(([key]) => known.has(key)));
  return h(
    Card,
    {
      title: '懶人設定',
      icon: 'bolt',
      desc: '依使用情境一次調好「回覆誰、要不要主動插話」。套用後只是先填進草稿，按下方「儲存變更」才生效；之後仍可到各頁細調。',
    },
    h(
      'div',
      { className: 'dpl-choice-grid' },
      SCENARIO_PRESETS.map((preset) => {
        const values = valuesOf(preset);
        const active =
          Object.keys(values).length > 0 &&
          Object.entries(values).every(([key, value]) => same(draft[key], value));
        return h(
          'button',
          {
            key: preset.id,
            type: 'button',
            className: 'dpl-choice',
            'data-preset': preset.id,
            'data-on': active ? 'true' : 'false',
            'aria-pressed': active,
            onClick: () => onApply(values, preset.name),
          },
          h(
            'span',
            { className: 'dpl-choice-title' },
            preset.name,
            active ? h('span', { className: 'dpl-badge', style: { marginLeft: 8 } }, '目前符合') : null,
          ),
          h('span', { className: 'dpl-choice-body' }, preset.desc),
          preset.needsAdmin && !adminSet
            ? h(
                'span',
                { className: 'dpl-choice-body', style: { color: 'var(--dpl-warn)' } },
                '需要先在上方快速設定填入管理者 ID，否則沒有人會被回應。',
              )
            : null,
        );
      }),
    ),
  );
}
