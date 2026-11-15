// 「功能改進建議」實作的測試。
import test from 'node:test';
import assert from 'node:assert/strict';
import { HistoryStore } from '../src/history.js';

test('建議一-3：聊天快取可列出最近說過話的人（排除自己與機器人、依最後發言排序、有上限）', () => {
  const history = new HistoryStore({ config: { historyEnabled: true } });
  history.setSelfId('bot', 'self');
  const say = (id, authorId, name, ts, extra = {}) =>
    history.record({ id, channelId: 'c' + (id.length % 2), guildId: 'g', author: { id: authorId, username: name, ...extra }, content: 'x', timestamp: ts });
  say('m1', 'u1', '小明', '2026-11-14T01:00:00Z');
  say('m2', 'u2', '小華', '2026-11-14T02:00:00Z');
  say('m3', 'u1', '小明改名', '2026-11-14T03:00:00Z');
  say('m4', 'self', '我自己', '2026-11-14T04:00:00Z');
  say('m5', 'b1', '別的機器人', '2026-11-14T05:00:00Z', { bot: true });
  const rows = history.recentAuthors();
  assert.deepEqual(rows.map((row) => row.id), ['u1', 'u2']);
  assert.equal(rows[0].name, '小明改名', '用最新的顯示名稱');
  assert.equal(rows[0].lastSeen, '2026-11-14T03:00:00.000Z');
  assert.deepEqual(Object.keys(rows[0]).sort(), ['id', 'lastSeen', 'name'], '只回傳 ID、名稱與最後發言時間，不含訊息內容');
  for (let i = 0; i < 80; i++) say('x' + i, 'many' + i, '人' + i, new Date(Date.parse('2026-11-14T06:00:00Z') + i * 1000).toISOString());
  assert.equal(history.recentAuthors(50).length, 50);
});

import { DiaryAgent } from '../src/diary-agent.js';
function diaryFixture({ memuInstalled }) {
  let turn = 0, pending = Promise.resolve();
  const events = [], calls = { turns: 0, writes: 0 };
  const agent = {
    id: 'diary-agent', status: 'idle', session: { get seq() { return events.length; }, snapshotEvents: (from = 0) => events.slice(from) }, cancel() {},
    ctx: { tools: { restrict: () => () => {}, guard: () => () => {}, register: () => () => {} }, systemPrompt: { section() {} } },
    followup() {
      const current = ++turn; calls.turns = current;
      pending = (async () => {
        const text = current === 1 ? '素材筆記' : current === 2 ? '今天和管理者聊了日記。[real]'
          : JSON.stringify({ memories: [{ title: '日記需求', content: '2026-11-11，管理者提出希望日記由目前工作區人格閱讀群聊素材後撰寫，再由記憶插件保存有來源的摘要。', evidence_ids: ['real'] }] });
        events.push({ type: 'assistant/message', data: { message: { content: [{ type: 'text', text }] } } }, { type: 'turn/end', data: { reason: { kind: 'completed' } } });
      })();
    },
    whenIdle: () => pending,
  };
  const services = {
    agentDefaultModel: { currentSelection: () => ({ provider: 'fixture', model: 'model' }) },
    llm: { listProviders: () => [{ id: 'fixture' }] },
    workspaceRegistry: { create: async () => ({ attachSession: async () => {} }) },
    agents: { create: async (o) => { agent.session.header = { cwd: o.meta.cwd, id: o.sessionId }; await o.setup(agent.ctx); return { agent, dispose: async () => {} }; } },
    tools: { get: (name) => (memuInstalled && name === 'memu_private_remember' ? { execute: async () => { calls.writes++; return '已写入私有记忆：mem-abc-123abc'; } } : undefined) },
  };
  const writer = new DiaryAgent({ ctx: { get: (name) => services[name] }, getConfig: () => ({ memoryDiaryWriteEnabled: true, memoryDiaryWriter: 'memu' }) });
  return { writer, calls };
}
const diarySource = { date: '2026-11-11', channelId: 'channel', guildId: 'guild', cwd: 'C:/workspace', reactionEvents: [], cultureEvents: [],
  messages: [{ message: { id: 'real', author: { id: 'owner', name: '管理者' }, content: '管理者今天談到了日記與群內貼圖的使用情境', ts: '2026-11-11' }, admin: true, source: 'gateway' }] };

