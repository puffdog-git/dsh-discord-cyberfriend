// 完整程式審查第二批（2026-11-14）：每項修正先有會失敗的測試。
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CoalescedWriter } from '../src/util.js';
import { TokenBudget } from '../src/token-budget.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('SV1：寫入進行中時，後來的多次存檔合併成一次，且寫入的是最新狀態', async () => {
  const gates = [], written = []; let state = 0;
  const writer = new CoalescedWriter(async () => { const snapshot = state; const gate = deferred(); gates.push(gate); await gate.promise; written.push(snapshot); });
  state = 1; const first = writer.save(); await tick();
  assert.equal(gates.length, 1, '第一次立即開始寫入');
  state = 2; const second = writer.save(); state = 3; const third = writer.save(); state = 4; const fourth = writer.save();
  assert.equal(second, third); assert.equal(third, fourth);
  let secondDone = false; second.then(() => { secondDone = true; });
  gates[0].resolve(); await first; await tick();
  assert.equal(gates.length, 2, '等待中的三次只產生一次寫入');
  assert.equal(secondDone, false, '呼叫之後才開始的寫入完成前不返回');
  gates[1].resolve(); await second; await tick();
  assert.deepEqual(written, [1, 4], '合併的寫入取最新狀態');
  assert.equal(gates.length, 2);
  await writer.flush();
});

test('SV1：寫入失敗只讓那一次的等待者收到錯誤，之後的存檔照常', async () => {
  let fail = true, count = 0;
  const writer = new CoalescedWriter(async () => { count++; if (fail) throw Error('disk'); });
  await assert.rejects(writer.save(), /disk/);
  fail = false; await writer.save(); assert.equal(count, 2);
  await assert.doesNotReject(writer.flush());
});

test('TB1：Token 記帳在一次呼叫前後各落地一次，連續呼叫的寫入會合併，內容仍完整', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-tb1-')), file = join(root, 'token-budget.json');
  try {
    const budget = new TokenBudget({ file, getConfig: () => ({}) });
    let pendingOnDisk = null;
    await budget.run('reply', { system: 's', user: 'u' }, async record => { pendingOnDisk = JSON.parse(await readFile(file, 'utf8')).pending[record.id]; return { ok: true, text: 'hi' }; });
    assert.ok(pendingOnDisk, '呼叫模型前預留已落地');
    const text = await readFile(file, 'utf8');
    assert.ok(!text.includes('\n  '), '不再用縮排格式寫入');
    assert.equal(JSON.parse(text).calls.length, 1);
    await Promise.all(Array.from({ length: 12 }, () => budget.run('reply', { system: 's', user: 'u' }, async () => ({ ok: true, text: 'x' }))));
    await budget.flush();
    const data = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(data.calls.length, 13); assert.deepEqual(data.pending, {});
  } finally { await rm(root, { recursive: true, force: true }); }
});

import { Semaphore, Cooldown } from '../src/util.js';
import { audienceConfig, AUDIENCE_FIELDS, DEFAULTS, interactionHelpText } from '../src/config.js';
import { toolConfigRejection } from '../src/security.js';
import { readFileSync } from 'node:fs';
const source = name => readFileSync(new URL('../src/' + name, import.meta.url), 'utf8');

test('U2：同時處理上限可以在執行中調整，調高立即放行等待中的工作，且不會超過上限', async () => {
  const semaphore = new Semaphore(1); let active = 0, peak = 0; const gates = [];
  const job = () => semaphore.run(async () => { active++; peak = Math.max(peak, active); const gate = deferred(); gates.push(gate); await gate.promise; active--; });
  const jobs = [job(), job(), job(), job()]; await tick();
  assert.equal(active, 1); assert.equal(semaphore.pending, 3);
  semaphore.setLimit(3); await tick();
  assert.equal(active, 3, '調高後等待中的工作立即開始'); assert.equal(semaphore.pending, 1);
  semaphore.setLimit(1); gates[0].resolve(); gates[1].resolve(); await tick(); await tick();
  assert.equal(active, 1, '調低後不再補進新工作');
  gates[2].resolve(); await tick(); await tick(); assert.equal(active, 1); gates[3].resolve(); await Promise.all(jobs);
  assert.equal(peak, 3);
  // 釋放名額與新工作同時發生時也不超過上限
  const strict = new Semaphore(1); let strictActive = 0, strictPeak = 0;
  const work = () => strict.run(async () => { strictActive++; strictPeak = Math.max(strictPeak, strictActive); await tick(); strictActive--; });
  const first = work(), second = work(); await first; const third = work(); await Promise.all([second, third]);
  assert.equal(strictPeak, 1);
});

