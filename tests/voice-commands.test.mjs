// 用文字叫 AI 退出語音房／停止音樂：由程式直接辨識並執行。
import test from 'node:test';
import assert from 'node:assert/strict';
import { commandText, runVoiceCommand, voiceCommand } from '../src/voice-commands.js';

test('辨識：實機出現過的說法與常見說法', () => {
  for (const text of ['<@400000000000000009> 測試好了 你可以退出', '<@1> 測試好了 可以退出', '可以走了', '離開語音房', '你先出去', '退出語音', 'leave', '掰掰 可以下線了'])
    assert.equal(voiceCommand(text), 'leave', text);
  for (const text of ['停止音樂', '不要播了', '先停一下', '<@1> 音樂關掉', 'stop', '別播了'])
    assert.equal(voiceCommand(text), 'stop', text);
});

test('不是指令：否定、在問做法、一般聊天、太長的句子', () => {
  for (const text of [
    '不要退出',
    '先別走',
    '你還不能離開喔',
    '怎麼退出語音房',
    '為什麼你不退出',
    '不要停',
    '別關',
    '上 kkbox 播放周杰倫的告白氣球',
    '今天天氣真好',
    '',
    '我昨天離開公司的時候看到一隻貓，牠一直跟著我走到捷運站才停下來，超可愛的你知道嗎',
  ])
    assert.equal(voiceCommand(text), null, text);
  assert.equal(commandText('<@123>  <#456> hi <:x:789> https://a.b/c'), 'hi');
});

function setup({ room = { guildId: 'g', channelId: 'room', textChannelId: 'text', queue: [], current: { type: 'music' } }, leaveOk = true } = {}) {
  const calls = [];
  const sessions = new Map(room ? [['user', room]] : []);
  const voice = {
    sessions,
    leave: async (kind, reason) => (calls.push(['leave', kind, reason]), leaveOk ? (sessions.delete(kind), { ok: true }) : { ok: false, error: '離開語音尚未確認' }),
    stop: async (kind) => (calls.push(['stop', kind]), { ok: true }),
  };
  const run = (content, extra = {}, config = { musicControlEnabled: true }) =>
    runVoiceCommand({ message: { guildId: 'g', channelId: 'text', isMention: true, content, author: { id: 'u' }, ...extra }, transport: { kind: 'user' }, config, voice });
  return { calls, run };
}

test('執行：離開語音房，並給模型一句已經做完的說明', async () => {
  const { calls, run } = setup();
  const result = await run('<@1> 測試好了 可以退出');
  assert.deepEqual([result.command, result.ok], ['leave', true]);
  assert.match(result.note, /已經依這則訊息讓你離開語音房/);
  assert.match(result.note, /不要說你做不到/);
  assert.deepEqual(calls, [['leave', 'user', '文字要求離開']]);
  // 已經不在語音房：不是指令，照一般流程。
  assert.equal(await run('可以退出了'), null);
});

test('執行：停止音樂但留在語音房；沒在播就不攔', async () => {
  const playing = setup();
  const result = await playing.run('不要播了');
  assert.deepEqual([result.command, result.ok, playing.calls], ['stop', true, [['stop', 'user']]]);
  const idle = setup({ room: { guildId: 'g', channelId: 'room', queue: [], current: null } });
  assert.equal(await idle.run('停止音樂'), null);
  assert.deepEqual(idle.calls, []);
});

test('條件不符就不動作：別的頻道沒 @、模擬訊息、私訊、沒開允許點歌、語音房在別的伺服器', async () => {
  const { calls, run } = setup();
  assert.equal(await run('可以退出了', { isMention: false, channelId: 'elsewhere' }), null);
  assert.equal(await run('我先退出了', { isMention: false }), null, '在講自己，不是叫 AI 退出');
  assert.equal(await run('我要走了 掰掰', { isMention: false }), null);
  assert.equal(await run('可以退出了', { simulated: true }), null);
  assert.equal(await run('可以退出了', { guildId: '' }), null);
  assert.equal(await run('可以退出了', {}, { musicControlEnabled: false }), null);
  assert.equal(await run('可以退出了', { guildId: 'other' }), null);
  assert.deepEqual(calls, []);
});

test('離開沒有成功：照實告訴模型，不說已經離開', async () => {
  const { run } = setup({ leaveOk: false });
  const result = await run('可以退出了');
  assert.equal(result.ok, false);
  assert.match(result.note, /沒有成功/);
  assert.doesNotMatch(result.note, /已經依這則訊息讓你離開/);
});

test('點歌的那個文字頻道裡不用 @：實機出現過的「停止音樂」「退出語音房」', async () => {
  const stop = setup();
  const stopped = await stop.run('停止音樂', { isMention: false });
  assert.deepEqual([stopped.command, stop.calls], ['stop', [['stop', 'user']]]);
  const leave = setup();
  const left = await leave.run('退出語音房', { isMention: false });
  assert.deepEqual([left.command, leave.calls], ['leave', [['leave', 'user', '文字要求離開']]]);
  // 有 @ 的話「我覺得你可以退出了」這種句子照樣算。
  const mentioned = setup();
  assert.equal((await mentioned.run('我覺得你可以退出了')).command, 'leave');
  // 語音房沒有綁定文字頻道時，沒 @ 一律不算。
  const unbound = setup({ room: { guildId: 'g', channelId: 'room', textChannelId: '', queue: [], current: { type: 'music' } } });
  assert.equal(await unbound.run('退出語音房', { isMention: false }), null);
});