test('建議一-4：選定的記憶插件沒有載入時，日記照寫、入庫標為略過而不是失敗，也不多問一次模型', async () => {
  const f = diaryFixture({ memuInstalled: false });
  const result = await f.writer.write(diarySource);
  assert.equal(result.text, '今天和管理者聊了日記。[real]');
  assert.equal(result.memory.status, 'skipped');
  assert.equal(result.memory.code, 'writer_not_installed');
  assert.match(result.memory.reason, /沒有載入/);
  assert.equal(f.calls.turns, 2, '不再為入庫候選多呼叫一次模型');
  assert.equal(f.calls.writes, 0);
});

test('建議一-4：記憶插件有載入時行為不變；外部插件自行註冊的寫入器不受「未載入」判斷影響', async () => {
  const f = diaryFixture({ memuInstalled: true });
  assert.equal((await f.writer.write(diarySource)).memory.status, 'stored');
  assert.equal(f.calls.turns, 3);
  const g = diaryFixture({ memuInstalled: false });
  g.writer.registerMemoryWriter('memu', async () => ({ status: 'stored', ids: ['custom-1'] }));
  assert.equal((await g.writer.write(diarySource)).memory.status, 'stored');
});

test('介面顯示名稱：聊天快取可把使用者、頻道、伺服器 ID 對應成名稱；查不到的不回傳', () => {
  const history = new HistoryStore({ config: { historyEnabled: true } });
  history.record({ id: 'm1', channelId: '111111111111111111', channelName: '閒聊', guildId: '222222222222222222', guildName: '測試伺服器',
    author: { id: '333333333333333333', username: 'ming', global_name: '小明' }, member: { nick: '明明' }, content: 'x', timestamp: '2026-11-14T01:00:00Z' });
  const names = history.knownNames(['111111111111111111', '222222222222222222', '333333333333333333', '999999999999999999', 'not-an-id']);
  assert.deepEqual(names, { '111111111111111111': '# 閒聊', '222222222222222222': '測試伺服器', '333333333333333333': history.recentAuthors()[0].name });
  assert.equal(Object.keys(history.knownNames(Array.from({ length: 900 }, (_, i) => String(100000000000000000n + BigInt(i))))).length, 0);
});

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ConfigHistory, exportConfig, importPatch } from '../src/config-history.js';
import { DEFAULTS, SECRET_KEYS } from '../src/config.js';

test('共通-3：每次儲存記下改了什麼，可取得復原用的設定；機密的值不進紀錄；最多保留十筆並持久化', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cfg-history-'));
  const file = path.join(dir, 'config-history.json');
  let now = 1000;
  const history = new ConfigHistory({ file, now: () => now });
  await history.init();
  const before = { ...DEFAULTS, botToken: 'OLD-TOKEN', maxDailyMentionReplies: 10, whitelistUserIds: ['1'] };
  const after = { ...before, botToken: 'NEW-TOKEN', maxDailyMentionReplies: 30, whitelistUserIds: ['1', '2'] };
  const entry = history.record(before, after, ['botToken', 'maxDailyMentionReplies', 'whitelistUserIds'], 'ui');
  assert.deepEqual(entry.changes.map((c) => c.key).sort(), ['maxDailyMentionReplies', 'whitelistUserIds']);
  assert.deepEqual(entry.secretKeys, ['botToken']);
  assert.ok(!JSON.stringify(history.list()).includes('TOKEN'), '機密的值不出現在紀錄');
  assert.deepEqual(history.undoPatch(entry.id), { maxDailyMentionReplies: 10, whitelistUserIds: ['1'] });
  assert.throws(() => history.undoPatch('nope'), /找不到/);
  assert.equal(history.record(after, after, [], 'ui'), null, '沒有變更不記錄');
  for (let i = 0; i < 14; i++) { now += 1; history.record({ ...after, maxDailyMentionReplies: i }, { ...after, maxDailyMentionReplies: i + 1 }, ['maxDailyMentionReplies'], 'ui'); }
  assert.equal(history.list().length, 10);
  await history.flush();
  assert.ok(!(await fs.readFile(file, 'utf8')).includes('TOKEN'));
  const again = new ConfigHistory({ file });
  await again.init();
  assert.equal(again.list().length, 10);
  assert.equal(again.list()[0].changes[0].to, 14, '最新的排最前面');
});

