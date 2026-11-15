/**
 * data/client-smoke.mjs — 不需要瀏覽器也能驗證 client.js
 *   - 用假的 __ModuleLoader__ 載入模組，確認匯出形狀（name / inject / apply）
 *   - 用「迷你 React」真的渲染整棵元件樹（含 hooks 重繪），抓 undefined 存取等錯誤
 *   - 走過 12 個分區的導覽、切換開關、儲存，驗證送出的 patch 只含差異欄位
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describeSchema } from '../src/config.js';

const root = resolve(import.meta.dirname, '..');
const clientPath = resolve(root, 'client.js');

// ----------------------------------------------------------------- mini react ---
const instMap = new Map();
const effectQueue = [];
let renderCtx = null;
let dirty = false;

function createElement(type, props, ...children) {
  return {
    el: true,
    type,
    props: {
      ...(props || {}),
      children: children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false && child !== true),
    },
  };
}

const React = {
  useSyncExternalStore: (_subscribe, get) => get(),
  createElement,
  useState(initial) {
    const inst = renderCtx;
    const index = inst.cursor++;
    if (!(index in inst.states)) inst.states[index] = typeof initial === 'function' ? initial() : initial;
    return [inst.states[index], (value) => {
      inst.states[index] = typeof value === 'function' ? value(inst.states[index]) : value;
      dirty = true;
    }];
  },
  useRef(initial) {
    const inst = renderCtx;
    const index = inst.cursor++;
    if (!(index in inst.refs)) inst.refs[index] = { current: initial };
    return inst.refs[index];
  },
  useMemo(factory, deps) {
    const inst = renderCtx;
    const index = inst.cursor++;
    const previous = inst.memos[index];
    const same = previous && deps && previous.deps.length === deps.length && previous.deps.every((dep, i) => dep === deps[i]);
    if (!same) inst.memos[index] = { deps: deps || [], value: factory() };
    return inst.memos[index].value;
  },
  useCallback(fn, deps) {
    const inst = renderCtx;
    const index = inst.cursor++;
    const previous = inst.memos[index];
    const same = previous && deps && previous.deps.every((dep, i) => dep === deps[i]);
    if (!same) inst.memos[index] = { deps: deps || [], value: fn };
    return inst.memos[index].value;
  },
  useEffect(fn, deps) {
    const inst = renderCtx;
    const index = inst.cursor++;
    const previous = inst.effects[index];
    const same = previous && (!deps || (previous.deps.length === deps.length && previous.deps.every((dep, i) => dep === deps[i])));
    if (!same) {
      inst.effects[index] = { deps: deps || [], cleanup: undefined };
      effectQueue.push({ fn, inst, index, first: !previous });
    }
  },
};

function renderTree(node, path = '0') {
  if (node === null || node === undefined || node === false) return null;
  if (typeof node === 'string' || typeof node === 'number') return { text: String(node) };
  if (Array.isArray(node)) return { children: node.map((child, i) => renderTree(child, `${path}.${i}`)).filter(Boolean) };
  if (!node.el) return { text: String(node) };
  const { type, props } = node;
  if (typeof type === 'function') {
    // 實體以「位置 + 元件名」區分，模擬 React 用 type 判斷是否重掛載
    const key = `${path}|${type.name || 'anonymous'}`;
    const inst = instMap.get(key) || { states: [], refs: [], memos: [], effects: [], cursor: 0 };
    instMap.set(key, inst);
    inst.cursor = 0;
    const previous = renderCtx;
    renderCtx = inst;
    let output;
    try {
      output = type(props);
    } catch (error) {
      throw new Error(`元件 ${type.name || 'anonymous'} 渲染失敗：${error.message}`);
    }
    renderCtx = previous;
    return renderTree(output, `${path}/c`);
  }
  const kids = (props.children || []).map((child, i) => renderTree(child, `${path}.${i}`)).filter(Boolean);
  return { tag: type, props, children: kids };
}

function walk(node, visit) {
  if (!node) return;
  visit(node);
  for (const child of node.children || []) walk(child, visit);
}

function textOf(node) {
  if (node === null || node === undefined || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (node.text !== undefined) return node.text;
  if (Array.isArray(node.children) && node.children.length) return node.children.map(textOf).join(' ');
  if (node.props && node.props.children) return node.props.children.map(textOf).join(' ');
  return (node.children || []).map(textOf).join(' ');
}

function collect(tree, predicate) {
  const found = [];
  walk(tree, (node) => {
    if (node.el !== true && node.tag && predicate(node)) found.push(node);
  });
  return found;
}

function buttonsWithText(tree, needle) {
  return collect(tree, (node) => node.tag === 'button' && textOf({ children: node.props.children }).includes(needle));
}

function buttonsByClass(tree, className) {
  return collect(tree, (node) => node.tag === 'button' && node.props.className === className);
}

async function render(element) {
  for (let pass = 0; pass < 30; pass += 1) {
    dirty = false;
    effectQueue.length = 0;
    instMap.forEach((inst) => { inst.cursor = 0; });
    const tree = renderTree(element, '0');
    for (const effect of effectQueue) {
      const previousCleanup = effect.inst.cleanupSlots?.[effect.index];
      if (typeof previousCleanup === 'function') previousCleanup();
      const cleanup = await effect.fn();
      if (!effect.inst.cleanupSlots) effect.inst.cleanupSlots = {};
      effect.inst.cleanupSlots[effect.index] = typeof cleanup === 'function' ? cleanup : undefined;
    }
    await new Promise((done) => setTimeout(done, 0));
    if (!dirty) return tree;
  }
  throw new Error('渲染沒有穩定（超過 30 次重繪）');
}

// --------------------------------------------------------------- 瀏覽器替身 ---
const styleNodes = [];
globalThis.document = {
  head: { appendChild() {} },
  querySelector: (selector) => styleNodes.find((node) => node.selector === selector) || null,
  createElement: () => {
    const node = {
      selector: '',
      textContent: '',
      setAttribute(name, value) { if (name === 'data-plugin-css') node.selector = `style[data-plugin-css="${value}"]`; },
      remove() {},
    };
    styleNodes.push(node);
    return node;
  },
  addEventListener() {},
  removeEventListener() {},
};

// ------------------------------------------------------------------- fixtures ---
const SECTION_IDS = ['overview', 'general', 'sessions', 'adminDm', 'adminGroup', 'othersDm', 'othersGroup', 'user', 'bot', 'people', 'reply', 'cochat', 'reaction', 'gif', 'voice', 'safety', 'culture', 'history', 'memoryOutput', 'log', 'llm', 'advanced'];
const SECTION_GROUP = { overview: 'start', general: 'start', user: 'start', bot: 'start', llm: 'start', adminDm: 'audience', adminGroup: 'audience', othersDm: 'audience', othersGroup: 'audience', sessions: 'audience', people: 'audience', reply: 'audience', cochat: 'audience', safety: 'audience', reaction: 'interact', gif: 'interact', culture: 'interact', voice: 'voice', history: 'system', memoryOutput: 'system', log: 'system', advanced: 'system' };
const AUDIENCE_IDS = ['adminDm', 'adminGroup', 'othersDm', 'othersGroup'];
const groups = [['start', '開始'], ['audience', '回覆對象'], ['interact', '互動'], ['voice', '語音'], ['system', '系統']].map(([id, label]) => ({ id, label, icon: 'settings', desc: '' }));
const sections = SECTION_IDS.map((id, index) => ({ id, label: `分區-${id}`, icon: id, order: index, group: SECTION_GROUP[id], readOnly: id === 'overview' }));

const fields = [];
function addField(section, key, type, extra) {
  const base = type === 'boolean' ? true
    : type === 'tags' ? []
      : type === 'number' || type === 'range' ? 10
        : type === 'select' ? (extra?.options?.[0]?.value ?? '') : '';
  fields.push({ key, section, type, label: `欄位-${key}`, default: base, ...(extra || {}) });
}
addField('general', 'enabled', 'boolean');
addField('general', 'primaryTransport', 'select', { options: [{ value: 'user', label: '使用者' }, { value: 'bot', label: '機器人' }] });
addField('general', 'statusRefreshSeconds', 'range', { min: 5, max: 600, step: 5, unit: '秒' });
addField('user', 'userEnabled', 'boolean');
addField('user', 'userToken', 'password', {secret:true});
addField('user', 'userReceiveOnly', 'boolean');
addField('user', 'userAutoReply', 'boolean');
addField('user', 'userPythonExecutable', 'string');
addField('bot', 'botEnabled', 'boolean');
addField('bot', 'botToken', 'password', { secret: true, transport: 'bot' });
addField('bot', 'botActivityText', 'string');
addField('reply', 'mentionReplyEnabled', 'boolean');
addField('reply', 'cooldownSeconds', 'number', { min: 0, max: 600 });
addField('reply', 'whitelistUserIds', 'tags');
addField('cochat', 'coChatEnabled', 'boolean');
addField('cochat', 'coChatProbability', 'range', { min: 0, max: 100, step: 5, unit: '%' });
addField('cochat', 'interestKeywords', 'tags');
addField('reaction', 'autoReactionEnabled', 'boolean');
addField('reaction', 'autoReactionEmojis', 'tags');
addField('gif', 'gifEnabled', 'boolean');
addField('gif', 'gifApiKey', 'password', { secret: true });
addField('gif', 'gifProvider', 'select', { options: [{ value: 'tenor', label: 'Tenor' }, { value: 'custom', label: '自訂' }] });
addField('history', 'historyEnabled', 'boolean');
addField('history', 'historyRetentionDays', 'number', { min: 1, max: 90 });
addField('log', 'logEnabled', 'boolean');
addField('log', 'logLevel', 'select', { options: [{ value: 'info', label: 'info' }, { value: 'debug', label: 'debug' }] });
addField('llm', 'llmMode', 'select', { options: [{ value: 'auto', label: '自動' }, { value: 'subscriptions', label: '訂閱' }, { value: 'custom', label: '自訂' }] });
addField('llm', 'customLlmApiKey', 'password', { secret: true });
addField('llm', 'temperature', 'range', { min: 0, max: 2, step: 0.1 });
addField('advanced', 'dryRun', 'boolean');
addField('advanced', 'maxConcurrentReplies', 'number', { min: 1, max: 8 });

fields.push(...describeSchema().fields.filter(f => /^(admin|others)(Dm|Group)$/.test(f.section) || f.key === 'adminUserId' || f.section === 'sessions'||f.key.startsWith('token')||f.key.startsWith('userAutoTakeover')||['userPresenceEnabled','userStatus','userActivityType','userActivityText','userCustomStatusText','userCustomStatusEmoji'].includes(f.key)));
for(const field of fields)field.enabledWhen=describeSchema().fields.find(f=>f.key===field.key)?.enabledWhen||[];
const config = {};
for (const field of fields) config[field.key] = Array.isArray(field.default) ? [...field.default] : field.default;
Object.assign(config, {
  enabled: true, userEnabled: true, botEnabled: false, primaryTransport: 'user',
  userToken: '', userToken__set: true, botToken: '', botToken__set: false,
  gifApiKey: '', gifApiKey__set: false, customLlmApiKey: '', customLlmApiKey__set: false,
  userStatus: 'online', logLevel: 'info', llmMode: 'auto', statusRefreshSeconds: 60,
  coChatProbability: 25, interestKeywords: ['ai', 'code'], whitelistUserIds: [],
});

const schemaPayload = {
  ok: true,
  schema: {
    sections,
    groups,
    fields,
    transports: ['user', 'bot'],
    transportInfo: {
      user: { label: '使用者帳號 (Selfbot)', tokenLabel: 'User Token', note: '以你的帳號發言' },
      bot: { label: '機器人 (Bot)', tokenLabel: 'Bot Token', note: '以機器人發言' },
    },
  },
};

const statusPayload = {
  ok: true,
  memoryOutput:{root:'C:/fixture/discord-memory-output',timeZone:'Asia/Taipei',schedule:'03:00',artifacts:[{id:'2026-11-11:123',date:'2026-11-11',channelId:'123',messageCount:2,adminMessageCount:1,reactionEventCount:3,markdownPath:'C:/fixture/memory/discord/123/2026-11-11.md',jsonPath:'C:/fixture/memory/discord/123/2026-11-11.json'}]},
  sessions: [{key:'fixture:channel',sessionId:'session-fixture',cwd:'C:/fixture',title:'Discord test',running:false}],
  status: {
    primaryTransport: 'user',
    replyTransport: 'auto',
    user: { transport: 'user', mode: 'pyself', workerRunning: true, ok: true, state: 'connected', message: '已登入', user: { id: '1', tag: 'me#0001', username: 'me' }, ping: 32, guildCount: 3, uptimeMs: 65000 },
    bot: { transport: 'bot', ok: false, state: 'disconnected', message: '尚未登入' },
  },
  config,
  dailyStats: { date: '2026-11-11', mentionReplies: 3, dmReplies: 1, coChats: 2, reactions: 9, gifs: 0, errors: 0 },
  history: { channels: 2, messages: 40, retentionDays: 14 },
  channels: [{ id: '123456789', count: 25 }, { id: '987654321', count: 15 }],
  logs: [
    { id: 'e1', t: new Date().toISOString(), level: 'info', event: 'plugin.start', summary: '啟動' },
    { id: 'e2', t: new Date().toISOString(), level: 'error', event: 'reply.error', summary: '壞掉了' },
  ],
  providers: [{ id: 'deepseek-account', displayName: 'DeepSeek' }],
};

let fixtureReviews=[{id:'review-fixture',version:1,state:'pending',content:'draft hello',mediaCount:0,source:{id:'1560000000000000012',channelId:'1560000000000000011',author:{id:'admin',name:'fixture sender'},content:'question'}}];
let fixtureBehavior={presets:[{id:'builtin-companion',name:'自然陪聊',builtin:true,values:{coChatEnabled:true}}],rules:[]};
let fixtureInbox=[{id:'1560000000000000012',channelId:'1560000000000000011',authorId:'admin',author:'fixture sender',content:'fixture pending question',reason:'模型失敗，可重試',canRetry:true,receivedAt:Date.now()}];
let fixtureTakeover=[];
let fixtureAsset={id:'asset-fixture',type:'gif',name:'測試貓 GIF',originalName:'cat',manualName:'',modelDescription:'貓在門邊',description:'貓在門邊',manualDescription:'',scopes:['guild:123'],manualMeanings:{},editVersion:0};
statusPayload.dailyStats=statusPayload.status.dailyStats;delete statusPayload.status.dailyStats;
const calls = [];
let probeResult = { ok: true, valid: true, user: { id: '123', tag: 'test' } };
let probeNetworkError = false;
globalThis.fetch = async (url, options = {}) => {
  const path = String(url).replace('/api/discord-cyberfriend', '');
  const body = options.body ? JSON.parse(options.body) : undefined;
  calls.push({ path, method: options.method || 'GET', body });
  const reply = (payload, status = 200) => ({ ok: status < 400, status, json: async () => payload });
  if (path.startsWith('/guilds')) return reply({ ok: true, transport: 'user', guilds: [{ id: '900000000000000001', name: '測試伺服器' }] });
  if (path.startsWith('/channels')) return reply({ ok: true, transport: 'user', channels: [{ id: '900000000000000011', name: '閒聊', type: 0 }, { id: '900000000000000012', name: '語音房', type: 2 }, { id: '900000000000000013', name: '分類', type: 4 }] });
  if(path==='/user-review')return reply({ok:true,drafts:fixtureReviews});
  if(path==='/user-review/approve'||path==='/user-review/discard'){fixtureReviews=[];return reply({ok:true,messageId:'approved-id'});}
  if(path==='/user-inbox/retry')return reply({ok:true});
  if(path==='/token-budget')return reply({ok:true,day:'2026-11-12',today:{totalTokens:123,reportedTokens:20,estimatedTokens:103,calls:1},thisMonth:{totalTokens:123},reserved:0,calls:[],enabled:false,timeZone:'Asia/Taipei'});
  if(path==='/voice')return reply({ok:true,enabled:true,tts:{ready:true,name:'fixture TTS'},sessions:[{kind:'bot',channelId:'voice-room',guildId:'guild',connected:true,phase:'idle',queue:[],idleExitAt:Date.now()+60000}],joining:[],usage:{characters:15,playedMs:1000},receiveNote:'輸出模式，不收聽'});
  if(['/voice/stop','/voice/leave','/voice/speak','/voice/join','/voice/music'].includes(path))return reply({ok:true,queued:path==='/voice/speak'});
  if(path==='/user-behavior'){if(options.method==='POST'){if(body.action==='putRule')fixtureBehavior.rules=[{...body,id:'rule-fixture',values:body}];if(body.action==='capture')fixtureBehavior.presets.push({id:'custom-fixture',name:body.name,values:{}});}return reply({ok:true,...fixtureBehavior});}
  if(path==='/user-inbox')return reply({ok:true,total:fixtureInbox.length,items:fixtureInbox});
  if(path==='/user-inbox/resolve'){fixtureInbox=fixtureInbox.filter(i=>i.id!==body.messageId);return reply({ok:true});}
  if(path==='/user-takeover'){if(options.method==='POST'){if(body.action==='pause')fixtureTakeover=[{channelId:body.channelId,label:body.label,until:Date.now()+body.seconds*1000}];else fixtureTakeover=[];}return reply({ok:true,entries:fixtureTakeover});}
  if(path.startsWith('/stickers'))return reply({ok:true,stickers:[{id:'1560000000000000015',name:'fixture fish sticker',description:'happy fish',kind:'guild',format:'png'}]});
  if(path.startsWith('/messages'))return reply({ok:true,messages:[{id:'1560000000000000016',author:{id:'1'},content:'my original text'},{id:'1560000000000000017',author:{id:'other'},content:'someone else text'}]});
  if(path.startsWith('/user-message/'))return reply({ok:true});
  if(path.startsWith('/presence'))return reply(options.method==='POST'?{ok:true,results:{user:{ok:true,updatedAt:new Date().toISOString()}}}:{ok:true,current:{ok:true,clientStatus:'idle',accountStatus:'online',activities:[{type:0,name:'fixture game'}]}});
  if(path.startsWith('/culture/assets?'))return reply({ok:true,total:1,assets:[fixtureAsset]});
  if(path==='/culture/assets/update'){fixtureAsset={...fixtureAsset,...body,editVersion:fixtureAsset.editVersion+1,description:body.manualDescription||fixtureAsset.modelDescription};return reply({ok:true,asset:fixtureAsset});}
  if (path === '/probe-token') {
    if (probeNetworkError) throw new Error('Network unavailable');
    return reply(probeResult);
  }
  if (path.startsWith('/memory-output/read'))return reply({ok:true,path:'C:/fixture/day.md',content:'# 日記預覽 fixture'});
  if (path==='/memory-output/export')return reply({ok:true,generated:1});
  if (path.startsWith('/schema')) return reply(schemaPayload);
  if (path.startsWith('/status')) return reply({...statusPayload,config:{...config}});
  if (path === '/config' && options.method === 'POST') {
    Object.assign(config, body);
    return reply({ ok: true, config: { ...config }, restarted: [] });
  }
  if (path === '/config') return reply({ ok: true, config: { ...config } });
  if (path.startsWith('/logs/clear')) return reply({ ok: true, logs: [] });
  if (path.startsWith('/logs')) return reply({ ok: true, logs: statusPayload.logs });
  if (path.startsWith('/history/clear')) return reply({ ok: true, stats: statusPayload.history });
  if (path.startsWith('/history')) return reply({ ok: true, messages: [], channels: statusPayload.channels, stats: statusPayload.history });
  if (path.startsWith('/gif')) return reply({ ok: true, results: [{ url: 'https://example.com/a.gif', preview: 'https://example.com/a.gif', title: 'a' }] });
  if (path === '/test-llm') return reply({ ok: true, result: { ok: true, ms: 120, text: 'hi' } });
  if (path === '/send') return reply({ ok: true, messageId: '999' });
  if (path === '/login') return reply({ ok: true, status: statusPayload.status });
  if (path === '/logout') return reply({ ok: true, status: statusPayload.status });
  // ---- 功能建議新增的接口
  if (path.startsWith('/emojis')) return reply({ ok: true, transport: 'user', emojis: [
    { id: '900000000000000101', name: 'pepe', animated: false, available: true, code: '<:pepe:900000000000000101>', url: 'https://cdn.discordapp.com/emojis/900000000000000101.webp?size=48' },
    { id: '900000000000000103', name: 'locked', animated: false, available: false, code: '<:locked:900000000000000103>', url: 'https://cdn.discordapp.com/emojis/900000000000000103.webp?size=48' },
  ] });
  if (path === '/interaction') return reply({ ok: true, interaction: { pending: 0, claims: 0, trace: [
    { id: 'bot:c:1', messageId: '1', channelId: 'c', transport: 'bot', phase: 'blocked', reason: '頻道不在閒聊監控清單', at: Date.now() },
    { id: 'bot:c:2', messageId: '2', channelId: 'c', transport: 'bot', phase: 'sent', reason: '', at: Date.now() },
  ] }, knowledge: [], mood: { available: false } });
  if (path === '/recent-authors') return reply({ ok: true, authors: [{ id: '700000000000000001', name: '最近說話的小華', lastSeen: new Date().toISOString() }] });
  if (path === '/names') return reply({ ok: true, names: Object.fromEntries((body.ids || []).filter((id) => id === '123456789012345678').map((id) => [id, '管理者小明'])) });
  if (path === '/config/history') return reply({ ok: true, entries: [{ id: 'entry-1', at: Date.now(), source: 'ui', changes: [{ key: 'enabled', from: true, to: false }], secretKeys: ['botToken'] }] });
  if (path === '/config/undo') return reply({ ok: true, changed: ['enabled'], config: { ...config } });
  if (path.startsWith('/config/export')) return reply({ ok: true, export: { schema: 'dsh.discord-cyberfriend.config', version: 1, values: {} } });
  return reply({ ok: true });
};

// ------------------------------------------------------------------ 載入模組 ---
let loaded = null;
globalThis.window = { __ModuleLoader__: { load: (configObject) => { loaded = configObject; } } };
await import(pathToFileURL(clientPath).href);

const checks = [];
const check = (name, ok, detail) => {
  checks.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

check('模組被 __ModuleLoader__ 註冊', Boolean(loaded));
check('模組 id 等於套件名', loaded?.id === 'dsh-discord-cyberfriend', loaded?.id);

const mod = loaded.factory((name) => {
  if (name === 'react') return React;
  throw new Error(`unknown module ${name}`);
});
check('匯出 name/inject/apply', mod.name === 'dsh-discord-cyberfriend' && Array.isArray(mod.inject) && typeof mod.apply === 'function');
check('匯出面板元件', typeof mod.DiscordHubPanel === 'function');

// ---------------------------------------------------------------- 第一次渲染 ---
const Panel = mod.DiscordHubPanel;
let tree = await render(createElement(Panel, {}));
let text = textOf(tree);
const rerender = async () => { tree = await render(createElement(Panel, {})); return tree; };
const buttonWith = (attr, value) => collect(tree, (node) => node.tag === 'button' && node.props[attr] === value)[0];
async function goSection(id) {
  const group = buttonWith('data-group', SECTION_GROUP[id]);
  if (group && group.props['data-active'] !== 'true') { group.props.onClick(); await rerender(); }
  if (!AUDIENCE_IDS.includes(id)) { buttonWith('data-section', id).props.onClick(); return rerender(); }
  buttonWith('data-section', 'audience').props.onClick(); await rerender();
  for (let step = 0; step < 2; step += 1) {
    const direct = buttonWith('data-audience', id);
    if (direct) { direct.props.onClick(); await rerender(); if (direct.props['data-on'] !== 'true' || step) break; }
    const who = id.startsWith('admin') ? 'admin' : 'others';
    const sameWho = collect(tree, (node) => node.tag === 'button' && String(node.props['data-audience'] || '').startsWith(who))[0];
    if (!buttonWith('data-audience', id) && sameWho) { sameWho.props.onClick(); await rerender(); }
  }
  return tree;
}

check('完成載入（不是載入中）', !text.includes('載入 Discord 賽博群友'), text.slice(0, 50));
check('標題與副標', text.includes('Discord') && text.includes('讓 DSH 化身群友'));
check('狀態 pill 顯示已連線帳號', text.includes('me#0001') && text.includes('未連線'));
check('KPI 有今日數字', text.includes('@ 回覆') && text.includes('私訊回覆') && text.includes('表情反應'));
check('導覽群組全部出現', groups.every((item) => text.includes(item.label)), `${groups.length} 個`);
check('預設停在總覽並有快速設定與快速測試', text.includes('快速設定') && text.includes('快速測試') && text.includes('儲存並'));

const navButtons = buttonsByClass(tree, 'dpl-nav-item');
const startCount = sections.filter((item) => item.group === 'start').length;
check('導覽只顯示目前群組的分區', navButtons.length === startCount, `${navButtons.length}/${startCount}`);

// 走過每個分區
for (let index = 0; index < sections.length; index += 1) {
  await goSection(sections[index].id);
  const currentText = textOf(tree);
  const label = sections[index].label;
  const expectsExtra = { user: '試跑模式', bot: 'Bot Token', log: 'plugin.start', history: '頻道數', gif: 'GIF 試搜', llm: '可用 Provider' }[sections[index].id];
  check(`分區 ${sections[index].id} 渲染正常`,
    currentText.includes(label) && currentText.length > 150 && (!expectsExtra || currentText.includes(expectsExtra)),
    `${currentText.length} 字${expectsExtra ? ` · 含「${expectsExtra}」` : ''}`);
}

// 回到一般設定，測切換 + 儲存
let navs = [];
await goSection('general');

let switches = buttonsByClass(tree, 'dpl-switch');
check('有開關元件', switches.length > 0, `${switches.length} 個`);
const target = switches[0];
const targetOn = target.props['data-on'];
target.props.onClick();
tree = await render(createElement(Panel, {}));
text = textOf(tree);
check('切換後出現未儲存提示', text.includes('尚未儲存'), `原值 ${targetOn}`);

const saveButton = buttonsWithText(tree, '儲存變更')[0];
check('出現「儲存變更 (n)」按鈕', Boolean(saveButton), saveButton ? textOf({ children: saveButton.props.children }) : '找不到');
if (!saveButton) {
  const allButtons = collect(tree, (node) => node.tag === 'button');
  console.log('DEBUG 所有按鈕：');
  allButtons.forEach((node, i) => {
    console.log(`  [${i}] class=${node.props.className} disabled=${node.props.disabled} text=「${textOf({ children: node.props.children }).slice(0, 40)}」`);
  });
}

if (saveButton) {
  const before = calls.filter((call) => call.path === '/config' && call.method === 'POST').length;
  saveButton.props.onClick();
  await new Promise((done) => setTimeout(done, 20));
  const posts = calls.filter((call) => call.path === '/config' && call.method === 'POST');
  const patch = posts[before]?.body;
  check('儲存只送出一個差異欄位', posts.length === before + 1 && patch && Object.keys(patch).length === 1, JSON.stringify(patch));
  check('送出的正是切換的那個欄位', patch && patch.enabled === false, JSON.stringify(patch));
  tree = await render(createElement(Panel, {}));
  text = textOf(tree);
  check('儲存後回到已儲存狀態', text.includes('已儲存') && !text.includes('尚未儲存'));
}

// Lab user token input is independent of the browser plugin.
await goSection('user');
tree = await render(createElement(Panel, {}));
let userInputs = collect(tree, node => node.tag === 'input' && node.props.type === 'password');
check('使用者分區提供遮蔽的 Token 輸入', userInputs.length > 0);
userInputs[0].props.onChange({ target: { value: 'FIXTURE-USER-TOKEN' } });
tree = await render(createElement(Panel, {}));
const userLogin = buttonsWithText(tree, '重新連線')[0] || buttonsWithText(tree, '登入')[0];
await userLogin.props.onClick();
const userRequest = calls.filter(call => call.path === '/login').at(-1);
check('使用者 Token 只送到測試插件登入 API', userRequest.body.transport === 'user' && userRequest.body.token === 'FIXTURE-USER-TOKEN');
tree = await render(createElement(Panel, {}));
check('使用者分區直接顯示演練模式狀態', textOf(tree).includes('試跑模式'));
check('顯示 AI 自動回覆控制', textOf(tree).includes('userAutoReply'));
// Bot 仍保留原有 token 設定、驗證與登入流程。
await goSection('bot');
tree = await render(createElement(Panel, {}));
const loginButton = buttonsWithText(tree, '重新連線')[0] || buttonsWithText(tree, '登入')[0];
check('Bot 分區有登入/重新連線按鈕', Boolean(loginButton), loginButton ? textOf({ children: loginButton.props.children }) : '找不到');
check('未填 Token 時登入停用', loginButton?.props.disabled === true || buttonsWithText(tree, '重新連線').length === 1,
  `disabled=${loginButton?.props.disabled}`);

const passwordInputs = collect(tree, (node) => node.tag === 'input' && node.props.type === 'password');
check('Token 以密碼欄位呈現', passwordInputs.length >= 1, `${passwordInputs.length} 個`);

// 打的 Token 必須進入 draft，否則「按了儲存卻只存在卡片自己的 state」——
// 這正是先前 selfbot Token 一直存不進去的原因。
if (passwordInputs.length) {
  passwordInputs[0].props.onChange({ target: { value: 'FAKE-BOT-TOKEN-72-CHARS' } });
  tree = await render(createElement(Panel, {}));
  text = textOf(tree);
  check('打入 Token 後標記為尚未儲存', text.includes('尚未儲存'), text.includes('尚未儲存') ? '有提示' : '沒有提示');
  const saveWithToken = buttonsWithText(tree, '儲存變更')[0];
  check('打入 Token 後儲存按鈕可用', Boolean(saveWithToken) && saveWithToken.props.disabled !== true,
    saveWithToken ? `disabled=${saveWithToken.props.disabled}` : '找不到按鈕');
  if (saveWithToken) {
    const before = calls.filter((call) => call.path === '/config' && call.method === 'POST').length;
    saveWithToken.props.onClick();
    await new Promise((done) => setTimeout(done, 20));
    const posts = calls.filter((call) => call.path === '/config' && call.method === 'POST');
    const patch = posts[before]?.body;
    check('儲存會把 Bot Token 一起送出', Boolean(patch) && patch.botToken === 'FAKE-BOT-TOKEN-72-CHARS', JSON.stringify(patch));
    tree = await render(createElement(Panel, {}));
  }
}

// API ok:false 必須保留 tri-state valid；不可被 api() 的通用 throw 吃掉。
for (const [valid, expected] of [[null, '驗證結果不確定'], [false, '憑證被拒絕'], [true, 'Token 有效']]) {
  probeResult = { ok: valid === true, valid, error: valid === true ? null : 'test result',
    user: valid === true ? { id: '123', tag: 'test' } : null };
  await buttonsWithText(tree, '驗證 Token')[0].props.onClick();
  tree = await render(createElement(Panel, {}));
  check(`驗證 Token 畫面正確呈現 ${String(valid)}`, textOf(tree).includes(expected));
}
probeNetworkError = true;
await buttonsWithText(tree, '驗證 Token')[0].props.onClick();
tree = await render(createElement(Panel, {}));
check('前端網路錯誤不顯示憑證被拒絕', textOf(tree).includes('驗證結果不確定：Network unavailable'));
probeNetworkError = false;

// 登入流程（已儲存 Token 的情況）
const reloginButton = buttonsWithText(tree, '重新連線')[0];
if (reloginButton) {
  const before = calls.filter((call) => call.path === '/login').length;
  reloginButton.props.onClick();
  await new Promise((done) => setTimeout(done, 20));
  check('重新連線會呼叫 /login', calls.filter((call) => call.path === '/login').length === before + 1);
}

// Daily export actions and safe text preview.
await goSection('memoryOutput');
tree=await render(createElement(Panel,{}));
check('記憶輸出顯示格式與實際路徑',textOf(tree).includes('Markdown／JSON')&&textOf(tree).includes('C:/fixture/discord-memory-output'));
buttonsWithText(tree,'立即輸出／重新產生日記')[0].props.onClick();
await new Promise(r=>setTimeout(r,0));tree=await render(createElement(Panel,{}));
check('記憶輸出按鈕呼叫日期排程接口',calls.some(c=>c.path==='/memory-output/export'&&/^\d{4}-\d{2}-\d{2}$/.test(c.body.date)));
buttonsWithText(tree,'預覽日記')[0].props.onClick();await new Promise(r=>setTimeout(r,0));tree=await render(createElement(Panel,{}));
check('記憶輸出可預覽日記',textOf(tree).includes('# 日記預覽 fixture'));

// 日誌分區的等級過濾
await goSection('log');
tree = await render(createElement(Panel, {}));
text = textOf(tree);
check('日誌分區顯示事件與摘要', text.includes('plugin.start') && text.includes('reply.error'));
const errorOnly = buttonsWithText(tree, '錯誤')[0];
if (errorOnly) {
  errorOnly.props.onClick();
  tree = await render(createElement(Panel, {}));
  text = textOf(tree);
  check('切到「錯誤」等級會過濾掉 info', text.includes('reply.error') && !text.includes('plugin.start'));
}

// Disabled dependent controls explain the gate and reject callbacks.
await goSection('history');tree=await render(createElement(Panel,{}));
buttonsByClass(tree,'dpl-switch')[0].props.onClick();tree=await render(createElement(Panel,{}));
check('相依設定顯示停用原因',textOf(tree).includes('先開啟歷史紀錄'));
check('相依設定以原生 fieldset 停用',collect(tree,n=>n.tag==='fieldset'&&n.props.disabled===true).length>0);
buttonsWithText(tree,'放棄變更')[0].props.onClick();tree=await render(createElement(Panel,{}));

// Exercise UI -> API coupling added by the redesign.
await goSection('general');tree=await render(createElement(Panel,{}));
const switchBeforeRefresh=buttonsByClass(tree,'dpl-switch')[0];switchBeforeRefresh.props.onClick();tree=await render(createElement(Panel,{}));
await buttonsWithText(tree,'重新整理')[0].props.onClick();tree=await render(createElement(Panel,{}));
check('重新整理保留未儲存的設定',buttonsWithText(tree,'儲存變更')[0]?.props.disabled===false);
buttonsWithText(tree,'放棄變更')[0].props.onClick();tree=await render(createElement(Panel,{}));
check('放棄變更恢復後端值',buttonsWithText(tree,'儲存變更').length===0);
const settingsSearch=collect(tree,n=>n.tag==='input'&&n.props['aria-label']==='搜尋設定')[0];settingsSearch.props.onChange({target:{value:'userAutoReply'}});tree=await render(createElement(Panel,{}));
check('設定搜尋可跨分區找到欄位',textOf(tree).includes('userAutoReply'));
await goSection('user');tree=await render(createElement(Panel,{}));
check('個人帳號有明確停權警語',textOf(tree).includes('不保證不被封號')&&textOf(tree).includes('Discord 禁止'));
check('連線頁沒有重複 Token 輸入',collect(tree,n=>n.tag==='input'&&n.props.type==='password').length===1);
await goSection('culture');await new Promise(r=>setTimeout(r,230));tree=await render(createElement(Panel,{}));
check('素材庫讀取真實 API 結構',textOf(tree).includes('測試貓 GIF')&&calls.some(c=>c.path.startsWith('/culture/assets?')));
buttonsWithText(tree,'編輯描述與用法')[0].props.onClick();tree=await render(createElement(Panel,{}));
const editorAreas=collect(tree,n=>n.tag==='textarea');editorAreas[0].props.onChange({target:{value:'手動修正：貓在道歉'}});tree=await render(createElement(Panel,{}));
check('素材修改有獨立未儲存狀態',textOf(tree).includes('素材修正尚未儲存'));
await goSection('general');tree=await render(createElement(Panel,{}));await goSection('culture');tree=await render(createElement(Panel,{}));
check('切換頁面保留素材草稿',collect(tree,n=>n.tag==='textarea')[0]?.props.value==='手動修正：貓在道歉');
await buttonsWithText(tree,'儲存素材修正')[0].props.onClick();tree=await render(createElement(Panel,{}));
const assetPost=calls.filter(c=>c.path==='/culture/assets/update').at(-1);
check('素材修正送至後端並帶版本',assetPost?.body.manualDescription==='手動修正：貓在道歉'&&assetPost.body.expectedVersion===0);
check('素材儲存回應確實更新編輯器',textOf(tree).includes('後續辨識及回覆會使用修正'));

// Presence settings must render and call only the selected account.
await goSection('user');tree=await render(createElement(Panel,{}));
check('個人帳號有獨立外觀卡',textOf(tree).includes('帳號狀態與活動')&&textOf(tree).includes('設定預覽'));
await buttonsWithText(tree,'讀取 Discord 狀態')[0].props.onClick();tree=await render(createElement(Panel,{}));
check('外觀讀取顯示 Gateway 與整體狀態',textOf(tree).includes('此連線 閒置')&&textOf(tree).includes('fixture game'));
Object.assign(config,{userPresenceEnabled:true,userReceiveOnly:false});await buttonsWithText(tree,'重新整理')[0].props.onClick();tree=await render(createElement(Panel,{}));
const appearanceButton=buttonsWithText(tree,'重新套用已儲存外觀')[0];check('已儲存且可寫入時允許套用外觀',!appearanceButton.props.disabled);
await appearanceButton.props.onClick();tree=await render(createElement(Panel,{}));
check('外觀套用只指定個人帳號',calls.filter(c=>c.path==='/presence'&&c.method==='POST').at(-1)?.body.transport==='user');
check('外觀套用顯示請求接受而非假稱對方已看到',textOf(tree).includes('Discord 已接受更新請求'));

// User conversation desk connects real UI actions to scoped APIs.
await goSection('user');tree=await render(createElement(Panel,{}));
check('待回覆收件匣顯示新訊息',textOf(tree).includes('fixture pending question'));
await buttonsWithText(tree,'手動回覆')[0].props.onClick();tree=await render(createElement(Panel,{}));
check('手動回覆先接管對話以取消 AI',calls.filter(c=>c.path==='/user-takeover'&&c.method==='POST').at(-1)?.body.action==='pause');
collect(tree,n=>n.tag==='textarea'&&n.props['aria-label']==='手動回覆內容')[0].props.onChange({target:{value:'manual inbox reply'}});tree=await render(createElement(Panel,{}));
await buttonsWithText(tree,'以個人帳號送出')[0].props.onClick();tree=await render(createElement(Panel,{}));
check('收件匣回覆帶正確來源訊息與帳號',calls.filter(c=>c.path==='/send').at(-1)?.body.replyToMessageId==='1560000000000000012'&&calls.filter(c=>c.path==='/send').at(-1).body.transport==='user');
buttonsWithText(tree,'人工接管')[0].props.onClick();tree=await render(createElement(Panel,{}));
collect(tree,n=>n.tag==='input'&&n.props['aria-label']==='對話頻道 ID')[0].props.onChange({target:{value:'1560000000000000011'}});tree=await render(createElement(Panel,{}));
await buttonsWithText(tree,'接管此對話')[0].props.onClick();tree=await render(createElement(Panel,{}));check('接管 UI 顯示實際恢復時間',textOf(tree).includes('自動恢復：'));
await buttonsWithText(tree,'恢復 AI')[0].props.onClick();tree=await render(createElement(Panel,{}));check('恢復 AI 呼叫後端解除接管',calls.filter(c=>c.path==='/user-takeover'&&c.method==='POST').at(-1)?.body.action==='resume');
buttonsWithText(tree,'貼圖與訊息')[0].props.onClick();tree=await render(createElement(Panel,{}));await buttonsWithText(tree,'搜尋貼圖')[0].props.onClick();tree=await render(createElement(Panel,{}));
check('貼圖搜尋指定目標頻道',textOf(tree).includes('fixture fish sticker')&&calls.some(c=>c.path.startsWith('/stickers?transport=user&channelId=1560000000000000011')));
await buttonsWithText(tree,'傳送此貼圖')[0].props.onClick();tree=await render(createElement(Panel,{}));check('貼圖發送帶正確貼圖 ID',calls.filter(c=>c.path==='/send').at(-1)?.body.stickerId==='1560000000000000015');
await buttonsWithText(tree,'載入自己的最近訊息')[0].props.onClick();tree=await render(createElement(Panel,{}));check('訊息修正只顯示自己發出的訊息',textOf(tree).includes('my original text')&&!textOf(tree).includes('someone else text'));
buttonsWithText(tree,'編輯文字')[0].props.onClick();tree=await render(createElement(Panel,{}));collect(tree,n=>n.tag==='textarea'&&n.props['aria-label']==='修正訊息內容')[0].props.onChange({target:{value:'fixed text'}});tree=await render(createElement(Panel,{}));
await buttonsWithText(tree,'儲存訊息修正')[0].props.onClick();tree=await render(createElement(Panel,{}));check('訊息修正送出原頻道與訊息 ID',calls.filter(c=>c.path==='/user-message/edit').at(-1)?.body.content==='fixed text');
const deleteCalls=calls.filter(c=>c.path==='/user-message/delete').length;buttonsWithText(tree,'撤回訊息')[0].props.onClick();tree=await render(createElement(Panel,{}));check('撤回先顯示確認而不直接刪除',calls.filter(c=>c.path==='/user-message/delete').length===deleteCalls&&buttonsWithText(tree,'確認撤回').length===1);
await buttonsWithText(tree,'確認撤回')[0].props.onClick();tree=await render(createElement(Panel,{}));check('確認撤回才呼叫刪除接口',calls.filter(c=>c.path==='/user-message/delete').at(-1)?.body.confirmed===true);

// New review, preferences and plugin-local token controls.
buttonsWithText(tree,'待回覆 1')[0].props.onClick();tree=await render(createElement(Panel,{}));check('收件匣顯示具體未回覆原因',textOf(tree).includes('模型失敗，可重試'));
await buttonsWithText(tree,'重新產生／重試')[0].props.onClick();tree=await render(createElement(Panel,{}));check('安全重試使用收件匣來源 ID',calls.filter(c=>c.path==='/user-inbox/retry').at(-1)?.body.messageId==='1560000000000000012');
buttonsWithText(tree,'草稿 1')[0].props.onClick();tree=await render(createElement(Panel,{}));check('草稿列表清楚標示尚未送出',textOf(tree).includes('draft hello')&&textOf(tree).includes('草稿尚未送往 Discord'));
buttonsWithText(tree,'編輯與核准')[0].props.onClick();tree=await render(createElement(Panel,{}));collect(tree,n=>n.tag==='textarea'&&n.props['aria-label']==='核准草稿內容')[0].props.onChange({target:{value:'edited approval'}});tree=await render(createElement(Panel,{}));await buttonsWithText(tree,'核准並送出')[0].props.onClick();tree=await render(createElement(Panel,{}));check('核准帶原版本與修正文字',calls.filter(c=>c.path==='/user-review/approve').at(-1)?.body.version===1&&calls.filter(c=>c.path==='/user-review/approve').at(-1).body.content==='edited approval');
await goSection('sessions');tree=await render(createElement(Panel,{}));check('人格組合與個別偏好有實際設定介面',textOf(tree).includes('人格與行為預設組合')&&textOf(tree).includes('儲存對話偏好'));
await buttonsWithText(tree,'套用預設')[0].props.onClick();tree=await render(createElement(Panel,{}));check('預設套用指定對象而非假開關',calls.filter(c=>c.path==='/user-behavior'&&c.method==='POST').at(-1)?.body.profile==='adminDm');
collect(tree,n=>n.tag==='input'&&n.props['aria-label']==='偏好對象 ID')[0].props.onChange({target:{value:'1560000000000000015'}});tree=await render(createElement(Panel,{}));collect(tree,n=>n.tag==='input'&&n.props['aria-label']==='偏好稱呼')[0].props.onChange({target:{value:'阿明'}});tree=await render(createElement(Panel,{}));await buttonsWithText(tree,'儲存對話偏好')[0].props.onClick();tree=await render(createElement(Panel,{}));check('對話偏好送到後端並保留適用範圍',calls.filter(c=>c.path==='/user-behavior'&&c.method==='POST').at(-1)?.body.nickname==='阿明'&&calls.filter(c=>c.path==='/user-behavior'&&c.method==='POST').at(-1).body.scope==='dm');
await goSection('advanced');tree=await render(createElement(Panel,{}));check('Token 統計區分實際與估算',textOf(tree).includes('服務已回報的用量：20 Token')&&textOf(tree).includes('未回報，由插件估算：103 Token')&&calls.some(c=>c.path==='/token-budget'));
await goSection('culture');tree=await render(createElement(Panel,{}));buttonsWithText(tree,'編輯描述與用法')[0].props.onClick();tree=await render(createElement(Panel,{}));collect(tree,n=>n.tag==='select'&&n.props['aria-label']==='素材審閱狀態')[0].props.onChange({target:{value:'confirmed'}});tree=await render(createElement(Panel,{}));await buttonsWithText(tree,'儲存素材修正')[0].props.onClick();tree=await render(createElement(Panel,{}));check('素材審閱確認實際保存',calls.filter(c=>c.path==='/culture/assets/update').at(-1)?.body.reviewState==='confirmed');

await goSection('voice');tree=await render(createElement(Panel,{}));
check('語音頁顯示真實 TTS 與閒置退出時間',textOf(tree).includes('fixture TTS')&&textOf(tree).includes('預計自動退出'));
collect(tree,n=>n.tag==='textarea'&&n.props['aria-label']==='語音文字')[0].props.onChange({target:{value:'語音測試文字'}});tree=await render(createElement(Panel,{}));await buttonsWithText(tree,'排入語音')[0].props.onClick();tree=await render(createElement(Panel,{}));
check('排入語音帶指定帳號與文字且不假稱已播放',calls.filter(c=>c.path==='/voice/speak').at(-1)?.body.text==='語音測試文字'&&calls.filter(c=>c.path==='/voice/speak').at(-1)?.body.kind==='bot'&&textOf(tree).includes('請查看播放結果'));
await buttonsWithText(tree,'停止／清空佇列')[0].props.onClick();tree=await render(createElement(Panel,{}));check('語音停止實際呼叫後端',calls.filter(c=>c.path==='/voice/stop').at(-1)?.body.kind==='bot');
await buttonsWithText(tree,'離開語音')[0].props.onClick();tree=await render(createElement(Panel,{}));check('語音離開實際呼叫後端',calls.filter(c=>c.path==='/voice/leave').at(-1)?.body.kind==='bot');

// 頻道選擇器：從清單點選頻道，確認寫進草稿並以正確的鍵與 ID 送出；分類頻道不會出現。
{
  const discard = buttonsWithText(tree, '放棄變更')[0];
  if (discard) { discard.props.onClick(); await rerender(); }
  await goSection('adminGroup');
  const openPicker = collect(tree, (node) => node.tag === 'button' && node.props['data-picker'] === 'channel')[0];
  check('頻道欄位提供「從頻道清單選擇」', Boolean(openPicker));
  if (openPicker) {
    openPicker.props.onClick();
    await new Promise((done) => setTimeout(done, 20));
    await rerender();
    const guildSelect = collect(tree, (node) => node.tag === 'select' && node.props['aria-label'] === '伺服器')[0];
    check('選擇器讀到伺服器清單', Boolean(guildSelect) && textOf(tree).includes('測試伺服器'));
    guildSelect.props.onChange({ target: { value: '900000000000000001' } });
    await new Promise((done) => setTimeout(done, 20));
    await rerender();
    const channelButton = collect(tree, (node) => node.tag === 'button' && node.props.title === '900000000000000011')[0];
    check('選擇器列出頻道且不含分類', Boolean(channelButton) && !collect(tree, (node) => node.tag === 'button' && node.props.title === '900000000000000013').length);
    channelButton.props.onClick();
    await rerender();
    { const tag = collect(tree, (node) => node.tag === 'span' && node.props.className === 'dpl-tag' && node.props.title === 'ID：900000000000000011')[0];
    check('點選頻道後標籤顯示名稱，ID 放在提示文字', Boolean(tag) && textOf({ children: tag.props.children }).includes('閒聊') && !textOf({ children: tag.props.children }).includes('900000000000000011')); }
    const mark = calls.length;
    buttonsWithText(tree, '儲存變更')[0].props.onClick();
    await new Promise((done) => setTimeout(done, 30));
    await rerender();
    const patch = calls.slice(mark).find((call) => call.path === '/config' && call.method === 'POST')?.body || {};
    const key = Object.keys(patch).find((name) => /ChannelIds$/.test(name));
    check('選擇器把頻道 ID 存進對應的設定', Boolean(key) && key.startsWith('adminGroup_') && JSON.stringify(patch[key]) === '["900000000000000011"]', JSON.stringify(patch));
  }
}

// 其他使用者・私訊：總開關關閉時只顯示開關，不顯示細部設定；開啟後才展開。
{
  const discard = buttonsWithText(tree, '放棄變更')[0];
  if (discard) { discard.props.onClick(); await rerender(); }
  const before = config.othersDm_dmReplyEnabled;
  config.othersDm_dmReplyEnabled = false;
  await buttonsWithText(tree, '重新整理')[0].props.onClick();
  await rerender();
  await goSection('othersDm');
  let page = textOf(tree);
  check('其他使用者私訊關閉時只留總開關', page.includes('目前不回覆其他使用者的私訊') && !page.includes('細部設定已收起。開啟上方開關後') === false && !page.includes('私訊回覆人格'));
  const master = buttonsByClass(tree, 'dpl-switch').find((node) => node.props['data-on'] === 'false');
  master.props.onClick();
  await rerender();
  page = textOf(tree);
  check('開啟總開關後才顯示細部設定', !page.includes('目前不回覆其他使用者的私訊') && page.includes('細部設定'));
  buttonsWithText(tree, '放棄變更')[0].props.onClick();
  await rerender();
  config.othersDm_dmReplyEnabled = before;
}

// 懶人設定：一鍵把整組值填進草稿，仍需按儲存才送出；送出的是該情境的整組設定。
{
  await goSection('overview');
  const preset = collect(tree, (node) => node.tag === 'button' && node.props['data-preset'] === 'private')[0];
  check('總覽提供懶人設定', Boolean(preset) && textOf(tree).includes('只陪我聊') && textOf(tree).includes('群組小幫手'));
  const mark = calls.length;
  preset.props.onClick();
  await rerender();
  check('套用懶人設定只改草稿，尚未送出', !calls.slice(mark).some((call) => call.path === '/config' && call.method === 'POST') && textOf(tree).includes('尚未儲存'));
  buttonsWithText(tree, '儲存變更')[0].props.onClick();
  await new Promise((done) => setTimeout(done, 30));
  await rerender();
  const patch = calls.slice(mark).find((call) => call.path === '/config' && call.method === 'POST')?.body || {};
  check('「只陪我聊」關閉其他人的群組回覆與私訊', patch.othersGroup_mentionReplyEnabled === false && patch.othersGroup_coChatEnabled === false && !('dryRun' in patch) && !('userToken' in patch), JSON.stringify(Object.keys(patch)));
}

// 快速設定精靈：選機器人、貼 Token、填管理者、選正式回覆，按一次「儲存並連線」。
// 確認變更先列出、一次送出，且只動到所選帳號相關的設定。
{
  const discard = buttonsWithText(tree, '放棄變更')[0];
  if (discard) { discard.props.onClick(); await rerender(); }
  await goSection('overview');
  const wizardBefore = { dryRun: config.dryRun, adminUserId: config.adminUserId };
  buttonWith('data-choice', 'kind-bot').props.onClick(); await rerender();
  check('精靈選機器人後 Token 欄改為 Bot Token', textOf(tree).includes('貼上 Bot Token'));
  const connect = () => buttonWith('data-action', 'quick-connect');
  check('精靈只有在已有或已填 Token 時才能連線', connect().props.disabled === !(config.botToken__set || config.botToken));
  collect(tree, (node) => node.tag === 'input' && node.props.type === 'password')[0].props.onChange({ target: { value: 'wizard-token' } }); await rerender();
  const adminInput = () => collect(tree, (node) => node.tag === 'input' && node.props['aria-label'] === '管理者使用者 ID')[0];
  adminInput().props.onChange({ target: { value: '12345' } }); await rerender();
  check('精靈提示管理者 ID 格式不正確', textOf(tree).includes('17～20 位數字'));
  adminInput().props.onChange({ target: { value: '123456789012345678' } }); await rerender();
  buttonWith('data-choice', 'mode-live').props.onClick(); await rerender();
  check('精靈在送出前列出將變更的設定', textOf(tree).includes('將變更') && !textOf(tree).includes('wizard-token'));
  const mark = calls.length;
  connect().props.onClick();
  await new Promise((done) => setTimeout(done, 40));
  await rerender();
  const sent = calls.slice(mark);
  const patch = sent.find((call) => call.path === '/config' && call.method === 'POST')?.body;
  const loginBody = sent.find((call) => call.path === '/login')?.body;
  check('精靈一次送出帳號、Token 與管理者', Boolean(patch) && patch.primaryTransport === 'bot' && patch.botEnabled === true && patch.botToken === 'wizard-token' && (patch.adminUserId === '123456789012345678' || wizardBefore.adminUserId === '123456789012345678'), JSON.stringify(Object.keys(patch || {})));
  check('精靈選正式回覆會關閉試跑模式', Boolean(patch) && (patch.dryRun === false || wizardBefore.dryRun === false));
  check('精靈選機器人時不改動使用者帳號的觀察設定', Boolean(patch) && !('userReceiveOnly' in patch) && !('userAutoReply' in patch));
  check('精靈儲存後以所選帳號登入', loginBody?.transport === 'bot', JSON.stringify(loginBody && { transport: loginBody.transport }));
}

// ---- 功能建議：總覽頁的新卡片、模型測試、名稱顯示、設定復原、複製到另一組
{
  await goSection('overview');
  await new Promise((done) => setTimeout(done, 30));
  await rerender();
  let text = textOf(tree);
  check('總覽顯示最近沒回覆的原因，且只列被略過的訊息', calls.some((call) => call.path === '/interaction') && text.includes('最近為什麼沒回') && text.includes('頻道不在閒聊監控清單'));
  check('管理者 ID 旁顯示名稱', calls.some((call) => call.path === '/names' && call.body.ids.includes('123456789012345678')) && text.includes('管理者小明'));
  const testButton = buttonWith('data-action', 'quick-test-model');
  const before = calls.filter((call) => call.path === '/test-llm').length;
  testButton.props.onClick();
  await new Promise((done) => setTimeout(done, 30));
  await rerender();
  check('快速設定的測試模型會呼叫 /test-llm 並顯示結果', calls.filter((call) => call.path === '/test-llm').length === before + 1 && textOf(tree).includes('模型正常（120 毫秒）'));
  const userPick = collect(tree, (node) => node.tag === 'button' && node.props['data-picker'] === 'user')[0];
  check('管理者 ID 可從最近說過話的人挑選', Boolean(userPick));
  if (userPick) {
    userPick.props.onClick();
    await new Promise((done) => setTimeout(done, 30));
    await rerender();
    const person = collect(tree, (node) => node.tag === 'button' && node.props.title === '700000000000000001')[0];
    check('挑選清單顯示名稱、ID 放在提示文字', Boolean(person) && textOf({ children: person.props.children }) === '最近說話的小華');
  }
  const voiceCheck = buttonsWithText(tree, '檢查').find((node) => textOf({ children: node.props.children }) === '檢查');
  check('總覽有語音夥伴引導', textOf(tree).includes('語音夥伴') && Boolean(voiceCheck));
  if (voiceCheck) {
    voiceCheck.props.onClick();
    await new Promise((done) => setTimeout(done, 30));
    await rerender();
    const apply = buttonWith('data-action', 'voice-partner-apply');
    check('聲音工坊就緒後才可套用語音夥伴', textOf(tree).includes('可用：fixture TTS') && apply && apply.props.disabled !== true);
  }

  statusPayload.dailyStats = { ...statusPayload.dailyStats, mentionReplies: 55 };
  buttonsWithText(tree, '重新整理')[0]?.props.onClick();
  await new Promise((done) => setTimeout(done, 40));
  await rerender();
  check('用量超過八成時出現提醒', collect(tree, (node) => node.props?.['data-usage-notice'] === 'near').length === 1 || textOf(tree).includes('快用完了'));

  await goSection('advanced');
  await new Promise((done) => setTimeout(done, 30));
  await rerender();
  text = textOf(tree);
  check('進階頁列出儲存紀錄與變更內容', text.includes('設定備份與復原') && text.includes('回到這次儲存之前') && text.includes('機密欄位被更新'));
  buttonWith('data-action', 'config-undo').props.onClick();
  await new Promise((done) => setTimeout(done, 30));
  await rerender();
  check('復原會帶著紀錄 ID 呼叫後端', calls.some((call) => call.path === '/config/undo' && call.body.id === 'entry-1') && textOf(tree).includes('已復原 1 項設定'));

  await goSection('othersGroup');
  const copy = collect(tree, (node) => node.tag === 'button' && node.props['data-audience-copy'])[0];
  check('對象設定有複製到另一組的按鈕', Boolean(copy) && copy.props['data-audience-copy'] === 'adminGroup');
  const toggles = collect(tree, (node) => node.tag === 'button' && node.props.role === 'switch');
  if (copy && toggles.length) {
    toggles[0].props.onClick();
    await rerender();
    const armed = collect(tree, (node) => node.tag === 'button' && node.props['data-audience-copy'])[0];
    check('兩組不同時複製按鈕可用', armed.props.disabled !== true);
    armed.props.onClick();
    await rerender();
    const after = collect(tree, (node) => node.tag === 'button' && node.props['data-audience-copy'])[0];
    check('複製後兩組相同、等待儲存', after.props.disabled === true && textOf(tree).includes('尚未儲存'));
    const toggleChanges = buttonWith('data-action', 'toggle-changes');
    toggleChanges.props.onClick();
    await rerender();
    check('儲存列可展開變更預覽（原值 → 新值）', collect(tree, (node) => node.tag === 'ul' && node.props['data-change-list'] >= 2).length === 1 && textOf(tree).includes(' → '));
    buttonsWithText(tree, '放棄變更')[0].props.onClick();
    await rerender();
  }
}

// ---- 表情選擇器：看圖點選一般表情與伺服器自訂表情
{
  await goSection('reaction');
  const openPicker = collect(tree, (node) => node.tag === 'button' && node.props['data-picker'] === 'emoji')[0];
  check('表情池有看圖選擇按鈕', Boolean(openPicker));
  if (openPicker) {
    openPicker.props.onClick();
    await rerender();
    const cells = () => collect(tree, (node) => node.tag === 'button' && node.props.className === 'dpl-emoji-cell');
    check('一般表情以格子顯示，先顯示常用分類', cells().length > 100 && cells().length < 200);
    const groupButtons = collect(tree, (node) => node.tag === 'button' && node.props['data-emoji-group']);
    check('完整表情分成多個分類，總數超過 1500 個', groupButtons.length >= 9 && groupButtons.reduce((sum, node) => sum + Number(String(textOf({ children: node.props.children })).split(' ').pop()), 0) > 1500 + 140);
    groupButtons.find((node) => node.props['data-emoji-group'] === '旗幟').props.onClick();
    await rerender();
    check('切換分類後顯示該類表情（旗幟含國旗）', cells().length > 250 && cells().some((node) => node.props['aria-label'] === '🇹🇼') && cells().some((node) => node.props['aria-label'] === '🇯🇵'));
    collect(tree, (node) => node.tag === 'button' && node.props['data-emoji-group'] === '常用')[0].props.onClick();
    await rerender();
    const heart = cells().find((node) => node.props['aria-label'] === '🎉');
    heart.props.onClick();
    await rerender();
    check('點選一般表情會加入表情池並等待儲存', cells().find((node) => node.props['aria-label'] === '🎉').props['data-on'] === true && textOf(tree).includes('尚未儲存'));
    collect(tree, (node) => node.tag === 'button' && node.props['data-emoji-tab'] === 'guild')[0].props.onClick();
    await new Promise((done) => setTimeout(done, 30));
    await rerender();
    check('自訂表情頁註明沒有 Nitro 不能跨伺服器使用', collect(tree, (node) => node.props?.['data-emoji-nitro-note'] === '1').length === 1 && textOf(tree).includes('Nitro'));
    const guildSelect = collect(tree, (node) => node.tag === 'select' && node.props['aria-label'] === '表情所在的伺服器')[0];
    guildSelect.props.onChange({ target: { value: '900000000000000001' } });
    await new Promise((done) => setTimeout(done, 30));
    await rerender();
    const custom = cells();
    check('伺服器自訂表情以圖片顯示，無法使用的不可選', calls.some((call) => call.path.startsWith('/emojis?') && call.path.includes('guildId=900000000000000001')) && custom.length === 2 && custom[1].props.disabled === true && collect(tree, (node) => node.tag === 'img' && String(node.props.src).includes('/emojis/900000000000000101')).length >= 1);
    custom[0].props.onClick();
    await rerender();
    const tagImage = collect(tree, (node) => node.tag === 'span' && node.props.className === 'dpl-tag' && node.props.title === '<:pepe:900000000000000101>')[0];
    check('選到的自訂表情在標籤上顯示圖片，設定值是 Discord 代碼', Boolean(tagImage) && !textOf({ children: tagImage.props.children }).includes('pepe:9000') && collect(tree, (node) => node.tag === 'img' && node.props.alt === ':pepe:').length >= 2, tagImage ? textOf({ children: tagImage.props.children }) : '找不到標籤');
    buttonsWithText(tree, '放棄變更')[0]?.props.onClick();
    await rerender();
  }
}

const failed = checks.filter((entry) => !entry.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} 通過`);
if (failed.length) {
  console.log('失敗項目：' + failed.map((entry) => entry.name).join(', '));
  process.exit(1);
}
process.exit(0);
