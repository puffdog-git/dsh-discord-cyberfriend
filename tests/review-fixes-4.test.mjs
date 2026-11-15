// 第四批審查修正：記憶輸出（MO1）與素材庫（MC2）的保留上限。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MemoryOutput, MEMORY_WINDOW_DAYS, MEMORY_MAX_MESSAGES, dayKey } from '../src/memory-output.js';
import { MediaCulture, CULTURE_MAX_ASSETS } from '../src/media-culture.js';

const ADMIN = '400000000000000001';
const CHANNEL = '400000000000000008';
const GUILD = '400000000000000004';
const DAY = 86400000;

async function outputFixture(clock) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'review4-output-'));
  const config = { enabled: true, memoryOutputEnabled: true, adminUserId: ADMIN, memoryDiaryPersonaEnabled: false };
  const make = () => new MemoryOutput({
    root: path.join(root, 'output'), getConfig: () => config, bridge: { workspace: root, workspaceFor: () => root },
    log: { warn() {}, info() {} }, now: () => new Date(clock.now),
  });
  await fs.mkdir(path.join(root, 'output', 'events'), { recursive: true });
  const writeDay = async (at, rows) => fs.writeFile(
    path.join(root, 'output', 'events', dayKey(at) + '.jsonl'),
    rows.map((row) => (typeof row === 'string' ? row : JSON.stringify(row))).join('\n') + '\n',
  );
  const event = (id, at) => ({
    schema: 'dsh.discord.event', version: 1, id: 'e-' + id, observedAt: new Date(at).toISOString(), type: 'message',
    channelId: CHANNEL, guildId: GUILD, cwd: root, adminUserId: ADMIN,
    message: { id, channelId: CHANNEL, guildId: GUILD, author: { id: ADMIN, name: '管理者' }, content: '內容 ' + id, ts: new Date(at).toISOString() },
  });
  return { root, config, make, writeDay, event };
}

test('MO1：啟動只載入保留視窗內的事件，更舊的日期留在磁碟上不進記憶體', async () => {
  const clock = { now: Date.parse('2026-11-14T04:00:00Z') };
  const f = await outputFixture(clock);
  const old = clock.now - (MEMORY_WINDOW_DAYS + 16) * DAY, recent = clock.now - 2 * DAY;
  await f.writeDay(old, [f.event('100', old)]);
  await f.writeDay(recent, [f.event('200', recent), { ...f.event('x', recent), type: 'reaction.add', messageId: '200', emoji: '👍', userId: ADMIN, message: undefined }]);
  const output = f.make();
  await output.init();
  assert.equal(output.messages.has(CHANNEL + ':200'), true);
  assert.equal(output.messages.has(CHANNEL + ':100'), false, '視窗外的訊息不載入');
  assert.equal((await output.days()).length, 2, '磁碟上的來源檔不刪除');
});

test('MO1：視窗外的舊檔損壞不會擋住啟動與新日期的匯出；匯出只回看視窗內的日期', async () => {
  const clock = { now: Date.parse('2026-11-14T04:00:00Z') };
  const f = await outputFixture(clock);
  const old = clock.now - (MEMORY_WINDOW_DAYS + 16) * DAY, recent = clock.now - 2 * DAY;
  await f.writeDay(old, ['{損壞的一行']);
  await f.writeDay(recent, [f.event('200', recent)]);
  const output = f.make();
  await output.init();
  const result = await output.exportDay(dayKey(recent));
  assert.equal(result.ok, true);
  assert.equal(result.generated, 1);
  await assert.rejects(() => output.exportDay(dayKey(old)), /損壞/, '該日本身損壞仍然拒絕匯出');
});

test('MO1：運作中換日時淘汰視窗外的訊息與表情狀態，並有筆數上限', async () => {
  const clock = { now: Date.parse('2026-11-01T04:00:00Z') };
  const f = await outputFixture(clock);
  const output = f.make();
  await output.init();
  const transport = { kind: 'bot', selfId: '1' };
  const message = (id) => ({ id, channelId: CHANNEL, guildId: GUILD, author: { id: ADMIN, name: '管理者' }, content: '內容 ' + id });
  await output.recordMessage(message('300'), transport);
  await output.recordReaction({ channelId: CHANNEL, guildId: GUILD, messageId: '300', userId: ADMIN, emoji: '👍' }, transport);
  assert.equal(output.messages.size, 1);
  assert.equal(output.reactionState.size, 1);
  clock.now += (MEMORY_WINDOW_DAYS + 3) * DAY;
  await output.recordMessage(message('301'), transport);
  assert.equal(output.messages.has(CHANNEL + ':300'), false, '視窗外的訊息已淘汰');
  assert.equal(output.messages.has(CHANNEL + ':301'), true);
  assert.equal(output.reactionState.size, 0, '視窗外的表情狀態已淘汰');
  for (let i = 0; i < MEMORY_MAX_MESSAGES + 50; i++)
    output.observe({ type: 'message', channelId: CHANNEL, observedAt: new Date(clock.now).toISOString(), message: { id: 'n' + i } });
  assert.ok(output.messages.size <= MEMORY_MAX_MESSAGES, '筆數不超過上限，實際 ' + output.messages.size);
  assert.equal(output.messages.has(CHANNEL + ':n' + (MEMORY_MAX_MESSAGES + 49)), true, '保留最新的');
});