test('U3：冷卻表有鍵數上限，淘汰最久沒通過的鍵，仍在冷卻中的近期鍵不受影響', () => {
  const cooldown = new Cooldown(0, 3);
  for (const key of ['a', 'b', 'c', 'd']) assert.equal(cooldown.tryPass(key, 60000), true);
  assert.equal(cooldown.size, 3);
  assert.equal(cooldown.tryPass('d', 60000), false, '最近的鍵仍在冷卻');
  assert.equal(cooldown.tryPass('b', 60000), false);
  assert.equal(new Cooldown().maxKeys, 5000);
});

test('D1：說明指令顯示的是發問者實際適用的對象設定，名稱為新名稱', () => {
  const config = { ...DEFAULTS, adminUserId: '100000000000000001', primaryTransport: 'bot', mentionReplyEnabled: true, dmReplyEnabled: true, coChatEnabled: true,
    adminGroup_mentionReplyEnabled: false, adminGroup_coChatEnabled: true, adminDm_dmReplyEnabled: true,
    othersGroup_mentionReplyEnabled: true, othersGroup_coChatEnabled: false, othersDm_dmReplyEnabled: false };
  const admin = interactionHelpText(config, '100000000000000001'), other = interactionHelpText(config, '200000000000000002');
  assert.match(admin, /@ 回覆 關、私訊 開、閒聊 開/); assert.match(other, /@ 回覆 開、私訊 關、閒聊 關/);
  for (const text of [admin, other]) { assert.match(text, /Discord 賽博群友/); assert.doesNotMatch(text, /PySelf Lab\*\*/); assert.match(text, /\/cyberfriend-help/); }
  assert.doesNotMatch(source('transport/bot.js'), /DSH Discord PySelf Lab/);
});

