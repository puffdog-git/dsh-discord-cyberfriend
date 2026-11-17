// 用文字叫 AI 停止音樂、離開語音房（discord_cyberfriend_music_stop／discord_cyberfriend_voice_leave）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { musicTools } from '../src/music-tools.js';
import { MusicProviders } from '../src/music-providers.js';
import { allowedReplyTools } from '../src/security.js';

const GUILD = '100000000000000001',
  OTHER_GUILD = '100000000000000002',
  TEXT = '200000000000000001',
  OTHER_TEXT = '200000000000000002',
  ROOM = '300000000000000001',
  USER = '400000000000000001';

function setup({ joined = { guildId: GUILD, channelId: ROOM, textChannelId: OTHER_TEXT, queue: [], current: { type: 'music' } }, message = {}, inFlight = true, actorId = USER, leaveOk = true } = {}) {
  const calls = [];
  let session = joined;
  const voice = {
    session: () => {
      if (!session) throw Error('此帳號尚未加入語音頻道');
      return session;
    },
    check() {},
    stop: async (kind) => (calls.push(['stop', kind]), { ok: true }),
    leave: async (kind, reason) => {
      calls.push(['leave', kind, reason]);
      if (!leaveOk) return { ok: false, error: '離開語音尚未確認' };
      session = null;
      return { ok: true };
    },
  };
  const binding = { sessionId: 'session', transport: 'user', accountId: 'account', channelId: TEXT, cwd: 'test' };
  const live = new Map([['session', { inFlight, options: { actorId }, message: { channelId: TEXT, guildId: GUILD, author: { id: USER }, ...message } }]]);
  const tools = musicTools({ providers: new MusicProviders(), voice, bridge: { bindings: { x: binding }, live }, getManager: () => ({ byKind: { user: { ready: true, selfId: 'account' } } }), getConfig: () => ({}) });
  const run = (name) => tools.find((t) => t.name === name).execute({}, { agent: { session: { id: 'session' } }, signal: new AbortController().signal });
  return { calls, leave: () => run('discord_cyberfriend_voice_leave'), stop: () => run('discord_cyberfriend_music_stop') };
}

test('離開語音房：從沒有綁定語音房的文字頻道也可以，只要同一個伺服器而且是真正發話的人', async () => {
  const { leave, calls } = setup();
  assert.deepEqual(await leave(), { ok: true, left: true });
  assert.deepEqual(calls, [['leave', 'user', '對話中要求離開']]);
  // 已經不在語音房：照實說，不丟錯。
  const again = await leave();
  assert.deepEqual([again.ok, again.left], [true, false]);
});

test('停止音樂：停下來並留在語音房；本來沒在播也照實說', async () => {
  const playing = setup();
  assert.deepEqual(await playing.stop(), { ok: true, stopped: true });
  assert.deepEqual(playing.calls, [['stop', 'user']]);
  const idle = setup({ joined: { guildId: GUILD, channelId: ROOM, textChannelId: TEXT, queue: [], current: null } });
  const result = await idle.stop();
  assert.deepEqual([result.stopped, /沒有在播放/.test(result.note)], [false, true]);
  const none = setup({ joined: null });
  assert.equal((await none.stop()).stopped, false);
});

test('不能控制別的伺服器的語音房；模擬訊息、不是發話者本人、回合已結束都拒絕', async () => {
  await assert.rejects(setup({ message: { guildId: OTHER_GUILD } }).leave(), /另一個伺服器/);
  await assert.rejects(setup({ message: { guildId: '' } }).leave(), /另一個伺服器/);
  await assert.rejects(setup({ message: { simulated: true } }).leave(), /真正提出要求/);
  await assert.rejects(setup({ actorId: '499999999999999999' }).stop(), /真正提出要求/);
  await assert.rejects(setup({ inFlight: false }).leave(), /真正提出要求/);
  const refused = setup({ message: { guildId: OTHER_GUILD } });
  await assert.rejects(refused.stop());
  assert.deepEqual(refused.calls, []);
});

test('語音房綁定的就是這個文字頻道：不需要其他條件', async () => {
  const { leave, calls } = setup({ joined: { guildId: GUILD, channelId: ROOM, textChannelId: TEXT, queue: [] }, inFlight: false });
  assert.equal((await leave()).left, true);
  assert.equal(calls.length, 1);
});

test('離開沒有確認成功時丟錯，不回報已離開', async () => {
  await assert.rejects(setup({ leaveOk: false }).leave(), /尚未確認/);
});

test('授權：只有開了「允許 AI 點歌」才有這兩個工具', () => {
  const message = { guildId: GUILD, channelId: TEXT, author: { id: USER } };
  const on = allowedReplyTools({ musicControlEnabled: true }, message, USER),
    off = allowedReplyTools({ musicControlEnabled: false }, message, USER);
  for (const name of ['discord_cyberfriend_music_stop', 'discord_cyberfriend_voice_leave']) {
    assert.equal(on.includes(name), true);
    assert.equal(off.includes(name), false);
  }
});