test('三-D2：匯出不含任何機密；分享模式另外拿掉個人 ID、名單與本機路徑', () => {
  const config = { ...DEFAULTS, botToken: 'SECRET-BOT', userToken: 'SECRET-USER', adminUserId: '400000000000000001', whitelistUserIds: ['1'], maxDailyMentionReplies: 42 };
  const full = exportConfig(config);
  assert.equal(full.schema, 'dsh.discord-cyberfriend.config');
  for (const key of SECRET_KEYS) assert.ok(!(key in full.values), key);
  assert.ok(!JSON.stringify(full).includes('SECRET-'));
  assert.equal(full.values.adminUserId, '400000000000000001');
  assert.equal(full.values.maxDailyMentionReplies, 42);
  const shared = exportConfig(config, { share: true });
  assert.ok(!('adminUserId' in shared.values) && !('whitelistUserIds' in shared.values));
  assert.ok(Object.keys(shared.values).every((key) => !/(UserIds?|ChannelIds?|GuildIds?|Directory|Path)$/.test(key)), '分享檔不含 ID 名單與路徑');
  assert.equal(shared.values.maxDailyMentionReplies, 42);
});

test('三-D2：匯入只接受認得的非機密欄位，回傳與目前設定不同的部分；格式不對就拒絕', () => {
  const current = { ...DEFAULTS, maxDailyMentionReplies: 10 };
  const payload = { schema: 'dsh.discord-cyberfriend.config', version: 1, values: { maxDailyMentionReplies: 42, botToken: 'INJECTED', notAField: 1, dryRun: current.dryRun } };
  const result = importPatch(payload, current);
  assert.deepEqual(result.patch, { maxDailyMentionReplies: 42 });
  assert.deepEqual(result.ignored.sort(), ['botToken', 'notAField']);
  assert.throws(() => importPatch({ schema: 'other', values: {} }, current), /不是/);
  assert.throws(() => importPatch(null, current), /不是/);
  assert.throws(() => importPatch({ schema: 'dsh.discord-cyberfriend.config', version: 99, values: {} }, current), /版本/);
});

import { BotTransport } from '../src/transport/bot.js';
test('表情選擇器：機器人可列出伺服器自訂表情（名稱、是否動態、是否可用、圖片網址）', async () => {
  const bot = new BotTransport({});
  const calls = [];
  bot.rest = async (method, path) => { calls.push(method + ' ' + path); return [
    { id: '900000000000000101', name: 'pepe', animated: false, available: true },
    { id: '900000000000000102', name: 'dance', animated: true, available: true },
    { id: '900000000000000103', name: 'locked', animated: false, available: false },
  ]; };
  const result = await bot.getEmojis('900000000000000001');
  assert.deepEqual(calls, ['GET /guilds/900000000000000001/emojis']);
  assert.equal(result.ok, true);
  assert.deepEqual(result.emojis.map((e) => e.code), ['<:pepe:900000000000000101>', '<a:dance:900000000000000102>', '<:locked:900000000000000103>']);
  assert.equal(result.emojis[1].url, 'https://cdn.discordapp.com/emojis/900000000000000102.gif?size=48');
  assert.equal(result.emojis[0].url, 'https://cdn.discordapp.com/emojis/900000000000000101.webp?size=48');
  assert.equal(result.emojis[2].available, false);
  assert.equal((await bot.getEmojis('not-an-id')).ok, false);
  bot.rest = async () => { throw Error('HTTP 403'); };
  assert.equal((await bot.getEmojis('900000000000000001')).ok, false);
});

import { createReactionEngine } from '../src/features/reactions.js';
import { sanitizeConfig } from '../src/config.js';

test('表情池可以留空並保存（不會被改回預設）', () => {
  assert.deepEqual(sanitizeConfig({ autoReactionEmojis: [] }).autoReactionEmojis, []);
});