test('T1：模型經設定工具不能修改機密、管理者身分、名單、工具授權與外部端點', () => {
  const blocked = ['userToken', 'botToken', 'customLlmApiKey', 'adminUserId', 'sessionAllowedTools', 'groupSafetyPrompt', 'whitelistUserIds', 'blacklistUserIds', 'channelForwardDestinationIds',
    'customLlmApiBase', 'userProxyUrl', 'botProxyUrl', 'voiceTtsBaseUrl', 'adminSessionWorkspace', 'reactionControlUserIds', 'singingAllowedUserIds', 'voiceReceiveUserIds',
    'othersGroup_knowledgeLookupEnabled', 'adminDm_webLookupEnabled', 'othersGroup_musicControlEnabled', 'tokenBudgetMode', 'tokenDailyLimit', 'dryRun', 'userReceiveOnly', 'replyCooldownExemptUserIds'];
  for (const key of blocked) { assert.ok(key in DEFAULTS, key + ' 是實際存在的設定'); assert.deepEqual(toolConfigRejection({ [key]: DEFAULTS[key] }), [key], key); }
  assert.deepEqual(toolConfigRejection({ personaName: 'x', adminGroup_coChatProbability: 10, cooldownSeconds: 5 }), []);
  assert.deepEqual(toolConfigRejection({ personaName: 'x', adminUserId: '1' }), ['adminUserId']);
  const index = source('index.js');
  assert.match(index, /options\.source\s*===\s*'tool'[\s\S]{0,200}toolConfigRejection\(/, 'applyPatch 對工具來源套用限制');
});

test('D2／D3／D4／U2 接線：沒有回覆帳號走 skip、catch 內的收件匣標記不會再丟例外、最近回覆表有上限、並行上限隨設定更新', () => {
  const index = source('index.js');
  assert.match(index.replace(/\s+/g, ''), /if\(!replyTransport\?\.ready\)\{[\s\S]{0,260}returnskip\('沒有可用的回覆帳號'\);/);
  // 與排版無關：去掉空白後再比對。
  assert.match(index.replace(/\s+/g, ''), /if\(transport\.kind==='user'\)awaitinbox\.mark\(message\.id,inbox\.items\.get\(message\.id\)\?\.phase==='sending'\?'uncertain':'failed','處理失敗：'\+error\.message,?\)\.catch\(/);
  assert.match(index, /recentReplies\.size\s*>\s*\d+/);
  assert.match(index, /semaphore\.setLimit\(/);
});

test('CF1：依對象取設定只套用該對象的欄位，結果與逐欄比對相同', () => {
  const config = { ...DEFAULTS, adminUserId: '100000000000000001', replyCooldownExemptUserIds: ['100000000000000001', '3'], reactionControlUserIds: ['4'] };
  for (const field of AUDIENCE_FIELDS) if (typeof field.default === 'boolean') config[field.key] = field.section.startsWith('admin'); else if (typeof field.default === 'number') config[field.key] = field.section.length + field.key.length;
  const reference = (userId, isDm) => { const admin = String(userId) === config.adminUserId, prefix = (admin ? 'admin' : 'others') + (isDm ? 'Dm' : 'Group'), next = { ...config };
    for (const f of AUDIENCE_FIELDS) if (f.section === prefix && config[f.key] !== undefined) next[f.audienceBaseKey] = config[f.key];
    next.replyCooldownExemptUserIds = ['3']; next.reactionControlUserIds = ['4', '100000000000000001']; return next; };
  for (const [userId, isDm] of [['100000000000000001', true], ['100000000000000001', false], ['9', true], ['9', false]]) assert.deepEqual(audienceConfig(config, userId, isDm), reference(userId, isDm));
  assert.equal(audienceConfig({ ...config, othersGroup_cooldownSeconds: undefined, cooldownSeconds: 77 }, '9', false).cooldownSeconds, 77, '未設定的對象欄位沿用基底值');
});

test('D1 接線：說明指令使用 interactionHelpText，index.js 不再有舊名稱與基底鍵的顯示', () => {
  const index = source('index.js');
  assert.match(index, /await reply\(interactionHelpText\(config, payload\.member\?\.user\?\.id \|\| payload\.user\?\.id\)\)/);
  assert.doesNotMatch(index, /PySelf Lab\*\*|TRANSPORT_INFO/);
});

import { createServer } from 'node:http';
import { createApiHandler } from '../src/api.js';
import { authenticatedTestContext } from './http-fixture.mjs';

async function withApi(deps, run) {
  const logs = [];
  const logger = { error: (event, message, detail) => logs.push({ level: 'error', event, detail }), warn: (event, message, detail) => logs.push({ level: 'warn', event, detail }), info() {}, debug() {} };
  const server = createServer(createApiHandler({ ctx: authenticatedTestContext, getLogger: () => logger, getConfig: () => ({}), ...deps }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/discord-cyberfriend';
  const post = async (path, body, raw) => { const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ?? JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
  try { await run({ post, logs }); } finally { await new Promise(resolve => server.close(resolve)); }
}

test('A2：請求驗證失敗回 400（服務未就緒回 409），不記成伺服器錯誤；未預期的例外仍是 500', async () => {
  const conversation = { plan: () => { throw Error('unexpected internal'); } };
  await withApi({ conversation }, async ({ post, logs }) => {
    let r = await post('/conversation/plan', { action: 'defer' });
    assert.equal(r.status, 400); assert.equal(r.body.error, '請先更新話題狀態');
    r = await post('/conversation/close', { expectedRevision: 1 }); assert.equal(r.status, 400);
    r = await post('/conversation/plan', null, '{bad json'); assert.equal(r.status, 400); assert.match(r.body.error, /JSON/);
    r = await post('/user-inbox/resolve', {}); assert.equal(r.status, 409, '服務未就緒');
    assert.equal(logs.filter(row => row.level === 'error').length, 0, '驗證失敗不記成 api.error');
    assert.ok(logs.some(row => row.level === 'warn' && row.event === 'api.rejected'));
    r = await post('/conversation/plan', { action: 'defer', expectedRevision: 1 });
    assert.equal(r.status, 500); assert.equal(logs.filter(row => row.level === 'error').length, 1);
  });
});

test('A3：清除全部聊天快取需要明確確認；清除單一頻道不需要', async () => {
  const cleared = []; const history = { clear: id => cleared.push(id === undefined ? 'ALL' : id), stats: () => ({ messages: 0 }) };
  await withApi({ getHistory: () => history }, async ({ post }) => {
    let r = await post('/history/clear', {}); assert.equal(r.status, 400); assert.match(r.body.error, /確認/); assert.deepEqual(cleared, []);
    r = await post('/history/clear', { confirmed: 'yes' }); assert.equal(r.status, 400); assert.deepEqual(cleared, []);
    r = await post('/history/clear', { channelId: '123456789012345678' }); assert.equal(r.status, 200); assert.deepEqual(cleared, ['123456789012345678']);
    r = await post('/history/clear', { confirmed: true }); assert.equal(r.status, 200); assert.deepEqual(cleared, ['123456789012345678', 'ALL']);
  });
  const hub = readFileSync(new URL('../client-src/90-hub.js', import.meta.url), 'utf8');
  assert.match(hub, /history\/clear[\s\S]{0,120}confirmed:\s*true/, '介面在確認後才帶 confirmed');
});

import { BotTransport } from '../src/transport/bot.js';

test('B3：Bot REST 有預設逾時；送訊息逾時回報為結果不確定而不是失敗；呼叫端的取消仍照原樣', async () => {
  const realFetch = globalThis.fetch; let calls = 0; const keepAlive = setInterval(() => {}, 20); /* AbortSignal.timeout 的計時器不會讓事件迴圈保持存活 */
  globalThis.fetch = (url, init = {}) => new Promise((resolve, reject) => { calls++; init.signal?.addEventListener('abort', () => reject(init.signal.reason), { once: true }); });
  try {
    const bot = new BotTransport({}); bot.config = { botToken: 'test-token-value' }; bot.log = { warn() {}, info() {}, debug() {} };
    assert.equal(bot.restTimeoutMs, 30000, '預設 30 秒');
    bot.restTimeoutMs = 40;
    const started = Date.now();
    await assert.rejects(bot.rest('GET', '/users/@me'), error => error.code === 'DISCORD_TIMEOUT' && /逾時/.test(error.message));
    assert.ok(Date.now() - started < 2000);
    const sent = await bot.sendMessage('123456789012345678', { content: 'hello' });
    assert.equal(sent.ok, false); assert.equal(sent.uncertain, true, '已送出請求但沒有回應：結果不確定'); assert.match(sent.error, /逾時/);
    const controller = new AbortController(); const pending = bot.rest('GET', '/users/@me', { signal: controller.signal }); controller.abort(new Error('caller cancelled'));
    await assert.rejects(pending, error => error.code !== 'DISCORD_TIMEOUT');
    assert.ok(calls >= 3);
  } finally { globalThis.fetch = realFetch; clearInterval(keepAlive); }
});

test('B4：附件網址下載有逾時與大小上限，失敗時退回貼連結', async () => {
  const realFetch = globalThis.fetch; const posted = []; const keepAlive = setInterval(() => {}, 20); /* AbortSignal.timeout 的計時器不會讓事件迴圈保持存活 */
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith('https://files.example/huge')) return new Response(new Uint8Array(8), { status: 200, headers: { 'content-type': 'image/png', 'content-length': String(64 * 1024 * 1024) } });
    if (String(url).startsWith('https://files.example/slow')) return new Promise((resolve, reject) => init.signal?.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
    posted.push(init.body); return new Response(JSON.stringify({ id: '999' }), { status: 200 });
  };
  try {
    const bot = new BotTransport({}); bot.config = { botToken: 'test-token-value' }; bot.log = { warn() {}, info() {}, debug() {} }; bot.downloadTimeoutMs = 40;
    const result = await bot.sendMessage('123456789012345678', { content: 'see', fileUrls: ['https://files.example/huge.png', 'https://files.example/slow.png'] });
    assert.equal(result.ok, true); assert.match(result.note, /連結/);
    assert.match(String(posted[0]), /files\.example\/huge\.png/); assert.match(String(posted[0]), /files\.example\/slow\.png/);
  } finally { globalThis.fetch = realFetch; clearInterval(keepAlive); }
});

import { HistoryStore } from '../src/history.js';

test('H1：依時間順序到達的訊息不重新排序整個頻道；較早的訊息插入後仍維持時間順序', () => {
  const history = new HistoryStore({ config: { historyEnabled: true } });
  const at = minute => new Date(Date.UTC(2026, 10, 14, 1, minute)).toISOString();
  const message = (id, minute, content = 'm' + id) => ({ id: String(id), channelId: 'c1', author: { id: 'u1', name: 'A' }, content, ts: at(minute) });
  const realSort = Array.prototype.sort; let sorts = 0; Array.prototype.sort = function (...args) { sorts++; return realSort.apply(this, args); };
  try {
    for (let i = 1; i <= 50; i++) history.record(message(1000 + i, i));
    assert.equal(sorts, 0, '順序到達不排序');
    history.record(message(999, 0)); history.record(message(2000, 25));
    assert.ok(sorts >= 1 && sorts <= 2, '只有較早的訊息才排序');
    history.record(message(1010, 10, 'edited')); assert.ok(sorts <= 2);
  } finally { Array.prototype.sort = realSort; }
  const list = history.recent('c1', 100);
  assert.equal(list.length, 52); assert.equal(list[0].id, '999'); assert.equal(list.at(-1).id, '1050');
  assert.deepEqual(list.map(item => item.ts), [...list.map(item => item.ts)].sort());
  assert.equal(list.find(item => item.id === '1010').content, 'edited');
  // 同一時間戳以 ID 排序（與原本的比較規則一致）
  history.record({ ...message(1051, 50) }); history.record({ ...message(1049, 50) });
  const tail = history.recent('c1', 3).map(item => item.id); assert.deepEqual(tail, ['1049', '1050', '1051']);
});

test('H2／H3：聊天快取的寫入間隔為 10 秒；運作中存檔時會清掉超過保留天數的訊息', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-h3-')), file = join(root, 'history.json');
  try {
    const history = new HistoryStore({ file, config: { historyEnabled: true, historyRetentionDays: 1 } });
    assert.equal(history.saveDelayMs, 10000);
    history.record({ id: '1', channelId: 'c1', author: { id: 'u1' }, content: 'old', ts: new Date(Date.now() - 3 * 86400000).toISOString() });
    history.record({ id: '2', channelId: 'c1', author: { id: 'u1' }, content: 'new', ts: new Date().toISOString() });
    assert.equal(history.recent('c1', 10).length, 2);
    await history.flush();
    assert.deepEqual(history.recent('c1', 10).map(item => item.id), ['2'], '過期訊息在存檔時清除');
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')).channels.c1.map(item => item.id), ['2']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

import { PySelfTransport } from '../src/transport/pyself.js';
import { createReactionEngine } from '../src/features/reactions.js';
import { Ledger } from '../src/ledger.js';

test('PS2：使用者帳號回覆後延長追問時間，用的是當時對象的追問秒數而不是隱藏的基底鍵', async () => {
  const user = new PySelfTransport({ log: {} });
  user.config = { followupSeconds: 180 }; user.request = async () => ({ ok: true, messageId: '900' });
  user.rememberFollowup('c1', 600);
  const before = user.followupUntil.get('c1'); assert.ok(before - Date.now() > 590000);
  user.followupUntil.set('c1', Date.now() + 1000);
  await user.sendMessage('c1', { content: 'hi', autoReply: true });
  assert.ok(user.followupUntil.get('c1') - Date.now() > 590000, '沿用該頻道記下的 600 秒');
  for (let i = 0; i < 450; i++) user.rememberFollowup('x' + i, 60);
  assert.ok(user.followupUntil.size <= 400); assert.ok(user.followupSpan.size <= 400);
  assert.match(source('transport/pyself.js'), /this\.rememberFollowup\(message\.channelId, ?audience\.followupSeconds\)/);
});

test('RX3：表情指令只走正式回覆流程；沒有回覆服務時不自行呼叫模型或送出', async () => {
  let sends = 0, fetches = 0;
  const engine = createReactionEngine({ getConfig: () => ({ reactionCommandEnabled: true, reactionCommandTriggerEmojis: ['🤖'], botEnabled: true }), ledger: { record() {} }, log: { info() {}, error() {} }, history: { contextText: () => '' }, semaphore: { run: work => work() } });
  const transport = { kind: 'bot', selfId: 'self', getMessages: async () => { fetches++; return { ok: true, messages: [{ id: 'm', content: 'hello', author: { id: 'a' } }] }; }, sendMessage: async () => { sends++; return { ok: true, messageId: 'x' }; } };
  const result = await engine.handleReaction({ channelId: 'c', messageId: 'm', emoji: '🤖', userId: 'actor' }, transport);
  assert.equal(result.ok, false); assert.equal(result.reason, '回覆服務尚未就緒'); assert.equal(sends, 0); assert.equal(fetches, 0);
  const code = source('features/reactions.js');
  assert.doesNotMatch(code, /generateReply|buildPrompt|simulateTyping/);
});

test('L1：換日時淘汰超過七天沒有互動的使用者與對話，近期的保留連續輪數', () => {
  const ledger = new Ledger({ log: {} }); const iso = days => new Date(Date.now() - days * 86400000).toISOString();
  ledger.state.date = '2000-01-01';
  ledger.state.users = {
    old: { rounds: 3, lastAt: iso(30), lastReplyAt: iso(30), conversations: { 'bot:c1': { rounds: 3, lastReplyAt: iso(30) } } },
    unknown: { rounds: 0, lastAt: null, conversations: {} },
    recent: { rounds: 2, lastAt: iso(0.1), lastReplyAt: iso(0.1), conversations: { 'bot:c1': { rounds: 2, lastReplyAt: iso(0.1) }, 'bot:c2': { rounds: 1, lastReplyAt: iso(20) } } },
  };
  assert.equal(ledger.rolloverIfNeeded(), true);
  assert.deepEqual(Object.keys(ledger.state.users), ['recent']);
  assert.equal(ledger.state.users.recent.rounds, 2);
  assert.deepEqual(Object.keys(ledger.state.users.recent.conversations), ['bot:c1']);
  if (ledger.saveTimer) clearTimeout(ledger.saveTimer);
});

import { describeSchema, publicConfig, sanitizeConfig, SECRET_KEYS } from '../src/config.js';

test('G2／CF2：沒有作用的開關不再出現在設定介面，已儲存的值仍保留；幽靈欄位 gifApiKey 不再回傳', () => {
  const keys = describeSchema().fields.map(field => field.key);
  for (const key of ['replyIgnoreSelf', 'botProxyUrl']) {
    assert.ok(!keys.includes(key), key + ' 不在介面綱要');
    assert.ok(key in DEFAULTS, key + ' 的鍵仍保留以相容舊設定');
  }
  const saved = sanitizeConfig({ replyIgnoreSelf: false, botProxyUrl: 'http://127.0.0.1:7890' });
  assert.equal(saved.replyIgnoreSelf, false); assert.equal(saved.botProxyUrl, 'http://127.0.0.1:7890');
  assert.doesNotMatch(source('features/gate.js'), /replyIgnoreSelf/);
  assert.ok(SECRET_KEYS.includes('gifApiKey'), '舊設定檔裡的 gifApiKey 仍當成機密保護');
  assert.equal(publicConfig({ ...DEFAULTS, gifApiKey: 'legacy-secret' }).gifApiKey, '', '舊值存在時仍遮蔽');
  const view = publicConfig({ ...DEFAULTS, userToken: 'abcdefgh' });
  for (const key of ['gifApiKey', 'gifApiKey__set', 'gifApiKey__fp']) assert.ok(!(key in view), key);
  assert.equal(view.userToken, ''); assert.equal(view.userToken__set, true);
});

import { sessionEventIndex, estimateTokens } from '../src/token-budget.js';

test('S1／S2／TB2：會話歷史的大小與已見來源以增量維護，不再每次回覆序列化／掃描整段會話', async () => {
  const data = []; const reads = [];
  const session = { get seq() { return data.length; }, snapshotEvents: (from = 0) => { reads.push(from); return data.slice(from); } };
  for (let i = 0; i < 500; i++) data.push({ type: i % 2 ? 'assistant/message' : 'user/message', data: { id: 'discord:1:' + i, text: '內容'.repeat(20) + i } });
  const exact = () => Buffer.byteLength(JSON.stringify(data), 'utf8');
  let index = sessionEventIndex(session);
  assert.equal(index.bytes, exact(), '位元組數與整段序列化一致'); assert.deepEqual(reads, [0]);
  assert.equal(index.ids.has('discord:1:498'), true); assert.equal(index.ids.has('discord:1:499'), false, '只記使用者訊息的來源 ID');
  data.push({ type: 'user/message', data: { id: 'discord:1:new', text: 'x' } });
  index = sessionEventIndex(session);
  assert.deepEqual(reads, [0, 500], '第二次只讀新增的事件'); assert.equal(index.bytes, exact()); assert.equal(index.ids.has('discord:1:new'), true);
  index = sessionEventIndex(session); assert.deepEqual(reads, [0, 500], '沒有新事件就不讀');
  data.length = 10; index = sessionEventIndex(session);
  assert.equal(index.bytes, exact(), '會話被重置或壓縮（序號倒退）時重新計算'); assert.equal(index.ids.has('discord:1:new'), false);
  for (let i = 0; i < 25; i++) sessionEventIndex(session);
  assert.ok(reads.filter(from => from === 0).length >= 3, '定期完整重算，避免壓縮後長期高估');
  assert.equal(sessionEventIndex({ snapshotEvents: () => [{ type: 'user/message', data: { id: 'a' } }] }).ids.has('a'), true, '沒有序號的會話每次完整計算');

  const root = await mkdtemp(join(tmpdir(), 'dsh-tb2-'));
  try {
    const budget = new TokenBudget({ file: join(root, 'b.json'), getConfig: () => ({}) }); let reserved = 0, base = 0;
    await budget.run('native-reply', { system: 's', user: 'u', maxTokens: 100 }, async record => { base = record.reserved; return { ok: true, text: '' }; });
    await budget.run('native-reply', { system: 's', user: 'u', maxTokens: 100, extraInputBytes: 30000 }, async record => { reserved = record.reserved; return { ok: true, text: '' }; });
    assert.equal(reserved - base, 10000, '額外位元組以相同比例計入預留');
    assert.equal(estimateTokens('x'.repeat(30000)), 10000);
  } finally { await rm(root, { recursive: true, force: true }); }
  assert.doesNotMatch(source('session-bridge.js'), /JSON\.stringify\(history\)|snapshotEvents\(\)\.some/);
  assert.doesNotMatch(source('diary-agent.js'), /JSON\.stringify\(agent\.session\.snapshotEvents\(\)\)/);
});

import { CapabilityDiagnostics } from '../src/capability-diagnostics.js';

test('CAP1：連續的觀測操作共用一秒內的能力清單，不再每次重建；快照仍取最新', () => {
  let now = 1000000, builds = 0;
  const diagnostics = new CapabilityDiagnostics({ ctx: { get: () => undefined }, getConfig: () => ({}), now: () => now });
  const real = diagnostics.descriptors.bind(diagnostics);
  diagnostics.descriptors = () => { builds++; return real(); };
  const id = real()[0].id;
  const first = diagnostics.begin(id); assert.ok(first?.fingerprint);
  for (let i = 0; i < 20; i++) { now += 10; assert.equal(diagnostics.begin(id).fingerprint, first.fingerprint); diagnostics.toolTickets(['none']); }
  assert.equal(builds, 1, '一秒內只建一次');
  now += 1000; diagnostics.begin(id); assert.equal(builds, 2, '超過一秒重建');
  diagnostics.close(); assert.equal(diagnostics.begin(id), null);
});