test('MO1：同一則表情在視窗內仍不重複記錄', async () => {
  const clock = { now: Date.parse('2026-11-01T04:00:00Z') };
  const f = await outputFixture(clock);
  const output = f.make();
  await output.init();
  const transport = { kind: 'bot', selfId: '1' };
  const reaction = { channelId: CHANNEL, guildId: GUILD, messageId: '300', userId: ADMIN, emoji: '👍' };
  await output.recordReaction(reaction, transport);
  await output.recordReaction(reaction, transport);
  await output.recordReaction({ ...reaction, removed: true }, transport);
  const lines = (await fs.readFile(path.join(f.root, 'output', 'events', dayKey(clock.now) + '.jsonl'), 'utf8')).trim().split('\n');
  assert.deepEqual(lines.map((line) => JSON.parse(line).type), ['reaction.add', 'reaction.remove']);
});

async function cultureFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'review4-culture-'));
  let now = 1_000_000_000_000;
  const culture = new MediaCulture({ file: path.join(root, 'culture.json'), getConfig: () => ({ enabled: true }), now: () => now });
  await culture.init();
  const scope = 'guild:' + GUILD;
  const add = (index, extra = {}) => {
    const id = 'asset-' + String(index).padStart(6, '0');
    culture.data.assets[id] = { id, type: 'gif', name: 'g' + index, scopes: [scope], urls: ['https://example.com/' + index + '.gif'], lastUsed: now + index, ...extra };
    culture.data.aliases['url:https://example.com/' + index + '.gif'] = id;
    culture.data.hashes['hash-' + index] = id;
    (culture.data.usage[scope] ||= {})[id] = { count: 1, users: {}, examples: [] };
    return id;
  };
  return { root, culture, scope, add };
}

test('MC2：素材超過上限時淘汰最久沒用的，連同用法、雜湊與別名一起清掉', async () => {
  const f = await cultureFixture();
  for (let i = 0; i < CULTURE_MAX_ASSETS + 200; i++) f.add(i);
  await f.culture.save();
  const ids = Object.keys(f.culture.data.assets);
  assert.ok(ids.length <= CULTURE_MAX_ASSETS, '素材數不超過上限，實際 ' + ids.length);
  assert.equal(f.culture.data.assets['asset-000000'], undefined, '最久沒用的被淘汰');
  assert.ok(f.culture.data.assets['asset-' + String(CULTURE_MAX_ASSETS + 199).padStart(6, '0')], '最近用過的保留');
  assert.equal(f.culture.data.usage[f.scope]['asset-000000'], undefined);
  assert.equal(f.culture.data.hashes['hash-0'], undefined);
  assert.equal(f.culture.data.aliases['url:https://example.com/0.gif'], undefined);
  const live = new Set(ids);
  assert.ok(Object.values(f.culture.data.hashes).every((id) => live.has(id)));
  assert.ok(Object.values(f.culture.data.aliases).every((id) => live.has(id)));
  const saved = JSON.parse(await fs.readFile(path.join(f.root, 'culture.json'), 'utf8'));
  assert.equal(Object.keys(saved.assets).length, ids.length, '存檔內容同步縮減');
});

test('MC2：加星號、人工命名／描述／用法、已確認或編輯過的素材永遠保留', async () => {
  const f = await cultureFixture();
  const kept = [
    f.add(0, { favorite: true }),
    f.add(1, { manualName: '鞠躬' }),
    f.add(2, { manualDescription: '低頭鞠躬' }),
    f.add(3, { manualMeanings: { [f.scope]: { meaning: '道歉', avoid: '' } } }),
    f.add(4, { reviewState: 'confirmed' }),
    f.add(5, { editVersion: 1 }),
  ];
  for (let i = 6; i < CULTURE_MAX_ASSETS + 300; i++) f.add(i);
  await f.culture.save();
  for (const id of kept) assert.ok(f.culture.data.assets[id], id + ' 應保留');
  assert.ok(Object.keys(f.culture.data.assets).length <= CULTURE_MAX_ASSETS);
  assert.equal(f.culture.data.assets['asset-000006'], undefined, '沒有人工標註的最舊素材被淘汰');
});

test('MC2：未超過上限時不淘汰任何素材', async () => {
  const f = await cultureFixture();
  for (let i = 0; i < 50; i++) f.add(i);
  await f.culture.save();
  assert.equal(Object.keys(f.culture.data.assets).length, 50);
});
