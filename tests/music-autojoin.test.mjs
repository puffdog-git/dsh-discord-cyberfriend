// 點歌時自動加入點歌者所在的語音房（voiceMusicAutoJoin）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { musicTools } from '../src/music-tools.js';
import { MusicProviders } from '../src/music-providers.js';
import { DiscordVoice } from '../src/voice.js';
import { DEFAULTS, sanitizeConfig } from '../src/config.js';
import { toolConfigProtected } from '../src/security.js';

const GUILD = '100000000000000001',
  TEXT = '200000000000000001',
  OTHER_TEXT = '200000000000000002',
  ROOM = '300000000000000001',
  ROOM2 = '300000000000000002',
  USER = '400000000000000001';

function setup({ autoJoin = true, memberRoom = ROOM, joined = null, message = {}, inFlight = true, actorId = USER, joinError } = {}) {
  const calls = [];
  let session = joined;
  const voice = {
    session: () => {
      if (!session) throw Error('此帳號尚未加入語音頻道');
      return session;
    },
    check() {},
    memberVoiceChannel: async (kind, guildId, userId) => (calls.push(['member', kind, guildId, userId]), memberRoom),
    leave: async (kind, reason) => (calls.push(['leave', kind, reason]), (session = null), { ok: true }),
    join: async (args) => {
      calls.push(['join', args]);
      if (joinError && args.textChannelId) throw Error(joinError);
      session = { guildId: args.guildId, channelId: args.channelId, textChannelId: args.textChannelId || '', queue: [], current: null };
      return { ok: true };
    },
    music: (args) => (calls.push(['music', args]), { ok: true, queued: true }),
  };
  const binding = { sessionId: 'session', transport: 'bot', accountId: 'account', channelId: TEXT, cwd: 'test' };
  const live = new Map([['session', { inFlight, options: { actorId }, message: { channelId: TEXT, guildId: GUILD, author: { id: USER }, ...message } }]]);
  const providers = new MusicProviders();
  providers.register({ id: 'jukebox-ytmusic', load: async () => Buffer.from('x') });
  const tools = musicTools({ providers, voice, bridge: { bindings: { x: binding }, live }, getManager: () => ({ byKind: { bot: { ready: true, selfId: 'account' } } }), getConfig: () => ({ voiceMusicAutoJoin: autoJoin }) });
  const play = () => tools.find((t) => t.name.endsWith('music_play')).execute({ provider: 'plugin:jukebox-ytmusic', trackId: 'abc', label: '歌' }, { agent: { session: { id: 'session' } }, signal: new AbortController().signal });
  return { play, calls, voice };
}

test('設定：預設關閉，而且模型不能用設定工具自己打開', () => {
  assert.equal(DEFAULTS.voiceMusicAutoJoin, false);
  assert.equal(sanitizeConfig({ voiceMusicAutoJoin: true }).voiceMusicAutoJoin, true);
  assert.equal(toolConfigProtected('voiceMusicAutoJoin'), true);
});

test('沒開自動加入：維持原本的行為（還沒加入就回報，不會自己加入）', async () => {
  const { play, calls } = setup({ autoJoin: false });
  await assert.rejects(play(), /尚未加入語音頻道/);
  assert.deepEqual(calls, []);
  const bound = setup({ autoJoin: false, joined: { guildId: GUILD, channelId: ROOM, textChannelId: OTHER_TEXT, queue: [] } });
  await assert.rejects(bound.play(), /未綁定此文字頻道/);
});

test('還沒加入語音房：加入點歌者所在的語音頻道並綁定點歌的文字頻道，然後播放', async () => {
  const { play, calls } = setup();
  const result = await play();
  assert.equal(result.queued, true);
  assert.deepEqual(calls[0], ['member', 'bot', GUILD, USER]);
  assert.deepEqual(calls[1], ['join', { kind: 'bot', channelId: ROOM, guildId: GUILD, textChannelId: TEXT }]);
  assert.equal(calls[2][0], 'music');
  assert.equal(calls.length, 3);
});

test('已經在點歌者所在的語音房、只是從別的文字頻道點歌：直接播放，不重新加入', async () => {
  const { play, calls } = setup({ joined: { guildId: GUILD, channelId: ROOM, textChannelId: OTHER_TEXT, queue: [], current: null } });
  assert.equal((await play()).queued, true);
  assert.deepEqual(calls.map((c) => c[0]), ['member', 'music']);
});