test('聊天快取可統計群組常用的反應表情：同頻道優先、只算一般表情', () => {
  const history = new HistoryStore({ config: { historyEnabled: true, reactionIntelEnabled: true } });
  const say = (id, channelId, guildId) => history.record({ id, channelId, guildId, author: { id: 'u' + id, username: 'n' }, content: 'x', timestamp: '2026-11-14T01:00:00Z' });
  say('m1', 'c1', 'g1'); say('m2', 'c2', 'g1'); say('m3', 'c3', 'g2');
  for (let i = 0; i < 3; i++) history.tallyReaction('c1', 'm1', '😂');
  history.tallyReaction('c1', 'm1', '🫡');
  for (let i = 0; i < 5; i++) history.tallyReaction('c2', 'm2', '🔥');
  history.tallyReaction('c2', 'm2', 'pepe:900000000000000101');
  for (let i = 0; i < 9; i++) history.tallyReaction('c3', 'm3', '💀');
  const rows = history.commonReactions({ channelId: 'c1', guildId: 'g1' });
  assert.deepEqual(rows.map((row) => row.emoji), ['😂', '🔥', '🫡'], '同頻道的權重較高；別的伺服器與自訂表情不列入');
  assert.ok(rows[0].weight > rows[1].weight);
  assert.deepEqual(history.commonReactions({ channelId: 'none', guildId: 'none' }), []);
});

function reactionFixture(config, history) {
  const sent = [];
  const engine = createReactionEngine({
    ctx: {}, getConfig: () => config, history, ledger: { record() {} }, log: { info() {}, debug() {}, warn() {} }, semaphore: { run: (fn) => fn() },
  });
  const transport = { kind: 'bot', selfId: 'self', sendReaction: async (channelId, messageId, emoji) => { sent.push(emoji); return { ok: true }; } };
  return { engine, sent, transport };
}
const reactConfig = (extra) => sanitizeConfig({ enabled: true, dryRun: false, othersGroup_autoReactionEnabled: true, autoReactionChance: 100, autoReactionOnlyGuild: true, ...extra });

test('表情池留空：跟著這個群組最近實際按過的表情；沒有資料時用通用表情', async () => {
  const history = new HistoryStore({ config: { historyEnabled: true, reactionIntelEnabled: true } });
  history.record({ id: 'old', channelId: 'c1', guildId: 'g1', author: { id: 'u1', username: 'n' }, content: 'x', timestamp: '2026-11-14T01:00:00Z' });
  for (let i = 0; i < 4; i++) history.tallyReaction('c1', 'old', '🫡');
  const f = reactionFixture(reactConfig({ autoReactionEmojis: [] }), history);
  for (let i = 0; i < 12; i++)
    await f.engine.autoReact({ id: 'm' + i, channelId: 'c1', guildId: 'g1', author: { id: 'u2' }, content: 'hi' }, f.transport, { decision: { ok: true } });
  assert.equal(f.sent.length, 12);
  assert.ok(f.sent.every((emoji) => emoji === '🫡'), '只從群組用過的表情挑：' + [...new Set(f.sent)].join(' '));
  const g = reactionFixture(reactConfig({ autoReactionEmojis: [] }), new HistoryStore({ config: { historyEnabled: true } }));
  for (let i = 0; i < 20; i++)
    await g.engine.autoReact({ id: 'n' + i, channelId: 'c9', guildId: 'g9', author: { id: 'u2' }, content: 'hi' }, g.transport, { decision: { ok: true } });
  assert.equal(g.sent.length, 20);
  assert.ok(new Set(g.sent).size > 1, '沒有資料時從幾個通用表情挑，不是永遠同一個');
});

test('表情池有內容時行為不變：只從表情池挑', async () => {
  const history = new HistoryStore({ config: { historyEnabled: true, reactionIntelEnabled: true } });
  history.record({ id: 'old', channelId: 'c1', guildId: 'g1', author: { id: 'u1', username: 'n' }, content: 'x', timestamp: '2026-11-14T01:00:00Z' });
  for (let i = 0; i < 4; i++) history.tallyReaction('c1', 'old', '🫡');
  const f = reactionFixture(reactConfig({ autoReactionEmojis: ['🐟'] }), history);
  for (let i = 0; i < 6; i++)
    await f.engine.autoReact({ id: 'm' + i, channelId: 'c1', guildId: 'g1', author: { id: 'u2' }, content: 'hi' }, f.transport, { decision: { ok: true } });
  assert.deepEqual([...new Set(f.sent)], ['🐟']);
});

import { NATIVE_COMMANDS } from '../src/native-interactions.js';
import { interactionHelpText } from '../src/config.js';