test('在別的語音房：閒著就移過去；正在播放或說話就拒絕，不中途換房', async () => {
  const idle = setup({ memberRoom: ROOM2, joined: { guildId: GUILD, channelId: ROOM, textChannelId: OTHER_TEXT, queue: [], current: null } });
  assert.equal((await idle.play()).queued, true);
  assert.deepEqual(idle.calls.map((c) => c[0]), ['member', 'leave', 'join', 'music']);
  assert.equal(idle.calls[2][1].channelId, ROOM2);
  for (const busy of [{ current: { type: 'speech' } }, { music: { id: 'm' } }, { queue: [{ type: 'music' }] }]) {
    const s = setup({ memberRoom: ROOM2, joined: { guildId: GUILD, channelId: ROOM, textChannelId: OTHER_TEXT, queue: [], current: null, ...busy } });
    await assert.rejects(s.play(), /正在另一個語音房/);
    assert.deepEqual(s.calls.map((c) => c[0]), ['member']);
  }
});

test('拒絕的情況：點歌者不在語音頻道、私訊、不是目前對話的點歌者、模擬訊息', async () => {
  const cases = [
    [{ memberRoom: '' }, /不在這個伺服器的語音頻道/],
    [{ message: { guildId: '' } }, /私訊裡無法判斷/],
    [{ actorId: '400000000000000009' }, /真正提出點歌的人/],
    [{ inFlight: false }, /真正提出點歌的人/],
    [{ message: { simulated: true } }, /真正提出點歌的人/],
    [{ message: { channelId: OTHER_TEXT } }, /真正提出點歌的人/],
  ];
  for (const [options, pattern] of cases) {
    const s = setup(options);
    await assert.rejects(s.play(), pattern);
    assert.ok(!s.calls.some((c) => c[0] === 'join' || c[0] === 'music'), '沒有加入也沒有播放');
  }
});

test('點歌的地方不能當綁定文字頻道（例如討論串）：改成不綁定再加入；其他加入失敗照實回報', async () => {
  const thread = setup({ joinError: '綁定文字頻道必須位於相同伺服器' });
  assert.equal((await thread.play()).queued, true);
  assert.deepEqual(thread.calls.filter((c) => c[0] === 'join').map((c) => c[1].textChannelId), [TEXT, undefined]);
  const denied = setup({ joinError: '請先把語音頻道加入允許清單並儲存' });
  await assert.rejects(denied.play(), /允許清單/);
  assert.equal(denied.calls.filter((c) => c[0] === 'join').length, 1);
});

test('查詢成員所在的語音頻道：機器人帳號走 REST，不在語音頻道時回空字串；使用者帳號走工作程序', async () => {
  const v = Object.create(DiscordVoice.prototype);
  const requests = [];
  const transports = {
    bot: { ready: true, rest: async (method, path) => (requests.push([method, path]), path.endsWith(USER) ? { channel_id: ROOM } : Promise.reject(Error('Discord API 404: Unknown Voice State'))) },
    user: { ready: true, rpc: async (method, params) => (requests.push([method, params]), { ok: true, channelId: ROOM2 }) },
  };
  v.getConfig = () => ({ enabled: true, voiceEnabled: true, dryRun: false, userReceiveOnly: false });
  v.getManager = () => ({ byKind: transports });
  v.closed = false;
  assert.equal(await v.memberVoiceChannel('bot', GUILD, USER), ROOM);
  assert.deepEqual(requests[0], ['GET', `/guilds/${GUILD}/voice-states/${USER}`]);
  assert.equal(await v.memberVoiceChannel('bot', GUILD, '400000000000000002'), '');
  assert.equal(await v.memberVoiceChannel('user', GUILD, USER), ROOM2);
  assert.deepEqual(requests[2], ['voice_member_channel', { guildId: GUILD, userId: USER }]);
  assert.equal(await v.memberVoiceChannel('bot', 'not-an-id', USER), '');
  transports.bot.rest = async () => Promise.reject(Error('Discord API 403: Missing Access'));
  await assert.rejects(v.memberVoiceChannel('bot', GUILD, USER), /403/);
  v.getConfig = () => ({ enabled: true, voiceEnabled: false });
  await assert.rejects(v.memberVoiceChannel('bot', GUILD, USER), /語音未啟用/);
});