test('三-D6：斜線指令改用 cyberfriend- 前綴；註冊時清掉本插件舊名稱的指令，不動別人的', async () => {
  const bot = new BotTransport({});
  bot.config = { botNativeInteractions: true };
  bot.applicationId = '42';
  const calls = [];
  bot.rest = async (method, path, args) => {
    calls.push({ method, path, name: args?.body?.name });
    return method === 'GET' ? [
      { id: 'old-help', name: 'pyself-lab-help', type: 1 },
      { id: 'old-ask', name: 'pyself-lab-ask', type: 1 },
      { id: 'foreign', name: 'pyself-lab-somethingelse', type: 1 },
      { id: 'other', name: 'help', type: 1 },
    ] : {};
  };
  const result = await bot.registerSlashCommands();
  assert.equal(result.ok, true);
  const created = calls.filter((c) => c.method === 'POST').map((c) => c.name);
  for (const name of ['cyberfriend-help', 'cyberfriend-status', 'cyberfriend-reset', 'cyberfriend-ask', 'cyberfriend-voice', 'cyberfriend-music', 'cyberfriend-topics', 'cyberfriend-actions'])
    assert.ok(created.includes(name), name);
  assert.ok(!created.some((name) => String(name).startsWith('pyself-lab-')));
  const deleted = calls.filter((c) => c.method === 'DELETE').map((c) => c.path.split('/').pop()).sort();
  assert.deepEqual(deleted, ['old-ask', 'old-help'], '只刪本插件自己的舊名稱指令');
  assert.ok(NATIVE_COMMANDS.filter((c) => c.type === 1).every((c) => c.name.startsWith('cyberfriend-')));
});

test('三-D6：說明文字使用新名稱', () => {
  const text = interactionHelpText(sanitizeConfig({}), 'u1', false);
  assert.match(text, /\/cyberfriend-help/);
  assert.doesNotMatch(text, /pyself-lab-/);
});

test('跟著按表情：別人按過的表情（含別的伺服器的自訂表情）有機率跟著按在同一則訊息上，每則每個表情只跟一次', async () => {
  const history = new HistoryStore({ config: { historyEnabled: true, reactionIntelEnabled: true } });
  history.record({ id: 'm1', channelId: 'c1', guildId: 'g1', author: { id: 'u1', username: 'n' }, content: 'x', timestamp: '2026-11-14T01:00:00Z' });
  const custom = 'nitroParty:900000000000000777';
  history.tallyReaction('c1', 'm1', custom);
  history.tallyReaction('c1', 'm1', custom);
  const config = reactConfig({ reactionFollowEnabled: true, reactionFollowChance: 100, reactionFollowMinCount: 2, autoReactionEmojis: [] });
  const f = reactionFixture(config, history);
  const event = { channelId: 'c1', messageId: 'm1', guildId: 'g1', emoji: custom, userId: 'u2' };
  const first = await f.engine.followReaction(event, f.transport);
  assert.equal(first.ok, true);
  assert.deepEqual(f.sent, [custom]);
  assert.equal((await f.engine.followReaction(event, f.transport)).ok, false, '同一則訊息的同一個表情只跟一次');
  assert.deepEqual(f.sent, [custom]);
  // 跟按不代表會主動使用：留空的表情池挑選時不會選到自訂表情。
  for (let i = 0; i < 15; i++)
    await f.engine.autoReact({ id: 'n' + i, channelId: 'c1', guildId: 'g1', author: { id: 'u3' }, content: 'hi' }, f.transport, { decision: { ok: true } });
  assert.ok(f.sent.slice(1).every((emoji) => emoji !== custom), '主動加表情不使用別人的自訂表情');
});

test('跟著按表情：預設關閉；未達人數、機率為 0、試跑、黑名單、自己或移除事件都不跟', async () => {
  const history = new HistoryStore({ config: { historyEnabled: true, reactionIntelEnabled: true } });
  history.record({ id: 'm1', channelId: 'c1', guildId: 'g1', author: { id: 'u1', username: 'n' }, content: 'x', timestamp: '2026-11-14T01:00:00Z' });
  history.tallyReaction('c1', 'm1', '🫡');
  const event = { channelId: 'c1', messageId: 'm1', guildId: 'g1', emoji: '🫡', userId: 'u2' };
  const on = { reactionFollowEnabled: true, reactionFollowChance: 100, reactionFollowMinCount: 1 };
  const cases = [
    [{}, event, '預設關閉'],
    [{ ...on, reactionFollowMinCount: 2 }, event, '只有一個人按'],
    [{ ...on, reactionFollowChance: 0 }, event, '機率為 0'],
    [{ ...on, dryRun: true }, event, '試跑模式'],
    [{ ...on, blacklistUserIds: ['u2'] }, event, '黑名單使用者'],
    [{ ...on, blacklistChannelIds: ['c1'] }, event, '黑名單頻道'],
    [on, { ...event, userId: 'self' }, '自己按的'],
    [on, { ...event, removed: true }, '移除事件'],
    [on, { ...event, guildId: null, dm: true }, '私訊（只在伺服器加表情）'],
  ];
  for (const [extra, ev, label] of cases) {
    const f = reactionFixture(reactConfig(extra), history);
    const result = await f.engine.followReaction(ev, f.transport);
    assert.equal(result.ok && !result.skipped, false, label);
    assert.deepEqual(f.sent, [], label);
  }
  const ok = reactionFixture(reactConfig(on), history);
  assert.equal((await ok.engine.followReaction(event, ok.transport)).ok, true);
  assert.deepEqual(ok.sent, ['🫡']);
  assert.equal(sanitizeConfig({}).reactionFollowEnabled, false);
});

import { contextLimit } from '../src/features/responder.js';
test('R3：上下文則數設為 0 就是不帶上下文，不會變回 12', () => {
  assert.equal(contextLimit({ contextMessages: 0 }), 0);
  assert.equal(contextLimit({ contextMessages: 20 }), 20);
  assert.equal(contextLimit({}), 12);
  assert.equal(contextLimit({ contextMessages: 'x' }), 12);
  assert.equal(contextLimit({ contextMessages: 999 }), 50);
});

import { migrateLegacyToolNames } from '../src/index.js';
import { createApiHandler, API_PREFIX, LEGACY_API_PREFIX } from '../src/api.js';
import { readFileSync as readSource } from 'node:fs';

test('三-D7：套件與介面識別改為 cyberfriend；舊的工具名稱在讀取設定時換成新名稱', () => {
  const pkg = JSON.parse(readSource(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.name, 'dsh-discord-cyberfriend');
  const patch = readSource(new URL('../cordis.patch.yml', import.meta.url), 'utf8');
  assert.match(patch, /id: discord-cyberfriend\s+name: dsh-discord-cyberfriend/);
  const client = readSource(new URL('../client.js', import.meta.url), 'utf8');
  assert.match(client, /id: 'dsh-discord-cyberfriend'/);
  assert.equal(API_PREFIX, '/api/discord-cyberfriend');
  assert.equal(LEGACY_API_PREFIX, '/api/discord-pyself-lab');
  const migrated = migrateLegacyToolNames({ sessionAllowedTools: ['discord_pyself_lab_config', 'web_search'], other: 'discord_pyself_lab_x', n: 1 });
  assert.deepEqual(migrated.sessionAllowedTools, ['discord_cyberfriend_config', 'web_search']);
  assert.equal(migrated.other, 'discord_pyself_lab_x', '只處理清單');
  assert.equal(migrateLegacyToolNames(null), null);
});

test('common reactions reject malformed legacy values while preserving Unicode emoji sequences', async () => {
  const {normalizeMessage}=await import('../src/history.js');
  const raw=normalizeMessage({id:'m',channel_id:'c',guild_id:'g',author:{id:'u'},reactions:[{emoji:{id:null,name:'🌿'},count:2},{emoji:{id:'900000000000000101',name:'party'},count:1}]},'bot','self');
  assert.deepEqual(raw.reactions.map(r=>r.emoji),['🌿','party:900000000000000101']);
  const history=new HistoryStore({config:{historyEnabled:true}});
  history.channels.set('c',[{guildId:'g',reactions:['[object Object]','hello','foo🌿','🌿🌿','1','🌿','👨‍👩‍👧‍👦','1️⃣','🇯🇵'].map(emoji=>({emoji,count:1}))}]);
  assert.deepEqual(history.commonReactions({channelId:'c',guildId:'g'}).map(r=>r.emoji),['🌿','👨‍👩‍👧‍👦','1️⃣','🇯🇵']);
});
